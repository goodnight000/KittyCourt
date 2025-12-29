/**
 * InsightsPage - AI relationship insights.
 */
import React, { useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Sparkles, PauseCircle, ThumbsUp, ThumbsDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import useLevelStore from '../store/useLevelStore'
import useAuthStore from '../store/useAuthStore'
import useInsightsStore from '../store/useInsightsStore'

const InsightsPage = () => {
  const navigate = useNavigate()
  const { hasPartner } = useAuthStore()
  const { level, shouldShowInsights, fetchLevel, serverAvailable } = useLevelStore()
  const {
    insights,
    consent,
    isLoading,
    error,
    serverAvailable: insightsAvailable,
    fetchInsights,
    updateConsent,
    pauseInsights,
    sendFeedback,
    clearError
  } = useInsightsStore()

  const showInsights = shouldShowInsights()
  const selfConsent = consent ? !!consent.selfConsent : true
  const partnerConsent = consent ? !!consent.partnerConsent : true

  useEffect(() => {
    if (!hasPartner) return
    fetchLevel()
  }, [fetchLevel, hasPartner])

  useEffect(() => {
    if (!hasPartner || !serverAvailable || !showInsights || !insightsAvailable) return
    fetchInsights()
  }, [fetchInsights, hasPartner, insightsAvailable, serverAvailable, showInsights])

  const isXPEnabled = import.meta.env.VITE_XP_SYSTEM_ENABLED === 'true'

  if (!isXPEnabled || !showInsights) {
    return (
      <div className="p-4 min-h-screen bg-gradient-to-b from-neutral-50 to-neutral-100">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-neutral-600 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16"
        >
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center mb-4">
            <Sparkles className="w-10 h-10 text-indigo-400" />
          </div>
          <h2 className="text-xl font-bold text-neutral-800 mb-2">
            Insights Unlock at Level 10
          </h2>
          <p className="text-neutral-500 mb-4">
            You&apos;re currently Level {level}. Keep earning XP together!
          </p>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/profile')}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 text-white font-bold"
          >
            View Your Progress
          </motion.button>
        </motion.div>
      </div>
    )
  }

  const bothConsented = selfConsent && partnerConsent
  const paused = consent?.selfPaused || consent?.partnerPaused

  return (
    <div className="p-4 min-h-screen bg-gradient-to-b from-neutral-50 to-neutral-100">
      <div className="flex items-center gap-3 mb-6">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white shadow-sm"
        >
          <ArrowLeft className="w-5 h-5 text-neutral-600" />
        </motion.button>
        <div>
          <h1 className="text-xl font-bold text-neutral-800">AI Insights</h1>
          <p className="text-sm text-neutral-500">Gentle observations, not advice</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
          {error}
          <button
            type="button"
            onClick={clearError}
            className="ml-2 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {consent && !selfConsent && (
        <div className="rounded-2xl border border-indigo-100 bg-white p-4 mb-4">
          <div className="font-semibold text-neutral-700 mb-2">AI insights are off</div>
          <p className="text-sm text-neutral-500 mb-4">
            Turn insights back on anytime. This is not professional advice.
          </p>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => updateConsent(true)}
            className="px-4 py-2 rounded-xl bg-indigo-500 text-white text-sm font-bold"
          >
            Turn on insights
          </motion.button>
        </div>
      )}

      {consent && selfConsent && !partnerConsent && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 mb-4 text-sm text-amber-700">
          Waiting for your partner to opt in to insights.
        </div>
      )}

      {bothConsented && paused && (
        <div className="rounded-2xl border border-indigo-100 bg-white p-4 mb-4 flex items-center justify-between">
          <div>
            <div className="font-semibold text-neutral-700">Insights paused</div>
            <div className="text-xs text-neutral-500">Resume anytime to see new insights.</div>
          </div>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => updateConsent(true)}
            className="px-3 py-2 rounded-xl bg-indigo-50 text-indigo-600 text-xs font-bold"
          >
            Resume
          </motion.button>
        </div>
      )}

      {bothConsented && !paused && (
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => pauseInsights(7)}
          className="mb-4 px-4 py-2 rounded-xl border border-indigo-100 bg-white text-indigo-600 text-xs font-bold flex items-center gap-2"
        >
          <PauseCircle className="w-4 h-4" />
          Pause for 7 days
        </motion.button>
      )}

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="rounded-2xl bg-neutral-100 h-20 animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && bothConsented && !paused && insights.length === 0 && (
        <div className="text-center py-10 text-neutral-500">
          No insights yet. Keep using the app together and check back soon.
        </div>
      )}

      {!isLoading && insights.length > 0 && (
        <div className="space-y-4">
          {insights.map((insight) => (
            <div key={insight.id} className="rounded-2xl bg-white p-4 border border-neutral-100 shadow-sm">
              <div className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-2">
                {insight.category}
              </div>
              <div className="text-sm font-semibold text-neutral-800 mb-2">
                {insight.text}
              </div>
              {insight.evidenceSummary && (
                <div className="text-xs text-neutral-500 mb-3">{insight.evidenceSummary}</div>
              )}
              <div className="flex items-center gap-2">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => sendFeedback(insight.id, true)}
                  className="px-3 py-1 rounded-full bg-neutral-100 text-neutral-600 text-xs flex items-center gap-1"
                >
                  <ThumbsUp className="w-3 h-3" /> Helpful
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => sendFeedback(insight.id, false)}
                  className="px-3 py-1 rounded-full bg-neutral-100 text-neutral-600 text-xs flex items-center gap-1"
                >
                  <ThumbsDown className="w-3 h-3" /> Not quite
                </motion.button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default InsightsPage
