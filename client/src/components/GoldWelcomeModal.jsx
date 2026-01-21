import React, { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Crown, Sparkles, Wand2, Gavel, Users, ArrowRight, Star } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import usePartnerStore from '../store/usePartnerStore'
import useSubscriptionStore from '../store/useSubscriptionStore'
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion'
import { useI18n } from '../i18n'
import StandardButton from './shared/StandardButton'

const FEATURES = [
  {
    icon: Gavel,
    titleKey: 'subscription.welcome.values.unlimited.title',
    subtitleKey: 'subscription.welcome.values.unlimited.subtitle'
  },
  {
    icon: Wand2,
    titleKey: 'subscription.welcome.values.planning.title',
    subtitleKey: 'subscription.welcome.values.planning.subtitle'
  },
  {
    icon: Sparkles,
    titleKey: 'subscription.welcome.values.insights.title',
    subtitleKey: 'subscription.welcome.values.insights.subtitle'
  }
]

const GoldWelcomeModal = ({ isOpen, onClose, meta }) => {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { hasPartner } = usePartnerStore()
  const { isGold } = useSubscriptionStore()
  const prefersReducedMotion = usePrefersReducedMotion()
  const closeButtonRef = useRef(null)
  const previousActiveElement = useRef(null)
  const planLabel = meta?.planType
    ? t(meta.planType === 'yearly' ? 'paywall.plans.yearly.label' : 'paywall.plans.monthly.label')
    : null

  useEffect(() => {
    if (!isOpen) return
    previousActiveElement.current = document.activeElement
    const timer = setTimeout(() => closeButtonRef.current?.focus(), 120)
    return () => {
      clearTimeout(timer)
      previousActiveElement.current?.focus?.()
    }
  }, [isOpen])

  const handleNavigate = (path) => {
    onClose?.()
    navigate(path)
  }

  if (!isOpen || !isGold) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gold-welcome-title"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/60 to-black/70 backdrop-blur-md"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: 'spring', damping: 20, stiffness: 220 }}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-[28px] border border-court-gold/30 bg-gradient-to-br from-court-ivory via-white/95 to-court-tan/50 shadow-[0_25px_80px_rgba(36,24,14,0.45)]"
          >
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-24 right-6 h-40 w-40 rounded-full bg-court-gold/15 blur-3xl" />
              <div className="absolute -bottom-20 left-6 h-32 w-32 rounded-full bg-court-maroon/15 blur-3xl" />
              {!prefersReducedMotion && (
                <motion.div
                  className="absolute -right-12 top-10 h-32 w-32 rounded-full border border-court-gold/30"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
                />
              )}
            </div>

            <div className="relative p-7">
              <button
                ref={closeButtonRef}
                onClick={onClose}
                className="absolute right-4 top-4 rounded-full border border-court-gold/20 bg-white/70 px-3 py-1 text-xs font-semibold text-court-brown hover:bg-white"
              >
                {t('subscription.welcome.actions.close')}
              </button>

              <div className="flex items-center gap-3">
                <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-court-gold to-court-goldDark shadow-soft-lg">
                  <Crown className="h-6 w-6 text-white" />
                  <Star className="absolute -right-1 -top-1 h-3 w-3 text-court-goldLight" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-court-goldDark">
                    {t('subscription.welcome.badge')}
                  </p>
                  <h2 id="gold-welcome-title" className="text-2xl font-display font-bold text-court-brown">
                    {t('subscription.welcome.title')}
                  </h2>
                </div>
              </div>

              <p className="mt-3 text-sm text-court-brownLight">
                {t('subscription.welcome.subtitle')}
              </p>

              <div className="mt-5 rounded-2xl border border-court-gold/20 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-court-brownLight">
                  {t('subscription.welcome.valueTitle')}
                </p>
                <div className="mt-3 space-y-3">
                  {FEATURES.map((item, index) => {
                    const Icon = item.icon
                    return (
                      <motion.div
                        key={item.titleKey}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: prefersReducedMotion ? 0 : 0.12 * index }}
                        className="flex items-start gap-3"
                      >
                        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-court-cream/80 text-court-goldDark">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-court-brown">
                            {t(item.titleKey)}
                          </p>
                          <p className="text-xs text-court-brownLight">
                            {t(item.subtitleKey)}
                          </p>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-emerald-200/70 bg-emerald-50/80 px-4 py-3 text-xs text-emerald-800">
                {hasPartner
                  ? t('subscription.welcome.partner.connected')
                  : t('subscription.welcome.partner.disconnected')}
              </div>

              {planLabel && (
                <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-court-goldDark">
                  <Users className="h-3 w-3" />
                  {t('subscription.welcome.plan', { plan: planLabel })}
                </div>
              )}

              <div className="mt-6 grid gap-3">
                <StandardButton
                  size="lg"
                  onClick={() => handleNavigate('/courtroom')}
                  className="w-full px-4 py-3 text-sm"
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    {t('subscription.welcome.actions.startCase')}
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </StandardButton>
                <div className="grid gap-3 sm:grid-cols-2">
                  {!hasPartner && (
                    <button
                      onClick={() => handleNavigate('/connect')}
                      className="w-full rounded-2xl border border-court-gold/30 bg-white/90 px-4 py-3 text-sm font-semibold text-court-brown"
                    >
                      {t('subscription.welcome.actions.invitePartner')}
                    </button>
                  )}
                  <button
                    onClick={() => handleNavigate('/insights')}
                    className="w-full rounded-2xl border border-court-gold/30 bg-white/90 px-4 py-3 text-sm font-semibold text-court-brown"
                  >
                    {t('subscription.welcome.actions.viewInsights')}
                  </button>
                </div>
              </div>

              <p className="mt-4 text-center text-[11px] text-court-brownLight">
                {t('subscription.welcome.footer')}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default GoldWelcomeModal
