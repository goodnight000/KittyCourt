import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    Sparkles, Heart, Check, Clock, History,
    Cat, Edit3, Send, Lock, AlertCircle, RefreshCw, BookOpen, ChevronRight
} from 'lucide-react';
import useAuthStore from '../store/useAuthStore';
import RequirePartner from '../components/RequirePartner';
import api from '../services/api';

// 20 mood/feeling options with emojis - organized by positive/neutral/challenging
const MOOD_OPTIONS = [
    // Positive moods
    { id: 'happy', emoji: '😊', label: 'Happy', color: 'from-yellow-100 to-amber-100' },
    { id: 'loved', emoji: '🥰', label: 'Loved', color: 'from-pink-100 to-rose-100' },
    { id: 'grateful', emoji: '🙏', label: 'Grateful', color: 'from-amber-100 to-orange-100' },
    { id: 'excited', emoji: '🤩', label: 'Excited', color: 'from-yellow-100 to-lime-100' },
    { id: 'peaceful', emoji: '😌', label: 'Peaceful', color: 'from-cyan-100 to-teal-100' },
    { id: 'playful', emoji: '😜', label: 'Playful', color: 'from-orange-100 to-amber-100' },
    { id: 'cozy', emoji: '🥹', label: 'Cozy', color: 'from-amber-100 to-yellow-100' },
    { id: 'romantic', emoji: '😍', label: 'Romantic', color: 'from-rose-100 to-pink-100' },
    { id: 'silly', emoji: '🤪', label: 'Silly', color: 'from-lime-100 to-green-100' },
    { id: 'hopeful', emoji: '✨', label: 'Hopeful', color: 'from-violet-100 to-purple-100' },
    // Neutral/Challenging moods
    { id: 'tired', emoji: '😴', label: 'Tired', color: 'from-slate-100 to-gray-100' },
    { id: 'stressed', emoji: '😩', label: 'Stressed', color: 'from-orange-100 to-red-100' },
    { id: 'anxious', emoji: '😰', label: 'Anxious', color: 'from-blue-100 to-indigo-100' },
    { id: 'sad', emoji: '😢', label: 'Sad', color: 'from-blue-100 to-slate-100' },
    { id: 'frustrated', emoji: '😤', label: 'Frustrated', color: 'from-red-100 to-orange-100' },
    { id: 'overwhelmed', emoji: '🤯', label: 'Overwhelmed', color: 'from-purple-100 to-pink-100' },
    { id: 'lonely', emoji: '🥺', label: 'Lonely', color: 'from-indigo-100 to-blue-100' },
    { id: 'confused', emoji: '😵‍💫', label: 'Confused', color: 'from-violet-100 to-fuchsia-100' },
    { id: 'meh', emoji: '😐', label: 'Meh', color: 'from-gray-100 to-slate-100' },
    { id: 'hangry', emoji: '🤤', label: 'Hangry', color: 'from-orange-100 to-yellow-100' },
];

