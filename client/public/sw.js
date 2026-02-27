/* global workbox */
importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js')

if (workbox) {
  workbox.core.skipWaiting()
  workbox.core.clientsClaim()

  workbox.precaching.precacheAndRoute([
    { url: '/offline.html', revision: '1' }
  ])

  workbox.routing.registerRoute(
    ({ request }) => request.destination === 'document',
    new workbox.strategies.NetworkFirst({
      cacheName: 'pause-pages',
      networkTimeoutSeconds: 4
    })
  )

  workbox.routing.registerRoute(
    ({ request }) =>
      request.destination === 'style'
      || request.destination === 'script'
      || request.destination === 'worker',
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'pause-assets'
    })
  )

  workbox.routing.registerRoute(
    ({ request }) => request.destination === 'image',
    new workbox.strategies.CacheFirst({
      cacheName: 'pause-images',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 60,
          maxAgeSeconds: 30 * 24 * 60 * 60
        })
      ]
    })
  )

  const apiQueue = new workbox.backgroundSync.BackgroundSyncPlugin('pause-api-queue', {
    maxRetentionTime: 24 * 60
  })

  // Retry mutation requests when the server returns 5xx so writes are queued and replayed.
  const retryServerFailuresPlugin = {
    fetchDidSucceed: async ({ response }) => {
      if (response?.status >= 500) {
        throw new Error(`Retryable server response: ${response.status}`)
      }
      return response
    }
  }

  const mutationHandler = new workbox.strategies.NetworkOnly({
    plugins: [retryServerFailuresPlugin, apiQueue]
  })

  const registerMutationRoute = (method) => {
    workbox.routing.registerRoute(
      ({ url }) => url.pathname.startsWith('/api/'),
      mutationHandler,
      method
    )
  }

  ;['POST', 'PUT', 'PATCH', 'DELETE'].forEach(registerMutationRoute)

  workbox.routing.setCatchHandler(async ({ event }) => {
    if (event.request.destination === 'document') {
      return await caches.match('/offline.html')
    }
    return Response.error()
  })
}

self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.json() : {}
  const title = payload.title || 'Pause'
  const options = {
    body: payload.body || 'You have a new update.',
    icon: '/assets/avatars/judge_whiskers.png',
    badge: '/assets/avatars/judge_whiskers.png',
    data: {
      url: payload.url || '/'
    }
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification?.data?.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }
      return null
    })
  )
})
