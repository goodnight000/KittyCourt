import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, Sparkles, Heart, MessageCircle, RotateCcw, Check, Clock, RefreshCw, History, ChevronDown, ChevronUp } from 'lucide-react';
import useAppStore from '../store/useAppStore';

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
    return localStorage.getItem(key);
};

const storeAnswer = (userId, answer) => {
    const key = `dailyMeow_${new Date().toDateString()}_${userId}`;
    localStorage.setItem(key, answer);
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
        dateMap[dateStr][userId] = localStorage.getItem(key);
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
    const { currentUser, users, switchUser } = useAppStore();
    const partner = users.find(u => u.id !== currentUser?.id);
    
    const [revealed, setRevealed] = useState(false);
    const [answer, setAnswer] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [partnerAnswer, setPartnerAnswer] = useState(null);
    const [showSuccess, setShowSuccess] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [history, setHistory] = useState([]);

    const todaysQuestion = getTodaysQuestion();

    // Check if current user already answered
    useEffect(() => {
        if (currentUser?.id) {
            const existingAnswer = getStoredAnswer(currentUser.id);
            if (existingAnswer) {
                setAnswer(existingAnswer);
                setSubmitted(true);
            } else {
                setAnswer('');
                setSubmitted(false);
            }
        }
        // Check partner's answer
        if (partner?.id) {
            const partnerAns = getStoredAnswer(partner.id);
            setPartnerAnswer(partnerAns);
        }
        // Load history
        setHistory(getAnswerHistory());
    }, [currentUser?.id, partner?.id]);

    const handleSubmit = () => {
        if (answer.trim() && currentUser?.id) {
            storeAnswer(currentUser.id, answer.trim());
            setSubmitted(true);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 2000);
            
            // Check if partner also answered
            if (partner?.id) {
                const partnerAns = getStoredAnswer(partner.id);
                setPartnerAnswer(partnerAns);
                if (partnerAns) {
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

    const handleSwitchUser = () => {
        switchUser();
        setRevealed(false);
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
        setSubmitted(false);
        setPartnerAnswer(null);
        setRevealed(false);
    };

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
                        className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-green-500 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2"
                    >
                        <Check className="w-4 h-4" />
                        Answer submitted!
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

            {/* User Switcher */}
            <div className="flex justify-center gap-2">
                <button
                    onClick={handleSwitchUser}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                        currentUser?.name === 'User A'
                            ? 'bg-gradient-to-r from-pink-400 to-pink-500 text-white'
                            : 'bg-white/80 text-neutral-600 border border-neutral-100'
                    }`}
                >
                    👤 {currentUser?.name || 'User A'}
                    {submitted && <Check className="w-3 h-3" />}
                </button>
                <button
                    onClick={handleSwitchUser}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                        currentUser?.name === 'User B'
                            ? 'bg-gradient-to-r from-violet-400 to-violet-500 text-white'
                            : 'bg-white/80 text-neutral-600 border border-neutral-100'
                    }`}
                >
                    💑 {partner?.name || 'User B'}
                    {partnerAnswer && <Check className="w-3 h-3" />}
                </button>
            </div>

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
                                    className="w-16 h-16 bg-gradient-to-br from-violet-100 to-pink-100 rounded-2xl flex items-center justify-center shadow-soft"
                                >
                                    <span className="text-3xl">{todaysQuestion.emoji}</span>
                                </motion.div>
                            </div>
                            
                            {/* Badge */}
                            <div className="flex justify-center mb-3">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-violet-50 text-violet-600 rounded-full text-xs font-bold">
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
                                <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-2">
                                    <MessageCircle className="w-3.5 h-3.5" />
                                    <span>
                                        {submitted 
                                            ? "You've answered! Waiting for partner..." 
                                            : "Your partner can't see yet!"}
                                    </span>
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
                                    className="mt-4 w-full py-3.5 bg-gradient-to-r from-pink-400 to-violet-400 text-white font-bold rounded-2xl shadow-soft disabled:opacity-40 disabled:saturate-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                >
                                    <Check size={16} />
                                    Submit Answer
                                </button>
                            ) : bothAnswered ? (
                                <button
                                    onClick={handleReveal}
                                    className="mt-4 w-full py-3.5 bg-gradient-to-r from-green-400 to-emerald-400 text-white font-bold rounded-2xl shadow-soft active:scale-[0.98] transition-all flex items-center justify-center gap-2"
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
                                    className="bg-gradient-to-br from-pink-50 to-white p-4 rounded-2xl border border-pink-100/50"
                                >
                                    <p className="text-xs text-pink-500 font-bold mb-1.5 flex items-center gap-1">
                                        <span>👤</span> {currentUser?.name || 'You'} said:
                                    </p>
                                    <p className="text-neutral-700 text-sm">{answer}</p>
                                </motion.div>
                                
                                {/* Partner's answer */}
                                <motion.div 
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.4 }}
                                    className="bg-gradient-to-br from-violet-50 to-white p-4 rounded-2xl border border-violet-100/50"
                                >
                                    <p className="text-xs text-violet-500 font-bold mb-1.5 flex items-center gap-1">
                                        <span>💑</span> {partner?.name || 'Partner'} said:
                                    </p>
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
                                        <span className="px-4 py-2 bg-gradient-to-r from-amber-100 to-orange-100 rounded-full text-sm font-bold text-amber-700 flex items-center gap-2">
                                            ✨ You both answered! +5 Kibbles
                                        </span>
                                    </motion.div>
                                )}
                            </div>
                            
                            {/* Action buttons */}
                            <div className="mt-4 space-y-2">
                                <button
                                    onClick={() => setRevealed(false)}
                                    className="w-full py-3 bg-white/80 text-violet-600 font-bold rounded-2xl border border-violet-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
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
                                                    return (
                                                        <div key={userId} className="bg-neutral-50 rounded-lg p-2">
                                                            <p className="text-xs text-neutral-400 font-medium mb-0.5">{user?.name || 'User'}</p>
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
