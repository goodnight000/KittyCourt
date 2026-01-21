import React from 'react'
import clsx from 'clsx'
import InlineLoader, { BreathingDots } from '../InlineLoader'

const toneClasses = {
  amber: 'text-amber-700',
  rose: 'text-rose-600',
  emerald: 'text-emerald-600',
  court: 'text-court-brown',
  neutral: 'text-neutral-600',
  lavender: 'text-lavender-600',
  indigo: 'text-indigo-600',
  white: 'text-white'
}

const ButtonLoader = ({
  label,
  size = 'sm',
  tone = 'amber',
  variant = 'dots',
  className = '',
  labelClassName = ''
}) => {
  const Loader = variant === 'dots' ? BreathingDots : InlineLoader
  const toneClass = toneClasses[tone] || toneClasses.amber

  return (
    <span className={clsx('inline-flex items-center gap-2', toneClass, className)}>
      <Loader size={size} className="text-current" />
      {label ? (
        <span className={clsx('text-xs font-semibold', labelClassName)}>{label}</span>
      ) : null}
    </span>
  )
}

export default ButtonLoader
