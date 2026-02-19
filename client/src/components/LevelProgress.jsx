/**
 * LevelProgress - Reusable level progress display component
 * 
 * Two modes:
 * - compact: For dashboard banner
 * - full: For Our Story section
 */
import React from 'react';
import { motion } from 'framer-motion';
import { Award, Cat, Crown, Flame, Heart, Star, Trophy } from 'lucide-react';
import { useI18n } from '../i18n';

const LevelProgress = ({
    level = 1,
    currentXP = 0,
    xpForNextLevel = 100,
    title = 'Curious Kittens',
    compact = false,
    className = '',
}) => {
    const { t, language } = useI18n();
    // Calculate progress percentage
    const progress = xpForNextLevel > 0
        ? Math.min((currentXP / xpForNextLevel) * 100, 100)
        : 100;
    const remainingXP = Math.max(xpForNextLevel - currentXP, 0);
    const formattedCurrentXP = currentXP.toLocaleString(language);
    const formattedNextXP = xpForNextLevel.toLocaleString(language);
    const formattedRemaining = remainingXP.toLocaleString(language);

    // Get level icon based on level tier
    const getLevelIcon = (lvl) => {
        if (lvl >= 50) return Crown;
        if (lvl >= 30) return Flame;
        if (lvl >= 20) return Award;
        if (lvl >= 15) return Star;
        if (lvl >= 10) return Star;
        if (lvl >= 7) return Trophy;
        if (lvl >= 5) return Heart;
        return Cat;
    };

    // Compact mode (Dashboard banner)
    if (compact) {
        return (
            <motion.div
                className={`glass-card level-progress-compact relative overflow-hidden ${className}`}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
            >
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute -top-10 -right-6 h-24 w-24 rounded-full bg-amber-200/50 blur-xl" />
                    <div className="absolute -bottom-12 -left-6 h-24 w-24 rounded-full bg-rose-200/40 blur-xl" />
                    <div className="absolute inset-0 opacity-30" style={{
                        backgroundImage: 'linear-gradient(120deg, rgba(255,255,255,0.6) 0%, transparent 40%), linear-gradient(0deg, rgba(255,255,255,0.3), transparent 60%)'
                    }} />
                </div>
                <div className="relative flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-white/80 border border-amber-100/70 shadow-sm flex items-center justify-center">
                            {React.createElement(getLevelIcon(level), { className: 'w-5 h-5 text-amber-700' })}
                        </div>
                        <div>
                            <div className="text-sm font-display font-bold text-neutral-800">
                                {t('levelProgress.compact.title', { level, title })}
                            </div>
                            <div className="text-[11px] text-neutral-500">
                                {t('levelProgress.compact.xp', { current: formattedCurrentXP, total: formattedNextXP })}
                            </div>
                        </div>
                    </div>
                    <div className="text-[11px] font-semibold text-amber-700 bg-amber-100/60 px-2.5 py-1 rounded-full">
                        {t('levelProgress.compact.toGo', { remaining: formattedRemaining })}
                    </div>
                </div>

                {/* Progress bar */}
                <div className="relative mt-3 h-2.5 rounded-full bg-white/70 border border-white/80 overflow-hidden">
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.4),transparent_40%)]" />
                    <motion.div
                        initial={false}
                        animate={{ scaleX: progress / 100 }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        style={{ transformOrigin: 'left center' }}
                        className="h-full rounded-full bg-[linear-gradient(90deg,#F59E0B_0%,#F97316_45%,#FB7185_100%)] shadow-[0_0_12px_rgba(251,146,60,0.35)]"
                    />
                </div>
            </motion.div>
        );
    }

    // Full mode (Our Story section)
    return (
        <motion.div
            className={`level-progress-full glass-card relative overflow-hidden ${className}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
        >
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute -top-16 -right-10 h-44 w-44 rounded-full bg-amber-200/50 blur-2xl" />
                <div className="absolute -bottom-20 -left-12 h-48 w-48 rounded-full bg-rose-200/40 blur-2xl" />
                <div className="absolute inset-0 opacity-40" style={{
                    backgroundImage: 'radial-gradient(circle at 20% 0%, rgba(255,255,255,0.6), transparent 55%), radial-gradient(circle at 80% 100%, rgba(255,255,255,0.5), transparent 60%)'
                }} />
            </div>

            <div className="relative">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                            className="h-14 w-14 rounded-2xl bg-white/90 border border-amber-100/70 shadow-md flex items-center justify-center"
                        >
                            {React.createElement(getLevelIcon(level), { className: 'w-7 h-7 text-amber-700' })}
                        </motion.div>
                        <div>
                            <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500 font-semibold">
                                {t('levelProgress.full.kicker')}
                            </div>
                            <div className="text-xl font-display font-bold text-neutral-800">
                                {t('levelProgress.full.levelLabel', { level })}
                            </div>
                            <div className="text-sm text-neutral-600">{title}</div>
                        </div>
                    </div>
                    <div className="rounded-2xl bg-white/80 border border-amber-100/70 px-3 py-2 text-center shadow-sm">
                        <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">{t('levelProgress.full.nextLevelLabel')}</div>
                        <div className="text-base font-display font-bold text-neutral-800">
                            {t('levelProgress.full.nextLevelValue', { level: level + 1 })}
                        </div>
                    </div>
                </div>

                <div className="mt-5">
                    <div className="flex items-center justify-between text-xs text-neutral-500 mb-2">
                        <span>{t('levelProgress.full.progressLabel')}</span>
                        <span className="font-semibold text-amber-700">
                            {t('levelProgress.full.xpToGo', { remaining: formattedRemaining })}
                        </span>
                    </div>
                    <div className="relative h-3 rounded-full bg-white/80 border border-white/80 overflow-hidden">
                        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.5),transparent_40%)]" />
                        <motion.div
                            initial={false}
                            animate={{ scaleX: progress / 100 }}
                            transition={{ duration: 1, ease: 'easeOut', delay: 0.15 }}
                            style={{ transformOrigin: 'left center' }}
                            className="h-full rounded-full bg-[linear-gradient(90deg,#FBBF24_0%,#F97316_45%,#FB7185_100%)] shadow-[0_0_18px_rgba(249,115,22,0.35)]"
                        />
                    </div>
                </div>

            </div>
        </motion.div>
    );
};

export default LevelProgress;
