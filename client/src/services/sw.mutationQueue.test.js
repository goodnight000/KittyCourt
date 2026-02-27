import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const loadServiceWorker = () => {
  const swPath = path.resolve(__dirname, '../../public/sw.js')
  const source = fs.readFileSync(swPath, 'utf8')
  const routes = []

  class MockNetworkFirst {
    constructor(options) {
      this.options = options
    }
  }
  class MockStaleWhileRevalidate {
    constructor(options) {
      this.options = options
    }
  }
  class MockCacheFirst {
    constructor(options) {
      this.options = options
    }
  }
  class MockNetworkOnly {
    constructor(options) {
      this.options = options
      this.plugins = options?.plugins || []
    }
  }
  class MockExpirationPlugin {
    constructor(options) {
      this.options = options
    }
  }
  class MockBackgroundSyncPlugin {
    constructor(name, options) {
      this.name = name
      this.options = options
    }
  }

  const context = {
    importScripts: () => {},
    console,
    setTimeout,
    clearTimeout,
    URL,
    caches: { match: async () => null },
    Response: { error: () => ({ type: 'error' }) },
    clients: {
      matchAll: async () => [],
      openWindow: async () => null,
    },
    self: {
      location: { origin: 'https://pause.app' },
      addEventListener: () => {},
      registration: { showNotification: async () => {} },
    },
    workbox: {
      core: {
        skipWaiting: () => {},
        clientsClaim: () => {},
      },
      precaching: {
        precacheAndRoute: () => {},
      },
      routing: {
        registerRoute: (match, strategy, method) => {
          routes.push({ match, strategy, method: method || 'GET' })
        },
        setCatchHandler: () => {},
      },
      strategies: {
        NetworkFirst: MockNetworkFirst,
        StaleWhileRevalidate: MockStaleWhileRevalidate,
        CacheFirst: MockCacheFirst,
        NetworkOnly: MockNetworkOnly,
      },
      expiration: {
        ExpirationPlugin: MockExpirationPlugin,
      },
      backgroundSync: {
        BackgroundSyncPlugin: MockBackgroundSyncPlugin,
      },
    },
  }

  vm.runInNewContext(source, context, { filename: 'sw.js' })
  return { routes }
}

describe('service worker mutation durability', () => {
  it('queues mutation retries on 5xx responses', async () => {
    const { routes } = loadServiceWorker()
    const postRoute = routes.find((route) => route.method === 'POST')
    expect(postRoute).toBeTruthy()

    const retryPlugin = postRoute.strategy.plugins.find(
      (plugin) => typeof plugin.fetchDidSucceed === 'function'
    )
    expect(retryPlugin).toBeTruthy()

    await expect(
      retryPlugin.fetchDidSucceed({ response: { status: 200 } })
    ).resolves.toEqual({ status: 200 })

    await expect(
      retryPlugin.fetchDidSucceed({ response: { status: 503 } })
    ).rejects.toThrow('Retryable server response: 503')
  })

  it('matches /api mutation routes regardless of origin', () => {
    const { routes } = loadServiceWorker()
    const patchRoute = routes.find((route) => route.method === 'PATCH')
    expect(patchRoute).toBeTruthy()

    const matches = patchRoute.match({
      url: new URL('https://api.pause-app.com/api/memories/1'),
    })
    expect(matches).toBe(true)
  })
})
