import { describe, it, expect, vi } from 'vitest'

vi.mock('./useAuthStore', () => ({
  default: {
    getState: () => ({
      user: null,
      profile: null,
      preferredLanguage: 'en',
      setProfile: vi.fn()
    })
  }
}))

vi.mock('../services/supabase', () => ({
  generatePartnerCode: vi.fn(() => 'CODE123'),
  upsertProfile: vi.fn()
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
    const result = await useOnboardingStore.getState().completeOnboarding()
    expect(result.error).toBeDefined()
  })
})
