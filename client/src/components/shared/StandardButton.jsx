import React from 'react'
import { motion } from 'framer-motion'
import clsx from 'clsx'

const sizeStyles = {
  sm: 'px-3 py-1 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-sm',
  xl: 'px-6 py-3 text-base'
}

const StandardButton = ({
  size = 'md',
  className,
  whileTap = { scale: 0.97 },
  children,
  ...props
}) => (
  <motion.button
    whileTap={whileTap}
    className={clsx(
      'inline-flex items-center justify-center gap-2 rounded-full border border-amber-200/70',
      'bg-amber-100/70 font-bold text-amber-700 shadow-soft transition',
      'hover:bg-amber-100/80 active:bg-amber-200/70',
      'disabled:opacity-60 disabled:cursor-not-allowed',
      sizeStyles[size],
      className
    )}
    {...props}
  >
    {children}
  </motion.button>
)

export default StandardButton
