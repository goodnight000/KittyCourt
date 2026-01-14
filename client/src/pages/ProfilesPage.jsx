import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    User, Heart, Settings, Lock, Crown, Sparkles, Zap, Gavel, Wand2, ImagePlus, Scale
} from 'lucide-react';
import useAppStore from '../store/useAppStore';
import useAuthStore from '../store/useAuthStore';
import usePartnerStore from '../store/usePartnerStore';
import useCacheStore, { CACHE_TTL, CACHE_KEYS } from '../store/useCacheStore';
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
import api from '../services/api';
import { useI18n } from '../i18n';

const ProfilesPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { t, language } = useI18n();
    const { currentUser, users, fetchAppreciations } = useAppStore();
    const { profile, signOut, refreshProfile, user: authUser } = useAuthStore();
    const { partner: connectedPartner, hasPartner, disconnectStatus } = usePartnerStore();
    const { isGold, usage, limits, getUsageDisplay, purchaseGold, restorePurchases, isLoading: subLoading } = useSubscriptionStore();
    const { level, currentXP, xpForNextLevel, title, fetchLevel, shouldShowChallenges, shouldShowInsights, serverAvailable } = useLevelStore();
    const { memories, deletedMemories, fetchMemories, serverAvailable: memoriesAvailable } = useMemoryStore();
    const { insights, consent, fetchInsights, updateConsent, serverAvailable: insightsAvailable } = useInsightsStore();
    const { active: activeChallenges, completed: completedChallenges, available: availableChallenges, isLoading: challengesLoading, fetchChallenges } = useChallengeStore();
    const latestInsight = insights?.[0] || null;
    const selfConsent = consent ? !!consent.selfConsent : true;
    const partnerConsent = consent ? !!consent.partnerConsent : true;
    const bothConsented = selfConsent && partnerConsent;
    const insightsPaused = consent?.selfPaused || consent?.partnerPaused;
    const showChallenges = shouldShowChallenges();
    const showInsights = shouldShowInsights();
    const insightsUnlocked = showInsights && isGold;
    const needsGoldForInsights = showInsights && !isGold;
    const partnerFromUsers = users?.find(u => u.id !== currentUser?.id);
    const isXPEnabled = import.meta.env.VITE_XP_SYSTEM_ENABLED === 'true';
    const unlockHint = t('profile.unlockHint');
    const activeChallengeCount = activeChallenges?.length || 0;
    const availableChallengeCount = availableChallenges?.length || 0;
    const loveLanguages = [
        { id: 'words', label: t('options.loveLanguage.words'), emoji: '💬' },
        { id: 'acts', label: t('options.loveLanguage.acts'), emoji: '🤲' },
        { id: 'gifts', label: t('options.loveLanguage.gifts'), emoji: '🎁' },
        { id: 'time', label: t('options.loveLanguage.time'), emoji: '⏰' },
        { id: 'touch', label: t('options.loveLanguage.touch'), emoji: '🤗' },
    ];

    // Use custom hook for profile data management
    const { profileData, saveProfile } = useProfileData();

    // Calendar events for milestones tracking (only user-created events, not defaults)
    const { events: calendarEvents } = useCalendarEvents(t);
    const userCreatedCalendarEvents = calendarEvents?.filter(e => !e.isDefault && !e.isPersonal) || [];

    const [showEditModal, setShowEditModal] = useState(false);
    const [activeTab, setActiveTab] = useState('me'); // 'me' or 'us'
    const [showPaywall, setShowPaywall] = useState(false);
    const [devXPLoading, setDevXPLoading] = useState(false);
    const [devXPMessage, setDevXPMessage] = useState('');
    const [activeChallengeIndex, setActiveChallengeIndex] = useState(0);
    const [userStats, setUserStats] = useState(null);
    const challengeTrackRef = useRef(null);
    const challengeCardWidthRef = useRef(0);

    useEffect(() => {
        fetchAppreciations();
        if (hasPartner) {
            fetchLevel();
        }
    }, [fetchAppreciations, hasPartner, fetchLevel, language]);

    // Fetch unified stats from /api/stats with caching
    useEffect(() => {
        const fetchStats = async () => {
            if (!authUser?.id) return;

            const cacheKey = `${CACHE_KEYS.STATS}:${authUser.id}`;

            // Check cache first
            const cached = useCacheStore.getState().getCached(cacheKey);
            if (cached !== null) {
                setUserStats(cached);
                return;
            }

            try {
                const response = await api.get('/stats');
                const stats = response.data;

                // Cache for 5 minutes
                useCacheStore.getState().setCache(cacheKey, stats, CACHE_TTL.STATS || 5 * 60 * 1000);
                setUserStats(stats);
            } catch (err) {
                console.error('Failed to fetch stats:', err);
            }
        };
        fetchStats();
    }, [authUser?.id]);

    useEffect(() => {
        if (!hasPartner || !memoriesAvailable) return;
        fetchMemories();
    }, [fetchMemories, hasPartner, memoriesAvailable]);

    useEffect(() => {
        if (!hasPartner || !isXPEnabled || !serverAvailable || !insightsAvailable || !showInsights || !isGold) return;
        fetchInsights();
    }, [fetchInsights, hasPartner, insightsAvailable, isXPEnabled, serverAvailable, showInsights, isGold]);

    useEffect(() => {
        if (location.state?.tab === 'us' || location.state?.tab === 'me') {
            setActiveTab(location.state.tab);
        }
    }, [location.state?.tab]);

    useEffect(() => {
        if (!hasPartner || !showChallenges) return;
        fetchChallenges();
    }, [fetchChallenges, hasPartner, showChallenges]);

    useEffect(() => {
        setActiveChallengeIndex(0);
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
        if (clampedIndex !== activeChallengeIndex) {
            setActiveChallengeIndex(clampedIndex);
        }
    };


    const awardDevXP = async (amount) => {
        if (!import.meta.env.DEV) return;
        if (!hasPartner) return;
        if (!isXPEnabled) return;
        if (devXPLoading) return;

        try {
            setDevXPLoading(true);
            setDevXPMessage('');
            await api.post('/levels/dev/award-xp', { amount });
            await fetchLevel();
            setDevXPMessage(t('profilePage.devTools.success', { amount }));
            setTimeout(() => setDevXPMessage(''), 2000);
        } catch (error) {
            console.error('[ProfilesPage] Dev XP award failed:', error);
            setDevXPMessage(t('profilePage.devTools.error'));
            setTimeout(() => setDevXPMessage(''), 3000);
        } finally {
            setDevXPLoading(false);
        }
    };

    // Unified stats from user_stats table (single source of truth)
    const totalCases = userStats?.cases_resolved ?? 0;
    const totalAppreciations = userStats?.appreciations_received ?? 0;
    const questionsAnswered = userStats?.questions_completed ?? 0;
    // Partner stats would need a separate fetch or couple stats endpoint
    const partnerQuestionsAnswered = 0; // Deprecated - use couple stats if needed

    // Get love language
    const selectedLoveLanguage = loveLanguages.find(l => l.id === profileData.loveLanguage);

    return (
        <div className="relative min-h-screen pb-6 overflow-hidden">
            <ProfileBackdrop />
            <div className="relative space-y-6">

                <header className="flex items-center gap-3">
                    <div className="flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-600">
                            {t('profilePage.header.kicker')}
                        </p>
                        <h1 className="text-2xl font-display font-bold text-neutral-800">{t('profilePage.header.title')}</h1>
                    </div>
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate('/settings')}
                        className="rounded-2xl border border-white/80 bg-white/80 p-2 shadow-soft"
                        aria-label={t('profilePage.header.settingsAria')}
                    >
                        <Settings className="w-5 h-5 text-neutral-600" />
                    </motion.button>
                </header>

                {/* Tab Switcher */}
                <div className="relative flex rounded-full border border-white/80 bg-white/75 p-1.5 shadow-inner-soft">
                    <button
                        onClick={() => setActiveTab('me')}
                        className={`relative flex-1 rounded-full px-3 py-2.5 text-sm font-bold transition-colors ${activeTab === 'me' ? 'text-white' : 'text-neutral-500'
                            }`}
                    >
                        {activeTab === 'me' && (
                            <motion.span
                                layoutId="profileTab"
                                className="absolute inset-0 rounded-full bg-gradient-to-r from-[#C9A227] to-[#8B7019] shadow-soft"
                            />
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
                            ? 'text-white'
                            : hasPartner ? 'text-neutral-500' : 'text-neutral-400 opacity-60 cursor-not-allowed'
                            }`}
                    >
                        {activeTab === 'us' && (
                            <motion.span
                                layoutId="profileTab"
                                className="absolute inset-0 rounded-full bg-gradient-to-r from-[#C9A227] to-[#8B7019] shadow-soft"
                            />
                        )}
                        <span className="relative z-10 flex items-center justify-center gap-2">
                            {!hasPartner && <Lock className="w-3.5 h-3.5" />}
                            {t('profilePage.tabs.us')}
                        </span>
                    </button>
                </div>

                <AnimatePresence mode="wait">
                    {activeTab === 'me' ? (
                        <motion.div
                            key="me"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
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
                            <motion.div
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
                                        <span className={`font-medium ${isGold ? 'text-neutral-700' : 'text-neutral-400'}`}>
                                            {isGold ? getUsageDisplay('wise', t) : t('profilePage.subscription.goldOnly')}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="flex items-center gap-2 text-neutral-600">
                                            <Wand2 className="w-4 h-4 text-amber-600" />
                                            {t('profilePage.subscription.helpMePlan')}
                                        </span>
                                        <span className={`font-medium ${isGold ? 'text-neutral-700' : 'text-neutral-400'}`}>
                                            {isGold ? t('profilePage.subscription.unlimited') : t('profilePage.subscription.goldOnly')}
                                        </span>
                                    </div>
                                </div>

                                {!isGold && (
                                    <motion.button
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
                                                    {t('profilePage.subscription.price')}
                                                </div>
                                                <div className="text-[10px] text-neutral-400">{t('profilePage.subscription.ctaHint')}</div>
                                            </div>
                                        </div>
                                    </motion.button>
                                )}

                                {isGold && (
                                    <p className="text-center text-xs text-neutral-500">
                                        {t('profilePage.subscription.thanks')}
                                    </p>
                                )}
                            </motion.div>

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

                        </motion.div>
                    ) : (
                        <motion.div
                            key="us"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-4"
                        >
                            {/* Relationship Card */}
                            <motion.div className="glass-card relative overflow-hidden p-5 text-center">
                                <div className="absolute inset-0 pointer-events-none">
                                    <div className="absolute -top-10 -right-8 h-24 w-24 rounded-full bg-amber-200/35 blur-2xl" />
                                    <div className="absolute -bottom-12 -left-10 h-28 w-28 rounded-full bg-rose-200/30 blur-3xl" />
                                </div>
                                <div className="relative space-y-4">
                                    <div className="flex items-center justify-center gap-4">
                                        <ProfilePicture
                                            avatarUrl={profileData.avatarUrl}
                                            name={profileData.nickname || currentUser?.name}
                                            size="lg"
                                        />
                                        <motion.div
                                            animate={{ scale: [1, 1.2, 1] }}
                                            transition={{ duration: 1.5, repeat: Infinity }}
                                            className="rounded-full border border-rose-200/70 bg-rose-100/70 px-3 py-1 text-lg"
                                        >
                                            💕
                                        </motion.div>
                                        <ProfilePicture
                                            avatarUrl={connectedPartner?.avatar_url}
                                            name={connectedPartner?.display_name}
                                            size="lg"
                                        />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-neutral-400">
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
                                        <p className="text-neutral-400 text-sm italic">
                                            {t('profilePage.relationship.anniversaryMissing')}
                                        </p>
                                    )}
                                </div>
                            </motion.div>

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

                            {import.meta.env.DEV && isXPEnabled && hasPartner && (
                                <div className="glass-card p-3 border border-neutral-200/60">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <div className="text-xs font-bold text-neutral-700">{t('profilePage.devTools.title')}</div>
                                            <div className="text-[11px] text-neutral-500">{t('profilePage.devTools.subtitle')}</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {devXPMessage && (
                                                <div className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-full">
                                                    {devXPMessage}
                                                </div>
                                            )}
                                            <motion.button
                                                whileTap={{ scale: 0.97 }}
                                                onClick={() => awardDevXP(250)}
                                                disabled={devXPLoading}
                                                className={`text-xs font-bold text-white px-3 py-2 rounded-xl shadow-soft ${devXPLoading ? 'opacity-70' : ''}`}
                                                style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
                                            >
                                                {devXPLoading ? t('profilePage.devTools.adding') : t('profilePage.devTools.addXp', { amount: 250 })}
                                            </motion.button>
                                        </div>
                                    </div>
                                </div>
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
                                        <motion.button
                                            whileTap={{ scale: 0.96 }}
                                            onClick={() => navigate('/memories')}
                                            className={`text-xs font-bold text-rose-600 rounded-full border border-rose-200/70 bg-rose-50/70 px-3 py-1 ${memoriesAvailable ? '' : 'opacity-60 cursor-not-allowed'}`}
                                            disabled={!memoriesAvailable}
                                        >
                                            {t('profilePage.memories.viewAll')}
                                        </motion.button>
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
                                                <motion.button
                                                    whileTap={{ scale: 0.98 }}
                                                    onClick={() => navigate('/memories')}
                                                    className="w-full py-3 rounded-2xl border border-rose-200/70 bg-white/80 text-sm font-semibold text-rose-600"
                                                >
                                                    {t('profilePage.memories.emptyCta')}
                                                </motion.button>
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
                                                <motion.button
                                                    whileTap={{ scale: 0.96 }}
                                                    onClick={() => navigate('/challenges')}
                                                    className="text-xs font-bold text-amber-700 rounded-full border border-amber-200/70 bg-amber-100/70 px-3 py-1"
                                                >
                                                    {t('profilePage.challenges.view')}
                                                </motion.button>
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
                                                            <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-neutral-400">
                                                                {t('profilePage.challenges.activeNow')}
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {activeChallengeCount > 1 && (
                                                                    <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-500">
                                                                        {t('profilePage.challenges.swipe')}
                                                                    </span>
                                                                )}
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
                                                                const emoji = challenge.emoji || '🎯';
                                                                const isActive = index === activeChallengeIndex;

                                                                return (
                                                                    <motion.button
                                                                        key={challenge.id || `${challenge.title}-${index}`}
                                                                        type="button"
                                                                        data-challenge-card
                                                                        onClick={() => navigate('/challenges')}
                                                                        className="snap-center shrink-0 w-[250px] rounded-[28px] border border-white/80 bg-white/85 p-4 text-left shadow-soft relative overflow-hidden"
                                                                        animate={{ scale: isActive ? 1.02 : 0.97, y: isActive ? -6 : 0 }}
                                                                        transition={{ type: 'spring', stiffness: 320, damping: 18, bounce: 0.4 }}
                                                                    >
                                                                        <div className="absolute inset-0 pointer-events-none">
                                                                            <div className="absolute -top-8 -right-6 h-16 w-16 rounded-full bg-amber-200/35 blur-2xl" />
                                                                            <div className="absolute -bottom-8 -left-6 h-20 w-20 rounded-full bg-rose-200/30 blur-2xl" />
                                                                        </div>
                                                                        <div className="relative space-y-3">
                                                                            <div className="flex items-start gap-3">
                                                                                <div className="h-10 w-10 rounded-2xl bg-amber-100/80 border border-amber-200/70 flex items-center justify-center text-lg">
                                                                                    {emoji}
                                                                                </div>
                                                                                <div className="flex-1 space-y-1">
                                                                                    <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-neutral-400">
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
                                                                                    <motion.div
                                                                                        initial={{ width: 0 }}
                                                                                        animate={{ width: `${progress}%` }}
                                                                                        transition={{ duration: 0.6, ease: 'easeOut' }}
                                                                                        className="h-full rounded-full bg-gradient-to-r from-[#C9A227] to-[#8B7019]"
                                                                                    />
                                                                                </div>
                                                                                <div className="flex items-center justify-between text-[10px] text-neutral-400">
                                                                                    <span>{t('profilePage.challenges.daysLeft', { count: daysLeft })}</span>
                                                                                    <span className="font-semibold text-amber-600">
                                                                                        {isActive ? t('profilePage.challenges.current') : t('profilePage.challenges.swipe')}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </motion.button>
                                                                );
                                                            })}
                                                        </div>

                                                        {activeChallengeCount > 1 && (
                                                            <div className="flex items-center justify-center gap-1.5">
                                                                {activeChallenges.map((_, index) => (
                                                                    <span
                                                                        key={`challenge-dot-${index}`}
                                                                        className={`h-1.5 w-1.5 rounded-full transition ${index === activeChallengeIndex
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
                                                    <motion.button
                                                        whileTap={{ scale: 0.96 }}
                                                        onClick={() => navigate('/insights')}
                                                        className="text-xs font-bold text-sky-700 rounded-full border border-sky-200/70 bg-sky-100/70 px-3 py-1"
                                                    >
                                                        {t('profilePage.insights.viewAll')}
                                                    </motion.button>
                                                )}
                                                {needsGoldForInsights && (
                                                    <motion.button
                                                        whileTap={{ scale: 0.96 }}
                                                        onClick={() => setShowPaywall(true)}
                                                        className="text-xs font-bold text-sky-700 rounded-full border border-sky-200/70 bg-sky-100/70 px-3 py-1"
                                                    >
                                                        {t('profilePage.insights.unlockGold')}
                                                    </motion.button>
                                                )}
                                                {insightsUnlocked && (
                                                    <motion.button
                                                        whileTap={{ scale: 0.96 }}
                                                        onClick={() => updateConsent(!selfConsent)}
                                                        className="text-xs font-bold text-sky-700 bg-sky-100/70 px-2.5 py-1 rounded-full"
                                                    >
                                                        {selfConsent ? t('profilePage.insights.optOut') : t('profilePage.insights.turnOn')}
                                                    </motion.button>
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

                                        {insightsUnlocked && !selfConsent && (
                                            <div className="rounded-2xl border border-sky-200/70 bg-sky-50/70 p-3 text-xs text-sky-700">
                                                {t('profilePage.insights.off')}
                                            </div>
                                        )}

                                        {insightsUnlocked && selfConsent && !partnerConsent && (
                                            <div className="rounded-2xl border border-sky-200/70 bg-sky-50/70 p-3 text-xs text-sky-700">
                                                {t('profilePage.insights.waitingPartner')}
                                            </div>
                                        )}

                                        {insightsUnlocked && bothConsented && insightsPaused && (
                                            <div className="rounded-2xl border border-sky-200/70 bg-sky-50/70 p-3 text-xs text-sky-700">
                                                {t('profilePage.insights.paused')}
                                            </div>
                                        )}

                                        {insightsUnlocked && bothConsented && !insightsPaused && (
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
                        </motion.div>
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
    <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -right-16 h-56 w-56 rounded-full bg-amber-200/30 blur-3xl" />
        <div className="absolute top-16 -left-20 h-60 w-60 rounded-full bg-rose-200/25 blur-3xl" />
        <div className="absolute bottom-6 right-8 h-64 w-64 rounded-full bg-amber-100/40 blur-3xl" />
        <div
            className="absolute inset-0 opacity-45"
            style={{
                backgroundImage:
                    'radial-gradient(circle at 18% 20%, rgba(255,255,255,0.75) 0%, transparent 55%), radial-gradient(circle at 80% 10%, rgba(255,235,210,0.8) 0%, transparent 60%)'
            }}
        />
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
                <motion.div
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
