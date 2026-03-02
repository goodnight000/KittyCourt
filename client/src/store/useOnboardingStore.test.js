import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(async () => ({ data: { user: null } })),
  upsertProfile: vi.fn()
}))

vi.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      getUser: mocks.getUser
    }
  },
  generatePartnerCode: vi.fn(() => 'CODE123'),
  upsertProfile: mocks.upsertProfile
}))

import useOnboardingStore from './useOnboardingStore'
import { eventBus, EVENTS } from '../lib/eventBus'

describe('useOnboardingStore', () => {
  it('starts with onboarding incomplete', () => {
    const state = useOnboardingStore.getState()
    expect(state.onboardingComplete).toBe(false)
    expect(state.onboardingStep).toBe(0)
    expect(state.onboardingData).toEqual({})
  })

  it('returns error when completing onboarding without user', async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null } })
    const result = await useOnboardingStore.getState().completeOnboarding()
    expect(result.error).toBeDefined()
  })

  it('persists AI consent fields when completing onboarding', async () => {
    const now = new Date('2026-02-24T12:00:00.000Z')
    vi.useFakeTimers()
    vi.setSystemTime(now)

    mocks.getUser.mockResolvedValueOnce({
      data: { user: { id: 'user-1', email: 'user-1@example.com' } }
    })

    mocks.upsertProfile.mockResolvedValueOnce({
      data: { id: 'user-1', onboarding_complete: true },
      error: null
    })

    const store = useOnboardingStore.getState()
    store.updateOnboardingData({
      displayName: 'User One',
      aiConsent: true
    })

    const result = await store.completeOnboarding()
    expect(result.error).toBeUndefined()
    expect(mocks.upsertProfile).toHaveBeenCalledTimes(1)
    expect(mocks.upsertProfile.mock.calls[0][0]).toMatchObject({
      id: 'user-1',
      ai_insights_consent: true,
      ai_insights_consent_at: now.toISOString()
    })

    vi.useRealTimers()
  })

  describe('AUTH_LOGOUT handling', () => {
    beforeEach(() => {
      // Initialize event bus listeners
      useOnboardingStore.getState().init()
    })

    it('does NOT reset onboardingComplete on AUTH_LOGOUT when it was true', () => {
      useOnboardingStore.setState({ onboardingComplete: true })

      eventBus.emit(EVENTS.AUTH_LOGOUT, { userId: null, source: 'auth' })

      expect(useOnboardingStore.getState().onboardingComplete).toBe(true)
    })

    it('resets transient fields on AUTH_LOGOUT', () => {
      useOnboardingStore.setState({
        onboardingComplete: true,
        _authUserId: 'user-1',
        _authProfile: { id: 'user-1' },
        onboardingData: { displayName: 'Test' },
        onboardingStep: 3,
      })

      eventBus.emit(EVENTS.AUTH_LOGOUT, { userId: null, source: 'auth' })

      const state = useOnboardingStore.getState()
      expect(state._authUserId).toBeNull()
      expect(state._authProfile).toBeNull()
      expect(state.onboardingData).toEqual({})
      expect(state.onboardingStep).toBe(0)
    })

    it('AUTH_LOGIN with onboarding_complete:false correctly sets onboardingComplete=false', () => {
      useOnboardingStore.setState({ onboardingComplete: true })

      eventBus.emit(EVENTS.AUTH_LOGIN, {
        userId: 'new-user',
        profile: { id: 'new-user', onboarding_complete: false },
        source: 'auth',
      })

      expect(useOnboardingStore.getState().onboardingComplete).toBe(false)
    })
  })
})
