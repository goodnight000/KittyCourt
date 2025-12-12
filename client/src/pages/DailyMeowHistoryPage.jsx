import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Heart, Calendar, Sparkles, BookOpen,
    ChevronRight, Search
} from 'lucide-react';
import useAuthStore from '../store/useAuthStore';
import api from '../services/api';
import { ChevronLeft } from 'lucide-react';

// Mood options for display
const MOOD_OPTIONS = [
    { id: 'happy', emoji: '😊', label: 'Happy' },
    { id: 'loved', emoji: '🥰', label: 'Loved' },
    { id: 'grateful', emoji: '🙏', label: 'Grateful' },
    { id: 'excited', emoji: '🤩', label: 'Excited' },
    { id: 'peaceful', emoji: '😌', label: 'Peaceful' },
    { id: 'playful', emoji: '😜', label: 'Playful' },
    { id: 'cozy', emoji: '🥹', label: 'Cozy' },
    { id: 'romantic', emoji: '😍', label: 'Romantic' },
    { id: 'silly', emoji: '🤪', label: 'Silly' },
    { id: 'hopeful', emoji: '✨', label: 'Hopeful' },
    { id: 'tired', emoji: '😴', label: 'Tired' },
    { id: 'stressed', emoji: '😩', label: 'Stressed' },
    { id: 'anxious', emoji: '😰', label: 'Anxious' },
    { id: 'sad', emoji: '😢', label: 'Sad' },
    { id: 'frustrated', emoji: '😤', label: 'Frustrated' },
    { id: 'overwhelmed', emoji: '🤯', label: 'Overwhelmed' },
    { id: 'lonely', emoji: '🥺', label: 'Lonely' },
    { id: 'confused', emoji: '😵‍💫', label: 'Confused' },
    { id: 'meh', emoji: '😐', label: 'Meh' },
    { id: 'hangry', emoji: '🤤', label: 'Hangry' },
];

