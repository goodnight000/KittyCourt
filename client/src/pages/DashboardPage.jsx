import React, { useState, useEffect } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Heart, Coffee, TrendingUp, Sparkles, Star, Gift, X, Check, Scale, History, MessageCircle, Lock, BookOpen, Flame, ArrowRight } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import useAuthStore from '../store/useAuthStore';
import api from '../services/api';

const DashboardPage = () => {
    const navigate = useNavigate();
    const { currentUser, users, logGoodDeed } = useAppStore();
    const { hasPartner, profile, partner: connectedPartner, user: authUser } = useAuthStore();
    const [showGoodDeedModal, setShowGoodDeedModal] = useState(false);
    const [questionStreak, setQuestionStreak] = useState(0);

    // Get partner name - prefer connected partner from auth store
    const partnerName = connectedPartner?.display_name || users?.find(u => u.id !== currentUser?.id)?.name || 'your partner';
    const [goodDeedText, setGoodDeedText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    // Fetch question streak
    useEffect(() => {
        const fetchStreak = async () => {
            if (!authUser?.id || !connectedPartner?.id) return;
            try {
                const response = await api.get('/daily-questions/history', {
                    params: { userId: authUser.id, partnerId: connectedPartner.id }
                });
                const history = response.data || [];
                const completed = history.filter(q => q.my_answer && q.partner_answer);
                if (completed.length === 0) {
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
                setQuestionStreak(streak);
            } catch (err) {
                console.error('Failed to fetch streak:', err);
            }
        };
        fetchStreak();
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

    return (
        <div className="space-y-6">
            {/* Welcome & Stats Section */}
            <div className="space-y-4">
                <Motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between"
                >
                    <div>
                        <h1 className="text-2xl font-bold text-neutral-800">
                            Hey, <span className="text-gradient">{profile?.display_name || currentUser?.display_name || currentUser?.name || 'Love'}</span>
                        </h1>
                        <p className="text-neutral-500 text-sm mt-0.5">Welcome back 💕</p>
                    </div>
                </Motion.div>

                {/* Stats Strip - Prominent at top */}
                <Motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="flex gap-3"
                >
                    <Motion.div
                        whileTap={{ scale: 0.98 }}
                        onClick={() => navigate('/profile')}
                        className="flex-1 bg-gradient-to-br from-pink-50 to-rose-50/80 rounded-2xl p-4 border border-pink-100/50 cursor-pointer shadow-sm relative overflow-hidden"
                    >
                        <div className="relative z-10 flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-soft text-pink-500">
                                <Heart className="w-5 h-5 fill-current" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-neutral-800 leading-none mb-1">
                                    {daysTogether !== null ? daysTogether : '?'}
                                </div>
                                <div className="text-xs text-neutral-500 font-bold uppercase tracking-wide">Days Together</div>
                            </div>
                        </div>
                        {/* Decorative background icon */}
                        <Heart className="absolute -bottom-4 -right-4 w-24 h-24 text-pink-100/50 rotate-12" />
                    </Motion.div>

                    <Motion.div
                        whileTap={{ scale: 0.98 }}
                        onClick={() => navigate('/daily-meow/history')}
                        className="flex-1 bg-gradient-to-br from-orange-50 to-amber-50/80 rounded-2xl p-4 border border-orange-100/50 cursor-pointer shadow-sm relative overflow-hidden"
                    >
                        <div className="relative z-10 flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-soft text-orange-500">
                                <Flame className="w-5 h-5 fill-current" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-neutral-800 leading-none mb-1">{questionStreak}</div>
                                <div className="text-xs text-neutral-500 font-bold uppercase tracking-wide">Question Streak</div>
                            </div>
                        </div>
                        {/* Decorative background icon */}
                        <Flame className="absolute -bottom-4 -right-4 w-24 h-24 text-orange-100/50 rotate-12" />
                    </Motion.div>
                </Motion.div>
            </div>

            {/* Main Features - Side by Side Cards */}
            <div className="grid grid-cols-2 gap-3">
                {/* File a Case Card */}
                <Motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate('/courtroom')}
                    className="relative overflow-hidden rounded-3xl cursor-pointer group shadow-lg h-52"
                    style={{ background: 'linear-gradient(135deg, #1c1c84 0%, #000035 100%)' }}
                >
                    {/* Decorative circle */}
                    <div className="absolute top-1/2 right-0 w-40 h-40 bg-white/5 rounded-full translate-x-1/3 blur-2xl" />

                    <div className="relative h-full p-4 flex flex-col">
                        {/* Large Avatar - Top Left */}
                        <Motion.div
                            animate={{ y: [0, -3, 0] }}
                            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                            className="w-28 h-28 rounded-xl overflow-hidden mb-auto"
                        >
                            <img
                                src="/assets/avatars/judge_whiskers.png"
                                alt="Judge Whiskers"
                                className="w-full h-full object-cover"
                            />
                        </Motion.div>

                        {/* Ready Badge - Top Right */}
                        <div className="absolute top-4 right-4 inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/15 backdrop-blur-sm rounded-full">
                            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                            <span className="text-white/90 text-[10px] font-bold">Ready</span>
                        </div>

                        {/* Title at Bottom */}
                        <div>
                            <h3 className="text-white font-bold text-lg leading-tight">File a Case</h3>
                            <p className="text-white/60 text-xs mt-0.5">Let Judge Whiskers decide</p>
                        </div>
                    </div>
                </Motion.div>

                {/* Daily Question Card */}
                <Motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate('/daily-meow')}
                    className="relative overflow-hidden rounded-3xl cursor-pointer group shadow-lg h-52"
                    style={{ background: 'linear-gradient(135deg, #C9A227 0%, #8B7019 100%)' }}
                >
                    {/* Decorative circle */}
                    <div className="absolute top-1/2 right-0 w-40 h-40 bg-white/5 rounded-full translate-x-1/3 blur-2xl" />

                    <div className="relative h-full p-4 flex flex-col">
                        {/* Large Icon - Top Left */}
                        <Motion.div
                            animate={{ rotate: [0, 5, -5, 0] }}
                            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                            className="w-28 h-28 rounded-xl overflow-hidden"
                        >
                            <img
                                src="/assets/avatars/daily_question.png"
                                alt="Daily Question"
                                className="w-full h-full object-cover"
                            />
                        </Motion.div>

                        {/* NEW Badge - Top Right */}
                        <div className="absolute top-4 right-4 px-2.5 py-1 bg-white/20 backdrop-blur-sm rounded-full">
                            <span className="text-white text-[10px] font-bold">NEW</span>
                        </div>

                        {/* Title at Bottom */}
                        <div>
                            <h3 className="text-white font-bold text-lg leading-tight">Daily Question</h3>
                            <p className="text-white/60 text-xs mt-0.5">Share your thoughts</p>
                        </div>
                    </div>
                </Motion.div>
            </div>

            {/* Quick Actions - Compact Grid */}
            <div className="space-y-3">
                <h3 className="font-bold text-neutral-400 text-xs uppercase tracking-wider px-1">Quick Actions</h3>

                <div className="grid grid-cols-4 gap-2">
                    <Motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => hasPartner ? setShowGoodDeedModal(true) : navigate('/connect')}
                        className="glass-card p-2 flex flex-col items-center gap-1 relative bg-white/50 hover:bg-white/80 transition-colors"
                    >
                        {!hasPartner && (
                            <div className="absolute top-1 right-1 w-3 h-3 bg-neutral-200 rounded-full flex items-center justify-center z-10">
                                <Lock className="w-2 h-2 text-neutral-500" />
                            </div>
                        )}
                        <div className="w-10 h-10 flex items-center justify-center">
                            <img
                                src="/assets/icons/appreicate.png"
                                alt="Appreciate"
                                className={`w-full h-full object-contain ${!hasPartner ? 'grayscale opacity-50' : ''}`}
                            />
                        </div>
                        <span className="text-[10px] font-bold text-neutral-600 text-center leading-tight">Appreciate</span>
                    </Motion.button>

                    <Motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate('/appreciations')}
                        className="glass-card p-2 flex flex-col items-center gap-1 bg-white/50 hover:bg-white/80 transition-colors"
                    >
                        <div className="w-10 h-10 flex items-center justify-center">
                            <img
                                src="/assets/icons/love_notes.png"
                                alt="Love Notes"
                                className="w-full h-full object-contain"
                            />
                        </div>
                        <span className="text-[10px] font-bold text-neutral-600 text-center leading-tight">Love Notes</span>
                    </Motion.button>

                    <Motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate('/history')}
                        className="glass-card p-2 flex flex-col items-center gap-1 bg-white/50 hover:bg-white/80 transition-colors"
                    >
                        <div className="w-10 h-10 flex items-center justify-center">
                            <img
                                src="/assets/icons/cases.png"
                                alt="Cases"
                                className="w-full h-full object-contain"
                            />
                        </div>
                        <span className="text-[10px] font-bold text-neutral-600 text-center leading-tight">Cases</span>
                    </Motion.button>

                    <Motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate('/economy')}
                        className="glass-card p-2 flex flex-col items-center gap-1 bg-white/50 hover:bg-white/80 transition-colors"
                    >
                        <div className="w-10 h-10 flex items-center justify-center">
                            <img
                                src="/assets/icons/redeem.png"
                                alt="Redeem"
                                className="w-full h-full object-contain"
                            />
                        </div>
                        <span className="text-[10px] font-bold text-neutral-600 text-center leading-tight">Redeem</span>
                    </Motion.button>
                </div>
            </div>

            {/* Question Archives - Horizontal Banner */}
            <Motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/daily-meow/history')}
                className="relative overflow-hidden rounded-2xl cursor-pointer shadow-md"
                style={{ background: '#fdfcfa' }}
            >
                <div className="flex items-center gap-4 p-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-100 to-amber-200 rounded-xl flex items-center justify-center shadow-soft border border-amber-200/50">
                        <BookOpen className="w-6 h-6 text-amber-600" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold text-neutral-800 text-sm">Question Archives</h3>
                        <p className="text-neutral-500 text-xs mt-0.5">Time travel to your past memories 💭</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-neutral-400" />
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
                            className="bg-white rounded-3xl w-full max-w-md p-5 space-y-4 shadow-xl"
                        >
                            {showSuccess ? (
                                <Motion.div
                                    initial={{ scale: 0.8 }}
                                    animate={{ scale: 1 }}
                                    className="text-center py-8"
                                >
                                    <Motion.div
                                        animate={{ scale: [1, 1.2, 1] }}
                                        transition={{ duration: 0.5 }}
                                        className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"
                                    >
                                        <Check className="w-8 h-8 text-green-500" />
                                    </Motion.div>
                                    <h3 className="font-bold text-neutral-800 text-lg">{partnerName} got +10 Kibble! 🎉</h3>
                                    <p className="text-neutral-500 text-sm">Thanks for recognizing their effort!</p>
                                </Motion.div>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-bold text-neutral-800 text-lg">Appreciate {partnerName} 💕</h3>
                                        <button
                                            onClick={() => setShowGoodDeedModal(false)}
                                            className="w-8 h-8 bg-neutral-100 rounded-full flex items-center justify-center"
                                        >
                                            <X className="w-4 h-4 text-neutral-500" />
                                        </button>
                                    </div>

                                    <p className="text-neutral-500 text-sm -mt-2">
                                        What did {partnerName} do that you appreciate? They'll get kibble for it!
                                    </p>

                                    <textarea
                                        value={goodDeedText}
                                        onChange={(e) => setGoodDeedText(e.target.value)}
                                        placeholder={`${partnerName} did something nice...`}
                                        className="w-full h-24 bg-neutral-50 border-2 border-neutral-100 rounded-xl p-3 text-neutral-700 placeholder:text-neutral-400 focus:ring-2 focus:ring-amber-200 focus:border-amber-300 focus:outline-none resize-none text-sm"
                                    />

                                    {/* Quick Suggestions */}
                                    <div className="flex flex-wrap gap-2">
                                        {goodDeedSuggestions.map((suggestion) => (
                                            <button
                                                key={suggestion}
                                                onClick={() => setGoodDeedText(suggestion)}
                                                className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full text-xs font-medium hover:bg-amber-100 transition-colors"
                                            >
                                                {suggestion}
                                            </button>
                                        ))}
                                    </div>

                                    <button
                                        onClick={handleLogGoodDeed}
                                        disabled={!goodDeedText.trim() || isSubmitting}
                                        className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
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
                                                Show Appreciation
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
    );
};

export default DashboardPage;
