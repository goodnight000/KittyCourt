/**
 * Insights Store - Zustand store for AI insights.
 */
import { create } from 'zustand'
import api from '../services/api'

const useInsightsStore = create((set, get) => ({
  insights: [],
  consent: null,
  isLoading: false,
  serverAvailable: true,
  error: null,

  fetchInsights: async () => {
    if (get().isLoading || !get().serverAvailable) return
    set({ isLoading: true, error: null })

    try {
      const response = await api.get('/insights')
      const data = response?.data || {}

      set({
        insights: data.insights || [],
        consent: data.consent || null,
        isLoading: false,
        serverAvailable: true,
        error: null
      })
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
      get().fetchInsights()
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
      get().fetchInsights()
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

  reset: () => set({
    insights: [],
    consent: null,
    isLoading: false,
    serverAvailable: true,
    error: null
  })
}))

export default useInsightsStore
