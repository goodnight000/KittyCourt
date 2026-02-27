import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { quotaSafeLocalStorage } from './quotaSafeStorage'
import { eventBus, EVENTS } from '../lib/eventBus'
import { DEFAULT_LANGUAGE } from '../i18n/languageConfig'
import { supabase, generatePartnerCode, upsertProfile } from '../services/supabase'

const initialState = {
  onboardingComplete: false,
  onboardingStep: 0,
  onboardingData: {},
  _authUserId: null,
  _authProfile: null,
  _preferredLanguage: DEFAULT_LANGUAGE
}

let eventCleanupFns = []

const useOnboardingStore = create(
  persist(
    (set, get) => {
      return {
        ...initialState,
        init: () => {
          eventCleanupFns.forEach(fn => fn())
          eventCleanupFns = []

          const unsubLogin = eventBus.on(EVENTS.AUTH_LOGIN, (payload) => {
            set({
              _authUserId: payload?.userId || null,
              _authProfile: payload?.profile || null,
              _preferredLanguage: payload?.preferredLanguage
                || payload?.profile?.preferred_language
                || get()._preferredLanguage,
              onboardingComplete: !!payload?.profile?.onboarding_complete
            })
          })

          const unsubProfile = eventBus.on(EVENTS.PROFILE_UPDATED, (payload) => {
            if (!payload?.profile) return
            set({
              _authProfile: payload.profile,
              _preferredLanguage: payload.profile?.preferred_language || get()._preferredLanguage,
              onboardingComplete: !!payload.profile.onboarding_complete
            })
          })

          const unsubLanguage = eventBus.on(EVENTS.LANGUAGE_CHANGED, (payload) => {
            if (payload?.language) {
              set({ _preferredLanguage: payload.language })
            }
          })

          const unsubLogout = eventBus.on(EVENTS.AUTH_LOGOUT, () => {
            set({ ...initialState })
          })

          eventCleanupFns.push(unsubLogin, unsubProfile, unsubLanguage, unsubLogout)
        },

        cleanup: () => {
          eventCleanupFns.forEach(fn => fn())
          eventCleanupFns = []
        },

        setOnboardingStep: (step) => set({ onboardingStep: step }),

        updateOnboardingData: (data) => set((state) => ({
          onboardingData: { ...state.onboardingData, ...data }
        })),

        completeOnboarding: async () => {
          const { onboardingData, _authProfile, _preferredLanguage } = get()

          const { data: { user } } = await supabase.auth.getUser()

          if (!user) {
            return { error: 'No user logged in' }
          }

          try {
            const partnerCode = _authProfile?.partner_code || generatePartnerCode()

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
              ai_insights_consent: !!onboardingData.aiConsent,
              ai_insights_consent_at: onboardingData.aiConsent ? new Date().toISOString() : null,
              bio: onboardingData.bio || null,
              onboarding_complete: true,
              preferred_language: _preferredLanguage || _authProfile?.preferred_language || DEFAULT_LANGUAGE,
              updated_at: new Date().toISOString()
            }

            const { data, error } = await upsertProfile(profileData)
            if (error) {
              return { error: error.message || 'Failed to save profile' }
            }

            if (!data) {
              return { error: 'Failed to save profile - no data returned' }
            }

            set({
              onboardingComplete: true,
              onboardingStep: 0,
              onboardingData: {},
              _authProfile: data
            })

            eventBus.emit(EVENTS.PROFILE_UPDATED, {
              userId: data.id,
              profile: data,
              source: 'onboarding'
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
      storage: createJSONStorage(() => quotaSafeLocalStorage),
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
