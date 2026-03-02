/**
 * ChallengesPage - Challenges page with API integration
 * 
 * Phase 2B: Uses useChallengeStore for API data.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, Sparkles, ChevronDown, ChevronUp, RefreshCw, AlertCircle } from 'lucide-react';
import ChallengeCard from '../components/ChallengeCard';
import useLevelStore from '../store/useLevelStore';
import useChallengeStore from '../store/useChallengeStore';
import useAuthStore from '../store/useAuthStore';
import usePartnerStore from '../store/usePartnerStore';
import { useI18n } from '../i18n';
import BackButton from '../components/shared/BackButton';
import StandardButton from '../components/shared/StandardButton';
import useUiPerfProfile from '../hooks/useUiPerfProfile';
import useStagedMount from '../hooks/useStagedMount';
import { isNativeIOS } from '../utils/platform';

// Loading skeleton component
const ChallengeSkeleton = () => (
    <div className="rounded-[28px] border border-white/80 bg-white/70 p-4 shadow-soft animate-pulse">
        <div className="flex items-start gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-neutral-200" />
            <div className="flex-1 space-y-2">
                <div className="h-4 bg-neutral-200 rounded w-3/4" />
                <div className="h-3 bg-neutral-200 rounded w-1/2" />
            </div>
        </div>
        <div className="h-2.5 bg-neutral-200 rounded-full w-full" />
    </div>
);

const ChallengeBackdrop = ({ prefersReducedMotion = false }) => (
    <div className="fixed inset-0 pointer-events-none">
        <div className={`absolute -top-20 -right-20 h-64 w-64 rounded-full bg-amber-200/30 ${prefersReducedMotion ? 'blur-xl' : 'blur-2xl'}`} />
        <div className={`absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-rose-200/25 ${prefersReducedMotion ? 'blur-xl' : 'blur-2xl'}`} />
    </div>
);

const ChallengesPage = () => {
    const navigate = useNavigate();
    const { t, language } = useI18n();
    const { prefersReducedMotion } = useUiPerfProfile();
    const shouldReduceFx = prefersReducedMotion;
    const handleBack = () => navigate('/profile', { state: { tab: 'us' } });
    const user = useAuthStore((state) => state.user);
    const hasPartner = usePartnerStore((state) => state.hasPartner);
    const level = useLevelStore((state) => state.level);
    const shouldShowChallenges = useLevelStore((state) => state.shouldShowChallenges);
    const fetchLevel = useLevelStore((state) => state.fetchLevel);
    const active = useChallengeStore((state) => state.active);
    const completed = useChallengeStore((state) => state.completed);
    const isLoading = useChallengeStore((state) => state.isLoading);
    const error = useChallengeStore((state) => state.error);
    const errorCode = useChallengeStore((state) => state.errorCode);
    const fetchChallenges = useChallengeStore((state) => state.fetchChallenges);
    const skipChallenge = useChallengeStore((state) => state.skipChallenge);
    const completeChallenge = useChallengeStore((state) => state.completeChallenge);
    const confirmChallenge = useChallengeStore((state) => state.confirmChallenge);
    const clearError = useChallengeStore((state) => state.clearError);
    const [showCompleted, setShowCompleted] = useState(false);
    const showChallengeLists = useStagedMount({
        enabled: isNativeIOS() && !prefersReducedMotion,
        delay: 230
    });
    const currentUserId = user?.id || null;
    const challengeStats = useMemo(() => {
        const sumXP = (list) => list.reduce((total, challenge) => total + (challenge.rewardXP || 0), 0);
        const dailyActive = active.filter((challenge) => challenge.cadence === 'daily');
        const weeklyActive = active.filter((challenge) => challenge.cadence === 'weekly');
        return {
            active: active.length,
            completed: completed.length,
            dailyActive: dailyActive.length,
            weeklyActive: weeklyActive.length,
            dailyXP: sumXP(dailyActive),
            weeklyXP: sumXP(weeklyActive),
        };
    }, [active, completed]);
    const errorMessage = errorCode ? t(`challenges.errors.${errorCode}`) : error;

    useEffect(() => {
        if (hasPartner) {
            fetchLevel();
            fetchChallenges();
        }
    }, [hasPartner, fetchLevel, fetchChallenges, language]);

    const [pendingActions, setPendingActions] = useState({});

    const withPending = async (key, action) => {
        if (pendingActions[key]) return;
        setPendingActions((prev) => ({ ...prev, [key]: true }));
        try {
            await action();
        } finally {
            setPendingActions((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
        }
    };

    const handleSkip = async (id) => {
        await withPending(`skip:${id}`, () => skipChallenge(id));
    };

    const handleComplete = async (id) => {
        await withPending(`complete:${id}`, () => completeChallenge(id));
    };

    const handleConfirm = async (id) => {
        await withPending(`confirm:${id}`, () => confirmChallenge(id));
    };

    const handleRetry = () => {
        clearError();
        fetchChallenges();
    };

    // Progressive disclosure: Level 5+ required
    if (!shouldShowChallenges()) {
        return (
            <div className="relative min-h-screen overflow-hidden pb-6">
                <ChallengeBackdrop prefersReducedMotion={shouldReduceFx} />
                <div className="relative">
                    <Motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={handleBack}
                        className="flex items-center gap-2 text-sm font-semibold text-neutral-600"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span>{t('common.back')}</span>
                    </Motion.button>

                    <Motion.div
                        initial={shouldReduceFx ? false : { opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-10 glass-card text-center px-6 py-8"
                    >
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-200/70 bg-amber-100/80">
                            <Trophy className="w-8 h-8 text-amber-600" />
                        </div>
                        <h2 className="mt-4 text-xl font-display font-bold text-neutral-800">
                            {t('challenges.locked.title', { level: 5 })}
                        </h2>
                        <p className="mt-2 text-sm text-neutral-500">
                            {t('challenges.locked.subtitle', { level })}
                        </p>
                        <StandardButton
                            size="lg"
                            onClick={handleBack}
                            className="mt-5 w-full py-3 text-sm"
                        >
                            {t('challenges.locked.cta')}
                        </StandardButton>
                    </Motion.div>
                </div>
            </div>
        );
    }

    return (
        <div className="relative min-h-screen overflow-hidden pb-6">
            <ChallengeBackdrop prefersReducedMotion={shouldReduceFx} />
            <div className="relative space-y-6">
                <header className="flex items-start gap-3">
                    <BackButton onClick={handleBack} ariaLabel={t('common.back')} />
                    <div className="flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-600">
                            {t('challenges.header.kicker')}
                        </p>
                        <h1 className="text-2xl font-display font-bold text-neutral-800">{t('challenges.header.title')}</h1>
                        <p className="text-sm text-neutral-500">{t('challenges.header.subtitle')}</p>
                    </div>
                    <div className="flex items-center gap-1 rounded-full border border-amber-200/70 bg-amber-100/70 px-3 py-2 text-xs font-bold text-amber-700">
                        <Sparkles className="w-4 h-4 text-amber-600" />
                        {t('challenges.header.level', { level })}
                    </div>
                </header>

                <Motion.section
                    initial={shouldReduceFx ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card relative overflow-hidden"
                >
                    <div className="absolute inset-0 pointer-events-none">
                        <div className={`absolute -top-10 -right-8 h-20 w-20 rounded-full bg-amber-200/35 ${shouldReduceFx ? 'blur-xl' : 'blur-2xl'}`} />
                        <div className={`absolute -bottom-12 -left-10 h-24 w-24 rounded-full bg-rose-200/30 ${shouldReduceFx ? 'blur-xl' : 'blur-2xl'}`} />
                    </div>
                    <div className="relative space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-neutral-500">
                                    {t('challenges.section.dropKicker')}
                                </p>
                                <h2 className="mt-1 text-lg font-display font-bold text-neutral-800">
                                    {t('challenges.section.dropTitle')}
                                </h2>
                                <p className="mt-1 text-xs text-neutral-500">
                                    {t('challenges.section.dropSubtitle')}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-white/80 bg-white/80 px-3 py-2 text-xs font-semibold text-amber-700 shadow-inner-soft">
                                {t('challenges.section.activeCount', { count: challengeStats.active })}
                            </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="rounded-[22px] border border-white/80 bg-gradient-to-br from-sky-50 via-white to-sky-100/70 px-4 py-3 shadow-inner-soft">
                                <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-500">
                                    {t('challenges.section.dailyTitle')}
                                    <span className="rounded-full border border-sky-200/70 bg-sky-100/70 px-2 py-0.5 text-[10px] font-bold text-sky-700">
                                        {t('challenges.section.dailyBadge')}
                                    </span>
                                </div>
                                <div className="mt-3 flex items-center justify-between">
                                    <div>
                                        <div className="text-2xl font-display font-bold text-neutral-800">{challengeStats.dailyActive}</div>
                                        <div className="text-xs text-neutral-500">{t('challenges.section.dailyActive')}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-display font-bold text-sky-600">{t('challenges.section.dailyXp', { xp: challengeStats.dailyXP })}</div>
                                        <div className="text-[11px] text-sky-500">{t('challenges.section.dailyXpLabel')}</div>
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-[22px] border border-white/80 bg-gradient-to-br from-amber-50 via-white to-rose-100/70 px-4 py-3 shadow-inner-soft">
                                <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-600">
                                    {t('challenges.section.weeklyTitle')}
                                    <span className="rounded-full border border-amber-200/70 bg-amber-100/70 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                        {t('challenges.section.weeklyBadge')}
                                    </span>
                                </div>
                                <div className="mt-3 flex items-center justify-between">
                                    <div>
                                        <div className="text-2xl font-display font-bold text-neutral-800">{challengeStats.weeklyActive}</div>
                                        <div className="text-xs text-neutral-500">{t('challenges.section.weeklyActive')}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-display font-bold text-amber-600">{t('challenges.section.weeklyXp', { xp: challengeStats.weeklyXP })}</div>
                                        <div className="text-[11px] text-amber-500">{t('challenges.section.weeklyXpLabel')}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </Motion.section>

                {errorMessage && (
                    <Motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-start gap-3 rounded-2xl border border-rose-200/70 bg-rose-50/70 p-4"
                    >
                        <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
                        <div className="flex-1">
                            <p className="text-sm text-rose-700">{errorMessage}</p>
                        </div>
                        <Motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={handleRetry}
                            className="rounded-xl border border-rose-200/70 bg-white/80 p-2 text-rose-600"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </Motion.button>
                    </Motion.div>
                )}

                {isLoading && (
                    <div className="space-y-3">
                        <ChallengeSkeleton />
                        <ChallengeSkeleton />
                    </div>
                )}

                {!isLoading && !showChallengeLists && (
                    <div className="space-y-3">
                        <ChallengeSkeleton />
                        <ChallengeSkeleton />
                    </div>
                )}

                {showChallengeLists && !isLoading && active.length > 0 && (
                    <section className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-neutral-500">
                                    {t('challenges.active.kicker')}
                                </p>
                                <h2 className="text-base font-display font-bold text-neutral-800">{t('challenges.active.title')}</h2>
                            </div>
                            <div className="rounded-full border border-amber-200/70 bg-amber-100/70 px-3 py-1 text-[11px] font-bold text-amber-700">
                                {t('challenges.active.count', { count: active.length })}
                            </div>
                        </div>
                        <div className="space-y-3">
                            {active.map((challenge) => (
                                <div key={challenge.id} className="perf-content-auto-compact contain-paint">
                                    <ChallengeCard
                                        {...challenge}
                                        actionLabel={
                                            challenge.requiresConfirmation
                                                ? challenge.confirmationStatus === 'none'
                                                    ? t('challenges.actions.markDone')
                                                    : challenge.confirmationStatus === 'pending'
                                                        ? (challenge.confirmRequestedBy && challenge.confirmRequestedBy !== currentUserId
                                                            ? t('challenges.actions.confirm')
                                                            : t('challenges.actions.waiting'))
                                                        : null
                                                : null
                                        }
                                        actionDisabled={
                                            challenge.requiresConfirmation
                                                && challenge.confirmationStatus === 'pending'
                                                && (!challenge.confirmRequestedBy || challenge.confirmRequestedBy === currentUserId)
                                        }
                                        onAction={() => {
                                            if (!challenge.requiresConfirmation) return;
                                            if (challenge.confirmationStatus === 'none') {
                                                handleComplete(challenge.id);
                                            } else if (challenge.confirmationStatus === 'pending'
                                                && challenge.confirmRequestedBy
                                                && challenge.confirmRequestedBy !== currentUserId) {
                                                handleConfirm(challenge.id);
                                            }
                                        }}
                                        actionLoading={
                                            !!pendingActions[`complete:${challenge.id}`]
                                            || !!pendingActions[`confirm:${challenge.id}`]
                                        }
                                        onSkip={() => handleSkip(challenge.id)}
                                        skipLoading={!!pendingActions[`skip:${challenge.id}`]}
                                    />
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {showChallengeLists && !isLoading && completed.length > 0 && (
                    <section className="glass-card space-y-3">
                        <Motion.button
                            whileTap={shouldReduceFx ? undefined : { scale: 0.98 }}
                            onClick={() => setShowCompleted(!showCompleted)}
                            className="flex w-full items-center justify-between text-neutral-600"
                        >
                            <div>
                                <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-neutral-500">
                                    {t('challenges.completed.kicker')}
                                </div>
                                <div className="text-sm font-bold text-neutral-700">
                                    {t('challenges.completed.title', { count: completed.length })}
                                </div>
                            </div>
                            {showCompleted ? (
                                <ChevronUp className="w-5 h-5" />
                            ) : (
                                <ChevronDown className="w-5 h-5" />
                            )}
                        </Motion.button>

                        <AnimatePresence initial={false}>
                            {showCompleted && (
                                <Motion.div
                                    initial={shouldReduceFx ? { opacity: 0 } : { opacity: 0, y: -6, scaleY: 0.97 }}
                                    animate={shouldReduceFx ? { opacity: 1 } : { opacity: 1, y: 0, scaleY: 1 }}
                                    exit={shouldReduceFx ? { opacity: 0 } : { opacity: 0, y: -6, scaleY: 0.97 }}
                                    transition={{ duration: shouldReduceFx ? 0.14 : 0.22, ease: 'easeOut' }}
                                    className="space-y-3 overflow-hidden origin-top"
                                >
                                    {completed.map((challenge) => (
                                        <div key={challenge.id} className="perf-content-auto-compact contain-paint">
                                            <ChallengeCard
                                                {...challenge}
                                                status="completed"
                                            />
                                        </div>
                                    ))}
                                </Motion.div>
                            )}
                        </AnimatePresence>
                    </section>
                )}

                {showChallengeLists && !isLoading && !errorMessage && active.length === 0 && (
                    <Motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="glass-card text-center px-6 py-10"
                    >
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-200/70 bg-amber-100/80">
                            <Trophy className="w-8 h-8 text-amber-500" />
                        </div>
                        <h3 className="mt-4 text-lg font-display font-bold text-neutral-800">
                            {t('challenges.empty.title')}
                        </h3>
                        <p className="mt-2 text-sm text-neutral-500">{t('challenges.empty.subtitle')}</p>
                    </Motion.div>
                )}
            </div>
        </div>
    );
};

export default ChallengesPage;
