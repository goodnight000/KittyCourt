import React from 'react';
import { motion } from 'framer-motion';
import { useI18n } from '../../i18n';

/**
 * Progress Ring SVG component
 * Displays a circular progress indicator around the emoji
 */
const ProgressRing = ({ progress, isUnlocked, size = 56 }) => {
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <svg
      width={size}
      height={size}
      className="absolute inset-0"
      style={{ transform: 'rotate(-90deg)' }}
    >
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={isUnlocked ? 'rgba(251, 191, 36, 0.2)' : 'rgba(163, 163, 163, 0.2)'}
        strokeWidth={strokeWidth}
      />
      {/* Progress circle */}
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={isUnlocked ? '#C9A227' : '#a3a3a3'}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset }}
        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
      />
    </svg>
  );
};

/**
 * MilestoneBadge Component
 *
 * A visually distinctive achievement badge with:
 * - Progress ring around the emoji
 * - Clear progress/unlocked state
 * - XP reward display
 * - Subtle animations
 */
const MilestoneBadge = ({ milestone, index = 0, onTap }) => {
  const { t } = useI18n();

  // Guard against null/undefined milestone
  if (!milestone) return null;

  const {
    emoji = '🔒',
    titleKey = '',
    descriptionKey = '',
    xpReward = 0,
    current = 0,
    target = 1,
    progress = 0,
    isUnlocked = false,
  } = milestone;

  // Ensure progress is a valid number between 0 and 1
  const safeProgress = Number.isFinite(progress) ? Math.max(0, Math.min(progress, 1)) : 0;

  const title = titleKey ? t(titleKey) : '';
  const description = descriptionKey ? t(descriptionKey) : '';

  return (
    <motion.button
      type="button"
      onClick={() => onTap?.(milestone)}
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.4,
        delay: index * 0.05,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      whileTap={{ scale: 0.96 }}
      className={`
        relative flex flex-col items-center justify-center
        rounded-[20px] p-3 min-h-[120px]
        transition-all duration-300
        ${isUnlocked
          ? 'bg-gradient-to-br from-amber-50/90 to-amber-100/70 border border-amber-200/80 shadow-[0_4px_20px_-4px_rgba(201,162,39,0.25)]'
          : 'bg-white/60 border border-neutral-200/70 shadow-soft'
        }
      `}
    >
      {/* Glow effect for unlocked */}
      {isUnlocked && (
        <div className="absolute inset-0 rounded-[20px] pointer-events-none overflow-hidden">
          <div className="absolute -top-4 -right-4 w-16 h-16 bg-amber-300/30 rounded-full blur-2xl" />
          <div className="absolute -bottom-4 -left-4 w-12 h-12 bg-amber-200/25 rounded-full blur-xl" />
        </div>
      )}

      {/* Emoji with progress ring */}
      <div className="relative w-14 h-14 flex items-center justify-center mb-2">
        <ProgressRing progress={safeProgress} isUnlocked={isUnlocked} />
        <motion.span
          className="text-2xl relative z-10"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{
            type: 'spring',
            stiffness: 400,
            damping: 15,
            delay: index * 0.05 + 0.2,
          }}
        >
          {isUnlocked ? emoji : '🔒'}
        </motion.span>
      </div>

      {/* Title */}
      <span
        className={`text-[11px] font-bold text-center leading-tight mb-1 ${
          isUnlocked ? 'text-neutral-800' : 'text-neutral-500'
        }`}
      >
        {title}
      </span>

      {/* Progress or XP badge */}
      <div className="mt-auto">
        {isUnlocked ? (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 + 0.4 }}
            className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full border border-amber-200/60"
          >
            +{xpReward} XP
          </motion.span>
        ) : (
          <span className="text-[10px] font-semibold text-neutral-500">
            {current}/{target}
          </span>
        )}
      </div>

      {/* Tooltip on hover for description - shown via title attribute */}
      <span className="sr-only">{description}</span>
    </motion.button>
  );
};

export default MilestoneBadge;
