import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { quotaSafeLocalStorage } from './quotaSafeStorage'
import { eventBus, EVENTS } from '../lib/eventBus'
import { DEFAULT_LANGUAGE } from '../i18n/languageConfig'
import { generatePartnerCode, upsertProfile } from '../services/supabase'
import useAuthStore from './useAuthStore'

const initialState = {
  onboardingComplete: false,
  onboardingStep: 0,
  onboardingData: {}
}

const useOnboardingStore = create(
  persist(
    (set, get) => {
      eventBus.on(EVENTS.AUTH_LOGOUT, () => {
        set({ ...initialState })
      })

      eventBus.on(EVENTS.AUTH_LOGIN, (payload) => {
        if (payload?.profile) {
          set({ onboardingComplete: !!payload.profile.onboarding_complete })
        }
      })

      eventBus.on(EVENTS.PROFILE_UPDATED, (payload) => {
        if (payload?.profile) {
          set({ onboardingComplete: !!payload.profile.onboarding_complete })
        }
      })

      return {
        ...initialState,

        setOnboardingStep: (step) => set({ onboardingStep: step }),

        updateOnboardingData: (data) => set((state) => ({
          onboardingData: { ...state.onboardingData, ...data }
        })),

        completeOnboarding: async () => {
          const { user, profile: existingProfile, preferredLanguage } = useAuthStore.getState()
          const { onboardingData } = get()

          if (!user) {
            return { error: 'No user logged in' }
          }

          try {
            const partnerCode = existingProfile?.partner_code || generatePartnerCode()

            let avatarUrl = onboardingData.avatarUrl || null
            if (avatarUrl && avatarUrl.startsWith('data:')) {
              try {
                const { processAvatarForSave } = await import('../services/avatarService')
                const { url, error: avatarError } = await processAvatarForSave(user.id, avatarUrl)
                if (avatarError) {
                  console.warn('[Onboarding] Avatar upload failed:', avatarError)
                  avatarUrl = null
                } else {
                  avatarUrl = url
                }
              } catch (e) {
                console.warn('[Onboarding] Avatar processing exception:', e)
                avatarUrl = null
              }
            }

            const profileData = {
              id: user.id,
              email: user.email,
              partner_code: partnerCode,
              display_name: onboardingData.displayName,
              birthday: onboardingData.birthday,
              avatar_url: avatarUrl,
              love_language: onboardingData.loveLanguage,
              communication_style: onboardingData.communicationStyle,
              conflict_style: onboardingData.conflictStyle,
              favorite_date_activities: onboardingData.favoriteDateActivities || [],
              pet_peeves: onboardingData.petPeeves || [],
              appreciation_style: onboardingData.appreciationStyle,
              bio: onboardingData.bio || null,
              onboarding_complete: true,
              preferred_language: preferredLanguage || DEFAULT_LANGUAGE,
              updated_at: new Date().toISOString()
            }

            const { data, error } = await upsertProfile(profileData)
            if (error) {
              return { error: error.message || 'Failed to save profile' }
            }

            if (!data) {
              return { error: 'Failed to save profile - no data returned' }
            }

            useAuthStore.getState().setProfile(data)
            set({
              onboardingComplete: true,
              onboardingStep: 0,
              onboardingData: {}
            })

            return { data }
          } catch (err) {
            console.error('Exception in completeOnboarding:', err)
            return { error: err.message || 'An unexpected error occurred' }
          }
        }
      }
    },
    {
      name: 'pause-onboarding',
      storage: quotaSafeLocalStorage,
      partialize: (state) => ({
        onboardingComplete: state.onboardingComplete,
        onboardingData: state.onboardingData
          ? {
            ...state.onboardingData,
            avatarUrl:
              typeof state.onboardingData.avatarUrl === 'string' &&
                (state.onboardingData.avatarUrl.startsWith('data:') || state.onboardingData.avatarUrl.length > 2048)
                ? undefined
                : state.onboardingData.avatarUrl
          }
          : {},
        onboardingStep: state.onboardingStep
      })
    }
  )
)

export default useOnboardingStore
