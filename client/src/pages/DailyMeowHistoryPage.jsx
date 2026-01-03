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
import { useI18n } from '../i18n';

// Mood options with custom images (matching DailyMeowPage.jsx)
const MOOD_OPTIONS = [
    // Positive moods
    { id: 'happy', image: '/assets/emotions/happy.png', labelKey: 'moods.happy' },
    { id: 'loved', image: '/assets/emotions/loved.png', labelKey: 'moods.loved' },
    { id: 'grateful', image: '/assets/emotions/grateful.png', labelKey: 'moods.grateful' },
    { id: 'excited', image: '/assets/emotions/excited.png', labelKey: 'moods.excited' },
    { id: 'peaceful', image: '/assets/emotions/peaceful.png', labelKey: 'moods.peaceful' },
    { id: 'playful', image: '/assets/emotions/playful.png', labelKey: 'moods.playful' },
    { id: 'cozy', image: '/assets/emotions/cozy.png', labelKey: 'moods.cozy' },
    { id: 'romantic', image: '/assets/emotions/romantic.png', labelKey: 'moods.romantic' },
    { id: 'silly', image: '/assets/emotions/silly.png', labelKey: 'moods.silly' },
    { id: 'hopeful', image: '/assets/emotions/hopeful.png', labelKey: 'moods.hopeful' },
    // Neutral/Challenging moods
    { id: 'tired', image: '/assets/emotions/tired.png', labelKey: 'moods.tired' },
    { id: 'stressed', image: '/assets/emotions/stressed.png', labelKey: 'moods.stressed' },
    { id: 'anxious', image: '/assets/emotions/anxious.png', labelKey: 'moods.anxious' },
    { id: 'sad', image: '/assets/emotions/sad.png', labelKey: 'moods.sad' },
    { id: 'frustrated', image: '/assets/emotions/frustrated.png', labelKey: 'moods.frustrated' },
    { id: 'overwhelmed', image: '/assets/emotions/overwhelmed.png', labelKey: 'moods.overwhelmed' },
    { id: 'lonely', image: '/assets/emotions/lonely.png', labelKey: 'moods.lonely' },
    { id: 'confused', image: '/assets/emotions/confused.png', labelKey: 'moods.confused' },
    { id: 'meh', image: '/assets/emotions/meh.png', labelKey: 'moods.meh' },
    { id: 'hangry', image: '/assets/emotions/hangry.png', labelKey: 'moods.hangry' },
];

// MoodIcon component to render custom images
const MoodIcon = ({ moodId, label, className = 'w-6 h-6' }) => {
    const mood = MOOD_OPTIONS.find(m => m.id === moodId);
    if (!mood) return null;
    if (mood.image) {
        return <img src={mood.image} alt={label} className={`${className} object-contain`} />;
    }
    return null;
};

