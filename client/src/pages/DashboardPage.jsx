import React, { useState, useEffect } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Heart, Sparkles, X, Check, Lock, BookOpen, Flame, ArrowRight } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import useAuthStore from '../store/useAuthStore';
import useCacheStore, { CACHE_TTL, CACHE_KEYS } from '../store/useCacheStore';
import api from '../services/api';
import ProfilePicture from '../components/ProfilePicture';

const DashboardPage = () => {
    const navigate = useNavigate();
    const { currentUser, logGoodDeed } = useAppStore();
    const { hasPartner, profile, partner: connectedPartner, user: authUser } = useAuthStore();
    const [showGoodDeedModal, setShowGoodDeedModal] = useState(false);
    const [questionStreak, setQuestionStreak] = useState(0);
    const [todaysQuestion, setTodaysQuestion] = useState(null);
    const [questionLoading, setQuestionLoading] = useState(true);

    // Get partner name - prefer connected partner from auth store
    const partnerName = connectedPartner?.display_name || 'Partner';
    // Get current user's display name
    const myName = profile?.display_name || currentUser?.display_name || currentUser?.name || 'Me';
    // Get profile pictures

    const [goodDeedText, setGoodDeedText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    // Fetch question streak with caching
    useEffect(() => {
        const fetchStreak = async () => {
            if (!authUser?.id || !connectedPartner?.id) return;

            const cacheKey = `${CACHE_KEYS.STREAK}:${authUser.id}:${connectedPartner.id}`;

            // Check cache first
            const cached = useCacheStore.getState().getCached(cacheKey);
            if (cached !== null) {
                setQuestionStreak(cached);
                return;
            }

            try {
                const response = await api.get('/daily-questions/history', {
                    params: { userId: authUser.id, partnerId: connectedPartner.id }
                });
                const history = response.data || [];
                const completed = history.filter(q => q.my_answer && q.partner_answer);
                if (completed.length === 0) {
                    useCacheStore.getState().setCache(cacheKey, 0, CACHE_TTL.STREAK);
                    setQuestionStreak(0);
                    return;
                }

                const parseDay = (day) => new Date(`${day}T00:00:00`);
                const sorted = [...completed].sort((a, b) => parseDay(b.assigned_date) - parseDay(a.assigned_date));

                const msPerDay = 1000 * 60 * 60 * 24;
                let streak = 1;
                for (let i = 1; i < sorted.length; i++) {
                    const prev = parseDay(sorted[i - 1].assigned_date);
                    const curr = parseDay(sorted[i].assigned_date);
                    const diffDays = Math.round((prev - curr) / msPerDay);
                    if (diffDays === 1) streak++;
                    else break;
                }

                // Cache the calculated streak
                useCacheStore.getState().setCache(cacheKey, streak, CACHE_TTL.STREAK);
                setQuestionStreak(streak);
            } catch (err) {
                console.error('Failed to fetch streak:', err);
            }
        };
        fetchStreak();
    }, [authUser?.id, connectedPartner?.id]);

    // Fetch today's question for dashboard preview (with caching)
    useEffect(() => {
        const fetchTodaysQuestion = async () => {
            if (!authUser?.id || !connectedPartner?.id) {
                setQuestionLoading(false);
                return;
            }

            const cacheKey = `${CACHE_KEYS.DAILY_QUESTION}:${authUser.id}:${connectedPartner.id}`;

            // Check cache first
            const cached = useCacheStore.getState().getCached(cacheKey);
            if (cached !== null) {
                setTodaysQuestion(cached);
                setQuestionLoading(false);
                return;
            }

            try {
                setQuestionLoading(true);
                const response = await api.get('/daily-questions/today', {
                    params: { userId: authUser.id, partnerId: connectedPartner.id }
                });
                // Cache for 2 minutes (shorter TTL since this can change when partner answers)
                useCacheStore.getState().setCache(cacheKey, response.data, 2 * 60 * 1000);
                setTodaysQuestion(response.data);
            } catch (err) {
                console.error('Failed to fetch daily question:', err);
            } finally {
                setQuestionLoading(false);
            }
        };
        fetchTodaysQuestion();
    }, [authUser?.id, connectedPartner?.id]);

    // Calculate actual days together from anniversary date (prefer Supabase profile)
    const getDaysTogether = () => {
        // Prefer anniversary from Supabase profile
        let anniversaryDate = profile?.anniversary_date;

        // Fallback to localStorage
        if (!anniversaryDate) {
            const currentUserProfile = localStorage.getItem(`catjudge_profile_${currentUser?.id}`);
            if (currentUserProfile) {
                const parsed = JSON.parse(currentUserProfile);
                if (parsed.anniversaryDate) anniversaryDate = parsed.anniversaryDate;
            }
        }

        if (!anniversaryDate) return null;

        const start = new Date(anniversaryDate);
        const today = new Date();
        const diffTime = today.getTime() - start.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return diffDays >= 0 ? diffDays : null;
    };

    const daysTogether = getDaysTogether();

    const handleLogGoodDeed = async () => {
        if (!goodDeedText.trim()) return;
        setIsSubmitting(true);
        try {
            await logGoodDeed(goodDeedText);
            setShowSuccess(true);
            setGoodDeedText('');
            setTimeout(() => {
                setShowSuccess(false);
                setShowGoodDeedModal(false);
            }, 1500);
        } catch (error) {
            console.error('Failed to log good deed:', error);
        }
        setIsSubmitting(false);
    };

    const goodDeedSuggestions = [
        "Made me breakfast ☕",
        "Did the dishes 🍽️",
        "Gave me a massage 💆",
        "Said something sweet 💕",
        "Surprised me 🎁",
    ];

    // Derive answer states
    const hasAnswered = !!todaysQuestion?.my_answer;
    // Use partner_has_answered flag from API (shows status even before we answer, content remains hidden)
    const partnerHasAnswered = !!todaysQuestion?.partner_has_answered || !!todaysQuestion?.partner_answer;
    const bothAnswered = hasAnswered && partnerHasAnswered;
    // Avatar URLs now come from database (either preset path or Storage URL)
    // ProfilePicture component handles fallbacks
    const myAvatarUrl = profile?.avatar_url;
    const partnerAvatarUrl = connectedPartner?.avatar_url;
    const showPartnerPrompt = !hasPartner;
    const todayLabel = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
    });
    const quickActions = [
        {
            key: 'appreciate',
            label: 'Appreciate',
            detail: 'Send kibble',
            icon: '/assets/icons/appreicate.png',
            onClick: () => hasPartner ? setShowGoodDeedModal(true) : navigate('/connect'),
            locked: !hasPartner,
            accent: 'rose',
        },
        {
            key: 'love-notes',
            label: 'Love Notes',
            detail: 'Your ledger',
            icon: '/assets/icons/love_notes.png',
            onClick: () => navigate('/appreciations'),
            locked: false,
            accent: 'amber',
        },
        {
            key: 'cases',
            label: 'Cases',
            detail: 'Trial history',
            icon: '/assets/icons/cases.png',
            onClick: () => navigate('/history'),
            locked: false,
            accent: 'violet',
        },
        {
            key: 'redeem',
            label: 'Redeem',
            detail: 'Spend kibble',
            icon: '/assets/icons/redeem.png',
            onClick: () => navigate('/economy'),
            locked: false,
            accent: 'mint',
        },
    ];
    return (
        <div className="relative min-h-screen overflow-hidden pb-6">
            <HomeBackdrop />
            <div className="relative space-y-6">
                <Motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card relative overflow-hidden p-5"
                >
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute -top-16 -right-10 h-32 w-32 rounded-full bg-rose-200/40 blur-3xl" />
                        <div className="absolute -bottom-12 -left-10 h-36 w-36 rounded-full bg-amber-200/35 blur-3xl" />
                        <div
                            className="absolute inset-0 opacity-40"
                            style={{
                                backgroundImage:
                                    'radial-gradient(circle at 15% 20%, rgba(255,255,255,0.75) 0%, transparent 55%), radial-gradient(circle at 85% 10%, rgba(255,235,210,0.7) 0%, transparent 60%)'
                            }}
                        />
                    </div>
                    <div className="relative space-y-4">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <div className="text-[11px] uppercase tracking-[0.35em] text-neutral-400 font-semibold">
                                    {todayLabel}
                                </div>
                                <h1 className="text-2xl font-display font-bold text-neutral-800">
                                    Welcome back, {myName}
                                </h1>
                                <p className="text-xs text-neutral-500 mt-1">
                                    Your story with {showPartnerPrompt ? 'your partner' : partnerName} keeps growing.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <Motion.button
                                whileTap={{ scale: 0.98 }}
                                onClick={() => navigate('/profile')}
                                className="relative overflow-hidden rounded-2xl border border-rose-200/70 bg-white/85 px-3 py-3 text-left shadow-inner-soft"
                            >
                                <div className="absolute -top-8 -right-6 h-16 w-16 rounded-full bg-rose-200/40 blur-2xl" />
                                <div className="relative">
                                    <div className="flex items-center justify-between">
                                        <Heart className="w-4 h-4 text-rose-500 fill-current" />
                                        <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-400">
                                            Days
                                        </span>
                                    </div>
                                    <div className="text-2xl font-display font-bold text-neutral-800 mt-2">
                                        {daysTogether !== null ? daysTogether : '?'}
                                    </div>
                                    <div className="text-[11px] text-neutral-500">Days together</div>
                                </div>
                            </Motion.button>

                            <Motion.button
                                whileTap={{ scale: 0.98 }}
                                onClick={() => navigate(hasPartner ? '/daily-meow/history' : '/connect')}
                                className="relative overflow-hidden rounded-2xl border border-amber-200/70 bg-white/85 px-3 py-3 text-left shadow-inner-soft"
                            >
                                <div className="absolute -top-8 -right-6 h-16 w-16 rounded-full bg-amber-200/40 blur-2xl" />
                                <div className="relative">
                                    <div className="flex items-center justify-between">
                                        <Flame className="w-4 h-4 text-amber-500 fill-current" />
                                        <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-400">
                                            Streak
                                        </span>
                                    </div>
                                    <div className="text-2xl font-display font-bold text-neutral-800 mt-2">
                                        {questionStreak}
                                    </div>
                                    <div className="text-[11px] text-neutral-500">Question streak</div>
                                </div>
                            </Motion.button>
                        </div>

                        {showPartnerPrompt && (
                            <div className="rounded-2xl border border-dashed border-neutral-200 bg-white/70 px-3 py-2 text-xs text-neutral-500">
                                Connect with your partner to unlock shared streaks and story milestones.
                            </div>
                        )}
                    </div>
                </Motion.div>

                {/* Daily Question Card - Full Width, Dynamic States */}
                <Motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    whileTap={{ scale: 0.995 }}
                    onClick={() => navigate(hasPartner ? '/daily-meow' : '/connect')}
                    className="relative overflow-hidden rounded-[32px] cursor-pointer shadow-xl flex-1 min-h-[260px] flex flex-col"
                >
                    {/* Background Image */}
                    <img
                        src="/assets/butons/dailyQ-template.png"
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                    />

                    {/* Dark overlay for better text readability */}
                    <div className="absolute inset-0 bg-black/10" />

                    {bothAnswered && (
                        <Motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="absolute inset-0 overflow-hidden pointer-events-none"
                        >
                            <Sparkles className="absolute top-6 right-16 w-5 h-5 text-white/40 animate-pulse" />
                            <Sparkles className="absolute top-12 right-8 w-4 h-4 text-white/30 animate-pulse" style={{ animationDelay: '0.5s' }} />
                            <Sparkles className="absolute bottom-20 right-12 w-4 h-4 text-white/30 animate-pulse" style={{ animationDelay: '1s' }} />
                        </Motion.div>
                    )}

                    <div className="relative z-10 p-6 flex flex-col h-full items-center justify-center text-center">
                        {showPartnerPrompt ? (
                            <>
                                <div className="mb-4">
                                    <span className="px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-white/80 text-[#8B6F47] backdrop-blur-sm border border-white/60">
                                        Connect to unlock
                                    </span>
                                </div>
                                <h3 className="text-xl font-bold text-[#4A3728] mb-5 leading-snug max-w-sm mx-auto" style={{ fontFamily: 'var(--font-display), Quicksand, sans-serif' }}>
                                    Connect with your partner now to access this feature!
                                </h3>
                                <div className="flex items-center justify-center">
                                    <div className="flex items-center gap-2 pl-2 pr-4 py-2 rounded-full bg-white/80 border border-white/70 shadow-sm translate-x-3">
                                        <ProfilePicture
                                            avatarUrl={myAvatarUrl}
                                            name={myName}
                                            size="sm"
                                            className="rounded-full"
                                        />
                                        <div className="text-left">
                                            <p className="text-[10px] font-bold leading-tight text-neutral-700">You</p>
                                            <p className="text-[9px] leading-tight text-neutral-400">Ready</p>
                                        </div>
                                    </div>
                                    <div className="relative z-20 mx-[-6px]">
                                        <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-sm border-[3px] border-[#8B6F47]/60">
                                            <Heart className="w-3.5 h-3.5 text-[#8B6F47]" />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 pl-4 pr-2 py-2 rounded-full bg-white/60 border border-white/70 shadow-sm -translate-x-3">
                                        <div className="w-8 h-8 rounded-full border-2 border-dashed border-neutral-300 bg-white/70" />
                                        <div className="text-left">
                                            <p className="text-[10px] font-bold leading-tight text-neutral-600">Partner</p>
                                            <p className="text-[9px] leading-tight text-neutral-400">Not connected</p>
                                        </div>
                                    </div>
                                </div>
                                <p className="mt-4 text-xs text-neutral-500">Tap to connect</p>
                            </>
                        ) : (
                            <>
                                {/* Header Badge */}
                                <div className="mb-4">
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-[#8B6F47]/80 text-white backdrop-blur-sm border border-[#6B5635]/30`}>
                                        {bothAnswered ? 'Completed' : hasAnswered ? 'Waiting for Partner' : 'Daily Question'}
                                    </span>
                                </div>

                                {/* Question Text */}
                                <h3 className="text-2xl font-bold text-[#4A3728] mb-6 leading-tight max-w-sm mx-auto" style={{ fontFamily: 'var(--font-display), Quicksand, sans-serif' }}>
                                    {questionLoading ? 'Loading...' : (todaysQuestion?.question || "What's on your mind today?")}
                                </h3>

                                {/* Status Indicators - Fully Rounded Capsule Pills with Overlapping Heart */}
                                <div className="flex items-center justify-center">
                                    {/* User Status Pill - Using warm brown to match parchment */}
                                    <div className={`flex items-center gap-2 pl-2 pr-5 py-2 rounded-full relative z-0 translate-x-3 ${hasAnswered ? 'bg-white' : 'bg-[#8B6F47]'}`}>
                                        {/* User Avatar */}
                                        <ProfilePicture
                                            avatarUrl={myAvatarUrl}
                                            name={myName}
                                            size="sm"
                                            className="rounded-full"
                                        />
                                        <div className="text-left">
                                            <p className={`text-[10px] font-bold leading-tight ${hasAnswered ? 'text-neutral-800' : 'text-white'}`}>
                                                You: {hasAnswered ? '✓' : ''}
                                            </p>
                                            <p className={`text-[9px] leading-tight ${hasAnswered ? 'text-neutral-500' : 'text-white/70'}`}>
                                                {hasAnswered ? 'Answered' : 'Waiting...'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Heart Connector - Overlaps both pills */}
                                    <div className="relative z-20 mx-[-6px]">
                                        <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-sm border-[3px] border-[#8B6F47]">
                                            <Heart className={`w-3.5 h-3.5 ${bothAnswered ? 'text-[#6B5635] fill-current' : 'text-[#8B6F47]'}`} />
                                        </div>
                                    </div>

                                    {/* Partner Status Pill - Using warm brown to match parchment */}
                                    <div className={`flex items-center gap-2 pl-5 pr-2 py-2 rounded-full relative z-0 -translate-x-3 ${partnerHasAnswered ? 'bg-white' : 'bg-[#8B6F47]'}`}>
                                        <div className="text-right">
                                            <p className={`text-[10px] font-bold leading-tight ${partnerHasAnswered ? 'text-neutral-800' : 'text-white'}`}>
                                                {partnerName?.split(' ')[0]}: {partnerHasAnswered ? '✓' : ''}
                                            </p>
                                            <p className={`text-[9px] leading-tight ${partnerHasAnswered ? 'text-neutral-500' : 'text-white/70'}`}>
                                                {partnerHasAnswered ? 'Answered' : (
                                                    <span className="inline-flex items-center">
                                                        Waiting
                                                        <Motion.span
                                                            animate={{ opacity: [0, 1, 0] }}
                                                            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                                                        >.</Motion.span>
                                                        <Motion.span
                                                            animate={{ opacity: [0, 1, 0] }}
                                                            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
                                                        >.</Motion.span>
                                                        <Motion.span
                                                            animate={{ opacity: [0, 1, 0] }}
                                                            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
                                                        >.</Motion.span>
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                        {/* Partner Avatar */}
                                        <ProfilePicture
                                            avatarUrl={partnerAvatarUrl}
                                            name={partnerName}
                                            size="sm"
                                            className="rounded-full"
                                        />
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </Motion.div>

                {/* Quick Actions - Story Shelf */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="font-bold text-neutral-700 text-sm">Quick Actions</h3>
                        <span className="text-[10px] uppercase tracking-[0.3em] text-neutral-400">Shortcuts</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {quickActions.map((action) => (
                            <ActionTile
                                key={action.key}
                                icon={action.icon}
                                label={action.label}
                                detail={action.detail}
                                locked={action.locked}
                                accent={action.accent}
                                onClick={action.onClick}
                            />
                        ))}
                    </div>
                </div>

                {/* Question Archives - Immersive Banner */}
                <Motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate(hasPartner ? '/daily-meow/history' : '/connect')}
                    className="glass-card relative overflow-hidden cursor-pointer border border-amber-200/60"
                >
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute -top-10 -right-8 h-24 w-24 rounded-full bg-amber-200/35 blur-2xl" />
                        <div className="absolute -bottom-12 -left-10 h-28 w-28 rounded-full bg-rose-200/30 blur-3xl" />
                        <div
                            className="absolute inset-0 opacity-40"
                            style={{ backgroundImage: 'linear-gradient(130deg, rgba(255,255,255,0.7) 0%, transparent 60%)' }}
                        />
                    </div>
                    <div className="relative flex items-center gap-4 p-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-amber-100 to-amber-200 rounded-xl flex items-center justify-center shadow-soft border border-amber-200/50">
                            <BookOpen className="w-6 h-6 text-amber-600" />
                        </div>
                        <div className="flex-1">
                            <div className="text-[10px] uppercase tracking-[0.35em] text-neutral-400 font-semibold">
                                Question Archives
                            </div>
                            <h3 className="font-bold text-neutral-800 text-sm">Relive your best answers</h3>
                            <p className="text-neutral-500 text-xs mt-0.5">Time travel to your shared memories.</p>
                        </div>
                        {!hasPartner && (
                            <div className="w-7 h-7 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center">
                                <Lock className="w-3.5 h-3.5 text-neutral-400" />
                            </div>
                        )}
                        {hasPartner && <ArrowRight className="w-5 h-5 text-neutral-400" />}
                    </div>
                </Motion.div>

                {/* Good Deed Modal */}
                <AnimatePresence>
                    {showGoodDeedModal && (
                        <Motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-end justify-center p-4 pb-20"
                            onClick={() => setShowGoodDeedModal(false)}
                        >
                            <Motion.div
                                initial={{ y: 100, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: 100, opacity: 0 }}
                                onClick={(e) => e.stopPropagation()}
                                className="relative overflow-hidden bg-white/95 rounded-[32px] w-full max-w-md p-5 space-y-4 shadow-soft-lg border border-white/80"
                            >
                                <div className="absolute inset-0 pointer-events-none">
                                    <div className="absolute -top-12 -right-6 h-28 w-28 rounded-full bg-rose-200/40 blur-3xl" />
                                    <div className="absolute -bottom-10 -left-8 h-24 w-24 rounded-full bg-amber-200/30 blur-3xl" />
                                    <div
                                        className="absolute inset-0 opacity-40"
                                        style={{
                                            backgroundImage:
                                                'radial-gradient(circle at 18% 20%, rgba(255,255,255,0.75) 0%, transparent 55%), radial-gradient(circle at 80% 10%, rgba(255,235,210,0.7) 0%, transparent 60%)'
                                        }}
                                    />
                                </div>
                                {showSuccess ? (
                                    <Motion.div
                                        initial={{ scale: 0.8 }}
                                        animate={{ scale: 1 }}
                                        className="relative text-center py-8"
                                    >
                                        <Motion.div
                                            animate={{ scale: [1, 1.2, 1] }}
                                            transition={{ duration: 0.5 }}
                                            className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner-soft border border-emerald-200/70"
                                        >
                                            <Check className="w-8 h-8 text-emerald-500" />
                                        </Motion.div>
                                        <h3 className="font-bold text-neutral-800 text-lg">{partnerName} got +10 Kibble! 🎉</h3>
                                        <p className="text-neutral-500 text-sm">Thanks for recognizing their effort!</p>
                                    </Motion.div>
                                ) : (
                                    <>
                                        <div className="relative flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="h-11 w-11 rounded-2xl border border-rose-200/70 bg-rose-100/80 flex items-center justify-center shadow-inner-soft">
                                                    <Heart className="w-5 h-5 text-rose-500 fill-current" />
                                                </div>
                                                <div>
                                                    <div className="text-[10px] uppercase tracking-[0.35em] text-neutral-400 font-semibold">
                                                        Appreciation
                                                    </div>
                                                    <h3 className="font-display font-bold text-neutral-800 text-lg">
                                                        Appreciate {partnerName}
                                                    </h3>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setShowGoodDeedModal(false)}
                                                className="w-8 h-8 bg-white/80 border border-neutral-200/70 rounded-full flex items-center justify-center shadow-soft"
                                            >
                                                <X className="w-4 h-4 text-neutral-500" />
                                            </button>
                                        </div>

                                        <div className="relative flex items-center justify-between rounded-2xl border border-rose-200/60 bg-rose-50/70 px-3 py-2 text-xs text-rose-700">
                                            <span>Share a sweet moment and send +10 kibble.</span>
                                            <span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-semibold text-rose-600">
                                                +10
                                            </span>
                                        </div>

                                        <div className="relative space-y-2">
                                            <textarea
                                                value={goodDeedText}
                                                onChange={(e) => setGoodDeedText(e.target.value)}
                                                placeholder={`${partnerName} did something nice...`}
                                                className="w-full h-28 bg-white/80 border border-rose-100 rounded-2xl p-3 text-neutral-700 placeholder:text-neutral-400 focus:ring-2 focus:ring-rose-200 focus:border-rose-300 focus:outline-none resize-none text-sm shadow-inner-soft"
                                            />
                                            <div className="flex items-center justify-between text-[11px] text-neutral-400">
                                                <span>Keep it short and heartfelt.</span>
                                                <span>{goodDeedText.length} / 120</span>
                                            </div>
                                        </div>

                                        {/* Quick Suggestions */}
                                        <div className="flex flex-wrap gap-2">
                                            {goodDeedSuggestions.map((suggestion) => (
                                                <button
                                                    key={suggestion}
                                                    onClick={() => setGoodDeedText(suggestion)}
                                                    className="px-3 py-1.5 bg-white/80 text-rose-600 rounded-full text-xs font-semibold border border-rose-200/60 hover:bg-rose-50 transition-colors"
                                                >
                                                    {suggestion}
                                                </button>
                                            ))}
                                        </div>

                                        <button
                                            onClick={handleLogGoodDeed}
                                            disabled={!goodDeedText.trim() || isSubmitting}
                                            className="w-full rounded-2xl bg-gradient-to-r from-rose-500 via-rose-400 to-amber-400 py-3 text-sm font-bold text-white shadow-soft flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            {isSubmitting ? (
                                                <Motion.div
                                                    animate={{ rotate: 360 }}
                                                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                                    className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                                                />
                                            ) : (
                                                <>
                                                    <Heart className="w-4 h-4" />
                                                    Send Appreciation
                                                </>
                                            )}
                                        </button>
                                    </>
                                )}
                            </Motion.div>
                        </Motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

const ACTION_STYLES = {
    rose: {
        border: 'border-rose-200/70',
        glow: 'bg-rose-200/40',
        iconBg: 'bg-rose-100/80',
        iconBorder: 'border-rose-200/70',
        text: 'text-rose-600',
        bg: 'from-rose-50 via-white to-amber-50/60',
    },
    amber: {
        border: 'border-amber-200/70',
        glow: 'bg-amber-200/40',
        iconBg: 'bg-amber-100/80',
        iconBorder: 'border-amber-200/70',
        text: 'text-amber-700',
        bg: 'from-amber-50 via-white to-orange-50/60',
    },
    violet: {
        border: 'border-violet-200/60',
        glow: 'bg-violet-200/40',
        iconBg: 'bg-violet-100/80',
        iconBorder: 'border-violet-200/70',
        text: 'text-violet-600',
        bg: 'from-violet-50 via-white to-fuchsia-50/60',
    },
    mint: {
        border: 'border-emerald-200/60',
        glow: 'bg-emerald-200/40',
        iconBg: 'bg-emerald-100/80',
        iconBorder: 'border-emerald-200/70',
        text: 'text-emerald-600',
        bg: 'from-emerald-50 via-white to-lime-50/60',
    },
};

const ActionTile = ({ icon, label, detail, locked, accent, onClick }) => {
    const palette = ACTION_STYLES[accent] || ACTION_STYLES.rose;

    return (
        <Motion.button
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            className={`relative overflow-hidden rounded-[26px] border ${palette.border} bg-gradient-to-br ${palette.bg} p-4 text-left shadow-soft transition`}
        >
            <div className={`absolute -top-8 -right-6 h-16 w-16 rounded-full blur-2xl ${palette.glow}`} />
            {locked && (
                <div className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 border border-neutral-200">
                    <Lock className="w-3.5 h-3.5 text-neutral-400" />
                </div>
            )}
            <div className="relative flex items-center gap-3">
                <div className={`h-11 w-11 rounded-2xl border ${palette.iconBorder} ${palette.iconBg} flex items-center justify-center shadow-inner-soft`}>
                    <img
                        src={icon}
                        alt={label}
                        className={`w-7 h-7 object-contain ${locked ? 'grayscale opacity-50' : ''}`}
                    />
                </div>
                <div className="flex-1">
                    <div className="text-sm font-bold text-neutral-800">{label}</div>
                    <div className="text-[11px] text-neutral-500">{detail}</div>
                </div>
                <span className={`text-[10px] font-semibold uppercase tracking-[0.3em] ${palette.text}`}>
                    Go
                </span>
            </div>
        </Motion.button>
    );
};

const HomeBackdrop = () => (
    <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -right-16 h-56 w-56 rounded-full bg-rose-200/25 blur-3xl" />
        <div className="absolute top-24 -left-20 h-60 w-60 rounded-full bg-amber-200/30 blur-3xl" />
        <div className="absolute bottom-10 right-8 h-64 w-64 rounded-full bg-amber-100/40 blur-3xl" />
        <div
            className="absolute inset-0 opacity-45"
            style={{
                backgroundImage:
                    'radial-gradient(circle at 18% 20%, rgba(255,255,255,0.75) 0%, transparent 55%), radial-gradient(circle at 80% 10%, rgba(255,235,210,0.8) 0%, transparent 60%)'
            }}
        />
    </div>
);

export default DashboardPage;
