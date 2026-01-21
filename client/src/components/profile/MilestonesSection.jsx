import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Award, X, Star, Lock } from 'lucide-react';
import { useI18n } from '../../i18n';
import {
  MILESTONES,
  calculateMilestoneProgress,
  getUnlockedCount,
  getEarnedXP,
} from '../../config/milestones';
import MilestoneBadge from './MilestoneBadge';
import EmojiIcon from '../shared/EmojiIcon';

/**
 * Milestone Detail Modal
 * Shows full details when a milestone is tapped
 */
const MilestoneDetailModal = ({ milestone, onClose }) => {
  const { t } = useI18n();

  // Keyboard accessibility - close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!milestone) return null;

  const {
    emoji = null,
    titleKey = '',
    descriptionKey = '',
    xpReward = 0,
    current = 0,
    target = 1,
    progress = 0,
    isUnlocked = false,
  } = milestone;

  const title = titleKey ? t(titleKey) : '';
  const description = descriptionKey ? t(descriptionKey) : '';
  // Ensure progressPercent is a valid number
  const safeProgress = Number.isFinite(progress) ? progress : 0;
  const progressPercent = Math.round(safeProgress * 100);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className={`
          relative w-full max-w-xs rounded-[28px] p-6
          ${isUnlocked
            ? 'bg-gradient-to-br from-amber-50 to-white border border-amber-200/80'
            : 'bg-white border border-neutral-200'
          }
          shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)]
        `}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-1.5 rounded-full bg-neutral-100/80 text-neutral-500 hover:bg-neutral-200/80 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Glow effect */}
        {isUnlocked && (
          <div className="absolute inset-0 rounded-[28px] pointer-events-none overflow-hidden">
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-amber-200/40 rounded-full blur-3xl" />
            <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-amber-300/30 rounded-full blur-2xl" />
          </div>
        )}

        {/* Content */}
        <div className="relative flex flex-col items-center text-center">
          {/* Large emoji */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.1 }}
            className={`
              w-20 h-20 rounded-full flex items-center justify-center mb-4
              ${isUnlocked
                ? 'bg-gradient-to-br from-amber-100 to-amber-200/80 shadow-[0_4px_20px_-4px_rgba(201,162,39,0.4)]'
                : 'bg-neutral-100'
              }
            `}
          >
            {isUnlocked && emoji ? (
              <EmojiIcon emoji={emoji} className="w-9 h-9 text-amber-600" />
            ) : (
              <Lock className="w-8 h-8 text-neutral-400" />
            )}
          </motion.div>

          {/* Title */}
          <h3 className="text-lg font-display font-bold text-neutral-800 mb-1">{title}</h3>

          {/* Description */}
          <p className="text-sm text-neutral-500 mb-4">{description}</p>

          {/* Progress bar */}
          <div className="w-full mb-4">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-neutral-500">
                {t('profilePage.milestones.progress', { current, target })}
              </span>
              <span className={isUnlocked ? 'font-bold text-amber-700' : 'text-neutral-500'}>
                {progressPercent}%
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-neutral-100 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
                className={`h-full rounded-full ${
                  isUnlocked
                    ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                    : 'bg-gradient-to-r from-neutral-300 to-neutral-400'
                }`}
              />
            </div>
          </div>

          {/* Reward badge */}
          <div
            className={`
              inline-flex items-center gap-1.5 px-4 py-2 rounded-full
              ${isUnlocked
                ? 'bg-gradient-to-r from-amber-100 to-amber-200/80 border border-amber-300/60'
                : 'bg-neutral-100 border border-neutral-200'
              }
            `}
          >
            <Star className={`w-4 h-4 ${isUnlocked ? 'text-amber-600 fill-amber-600' : 'text-neutral-500'}`} />
            <span
              className={`text-sm font-bold ${isUnlocked ? 'text-amber-700' : 'text-neutral-500'}`}
            >
              {t('profilePage.milestones.reward', { xp: xpReward })}
            </span>
          </div>

          {isUnlocked && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-3 text-xs font-semibold text-amber-600"
            >
              {t('profilePage.milestones.unlocked')}
            </motion.p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

/**
 * MilestonesSection Component
 *
 * Displays all 9 milestones in a 3x3 grid with:
 * - Header showing unlock count and total XP earned
 * - Staggered reveal animations
 * - Tap-to-expand detail modal
 */
const MilestonesSection = ({ stats }) => {
  const { t } = useI18n();
  const [selectedMilestone, setSelectedMilestone] = useState(null);

  // Calculate progress for all milestones
  const milestonesWithProgress = useMemo(
    () => calculateMilestoneProgress(stats),
    [stats]
  );

  const unlockedCount = getUnlockedCount(milestonesWithProgress);
  const totalCount = MILESTONES.length;
  const earnedXP = getEarnedXP(milestonesWithProgress);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card p-4 space-y-4 relative overflow-hidden"
      >
        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-10 -right-8 h-24 w-24 rounded-full bg-amber-200/25 blur-2xl" />
          <div className="absolute -bottom-12 -left-10 h-28 w-28 rounded-full bg-amber-100/30 blur-3xl" />
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: 'linear-gradient(145deg, rgba(255,255,255,0.7) 0%, transparent 50%)',
            }}
          />
        </div>

        {/* Header */}
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-200/80 border border-amber-200/60 flex items-center justify-center">
              <Award className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h3 className="font-display font-bold text-neutral-800">
                {t('profilePage.milestones.title')}
              </h3>
              <p className="text-xs text-neutral-500">
                {t('profilePage.milestones.unlockedCount', { count: unlockedCount, total: totalCount })}
              </p>
            </div>
          </div>

          {earnedXP > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-100/80 to-amber-200/60 border border-amber-200/60"
            >
              <Star className="w-3.5 h-3.5 text-amber-600 fill-amber-600" />
              <span className="text-xs font-bold text-amber-700">
                {t('profilePage.milestones.totalXP', { xp: earnedXP })}
              </span>
            </motion.div>
          )}
        </div>

        {/* 3x3 Grid */}
        <div className="relative grid grid-cols-3 gap-2.5">
          {milestonesWithProgress.map((milestone, index) => (
            <MilestoneBadge
              key={milestone.id}
              milestone={milestone}
              index={index}
              onTap={setSelectedMilestone}
            />
          ))}
        </div>
      </motion.div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedMilestone && (
          <MilestoneDetailModal
            milestone={selectedMilestone}
            onClose={() => setSelectedMilestone(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default MilestonesSection;
