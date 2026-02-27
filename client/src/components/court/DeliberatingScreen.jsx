import React, { useEffect, useMemo, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Scale, BookOpen, Heart, Feather, Star, Gavel } from 'lucide-react';
import { useI18n } from '../../i18n';
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion';

/**
 * DeliberatingScreen
 * Court-themed full-screen waiting experience while Judge Whiskers deliberates.
 * Uses the existing court palette + glass-card styling (no new colors).
 */

const STEPS = [
    {
        titleKey: 'court.deliberating.steps.review.title',
        subtitleKey: 'court.deliberating.steps.review.subtitle',
        Icon: BookOpen,
    },
    {
        titleKey: 'court.deliberating.steps.honor.title',
        subtitleKey: 'court.deliberating.steps.honor.subtitle',
        Icon: Heart,
    },
    {
        titleKey: 'court.deliberating.steps.draft.title',
        subtitleKey: 'court.deliberating.steps.draft.subtitle',
        Icon: Feather,
    },
];

const DEFAULT_FALLBACK_QUOTES = [
    'Reviewing the evidence...',
    'Considering both perspectives...',
    'Weighing the options...',
];

const DeliberatingScreen = ({ isLoading = true, judgeAvatar }) => {
    const { t } = useI18n();
    const prefersReducedMotion = usePrefersReducedMotion();
    const avatarSrc = judgeAvatar || '/assets/avatars/judge_whiskers.png';
    const [stepIndex, setStepIndex] = useState(0);
    const [quoteIndex, setQuoteIndex] = useState(0);
    const localizedQuotes = t('court.deliberating.quotes');
    const localizedFallbackQuotes = t('court.deliberating.fallbackQuotes', { returnObjects: true });
    const fallbackQuotes = Array.isArray(localizedFallbackQuotes) && localizedFallbackQuotes.length
        ? localizedFallbackQuotes
        : DEFAULT_FALLBACK_QUOTES;
    const quotes = Array.isArray(localizedQuotes) && localizedQuotes.length
        ? localizedQuotes
        : fallbackQuotes;

    useEffect(() => {
        if (!isLoading || prefersReducedMotion) return;
        const t = setInterval(() => {
            setStepIndex((prev) => (prev + 1) % STEPS.length);
        }, 3000);
        return () => clearInterval(t);
    }, [isLoading, prefersReducedMotion]);

    useEffect(() => {
        if (!isLoading || prefersReducedMotion) return;
        const t = setInterval(() => {
            setQuoteIndex((prev) => (prev + 1) % quotes.length);
        }, 6000);
        return () => clearInterval(t);
    }, [isLoading, prefersReducedMotion, quotes.length]);

    const activeStep = useMemo(() => STEPS[stepIndex], [stepIndex]);

    if (!isLoading) return null;

    // Simplified transitions for reduced motion
    const fadeTransition = prefersReducedMotion ? { duration: 0.1 } : undefined;

    return (
        <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fadeTransition}
            className="fixed inset-0 z-[45] pointer-events-none bg-gradient-to-b from-court-ivory/95 via-court-cream/80 to-court-tan/40 flex items-center justify-center p-4"
        >
            <div className="w-full max-w-md">
                {/* Ambient animated background accents (inside overlay, no extra colors) */}
                <div className="relative">
                    {!prefersReducedMotion && (
                        <>
                            <Motion.div
                                aria-hidden
                                animate={{
                                    opacity: [0.25, 0.45, 0.25],
                                    scale: [1, 1.05, 1],
                                }}
                                transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
                                className="absolute -top-10 -left-10 w-48 h-48 rounded-full bg-court-gold/15 blur-xl"
                            />
                            <Motion.div
                                aria-hidden
                                animate={{
                                    opacity: [0.18, 0.35, 0.18],
                                    y: [0, -10, 0],
                                }}
                                transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
                                className="absolute -bottom-10 -right-10 w-56 h-56 rounded-full bg-court-maroon/10 blur-xl"
                            />
                        </>
                    )}
                    {prefersReducedMotion && (
                        <>
                            <div
                                aria-hidden
                                className="absolute -top-10 -left-10 w-48 h-48 rounded-full bg-court-gold/15 blur-xl opacity-35"
                            />
                            <div
                                aria-hidden
                                className="absolute -bottom-10 -right-10 w-56 h-56 rounded-full bg-court-maroon/10 blur-xl opacity-25"
                            />
                        </>
                    )}

                    <div className="glass-card p-6 relative overflow-hidden border border-court-gold/15 bg-white/85">
                        {/* Shimmer sweep - only show when not reduced motion */}
                        {!prefersReducedMotion && (
                            <Motion.div
                                aria-hidden
                                animate={{ x: ['-120%', '120%'] }}
                                transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                                className="absolute top-0 left-0 h-full w-1/2 bg-gradient-to-r from-transparent via-white/25 to-transparent rotate-12"
                            />
                        )}

                        <div className="relative">
                            <div className="flex items-start gap-3">
                                {prefersReducedMotion ? (
                                    <div className="w-12 h-12 rounded-2xl bg-court-gold/15 flex items-center justify-center">
                                        <Scale className="w-6 h-6 text-court-gold" />
                                    </div>
                                ) : (
                                    <Motion.div
                                        animate={{ rotate: [0, 10, -10, 0] }}
                                        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                                        className="w-12 h-12 rounded-2xl bg-court-gold/15 flex items-center justify-center"
                                    >
                                        <Scale className="w-6 h-6 text-court-gold" />
                                    </Motion.div>
                                )}
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-lg font-extrabold text-court-brown">{t('court.deliberating.title')}</h2>
                                        {prefersReducedMotion ? (
                                            <div className="text-court-gold">
                                                <Star className="w-4 h-4" />
                                            </div>
                                        ) : (
                                            <Motion.div
                                                animate={{ rotate: [0, 12, -12, 0] }}
                                                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                                                className="text-court-gold"
                                            >
                                                <Star className="w-4 h-4" />
                                            </Motion.div>
                                        )}
                                    </div>
                                    <p className="text-sm text-court-brownLight">{t('court.deliberating.subtitle')}</p>
                                </div>
                            </div>

                            {/* Judge avatar + gavel pulse */}
                            <div className="mt-5 flex items-center gap-4">
                                {prefersReducedMotion ? (
                                    <div className="w-14 h-14 rounded-2xl overflow-hidden border border-court-gold/40 shadow-soft">
                                        <img
                                            src={avatarSrc}
                                            alt={t('court.deliberating.judgeAlt')}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                ) : (
                                    <Motion.div
                                        animate={{ y: [0, -6, 0] }}
                                        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                                        className="w-14 h-14 rounded-2xl overflow-hidden border border-court-gold/40 shadow-soft"
                                    >
                                        <img
                                            src={avatarSrc}
                                            alt={t('court.deliberating.judgeAlt')}
                                            className="w-full h-full object-cover"
                                        />
                                    </Motion.div>
                                )}

                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        {prefersReducedMotion ? (
                                            <div className="w-9 h-9 rounded-xl bg-court-cream border border-court-tan/30 flex items-center justify-center">
                                                <Gavel className="w-5 h-5 text-court-brown" />
                                            </div>
                                        ) : (
                                            <Motion.div
                                                animate={{
                                                    scale: [1, 1.06, 1],
                                                    opacity: [0.9, 1, 0.9]
                                                }}
                                                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                                                className="w-9 h-9 rounded-xl bg-court-cream border border-court-tan/30 flex items-center justify-center"
                                            >
                                                <Gavel className="w-5 h-5 text-court-brown" />
                                            </Motion.div>
                                        )}
                                        <div>
                                            <p className="text-xs font-bold text-court-brown">{t('court.deliberating.analyzingTitle')}</p>
                                            <p className="text-[10px] text-court-brownLight">{t('court.deliberating.analyzingSubtitle')}</p>
                                        </div>
                                    </div>

                                    <div className="mt-3 h-2.5 rounded-full bg-court-tan/20 overflow-hidden">
                                        {prefersReducedMotion ? (
                                            <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-court-gold/50 via-court-gold/70 to-court-gold/50" />
                                        ) : (
                                            <Motion.div
                                                initial={{ scaleX: 0.08 }}
                                                animate={{ scaleX: [0.1, 0.68, 0.38, 0.82] }}
                                                transition={{ duration: 2.6, ease: 'easeInOut' }}
                                                style={{ transformOrigin: '0% 50%' }}
                                                className="h-full w-full rounded-full bg-gradient-to-r from-court-gold/50 via-court-gold/70 to-court-gold/50"
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-5">
                                <AnimatePresence mode="wait">
                                    <Motion.div
                                        key={activeStep.titleKey}
                                        initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10, scale: prefersReducedMotion ? 1 : 0.98 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -10, scale: prefersReducedMotion ? 1 : 0.98 }}
                                        transition={{ duration: prefersReducedMotion ? 0.1 : 0.28 }}
                                        className="rounded-3xl border border-court-tan/30 bg-white/55 p-4"
                                    >
                                        <div className="flex items-start gap-3">
                                            {prefersReducedMotion ? (
                                                <div className="w-10 h-10 rounded-2xl bg-court-cream flex items-center justify-center border border-court-tan/30">
                                                    <activeStep.Icon className="w-5 h-5 text-court-brown" />
                                                </div>
                                            ) : (
                                                <Motion.div
                                                    animate={{ rotate: [0, 4, -4, 0] }}
                                                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                                                    className="w-10 h-10 rounded-2xl bg-court-cream flex items-center justify-center border border-court-tan/30"
                                                >
                                                    <activeStep.Icon className="w-5 h-5 text-court-brown" />
                                                </Motion.div>
                                            )}
                                            <div className="flex-1">
                                                <p className="text-sm font-extrabold text-court-brown">{t(activeStep.titleKey)}</p>
                                                <p className="text-xs text-court-brownLight mt-0.5">{t(activeStep.subtitleKey)}</p>
                                            </div>
                                        </div>

                                        <div className="mt-4">
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 h-2.5 rounded-full bg-court-tan/20 overflow-hidden">
                                                    {prefersReducedMotion ? (
                                                        <div className="h-full w-1/3 rounded-full bg-court-gold/50" />
                                                    ) : (
                                                        <Motion.div
                                                            animate={{
                                                                x: ['-20%', '120%'],
                                                            }}
                                                            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                                                            className="h-full w-1/3 rounded-full bg-court-gold/50"
                                                        />
                                                    )}
                                                </div>
                                                {prefersReducedMotion ? (
                                                    <div className="text-[10px] font-bold text-court-brownLight">
                                                        {t('court.deliberating.working')}
                                                    </div>
                                                ) : (
                                                    <Motion.div
                                                        animate={{ opacity: [0.4, 1, 0.4] }}
                                                        transition={{ duration: 1.2, repeat: Infinity }}
                                                        className="text-[10px] font-bold text-court-brownLight"
                                                    >
                                                        {t('court.deliberating.working')}
                                                    </Motion.div>
                                                )}
                                            </div>
                                        </div>
                                    </Motion.div>
                                </AnimatePresence>
                            </div>

                            <div className="mt-4">
                                <AnimatePresence mode="wait">
                                    <Motion.p
                                        key={quoteIndex}
                                        initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -6 }}
                                        transition={{ duration: prefersReducedMotion ? 0.1 : undefined }}
                                        className="text-xs text-court-brownLight italic text-center"
                                    >
                                        {quotes[quoteIndex % quotes.length]}
                                    </Motion.p>
                                </AnimatePresence>
                            </div>

                            <div className="mt-5 flex items-center justify-center gap-2">
                                {[0, 1, 2, 3].map((i) => (
                                    prefersReducedMotion ? (
                                        <div
                                            key={i}
                                            className="w-2 h-2 rounded-full bg-court-gold/70"
                                        />
                                    ) : (
                                        <Motion.div
                                            key={i}
                                            animate={{ opacity: [0.35, 1, 0.35], y: [0, -2, 0] }}
                                            transition={{ duration: 1.1, delay: i * 0.15, repeat: Infinity, ease: 'easeInOut' }}
                                            className="w-2 h-2 rounded-full bg-court-gold/70"
                                        />
                                    )
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <p className="text-center text-xs text-court-brownLight mt-3">
                    {t('court.deliberating.note')}
                </p>
            </div>
        </Motion.div>
    );
};

export default DeliberatingScreen;
