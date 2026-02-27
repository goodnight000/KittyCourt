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
    })
  })

  afterEach(() => {
    useConnectivityStore.getState().stopMonitoring()
    vi.unstubAllGlobals()
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('marks backend down on 503 health response', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({ status: 'down' }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    await useConnectivityStore.getState().checkBackendHealth({ reason: 'test' })

    const state = useConnectivityStore.getState()
    expect(state.backendStatus).toBe('down')
    expect(state.lastBackendError).toBe('http_503')
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
