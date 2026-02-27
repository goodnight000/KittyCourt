import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    User, Heart, Settings, Lock, Crown, Sparkles, Zap, Gavel, Wand2, ImagePlus, Scale, Target
} from 'lucide-react';
import useAppStore from '../store/useAppStore';
import useAuthStore from '../store/useAuthStore';
import usePartnerStore from '../store/usePartnerStore';
import useCacheStore, { CACHE_POLICY, cacheKey } from '../store/useCacheStore';
import useSubscriptionStore from '../store/useSubscriptionStore';
import useLevelStore from '../store/useLevelStore';
import useMemoryStore from '../store/useMemoryStore';
import useInsightsStore from '../store/useInsightsStore';
import useChallengeStore from '../store/useChallengeStore';
import Paywall from '../components/Paywall';
import ProfilePicture from '../components/ProfilePicture';
import LevelProgress from '../components/LevelProgress';
import MemoryCard from '../components/MemoryCard';
import ProfileCard from '../components/profile/ProfileCard';
import ProfileEditForm from '../components/profile/ProfileEditForm';
import PartnerConnection from '../components/profile/PartnerConnection';
import MilestonesSection from '../components/profile/MilestonesSection';
import DisconnectNotice from '../components/DisconnectNotice';
import useProfileData from '../components/profile/useProfileData';
import useCalendarEvents from '../components/calendar/useCalendarEvents';
import EmojiIcon from '../components/shared/EmojiIcon';
import api from '../services/api';
import { useI18n } from '../i18n';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion';
import { getRevenueCatPlanPricing } from '../lib/revenuecatPricing';

const ProfilesPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { t, language } = useI18n();
    const prefersReducedMotion = usePrefersReducedMotion();
    const currentUser = useAppStore((state) => state.currentUser);
    const fetchAppreciations = useAppStore((state) => state.fetchAppreciations);
    const profile = useAuthStore((state) => state.profile);
    const signOut = useAuthStore((state) => state.signOut);
    const authUser = useAuthStore((state) => state.user);
    const connectedPartner = usePartnerStore((state) => state.partner);
    const hasPartner = usePartnerStore((state) => state.hasPartner);
    const disconnectStatus = usePartnerStore((state) => state.disconnectStatus);
    const isGold = useSubscriptionStore((state) => state.isGold);
    const getUsageDisplay = useSubscriptionStore((state) => state.getUsageDisplay);
    const offerings = useSubscriptionStore((state) => state.offerings);
    const level = useLevelStore((state) => state.level);
    const currentXP = useLevelStore((state) => state.currentXP);
    const xpForNextLevel = useLevelStore((state) => state.xpForNextLevel);
    const title = useLevelStore((state) => state.title);
    const fetchLevel = useLevelStore((state) => state.fetchLevel);
    const shouldShowChallenges = useLevelStore((state) => state.shouldShowChallenges);
    const shouldShowInsights = useLevelStore((state) => state.shouldShowInsights);
    const serverAvailable = useLevelStore((state) => state.serverAvailable);
    const memories = useMemoryStore((state) => state.memories);
    const deletedMemories = useMemoryStore((state) => state.deletedMemories);
    const fetchMemories = useMemoryStore((state) => state.fetchMemories);
    const memoriesAvailable = useMemoryStore((state) => state.serverAvailable);
    const insights = useInsightsStore((state) => state.insights);
    const fetchInsights = useInsightsStore((state) => state.fetchInsights);
    const insightsAvailable = useInsightsStore((state) => state.serverAvailable);
    const activeChallenges = useChallengeStore((state) => state.active);
    const completedChallenges = useChallengeStore((state) => state.completed);
    const availableChallenges = useChallengeStore((state) => state.available);
    const challengesLoading = useChallengeStore((state) => state.isLoading);
    const fetchChallenges = useChallengeStore((state) => state.fetchChallenges);
    const [showEditModal, setShowEditModal] = useState(false);
    const [activeTab, setActiveTab] = useState(() => (
        location.state?.tab === 'us' || location.state?.tab === 'me'
            ? location.state.tab
            : 'me'
    ));
    const [showPaywall, setShowPaywall] = useState(false);
    const [activeChallengeIndex, setActiveChallengeIndex] = useState(0);
    const [userStats, setUserStats] = useState(null);
    const challengeTrackRef = useRef(null);
    const challengeCardWidthRef = useRef(0);
    const latestInsight = insights?.[0] || null;
    const showChallenges = shouldShowChallenges();
    const showInsights = shouldShowInsights();
    const insightsUnlocked = showInsights && isGold;
    const needsGoldForInsights = showInsights && !isGold;
    const isXPEnabled = import.meta.env.VITE_XP_SYSTEM_ENABLED === 'true';
    const unlockHint = t('profile.unlockHint');
    const activeChallengeCount = activeChallenges?.length || 0;
    const availableChallengeCount = availableChallenges?.length || 0;
    const clampedActiveChallengeIndex = Math.min(
        activeChallengeIndex,
        Math.max(activeChallengeCount - 1, 0)
    );
    const loveLanguages = useMemo(() => [
        { id: 'words', label: t('options.loveLanguage.words'), emoji: '💬' },
        { id: 'acts', label: t('options.loveLanguage.acts'), emoji: '🤲' },
        { id: 'gifts', label: t('options.loveLanguage.gifts'), emoji: '🎁' },
        { id: 'time', label: t('options.loveLanguage.time'), emoji: '⏰' },
        { id: 'touch', label: t('options.loveLanguage.touch'), emoji: '🤗' },
    ], [t]);

    // Use custom hook for profile data management
    const { profileData, saveProfile } = useProfileData();

    // Calendar events for milestones tracking (only user-created events, not defaults)
    const { events: calendarEvents } = useCalendarEvents(t, language, { enabled: activeTab === 'us' });
    const userCreatedCalendarEvents = useMemo(
        () => (calendarEvents?.filter((event) => !event.isDefault && !event.isPersonal) || []),
        [calendarEvents]
    );

    useEffect(() => {
        fetchAppreciations();
        if (hasPartner) {
            fetchLevel();
        }
    }, [fetchAppreciations, hasPartner, fetchLevel]);

    // Fetch unified stats from /api/stats with caching
    useEffect(() => {
        const fetchStats = async () => {
            if (!authUser?.id) return;

            try {
                const cacheStore = useCacheStore.getState();
                const key = cacheKey.stats(authUser.id);

                const { data, promise } = await cacheStore.getOrFetch({
                    key,
                    fetcher: async () => {
                        const response = await api.get('/stats');
                        return response.data || null;
                    },
                    ...CACHE_POLICY.STATS,
                    revalidateOnInterval: true,
                });

                setUserStats(data);

                if (promise) {
                    promise.then((fresh) => setUserStats(fresh)).catch(() => {});
                }
            } catch (err) {
                console.error('Failed to fetch stats:', err);
            }
        };
        fetchStats();
    }, [authUser?.id]);

    useEffect(() => {
        if (!authUser?.id) return;
        const cacheStore = useCacheStore.getState();
        const key = cacheKey.stats(authUser.id);
        const unsubscribe = cacheStore.subscribeKey(key, (next) => {
            setUserStats(next || null);
        });
        return unsubscribe;
    }, [authUser?.id]);

    useEffect(() => {
        if (activeTab !== 'us' || !hasPartner || !memoriesAvailable) return;
        fetchMemories();
    }, [activeTab, fetchMemories, hasPartner, memoriesAvailable]);

    useEffect(() => {
        if (
            activeTab !== 'us'
            || !hasPartner
            || !isXPEnabled
            || !serverAvailable
            || !insightsAvailable
            || !showInsights
            || !isGold
        ) return;
        fetchInsights();
    }, [activeTab, fetchInsights, hasPartner, insightsAvailable, isXPEnabled, serverAvailable, showInsights, isGold]);

    useEffect(() => {
        if (activeTab !== 'us' || !hasPartner || !showChallenges) return;
        fetchChallenges();
    }, [activeTab, fetchChallenges, hasPartner, showChallenges]);

    useEffect(() => {
        challengeCardWidthRef.current = 0;
        if (challengeTrackRef.current) {
            challengeTrackRef.current.scrollTo({ left: 0, behavior: 'auto' });
        }
    }, [activeChallengeCount]);

    const handleChallengeScroll = () => {
        if (!challengeTrackRef.current || activeChallengeCount === 0) return;
        const container = challengeTrackRef.current;
        if (!challengeCardWidthRef.current) {
            const firstCard = container.querySelector('[data-challenge-card]');
            if (firstCard) {
                challengeCardWidthRef.current = firstCard.getBoundingClientRect().width;
            }
        }
        const cardWidth = challengeCardWidthRef.current || 240;
        const gap = 12;
        const index = Math.round(container.scrollLeft / (cardWidth + gap));
        const clampedIndex = Math.min(Math.max(index, 0), activeChallengeCount - 1);
        if (clampedIndex !== clampedActiveChallengeIndex) {
            setActiveChallengeIndex(clampedIndex);
        }
    };


    // Unified stats from user_stats table (single source of truth)
    const totalCases = userStats?.cases_resolved ?? 0;
    const totalAppreciations = userStats?.appreciations_received ?? 0;
    const questionsAnswered = userStats?.questions_completed ?? 0;
    // Partner stats would need a separate fetch or couple stats endpoint
    const partnerQuestionsAnswered = 0; // Deprecated - use couple stats if needed

    // Get love language
    const selectedLoveLanguage = useMemo(
        () => loveLanguages.find((languageOption) => languageOption.id === profileData.loveLanguage),
        [loveLanguages, profileData.loveLanguage]
    );
    const pricing = useMemo(
        () => getRevenueCatPlanPricing({
            offerings,
            language,
            fallbackMonthly: null,
            fallbackYearlyMonthly: null,
        }),
        [offerings, language]
    );
    const upgradePriceLabel = pricing.monthlyPrice
        ? t('paywall.cta.price', { price: pricing.monthlyPrice })
        : t('profilePage.subscription.price');

    return (
        <div className="relative min-h-screen pb-6 overflow-hidden">
            {/* Background gradient */}
            <div className="fixed inset-0 pointer-events-none">
                <div className={`absolute -top-20 -right-20 h-64 w-64 rounded-full bg-amber-200/30 ${prefersReducedMotion ? 'blur-xl opacity-70' : 'blur-2xl'}`} />
                <div className={`absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-rose-200/25 ${prefersReducedMotion ? 'blur-xl opacity-70' : 'blur-2xl'}`} />
            </div>
            <div className="relative space-y-6">

                <header className="flex items-center gap-3">
                    <div className="flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-600">
                            {t('profilePage.header.kicker')}
                        </p>
                        <h1 className="text-2xl font-display font-bold text-neutral-800">{t('profilePage.header.title')}</h1>
                    </div>
                    <Motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate('/settings')}
                        className="grid h-11 w-11 place-items-center rounded-2xl border border-white/80 bg-white/80 shadow-soft"
                        aria-label={t('profilePage.header.settingsAria')}
                    >
                        <Settings className="w-5 h-5 text-neutral-600" />
                    </Motion.button>
                </header>

                {/* Tab Switcher */}
                <div className="relative flex rounded-full border border-white/80 bg-white/75 p-1.5 shadow-inner-soft">
                    <button
                        onClick={() => setActiveTab('me')}
                        className={`relative flex-1 rounded-full px-3 py-2.5 text-sm font-bold transition-colors ${activeTab === 'me' ? 'text-amber-700' : 'text-neutral-500'
                            }`}
                    >
                        {activeTab === 'me' && (
                            prefersReducedMotion ? (
                                <span className="absolute inset-0 rounded-full border border-amber-200/70 bg-amber-100/80 shadow-soft" />
                            ) : (
                                <Motion.span
                                    layoutId="profileTab"
                                    className="absolute inset-0 rounded-full border border-amber-200/70 bg-amber-100/80 shadow-soft"
                                />
                            )
                        )}
                        <span className="relative z-10 flex items-center justify-center gap-2">
                            <User className="w-4 h-4" />
                            {t('profilePage.tabs.me')}
                        </span>
                    </button>
                    <button
                        onClick={() => hasPartner && setActiveTab('us')}
                        disabled={!hasPartner}
                        className={`relative flex-1 rounded-full px-3 py-2.5 text-sm font-bold transition-colors ${activeTab === 'us'
                            ? 'text-amber-700'
                            : hasPartner ? 'text-neutral-500' : 'text-neutral-500 opacity-60 cursor-not-allowed'
                            }`}
                    >
                        {activeTab === 'us' && (
                            prefersReducedMotion ? (
                                <span className="absolute inset-0 rounded-full border border-amber-200/70 bg-amber-100/80 shadow-soft" />
                            ) : (
                                <Motion.span
                                    layoutId="profileTab"
                                    className="absolute inset-0 rounded-full border border-amber-200/70 bg-amber-100/80 shadow-soft"
                                />
                            )
                        )}
                        <span className="relative z-10 flex items-center justify-center gap-2">
                            {!hasPartner && <Lock className="w-3.5 h-3.5" />}
                            {t('profilePage.tabs.us')}
                        </span>
                    </button>
                </div>

                <AnimatePresence mode={prefersReducedMotion ? 'sync' : 'wait'}>
                    {activeTab === 'me' ? (
                        <Motion.div
                            key="me"
                            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 20 }}
                            className="space-y-4"
                        >
                            {/* Profile Card with Stats */}
                            <ProfileCard
                                profileData={profileData}
                                currentUser={currentUser}
                                selectedLoveLanguage={selectedLoveLanguage}
                                onEditClick={() => setShowEditModal(true)}
                                onSignOut={signOut}
                                totalCases={userStats?.cases_resolved ?? totalCases}
                                totalAppreciations={totalAppreciations}
                                questionsAnswered={userStats?.questions_completed ?? questionsAnswered}
                            />

                            {/* Subscription Card */}
                            <Motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.28 }}
                                className={`glass-card relative overflow-hidden p-5 ${isGold
                                    ? 'border border-amber-200/70'
                                    : 'border border-white/80'
                                    }`}
                            >
                                <div className="absolute inset-0 pointer-events-none">
                                    <div className="absolute -top-8 -right-6 h-20 w-20 rounded-full bg-amber-200/35 blur-2xl" />
                                    <div className="absolute -bottom-10 -left-8 h-24 w-24 rounded-full bg-rose-200/30 blur-2xl" />
                                </div>
                                <div className="relative flex items-center gap-3 mb-4">
                                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${isGold
                                        ? 'bg-gradient-to-br from-[#C9A227] to-[#8B7019]'
                                        : 'bg-gradient-to-br from-neutral-300 to-neutral-400'
                                        }`}>
                                        <Crown className="w-6 h-6 text-white" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-display font-bold text-neutral-800">
                                                {isGold ? t('profilePage.subscription.goldPlan') : t('profilePage.subscription.freePlan')}
                                            </h3>
                                            {isGold && <Sparkles className="w-4 h-4 text-amber-500" />}
                                        </div>
                                        <p className="text-xs text-neutral-500">
                                            {isGold ? t('profilePage.subscription.goldSubtitle') : t('profilePage.subscription.freeSubtitle')}
                                        </p>
                                    </div>
                                </div>

                                {/* Usage Stats */}
                                <div className="space-y-2 mb-4">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="flex items-center gap-2 text-neutral-600">
                                            <Scale className="w-4 h-4 text-amber-600" />
                                            {t('profilePage.subscription.judgeMochi')}
                                        </span>
                                        <span className="font-medium text-neutral-700">{getUsageDisplay('classic', t)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="flex items-center gap-2 text-neutral-600">
                                            <Zap className="w-4 h-4 text-amber-600" />
                                            {t('profilePage.subscription.judgeDash')}
                                        </span>
                                        <span className="font-medium text-neutral-700">{getUsageDisplay('swift', t)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="flex items-center gap-2 text-neutral-600">
                                            <Gavel className="w-4 h-4 text-amber-600" />
                                            {t('profilePage.subscription.judgeWhiskers')}
                                        </span>
                                        <span className={`font-medium ${isGold ? 'text-neutral-700' : 'text-neutral-500'}`}>
                                            {isGold ? getUsageDisplay('wise', t) : t('profilePage.subscription.goldOnly')}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="flex items-center gap-2 text-neutral-600">
                                            <Wand2 className="w-4 h-4 text-amber-600" />
                                            {t('profilePage.subscription.helpMePlan')}
                                        </span>
                                        <span className={`font-medium ${isGold ? 'text-neutral-700' : 'text-neutral-500'}`}>
                                            {isGold ? t('profilePage.subscription.unlimited') : t('profilePage.subscription.goldOnly')}
                                        </span>
                                    </div>
                                </div>

                                {!isGold && (
                                    <Motion.button
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => setShowPaywall(true)}
                                        className="relative w-full overflow-hidden rounded-3xl border border-amber-200/70 bg-white/85 px-4 py-3 text-left shadow-soft"
                                    >
                                        <div className="absolute inset-x-6 top-0 h-1 bg-gradient-to-r from-transparent via-amber-300/70 to-transparent" />
                                        <div className="absolute -top-6 -right-4 h-16 w-16 rounded-full bg-amber-200/35 blur-2xl" />
                                        <div className="relative flex items-center gap-3">
                                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-200/70 bg-amber-100/70">
                                                <Crown className="w-5 h-5 text-amber-700" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-500">
                                                    {t('profilePage.subscription.upgradeKicker')}
                                                </div>
                                                <div className="text-sm font-bold text-neutral-800">{t('profilePage.subscription.upgradeTitle')}</div>
                                                <div className="text-xs text-neutral-500">{t('profilePage.subscription.upgradeSubtitle')}</div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <div className="rounded-full border border-amber-200/70 bg-amber-100/70 px-3 py-1 text-xs font-bold text-amber-700">
                                                    {upgradePriceLabel}
                                                </div>
                                                <div className="text-[10px] text-neutral-500">{t('profilePage.subscription.ctaHint')}</div>
                                            </div>
                                        </div>
                                    </Motion.button>
                                )}

                                {isGold && (
                                    <p className="text-center text-xs text-neutral-500">
                                        {t('profilePage.subscription.thanks')}
                                    </p>
                                )}
                            </Motion.div>

                            {/* Partner Connection */}
                            {!hasPartner && disconnectStatus?.status === 'disconnected' && (
                                <DisconnectNotice disconnectStatus={disconnectStatus} />
                            )}
                            <PartnerConnection
                                hasPartner={hasPartner}
                                profile={profile}
                                partner={connectedPartner}
                                loveLanguages={loveLanguages}
                            />

                        </Motion.div>
                    ) : (
                        <Motion.div
                            key="us"
                            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -20 }}
                            className="space-y-4"
                        >
                            {/* Relationship Card */}
                            <Motion.div className="glass-card relative overflow-hidden p-5 text-center">
                                <div className="absolute inset-0 pointer-events-none">
                                    <div className="absolute -top-10 -right-8 h-24 w-24 rounded-full bg-amber-200/35 blur-2xl" />
                                    <div className="absolute -bottom-12 -left-10 h-28 w-28 rounded-full bg-rose-200/30 blur-2xl" />
                                </div>
                                <div className="relative space-y-4">
                                    <div className="flex items-center justify-center gap-4">
                                        <ProfilePicture
                                            avatarUrl={profileData.avatarUrl}
                                            name={profileData.nickname || currentUser?.name}
                                            size="lg"
                                        />
                                        <Motion.div
                                            animate={prefersReducedMotion ? undefined : { scale: [1, 1.2, 1] }}
                                            transition={prefersReducedMotion ? undefined : { duration: 1.5, repeat: Infinity }}
                                            className="rounded-full border border-rose-200/70 bg-rose-100/70 px-3 py-1"
                                        >
                                            <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
                                        </Motion.div>
                                        <ProfilePicture
                                            avatarUrl={connectedPartner?.avatar_url}
                                            name={connectedPartner?.display_name}
                                            size="lg"
                                        />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-neutral-500">
                                            {t('profilePage.relationship.kicker')}
                                        </p>
                                        <h2 className="text-lg font-display font-bold text-neutral-800">
                                            {profileData.nickname || profile?.display_name || currentUser?.name} & {connectedPartner?.display_name || t('common.partner')}
                                        </h2>
                                    </div>
                                    {profileData.anniversaryDate && (
                                        <p className="text-rose-600 text-sm flex items-center justify-center gap-1">
                                            <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                                            {t('profilePage.relationship.togetherSince', {
                                                date: new Date(profileData.anniversaryDate).toLocaleDateString(language, { month: 'long', year: 'numeric' })
                                            })}
                                        </p>
                                    )}
                                    {!profileData.anniversaryDate && hasPartner && (
                                        <p className="text-neutral-500 text-sm italic">
                                            {t('profilePage.relationship.anniversaryMissing')}
                                        </p>
                                    )}
                                </div>
                            </Motion.div>

                            {/* Level Progress - Our Story */}
                            {isXPEnabled && (
                                <LevelProgress
                                    level={level}
                                    currentXP={currentXP}
                                    xpForNextLevel={xpForNextLevel}
                                    title={title}
                                    compact={false}
                                />
                            )}

                            {/* Memories Preview */}
                            <div className="glass-card p-4 space-y-4 relative overflow-hidden border border-rose-200/70">
                                <div className="absolute inset-0 pointer-events-none">
                                    <div className="absolute -top-10 -right-8 h-28 w-28 rounded-full bg-rose-200/45 blur-2xl" />
                                    <div className="absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-amber-200/35 blur-2xl" />
                                    <div
                                        className="absolute inset-0 opacity-30"
                                        style={{ backgroundImage: 'linear-gradient(140deg, rgba(255,255,255,0.7) 0%, transparent 50%)' }}
                                    />
                                </div>
                                <div className="relative space-y-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-2xl bg-rose-100/80 border border-rose-200/60 flex items-center justify-center">
                                                <ImagePlus className="w-4 h-4 text-rose-600" />
                                            </div>
                                            <div>
                                                <h3 className="font-display font-bold text-neutral-800">{t('profilePage.memories.title')}</h3>
                                                <p className="text-xs text-neutral-500">{t('profilePage.memories.subtitle')}</p>
                                            </div>
                                        </div>
                                        <Motion.button
                                            whileTap={{ scale: 0.96 }}
                                            onClick={() => navigate('/memories')}
                                            className={`text-xs font-bold text-rose-600 rounded-full border border-rose-200/70 bg-rose-50/70 px-3 py-1 ${memoriesAvailable ? '' : 'opacity-60 cursor-not-allowed'}`}
                                            disabled={!memoriesAvailable}
                                        >
                                            {t('profilePage.memories.viewAll')}
                                        </Motion.button>
                                    </div>

                                    {!memoriesAvailable ? (
                                        <div className="rounded-2xl border border-dashed border-rose-200/70 bg-rose-50/70 px-3 py-3 text-xs text-rose-600">
                                            {t('profilePage.memories.unavailable')}
                                        </div>
                                    ) : (
                                        <>
                                            {deletedMemories?.length > 0 && (
                                                <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-2xl px-3 py-2">
                                                    {deletedMemories.length === 1
                                                        ? t('profilePage.memories.restoreOne', { count: deletedMemories.length })
                                                        : t('profilePage.memories.restoreOther', { count: deletedMemories.length })}
                                                </div>
                                            )}

                                            {memories.length === 0 ? (
                                                <Motion.button
                                                    whileTap={{ scale: 0.98 }}
                                                    onClick={() => navigate('/memories')}
                                                    className="w-full py-3 rounded-2xl border border-rose-200/70 bg-white/80 text-sm font-semibold text-rose-600"
                                                >
                                                    {t('profilePage.memories.emptyCta')}
                                                </Motion.button>
                                            ) : (
                                                <div className="grid grid-cols-2 gap-3">
                                                    {memories.slice(0, 4).map((memory) => (
                                                        <MemoryCard
                                                            key={memory.id}
                                                            memory={memory}
                                                            showMeta={false}
                                                            onClick={() => navigate('/memories')}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Challenges Preview */}
                            {isXPEnabled && (
                                <div className="glass-card p-4 space-y-4 relative overflow-hidden border border-amber-200/70">
                                    <div className="absolute inset-0 pointer-events-none">
                                        <div className="absolute -top-10 -right-8 h-28 w-28 rounded-full bg-amber-200/40 blur-2xl" />
                                        <div className="absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-rose-200/30 blur-2xl" />
                                        <div
                                            className="absolute inset-0 opacity-30"
                                            style={{ backgroundImage: 'linear-gradient(130deg, rgba(255,255,255,0.7) 0%, transparent 55%)' }}
                                        />
                                    </div>
                                    <div className="relative space-y-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-2xl bg-amber-100/80 border border-amber-200/60 flex items-center justify-center">
                                                    <Gavel className="w-4 h-4 text-amber-700" />
                                                </div>
                                                <div>
                                                    <h3 className="font-display font-bold text-neutral-800">{t('profilePage.challenges.title')}</h3>
                                                    <p className="text-xs text-neutral-500">{t('profilePage.challenges.subtitle')}</p>
                                                </div>
                                            </div>
                                            {showChallenges && (
                                                <Motion.button
                                                    whileTap={{ scale: 0.96 }}
                                                    onClick={() => navigate('/challenges')}
                                                    className="text-xs font-bold text-amber-700 rounded-full border border-amber-200/70 bg-amber-100/70 px-3 py-1"
                                                >
                                                    {t('profilePage.challenges.view')}
                                                </Motion.button>
                                            )}
                                        </div>

                                        {showChallenges ? (
                                            <>
                                                {challengesLoading && (
                                                    <div className="rounded-2xl border border-white/80 bg-white/80 px-3 py-3 text-xs text-neutral-500">
                                                        {t('profilePage.challenges.loading')}
                                                    </div>
                                                )}

                                                {!challengesLoading && activeChallengeCount > 0 && (
                                                    <div className="space-y-3">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-neutral-500">
                                                                {t('profilePage.challenges.activeNow')}
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[11px] font-bold text-amber-700 bg-amber-100/70 px-2.5 py-1 rounded-full">
                                                                    {t('profilePage.challenges.liveCount', { count: activeChallengeCount })}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div
                                                            ref={challengeTrackRef}
                                                            onScroll={handleChallengeScroll}
                                                            className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 -mx-2 px-2"
                                                        >
                                                            {activeChallenges.map((challenge, index) => {
                                                                const targetProgress = challenge.targetProgress || 3;
                                                                const currentProgress = challenge.currentProgress || 0;
                                                                const progress = targetProgress > 0
                                                                    ? Math.min((currentProgress / targetProgress) * 100, 100)
                                                                    : 0;
                                                                const rewardXP = challenge.rewardXP || 0;
                                                                const daysLeft = challenge.daysLeft ?? challenge.daysRemaining ?? 7;
                                                                const emoji = challenge.emoji;
                                                                const isActive = index === clampedActiveChallengeIndex;

                                                                return (
                                                                    <Motion.button
                                                                        key={challenge.id || `${challenge.title}-${index}`}
                                                                        type="button"
                                                                        data-challenge-card
                                                                        onClick={() => navigate('/challenges')}
                                                                        className="snap-center shrink-0 w-[250px] rounded-[28px] border border-white/80 bg-white/85 p-4 text-left shadow-soft relative overflow-hidden"
                                                                        animate={prefersReducedMotion ? undefined : { scale: isActive ? 1.02 : 0.97, y: isActive ? -6 : 0 }}
                                                                        transition={prefersReducedMotion ? { duration: 0.12 } : { type: 'spring', stiffness: 320, damping: 18, bounce: 0.4 }}
                                                                    >
                                                                        <div className="absolute inset-0 pointer-events-none">
                                                                            <div className="absolute -top-8 -right-6 h-16 w-16 rounded-full bg-amber-200/35 blur-2xl" />
                                                                            <div className="absolute -bottom-8 -left-6 h-20 w-20 rounded-full bg-rose-200/30 blur-2xl" />
                                                                        </div>
                                                                        <div className="relative space-y-3">
                                                                            <div className="flex items-start gap-3">
                                                                                <div className="h-10 w-10 rounded-2xl bg-amber-100/80 border border-amber-200/70 flex items-center justify-center">
                                                                                    {emoji ? (
                                                                                        <EmojiIcon emoji={emoji} className="w-5 h-5 text-amber-600" />
                                                                                    ) : (
                                                                                        <Target className="w-5 h-5 text-amber-600" />
                                                                                    )}
                                                                                </div>
                                                                                <div className="flex-1 space-y-1">
                                                                                    <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-neutral-500">
                                                                                        {t('profilePage.challenges.activeLabel', { number: index + 1 })}
                                                                                    </div>
                                                                                    <div className="text-sm font-display font-bold text-neutral-800">
                                                                                        {challenge.title || challenge.name || t('profilePage.challenges.fallbackTitle')}
                                                                                    </div>
                                                                                    <p className="text-[11px] text-neutral-500 leading-snug">
                                                                                        {challenge.description || t('profilePage.challenges.fallbackDescription')}
                                                                                    </p>
                                                                                </div>
                                                                            </div>

                                                                            <div className="space-y-2">
                                                                                <div className="flex items-center justify-between text-[11px] text-neutral-500">
                                                                                    <span>{t('profilePage.challenges.progress', { current: currentProgress, total: targetProgress })}</span>
                                                                                    <span className="font-semibold text-amber-700">{t('profilePage.challenges.reward', { xp: rewardXP })}</span>
                                                                                </div>
                                                                                <div className="h-2.5 rounded-full bg-white/80 shadow-inner-soft overflow-hidden">
                                                                                    <Motion.div
                                                                                        initial={false}
                                                                                        animate={{ scaleX: progress / 100 }}
                                                                                        transition={{ duration: 0.6, ease: 'easeOut' }}
                                                                                        style={{ transformOrigin: 'left center' }}
                                                                                        className="h-full rounded-full bg-gradient-to-r from-[#C9A227] to-[#8B7019]"
                                                                                    />
                                                                                </div>
                                                                                <div className="flex items-center justify-between text-[10px] text-neutral-500">
                                                                                    <span>{t('profilePage.challenges.daysLeft', { count: daysLeft })}</span>
                                                                                    {isActive && (
                                                                                        <span className="font-semibold text-amber-600">
                                                                                            {t('profilePage.challenges.current')}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </Motion.button>
                                                                );
                                                            })}
                                                        </div>

                                                        {activeChallengeCount > 1 && (
                                                            <div className="flex items-center justify-center gap-1.5">
                                                                {activeChallenges.map((_, index) => (
                                                                    <span
                                                                        key={`challenge-dot-${index}`}
                                                                        className={`h-1.5 w-1.5 rounded-full transition ${index === clampedActiveChallengeIndex
                                                                            ? 'bg-amber-500 shadow-[0_0_10px_rgba(251,146,60,0.6)]'
                                                                            : 'bg-amber-200/70'
                                                                            }`}
                                                                    />
                                                                ))}
                                                            </div>
                                                        )}

                                                        {availableChallengeCount > 0 && (
                                                            <div className="rounded-2xl border border-amber-200/70 bg-amber-50/70 px-3 py-2 text-[11px] text-amber-700 text-center">
                                                                {t('profilePage.challenges.moreWaiting', { count: availableChallengeCount })}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {!challengesLoading && activeChallengeCount === 0 && availableChallengeCount > 0 && (
                                                    <div className="rounded-2xl border border-white/80 bg-white/80 px-3 py-3 space-y-2">
                                                        <div className="text-xs font-semibold text-neutral-700">{t('profilePage.challenges.emptyActive')}</div>
                                                        <div className="text-[11px] text-neutral-500">
                                                            {availableChallengeCount === 1
                                                                ? t('profilePage.challenges.readyOne', { count: availableChallengeCount })
                                                                : t('profilePage.challenges.readyOther', { count: availableChallengeCount })}
                                                        </div>
                                                    </div>
                                                )}

                                                {!challengesLoading && activeChallengeCount === 0 && availableChallengeCount === 0 && (
                                                    <div className="rounded-2xl border border-white/80 bg-white/80 px-3 py-3 text-xs text-neutral-500">
                                                        {t('profilePage.challenges.none')}
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="rounded-2xl border border-dashed border-amber-200/70 bg-amber-50/70 px-3 py-3">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <div className="text-sm font-semibold text-amber-700">{t('profilePage.challenges.locked')}</div>
                                                        <p className="text-xs text-amber-600 mt-1">{unlockHint}</p>
                                                    </div>
                                                    <div className="text-xs font-bold text-amber-700 bg-white/70 px-2.5 py-1 rounded-full">
                                                        {t('profilePage.challenges.levelShort', { level })}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* AI Insights Preview */}
                            {isXPEnabled && (
                                <div className="glass-card p-4 space-y-4 relative overflow-hidden border border-sky-200/70">
                                    <div className="absolute inset-0 pointer-events-none">
                                        <div className="absolute -top-10 -right-8 h-28 w-28 rounded-full bg-sky-200/35 blur-2xl" />
                                        <div className="absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-teal-200/30 blur-2xl" />
                                        <div
                                            className="absolute inset-0 opacity-30"
                                            style={{ backgroundImage: 'linear-gradient(150deg, rgba(255,255,255,0.7) 0%, transparent 55%)' }}
                                        />
                                    </div>
                                    <div className="relative space-y-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-2xl bg-sky-100/80 border border-sky-200/60 flex items-center justify-center">
                                                    <Sparkles className="w-4 h-4 text-sky-600" />
                                                </div>
                                                <div>
                                                    <h3 className="font-display font-bold text-neutral-800">{t('profilePage.insights.title')}</h3>
                                                    <p className="text-xs text-neutral-500">{t('profilePage.insights.subtitle')}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {insightsUnlocked && (
                                                    <Motion.button
                                                        whileTap={{ scale: 0.96 }}
                                                        onClick={() => navigate('/insights')}
                                                        className="text-xs font-bold text-sky-700 rounded-full border border-sky-200/70 bg-sky-100/70 px-3 py-1"
                                                    >
                                                        {t('profilePage.insights.viewAll')}
                                                    </Motion.button>
                                                )}
                                                {needsGoldForInsights && (
                                                    <Motion.button
                                                        whileTap={{ scale: 0.96 }}
                                                        onClick={() => setShowPaywall(true)}
                                                        className="text-xs font-bold text-sky-700 rounded-full border border-sky-200/70 bg-sky-100/70 px-3 py-1"
                                                    >
                                                        {t('profilePage.insights.unlockGold')}
                                                    </Motion.button>
                                                )}
                                            </div>
                                        </div>

                                        {!showInsights && (
                                            <div className="rounded-2xl border border-dashed border-sky-200/70 bg-sky-50/70 px-3 py-3">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <div className="text-sm font-semibold text-sky-700">{t('profilePage.insights.locked')}</div>
                                                        <p className="text-xs text-sky-600 mt-1">{unlockHint}</p>
                                                    </div>
                                                    <div className="text-xs font-bold text-sky-700 bg-white/70 px-2.5 py-1 rounded-full">
                                                        {t('profilePage.insights.levelShort', { level })}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {needsGoldForInsights && (
                                            <div className="rounded-2xl border border-dashed border-sky-200/70 bg-sky-50/70 px-3 py-3">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <div className="text-sm font-semibold text-sky-700">{t('profilePage.insights.goldRequiredTitle')}</div>
                                                        <p className="text-xs text-sky-600 mt-1">{t('profilePage.insights.goldRequiredSubtitle')}</p>
                                                    </div>
                                                    <Crown className="w-5 h-5 text-sky-500" />
                                                </div>
                                            </div>
                                        )}

                                        {insightsUnlocked && (
                                            <div className="rounded-2xl border border-white/80 bg-white/80 p-3">
                                                {latestInsight ? (
                                                    <>
                                                        <div className="text-[11px] font-semibold text-sky-600 uppercase tracking-[0.2em] mb-2">
                                                            {latestInsight.category}
                                                        </div>
                                                        <p className="text-sm font-semibold text-neutral-700 mb-2">
                                                            {latestInsight.text}
                                                        </p>
                                                        {latestInsight.evidenceSummary && (
                                                            <p className="text-xs text-neutral-500">{latestInsight.evidenceSummary}</p>
                                                        )}
                                                    </>
                                                ) : (
                                                    <p className="text-xs text-neutral-500">
                                                        {t('profilePage.insights.empty')}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Milestones */}
                            <MilestonesSection
                                stats={{
                                    totalCases: userStats?.cases_resolved ?? totalCases,
                                    totalAppreciations,
                                    questionsAnswered: userStats?.questions_completed ?? questionsAnswered,
                                    partnerQuestionsAnswered,
                                    memoriesCount: memories?.length || 0,
                                    challengesCompleted: completedChallenges?.length || 0,
                                    calendarEventsCount: userCreatedCalendarEvents?.length || 0,
                                }}
                            />
                        </Motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Edit Profile Modal */}
            <AnimatePresence>
                {showEditModal && (
                    <ProfileEditForm
                        profileData={profileData}
                        loveLanguages={loveLanguages}
                        onSave={async (data) => {
                            await saveProfile(data);
                            setShowEditModal(false);
                        }}
                        onClose={() => setShowEditModal(false)}
                    />
                )}
            </AnimatePresence>

            {/* Paywall Modal */}
            <Paywall
                isOpen={showPaywall}
                onClose={() => setShowPaywall(false)}
            />
        </div>
    );
};

const ProfileBackdrop = () => (
    <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-amber-200/30 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-rose-200/25 blur-3xl" />
    </div>
);

const StatBar = ({ label, value, max, color }) => {
    const percentage = Math.min((value / max) * 100, 100);
    const colorClasses = {
        violet: 'from-amber-400 to-amber-500',
        pink: 'from-rose-400 to-rose-500',
        indigo: 'from-amber-300 to-amber-500',
        amber: 'from-amber-400 to-amber-500',
    };

    return (
        <div>
            <div className="flex justify-between text-xs mb-1">
                <span className="text-neutral-600">{label}</span>
                <span className="font-bold text-neutral-700">{value}</span>
            </div>
            <div className="h-2 bg-white/80 rounded-full overflow-hidden shadow-inner-soft">
                <Motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className={`h-full bg-gradient-to-r ${colorClasses[color]} rounded-full`}
                />
            </div>
        </div>
    );
};

export default ProfilesPage;
