import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import useConnectivityStore from './useConnectivityStore'

describe('useConnectivityStore', () => {
  beforeEach(() => {
    vi.useRealTimers()
    useConnectivityStore.setState({
      isOnline: true,
      backendStatus: 'unknown',
      lastHealthCheckAt: null,
      lastBackendError: null,
      monitorActive: false,
      reconnectInProgress: false,
      reconnectAttemptCount: 0,
    })
  })

  afterEach(() => {
    useConnectivityStore.getState().cancelReconnectSequence?.()
    useConnectivityStore.getState().stopMonitoring()
    vi.unstubAllGlobals()
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('delays backend-down state on 503 responses until reconnect retries are exhausted', async () => {
    vi.useFakeTimers()

    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({ status: 'down' }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    useConnectivityStore.setState({
      isOnline: true,
      backendStatus: 'healthy',
      lastBackendError: null,
    })

    await useConnectivityStore.getState().checkBackendHealth({ reason: 'test' })

    expect(useConnectivityStore.getState().backendStatus).toBe('healthy')

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await vi.advanceTimersByTimeAsync(2000)
    }

    expect(useConnectivityStore.getState().backendStatus).toBe('down')
    expect(useConnectivityStore.getState().lastBackendError).toBe('http_503')
    expect(fetchMock).toHaveBeenCalledTimes(11)
  })

  it('marks backend healthy on successful health response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ status: 'ok' }),
    })))

    await useConnectivityStore.getState().checkBackendHealth({ reason: 'test' })
    expect(useConnectivityStore.getState().backendStatus).toBe('healthy')
  })

  it('retries every 2 seconds for 10 attempts before surfacing backend-down state', async () => {
    vi.useFakeTimers()

    const fetchMock = vi.fn(async () => {
      throw new Error('Failed to fetch')
    })
    vi.stubGlobal('fetch', fetchMock)

    useConnectivityStore.setState({
      isOnline: true,
      backendStatus: 'healthy',
      lastBackendError: null,
    })

    const checkPromise = useConnectivityStore.getState().checkBackendHealth({ reason: 'test' })
    await checkPromise

    // Initial failure should start reconnect attempts, not immediately show degraded/down UI.
    expect(useConnectivityStore.getState().backendStatus).toBe('healthy')

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await vi.advanceTimersByTimeAsync(2000)
    }

    expect(useConnectivityStore.getState().backendStatus).toBe('down')
    expect(fetchMock).toHaveBeenCalledTimes(11)
  })

  it('applies the same delayed surfacing when API errors mark backend issues', async () => {
    vi.useFakeTimers()

    const fetchMock = vi.fn(async () => {
      throw new Error('Failed to fetch')
    })
    vi.stubGlobal('fetch', fetchMock)

    useConnectivityStore.setState({
      isOnline: true,
      backendStatus: 'healthy',
      lastBackendError: null,
    })

    useConnectivityStore.getState().markBackendIssue({
      error: new Error('Network unavailable'),
      source: 'api_error',
    })

    expect(useConnectivityStore.getState().backendStatus).toBe('healthy')
    expect(useConnectivityStore.getState().reconnectInProgress).toBe(true)

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await vi.advanceTimersByTimeAsync(2000)
    }

    expect(useConnectivityStore.getState().backendStatus).toBe('down')
    expect(fetchMock).toHaveBeenCalledTimes(10)
  })

  it('schedules health checks every 15 seconds when backend is down', () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({ status: 'down' }),
    })))

    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    useConnectivityStore.setState({
      isOnline: true,
      backendStatus: 'down',
      lastBackendError: 'http_503',
    })

    const stop = useConnectivityStore.getState().startMonitoring()

    const has15sPoll = timeoutSpy.mock.calls.some((call) => call[1] === 15000)
    stop?.()
    expect(has15sPoll).toBe(true)
  })

  it('schedules health checks every 30 seconds when backend is not down', () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ status: 'ok' }),
    })))

    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    useConnectivityStore.setState({
      isOnline: true,
      backendStatus: 'healthy',
      lastBackendError: null,
    })

    const stop = useConnectivityStore.getState().startMonitoring()

    const has30sPoll = timeoutSpy.mock.calls.some((call) => call[1] === 30000)
    stop?.()
    expect(has30sPoll).toBe(true)
  })
})
