import React, { useState, useEffect, useCallback } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    Calendar, BookOpen, Search
} from 'lucide-react';
import useAuthStore from '../store/useAuthStore';
import useCacheStore, { CACHE_TTL, CACHE_KEYS } from '../store/useCacheStore';
import api from '../services/api';
import { ChevronLeft } from 'lucide-react';
import RequirePartner from '../components/RequirePartner';

// Mood options with custom images (matching DailyMeowPage.jsx)
const MOOD_OPTIONS = [
    // Positive moods
    { id: 'happy', image: '/assets/emotions/happy.png', label: 'Happy' },
    { id: 'loved', image: '/assets/emotions/loved.png', label: 'Loved' },
    { id: 'grateful', image: '/assets/emotions/grateful.png', label: 'Grateful' },
    { id: 'excited', image: '/assets/emotions/excited.png', label: 'Excited' },
    { id: 'peaceful', image: '/assets/emotions/peaceful.png', label: 'Peaceful' },
    { id: 'playful', image: '/assets/emotions/playful.png', label: 'Playful' },
    { id: 'cozy', image: '/assets/emotions/cozy.png', label: 'Cozy' },
    { id: 'romantic', image: '/assets/emotions/romantic.png', label: 'Romantic' },
    { id: 'silly', image: '/assets/emotions/silly.png', label: 'Silly' },
    { id: 'hopeful', image: '/assets/emotions/hopeful.png', label: 'Hopeful' },
    // Neutral/Challenging moods
    { id: 'tired', image: '/assets/emotions/tired.png', label: 'Tired' },
    { id: 'stressed', image: '/assets/emotions/stressed.png', label: 'Stressed' },
    { id: 'anxious', image: '/assets/emotions/anxious.png', label: 'Anxious' },
    { id: 'sad', image: '/assets/emotions/sad.png', label: 'Sad' },
    { id: 'frustrated', image: '/assets/emotions/frustrated.png', label: 'Frustrated' },
    { id: 'overwhelmed', image: '/assets/emotions/overwhelmed.png', label: 'Overwhelmed' },
    { id: 'lonely', image: '/assets/emotions/lonely.png', label: 'Lonely' },
    { id: 'confused', image: '/assets/emotions/confused.png', label: 'Confused' },
    { id: 'meh', image: '/assets/emotions/meh.png', label: 'Meh' },
    { id: 'hangry', image: '/assets/emotions/hangry.png', label: 'Hangry' },
];

