import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    Heart, Check,
    Edit3, Send, Lock, AlertCircle, RefreshCw, BookOpen, ChevronRight
} from 'lucide-react';
import useAuthStore from '../store/useAuthStore';
import usePartnerStore from '../store/usePartnerStore';
import useCacheStore, { CACHE_POLICY, cacheKey } from '../store/useCacheStore';
import RequirePartner from '../components/RequirePartner';
import api from '../services/api';
import { subscribeToDailyAnswers, supabase } from '../services/supabase';
import { useI18n } from '../i18n';

// 20 mood/feeling options with emojis - organized by positive/neutral/challenging
const MOOD_OPTIONS = [
    // Positive moods
    { id: 'happy', image: '/assets/emotions/happy.png', labelKey: 'moods.happy', color: 'from-yellow-100 to-amber-100' },
    { id: 'loved', image: '/assets/emotions/loved.png', labelKey: 'moods.loved', color: 'from-pink-100 to-rose-100' },
    { id: 'grateful', image: '/assets/emotions/grateful.png', labelKey: 'moods.grateful', color: 'from-amber-100 to-orange-100' },
    { id: 'excited', image: '/assets/emotions/excited.png', labelKey: 'moods.excited', color: 'from-yellow-100 to-lime-100' },
    { id: 'peaceful', image: '/assets/emotions/peaceful.png', labelKey: 'moods.peaceful', color: 'from-cyan-100 to-teal-100' },
    { id: 'playful', image: '/assets/emotions/playful.png', labelKey: 'moods.playful', color: 'from-orange-100 to-amber-100' },
    { id: 'cozy', image: '/assets/emotions/cozy.png', labelKey: 'moods.cozy', color: 'from-amber-100 to-yellow-100' },
    { id: 'romantic', image: '/assets/emotions/romantic.png', labelKey: 'moods.romantic', color: 'from-rose-100 to-pink-100' },
    { id: 'silly', image: '/assets/emotions/silly.png', labelKey: 'moods.silly', color: 'from-lime-100 to-green-100' },
    { id: 'hopeful', image: '/assets/emotions/hopeful.png', labelKey: 'moods.hopeful', color: 'from-violet-100 to-purple-100' },
    // Neutral/Challenging moods
    { id: 'tired', image: '/assets/emotions/tired.png', labelKey: 'moods.tired', color: 'from-slate-100 to-gray-100' },
    { id: 'stressed', image: '/assets/emotions/stressed.png', labelKey: 'moods.stressed', color: 'from-orange-100 to-red-100' },
    { id: 'anxious', image: '/assets/emotions/anxious.png', labelKey: 'moods.anxious', color: 'from-blue-100 to-indigo-100' },
    { id: 'sad', image: '/assets/emotions/sad.png', labelKey: 'moods.sad', color: 'from-blue-100 to-slate-100' },
    { id: 'frustrated', image: '/assets/emotions/frustrated.png', labelKey: 'moods.frustrated', color: 'from-red-100 to-orange-100' },
    { id: 'lonely', image: '/assets/emotions/lonely.png', labelKey: 'moods.lonely', color: 'from-indigo-100 to-blue-100' },
    { id: 'hangry', image: '/assets/emotions/hangry.png', labelKey: 'moods.hangry', color: 'from-orange-100 to-yellow-100' },
    { id: 'confused', image: '/assets/emotions/confused.png', labelKey: 'moods.confused', color: 'from-violet-100 to-fuchsia-100' },
    { id: 'meh', image: '/assets/emotions/meh.png', labelKey: 'moods.meh', color: 'from-gray-100 to-slate-100' },
    { id: 'overwhelmed', image: '/assets/emotions/overwhelmed.png', labelKey: 'moods.overwhelmed', color: 'from-purple-100 to-pink-100' },
];

