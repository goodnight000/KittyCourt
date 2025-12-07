import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Heart, Coffee, TrendingUp, Sparkles, Star, Gift, X, Check, Scale, History, MessageCircle, Lock, BookOpen, Flame, ArrowRight } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import useAuthStore from '../store/useAuthStore';
import api from '../services/api';

const DashboardPage = () => {
    const navigate = useNavigate();
    const { currentUser, users, logGoodDeed, caseHistory } = useAppStore();
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
                // Calculate streak from history
                const history = response.data || [];
                let streak = 0;
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                // Sort by date descending
                const sorted = history
                    .filter(q => q.my_answer && q.partner_answer)
                    .sort((a, b) => new Date(b.assigned_date) - new Date(a.assigned_date));

                for (let i = 0; i < sorted.length; i++) {
                    const questionDate = new Date(sorted[i].assigned_date + 'T00:00:00');
                    const expectedDate = new Date(today);
                    expectedDate.setDate(expectedDate.getDate() - i);

                    if (questionDate.toDateString() === expectedDate.toDateString()) {
                        streak++;
                    } else {
                        break;
                    }
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
                <motion.div
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
                </motion.div>

                {/* Stats Strip - Prominent at top */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="flex gap-3"
                >
                    <motion.div
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
                    </motion.div>

                    <motion.div
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
                                <div className="text-xs text-neutral-500 font-bold uppercase tracking-wide">Day Streak</div>
                            </div>
                        </div>
                        {/* Decorative background icon */}
                        <Flame className="absolute -bottom-4 -right-4 w-24 h-24 text-orange-100/50 rotate-12" />
                    </motion.div>
                </motion.div>
            </div>

            {/* Main Features - The "Important Elements" */}
            <div className="space-y-4">
                <h3 className="font-bold text-neutral-400 text-xs uppercase tracking-wider px-1">Core Features</h3>

                <div className="grid grid-cols-1 gap-4">
                    {/* Judge Whiskers Card - Large & Premium */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => navigate('/courtroom')}
                        className="relative overflow-hidden rounded-[2rem] cursor-pointer group shadow-lg"
                        style={{
                            background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 50%, #5B21B6 100%)',
                            minHeight: '160px'
                        }}
                    >
                        {/* Decorative circles */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
                        <div className="absolute bottom-0 left-0 w-40 h-40 bg-black/10 rounded-full translate-y-1/3 -translate-x-1/4 blur-2xl" />

                        <div className="relative p-6 h-full flex items-center justify-between">
                            <div className="flex-1 pr-4">
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/20 mb-3">
                                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                                    <span className="text-white/90 text-[10px] font-bold uppercase tracking-wide">Court is in Session</span>
                                </div>
                                <h3 className="text-white font-bold text-2xl leading-tight mb-1">File a Case</h3>
                                <p className="text-white/70 text-sm font-medium">Let Judge Whiskers decide who's right.</p>

                                <div className="mt-4 inline-flex items-center gap-2 text-white/90 text-sm font-bold group-hover:gap-3 transition-all">
                                    Enter Courtroom <ArrowRight className="w-4 h-4" />
                                </div>
                            </div>

                            {/* Judge Avatar */}
                            <motion.div
                                animate={{ y: [0, -5, 0] }}
                                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                className="w-24 h-24 rounded-2xl overflow-hidden border-4 border-white/20 shadow-xl rotate-3 shrink-0"
                            >
                                <img
                                    src="/assets/avatars/judge_whiskers.png"
                                    alt="Judge Whiskers"
                                    className="w-full h-full object-cover"
                                />
                            </motion.div>
                        </div>
                    </motion.div>

                    {/* Daily Question Card - Large & Premium */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => navigate('/daily-meow')}
                        className="relative overflow-hidden rounded-[2rem] cursor-pointer group shadow-lg"
                        style={{
                            background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 50%, #B45309 100%)',
                            minHeight: '160px'
                        }}
                    >
                        {/* Decorative circles */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
                        <div className="absolute bottom-0 left-0 w-40 h-40 bg-black/10 rounded-full translate-y-1/3 -translate-x-1/4 blur-2xl" />

                        <div className="relative p-6 h-full flex items-center justify-between">
                            <div className="flex-1 pr-4">
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/20 mb-3">
                                    <Sparkles className="w-3 h-3 text-yellow-200" />
                                    <span className="text-white/90 text-[10px] font-bold uppercase tracking-wide">Daily Connection</span>
                                </div>
                                <h3 className="text-white font-bold text-2xl leading-tight mb-1">Daily Question</h3>
                                <p className="text-white/70 text-sm font-medium">Spark meaningful conversations.</p>

                                <div className="mt-4 inline-flex items-center gap-2 text-white/90 text-sm font-bold group-hover:gap-3 transition-all">
                                    Answer Now <ArrowRight className="w-4 h-4" />
                                </div>
                            </div>

                            {/* Icon */}
                            <motion.div
                                animate={{ rotate: [0, 5, -5, 0] }}
                                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                                className="w-24 h-24 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 shadow-xl -rotate-3 shrink-0"
                            >
                                <MessageCircle className="w-10 h-10 text-white" />
                            </motion.div>
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* Quick Actions - Compact Grid */}
            <div className="space-y-4">
                <h3 className="font-bold text-neutral-400 text-xs uppercase tracking-wider px-1">Quick Actions</h3>

                <div className="grid grid-cols-4 gap-3">
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => hasPartner ? setShowGoodDeedModal(true) : navigate('/connect')}
                        className="glass-card p-3 flex flex-col items-center gap-2 relative bg-white/50 hover:bg-white/80 transition-colors"
                    >
                        {!hasPartner && (
                            <div className="absolute top-1 right-1 w-4 h-4 bg-neutral-200 rounded-full flex items-center justify-center">
                                <Lock className="w-2.5 h-2.5 text-neutral-500" />
                            </div>
                        )}
                        <div className="w-10 h-10 bg-pink-50 rounded-xl flex items-center justify-center text-pink-500">
                            <Heart className={`w-5 h-5 ${hasPartner ? 'fill-current' : 'text-neutral-400'}`} />
                        </div>
                        <span className="text-[10px] font-bold text-neutral-600 text-center leading-tight uppercase tracking-wide">Appreciate</span>
                    </motion.button>

                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate('/appreciations')}
                        className="glass-card p-3 flex flex-col items-center gap-2 bg-white/50 hover:bg-white/80 transition-colors"
                    >
                        <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center text-violet-500">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-bold text-neutral-600 text-center leading-tight uppercase tracking-wide">Received</span>
                    </motion.button>

                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate('/history')}
                        className="glass-card p-3 flex flex-col items-center gap-2 bg-white/50 hover:bg-white/80 transition-colors"
                    >
                        <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-green-500">
                            <History className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-bold text-neutral-600 text-center leading-tight uppercase tracking-wide">History</span>
                    </motion.button>

                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate('/economy')}
                        className="glass-card p-3 flex flex-col items-center gap-2 bg-white/50 hover:bg-white/80 transition-colors"
                    >
                        <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-500">
                            <Gift className="w-5 h-5 fill-current" />
                        </div>
                        <span className="text-[10px] font-bold text-neutral-600 text-center leading-tight uppercase tracking-wide">Redeem</span>
                    </motion.button>
                </div>
            </div>

            {/* Good Deed Modal */}
            <AnimatePresence>
                {showGoodDeedModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-end justify-center p-4 pb-20"
                        onClick={() => setShowGoodDeedModal(false)}
                    >
                        <motion.div
                            initial={{ y: 100, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 100, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-3xl w-full max-w-md p-5 space-y-4 shadow-xl"
                        >
                            {showSuccess ? (
                                <motion.div
                                    initial={{ scale: 0.8 }}
                                    animate={{ scale: 1 }}
                                    className="text-center py-8"
                                >
                                    <motion.div
                                        animate={{ scale: [1, 1.2, 1] }}
                                        transition={{ duration: 0.5 }}
                                        className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"
                                    >
                                        <Check className="w-8 h-8 text-green-500" />
                                    </motion.div>
                                    <h3 className="font-bold text-neutral-800 text-lg">{partnerName} got +10 Kibble! 🎉</h3>
                                    <p className="text-neutral-500 text-sm">Thanks for recognizing their effort!</p>
                                </motion.div>
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
                                            <motion.div
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
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default DashboardPage;