// MoodIcon component to render custom images
const MoodIcon = ({ moodId, className = 'w-6 h-6' }) => {
    const mood = MOOD_OPTIONS.find(m => m.id === moodId);
    if (!mood) return null;
    if (mood.image) {
        return <img src={mood.image} alt={mood.label} className={`${className} object-contain`} />;
    }
    return null;
};

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
    const filter = 'all' // 'all', 'completed', 'mine-only'
    const [searchQuery, setSearchQuery] = useState('');

    const fetchHistory = useCallback(async () => {
        if (!myId || !partnerId) return;

        const cacheKey = `${CACHE_KEYS.DAILY_HISTORY}:${myId}:${partnerId}`;

        // Check cache first
        const cached = useCacheStore.getState().getCached(cacheKey);
        if (cached !== null) {
            setHistory(cached);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const response = await api.get('/daily-questions/history', {
                params: { userId: myId, partnerId, limit: 100 }
            });
            const data = response.data || [];

            // Cache the history
            useCacheStore.getState().setCache(cacheKey, data, CACHE_TTL.DAILY_HISTORY);
            setHistory(data);
        } catch (err) {
            console.error('Error fetching history:', err);
        } finally {
            setLoading(false);
        }
    }, [myId, partnerId]);

    useEffect(() => {
        if (myId && partnerId) {
            fetchHistory();
        } else {
            setLoading(false);
        }
    }, [fetchHistory, myId, partnerId]);

    const getMoodData = (moodId) => MOOD_OPTIONS.find(m => m.id === moodId);
    const getMoodList = (answer) => {
        if (!answer) return []
        const moods = Array.isArray(answer.moods) ? answer.moods : (answer.mood ? [answer.mood] : [])
        return moods.filter(Boolean).slice(0, 3)
    }

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
    const streak = calculateStreak(history);

    function calculateStreak(hist) {
        const completed = (hist || []).filter(h => h?.my_answer && h?.partner_answer);
        if (completed.length === 0) return 0;

        const parseDay = (day) => new Date(`${day}T00:00:00`);
        const sorted = [...completed].sort((a, b) => parseDay(b.assigned_date) - parseDay(a.assigned_date));

        // Bug 4 fix: Check if most recent is within last 1 day (today or yesterday)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const mostRecent = parseDay(sorted[0].assigned_date);
        const daysSinceLast = Math.round((today - mostRecent) / (1000 * 60 * 60 * 24));

        // If most recent answer is more than 1 day ago, streak is broken
        if (daysSinceLast > 1) return 0;

        const msPerDay = 1000 * 60 * 60 * 24;
        let streakCount = 1;

        for (let i = 1; i < sorted.length; i++) {
            const prev = parseDay(sorted[i - 1].assigned_date);
            const curr = parseDay(sorted[i].assigned_date);
            const diffDays = Math.round((prev - curr) / msPerDay);

            if (diffDays === 1) {
                streakCount++;
            } else {
                break;
            }
        }

        return streakCount;
    }

    return (
        <RequirePartner
            feature="Question Archives"
            description="Connect with your partner to unlock your shared question history."
        >
            <div className="space-y-5">
            {/* Header */}
            <Motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}

            >
                <div className="flex items-center gap-3">
                    <Motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate(-1)}
                        className="w-10 h-10 bg-white/80 rounded-xl flex items-center justify-center shadow-soft"
                    >
                        <ChevronLeft className="w-5 h-5 text-neutral-600" />
                    </Motion.button>
                    <div>
                        <h1 className="text-xl font-bold text-gradient">Question Archives</h1>
                        <p className="text-neutral-500 text-sm">The Deepest of memories and secrets shared together</p>
                    </div>
                </div>
            </Motion.div>

            {/* Journey */}
            <Motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className=""
            >
                <div className="glass-card p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-amber-600" />
                            <span className="text-sm font-bold text-neutral-800">Your Journey</span>
                        </div>
                        <p className="text-xs text-neutral-500 mt-0.5">A tiny ritual you share together</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="px-3 py-1.5 rounded-full bg-white/70 border border-neutral-200 text-[11px] font-bold text-neutral-700">
                            {totalAnswered} answered
                        </div>
                        <div className="px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-50 to-pink-50 border border-amber-200/50 text-[11px] font-bold text-amber-700">
                            {streak} day streak
                        </div>
                    </div>
                </div>
            </Motion.div>

            {/* Search */}
            <Motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-4"
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
            </Motion.div>

            {/* Content */}
            <div className="flex-1 mt-4">
                {selectedEntry ? (
                    <div className="space-y-4">
                        <Motion.button
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setSelectedEntry(null)}
                            className="w-full py-3 bg-white/80 text-neutral-700 font-bold rounded-2xl shadow-sm border border-neutral-200"
                        >
                            Back to Archives
                        </Motion.button>

                        <div className="glass-card overflow-hidden">
                            <div className="p-5 text-center border-b border-white/50">
                                <h1 className="text-lg font-bold text-neutral-800 tracking-tight mb-2">Daily Question</h1>
                                <div className="flex items-center justify-center gap-2 mb-3">
                                    {selectedEntry.category && (
                                        <span className="inline-flex items-center px-3 py-1 bg-white/70 rounded-full text-xs font-bold text-neutral-700 shadow-sm">
                                            {selectedEntry.category}
                                        </span>
                                    )}
                                    <span className="inline-flex items-center px-3 py-1 bg-white/70 rounded-full text-xs font-bold text-neutral-700 shadow-sm">
                                        {formatFullDate(selectedEntry.assigned_date)}
                                    </span>
                                </div>
                                <h2 className="text-xl font-bold text-neutral-800 leading-relaxed">{selectedEntry.question}</h2>
                            </div>

                            <div className="p-5 space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-white/70 rounded-2xl border border-white p-3 shadow-sm">
                                        <div className="text-[11px] font-bold text-neutral-600 mb-2">{myDisplayName} felt</div>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {getMoodList(selectedEntry.my_answer).map(id => (
                                                <MoodIcon key={id} moodId={id} className="w-8 h-8" />
                                            ))}
                                        </div>
                                    </div>
                                    <div className="bg-white/70 rounded-2xl border border-white p-3 shadow-sm">
                                        <div className="text-[11px] font-bold text-neutral-600 mb-2">{partnerDisplayName} felt</div>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {getMoodList(selectedEntry.partner_answer).map(id => (
                                                <MoodIcon key={id} moodId={id} className="w-8 h-8" />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white/70 rounded-2xl p-4 border border-white shadow-sm">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-bold text-amber-700">{myDisplayName}'s answer</span>
                                    </div>
                                    <p className="text-neutral-700 leading-relaxed">{selectedEntry.my_answer?.answer}</p>
                                </div>

                                <div className="bg-white/70 rounded-2xl p-4 border border-pink-200 shadow-sm">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-bold text-pink-700">{partnerDisplayName}'s answer</span>
                                    </div>
                                    <p className="text-neutral-700 leading-relaxed">{selectedEntry.partner_answer?.answer}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-8 h-8 border-2 border-violet-400 border-t-transparent rounded-full"
                        />
                    </div>
                ) : filteredHistory.length === 0 ? (
                    <Motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center py-12"
                    >
                        <h3 className="text-lg font-bold text-neutral-700 mb-2">
                            {searchQuery ? 'No matches found' : 'Your story begins here'}
                        </h3>
                        <p className="text-neutral-500 text-sm max-w-xs mx-auto">
                            {searchQuery
                                ? 'Try a different search term'
                                : 'Answer daily questions together to build your shared story'}
                        </p>
                    </Motion.div>
                ) : (
                    <div className="space-y-6">
                        {Object.entries(groupedHistory).map(([monthYear, items], groupIndex) => (
                            <Motion.div
                                key={monthYear}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: groupIndex * 0.08 }}
                            >
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full shadow-sm border border-neutral-100">
                                        <Calendar className="w-4 h-4 text-violet-500" />
                                        <span className="text-sm font-bold text-neutral-700">{monthYear}</span>
                                    </div>
                                    <div className="flex-1 h-px bg-gradient-to-r from-neutral-200 to-transparent" />
                                </div>

                                <div className="space-y-2">
                                    {items.map((item, index) => (
                                        <Motion.button
                                            key={item.id}
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => setSelectedEntry(item)}
                                            className="w-full glass-card p-4 text-left"
                                        >
                                            <p className="text-sm font-bold text-neutral-800 line-clamp-2 leading-snug">
                                                {item.question}
                                            </p>
                                            <div className="flex items-center justify-between gap-3 mt-2">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    {item.category && (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-100 text-neutral-600">
                                                            {item.category}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-neutral-400">
                                                    {formatDate(item.assigned_date)}
                                                </div>
                                            </div>
                                        </Motion.button>
                                    ))}
                                </div>
                            </Motion.div>
                        ))}
                    </div>
                )}
            </div>
            </div>
        </RequirePartner>
    );
};

export default DailyMeowHistoryPage;
