import { describe, it, expect, vi } from 'vitest'
import { eventBus, EVENTS } from '../lib/eventBus'

vi.mock('./useAuthStore', () => ({
  default: {
    getState: () => ({
      user: null,
      profile: null,
      refreshProfile: vi.fn(),
      setProfile: vi.fn()
    })
  }
}))

vi.mock('../services/supabase', () => ({
  supabase: { removeChannel: vi.fn() },
  findByPartnerCode: vi.fn(),
  sendPartnerRequest: vi.fn(),
  getPendingRequests: vi.fn(),
  getSentRequest: vi.fn(),
  acceptPartnerRequest: vi.fn(),
  rejectPartnerRequest: vi.fn(),
  cancelPartnerRequest: vi.fn(),
  getPartnerProfile: vi.fn(),
  getProfile: vi.fn(),
  subscribeToPartnerRequests: vi.fn(),
  subscribeToProfileChanges: vi.fn(),
  disconnectPartner: vi.fn(),
  getDisconnectStatus: vi.fn(async () => ({ data: { status: 'none' }, error: null }))
}))

import usePartnerStore from './usePartnerStore'

describe('usePartnerStore', () => {
  it('starts with empty partner state', () => {
    const state = usePartnerStore.getState()
    expect(state.partner).toBeNull()
    expect(state.pendingRequests).toEqual([])
    expect(state.sentRequest).toBeNull()
    expect(state.hasPartner).toBe(false)
    expect(state.disconnectStatus).toBeNull()
    expect(state.disconnectStatusLoaded).toBe(false)
  })

  it('syncs partner state and emits connection event', () => {
    const eventSpy = vi.fn()
    const unsubscribe = eventBus.on(EVENTS.PARTNER_CONNECTED, eventSpy)

    usePartnerStore.getState().syncFromProfile({
      profile: { id: 'user-1', partner_id: 'partner-2', anniversary_date: '2024-01-01' },
      partner: { id: 'partner-2', display_name: 'Partner' },
      requests: [],
      sent: null
    })

    const state = usePartnerStore.getState()
    expect(state.hasPartner).toBe(true)
    expect(state.partner?.id).toBe('partner-2')
    expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      partnerId: 'partner-2'
    }))

    unsubscribe()
  })
})
