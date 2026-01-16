/**
 * ChallengeCard - Reusable challenge display component.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Check, ChevronRight } from 'lucide-react';
import { useI18n } from '../i18n';

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
    cadence = 'weekly',
    actionLabel,
    onAction,
    actionDisabled = false,
    onSkip,
    onClick,
    className = '',
}) => {
    const { t } = useI18n();
    const progress = Math.min((currentProgress / targetProgress) * 100, 100);
    const isComplete = currentProgress >= targetProgress;
    const isExpired = status === 'expired';
    const isClickable = !!onClick;

    const difficultyStyles = {
        easy: {
            badge: 'border-emerald-200/70 bg-emerald-100/70 text-emerald-700',
            accent: 'bg-emerald-200/35',
        },
        medium: {
            badge: 'border-amber-200/70 bg-amber-100/80 text-amber-700',
            accent: 'bg-amber-200/40',
        },
        hard: {
            badge: 'border-rose-200/70 bg-rose-100/80 text-rose-700',
            accent: 'bg-rose-200/40',
        },
    };

    const colors = difficultyStyles[difficulty] || difficultyStyles.medium;
    const statusLabel = status === 'expired' ? t('challenges.card.status.expired') : null;
    const cadenceLabel = cadence === 'daily' ? t('challenges.card.cadence.daily') : t('challenges.card.cadence.weekly');
    const difficultyLabelMap = {
        easy: t('challenges.card.difficulty.easy'),
        medium: t('challenges.card.difficulty.medium'),
        hard: t('challenges.card.difficulty.hard'),
    };
    const difficultyLabel = difficultyLabelMap[difficulty] || t('challenges.card.difficulty.medium');
    const cadenceStyles = cadence === 'daily'
        ? 'border-sky-200/70 bg-sky-100/80 text-sky-700'
        : 'border-amber-200/70 bg-amber-100/80 text-amber-700';

    if (status === 'completed') {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`relative overflow-hidden rounded-[28px] border border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-white to-emerald-100/70 p-4 shadow-soft ${className}`}
            >
                <div className="absolute -top-12 -right-8 h-24 w-24 rounded-full bg-emerald-200/40 blur-3xl" />
                <div className="relative flex items-start gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-soft">
                        <Check className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-500">
                            {t('challenges.card.status.completed')}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                            <span className="text-lg">{emoji}</span>
                            <span className="font-display font-bold text-neutral-800">{title}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em]">
                            <span className={`rounded-full border px-2.5 py-1 ${cadenceStyles}`}>
                                {cadenceLabel}
                            </span>
                        </div>
                        <p className="mt-1 text-xs text-emerald-600 font-semibold">
                            {t('challenges.card.completedReward', { xp: rewardXP })}
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
            className={`relative overflow-hidden rounded-[28px] border border-white/80 bg-white/85 p-4 shadow-soft transition ${
                isClickable ? 'cursor-pointer' : ''
            } ${isExpired ? 'opacity-80' : ''} ${className}`}
        >
            <div className="absolute inset-0 pointer-events-none">
                <div className={`absolute -top-10 -right-6 h-20 w-20 rounded-full blur-2xl ${colors.accent}`} />
                <div className="absolute -bottom-12 -left-10 h-24 w-24 rounded-full bg-amber-100/45 blur-3xl" />
            </div>

            <div className="relative space-y-4">
                <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/80 bg-white/90 text-2xl shadow-inner-soft">
                        {emoji}
                    </div>
                    <div className="flex-1">
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                {statusLabel && (
                                    <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-500">
                                        {statusLabel}
                                    </div>
                                )}
                                <h3 className="text-base font-display font-bold text-neutral-800">{title}</h3>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em]">
                                <span className={`rounded-full border px-2.5 py-1 ${cadenceStyles}`}>
                                    {cadenceLabel}
                                </span>
                                <span className={`rounded-full border px-2.5 py-1 font-bold ${colors.badge}`}>
                                    {difficultyLabel}
                                </span>
                            </div>
                        </div>
                        <p className="mt-1 text-sm text-neutral-600">{description}</p>
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-neutral-500">
                        <span>{t('challenges.card.progress', { current: currentProgress, total: targetProgress })}</span>
                        <span className="font-semibold text-amber-700">{t('challenges.card.reward', { xp: rewardXP })}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-white/80 shadow-inner-soft overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.6, ease: 'easeOut' }}
                            className={`h-full rounded-full ${isComplete ? 'bg-emerald-500' : 'bg-gradient-to-r from-[#C9A227] to-[#8B7019]'}`}
                        />
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                        <div className="flex items-center gap-1 rounded-full border border-white/80 bg-white/80 px-2.5 py-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{t('challenges.card.daysLeft', { count: daysLeft })}</span>
                        </div>
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
                                className={`rounded-full px-3 py-1 text-xs font-bold ${
                                    actionDisabled
                                        ? 'bg-neutral-200/70 text-neutral-500'
                                        : 'bg-gradient-to-r from-[#C9A227] to-[#8B7019] text-white shadow-soft'
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
                                className="px-2 py-1 text-[11px] font-semibold text-neutral-500 hover:text-neutral-600"
                            >
                                {t('challenges.actions.skip')}
                            </motion.button>
                        )}
                        {isClickable && <ChevronRight className="w-4 h-4 text-neutral-500" />}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default ChallengeCard;