const DailyMeowHistoryPage = () => {
    const navigate = useNavigate();
    const { user: authUser, profile, partner: connectedPartner } = useAuthStore();

    const myId = authUser?.id;
    const partnerId = connectedPartner?.id;
    const partnerDisplayName = connectedPartner?.display_name || 'Your partner';
    const myDisplayName = profile?.display_name || 'You';

    // State
    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState([]);
    const [selectedEntry, setSelectedEntry] = useState(null);
    const [filter, setFilter] = useState('all'); // 'all', 'completed', 'mine-only'
    const [searchQuery, setSearchQuery] = useState('');

    const fetchHistory = useCallback(async () => {
        if (!myId || !partnerId) return;

        try {
            setLoading(true);
            const response = await api.get('/daily-questions/history', {
                params: { userId: myId, partnerId, limit: 100 }
            });
            setHistory(response.data);
        } catch (err) {
            console.error('Error fetching history:', err);
        } finally {
            setLoading(false);
        }
    }, [myId, partnerId]);

    useEffect(() => {
        if (myId && partnerId) {
            fetchHistory();
        }
    }, [fetchHistory, myId, partnerId]);

    const getMoodData = (moodId) => MOOD_OPTIONS.find(m => m.id === moodId);

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'long' });

        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    };

    const formatFullDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
    };

    // Filter and search
    const filteredHistory = history.filter(item => {
        // Apply filter
        if (filter === 'completed' && (!item.my_answer || !item.partner_answer)) return false;
        if (filter === 'mine-only' && !item.my_answer) return false;

        // Apply search
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const matchesQuestion = item.question?.toLowerCase().includes(query);
            const matchesMyAnswer = item.my_answer?.answer?.toLowerCase().includes(query);
            const matchesPartnerAnswer = item.partner_answer?.answer?.toLowerCase().includes(query);
            return matchesQuestion || matchesMyAnswer || matchesPartnerAnswer;
        }

        return true;
    });

    // Group by month
    const groupedHistory = filteredHistory.reduce((groups, item) => {
        const date = new Date(item.assigned_date);
        const monthYear = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        if (!groups[monthYear]) {
            groups[monthYear] = [];
        }
        groups[monthYear].push(item);
        return groups;
    }, {});

    // Stats
    const totalAnswered = history.filter(h => h.my_answer).length;
    const bothAnswered = history.filter(h => h.my_answer && h.partner_answer).length;
    const streak = calculateStreak(history);

    function calculateStreak(hist) {
        let streak = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 0; i < hist.length; i++) {
            const itemDate = new Date(hist[i].assigned_date);
            itemDate.setHours(0, 0, 0, 0);

            const expectedDate = new Date(today);
            expectedDate.setDate(expectedDate.getDate() - i);

            if (itemDate.getTime() === expectedDate.getTime() && hist[i].my_answer) {
                streak++;
            } else {
                break;
            }
        }
        return streak;
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}

            >
                <div className="flex items-center gap-3">
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate(-1)}
                        className="w-10 h-10 bg-white/80 rounded-xl flex items-center justify-center shadow-soft"
                    >
                        <ChevronLeft className="w-5 h-5 text-neutral-600" />
                    </motion.button>
                    <div>
                        <h1 className="text-xl font-bold text-gradient">Question Archives</h1>
                        <p className="text-neutral-500 text-sm">The Deepest of memories and secrets shared together</p>
                    </div>
                </div>
            </motion.div>

            {/* Journey Banner */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mx-4 mt-4"
            >
                <div className="rounded-3xl p-5 text-white shadow-lg overflow-hidden relative" style={{ background: 'linear-gradient(135deg, #C9A227 0%, #8B7019 100%)' }}>
                    {/* Decorative elements */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />

                    <div className="relative">
                        <div className="flex items-center gap-2 mb-3">
                            <BookOpen className="w-5 h-5" />
                            <span className="font-bold">Your Journey Together</span>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="text-center">
                                <div className="text-3xl font-bold">{totalAnswered}</div>
                                <div className="text-xs text-white/80">Questions Answered</div>
                            </div>
                            <div className="text-center border-l border-white/20">
                                <div className="text-3xl font-bold flex items-center justify-center gap-1">
                                    {streak}
                                    {streak > 0 && <span className="text-lg">🔥</span>}
                                </div>
                                <div className="text-xs text-white/80">Day Streak</div>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Search */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="px-4 mt-4"
            >
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search questions or answers..."
                        className="w-full pl-11 pr-4 py-3 bg-white rounded-2xl border border-neutral-200 text-sm focus:border-court-gold focus:ring-2 focus:ring-court-gold/20 outline-none"
                    />
                </div>
            </motion.div>

            {/* Content */}
            <div className="flex-1 px-4 mt-4">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-8 h-8 border-2 border-violet-400 border-t-transparent rounded-full"
                        />
                    </div>
                ) : filteredHistory.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center py-12"
                    >
                        <span className="text-5xl mb-4 block">📖</span>
                        <h3 className="text-lg font-bold text-neutral-700 mb-2">
                            {searchQuery ? 'No matches found' : 'Your story begins here'}
                        </h3>
                        <p className="text-neutral-500 text-sm max-w-xs mx-auto">
                            {searchQuery
                                ? 'Try a different search term'
                                : 'Answer daily questions together to build your shared story'}
                        </p>
                    </motion.div>
                ) : (
                    <div className="space-y-6">
                        {Object.entries(groupedHistory).map(([monthYear, items], groupIndex) => (
                            <motion.div
                                key={monthYear}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: groupIndex * 0.1 }}
                            >
                                {/* Month Header */}
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full shadow-sm border border-neutral-100">
                                        <Calendar className="w-4 h-4 text-violet-500" />
                                        <span className="text-sm font-bold text-neutral-700">{monthYear}</span>
                                    </div>
                                    <div className="flex-1 h-px bg-gradient-to-r from-neutral-200 to-transparent" />
                                </div>

                                {/* Questions */}
                                <div className="space-y-3">
                                    {items.map((item, index) => {
                                        const isCompleted = item.my_answer && item.partner_answer;
                                        const myMood = getMoodData(item.my_answer?.mood);
                                        const partnerMood = getMoodData(item.partner_answer?.mood);

                                        // Stripe color based on completion status
                                        const stripeColor = isCompleted
                                            ? 'bg-emerald-400'
                                            : 'bg-amber-400';

                                        return (
                                            <motion.button
                                                key={item.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: index * 0.03 }}
                                                whileTap={{ scale: 0.98 }}
                                                onClick={() => setSelectedEntry(item)}
                                                className="w-full glass-card overflow-hidden flex text-left group"
                                            >
                                                {/* Colored Status Stripe */}
                                                <div className={`w-1.5 ${stripeColor} flex-shrink-0`} />

                                                <div className="flex-1 p-4">
                                                    <div className="flex items-start gap-3">
                                                        {/* Emoji */}
                                                        <div className="w-10 h-10 bg-gradient-to-br from-violet-50 to-pink-50 rounded-xl flex items-center justify-center flex-shrink-0">
                                                            <span className="text-xl">{item.emoji || '💭'}</span>
                                                        </div>

                                                        {/* Content */}
                                                        <div className="flex-1 min-w-0">
                                                            {/* Question Text */}
                                                            <p className="text-sm font-bold text-neutral-800 line-clamp-2 leading-snug mb-1.5 group-hover:text-violet-700 transition-colors">
                                                                {item.question}
                                                            </p>

                                                            {/* Badges Row */}
                                                            <div className="flex flex-wrap items-center gap-1.5 mb-2">

                                                                {/* Category badge if available */}
                                                                {item.category && (
                                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-100 text-neutral-600">
                                                                        {item.category}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* Mood indicators */}
                                                            {(myMood || partnerMood) && (
                                                                <div className="flex items-center gap-1 text-xs text-neutral-500">
                                                                    <span className="text-pink-400">💕</span>
                                                                    {myMood && <span>{myMood.emoji}</span>}
                                                                    {myMood && partnerMood && <span>+</span>}
                                                                    {partnerMood && <span>{partnerMood.emoji}</span>}
                                                                </div>
                                                            )}

                                                            {/* Date */}
                                                            <div className="flex items-center gap-1 text-[10px] text-neutral-400 mt-2">
                                                                <Calendar className="w-3 h-3" />
                                                                {formatDate(item.assigned_date)}
                                                            </div>
                                                        </div>

                                                        {/* Arrow Icon */}
                                                        <div className="flex-shrink-0 mt-1">
                                                            <ChevronRight className="w-5 h-5 text-neutral-300 group-hover:text-violet-400 transition-colors" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.button>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            <AnimatePresence>
                {selectedEntry && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end justify-center"
                        onClick={() => setSelectedEntry(null)}
                    >
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-lg bg-white rounded-t-3xl max-h-[85vh] overflow-hidden flex flex-col"
                        >
                            {/* Modal Header */}
                            <div className="p-5 border-b border-neutral-100 bg-gradient-to-r from-violet-50 to-pink-50">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs text-neutral-500">{formatFullDate(selectedEntry.assigned_date)}</span>
                                    <button
                                        onClick={() => setSelectedEntry(null)}
                                        className="text-neutral-400 hover:text-neutral-600"
                                    >
                                        ✕
                                    </button>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-4xl">{selectedEntry.emoji || '💭'}</span>
                                    <h2 className="text-lg font-bold text-neutral-800 leading-snug">
                                        {selectedEntry.question}
                                    </h2>
                                </div>
                            </div>

                            {/* Modal Content */}
                            <div className="flex-1 overflow-y-auto p-5 space-y-4">
                                {/* My Answer */}
                                {selectedEntry.my_answer ? (
                                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-4 border border-amber-100">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-sm font-bold text-amber-700">{myDisplayName}</span>
                                            {selectedEntry.my_answer.mood && (
                                                <span className="text-lg">{getMoodData(selectedEntry.my_answer.mood)?.emoji}</span>
                                            )}
                                        </div>
                                        <p className="text-neutral-700 leading-relaxed">
                                            {selectedEntry.my_answer.answer}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="bg-neutral-50 rounded-2xl p-4 border border-dashed border-neutral-200 text-center">
                                        <Lock className="w-5 h-5 text-neutral-400 mx-auto mb-1" />
                                        <p className="text-sm text-neutral-500">You haven't answered this question</p>
                                    </div>
                                )}

                                {/* Partner's Answer */}
                                {selectedEntry.partner_answer ? (
                                    <div className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-2xl p-4 border border-pink-100">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-sm font-bold text-pink-700">{partnerDisplayName}</span>
                                            {selectedEntry.partner_answer.mood && (
                                                <span className="text-lg">{getMoodData(selectedEntry.partner_answer.mood)?.emoji}</span>
                                            )}
                                        </div>
                                        <p className="text-neutral-700 leading-relaxed">
                                            {selectedEntry.partner_answer.answer}
                                        </p>
                                    </div>
                                ) : selectedEntry.my_answer ? (
                                    <div className="bg-neutral-50 rounded-2xl p-4 border border-dashed border-neutral-200 text-center">
                                        <Lock className="w-5 h-5 text-neutral-400 mx-auto mb-1" />
                                        <p className="text-sm text-neutral-500">{partnerDisplayName} hasn't answered yet</p>
                                    </div>
                                ) : null}

                                {/* Both answered celebration */}
                                {selectedEntry.my_answer && selectedEntry.partner_answer && (
                                    <div className="flex justify-center">
                                        <span className="px-4 py-2 bg-gradient-to-r from-emerald-100 to-teal-100 rounded-full text-sm font-medium text-emerald-700 flex items-center gap-2">
                                            <Sparkles className="w-4 h-4" />
                                            A moment captured together
                                        </span>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default DailyMeowHistoryPage;
