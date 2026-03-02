/**
 * InsightsPage - AI relationship insights.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { motion as Motion } from 'framer-motion'
import { ArrowLeft, Sparkles, AlertCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import useLevelStore from '../store/useLevelStore'
import usePartnerStore from '../store/usePartnerStore'
import useInsightsStore from '../store/useInsightsStore'
import useSubscriptionStore from '../store/useSubscriptionStore'
import Paywall from '../components/Paywall'
import { useI18n } from '../i18n'
import BackButton from '../components/shared/BackButton'
import StandardButton from '../components/shared/StandardButton'
import useUiPerfProfile from '../hooks/useUiPerfProfile'
import useStagedMount from '../hooks/useStagedMount'
import { isNativeIOS } from '../utils/platform'

const InsightBackdrop = ({ reduceFx }) => (
  <div className="fixed inset-0 pointer-events-none">
    <div className={`absolute -top-20 -right-20 h-64 w-64 rounded-full bg-amber-200/30 ${reduceFx ? 'blur-xl' : 'blur-3xl'}`} />
    <div className={`absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-rose-200/25 ${reduceFx ? 'blur-xl' : 'blur-3xl'}`} />
  </div>
)

const InsightsPage = () => {
  const navigate = useNavigate()
  const { t, language } = useI18n()
  const { prefersReducedMotion } = useUiPerfProfile()
  const shouldReduceFx = prefersReducedMotion
  const handleBack = () => navigate('/profile', { state: { tab: 'us' } })
  const hasPartner = usePartnerStore((state) => state.hasPartner)
  const level = useLevelStore((state) => state.level)
  const shouldShowInsights = useLevelStore((state) => state.shouldShowInsights)
  const fetchLevel = useLevelStore((state) => state.fetchLevel)
  const serverAvailable = useLevelStore((state) => state.serverAvailable)
  const isGold = useSubscriptionStore((state) => state.isGold)
  const subscriptionLoading = useSubscriptionStore((state) => state.isLoading)
  const insights = useInsightsStore((state) => state.insights)
  const insightsMeta = useInsightsStore((state) => state.meta)
  const isLoading = useInsightsStore((state) => state.isLoading)
  const error = useInsightsStore((state) => state.error)
  const insightsAvailable = useInsightsStore((state) => state.serverAvailable)
  const fetchInsights = useInsightsStore((state) => state.fetchInsights)
  const clearError = useInsightsStore((state) => state.clearError)

  const levelUnlocked = shouldShowInsights()
  const showInsights = levelUnlocked && isGold
  const insightsCount = insights.length
  const insightsCountLabel = insightsCount === 1
    ? t('insights.countOne', { count: insightsCount })
    : t('insights.countOther', { count: insightsCount })
  const showThresholdHint = insightsMeta?.reason === 'insufficient_activity'
    || insightsMeta?.reason === 'insufficient_memory'
  const shouldAnimateInsightCards = !shouldReduceFx && insights.length <= 12
  const showInsightsFeed = useStagedMount({
    enabled: isNativeIOS() && !prefersReducedMotion && showInsights,
    delay: 230
  })
  const [showPaywall, setShowPaywall] = useState(false)
  const errorMap = {
    'Failed to load insights': 'insights.errors.loadFailed',
    'Failed to send feedback': 'insights.errors.feedbackFailed'
  }
  const translatedError = errorMap[error] ? t(errorMap[error]) : error

  const statusChip = useMemo(() => {
    if (isLoading) {
      return { label: t('insights.status.syncing'), className: 'border-white/80 bg-white/80 text-neutral-500' }
    }
    return { label: t('insights.status.active'), className: 'border-emerald-200/70 bg-emerald-100/70 text-emerald-700' }
  }, [isLoading, t])

  useEffect(() => {
    if (!hasPartner) return
    fetchLevel()
  }, [fetchLevel, hasPartner])

  useEffect(() => {
    if (!hasPartner || !serverAvailable || !showInsights || !insightsAvailable) return
    fetchInsights()
  }, [fetchInsights, hasPartner, insightsAvailable, serverAvailable, showInsights, language])

  const isXPEnabled = import.meta.env.VITE_XP_SYSTEM_ENABLED === 'true'

  if (!isXPEnabled || !levelUnlocked) {
    return (
      <div className="relative min-h-screen overflow-hidden pb-6">
        {/* Background gradient */}
            <div className="fixed inset-0 pointer-events-none">
                <div className={`absolute -top-20 -right-20 h-64 w-64 rounded-full bg-amber-200/30 ${shouldReduceFx ? 'blur-xl' : 'blur-3xl'}`} />
                <div className={`absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-rose-200/25 ${shouldReduceFx ? 'blur-xl' : 'blur-3xl'}`} />
            </div>
        <div className="relative">
          <Motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleBack}
            className="flex items-center gap-2 text-sm font-semibold text-neutral-600"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>{t('common.back')}</span>
          </Motion.button>

          <Motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-10 glass-card text-center px-6 py-8"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-200/70 bg-amber-100/80">
              <Sparkles className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="mt-4 text-xl font-display font-bold text-neutral-800">
              {t('insights.locked.title')}
            </h2>
            <p className="mt-2 text-sm text-neutral-500">
              {t('insights.locked.subtitle', { level })}
            </p>
            <StandardButton
              size="lg"
              onClick={handleBack}
              className="mt-5 w-full py-3 text-sm"
            >
              {t('insights.locked.cta')}
            </StandardButton>
          </Motion.div>
        </div>
      </div>
    )
  }

  if (!showInsights) {
    return (
      <div className="relative min-h-screen overflow-hidden pb-6">
        <InsightBackdrop reduceFx={shouldReduceFx} />
        <div className="relative">
          <Motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleBack}
            className="flex items-center gap-2 text-sm font-semibold text-neutral-600"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>{t('common.back')}</span>
          </Motion.button>

          <Motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-10 glass-card text-center px-6 py-8"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-200/70 bg-amber-100/80">
              <Sparkles className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="mt-4 text-xl font-display font-bold text-neutral-800">
              {t('insights.gold.title')}
            </h2>
            <p className="mt-2 text-sm text-neutral-500">
              {t('insights.gold.subtitle', { level })}
            </p>
            <StandardButton
              size="lg"
              onClick={() => setShowPaywall(true)}
              disabled={subscriptionLoading}
              className="mt-5 w-full py-3 text-sm"
            >
              {subscriptionLoading ? t('insights.gold.checking') : t('insights.gold.cta')}
            </StandardButton>
          </Motion.div>
        </div>
        <Paywall isOpen={showPaywall} onClose={() => setShowPaywall(false)} />
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden pb-6">
      <InsightBackdrop reduceFx={shouldReduceFx} />
      <div className="relative space-y-6">
        <header className="flex items-start gap-3">
          <BackButton onClick={handleBack} ariaLabel={t('common.back')} />
          <div className="flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-600">
              {t('insights.header.kicker')}
            </p>
            <h1 className="text-2xl font-display font-bold text-neutral-800">{t('insights.header.title')}</h1>
            <p className="text-sm text-neutral-500">{t('insights.header.subtitle')}</p>
          </div>
          <div className={`rounded-full border px-3 py-2 text-xs font-bold ${statusChip.className}`}>
            {statusChip.label}
          </div>
        </header>

        <Motion.section
          initial={shouldReduceFx ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card relative overflow-hidden"
        >
          <div className="absolute inset-0 pointer-events-none">
            <div className={`absolute -top-10 -right-8 h-20 w-20 rounded-full bg-amber-200/35 ${shouldReduceFx ? 'blur-lg' : 'blur-2xl'}`} />
            <div className={`absolute -bottom-12 -left-10 h-24 w-24 rounded-full bg-rose-200/30 ${shouldReduceFx ? 'blur-xl' : 'blur-3xl'}`} />
          </div>
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-neutral-500">
                {t('insights.observatory.kicker')}
              </p>
              <h2 className="mt-1 text-lg font-display font-bold text-neutral-800">
                {t('insights.observatory.title')}
              </h2>
              <p className="mt-1 text-xs text-neutral-500">
                {t('insights.observatory.subtitle')}
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2 text-[11px] font-semibold">
              <div className="rounded-full border border-white/80 bg-white/85 px-3 py-1 text-neutral-600">
                {insightsCountLabel}
              </div>
            </div>
          </div>
        </Motion.section>

        {translatedError && (
          <Motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 rounded-2xl border border-rose-200/70 bg-rose-50/70 p-4"
          >
            <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-rose-700">{translatedError}</p>
            </div>
            <Motion.button
              whileTap={{ scale: 0.95 }}
              onClick={clearError}
              className="rounded-xl border border-rose-200/70 bg-white/80 px-3 py-2 text-xs font-bold text-rose-600"
            >
              {t('insights.actions.dismiss')}
            </Motion.button>
          </Motion.div>
        )}

        {showInsightsFeed ? (
          <>
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

            {!isLoading && insights.length === 0 && (
              <Motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card text-center px-6 py-10"
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-200/70 bg-amber-100/80">
                  <Sparkles className="w-8 h-8 text-amber-600" />
                </div>
                <h3 className="mt-4 text-lg font-display font-bold text-neutral-800">
                  {t('insights.empty.title')}
                </h3>
                <p className="mt-2 text-sm text-neutral-500">
                  {t('insights.empty.subtitle')}
                </p>
                {showThresholdHint && (
                  <p className="mt-2 text-xs text-neutral-500">
                    {t('insights.empty.thresholdHint')}
                  </p>
                )}
              </Motion.div>
            )}

            {!isLoading && insights.length > 0 && (
              <div className="space-y-4">
                {insights.map((insight, index) => (
                  <Motion.article
                    key={insight.id}
                    initial={shouldAnimateInsightCards ? { opacity: 0, y: 12 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    transition={shouldAnimateInsightCards ? { delay: Math.min(index * 0.04, 0.24) } : { duration: 0.12 }}
                    className="relative overflow-hidden rounded-[28px] border border-white/80 bg-white/85 p-4 shadow-soft perf-content-auto-compact contain-paint"
                  >
                    <div className="absolute inset-0 pointer-events-none">
                      <div className={`absolute -top-10 -right-8 h-20 w-20 rounded-full bg-amber-200/30 ${shouldReduceFx ? 'blur-lg' : 'blur-2xl'}`} />
                      <div className={`absolute -bottom-12 -left-10 h-24 w-24 rounded-full bg-rose-200/25 ${shouldReduceFx ? 'blur-xl' : 'blur-3xl'}`} />
                    </div>
                    <div className="relative space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="rounded-full border border-amber-200/70 bg-amber-100/70 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700">
                          {insight.category || t('insights.card.categoryFallback')}
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-neutral-800">{insight.text}</div>
                      {insight.evidenceSummary && (
                        <div className="rounded-2xl border border-white/80 bg-white/70 p-3 text-xs text-neutral-500">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-500">
                            {t('insights.card.contextLabel')}
                          </div>
                          <p className="mt-1">{insight.evidenceSummary}</p>
                        </div>
                      )}
                    </div>
                  </Motion.article>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-24 rounded-[28px] border border-white/80 bg-white/75 animate-pulse" />
            ))}
          </div>
        )}
      </div>
      <Paywall isOpen={showPaywall} onClose={() => setShowPaywall(false)} />
    </div>
  )
}

export default InsightsPage