const DailyMeowPage = () => {
    const navigate = useNavigate();
    const { hasPartner, user: authUser, profile, partner: connectedPartner } = useAuthStore();

    const myId = authUser?.id;
    const partnerId = connectedPartner?.id;
    const partnerDisplayName = connectedPartner?.display_name || 'Your partner';

    // Ref to prevent duplicate fetches
    const hasFetched = useRef(false);

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

    // Timeout for loading state to prevent infinite loading
    useEffect(() => {
        const timeout = setTimeout(() => {
            if (loading && hasPartner && (!myId || !partnerId)) {
                setLoading(false);
                setError('Unable to load user data. Please try refreshing the page.');
            }
        }, 5000); // 5 second timeout
        return () => clearTimeout(timeout);
    }, [loading, hasPartner, myId, partnerId]);

    // Fetch today's question
    const fetchTodaysQuestion = useCallback(async () => {
        if (!myId || !partnerId) {
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const response = await api.get('/daily-questions/today', {
                params: { userId: myId, partnerId }
            });

            // Validate the response has the expected structure
            if (!response.data) {
                setError('No data received from server');
                return;
            }

            // The API returns the question directly on response.data
            const questionData = response.data;

            if (!questionData.assignment_id || !questionData.question) {
                console.error('DailyMeow: Invalid response structure', questionData);
                setError('Invalid question data received');
                return;
            }

            setTodaysQuestion(questionData);

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
        } catch (err) {
            console.error('Error fetching today\'s question:', err);
            const errorMessage = err.response?.data?.error || err.message || 'Failed to load today\'s question';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [myId, partnerId]);

    useEffect(() => {
        // Only fetch once when we have both IDs
        if (myId && partnerId && !hasFetched.current) {
            hasFetched.current = true;
            fetchTodaysQuestion();
        } else if (hasPartner && (!myId || !partnerId)) {
            // Partner is connected but IDs not yet loaded - keep loading
            setLoading(true);
        } else if (!hasPartner) {
            // No partner - this is handled by RequirePartner component
            setLoading(false);
        }
    }, [myId, partnerId, hasPartner]); // Removed fetchTodaysQuestion to prevent re-triggers

    // Require partner
    if (!hasPartner) {
        return (
            <RequirePartner
                feature="Daily Meow"
                description="Daily Meow is where you and your partner answer a question together every day. It's a beautiful way to stay connected and learn more about each other!"
            >
                <div className="space-y-4">
                    <div className="glass-card p-8 text-center">
                        <Cat className="w-16 h-16 mx-auto text-amber-500 mb-4" />
                        <h2 className="text-xl font-bold text-neutral-800">Daily Meow</h2>
                        <p className="text-neutral-500 mt-2">One question. Two hearts. Every day.</p>
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
            await api.post('/daily-questions/answer', {
                userId: myId,
                assignmentId: todaysQuestion.assignment_id,
                answer: answer.trim(),
                mood: selectedMoods[0], // Primary mood for backward compatibility
                moods: selectedMoods // All selected moods
            });

            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 2000);

            await fetchTodaysQuestion();
        } catch (err) {
            console.error('Error submitting answer:', err);
            setError('Failed to submit answer');
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

            await fetchTodaysQuestion();
        } catch (err) {
            console.error('Error editing answer:', err);
            setError('Failed to update answer');
        } finally {
            setSubmitting(false);
        }
    };

    const startEditing = () => {
        setEditingAnswer(answer);
        setIsEditing(true);
    };

    const getMoodData = (moodId) => MOOD_OPTIONS.find(m => m.id === moodId);

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
        });
    };

    const formatEditedDate = (dateStr) => {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
    };

    const hasAnswered = !!todaysQuestion?.my_answer;
    const partnerHasAnswered = !!todaysQuestion?.partner_answer;
    const bothAnswered = hasAnswered && partnerHasAnswered;
    const isBacklog = todaysQuestion?.is_backlog;
    const currentMoodData = selectedMoods.length > 0 ? getMoodData(selectedMoods[0]) : null;

    return (
        <div className="min-h-[calc(100dvh-120px)] flex flex-col">
            {/* Success Toast */}
            <AnimatePresence>
                {showSuccess && (
                    <motion.div
                        initial={{ opacity: 0, y: -20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-5 py-3 rounded-2xl shadow-lg flex items-center gap-2"
                    >
                        <Check className="w-5 h-5" />
                        <span className="font-medium">Answer saved!</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center pt-2 pb-4"
            >
                <motion.div
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                    className="inline-block"
                >
                    <div className="w-14 h-14 bg-gradient-to-br from-amber-100 via-orange-100 to-pink-100 rounded-2xl flex items-center justify-center shadow-lg mx-auto">
                        <span className="text-2xl">🐱</span>
                    </div>
                </motion.div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-amber-600 to-pink-600 bg-clip-text text-transparent mt-2">
                    Daily Meow
                </h1>
                <p className="text-neutral-400 text-xs flex items-center justify-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    One question, two hearts
                </p>
            </motion.div>

            {/* Loading State */}
            {loading && (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-10 h-10 border-3 border-amber-400 border-t-transparent rounded-full mx-auto"
                        />
                        <p className="text-neutral-500 mt-4">Loading today's question...</p>
                    </div>
                </div>
            )}

            {/* Error State */}
            {error && !loading && (
                <div className="flex-1 flex items-center justify-center p-4">
                    <div className="glass-card p-6 text-center max-w-sm">
                        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                        <p className="text-neutral-600 font-medium mb-4">{error}</p>
                        <button
                            onClick={fetchTodaysQuestion}
                            className="px-5 py-2.5 bg-neutral-100 text-neutral-600 rounded-xl font-medium flex items-center gap-2 mx-auto"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Try Again
                        </button>
                    </div>
                </div>
            )}

            {/* No Question Available State */}
            {!loading && !error && !todaysQuestion && (
                <div className="flex-1 flex items-center justify-center p-4">
                    <div className="glass-card p-6 text-center max-w-sm">
                        <Cat className="w-16 h-16 text-amber-400 mx-auto mb-3" />
                        <h3 className="text-lg font-bold text-neutral-800 mb-2">No Questions Available</h3>
                        <p className="text-neutral-500 text-sm mb-4">
                            We couldn't load today's question. This might be a temporary issue.
                        </p>
                        <button
                            onClick={fetchTodaysQuestion}
                            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium flex items-center gap-2 mx-auto"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Refresh
                        </button>
                    </div>
                </div>
            )}

            {/* Main Content */}
            {!loading && !error && todaysQuestion && (
                <div className="flex-1 flex flex-col px-1">
                    {/* Backlog Badge */}
                    {isBacklog && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-2xl mb-4"
                        >
                            <Clock className="w-4 h-4 text-amber-600" />
                            <span className="text-sm font-medium text-amber-700">
                                Catch-up from {formatDate(todaysQuestion.assigned_date)}
                            </span>
                        </motion.div>
                    )}

                    {/* Question Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`glass-card overflow-hidden flex-1 flex flex-col ${currentMoodData ? `bg-gradient-to-br ${currentMoodData.color}` : ''
                            }`}
                    >
                        {/* Question Header */}
                        <div className="p-5 text-center border-b border-white/50">
                            <motion.span
                                className="text-5xl block mb-3"
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                            >
                                {todaysQuestion.emoji || '💭'}
                            </motion.span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/70 rounded-full text-xs font-bold text-amber-700 shadow-sm mb-3">
                                <Heart className="w-3 h-3" />
                                {isBacklog ? 'Catch-up Question' : "Today's Question"}
                            </span>
                            <h2 className="text-xl font-bold text-neutral-800 leading-relaxed">
                                {todaysQuestion.question}
                            </h2>
                        </div>

                        {/* Step Content */}
                        <div className="flex-1 p-5 flex flex-col">
                            <AnimatePresence mode="wait">
                                {/* STEP 1: Mood Selection (MANDATORY) */}
                                {step === 'mood' && !hasAnswered && (
                                    <motion.div
                                        key="mood-step"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="flex-1 flex flex-col"
                                    >
                                        <div className="text-center mb-4">
                                            <h3 className="text-lg font-bold text-neutral-800">How are you feeling today?</h3>
                                            <p className="text-sm text-neutral-500 mt-1">
                                                Select 1-3 moods ({selectedMoods.length}/3 selected)
                                            </p>
                                            <p className="text-xs text-amber-600 mt-2 flex items-center justify-center gap-1">
                                                <Lock className="w-3 h-3" />
                                                Your moods will be locked after submitting
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-4 gap-2 flex-1 content-start">
                                            {MOOD_OPTIONS.map((mood) => (
                                                <motion.button
                                                    key={mood.id}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => handleMoodSelect(mood)}
                                                    className={`aspect-square rounded-2xl flex flex-col items-center justify-center p-1 transition-all ${selectedMoods.includes(mood.id)
                                                            ? `bg-gradient-to-br ${mood.color} ring-2 ring-amber-400 shadow-md`
                                                            : 'bg-white/60 hover:bg-white/80'
                                                        }`}
                                                >
                                                    <span className="text-2xl">{mood.emoji}</span>
                                                    <span className="text-[10px] text-neutral-600 font-medium mt-0.5">{mood.label}</span>
                                                </motion.button>
                                            ))}
                                        </div>

                                        <motion.button
                                            whileTap={{ scale: 0.98 }}
                                            onClick={confirmMood}
                                            disabled={selectedMoods.length === 0}
                                            className="mt-4 w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-2xl shadow-lg disabled:opacity-40 disabled:saturate-50 flex items-center justify-center gap-2"
                                        >
                                            {selectedMoods.length > 0 ? (
                                                <>
                                                    <span className="text-xl flex gap-1">
                                                        {selectedMoods.map(m => getMoodData(m)?.emoji).join('')}
                                                    </span>
                                                    Continue with {selectedMoods.length} mood{selectedMoods.length > 1 ? 's' : ''}
                                                </>
                                            ) : (
                                                'Select at least 1 mood to continue'
                                            )}
                                        </motion.button>
                                    </motion.div>
                                )}

                                {/* STEP 2: Answer Input */}
                                {step === 'answer' && !hasAnswered && (
                                    <motion.div
                                        key="answer-step"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="flex-1 flex flex-col"
                                    >
                                        {/* Selected Moods Display (can still change) */}
                                        <div className="flex items-center justify-center gap-2 mb-4 px-4 py-2 bg-white/60 rounded-xl">
                                            <span className="text-xl flex gap-1">
                                                {selectedMoods.map(m => getMoodData(m)?.emoji).join('')}
                                            </span>
                                            <span className="text-sm font-medium text-neutral-700">
                                                {selectedMoods.length} mood{selectedMoods.length > 1 ? 's' : ''} selected
                                            </span>
                                            <button
                                                onClick={() => setStep('mood')}
                                                className="text-xs text-amber-600 underline ml-2"
                                            >
                                                Change
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs text-neutral-500 flex items-center gap-1">
                                                <Lock className="w-3 h-3" />
                                                Private until both answer
                                            </span>
                                        </div>

                                        <textarea
                                            value={answer}
                                            onChange={(e) => setAnswer(e.target.value)}
                                            placeholder="Share your honest thoughts..."
                                            className="flex-1 min-h-[150px] bg-white/70 rounded-2xl p-4 text-neutral-700 border border-white focus:border-amber-300 focus:ring-2 focus:ring-amber-100 outline-none resize-none text-base placeholder:text-neutral-400"
                                            autoFocus
                                        />

                                        <motion.button
                                            whileTap={{ scale: 0.98 }}
                                            onClick={handleSubmit}
                                            disabled={!answer.trim() || submitting || selectedMoods.length === 0}
                                            className="mt-4 w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-2xl shadow-lg disabled:opacity-40 disabled:saturate-50 flex items-center justify-center gap-2"
                                        >
                                            {submitting ? (
                                                <motion.div
                                                    animate={{ rotate: 360 }}
                                                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                                    className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                                                />
                                            ) : (
                                                <>
                                                    <Send className="w-5 h-5" />
                                                    Submit Answer
                                                </>
                                            )}
                                        </motion.button>
                                    </motion.div>
                                )}

                                {/* STEP 3: Done - View Answers */}
                                {(step === 'done' || hasAnswered) && !isEditing && (
                                    <motion.div
                                        key="done-step"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="flex-1 flex flex-col gap-4"
                                    >
                                        {/* Status Indicators */}
                                        <div className="flex items-center justify-between px-1">
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-sm" />
                                                <span className="text-sm text-neutral-600">You answered</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-neutral-600">
                                                    {partnerHasAnswered ? `${partnerDisplayName} answered` : `Waiting...`}
                                                </span>
                                                <div className={`w-3 h-3 rounded-full ${partnerHasAnswered ? 'bg-emerald-400' : 'bg-neutral-300 animate-pulse'}`} />
                                            </div>
                                        </div>

                                        {/* My Answer */}
                                        <div className="bg-white/70 rounded-2xl p-4 border border-white shadow-sm">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-bold text-amber-700">Your answer</span>
                                                    {selectedMoods.length > 0 && (
                                                        <span className="text-lg flex gap-0.5">
                                                            {selectedMoods.map(m => getMoodData(m)?.emoji).join('')}
                                                        </span>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={startEditing}
                                                    className="flex items-center gap-1 text-xs text-amber-600 font-medium hover:text-amber-700 px-2 py-1 rounded-lg hover:bg-amber-50"
                                                >
                                                    <Edit3 className="w-3 h-3" />
                                                    Edit
                                                </button>
                                            </div>
                                            <p className="text-neutral-700 leading-relaxed">{answer}</p>
                                            {todaysQuestion.my_answer?.edited_at && (
                                                <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                                                    <Edit3 className="w-3 h-3" />
                                                    Edited {formatEditedDate(todaysQuestion.my_answer.edited_at)}
                                                </p>
                                            )}
                                        </div>

                                        {/* Partner's Answer or Waiting */}
                                        {bothAnswered ? (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="bg-white/70 rounded-2xl p-4 border border-pink-200 shadow-sm"
                                            >
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-sm font-bold text-pink-700">{partnerDisplayName}'s answer</span>
                                                    {todaysQuestion.partner_answer?.mood && (
                                                        <span className="text-lg">{getMoodData(todaysQuestion.partner_answer.mood)?.emoji}</span>
                                                    )}
                                                </div>
                                                <p className="text-neutral-700 leading-relaxed">
                                                    {todaysQuestion.partner_answer?.answer}
                                                </p>
                                            </motion.div>
                                        ) : (
                                            <div className="bg-white/50 rounded-2xl p-6 border border-dashed border-neutral-300 text-center">
                                                <Lock className="w-6 h-6 text-neutral-400 mx-auto mb-2" />
                                                <p className="text-sm text-neutral-500">
                                                    {partnerDisplayName}'s answer will appear once they respond
                                                </p>
                                            </div>
                                        )}

                                        {/* Completion Celebration */}
                                        {bothAnswered && (
                                            <motion.div
                                                initial={{ scale: 0, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                transition={{ type: "spring", delay: 0.2 }}
                                                className="flex justify-center"
                                            >
                                                <span className="px-5 py-2.5 bg-gradient-to-r from-emerald-100 to-teal-100 rounded-full text-sm font-bold text-emerald-700 flex items-center gap-2 shadow-sm">
                                                    ✨ You both answered! +5 Kibbles each
                                                </span>
                                            </motion.div>
                                        )}
                                    </motion.div>
                                )}

                                {/* Editing Mode */}
                                {isEditing && (
                                    <motion.div
                                        key="edit-step"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="flex-1 flex flex-col"
                                    >
                                        {/* Locked Mood Display - Cannot edit */}
                                        <div className="flex items-center justify-center gap-2 mb-4 px-4 py-2 bg-white/60 rounded-xl">
                                            <span className="text-xl">{getMoodData(todaysQuestion.my_answer?.mood)?.emoji}</span>
                                            <span className="text-sm font-medium text-neutral-700">
                                                Feeling {getMoodData(todaysQuestion.my_answer?.mood)?.label}
                                            </span>
                                            <Lock className="w-3 h-3 text-neutral-400 ml-1" />
                                        </div>

                                        <textarea
                                            value={editingAnswer}
                                            onChange={(e) => setEditingAnswer(e.target.value)}
                                            className="flex-1 min-h-[150px] bg-white/70 rounded-2xl p-4 text-neutral-700 border border-amber-300 focus:ring-2 focus:ring-amber-100 outline-none resize-none text-base"
                                            autoFocus
                                        />

                                        <div className="flex gap-3 mt-4">
                                            <button
                                                onClick={() => setIsEditing(false)}
                                                className="flex-1 py-3.5 bg-white/70 text-neutral-600 font-bold rounded-2xl border border-neutral-200"
                                            >
                                                Cancel
                                            </button>
                                            <motion.button
                                                whileTap={{ scale: 0.98 }}
                                                onClick={handleEdit}
                                                disabled={!editingAnswer.trim() || submitting}
                                                className="flex-1 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-2xl shadow-lg disabled:opacity-40 flex items-center justify-center gap-2"
                                            >
                                                {submitting ? (
                                                    <motion.div
                                                        animate={{ rotate: 360 }}
                                                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                                        className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                                                    />
                                                ) : (
                                                    <>
                                                        <Check className="w-5 h-5" />
                                                        Save Changes
                                                    </>
                                                )}
                                            </motion.button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>

                    {/* Footer Actions */}
                    <div className="py-4 space-y-3">
                        {/* View History Button */}
                        <motion.button
                            whileTap={{ scale: 0.98 }}
                            onClick={() => navigate('/daily-meow/history')}
                            className="w-full py-3.5 bg-white/80 text-neutral-700 font-bold rounded-2xl shadow-sm border border-neutral-200 flex items-center justify-center gap-2"
                        >
                            <BookOpen className="w-5 h-5 text-court-gold" />
                            Question Archives
                            <ChevronRight className="w-4 h-4 text-neutral-400" />
                        </motion.button>

                        <p className="text-center text-xs text-neutral-400">
                            🐾 New question every day at midnight 🐾
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DailyMeowPage;
