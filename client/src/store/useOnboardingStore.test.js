import { describe, it, expect, vi } from 'vitest'

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
})
