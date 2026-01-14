import React from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { HeartCrack, ArrowRight, Clock } from 'lucide-react'
import useAuthStore from '../store/useAuthStore'
import { useI18n } from '../i18n'
import ProfilePicture from './ProfilePicture'

const DisconnectNotice = ({ disconnectStatus, className = '' }) => {
  const navigate = useNavigate()
  const { t } = useI18n()
  const { user } = useAuthStore()

  if (!disconnectStatus || disconnectStatus.status !== 'disconnected') return null

  const initiatedByMe = !!user?.id && disconnectStatus.disconnected_by === user.id
  const otherName = disconnectStatus.other_name || t('common.yourPartner')
  const daysLeft = Number.isFinite(disconnectStatus.days_left) ? disconnectStatus.days_left : 0

  const title = initiatedByMe
    ? t('disconnectNotice.titles.youDisconnected')
    : t('disconnectNotice.titles.theyDisconnected', { name: otherName })

  const message = initiatedByMe
    ? t('disconnectNotice.messages.youDisconnected', { days: daysLeft })
    : t('disconnectNotice.messages.theyDisconnected', { days: daysLeft })

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass-card relative overflow-hidden p-5 border border-slate-200/70 ${className}`}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-10 -right-10 h-28 w-28 rounded-full bg-slate-200/35 blur-3xl" />
        <div className="absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-blue-200/25 blur-3xl" />
      </div>

      <div className="relative flex items-start gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100/80 border border-slate-200/80">
          <HeartCrack className="w-6 h-6 text-slate-500" />
        </div>

        <div className="flex-1 space-y-2">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">
              {t('disconnectNotice.kicker')}
            </p>
            <h3 className="font-display font-bold text-neutral-800">{title}</h3>
            <p className="text-sm text-neutral-600 leading-relaxed">{message}</p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Clock className="w-3.5 h-3.5" />
            <span>{t('disconnectNotice.daysLeft', { days: daysLeft })}</span>
          </div>

          <div className="flex items-center gap-2 pt-1">
            {disconnectStatus.other_avatar_url && (
              <ProfilePicture
                avatarUrl={disconnectStatus.other_avatar_url}
                name={otherName}
                size="sm"
                className="rounded-full"
              />
            )}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/connect')}
              className="ml-auto inline-flex items-center gap-2 rounded-2xl bg-neutral-900/90 px-4 py-2 text-xs font-bold text-white shadow-soft"
            >
              {t('disconnectNotice.cta')}
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default DisconnectNotice

