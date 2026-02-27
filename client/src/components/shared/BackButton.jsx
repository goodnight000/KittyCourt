import React from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { useI18n } from '../../i18n'

export default function BackButton({
  onClick,
  ariaLabel,
  className = '',
  iconClassName = 'w-5 h-5 text-neutral-600',
  Icon = ArrowLeft
}) {
  const { t } = useI18n()
  const resolvedLabel = ariaLabel || t('common.back')

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      aria-label={resolvedLabel}
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/80 bg-white/80 shadow-soft ${className}`}
    >
      <Icon className={iconClassName} />
    </motion.button>
  )
}