const DailyMeowPage = () => {
    const navigate = useNavigate();
    const { t, language } = useI18n();
    const { user: authUser, profile } = useAuthStore();
    const { hasPartner, partner: connectedPartner } = usePartnerStore();

    const myId = authUser?.id;
    const partnerId = connectedPartner?.id;
    const partnerDisplayName = connectedPartner?.display_name || t('common.yourPartner');
    const myDisplayName = profile?.display_name || profile?.name || authUser?.user_metadata?.full_name || t('common.you');

    // Ref to prevent duplicate fetches per couple pair
    const fetchedKeyRef = useRef('');

    // State
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [todaysQuestion, setTodaysQuestion] = useState(null);
    const [answer, setAnswer] = useState('');
    const [selectedMoods, setSelectedMoods] = useState([]); // Array for 1-3 moods
    const [moodLocked, setMoodLocked] = useState(false); // Only lock after submission
    const [isEditing, setIsEditing] = useState(false);
    const [editingAnswer, setEditingAnswer] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [step, setStep] = useState('mood'); // 'mood' | 'answer' | 'done'
    const [showCompletionView, setShowCompletionView] = useState(false); // Bug 2: show completion before next backlog
    const [hasBacklog, setHasBacklog] = useState(false); // Track if there's a backlog question

    // Timeout for loading state to prevent infinite loading
    useEffect(() => {
        const timeout = setTimeout(() => {
            if (loading && hasPartner && (!myId || !partnerId)) {
                setLoading(false);
                setError(t('dailyMeow.errors.userDataUnavailable'));
            }
        }, 5000); // 5 second timeout
        return () => clearTimeout(timeout);
    }, [loading, hasPartner, myId, partnerId]);

    const applyQuestionData = useCallback((questionData) => {
        if (!questionData) {
            setTodaysQuestion(null);
            return;
        }

        if (!questionData.assignment_id || !questionData.question) {
            console.error('DailyMeow: Invalid response structure', questionData);
            setError(t('dailyMeow.errors.invalidQuestion'));
            return;
        }

        setTodaysQuestion(questionData);
        // Track if this is a backlog question (for Bug 2 continue button)
        setHasBacklog(!!questionData.is_backlog);

        // Determine initial state based on existing answer
        if (questionData.my_answer) {
            setAnswer(questionData.my_answer.answer || '');
            // Handle both single mood (legacy) and multi-mood
            const existingMoods = questionData.my_answer.moods || (questionData.my_answer.mood ? [questionData.my_answer.mood] : []);
            setSelectedMoods(existingMoods);
            setMoodLocked(existingMoods.length > 0);
            setStep('done');
        } else {
            setAnswer('');
            setSelectedMoods([]);
            setMoodLocked(false);
            setStep('mood');
        }
    }, [t]);

    // Fetch today's question
    const fetchTodaysQuestion = useCallback(async ({ force = false } = {}) => {
        if (!myId || !partnerId) {
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const cacheStore = useCacheStore.getState();
            const key = cacheKey.dailyQuestion(myId, partnerId, language);
            if (force) {
                const fresh = await cacheStore.fetchAndCache(key, async () => {
                    const response = await api.get('/daily-questions/today', {
                        params: { userId: myId, partnerId }
                    });
                    return response.data;
                }, CACHE_POLICY.DAILY_QUESTION);
                applyQuestionData(fresh);
                return;
            }

            const { data, promise } = await cacheStore.getOrFetch({
                key,
                fetcher: async () => {
                    const response = await api.get('/daily-questions/today', {
                        params: { userId: myId, partnerId }
                    });
                    return response.data;
                },
                ...CACHE_POLICY.DAILY_QUESTION,
                revalidateOnInterval: true,
            });

            if (!data) {
                setError(t('dailyMeow.errors.noData'));
                return;
            }

            applyQuestionData(data);

            if (promise) {
                promise.then((fresh) => {
                    if (!fresh) return;
                    applyQuestionData(fresh);
                }).catch(() => {});
            }
        } catch (err) {
            console.error('Error fetching today\'s question:', err);
            const errorCode = err.response?.data?.errorCode;
            const errorMessage = errorCode
                ? t(`errors.${errorCode}`)
                : (err.response?.data?.error || err.message || t('dailyMeow.errors.loadFailed'));
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [myId, partnerId, t, language, applyQuestionData]);

    useEffect(() => {
        if (myId && partnerId) {
            const key = `${myId}:${partnerId}:${language}`;
            if (fetchedKeyRef.current !== key) {
                fetchedKeyRef.current = key;
                fetchTodaysQuestion();
            }
        } else if (hasPartner && (!myId || !partnerId)) {
            setLoading(true);
        } else if (!hasPartner) {
            setLoading(false);
        }
    }, [myId, partnerId, hasPartner, fetchTodaysQuestion, language]);

    useEffect(() => {
        if (!myId || !partnerId) return;
        const cacheStore = useCacheStore.getState();
        const key = cacheKey.dailyQuestion(myId, partnerId, language);
        const unsubscribe = cacheStore.subscribeKey(key, (nextQuestion) => {
            if (!nextQuestion) return;
            applyQuestionData(nextQuestion);
        });
        return unsubscribe;
    }, [myId, partnerId, language, applyQuestionData]);

    // Bug 1: Real-time subscription for partner answer updates
    useEffect(() => {
        const assignmentId = todaysQuestion?.assignment_id;
        const hasAnswered = !!todaysQuestion?.my_answer;
        const partnerHasAnswered = !!todaysQuestion?.partner_answer;

        // Only subscribe if user has answered but partner hasn't
        if (!assignmentId || !hasAnswered || partnerHasAnswered) {
            return;
        }

        if (import.meta.env.DEV) console.log('[DailyMeow] Setting up real-time subscription for assignment:', assignmentId);

        const subscription = subscribeToDailyAnswers(assignmentId, (payload) => {
            if (import.meta.env.DEV) console.log('[DailyMeow] Partner answer received:', payload);
            // Refetch to get updated data including partner's answer
            fetchTodaysQuestion({ force: true });
        });

        return () => {
            if (import.meta.env.DEV) console.log('[DailyMeow] Cleaning up subscription');
            supabase.removeChannel(subscription);
        };
    }, [todaysQuestion?.assignment_id, todaysQuestion?.my_answer, todaysQuestion?.partner_answer, fetchTodaysQuestion]);

    // Require partner
    if (!hasPartner) {
        return (
            <RequirePartner
                feature={t('dailyMeow.feature')}
                description={t('dailyMeow.requirePartnerDescription')}
            >
                <div className="space-y-4">
                    <div className="glass-card p-8 text-center">
                        <Cat className="w-16 h-16 mx-auto text-amber-500 mb-4" />
                        <h2 className="text-xl font-bold text-neutral-800">{t('dailyMeow.feature')}</h2>
                        <p className="text-neutral-500 mt-2">{t('dailyMeow.tagline')}</p>
                    </div>
                </div>
            </RequirePartner>
        );
    }

    const handleMoodSelect = (mood) => {
        if (moodLocked) return; // Cannot change after submission

        setSelectedMoods(prev => {
            // If already selected, remove it
            if (prev.includes(mood.id)) {
                return prev.filter(m => m !== mood.id);
            }
            // If less than 3 selected, add it
            if (prev.length < 3) {
                return [...prev, mood.id];
            }
            // Already have 3, don't add more
            return prev;
        });
    };

    const confirmMood = () => {
        if (selectedMoods.length === 0) return;
        // Don't lock moods here - only lock on submit
        setStep('answer');
    };

    const handleSubmit = async () => {
        if (!answer.trim() || !todaysQuestion?.assignment_id || selectedMoods.length === 0) return;

        try {
            setSubmitting(true);
            // Lock moods on submission
            setMoodLocked(true);
            const response = await api.post('/daily-questions/answer', {
                userId: myId,
                assignmentId: todaysQuestion.assignment_id,
                answer: answer.trim(),
                mood: selectedMoods[0], // Primary mood for backward compatibility
                moods: selectedMoods // All selected moods
            });

            // Invalidate related caches
            const cacheStore = useCacheStore.getState();
            const questionKey = cacheKey.dailyQuestion(myId, partnerId, language);
            cacheStore.invalidate(cacheKey.stats(myId));
            const statsRefresh = cacheStore.revalidate(cacheKey.stats(myId), { onlyStale: false });
            if (statsRefresh?.catch) statsRefresh.catch(() => {});
            const historyKey = cacheKey.dailyHistory(myId, partnerId, language);
            const historyRefresh = cacheStore.fetchAndCache(historyKey, async () => {
                const response = await api.get('/daily-questions/history', {
                    params: { userId: myId, partnerId, limit: 100 }
                });
                return response.data || [];
            }, CACHE_POLICY.DAILY_HISTORY);
            if (historyRefresh?.catch) historyRefresh.catch(() => {});

            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 2000);

            // Bug 2 Fix: If both answered, update local state with partner's answer
            // The API now returns partner_answer, so we can display it immediately
            if (response.data?.both_answered) {
                // Update the current question state to include partner's answer
                const nextQuestion = todaysQuestion
                    ? {
                        ...todaysQuestion,
                        partner_answer: response.data.partner_answer || todaysQuestion.partner_answer,
                        my_answer: todaysQuestion.my_answer || response.data.answer,
                    }
                    : null;
                if (nextQuestion) {
                    setTodaysQuestion(nextQuestion);
                    cacheStore.setCache(
                        questionKey,
                        nextQuestion,
                        CACHE_POLICY.DAILY_QUESTION.ttlMs,
                        CACHE_POLICY.DAILY_QUESTION.staleMs
                    );
                }
                // Show completion view - user sees their and partner's answers before potentially moving on
                setShowCompletionView(true);
                setStep('done');
            } else {
                if (todaysQuestion && response.data?.answer) {
                    const nextQuestion = {
                        ...todaysQuestion,
                        my_answer: response.data.answer,
                    };
                    setTodaysQuestion(nextQuestion);
                    cacheStore.setCache(
                        questionKey,
                        nextQuestion,
                        CACHE_POLICY.DAILY_QUESTION.ttlMs,
                        CACHE_POLICY.DAILY_QUESTION.staleMs
                    );
                }
                // Partner hasn't answered yet - fetch updates normally
                await fetchTodaysQuestion({ force: true });
            }
        } catch (err) {
            console.error('Error submitting answer:', err);
            setError(t('dailyMeow.errors.submitFailed'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = async () => {
        if (!editingAnswer.trim() || !todaysQuestion?.my_answer?.id) return;

        try {
            setSubmitting(true);
            // Note: mood is NOT included - it cannot be changed
            await api.put(`/daily-questions/answer/${todaysQuestion.my_answer.id}`, {
                answer: editingAnswer.trim()
            });

            setIsEditing(false);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 2000);

            await fetchTodaysQuestion({ force: true });
        } catch (err) {
            console.error('Error editing answer:', err);
            setError(t('dailyMeow.errors.updateFailed'));
        } finally {
            setSubmitting(false);
        }
    };

    const startEditing = () => {
        setEditingAnswer(answer);
        setIsEditing(true);
    };

    const getMoodData = (moodId) => MOOD_OPTIONS.find(m => m.id === moodId);

    const MoodIcon = ({ moodId, className = 'w-6 h-6' }) => {
        const mood = getMoodData(moodId);
        if (!mood) return null

        if (mood.image) {
            return <img src={mood.image} alt={t(mood.labelKey)} className={`${className} object-contain`} />
        }

        if (mood.emoji) {
            return <span className="text-xl">{mood.emoji}</span>
        }

        return null
    }

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString(language, {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
        });
    };

    const formatEditedDate = (dateStr) => {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        return date.toLocaleDateString(language, {
            month: 'short',
            day: 'numeric'
        });
    };

    const hasAnswered = !!todaysQuestion?.my_answer;
    const partnerHasAnswered = !!todaysQuestion?.partner_answer;
    const bothAnswered = hasAnswered && partnerHasAnswered;
    const isBacklog = todaysQuestion?.is_backlog;

    const stepLabel = hasAnswered
        ? t('dailyMeow.step.shared')
        : step === 'mood'
            ? t('dailyMeow.step.mood')
            : step === 'answer'
                ? t('dailyMeow.step.answer')
                : t('dailyMeow.step.shared')
    const moodSelectedLabel = t('dailyMeow.moodsSelected', {
        count: selectedMoods.length,
        suffix: selectedMoods.length === 1 ? '' : 's'
    })
    const canConfirmMood = selectedMoods.length > 0
    const canSubmitAnswer = !!answer.trim() && selectedMoods.length > 0 && !submitting
    const moodCtaTitle = canConfirmMood ? t('common.continue') : t('dailyMeow.pickMood')

    const partnerMoodIds = (todaysQuestion?.partner_answer?.moods || (todaysQuestion?.partner_answer?.mood ? [todaysQuestion.partner_answer.mood] : [])).slice(0, 3)

    return (
        <div className="relative min-h-[calc(100dvh-120px)] flex flex-col overflow-hidden pb-6">
            {/* Background gradient */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-amber-200/30 blur-3xl" />
                <div className="absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-rose-200/25 blur-3xl" />
            </div>
            <div className="relative flex-1 flex flex-col">
            {/* Success Toast */}
            <AnimatePresence>
                {showSuccess && (
                    <Motion.div
                        initial={{ opacity: 0, y: -20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 glass-card px-5 py-3 text-emerald-700 font-semibold flex items-center gap-2"
                    >
                        <Check className="w-5 h-5" />
                        <span className="font-medium">{t('dailyMeow.toast.saved')}</span>
                    </Motion.div>
                )}
            </AnimatePresence>

            {/* Loading State */}
            {loading && (
                <div className="flex-1 flex items-center justify-center px-4">
                    <div className="glass-card p-6 text-center max-w-sm">
                        <Motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-10 h-10 border-3 border-amber-400 border-t-transparent rounded-full mx-auto"
                        />
                        <p className="text-neutral-500 mt-4">{t('dailyMeow.loading')}</p>
                    </div>
                </div>
            )}

            {/* Error State */}
            {error && !loading && (
                <div className="flex-1 flex items-center justify-center p-4">
                    <div className="glass-card p-6 text-center max-w-sm border border-rose-200/60">
                        <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-3" />
                        <p className="text-neutral-600 font-medium mb-4">{error}</p>
                        <button
                            onClick={() => fetchTodaysQuestion({ force: true })}
                            className="px-5 py-2.5 bg-white/80 text-neutral-600 rounded-xl font-medium flex items-center gap-2 mx-auto border border-neutral-200/70"
                        >
                            <RefreshCw className="w-4 h-4" />
                            {t('common.tryAgain')}
                        </button>
                    </div>
                </div>
            )}

            {/* No Question Available State */}
            {!loading && !error && !todaysQuestion && (
                <div className="flex-1 flex items-center justify-center p-4">
                    <div className="glass-card p-6 text-center max-w-sm border border-amber-200/60">
                        <Cat className="w-16 h-16 text-amber-400 mx-auto mb-3" />
                        <h3 className="text-lg font-bold text-neutral-800 mb-2">{t('dailyMeow.noQuestions.title')}</h3>
                        <p className="text-neutral-500 text-sm mb-4">{t('dailyMeow.noQuestions.body')}</p>
                        <button
                            onClick={() => fetchTodaysQuestion({ force: true })}
                            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-rose-400 text-white rounded-xl font-medium flex items-center gap-2 mx-auto shadow-soft"
                        >
                            <RefreshCw className="w-4 h-4" />
                            {t('common.refresh')}
                        </button>
                    </div>
                </div>
            )}

            {/* Main Content */}
            {!loading && !error && todaysQuestion && (
                <div className="flex-1 flex flex-col">
                    {/* Question Card */}
                    <Motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-card relative overflow-hidden flex-1 flex flex-col"
                    >
                        <div className="absolute inset-0 pointer-events-none">
                            <div className="absolute -top-12 -right-8 h-28 w-28 rounded-full bg-amber-200/30 blur-3xl" />
                            <div className="absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-rose-200/25 blur-3xl" />
                            <div
                                className="absolute inset-0 opacity-40"
                                style={{
                                    backgroundImage:
                                        'radial-gradient(circle at 12% 10%, rgba(255,255,255,0.75) 0%, transparent 55%), radial-gradient(circle at 82% 12%, rgba(255,235,210,0.75) 0%, transparent 60%)'
                                }}
                            />
                        </div>
                        <div className="relative flex-1 flex flex-col">
                        {/* Question Header */}
                        <div className="p-6 text-center border-b border-white/60">
                            <div className="text-[10px] uppercase tracking-[0.35em] text-neutral-500 font-semibold mb-2">
                                {t('dailyMeow.title')}
                            </div>
                            <h1 className="text-lg font-bold text-neutral-800 tracking-tight mb-3">
                                {t('dailyMeow.questionTitle')}
                            </h1>
                            <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/70 rounded-full text-xs font-bold text-amber-700 shadow-sm">
                                    <Heart className="w-3 h-3" />
                                    {isBacklog ? t('dailyMeow.badge.catchUp') : t('common.today')}
                                </span>
                                {isBacklog && (
                                    <span className="inline-flex items-center px-3 py-1 bg-white/70 rounded-full text-xs font-bold text-neutral-700 shadow-sm">
                                        {formatDate(todaysQuestion.assigned_date)}
                                    </span>
                                )}
                                {todaysQuestion.category && (
                                    <span className="inline-flex items-center px-3 py-1 bg-white/70 rounded-full text-xs font-bold text-neutral-700 shadow-sm">
                                        {todaysQuestion.category}
                                    </span>
                                )}
                                {step === 'mood' && (
                                    <span className="inline-flex items-center px-3 py-1 bg-white/70 rounded-full text-xs font-bold text-neutral-700 shadow-sm">
                                        {stepLabel}
                                    </span>
                                )}
                                {step === 'answer' && (
                                    <span className="inline-flex items-center px-3 py-1 bg-white/70 rounded-full text-xs font-bold text-neutral-700 shadow-sm">
                                        {stepLabel}
                                    </span>
                                )}
                                {step === 'done' && !hasAnswered && (
                                    <span className="inline-flex items-center px-3 py-1 bg-white/70 rounded-full text-xs font-bold text-neutral-700 shadow-sm">
                                        {stepLabel}
                                    </span>
                                )}
                            </div>
                            <h2 className="text-xl font-display font-bold text-neutral-800 leading-relaxed">
                                {todaysQuestion.question}
                            </h2>
                        </div>

                        {/* Step Content */}
                        <div className="flex-1 p-6 flex flex-col">
                            <AnimatePresence mode="wait">
                                {/* STEP 1: Mood Selection (MANDATORY) */}
                                {step === 'mood' && !hasAnswered && (
                                    <Motion.div
                                        key="mood-step"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="flex-1 flex flex-col"
                                    >
                                        <div className="text-center mb-3 space-y-2">
                                            <h3 className="text-lg font-display font-bold text-neutral-800">{t('dailyMeow.moodPrompt')}</h3>
                                            <p className="text-sm text-neutral-500">
                                                {t('dailyMeow.moodHint', { count: selectedMoods.length })}
                                            </p>
                                            <div className="inline-flex items-center gap-1 rounded-full border border-amber-200/70 bg-amber-50/70 px-3 py-1 text-[11px] font-semibold text-amber-700">
                                                <Lock className="w-3 h-3" />
                                                {t('dailyMeow.moodLockHint')}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-4 gap-3 flex-1 content-start">
                                            {MOOD_OPTIONS.map((mood) => (
                                                <Motion.button
                                                    key={mood.id}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => handleMoodSelect(mood)}
                                                    className={`aspect-square rounded-2xl border border-white/80 flex flex-col items-center justify-center p-1 transition-all ${selectedMoods.includes(mood.id)
                                                        ? 'bg-amber-50 ring-2 ring-amber-300 shadow-soft'
                                                        : 'bg-white/75 hover:bg-white'
                                                        }`}
                                                >
                                                    {mood.image ? (
                                                        <img
                                                            src={mood.image}
                                                            alt={mood.label}
                                                            className="w-16 h-16 object-contain"
                                                        />
                                                    ) : (
                                                        <span className="text-2xl">{mood.emoji}</span>
                                                    )}
                                                    <span className="text-[13px] text-neutral-600 font-semibold mt-0.5">{t(mood.labelKey)}</span>
                                                </Motion.button>
                                            ))}
                                        </div>

                                        <Motion.button
                                            whileHover={canConfirmMood ? { scale: 1.01 } : {}}
                                            whileTap={{ scale: canConfirmMood ? 0.98 : 1 }}
                                            onClick={confirmMood}
                                            disabled={!canConfirmMood}
                                            className={`group relative mt-4 w-full overflow-hidden rounded-[28px] border px-4 py-4 text-left transition-all ${canConfirmMood
                                                ? 'border-amber-200/70 bg-white/85 shadow-soft-lg hover:shadow-soft-xl'
                                                : 'border-amber-200/50 bg-court-cream/70 shadow-soft cursor-not-allowed'
                                                }`}
                                        >
                                            <span className={`absolute inset-x-6 top-0 h-0.5 bg-gradient-to-r from-transparent ${canConfirmMood ? 'via-amber-200/80' : 'via-amber-200/50'} to-transparent`} />
                                            <span className={`absolute -top-8 -right-6 h-16 w-16 rounded-full ${canConfirmMood ? 'bg-amber-200/35' : 'bg-amber-100/40'} blur-2xl`} />
                                            <div className="relative flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-2">
                                                    {canConfirmMood && (
                                                        <span className="flex items-center gap-1">
                                                            {selectedMoods.map(m => (
                                                                <MoodIcon key={m} moodId={m} className="w-6 h-6" />
                                                            ))}
                                                        </span>
                                                    )}
                                                    <div className="text-sm font-bold text-court-brown">{moodCtaTitle}</div>
                                                </div>
                                                <ChevronRight className={`w-5 h-5 ${canConfirmMood ? 'text-amber-600' : 'text-amber-400'}`} />
                                            </div>
                                        </Motion.button>
                                    </Motion.div>
                                )}

                                {/* STEP 2: Answer Input */}
                                {step === 'answer' && !hasAnswered && (
                                    <Motion.div
                                        key="answer-step"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="flex-1 flex flex-col"
                                    >
                                        {/* Selected Moods Display (can still change) */}
                                        <div className="flex items-center justify-between gap-3 mb-4 px-4 py-2 bg-white/80 rounded-2xl border border-amber-100/70 shadow-inner-soft">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="flex items-center gap-1">
                                                    {selectedMoods.map(m => (
                                                        <MoodIcon key={m} moodId={m} className="w-5 h-5" />
                                                    ))}
                                                </span>
                                                <span className="text-sm font-medium text-neutral-700 truncate">
                                                    {moodSelectedLabel}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => setStep('mood')}
                                                className="text-xs font-semibold text-amber-700 bg-amber-100/70 px-2 py-1 rounded-full"
                                            >
                                                {t('common.change')}
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs text-neutral-500 flex items-center gap-1">
                                                <Lock className="w-3 h-3" />
                                                {t('dailyMeow.privateUntilBoth')}
                                            </span>
                                        </div>

                                        <textarea
                                            value={answer}
                                            onChange={(e) => setAnswer(e.target.value)}
                                            placeholder={t('dailyMeow.answerPlaceholder')}
                                            className="flex-1 min-h-[150px] bg-white/80 rounded-2xl p-4 text-neutral-700 border border-neutral-200/70 focus:border-amber-300 focus:ring-2 focus:ring-amber-100 outline-none resize-none text-base placeholder:text-neutral-500 shadow-inner-soft"
                                            maxLength={1000}
                                            autoFocus
                                        />

                                        <div className="flex items-center justify-end mt-2">
                                            <span className="text-xs text-neutral-500">{answer.length}/1000</span>
                                        </div>

                                        <Motion.button
                                            whileHover={canSubmitAnswer ? { scale: 1.01 } : {}}
                                            whileTap={{ scale: canSubmitAnswer ? 0.98 : 1 }}
                                            onClick={handleSubmit}
                                            disabled={!canSubmitAnswer}
                                            className={`group relative mt-4 w-full overflow-hidden rounded-[28px] border px-4 py-3 text-left transition-all ${canSubmitAnswer
                                                ? 'border-amber-200/70 bg-white/85 shadow-soft-lg hover:shadow-soft-xl'
                                                : 'border-amber-200/50 bg-court-cream/70 shadow-soft cursor-not-allowed'
                                                }`}
                                        >
                                            <span className={`absolute inset-x-6 top-0 h-0.5 bg-gradient-to-r from-transparent ${canSubmitAnswer ? 'via-amber-200/80' : 'via-amber-200/50'} to-transparent`} />
                                            <span className={`absolute -top-8 -right-6 h-16 w-16 rounded-full ${canSubmitAnswer ? 'bg-amber-200/35' : 'bg-amber-100/40'} blur-2xl`} />
                                            <div className="relative flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-3">
                                                    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${canSubmitAnswer
                                                        ? 'border-amber-200/70 bg-amber-100/80'
                                                        : 'border-amber-200/60 bg-amber-50/80'
                                                        }`}>
                                                        {submitting ? (
                                                            <Motion.div
                                                                animate={{ rotate: 360 }}
                                                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                                                className="w-5 h-5 border-2 border-amber-600 border-t-transparent rounded-full"
                                                            />
                                                        ) : (
                                                            <Send className={`${canSubmitAnswer ? 'text-amber-700' : 'text-amber-500'} w-5 h-5`} />
                                                        )}
                                                    </div>
                                                    <div className="text-sm font-bold text-court-brown">
                                                        {t('dailyMeow.submitAnswer')}
                                                    </div>
                                                </div>
                                                <ChevronRight className={`w-5 h-5 ${canSubmitAnswer ? 'text-amber-600' : 'text-amber-400'}`} />
                                            </div>
                                        </Motion.button>
                                    </Motion.div>
                                )}

                                {/* STEP 3: Done - View Answers */}
                                {(step === 'done' || hasAnswered) && !isEditing && (
                                    <Motion.div
                                        key="done-step"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="flex-1 flex flex-col gap-4"
                                    >

                                        <div className="relative flex items-center justify-center py-1">
                                            <span className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-200/60 to-transparent" />
                                            <span className="relative z-10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-600 bg-white/85 border border-amber-200/60 rounded-full shadow-soft">
                                                {myDisplayName}
                                            </span>
                                        </div>

                                        <div className="space-y-3">
                                            {/* You felt */}
                                            <div className="rounded-3xl border border-white/80 bg-white/80 p-4 shadow-soft">
                                                <div className="text-[10px] uppercase tracking-[0.3em] text-neutral-500 font-semibold mb-3">{myDisplayName}</div>
                                                {selectedMoods.length > 0 ? (
                                                    <div className="grid grid-cols-3 gap-3 text-center">
                                                        {selectedMoods.map(m => {
                                                            const mood = MOOD_OPTIONS.find(opt => opt.id === m);
                                                            return (
                                                                <div key={m} className="flex flex-col items-center gap-1.5 w-full">
                                                                    <MoodIcon moodId={m} className="w-14 h-14" />
                                                                    <span className="text-[13px] font-semibold text-neutral-600 leading-tight">{mood ? t(mood.labelKey) : m}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <div className="text-xs text-neutral-500">—</div>
                                                )}
                                            </div>

                                            {/* My Answer */}
                                            <div className="rounded-3xl p-4 border border-amber-200/60 bg-amber-50/60 shadow-soft">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-sm font-bold text-amber-700">{myDisplayName}</span>
                                                    <button
                                                        onClick={startEditing}
                                                        className="flex items-center gap-1 text-xs text-amber-700 font-semibold px-2 py-1 rounded-full border border-amber-200/60 bg-white/80"
                                                    >
                                                        <Edit3 className="w-3 h-3" />
                                                        {t('common.edit')}
                                                    </button>
                                                </div>
                                                <p className="text-neutral-700 leading-relaxed">{answer}</p>
                                                {todaysQuestion.my_answer?.edited_at && (
                                                    <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                                                        <Edit3 className="w-3 h-3" />
                                                        {t('dailyMeow.editedAt', { date: formatEditedDate(todaysQuestion.my_answer.edited_at) })}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="relative flex items-center justify-center py-1">
                                            <span className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-200/60 to-transparent" />
                                            <span className="relative z-10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-600 bg-white/85 border border-amber-200/60 rounded-full shadow-soft">
                                                {partnerDisplayName}
                                            </span>
                                        </div>

                                        <div className="space-y-3">
                                            {/* Partner felt */}
                                            <div className="rounded-3xl border border-white/80 bg-white/80 p-4 shadow-soft">
                                                <div className="text-[10px] uppercase tracking-[0.3em] text-neutral-500 font-semibold mb-3">{partnerDisplayName}</div>
                                                {partnerHasAnswered ? (
                                                    partnerMoodIds.length > 0 ? (
                                                        <div className="grid grid-cols-3 gap-3 text-center">
                                                            {partnerMoodIds.map(m => {
                                                                const mood = MOOD_OPTIONS.find(opt => opt.id === m);
                                                                return (
                                                                    <div key={m} className="flex flex-col items-center gap-1.5 w-full">
                                                                        <MoodIcon moodId={m} className="w-14 h-14" />
                                                                        <span className="text-[13px] font-semibold text-neutral-600 leading-tight">{mood ? t(mood.labelKey) : m}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <div className="text-xs text-neutral-500">—</div>
                                                    )
                                                ) : (
                                                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                                                        <Lock className="w-4 h-4 text-neutral-500" />
                                                        {t('common.waiting')}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Partner's Answer or Waiting */}
                                            {bothAnswered ? (
                                                <Motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="rounded-3xl p-4 border border-rose-200/60 bg-rose-50/60 shadow-soft"
                                                >
                                                    <span className="text-sm font-bold text-pink-700">{partnerDisplayName}</span>
                                                    <p className="text-neutral-700 leading-relaxed">
                                                        {todaysQuestion.partner_answer?.answer}
                                                    </p>
                                                </Motion.div>
                                            ) : (
                                                <div className="bg-white/60 rounded-3xl p-6 border border-dashed border-neutral-200 text-center">
                                                    <Lock className="w-6 h-6 text-neutral-500 mx-auto mb-2" />
                                                    <p className="text-sm text-neutral-500">
                                                        {t('dailyMeow.partnerAnswerLocked', { name: partnerDisplayName })}
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Completion Celebration */}
                                        {bothAnswered && (
                                            <Motion.div
                                                initial={{ scale: 0, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                transition={{ type: "spring", delay: 0.2 }}
                                                className="flex flex-col items-center gap-3"
                                            >
                                                <span className="px-5 py-2.5 bg-emerald-100/80 border border-emerald-200/70 rounded-full text-sm font-bold text-emerald-700 flex items-center gap-2 shadow-soft">
                                                    {t('dailyMeow.bothAnsweredReward')}
                                                </span>

                                                {/* Bug 2: Continue button only shows when there's a backlog and completion view is active */}
                                                {showCompletionView && hasBacklog && (
                                                    <Motion.button
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: 0.4 }}
                                                        whileHover={{ scale: 1.01 }}
                                                        whileTap={{ scale: 0.98 }}
                                                        onClick={() => {
                                                            setShowCompletionView(false);
                                                            // Reset state for next question
                                                            setAnswer('');
                                                            setSelectedMoods([]);
                                                            setMoodLocked(false);
                                                            setStep('mood');
                                                            fetchTodaysQuestion();
                                                        }}
                                                        className="group relative w-full overflow-hidden rounded-[28px] border border-amber-200/70 bg-white/85 px-4 py-3 text-left shadow-soft-lg transition-all hover:shadow-soft-xl"
                                                    >
                                                        <span className="absolute inset-x-6 top-0 h-0.5 bg-gradient-to-r from-transparent via-amber-200/80 to-transparent" />
                                                        <span className="absolute -top-8 -right-6 h-16 w-16 rounded-full bg-amber-200/35 blur-2xl" />
                                                        <div className="relative flex items-center justify-between gap-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-200/70 bg-amber-100/80">
                                                                    <BookOpen className="w-5 h-5 text-amber-700" />
                                                                </div>
                                                                <div className="text-sm font-bold text-court-brown">
                                                                    {t('dailyMeow.continueNext')}
                                                                </div>
                                                            </div>
                                                            <ChevronRight className="w-5 h-5 text-amber-600" />
                                                        </div>
                                                    </Motion.button>
                                                )}
                                            </Motion.div>
                                        )}
                                    </Motion.div>
                                )}

                                {/* Editing Mode */}
                                {isEditing && (
                                    <Motion.div
                                        key="edit-step"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="flex-1 flex flex-col"
                                    >
                                        {/* Locked Mood Display - Cannot edit */}
                                        <div className="flex items-center justify-center gap-2 mb-4 px-4 py-2 bg-white/80 rounded-2xl border border-neutral-200/70 shadow-inner-soft">
                                            <span className="flex items-center gap-1">
                                                {(todaysQuestion.my_answer?.moods || (todaysQuestion.my_answer?.mood ? [todaysQuestion.my_answer.mood] : [])).slice(0, 3).map(m => (
                                                    <MoodIcon key={m} moodId={m} className="w-5 h-5" />
                                                ))}
                                            </span>
                                            <span className="text-sm font-medium text-neutral-700">{t('dailyMeow.moodLocked')}</span>
                                            <Lock className="w-3 h-3 text-neutral-500 ml-1" />
                                        </div>

                                        <textarea
                                            value={editingAnswer}
                                            onChange={(e) => setEditingAnswer(e.target.value)}
                                            className="flex-1 min-h-[150px] bg-white/80 rounded-2xl p-4 text-neutral-700 border border-amber-200/70 focus:ring-2 focus:ring-amber-100 outline-none resize-none text-base shadow-inner-soft"
                                            maxLength={1000}
                                            autoFocus
                                        />

                                        <div className="flex items-center justify-end mt-2">
                                            <span className="text-xs text-neutral-500">{editingAnswer.length}/1000</span>
                                        </div>

                                        <div className="flex gap-3 mt-4">
                                            <button
                                                onClick={() => setIsEditing(false)}
                                                className="flex-1 py-3.5 bg-white/80 text-neutral-600 font-bold rounded-2xl border border-neutral-200/70 shadow-soft"
                                            >
                                                {t('common.cancel')}
                                            </button>
                                            <Motion.button
                                                whileTap={{ scale: 0.98 }}
                                                onClick={handleEdit}
                                                disabled={!editingAnswer.trim() || submitting}
                                                className="flex-1 py-3.5 bg-gradient-to-r from-amber-500 to-rose-400 text-white font-bold rounded-2xl shadow-soft disabled:opacity-40 flex items-center justify-center gap-2"
                                            >
                                                {submitting ? (
                                                    <Motion.div
                                                        animate={{ rotate: 360 }}
                                                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                                        className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                                                    />
                                                ) : (
                                                    <>
                                                    <Check className="w-5 h-5" />
                                                    {t('common.saveChanges')}
                                                </>
                                            )}
                                        </Motion.button>
                                        </div>
                                    </Motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                        <div className="p-6 pt-0">
                            <div className="h-px bg-gradient-to-r from-transparent via-neutral-200 to-transparent my-4" />
                            <Motion.button
                                whileTap={{ scale: 0.98 }}
                                onClick={() => navigate('/daily-meow/history')}
                                className="w-full py-3.5 bg-white/80 text-neutral-700 font-bold rounded-2xl shadow-soft border border-neutral-200/70 flex items-center justify-center gap-2"
                            >
                                <BookOpen className="w-5 h-5 text-court-gold" />
                                {t('dailyMeow.questionArchives')}
                                <ChevronRight className="w-4 h-4 text-neutral-500" />
                            </Motion.button>
                            <p className="text-center text-xs text-neutral-500 mt-3">
                                {t('dailyMeow.dailyReset')}
                            </p>
                        </div>
                        </div>
                    </Motion.div>
                </div>
            )}
            </div>
        </div>
    );
};

const DailyMeowBackdrop = () => (
    <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-amber-200/30 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-rose-200/25 blur-3xl" />
    </div>
);

export default DailyMeowPage;
