import { create } from 'zustand'

const HEALTH_POLL_INTERVAL_MS = 30_000
const HEALTH_POLL_INTERVAL_DOWN_MS = 15_000
const HEALTH_TIMEOUT_MS = 4_000
const RECONNECT_RETRY_DELAY_MS = 2_000
const RECONNECT_MAX_ATTEMPTS = 10

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const probeBackendHealth = async () => {
  try {
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

    return {
      status: resolvedStatus,
      statusCode: response.ok ? null : response.status,
      error: null,
      errorCode: response.ok
        ? (resolvedStatus === 'healthy' ? null : `health_${resolvedStatus}`)
        : `http_${response.status}`,
    }
  } catch (error) {
    return {
      status: 'down',
      statusCode: null,
      error,
      errorCode: error?.name === 'AbortError'
        ? 'health_timeout'
        : (error?.message || 'health_failed'),
    }
  }
}

let monitorCleanup = null
let reconnectSequenceId = 0

const useConnectivityStore = create((set, get) => ({
  isOnline: isNavigatorOnline(),
  backendStatus: 'unknown', // unknown | healthy | degraded | down
  lastHealthCheckAt: null,
  lastBackendError: null,
  monitorActive: false,
  reconnectInProgress: false,
  reconnectAttemptCount: 0,

  setOnlineStatus: (isOnline) => {
    if (!isOnline) {
      reconnectSequenceId += 1
      set({
        isOnline: false,
        backendStatus: 'down',
        lastBackendError: 'offline',
        reconnectInProgress: false,
        reconnectAttemptCount: 0,
      })
      return
    }

    set({ isOnline: true })
    get().checkBackendHealth({ reason: 'online' })
  },

  markBackendHealthy: (source = 'api') => {
    reconnectSequenceId += 1
    set({
      backendStatus: 'healthy',
      lastBackendError: null,
      lastHealthCheckAt: new Date().toISOString(),
      lastHealthySource: source,
      reconnectInProgress: false,
      reconnectAttemptCount: 0,
    })
  },

  cancelReconnectSequence: () => {
    reconnectSequenceId += 1
    set({
      reconnectInProgress: false,
      reconnectAttemptCount: 0,
    })
  },

  markBackendIssue: ({
    statusCode = null,
    error = null,
    source = 'api',
    issueStatus = null,
    errorCode = null,
    triggerReconnect = true,
    healthReason = 'issue',
  } = {}) => {
    if (!isNavigatorOnline()) {
      reconnectSequenceId += 1
      set({
        isOnline: false,
        backendStatus: 'down',
        lastBackendError: 'offline',
        reconnectInProgress: false,
        reconnectAttemptCount: 0,
      })
      return
    }

    const isDown = issueStatus
      ? issueStatus === 'down'
      : (isServerErrorStatus(statusCode) || isNetworkLikeError(error))
    const resolvedStatus = issueStatus || (isDown ? 'down' : 'degraded')
    const resolvedErrorCode = errorCode || (
      statusCode
        ? `http_${statusCode}`
        : (error?.message || 'backend_issue')
    )
    const nowIso = new Date().toISOString()
    const currentState = get()
    const shouldStartReconnect = triggerReconnect
      && currentState.backendStatus !== 'down'
      && currentState.backendStatus !== 'degraded'
      && !currentState.reconnectInProgress

    if (shouldStartReconnect) {
      set({
        isOnline: true,
        lastBackendError: resolvedErrorCode,
        lastHealthCheckAt: nowIso,
        lastIssueSource: source,
        lastHealthReason: healthReason,
        reconnectInProgress: true,
        reconnectAttemptCount: 0,
      })
      void get().runReconnectSequence({
        source,
        issueStatus: resolvedStatus,
        statusCode,
        error,
        errorCode: resolvedErrorCode,
      })
      return
    }

    if (currentState.reconnectInProgress && triggerReconnect) {
      set({
        isOnline: true,
        lastBackendError: resolvedErrorCode,
        lastHealthCheckAt: nowIso,
        lastIssueSource: source,
        lastHealthReason: healthReason,
      })
      return
    }

    reconnectSequenceId += 1
    set({
      isOnline: true,
      backendStatus: resolvedStatus,
      lastBackendError: resolvedErrorCode,
      lastHealthCheckAt: nowIso,
      lastIssueSource: source,
      lastHealthReason: healthReason,
      reconnectInProgress: false,
      reconnectAttemptCount: 0,
    })
  },

  runReconnectSequence: async ({
    source = 'api',
    issueStatus = 'down',
    statusCode = null,
    error = null,
    errorCode = 'backend_issue',
  } = {}) => {
    const sequenceId = ++reconnectSequenceId
    let lastFailure = {
      issueStatus,
      statusCode,
      error,
      errorCode,
    }

    for (let attempt = 1; attempt <= RECONNECT_MAX_ATTEMPTS; attempt += 1) {
      await sleep(RECONNECT_RETRY_DELAY_MS)
      if (sequenceId !== reconnectSequenceId) return false

      if (!isNavigatorOnline()) {
        get().setOnlineStatus(false)
        return false
      }

      set({ reconnectAttemptCount: attempt })
      const probe = await probeBackendHealth()
      if (sequenceId !== reconnectSequenceId) return false

      if (probe.status === 'healthy') {
        get().markBackendHealthy('reconnect')
        return true
      }

      lastFailure = {
        issueStatus: probe.status || issueStatus,
        statusCode: probe.statusCode ?? statusCode,
        error: probe.error ?? error,
        errorCode: probe.errorCode || errorCode,
      }
      set({
        isOnline: true,
        lastBackendError: lastFailure.errorCode,
        lastHealthCheckAt: new Date().toISOString(),
        lastIssueSource: `${source}_reconnect`,
        lastHealthReason: `reconnect_attempt_${attempt}`,
      })
    }

    if (sequenceId !== reconnectSequenceId) return false

    get().markBackendIssue({
      statusCode: lastFailure.statusCode,
      error: lastFailure.error,
      source: `${source}_retries_exhausted`,
      issueStatus: lastFailure.issueStatus,
      errorCode: lastFailure.errorCode,
      triggerReconnect: false,
      healthReason: 'reconnect_exhausted',
    })
    return false
  },

  checkBackendHealth: async ({ reason = 'manual', triggerReconnect = true } = {}) => {
    if (!isNavigatorOnline()) {
      reconnectSequenceId += 1
      set({
        isOnline: false,
        backendStatus: 'down',
        lastBackendError: 'offline',
        reconnectInProgress: false,
        reconnectAttemptCount: 0,
      })
      return false
    }

    // Use API host when VITE_API_URL points to a non-origin backend.
    // This keeps health checks aligned with actual API traffic.
    const probe = await probeBackendHealth()
    if (probe.status === 'healthy') {
      get().markBackendHealthy(`health_${reason}`)
      set({ lastHealthReason: reason })
      return true
    }

    if (!triggerReconnect) {
      set({
        isOnline: true,
        lastBackendError: probe.errorCode,
        lastHealthCheckAt: new Date().toISOString(),
        lastHealthReason: reason,
      })
      return false
    }

    get().markBackendIssue({
      statusCode: probe.statusCode,
      error: probe.error,
      source: `health_${reason}`,
      issueStatus: probe.status,
      errorCode: probe.errorCode,
      triggerReconnect: true,
      healthReason: reason,
    })
    return false
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