const DailyMeowHistoryPage = () => {
    const navigate = useNavigate();
    const { t, language } = useI18n();
    const { user: authUser, profile, partner: connectedPartner } = useAuthStore();

    const myId = authUser?.id;
    const partnerId = connectedPartner?.id;
    const partnerDisplayName = connectedPartner?.display_name || t('common.yourPartner');
    const myDisplayName = profile?.display_name || t('common.you');

    // State
    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState([]);
    const [selectedEntry, setSelectedEntry] = useState(null);
    const filter = 'all' // 'all', 'completed', 'mine-only'
    const [searchQuery, setSearchQuery] = useState('');

    const fetchHistory = useCallback(async () => {
        if (!myId || !partnerId) return;

        const cacheKey = `${CACHE_KEYS.DAILY_HISTORY}:${myId}:${partnerId}:${language}`;

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
    }, [myId, partnerId, language]);

    useEffect(() => {
        if (myId && partnerId) {
            fetchHistory();
        } else {
            setLoading(false);
        }
    }, [fetchHistory, myId, partnerId, language]);

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

        if (diffDays === 0) return t('common.today');
        if (diffDays === 1) return t('common.yesterday');
        if (diffDays < 7) return date.toLocaleDateString(language, { weekday: 'long' });

        return date.toLocaleDateString(language, {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    };

    const formatFullDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString(language, {
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
        const monthYear = date.toLocaleDateString(language, { month: 'long', year: 'numeric' });

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
            feature={t('dailyMeowHistory.feature')}
            description={t('dailyMeowHistory.requirePartnerDescription')}
        >
            <div className="relative min-h-screen overflow-hidden pb-6">
            <QuestionBackdrop />
            <div className="relative space-y-6">
            {/* Header */}
            <Motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}

            >
                <div className="flex items-start gap-3">
                    <Motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate(-1)}
                        className="rounded-2xl border border-white/80 bg-white/80 p-2 shadow-soft"
                    >
                        <ChevronLeft className="w-5 h-5 text-neutral-600" />
                    </Motion.button>
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-600">
                            {t('dailyMeowHistory.headerLabel')}
                        </p>
                        <h1 className="text-2xl font-display font-bold text-neutral-800">{t('dailyMeowHistory.title')}</h1>
                        <p className="text-neutral-500 text-sm">{t('dailyMeowHistory.subtitle')}</p>
                    </div>
                </div>
            </Motion.div>

            {/* Journey */}
            <Motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
            >
                <div className="glass-card relative overflow-hidden p-4 flex items-center justify-between gap-3">
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute -top-8 -right-6 h-20 w-20 rounded-full bg-amber-200/30 blur-2xl" />
                        <div className="absolute -bottom-10 -left-8 h-24 w-24 rounded-full bg-rose-200/25 blur-2xl" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-amber-600" />
                            <span className="text-sm font-bold text-neutral-800">{t('dailyMeowHistory.journeyTitle')}</span>
                        </div>
                        <p className="text-xs text-neutral-500 mt-0.5">{t('dailyMeowHistory.journeySubtitle')}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="px-3 py-1.5 rounded-full bg-white/80 border border-white/80 text-[11px] font-bold text-neutral-700">
                            {t('dailyMeowHistory.answeredCount', { count: totalAnswered })}
                        </div>
                        <div className="px-3 py-1.5 rounded-full bg-amber-100/70 border border-amber-200/70 text-[11px] font-bold text-amber-700">
                            {t('dailyMeowHistory.streakCount', { count: streak })}
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
                        placeholder={t('dailyMeowHistory.searchPlaceholder')}
                        className="w-full pl-11 pr-4 py-3 bg-white/85 rounded-2xl border border-white/80 text-sm focus:border-amber-300 focus:ring-2 focus:ring-amber-200/40 outline-none shadow-inner-soft"
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
                            className="w-full py-3 bg-white/85 text-neutral-700 font-bold rounded-2xl shadow-soft border border-white/80"
                        >
                            {t('dailyMeowHistory.backToArchives')}
                        </Motion.button>

                        <div className="glass-card relative overflow-hidden">
                            <div className="absolute inset-0 pointer-events-none">
                                <div className="absolute -top-10 -right-8 h-24 w-24 rounded-full bg-amber-200/30 blur-2xl" />
                                <div className="absolute -bottom-12 -left-10 h-28 w-28 rounded-full bg-rose-200/25 blur-3xl" />
                            </div>
                            <div className="relative p-5 text-center border-b border-white/50">
                                <h1 className="text-lg font-display font-bold text-neutral-800 tracking-tight mb-2">{t('dailyMeowHistory.dailyQuestionTitle')}</h1>
                                <div className="flex items-center justify-center gap-2 mb-3">
                                    {selectedEntry.category && (
                                        <span className="inline-flex items-center px-3 py-1 bg-white/80 rounded-full text-xs font-bold text-neutral-700 shadow-sm">
                                            {selectedEntry.category}
                                        </span>
                                    )}
                                    <span className="inline-flex items-center px-3 py-1 bg-white/80 rounded-full text-xs font-bold text-neutral-700 shadow-sm">
                                        {formatFullDate(selectedEntry.assigned_date)}
                                    </span>
                                </div>
                                <h2 className="text-xl font-bold text-neutral-800 leading-relaxed">{selectedEntry.question}</h2>
                            </div>

                            <div className="relative p-5 space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-white/80 rounded-2xl border border-white/80 p-3 shadow-sm">
                                        <div className="text-[11px] font-bold text-neutral-600 mb-2">{t('dailyMeowHistory.felt', { name: myDisplayName })}</div>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {getMoodList(selectedEntry.my_answer).map(id => {
                                                const mood = getMoodData(id)
                                                const label = mood ? t(mood.labelKey) : id
                                                return <MoodIcon key={id} moodId={id} label={label} className="w-8 h-8" />
                                            })}
                                        </div>
                                    </div>
                                    <div className="bg-white/80 rounded-2xl border border-white/80 p-3 shadow-sm">
                                        <div className="text-[11px] font-bold text-neutral-600 mb-2">{t('dailyMeowHistory.felt', { name: partnerDisplayName })}</div>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {getMoodList(selectedEntry.partner_answer).map(id => {
                                                const mood = getMoodData(id)
                                                const label = mood ? t(mood.labelKey) : id
                                                return <MoodIcon key={id} moodId={id} label={label} className="w-8 h-8" />
                                            })}
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white/80 rounded-2xl p-4 border border-white/80 shadow-sm">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-bold text-amber-700">{t('dailyMeowHistory.answerLabel', { name: myDisplayName })}</span>
                                    </div>
                                    <p className="text-neutral-700 leading-relaxed">{selectedEntry.my_answer?.answer}</p>
                                </div>

                                <div className="bg-white/80 rounded-2xl p-4 border border-rose-200/70 shadow-sm">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-bold text-rose-700">{t('dailyMeowHistory.answerLabel', { name: partnerDisplayName })}</span>
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
                            className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full"
                        />
                    </div>
                ) : filteredHistory.length === 0 ? (
                    <Motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center py-12"
                    >
                        <h3 className="text-lg font-bold text-neutral-700 mb-2">
                            {searchQuery ? t('dailyMeowHistory.emptySearchTitle') : t('dailyMeowHistory.emptyTitle')}
                        </h3>
                        <p className="text-neutral-500 text-sm max-w-xs mx-auto">
                            {searchQuery
                                ? t('dailyMeowHistory.emptySearchHint')
                                : t('dailyMeowHistory.emptyHint')}
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
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/80 rounded-full shadow-soft border border-white/80">
                                        <Calendar className="w-4 h-4 text-amber-600" />
                                        <span className="text-sm font-bold text-neutral-700">{monthYear}</span>
                                    </div>
                                    <div className="flex-1 h-px bg-gradient-to-r from-amber-100/80 to-transparent" />
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
                                            className="w-full glass-card relative overflow-hidden p-4 text-left"
                                        >
                                            <div className="absolute inset-0 pointer-events-none">
                                                <div className="absolute -top-8 -right-6 h-16 w-16 rounded-full bg-amber-200/30 blur-2xl" />
                                            </div>
                                            <div className="absolute inset-x-6 top-0 h-0.5 bg-gradient-to-r from-transparent via-amber-200/70 to-transparent" />
                                            <p className="text-sm font-bold text-neutral-800 line-clamp-2 leading-snug">
                                                {item.question}
                                            </p>
                                            <div className="flex items-center justify-between gap-3 mt-2">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    {item.category && (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100/70 text-amber-700 border border-amber-200/70">
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
            </div>
        </RequirePartner>
    );
};

const QuestionBackdrop = () => (
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

export default DailyMeowHistoryPage;
