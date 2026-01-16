/**
 * Insights Store - Zustand store for AI insights.
 */
import { create } from 'zustand'
import api from '../services/api'
import useCacheStore, { CACHE_POLICY, cacheKey } from './useCacheStore'
import { eventBus, EVENTS } from '../lib/eventBus'

const isOnline = () => typeof navigator !== 'undefined' && navigator.onLine

let cacheListenerKey = null
let cacheUnsubscribe = null
let eventCleanupFns = []

const useInsightsStore = create((set, get) => ({
  insights: [],
  consent: null,
  meta: null,
  isLoading: false,
  serverAvailable: true,
  error: null,
  _authUserId: null,

  init: () => {
    eventCleanupFns.forEach(fn => fn())
    eventCleanupFns = []

    const unsubLogin = eventBus.on(EVENTS.AUTH_LOGIN, (payload) => {
      set({ _authUserId: payload?.userId || null })
    })

    const unsubProfile = eventBus.on(EVENTS.PROFILE_UPDATED, (payload) => {
      if (payload?.userId && !get()._authUserId) {
        set({ _authUserId: payload.userId })
      }
    })

    const unsubLogout = eventBus.on(EVENTS.AUTH_LOGOUT, () => {
      get().reset()
    })

    eventCleanupFns.push(unsubLogin, unsubProfile, unsubLogout)
  },

  cleanup: () => {
    eventCleanupFns.forEach(fn => fn())
    eventCleanupFns = []
  },

  fetchInsights: async ({ force = false } = {}) => {
    if (get().isLoading || !get().serverAvailable) return
    if (!isOnline()) return
    set({ isLoading: true, error: null })

    try {
      const userId = get()._authUserId
      const cacheStore = useCacheStore.getState()

      const applyPayload = (payload) => {
        const data = payload || {}
        set({
          insights: data.insights || data.data || [],
          consent: data.consent || null,
          meta: data.meta || null,
          isLoading: false,
          serverAvailable: true,
          error: null
        })
      }

      if (userId) {
        const key = cacheKey.insights(userId)
        if (cacheListenerKey !== key) {
          if (cacheUnsubscribe) cacheUnsubscribe()
          cacheUnsubscribe = cacheStore.subscribeKey(key, (payload) => {
            applyPayload(payload)
          })
          cacheListenerKey = key
        }

        if (force) {
          const fresh = await cacheStore.fetchAndCache(key, async () => {
            const response = await api.get('/insights')
            return response?.data || {}
          }, CACHE_POLICY.INSIGHTS)
          applyPayload(fresh)
          return
        }

        const { data, promise } = await cacheStore.getOrFetch({
          key,
          fetcher: async () => {
            const response = await api.get('/insights')
            return response?.data || {}
          },
          ...CACHE_POLICY.INSIGHTS,
        })

        applyPayload(data)

        if (promise) {
          promise.then((fresh) => applyPayload(fresh)).catch(() => {})
        }
        return
      }

      const response = await api.get('/insights')
      const data = response?.data || {}

      applyPayload(data)
    } catch (error) {
      const status = error?.response?.status
      if (status === 404) {
        set({ isLoading: false, serverAvailable: false, error: null })
        return
      }
      console.error('[InsightsStore] Failed to fetch insights:', error)
      set({ isLoading: false, error: error.message || 'Failed to load insights' })
    }
  },

  updateConsent: async (consent) => {
    if (!get().serverAvailable) return
    try {
      const response = await api.post('/insights/consent', { consent })
      const profile = response?.data?.profile || null
      const pausedUntil = profile?.ai_insights_paused_until || null
      const selfPaused = pausedUntil ? new Date(pausedUntil) > new Date() : false
      set({
        consent: {
          ...(get().consent || {}),
          selfConsent: !!profile?.ai_insights_consent,
          selfConsentAt: profile?.ai_insights_consent_at || null,
          selfPausedUntil: pausedUntil,
          selfPaused
        }
      })
      get().fetchInsights({ force: true })
    } catch (error) {
      console.error('[InsightsStore] Failed to update consent:', error)
      set({ error: 'Failed to update consent' })
    }
  },

  pauseInsights: async (days = 7) => {
    if (!get().serverAvailable) return
    try {
      const response = await api.post('/insights/pause', { days })
      const pausedUntil = response?.data?.pausedUntil || null
      set({
        consent: {
          ...(get().consent || {}),
          selfPausedUntil: pausedUntil,
          selfPaused: true
        }
      })
      get().fetchInsights({ force: true })
    } catch (error) {
      console.error('[InsightsStore] Failed to pause insights:', error)
      set({ error: 'Failed to pause insights' })
    }
  },

  sendFeedback: async (insightId, helpful) => {
    if (!get().serverAvailable) return
    try {
      await api.post(`/insights/${insightId}/feedback`, { helpful })
    } catch (error) {
      console.error('[InsightsStore] Failed to send feedback:', error)
      set({ error: 'Failed to send feedback' })
    }
  },

  clearError: () => set({ error: null }),

  reset: () => {
    if (cacheUnsubscribe) cacheUnsubscribe()
    cacheUnsubscribe = null
    cacheListenerKey = null
    set({
      insights: [],
      consent: null,
      meta: null,
      isLoading: false,
      serverAvailable: true,
      error: null,
      _authUserId: null
    })
  }
}))

export default useInsightsStore
