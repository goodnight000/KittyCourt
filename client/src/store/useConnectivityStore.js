import { create } from 'zustand'

const HEALTH_POLL_INTERVAL_MS = 30_000
const HEALTH_POLL_INTERVAL_DOWN_MS = 15_000
const HEALTH_TIMEOUT_MS = 4_000

const resolveHealthEndpoint = () => {
  const apiUrl = import.meta.env.VITE_API_URL
  if (!apiUrl) return '/api/health'

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : undefined
    const parsed = new URL(apiUrl, origin)
    if (!parsed.pathname || parsed.pathname === '/') {
      parsed.pathname = '/api'
    }
    parsed.pathname = parsed.pathname.replace(/\/+$/, '') + '/health'
    return parsed.toString()
  } catch {
    if (String(apiUrl).startsWith('/')) {
      return `${String(apiUrl).replace(/\/+$/, '')}/health`
    }
    return '/api/health'
  }
}

const HEALTH_ENDPOINT = resolveHealthEndpoint()

const isNavigatorOnline = () => (
  typeof navigator === 'undefined' ? true : navigator.onLine !== false
)

const mapHealthStatus = (status) => {
  if (status === 'ok') return 'healthy'
  if (status === 'degraded') return 'degraded'
  if (status === 'down') return 'down'
  return 'unknown'
}

const isServerErrorStatus = (statusCode) => Number.isFinite(statusCode) && statusCode >= 500

const isNetworkLikeError = (error) => {
  const message = String(error?.message || '')
  return message.toLowerCase().includes('network') || message.toLowerCase().includes('failed to fetch')
}

const fetchWithTimeout = async (url, options = {}, timeoutMs = HEALTH_TIMEOUT_MS) => {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null

  try {
    return await fetch(url, {
      ...options,
      signal: controller?.signal,
    })
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

let monitorCleanup = null

const useConnectivityStore = create((set, get) => ({
  isOnline: isNavigatorOnline(),
  backendStatus: 'unknown', // unknown | healthy | degraded | down
  lastHealthCheckAt: null,
  lastBackendError: null,
  monitorActive: false,

  setOnlineStatus: (isOnline) => {
    if (!isOnline) {
      set({
        isOnline: false,
        backendStatus: 'down',
        lastBackendError: 'offline',
      })
      return
    }

    set({ isOnline: true })
    get().checkBackendHealth({ reason: 'online' })
  },

  markBackendHealthy: (source = 'api') => {
    set({
      backendStatus: 'healthy',
      lastBackendError: null,
      lastHealthCheckAt: new Date().toISOString(),
      lastHealthySource: source,
    })
  },

  markBackendIssue: ({ statusCode = null, error = null, source = 'api' } = {}) => {
    if (!isNavigatorOnline()) {
      set({
        isOnline: false,
        backendStatus: 'down',
        lastBackendError: 'offline',
      })
      return
    }

    const isDown = isServerErrorStatus(statusCode) || isNetworkLikeError(error)
    set({
      isOnline: true,
      backendStatus: isDown ? 'down' : 'degraded',
      lastBackendError: statusCode
        ? `http_${statusCode}`
        : (error?.message || 'backend_issue'),
      lastHealthCheckAt: new Date().toISOString(),
      lastIssueSource: source,
    })
  },

  checkBackendHealth: async ({ reason = 'manual' } = {}) => {
    if (!isNavigatorOnline()) {
      set({
        isOnline: false,
        backendStatus: 'down',
        lastBackendError: 'offline',
      })
      return false
    }

    try {
      // Use API host when VITE_API_URL points to a non-origin backend.
      // This keeps health checks aligned with actual API traffic.
      const response = await fetchWithTimeout(HEALTH_ENDPOINT, {
        method: 'GET',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })

      let payload = null
      try {
        payload = await response.json()
      } catch {
        payload = null
      }

      const nextStatus = mapHealthStatus(payload?.status)
      const resolvedStatus = response.ok
        ? (nextStatus === 'unknown' ? 'healthy' : nextStatus)
        : (response.status >= 500 ? 'down' : 'degraded')

      set({
        isOnline: true,
        backendStatus: resolvedStatus,
        lastBackendError: response.ok ? null : `http_${response.status}`,
        lastHealthCheckAt: new Date().toISOString(),
        lastHealthReason: reason,
      })

      return resolvedStatus === 'healthy'
    } catch (error) {
      set({
        isOnline: isNavigatorOnline(),
        backendStatus: 'down',
        lastBackendError: error?.name === 'AbortError'
          ? 'health_timeout'
          : (error?.message || 'health_failed'),
        lastHealthCheckAt: new Date().toISOString(),
        lastHealthReason: reason,
      })
      return false
    }
  },

  startMonitoring: () => {
    if (monitorCleanup) return monitorCleanup
    if (typeof window === 'undefined' || typeof document === 'undefined') return () => {}

    let pollTimeoutId = null
    let statusSubscriptionCleanup = null

    const clearPollTimer = () => {
      if (!pollTimeoutId) return
      clearTimeout(pollTimeoutId)
      pollTimeoutId = null
    }

    const resolveNextPollDelay = () => (
      get().backendStatus === 'down'
        ? HEALTH_POLL_INTERVAL_DOWN_MS
        : HEALTH_POLL_INTERVAL_MS
    )

    const schedulePoll = () => {
      if (pollTimeoutId || document.visibilityState !== 'visible') return

      const delayMs = resolveNextPollDelay()
      pollTimeoutId = setTimeout(async () => {
        pollTimeoutId = null

        if (document.visibilityState !== 'visible') return
        if (isNavigatorOnline()) {
          await get().checkBackendHealth({ reason: 'interval' })
        }

        schedulePoll()
      }, delayMs)
    }

    const restartPollTimer = () => {
      clearPollTimer()
      schedulePoll()
    }

    const handleOnline = () => {
      get().setOnlineStatus(true)
      restartPollTimer()
    }

    const handleOffline = () => {
      get().setOnlineStatus(false)
      restartPollTimer()
    }

    const handleFocus = () => {
      if (isNavigatorOnline()) {
        get().checkBackendHealth({ reason: 'focus' })
      }
      restartPollTimer()
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        restartPollTimer()
        if (isNavigatorOnline()) get().checkBackendHealth({ reason: 'visibility' })
      } else {
        clearPollTimer()
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)
    statusSubscriptionCleanup = useConnectivityStore.subscribe((state, previousState) => {
      if (
        state.backendStatus !== previousState.backendStatus
        || state.isOnline !== previousState.isOnline
      ) {
        restartPollTimer()
      }
    })

    set({ monitorActive: true })
    handleVisibility()

    monitorCleanup = () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
      statusSubscriptionCleanup?.()
      statusSubscriptionCleanup = null
      clearPollTimer()
      monitorCleanup = null
      set({ monitorActive: false })
    }

    return monitorCleanup
  },

  stopMonitoring: () => {
    monitorCleanup?.()
  },
}))

export default useConnectivityStore
