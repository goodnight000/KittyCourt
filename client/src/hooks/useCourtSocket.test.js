import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('socket.io-client', () => ({
  io: vi.fn(),
}))

const createMockSocket = () => {
  const handlers = {}
  const socket = {
    id: `socket-${Math.random().toString(36).slice(2)}`,
    connected: false,
    on: vi.fn((event, callback) => {
      handlers[event] = callback
      return socket
    }),
    emit: vi.fn(),
    disconnect: vi.fn(),
  }
  return { socket, handlers }
}

describe('useCourtSocket resilience', () => {
  let ioMock
  let useAuthStore
  let useCourtStore
  let useCourtSocket

  beforeEach(async () => {
    vi.resetModules()
    vi.useFakeTimers()

    ioMock = (await import('socket.io-client')).io
    useAuthStore = (await import('../store/useAuthStore')).default
    useCourtStore = (await import('../store/useCourtStore')).default
    useCourtSocket = (await import('./useCourtSocket')).default

    useAuthStore.setState({
      user: { id: 'user-1' },
      session: { access_token: 'token-1' },
      isAuthenticated: true,
      hasCheckedAuth: true,
      isLoading: false,
    })
    useCourtStore.setState({
      _authUserId: 'user-1',
      isConnected: false,
      error: null,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('sets connected state on connect and reconnects after disconnect', async () => {
    const sockets = []
    const handlers = []

    ioMock.mockImplementation(() => {
      const next = createMockSocket()
      sockets.push(next.socket)
      handlers.push(next.handlers)
      return next.socket
    })

    const { unmount } = renderHook(() => useCourtSocket())

    expect(ioMock).toHaveBeenCalledTimes(1)
    expect(sockets[0]).toBeTruthy()

    await act(async () => {
      sockets[0].connected = true
      handlers[0].connect?.()
    })

    expect(useCourtStore.getState().isConnected).toBe(true)
    expect(sockets[0].emit).toHaveBeenCalledWith(
      'court:register',
      { userId: 'user-1' },
      expect.any(Function)
    )

    await act(async () => {
      sockets[0].connected = false
      handlers[0].disconnect?.('transport close')
    })

    expect(useCourtStore.getState().isConnected).toBe(false)

    await act(async () => {
      vi.advanceTimersByTime(1000)
    })

    expect(ioMock).toHaveBeenCalledTimes(2)
    unmount()
  })
})
