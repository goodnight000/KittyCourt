/**
 * ChallengeCard - Reusable challenge display component.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Check, ChevronRight } from 'lucide-react';

const ChallengeCard = ({
    title,
    description,
    emoji = '🎯',
    currentProgress = 0,
    targetProgress = 3,
    daysLeft = 7,
    status = 'active', // 'active', 'completed', 'expired'
    difficulty = 'medium', // 'easy', 'medium', 'hard'
    rewardXP = 100,
    actionLabel,
    onAction,
    actionDisabled = false,
    onSkip,
    onClick,
    className = '',
}) => {
    const progress = Math.min((currentProgress / targetProgress) * 100, 100);
    const isComplete = currentProgress >= targetProgress;

    // Difficulty colors
    const difficultyColors = {
        easy: { bg: 'from-green-100 to-emerald-50', text: 'text-green-600', badge: 'bg-green-100' },
        medium: { bg: 'from-amber-100 to-yellow-50', text: 'text-amber-600', badge: 'bg-amber-100' },
        hard: { bg: 'from-purple-100 to-violet-50', text: 'text-purple-600', badge: 'bg-purple-100' },
    };

    const colors = difficultyColors[difficulty] || difficultyColors.medium;

    // Completed state
    if (status === 'completed') {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`rounded-2xl p-4 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 ${className}`}
            >
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-green-500 flex items-center justify-center text-white">
                        <Check className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <span className="text-lg">{emoji}</span>
                            <span className="font-bold text-neutral-800">{title}</span>
                        </div>
                        <p className="text-sm text-green-600 font-medium">
                            Completed! +{rewardXP} XP earned together 🎉
                        </p>
                    </div>
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            className={`rounded-2xl p-4 bg-gradient-to-br ${colors.bg} border border-neutral-200/50 cursor-pointer ${className}`}
        >
            {/* Header */}
            <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center text-2xl">
                    {emoji}
                </div>
                <div className="flex-1">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-neutral-800">{title}</h3>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${colors.badge} ${colors.text}`}>
                            {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
                        </span>
                    </div>
                    <p className="text-sm text-neutral-600 mt-0.5">{description}</p>
                </div>
            </div>

            {/* Progress bar */}
            <div className="mb-3">
                <div className="flex justify-between text-xs text-neutral-500 mb-1">
                    <span>{currentProgress} / {targetProgress}</span>
                    <span>+{rewardXP} XP</span>
                </div>
                <div className="h-2 bg-white/60 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                        className={`h-full rounded-full ${isComplete ? 'bg-green-500' : 'bg-gradient-to-r from-violet-500 to-pink-500'}`}
                    />
                </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-xs text-neutral-500">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{daysLeft} days left</span>
                </div>

                <div className="flex items-center gap-2">
                    {actionLabel && (
                        <motion.button
                            whileTap={{ scale: actionDisabled ? 1 : 0.95 }}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (actionDisabled || !onAction) return;
                                onAction();
                            }}
                            disabled={actionDisabled || !onAction}
                            className={`text-xs font-bold px-3 py-1 rounded-full ${
                                actionDisabled ? 'bg-neutral-200 text-neutral-400' : 'bg-white text-neutral-700'
                            }`}
                        >
                            {actionLabel}
                        </motion.button>
                    )}
                    {onSkip && (
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={(e) => {
                                e.stopPropagation();
                                onSkip();
                            }}
                            className="text-xs text-neutral-400 hover:text-neutral-600 px-2 py-1"
                        >
                            Not interested
                        </motion.button>
                    )}
                    <ChevronRight className="w-4 h-4 text-neutral-400" />
                </div>
            </div>
        </motion.div>
    );
};

export default ChallengeCard;
