import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, Sparkles, Heart, MessageCircle, RotateCcw, Check, Clock, RefreshCw, History, ChevronDown, ChevronUp, Smile, Cat } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import useAuthStore from '../store/useAuthStore';
import RequirePartner from '../components/RequirePartner';

// 20 mood/feeling options with emojis
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

// Daily questions pool
const DAILY_QUESTIONS = [
    { id: 1, question: "Who would survive longer in a zombie apocalypse? 🧟", emoji: "🧟" },
    { id: 2, question: "Who is more likely to become famous? 🌟", emoji: "🌟" },
    { id: 3, question: "Who is the better cook? 👨‍🍳", emoji: "👨‍🍳" },
    { id: 4, question: "Who is more romantic? 💕", emoji: "💕" },
    { id: 5, question: "Who would win in an argument? 🗣️", emoji: "🗣️" },
    { id: 6, question: "Who is more likely to cry at a movie? 🎬", emoji: "🎬" },
    { id: 7, question: "Who spends more money? 💸", emoji: "💸" },
    { id: 8, question: "Who is the early bird? 🐦", emoji: "🐦" },
    { id: 9, question: "Who takes longer to get ready? 💄", emoji: "💄" },
    { id: 10, question: "Who is the better driver? 🚗", emoji: "🚗" },
    { id: 11, question: "Who falls asleep first? 😴", emoji: "😴" },
    { id: 12, question: "Who is more adventurous? 🏔️", emoji: "🏔️" },
];

// Get today's question based on date
const getTodaysQuestion = () => {
    const today = new Date();
    const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
    const index = dayOfYear % DAILY_QUESTIONS.length;
    return DAILY_QUESTIONS[index];
};

