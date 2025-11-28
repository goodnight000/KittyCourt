import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Heart, Coffee, TrendingUp, Sparkles, Star, Gift, X, Check, Scale, History } from 'lucide-react';
import useAppStore from '../store/useAppStore';

const DashboardPage = () => {
    const navigate = useNavigate();
    const { currentUser, users, logGoodDeed, caseHistory } = useAppStore();
    const [showGoodDeedModal, setShowGoodDeedModal] = useState(false);
    
    // Get partner name for good deed display
    const partner = users?.find(u => u.id !== currentUser?.id);
    const partnerName = partner?.name || 'your partner';
    const [goodDeedText, setGoodDeedText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const vibeScore = 75;
    const daysTogether = 7;

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
                        Hey, <span className="text-gradient">{currentUser?.name}</span>!
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
                    onClick={() => navigate('/economy')}
                    className="glass-card p-4 bg-gradient-to-br from-amber-50/80 to-white/60 cursor-pointer"
                >
                    <div className="flex items-center gap-2 mb-1">
                        <Coffee className="w-5 h-5 text-amber-500" />
                        <span className="text-2xl font-bold text-neutral-800">{currentUser?.kibbleBalance || 0}</span>
                    </div>
                    <span className="text-xs text-neutral-500 font-medium">Kibble</span>
                </motion.div>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileTap={{ scale: 0.98 }}
                    className="glass-card p-4 bg-gradient-to-br from-pink-50/80 to-white/60"
                >
                    <div className="flex items-center gap-2 mb-1">
                        <Heart className="w-5 h-5 text-pink-500" />
                        <span className="text-2xl font-bold text-neutral-800">{daysTogether}</span>
                    </div>
                    <span className="text-xs text-neutral-500 font-medium">Days Together</span>
                </motion.div>
            </div>

            {/* Vibe Meter */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-card p-4"
            >
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <motion.div
                            animate={{ scale: [1, 1.15, 1] }}
                            transition={{ duration: 1, repeat: Infinity }}
                        >
                            <Heart className="w-5 h-5 text-pink-400 fill-pink-400" />
                        </motion.div>
                        <span className="font-bold text-neutral-700">Relationship Vibe</span>
                    </div>
                    <span className="text-2xl font-bold text-gradient">{vibeScore}%</span>
                </div>

                {/* Progress Bar */}
                <div className="h-3 bg-neutral-100 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${vibeScore}%` }}
                        transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
                        className="h-full bg-gradient-to-r from-pink-400 via-violet-400 to-amber-400 rounded-full"
                    />
                </div>

                <p className="text-center text-xs text-neutral-400 mt-3 italic">
                    "Purr-fectly acceptable... for now." 🐱
                </p>
            </motion.div>

            {/* Judge Card */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                onClick={() => navigate('/courtroom')}
                className="glass-card p-5 text-center cursor-pointer"
            >
                <motion.div
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                    className="relative inline-block mb-3"
                >
                    <div className="w-20 h-20 bg-gradient-to-br from-pink-100 to-violet-100 rounded-3xl flex items-center justify-center shadow-soft mx-auto">
                        <span className="text-4xl">🐱</span>
                    </div>
                    <motion.span
                        animate={{ rotate: [-5, 5, -5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="absolute -top-3 left-1/2 -translate-x-1/2 text-xl"
                    >
                        ��
                    </motion.span>
                </motion.div>

                <h2 className="font-bold text-neutral-800 mb-1">Judge Mittens</h2>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-violet-50 text-violet-600 rounded-full text-xs font-bold">
                    <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse" />
                    Tap to file a case
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
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setShowGoodDeedModal(true)}
                        className="glass-card p-4 text-left relative overflow-hidden active:bg-white/90 transition-colors"
                    >
                        <span className="absolute top-2 right-2 text-lg opacity-50">✨</span>
                        <div className="w-10 h-10 bg-white/80 rounded-xl flex items-center justify-center shadow-soft mb-2">
                            <Star className="w-5 h-5 text-amber-500" />
                        </div>
                        <div className="font-bold text-neutral-800 text-sm">Give Kibble</div>
                        <div className="text-xs text-neutral-500">Reward partner</div>
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

                {/* Additional Actions */}
                <div className="grid grid-cols-2 gap-3">
                    <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => navigate('/courtroom')}
                        className="glass-card p-4 text-left relative overflow-hidden active:bg-white/90 transition-colors"
                    >
                        <span className="absolute top-2 right-2 text-lg opacity-50">⚖️</span>
                        <div className="w-10 h-10 bg-white/80 rounded-xl flex items-center justify-center shadow-soft mb-2">
                            <Scale className="w-5 h-5 text-violet-500" />
                        </div>
                        <div className="font-bold text-neutral-800 text-sm">File Case</div>
                        <div className="text-xs text-neutral-500">Resolve dispute</div>
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
                        <div className="font-bold text-neutral-800 text-sm">History</div>
                        <div className="text-xs text-neutral-500">{caseHistory?.length || 0} cases</div>
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
                                        <h3 className="font-bold text-neutral-800 text-lg">Reward {partnerName} ✨</h3>
                                        <button
                                            onClick={() => setShowGoodDeedModal(false)}
                                            className="w-8 h-8 bg-neutral-100 rounded-full flex items-center justify-center"
                                        >
                                            <X className="w-4 h-4 text-neutral-500" />
                                        </button>
                                    </div>

                                    <p className="text-neutral-500 text-sm -mt-2">
                                        What nice thing did {partnerName} do? They'll get kibble for it!
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
                                                <Star className="w-4 h-4" />
                                                Give {partnerName} Kibble
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
