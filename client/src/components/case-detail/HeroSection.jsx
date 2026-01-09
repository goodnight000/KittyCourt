import React from 'react';
import { motion } from 'framer-motion';
import { Calendar } from 'lucide-react';

/**
 * Hero section with theatrical seal stamp animation
 * @param {Object} props
 * @param {string} props.caseTitle - The case title
 * @param {string} props.formattedDate - Formatted date string
 * @param {string} props.status - Case status ('resolved', 'pending', etc.)
 * @param {Function} props.t - Translation function
 */
const HeroSection = ({ caseTitle, formattedDate, status = 'resolved', t }) => {
  const statusConfig = {
    resolved: {
      label: t?.('cases.detail.status.resolved') || 'Resolved',
      gradient: 'from-emerald-500 to-green-500',
      shadow: 'shadow-green-500/25',
    },
    pending: {
      label: t?.('cases.detail.status.pending') || 'Pending',
      gradient: 'from-amber-500 to-orange-500',
      shadow: 'shadow-amber-500/25',
    },
  };

  const currentStatus = statusConfig[status] || statusConfig.resolved;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
      className="relative"
    >
      {/* Background ribbon banner - asymmetric */}
      <div className="absolute -left-4 -right-4 top-1/2 -translate-y-1/2 h-24 bg-gradient-to-r from-transparent via-amber-100/60 to-transparent" />

      {/* Seal container */}
      <div className="relative flex flex-col items-center py-8">
        {/* Animated seal stamp */}
        <motion.div
          initial={{ scale: 1.5, opacity: 0, rotate: -15 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ delay: 0.3, duration: 0.4, ease: 'backOut' }}
          className="relative mb-4"
        >
          {/* Glow behind seal */}
          <div className="absolute inset-0 rounded-full bg-court-gold/40 blur-xl scale-150" />

          {/* The seal itself */}
          <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-court-gold via-amber-400 to-court-goldDark p-1 shadow-lg shadow-amber-900/20">
            <div className="w-full h-full rounded-full bg-gradient-to-br from-amber-50 to-court-cream flex items-center justify-center">
              <img
                src="/assets/avatars/judge_whiskers.png"
                alt="Judge Whiskers"
                className="w-14 h-14 rounded-full object-cover"
              />
            </div>
          </div>

          {/* Decorative spinning ring */}
          <div className="absolute inset-[-4px] rounded-full border-2 border-dashed border-court-gold/30 animate-spin-slow" />
        </motion.div>

        {/* Case status badge - overlapping the seal */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className={`px-4 py-1.5 rounded-full bg-gradient-to-r ${currentStatus.gradient} text-white text-[10px] font-bold uppercase tracking-[0.3em] shadow-lg ${currentStatus.shadow} -mt-3 z-10`}
        >
          {currentStatus.label}
        </motion.div>

        {/* Case title - dramatic typography */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="text-2xl font-display font-bold text-neutral-800 text-center mt-4 px-8 leading-tight"
        >
          {caseTitle}
        </motion.h1>

        {/* Decorative divider with date */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="flex items-center gap-3 mt-3"
        >
          <div className="h-px w-12 bg-gradient-to-r from-transparent to-court-gold/50" />
          <Calendar className="w-3 h-3 text-court-gold" />
          <span className="text-xs text-neutral-500">{formattedDate}</span>
          <div className="h-px w-12 bg-gradient-to-l from-transparent to-court-gold/50" />
        </motion.div>
      </div>
    </motion.div>
  );
};

export default HeroSection;