// Check if user already answered today
const getStoredAnswer = (userId) => {
    const key = `dailyMeow_${new Date().toDateString()}_${userId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch {
            // Legacy: plain text answer
            return { answer: stored, mood: null };
        }
    }
    return null;
};

const storeAnswer = (userId, answer, mood) => {
    const key = `dailyMeow_${new Date().toDateString()}_${userId}`;
    localStorage.setItem(key, JSON.stringify({ answer, mood }));
};

// Get stored mood for today
const getStoredMood = (userId) => {
    const stored = getStoredAnswer(userId);
    return stored?.mood || null;
};

// Get history of past questions and answers
const getAnswerHistory = () => {
    const history = [];
    const keys = Object.keys(localStorage).filter(k => k.startsWith('dailyMeow_') && !k.includes(new Date().toDateString()));
    
    // Group by date
    const dateMap = {};
    keys.forEach(key => {
        const parts = key.split('_');
        const dateStr = parts.slice(1, -1).join('_');
        const userId = parts[parts.length - 1];
        if (!dateMap[dateStr]) dateMap[dateStr] = {};
        const stored = localStorage.getItem(key);
        try {
            dateMap[dateStr][userId] = JSON.parse(stored);
        } catch {
            // Legacy: plain text answer
            dateMap[dateStr][userId] = { answer: stored, mood: null };
        }
    });
    
    // Convert to array and match with questions
    Object.entries(dateMap).forEach(([dateStr, answers]) => {
        const date = new Date(dateStr);
        const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
        const question = DAILY_QUESTIONS[dayOfYear % DAILY_QUESTIONS.length];
        history.push({ date: dateStr, question, answers });
    });
    
    return history.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 7);
};

const DailyMeowPage = () => {
    const { currentUser, users } = useAppStore();
    const { hasPartner } = useAuthStore();
    const partner = users.find(u => u.id !== currentUser?.id);
    
    const [revealed, setRevealed] = useState(false);
    const [answer, setAnswer] = useState('');
    const [selectedMood, setSelectedMood] = useState(null);
    const [submitted, setSubmitted] = useState(false);
    const [partnerAnswer, setPartnerAnswer] = useState(null);
    const [partnerMood, setPartnerMood] = useState(null);
    const [showMoodPicker, setShowMoodPicker] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [history, setHistory] = useState([]);

    const todaysQuestion = getTodaysQuestion();

    // Check if current user already answered
    useEffect(() => {
        if (currentUser?.id) {
            const existingData = getStoredAnswer(currentUser.id);
            if (existingData) {
                setAnswer(existingData.answer || '');
                setSelectedMood(existingData.mood || null);
                setSubmitted(true);
            } else {
                setAnswer('');
                setSelectedMood(null);
                setSubmitted(false);
            }
        }
        // Check partner's answer and mood
        if (partner?.id) {
            const partnerData = getStoredAnswer(partner.id);
            if (partnerData) {
                setPartnerAnswer(partnerData.answer || partnerData);
                setPartnerMood(partnerData.mood || null);
            } else {
                setPartnerAnswer(null);
                setPartnerMood(null);
            }
        }
        // Load history
        setHistory(getAnswerHistory());
    }, [currentUser?.id, partner?.id]);

    // Require partner to access Daily Meow
    if (!hasPartner) {
        return (
            <RequirePartner
                feature="Daily Meow"
                description="Daily Meow is a fun way to check in with your partner every day. Answer playful questions together and see if you're on the same page!"
            >
                {/* Preview content */}
                <div className="space-y-4">
                    <div className="glass-card p-5 text-center">
                        <Cat className="w-12 h-12 mx-auto text-amber-500 mb-3" />
                        <h2 className="text-lg font-bold text-neutral-800">Daily Meow</h2>
                        <p className="text-sm text-neutral-500">Answer fun questions with your partner</p>
                    </div>
                </div>
            </RequirePartner>
        );
    }

    const handleSubmit = () => {
        if (answer.trim() && currentUser?.id) {
            storeAnswer(currentUser.id, answer.trim(), selectedMood);
            setSubmitted(true);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 2000);
            
            // Check if partner also answered
            if (partner?.id) {
                const partnerData = getStoredAnswer(partner.id);
                if (partnerData) {
                    setPartnerAnswer(partnerData.answer || partnerData);
                    setPartnerMood(partnerData.mood || null);
                    setTimeout(() => setRevealed(true), 1500);
                }
            }
        }
    };

    const handleReveal = () => {
        if (partnerAnswer) {
            setRevealed(true);
        }
    };

    const handleNewQuestion = () => {
        // Clear today's answers for testing (in production, this would wait for midnight)
        if (currentUser?.id) {
            localStorage.removeItem(`dailyMeow_${new Date().toDateString()}_${currentUser.id}`);
        }
        if (partner?.id) {
            localStorage.removeItem(`dailyMeow_${new Date().toDateString()}_${partner.id}`);
        }
        setAnswer('');
        setSelectedMood(null);
        setSubmitted(false);
        setPartnerAnswer(null);
        setPartnerMood(null);
        setRevealed(false);
    };

    const getMoodData = (moodId) => MOOD_OPTIONS.find(m => m.id === moodId);

    const bothAnswered = submitted && partnerAnswer;

    return (
        <div className="space-y-5">
            {/* Success Toast */}
            <AnimatePresence>
                {showSuccess && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-court-gold text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2"
                    >
                        <Check className="w-4 h-4" />
                        Answer submitted!
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Mood Picker Modal */}
            <AnimatePresence>
                {showMoodPicker && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 bg-black/30 backdrop-blur-md z-[60] flex items-center justify-center p-6"
                        onClick={() => setShowMoodPicker(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-gradient-to-br from-white to-court-cream/40 rounded-[2rem] w-full max-w-sm p-6 shadow-2xl border border-white/50"
                        >
                            <div className="text-center mb-5">
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: 'spring', delay: 0.1 }}
                                    className="w-14 h-14 bg-gradient-to-br from-amber-100 to-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-soft"
                                >
                                    <span className="text-2xl">💭</span>
                                </motion.div>
                                <h3 className="font-bold text-neutral-800 text-lg">How are you feeling?</h3>
                                <p className="text-neutral-400 text-sm mt-1">Tap to select your mood</p>
                            </div>
                            
                            <div className="grid grid-cols-4 gap-3">
                                {MOOD_OPTIONS.map((mood, index) => (
                                    <motion.button
                                        key={mood.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.02 }}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => {
                                            setSelectedMood(mood.id);
                                            setShowMoodPicker(false);
                                        }}
                                        className={`aspect-square rounded-2xl flex flex-col items-center justify-center p-2 transition-all shadow-sm ${
                                            selectedMood === mood.id
                                                ? 'bg-gradient-to-br from-court-gold/30 to-amber-100 ring-2 ring-court-gold shadow-md'
                                                : 'bg-white/80 hover:bg-white hover:shadow-md'
                                        }`}
                                    >
                                        <span className="text-2xl mb-0.5">{mood.emoji}</span>
                                        <span className="text-[10px] text-neutral-500 font-medium leading-tight">{mood.label}</span>
                                    </motion.button>
                                ))}
                            </div>
                            
                            {selectedMood && (
                                <motion.button
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    onClick={() => {
                                        setSelectedMood(null);
                                        setShowMoodPicker(false);
                                    }}
                                    className="w-full py-2.5 mt-4 text-neutral-400 text-sm font-medium hover:text-neutral-600 transition-colors"
                                >
                                    Clear selection
                                </motion.button>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center space-y-2"
            >
                <motion.div
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                    className="inline-block"
                >
                    <div className="w-14 h-14 bg-gradient-to-br from-violet-100 to-pink-100 rounded-2xl flex items-center justify-center shadow-soft mx-auto">
                        <span className="text-2xl">🐱</span>
                    </div>
                </motion.div>
                <h1 className="text-2xl font-bold text-gradient font-display">Daily Meow</h1>
                <p className="text-neutral-500 text-sm flex items-center justify-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    One question to rule them all
                </p>
            </motion.div>

            {/* Card Container */}
            <div className="perspective-1000">
                <motion.div
                    animate={{ rotateY: revealed ? 180 : 0 }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    style={{ transformStyle: 'preserve-3d' }}
                    className="relative min-h-[380px]"
                >
                    {/* Front - Question Card */}
                    <div 
                        className="absolute inset-0 backface-hidden"
                        style={{ backfaceVisibility: 'hidden' }}
                    >
                        <div className="glass-card p-5 h-full flex flex-col">
                            {/* Question Icon */}
                            <div className="flex justify-center mb-4">
                                <motion.div
                                    whileTap={{ scale: 0.95 }}
                                    className="w-16 h-16 bg-gradient-to-br from-court-cream to-court-tan rounded-2xl flex items-center justify-center shadow-soft"
                                >
                                    <span className="text-3xl">{todaysQuestion.emoji}</span>
                                </motion.div>
                            </div>
                            
                            {/* Badge */}
                            <div className="flex justify-center mb-3">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-court-cream text-court-brown rounded-full text-xs font-bold">
                                    <Heart className="w-3 h-3" />
                                    Today's Question
                                </span>
                            </div>

                            {/* Question */}
                            <h2 className="text-lg font-bold text-neutral-800 text-center mb-4 leading-snug">
                                {todaysQuestion.question}
                            </h2>
                            
                            {/* Input Area */}
                            <div className="flex-1 flex flex-col">
                                {/* Mood Selector */}
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                                        <MessageCircle className="w-3.5 h-3.5" />
                                        <span>
                                            {submitted 
                                                ? "You've answered!" 
                                                : "Your partner can't see yet!"}
                                        </span>
                                    </div>
                                    <motion.button
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => setShowMoodPicker(true)}
                                        disabled={submitted}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                                            selectedMood 
                                                ? 'bg-court-cream text-court-brown' 
                                                : 'bg-neutral-100 text-neutral-500'
                                        } ${submitted ? 'opacity-60' : ''}`}
                                    >
                                        {selectedMood ? (
                                            <>
                                                <span className="text-base">{getMoodData(selectedMood)?.emoji}</span>
                                                {getMoodData(selectedMood)?.label}
                                            </>
                                        ) : (
                                            <>
                                                <Smile className="w-3.5 h-3.5" />
                                                My mood
                                            </>
                                        )}
                                    </motion.button>
                                </div>
                                <textarea
                                    value={answer}
                                    onChange={(e) => setAnswer(e.target.value)}
                                    placeholder="Type your honest answer..."
                                    disabled={submitted}
                                    className="flex-1 w-full bg-white/60 rounded-2xl p-4 text-neutral-700 border border-neutral-100 focus:border-pink-200 focus:ring-2 focus:ring-pink-100 outline-none resize-none text-sm shadow-inner-soft placeholder:text-neutral-400 disabled:opacity-60"
                                />
                            </div>
                            
                            {/* Action Buttons */}
                            {!submitted ? (
                                <button
                                    onClick={handleSubmit}
                                    disabled={!answer.trim()}
                                    className="mt-4 w-full py-3.5 text-white font-bold rounded-2xl shadow-md disabled:opacity-40 disabled:saturate-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                    style={{ background: 'linear-gradient(135deg, #C9A227 0%, #8B7019 100%)' }}
                                >
                                    <Check size={16} />
                                    Submit Answer
                                </button>
                            ) : bothAnswered ? (
                                <button
                                    onClick={handleReveal}
                                    className="mt-4 w-full py-3.5 bg-gradient-to-r from-court-gold to-court-maroon text-white font-bold rounded-2xl shadow-soft active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                >
                                    <Sparkles size={16} />
                                    Reveal Both Answers! 🎉
                                </button>
                            ) : (
                                <div className="mt-4 w-full py-3.5 bg-neutral-100 text-neutral-500 font-bold rounded-2xl flex items-center justify-center gap-2">
                                    <Clock size={16} />
                                    Waiting for {partner?.name || 'Partner'}...
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Back - Results Card */}
                    <div
                        className="absolute inset-0"
                        style={{ 
                            backfaceVisibility: 'hidden', 
                            transform: 'rotateY(180deg)',
                        }}
                    >
                        <div className="glass-card p-5 h-full flex flex-col">
                            {/* Header */}
                            <div className="text-center mb-4">
                                <span className="text-2xl">💕</span>
                                <h3 className="text-lg font-bold text-neutral-800 mt-1">The Answers Are In!</h3>
                                <p className="text-xs text-neutral-500 mt-1">{todaysQuestion.question}</p>
                            </div>
                            
                            {/* Answers */}
                            <div className="flex-1 space-y-3">
                                {/* Your answer */}
                                <motion.div 
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="bg-gradient-to-br from-court-cream to-white p-4 rounded-2xl border border-court-tan/50"
                                >
                                    <div className="flex items-center justify-between mb-1.5">
                                        <p className="text-xs text-court-gold font-bold flex items-center gap-1">
                                            <span>👤</span> {currentUser?.name || 'You'} said:
                                        </p>
                                        {selectedMood && (
                                            <span className="flex items-center gap-1 px-2 py-0.5 bg-white rounded-full text-xs">
                                                <span>{getMoodData(selectedMood)?.emoji}</span>
                                                <span className="text-neutral-500">{getMoodData(selectedMood)?.label}</span>
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-neutral-700 text-sm">{answer}</p>
                                </motion.div>
                                
                                {/* Partner's answer */}
                                <motion.div 
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.4 }}
                                    className="bg-gradient-to-br from-court-tan/30 to-white p-4 rounded-2xl border border-court-tan/50"
                                >
                                    <div className="flex items-center justify-between mb-1.5">
                                        <p className="text-xs text-court-maroon font-bold flex items-center gap-1">
                                            <span>💑</span> {partner?.name || 'Partner'} said:
                                        </p>
                                        {partnerMood && (
                                            <span className="flex items-center gap-1 px-2 py-0.5 bg-white rounded-full text-xs">
                                                <span>{getMoodData(partnerMood)?.emoji}</span>
                                                <span className="text-neutral-500">{getMoodData(partnerMood)?.label}</span>
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-neutral-700 text-sm">
                                        {partnerAnswer || "No answer yet"}
                                    </p>
                                </motion.div>

                                {/* Match indicator */}
                                {partnerAnswer && (
                                    <motion.div 
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ delay: 0.6, type: "spring" }}
                                        className="flex justify-center"
                                    >
                                        <span className="px-4 py-2 bg-gradient-to-r from-court-cream to-court-tan rounded-full text-sm font-bold text-court-brown flex items-center gap-2">
                                            ✨ You both answered! +5 Kibbles
                                        </span>
                                    </motion.div>
                                )}
                            </div>
                            
                            {/* Action buttons */}
                            <div className="mt-4 space-y-2">
                                <button
                                    onClick={() => setRevealed(false)}
                                    className="w-full py-3 bg-white/80 text-court-brown font-bold rounded-2xl border border-court-tan active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                >
                                    <RotateCcw size={16} />
                                    Flip Back
                                </button>
                                <button
                                    onClick={handleNewQuestion}
                                    className="w-full py-3 bg-neutral-100 text-neutral-600 font-bold rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm"
                                >
                                    <RefreshCw size={14} />
                                    Reset for Testing
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Footer tip */}
            <p className="text-center text-xs text-neutral-400 pt-2">
                🐾 New question every day at midnight! 🐾
            </p>

            {/* Past Questions History */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="glass-card overflow-hidden"
            >
                <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="w-full p-4 flex items-center justify-between text-left"
                >
                    <div className="flex items-center gap-2">
                        <History className="w-4 h-4 text-violet-400" />
                        <span className="font-bold text-neutral-700 text-sm">Past Questions</span>
                        {history.length > 0 && (
                            <span className="px-2 py-0.5 bg-violet-100 text-violet-600 rounded-full text-xs font-bold">
                                {history.length}
                            </span>
                        )}
                    </div>
                    {showHistory ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
                </button>
                
                <AnimatePresence>
                    {showHistory && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            {history.length === 0 ? (
                                <div className="px-4 pb-4 text-center">
                                    <span className="text-2xl mb-2 block">📜</span>
                                    <p className="text-neutral-500 text-sm">No past questions yet!</p>
                                    <p className="text-neutral-400 text-xs">Your history will appear here after a few days.</p>
                                </div>
                            ) : (
                                <div className="px-4 pb-4 space-y-3">
                                    {history.map((item, index) => (
                                        <motion.div
                                            key={item.date}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            className="bg-white/60 rounded-xl p-3 border border-neutral-100"
                                        >
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-lg">{item.question.emoji}</span>
                                                <div className="flex-1">
                                                    <p className="text-xs text-neutral-400">{item.date}</p>
                                                    <p className="text-sm font-medium text-neutral-700">{item.question.question}</p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 mt-2">
                                                {Object.entries(item.answers).map(([userId, ans]) => {
                                                    const user = users.find(u => u.id === userId);
                                                    const mood = item.moods?.[userId];
                                                    return (
                                                        <div key={userId} className="bg-neutral-50 rounded-lg p-2">
                                                            <div className="flex items-center gap-1 mb-0.5">
                                                                <p className="text-xs text-neutral-400 font-medium">{user?.name || 'User'}</p>
                                                                {mood && <span className="text-sm">{mood}</span>}
                                                            </div>
                                                            <p className="text-xs text-neutral-600 line-clamp-2">{ans}</p>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};

export default DailyMeowPage;
