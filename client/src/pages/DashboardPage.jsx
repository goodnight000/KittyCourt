import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Heart, Coffee, TrendingUp, Sparkles, Star, Gift, X, Check, Scale, History, MessageCircle, Lock, BookOpen, Flame } from 'lucide-react';
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
        <div className="space-y-5">
            {/* Welcome */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3"
            >
                <motion.span
                    animate={{ rotate: [0, 14, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
                    className="text-2xl"
                >
                    👋
                </motion.span>
                <div>
                    <h1 className="text-xl font-bold text-neutral-800">
                        Hey, <span className="text-gradient">{profile?.display_name || currentUser?.display_name || currentUser?.name || 'Partner'}</span>!
                    </h1>
                    <p className="text-neutral-500 text-sm">The judge is watching 🐱</p>
                </div>
            </motion.div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 gap-3">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate('/profiles')}
                    className="glass-card p-4 bg-gradient-to-br from-violet-50/80 to-white/60 cursor-pointer"
                >
                    <div className="flex items-center gap-2 mb-1">
                        <Heart className="w-5 h-5 text-pink-500" />
                        <span className="text-2xl font-bold text-neutral-800">
                            {daysTogether !== null ? daysTogether : '?'}
                        </span>
                    </div>
                    <span className="text-xs text-neutral-500 font-medium">
                        {daysTogether !== null ? 'Days Together' : 'Set Anniversary →'}
                    </span>
                </motion.div>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate('/daily-meow/history')}
                    className="glass-card p-4 bg-gradient-to-br from-orange-50/80 to-amber-50/60 cursor-pointer"
                >
                    <div className="flex items-center gap-2 mb-1">
                        <Flame className="w-5 h-5 text-orange-500" />
                        <span className="text-2xl font-bold text-neutral-800">{questionStreak}</span>
                    </div>
                    <span className="text-xs text-neutral-500 font-medium">Question Streak 🔥</span>
                </motion.div>
            </div>

            {/* Judge Card */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                onClick={() => navigate('/courtroom')}
                className="glass-card p-5 text-center cursor-pointer"
            >
                <motion.div
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                    className="relative inline-block mb-3"
                >
                    <div className="w-20 h-20 rounded-3xl overflow-hidden shadow-soft mx-auto">
                        <img src="/assets/avatars/judge_whiskers.png" alt="Judge Whiskers" className="w-full h-full object-cover" />
                    </div>

                </motion.div>

                <h2 className="font-bold text-neutral-800 mb-1">Judge Whiskers</h2>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-violet-50 text-violet-600 rounded-full text-xs font-bold">
                    <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse" />
                    Tap to file a case
                </span>
            </motion.div>

            {/* Today's Question - Featured Card */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                onClick={() => navigate('/daily-meow')}
                className="glass-card p-5 text-center cursor-pointer bg-gradient-to-br from-court-gold/25 to-court-cream/70 border border-court-gold/40"
            >
                <motion.div
                    animate={{ rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="relative inline-block mb-3"
                >
                    <div className="w-16 h-16 bg-white/90 rounded-2xl flex items-center justify-center shadow-soft mx-auto">
                        <MessageCircle className="w-8 h-8 text-court-gold" />
                    </div>
                </motion.div>

                <h2 className="font-bold text-neutral-800 mb-1">Today's Question</h2>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-court-gold/20 text-court-brown rounded-full text-xs font-bold">
                    <span className="w-1.5 h-1.5 bg-court-gold rounded-full animate-pulse" />
                    Share your thoughts 🐱
                </span>
            </motion.div>

            {/* Quick Actions */}
            <div className="space-y-3">
                <h3 className="font-bold text-neutral-600 text-sm flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    Quick Actions
                </h3>
                <div className="grid grid-cols-2 gap-3">
                    <motion.button
                        whileTap={hasPartner ? { scale: 0.97 } : {}}
                        onClick={() => hasPartner ? setShowGoodDeedModal(true) : navigate('/connect')}
                        className={`glass-card p-4 text-left relative overflow-hidden transition-colors ${hasPartner ? 'active:bg-white/90' : 'opacity-75'}`}
                    >
                        {!hasPartner && (
                            <div className="absolute top-2 right-2 w-5 h-5 bg-neutral-200 rounded-full flex items-center justify-center">
                                <Lock className="w-3 h-3 text-neutral-500" />
                            </div>
                        )}
                        {hasPartner && <span className="absolute top-2 right-2 text-lg opacity-50">💕</span>}
                        <div className="w-10 h-10 bg-white/80 rounded-xl flex items-center justify-center shadow-soft mb-2">
                            <Heart className={`w-5 h-5 ${hasPartner ? 'text-pink-500' : 'text-neutral-400'}`} />
                        </div>
                        <div className={`font-bold text-sm ${hasPartner ? 'text-neutral-800' : 'text-neutral-500'}`}>Show Appreciation</div>
                        <div className="text-xs text-neutral-500">{hasPartner ? 'Thank partner' : 'Connect first'}</div>
                    </motion.button>
                    <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => navigate('/economy')}
                        className="glass-card p-4 text-left relative overflow-hidden active:bg-white/90 transition-colors"
                    >
                        <span className="absolute top-2 right-2 text-lg opacity-50">🎁</span>
                        <div className="w-10 h-10 bg-white/80 rounded-xl flex items-center justify-center shadow-soft mb-2">
                            <Gift className="w-5 h-5 text-pink-500" />
                        </div>
                        <div className="font-bold text-neutral-800 text-sm">Redeem</div>
                        <div className="text-xs text-neutral-500">Use Kibble</div>
                    </motion.button>
                </div>

                {/* Second Row - View Appreciations and History */}
                <div className="grid grid-cols-2 gap-3">
                    <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => navigate('/appreciations')}
                        className="glass-card p-4 text-left relative overflow-hidden active:bg-white/90 transition-colors bg-gradient-to-br from-violet-50/60 to-pink-50/60"
                    >
                        <span className="absolute top-2 right-2 text-lg opacity-50">💕</span>
                        <div className="w-10 h-10 bg-white/80 rounded-xl flex items-center justify-center shadow-soft mb-2">
                            <TrendingUp className="w-5 h-5 text-pink-500" />
                        </div>
                        <div className="font-bold text-neutral-800 text-sm">View Appreciations</div>
                        <div className="text-xs text-neutral-500">From {partnerName}</div>
                    </motion.button>
                    <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => navigate('/history')}
                        className="glass-card p-4 text-left relative overflow-hidden active:bg-white/90 transition-colors"
                    >
                        <span className="absolute top-2 right-2 text-lg opacity-50">📜</span>
                        <div className="w-10 h-10 bg-white/80 rounded-xl flex items-center justify-center shadow-soft mb-2">
                            <History className="w-5 h-5 text-green-500" />
                        </div>
                        <div className="font-bold text-neutral-800 text-sm">Trial History</div>
                        <div className="text-xs text-neutral-500">{caseHistory?.length || 0} cases</div>
                    </motion.button>
                </div>

                {/* View Past Questions */}
                <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => navigate('/daily-meow/history')}
                    className="glass-card p-4 text-left relative overflow-hidden active:bg-white/90 transition-colors w-full bg-gradient-to-r from-court-cream/60 to-court-tan/40 border border-court-gold/20"
                >
                    <span className="absolute top-2 right-2 text-lg opacity-50">📜</span>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/80 rounded-xl flex items-center justify-center shadow-soft">
                            <BookOpen className="w-5 h-5 text-court-brown" />
                        </div>
                        <div>
                            <div className="font-bold text-neutral-800 text-sm">Question Archives</div>
                            <div className="text-xs text-neutral-500">Relive your daily conversations</div>
                        </div>
                    </div>
                </motion.button>
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
