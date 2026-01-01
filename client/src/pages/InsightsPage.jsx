/**
 * InsightsPage - AI relationship insights.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Sparkles, PauseCircle, ThumbsUp, ThumbsDown, AlertCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import useLevelStore from '../store/useLevelStore'
import useAuthStore from '../store/useAuthStore'
import useInsightsStore from '../store/useInsightsStore'
import useSubscriptionStore from '../store/useSubscriptionStore'
import Paywall from '../components/Paywall'

const InsightBackdrop = () => (
  <div className="absolute inset-0 pointer-events-none">
    <div className="absolute -top-24 -right-16 h-56 w-56 rounded-full bg-amber-200/35 blur-3xl" />
    <div className="absolute top-16 -left-20 h-60 w-60 rounded-full bg-rose-200/30 blur-3xl" />
    <div className="absolute bottom-6 right-8 h-64 w-64 rounded-full bg-amber-100/45 blur-3xl" />
    <div
      className="absolute inset-0 opacity-45"
      style={{
        backgroundImage:
          'radial-gradient(circle at 18% 20%, rgba(255,255,255,0.75) 0%, transparent 55%), radial-gradient(circle at 80% 10%, rgba(255,235,210,0.8) 0%, transparent 60%)'
      }}
    />
  </div>
)

const InsightsPage = () => {
  const navigate = useNavigate()
  const handleBack = () => navigate('/profile', { state: { tab: 'us' } })
  const { hasPartner } = useAuthStore()
  const { level, shouldShowInsights, fetchLevel, serverAvailable } = useLevelStore()
  const { isGold, isLoading: subscriptionLoading } = useSubscriptionStore()
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

  const levelUnlocked = shouldShowInsights()
  const showInsights = levelUnlocked && isGold
  const selfConsent = consent ? !!consent.selfConsent : true
  const partnerConsent = consent ? !!consent.partnerConsent : true
  const bothConsented = selfConsent && partnerConsent
  const paused = consent?.selfPaused || consent?.partnerPaused
  const insightsCount = insights.length
  const insightsLabel = insightsCount === 1 ? 'insight' : 'insights'
  const [showPaywall, setShowPaywall] = useState(false)

  const statusChip = useMemo(() => {
    if (!consent) {
      return { label: 'Syncing', className: 'border-white/80 bg-white/80 text-neutral-500' }
    }
    if (!bothConsented) {
      if (!selfConsent) {
        return { label: 'Off', className: 'border-white/80 bg-white/80 text-neutral-500' }
      }
      return { label: 'Waiting for partner', className: 'border-amber-200/70 bg-amber-100/70 text-amber-700' }
    }
    if (paused) {
      return { label: 'Paused', className: 'border-amber-200/70 bg-amber-100/70 text-amber-700' }
    }
    return { label: 'Active', className: 'border-emerald-200/70 bg-emerald-100/70 text-emerald-700' }
  }, [consent, bothConsented, paused, selfConsent])

  useEffect(() => {
    if (!hasPartner) return
    fetchLevel()
  }, [fetchLevel, hasPartner])

  useEffect(() => {
    if (!hasPartner || !serverAvailable || !showInsights || !insightsAvailable) return
    fetchInsights()
  }, [fetchInsights, hasPartner, insightsAvailable, serverAvailable, showInsights])

  const isXPEnabled = import.meta.env.VITE_XP_SYSTEM_ENABLED === 'true'

  if (!isXPEnabled || !levelUnlocked) {
    return (
      <div className="relative min-h-screen overflow-hidden px-4 pb-6 pt-6">
        <InsightBackdrop />
        <div className="relative">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleBack}
            className="flex items-center gap-2 text-sm font-semibold text-neutral-600"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </motion.button>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-10 glass-card text-center px-6 py-8"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-200/70 bg-amber-100/80">
              <Sparkles className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="mt-4 text-xl font-display font-bold text-neutral-800">
              Insights unlock at Level 10
            </h2>
            <p className="mt-2 text-sm text-neutral-500">
              You are currently Level {level}. Reach Level 10 and Pause Gold to unlock insights.
            </p>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleBack}
              className="mt-5 w-full rounded-2xl bg-gradient-to-r from-[#C9A227] to-[#8B7019] py-3 text-sm font-bold text-white shadow-soft"
            >
              View your progress
            </motion.button>
          </motion.div>
        </div>
      </div>
    )
  }

  if (!showInsights) {
    return (
      <div className="relative min-h-screen overflow-hidden px-4 pb-6 pt-6">
        <InsightBackdrop />
        <div className="relative">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleBack}
            className="flex items-center gap-2 text-sm font-semibold text-neutral-600"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </motion.button>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-10 glass-card text-center px-6 py-8"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-200/70 bg-amber-100/80">
              <Sparkles className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="mt-4 text-xl font-display font-bold text-neutral-800">
              AI Insights are a Gold feature
            </h2>
            <p className="mt-2 text-sm text-neutral-500">
              You are Level {level}. Upgrade to Pause Gold to unlock your insights.
            </p>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowPaywall(true)}
              disabled={subscriptionLoading}
              className="mt-5 w-full rounded-2xl bg-gradient-to-r from-[#C9A227] to-[#8B7019] py-3 text-sm font-bold text-white shadow-soft disabled:opacity-60"
            >
              {subscriptionLoading ? 'Checking membership...' : 'Unlock with Pause Gold'}
            </motion.button>
          </motion.div>
        </div>
        <Paywall isOpen={showPaywall} onClose={() => setShowPaywall(false)} />
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-4 pb-6 pt-6">
      <InsightBackdrop />
      <div className="relative space-y-6">
        <header className="flex items-start gap-3">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleBack}
            className="rounded-2xl border border-white/80 bg-white/80 p-2 shadow-soft"
          >
            <ArrowLeft className="w-5 h-5 text-neutral-600" />
          </motion.button>
          <div className="flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-600">
              Insight ledger
            </p>
            <h1 className="text-2xl font-display font-bold text-neutral-800">AI Insights</h1>
            <p className="text-sm text-neutral-500">Gentle observations, not advice</p>
          </div>
          <div className={`rounded-full border px-3 py-2 text-xs font-bold ${statusChip.className}`}>
            {statusChip.label}
          </div>
        </header>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card relative overflow-hidden"
        >
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-10 -right-8 h-20 w-20 rounded-full bg-amber-200/35 blur-2xl" />
            <div className="absolute -bottom-12 -left-10 h-24 w-24 rounded-full bg-rose-200/30 blur-3xl" />
          </div>
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-neutral-400">
                Observatory
              </p>
              <h2 className="mt-1 text-lg font-display font-bold text-neutral-800">
                Notes from your shared story
              </h2>
              <p className="mt-1 text-xs text-neutral-500">
                Insights appear as you resolve cases, answer daily prompts, and share moments.
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2 text-[11px] font-semibold">
              <div className="rounded-full border border-white/80 bg-white/85 px-3 py-1 text-neutral-600">
                {insightsCount} {insightsLabel}
              </div>
              <div className="rounded-full border border-white/80 bg-white/85 px-3 py-1 text-amber-700">
                Level {level}
              </div>
            </div>
          </div>
        </motion.section>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 rounded-2xl border border-rose-200/70 bg-rose-50/70 p-4"
          >
            <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-rose-700">{error}</p>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={clearError}
              className="rounded-xl border border-rose-200/70 bg-white/80 px-3 py-2 text-xs font-bold text-rose-600"
            >
              Dismiss
            </motion.button>
          </motion.div>
        )}

        {consent && !selfConsent && (
          <div className="glass-card space-y-3">
            <div>
              <div className="text-sm font-semibold text-neutral-700">Insights are off</div>
              <p className="mt-1 text-xs text-neutral-500">
                Turn insights on anytime. These notes are not professional advice.
              </p>
            </div>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => updateConsent(true)}
              className="w-full rounded-2xl bg-gradient-to-r from-[#C9A227] to-[#8B7019] py-2.5 text-sm font-bold text-white shadow-soft"
            >
              Turn on insights
            </motion.button>
          </div>
        )}

        {consent && selfConsent && !partnerConsent && (
          <div className="glass-card border border-amber-100/70 bg-amber-50/60 text-sm text-amber-700">
            Waiting for your partner to opt in to insights.
          </div>
        )}

        {bothConsented && paused && (
          <div className="glass-card flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-neutral-700">Insights paused</div>
              <div className="text-xs text-neutral-500">Resume anytime to see new insights.</div>
            </div>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => updateConsent(true)}
              className="rounded-2xl border border-amber-200/70 bg-amber-100/70 px-3 py-2 text-xs font-bold text-amber-700"
            >
              Resume
            </motion.button>
          </div>
        )}

        {bothConsented && !paused && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => pauseInsights(7)}
            className="flex w-fit items-center gap-2 rounded-2xl border border-amber-200/70 bg-white/80 px-4 py-2 text-xs font-bold text-amber-700 shadow-inner-soft"
          >
            <PauseCircle className="w-4 h-4" />
            Pause for 7 days
          </motion.button>
        )}

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-24 rounded-[28px] border border-white/80 bg-white/70 animate-pulse"
              />
            ))}
          </div>
        )}

        {!isLoading && bothConsented && !paused && insights.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card text-center px-6 py-10"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-200/70 bg-amber-100/80">
              <Sparkles className="w-8 h-8 text-amber-600" />
            </div>
            <h3 className="mt-4 text-lg font-display font-bold text-neutral-800">
              No insights yet
            </h3>
            <p className="mt-2 text-sm text-neutral-500">
              Keep using the app together and check back soon.
            </p>
          </motion.div>
        )}

        {!isLoading && insights.length > 0 && (
          <div className="space-y-4">
            {insights.map((insight, index) => (
              <motion.article
                key={insight.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.05, 0.3) }}
                className="relative overflow-hidden rounded-[28px] border border-white/80 bg-white/85 p-4 shadow-soft"
              >
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute -top-10 -right-8 h-20 w-20 rounded-full bg-amber-200/30 blur-2xl" />
                  <div className="absolute -bottom-12 -left-10 h-24 w-24 rounded-full bg-rose-200/25 blur-3xl" />
                </div>
                <div className="relative space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full border border-amber-200/70 bg-amber-100/70 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700">
                      {insight.category || 'Insight'}
                    </span>
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-neutral-500">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      Insight
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-neutral-800">{insight.text}</div>
                  {insight.evidenceSummary && (
                    <div className="rounded-2xl border border-white/80 bg-white/70 p-3 text-xs text-neutral-500">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-400">
                        Context
                      </div>
                      <p className="mt-1">{insight.evidenceSummary}</p>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => sendFeedback(insight.id, true)}
                      className="rounded-full border border-emerald-200/70 bg-emerald-100/70 px-3 py-1 text-xs font-bold text-emerald-700 flex items-center gap-1"
                    >
                      <ThumbsUp className="w-3 h-3" /> Helpful
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => sendFeedback(insight.id, false)}
                      className="rounded-full border border-white/80 bg-white/80 px-3 py-1 text-xs font-bold text-neutral-500 flex items-center gap-1"
                    >
                      <ThumbsDown className="w-3 h-3" /> Not quite
                    </motion.button>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </div>
      <Paywall isOpen={showPaywall} onClose={() => setShowPaywall(false)} />
    </div>
  )
}

export default InsightsPage
