import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConnectivityBanner from './ConnectivityBanner'
import useConnectivityStore from '../store/useConnectivityStore'

describe('ConnectivityBanner', () => {
  beforeEach(() => {
    useConnectivityStore.setState({
      isOnline: true,
      backendStatus: 'healthy',
      lastHealthCheckAt: null,
      lastBackendError: null,
    })
  })

  it('shows reconnect cadence details in backend-down popup and retries on demand', async () => {
    const user = userEvent.setup()
    const retrySpy = vi.fn()

    useConnectivityStore.setState({
      isOnline: true,
      backendStatus: 'down',
      lastHealthCheckAt: '2026-02-27T12:00:00.000Z',
      lastBackendError: 'http_503',
      checkBackendHealth: retrySpy,
    })

    render(<ConnectivityBanner />)

    await user.click(screen.getByRole('button', { name: /server is unavailable/i }))

    expect(screen.getByText('Pause is trying to reconnect automatically every 30 seconds.')).toBeInTheDocument()
    expect(screen.getByText('When servers are down, we check again every 15 seconds while this app is open.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /show details/i }))
    expect(screen.getByText(/http_503/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /retry now/i }))
    expect(retrySpy).toHaveBeenCalledWith({ reason: 'banner_retry' })
  })
})
