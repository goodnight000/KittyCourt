import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import useAppStore from '../store/useAppStore';
import { Lock, Send, Scale, Heart, MessageCircle, RotateCcw, Award, History, Trophy, Scroll } from 'lucide-react';

const CourtroomPage = () => {
    const navigate = useNavigate();
    const { activeCase, currentUser, updateCaseInput, submitSide, resetCase } = useAppStore();

    const isUserA = currentUser?.name?.includes('User A');
    const myInput = isUserA ? activeCase.userAInput : activeCase.userBInput;
    const myFeelings = isUserA ? activeCase.userAFeelings : activeCase.userBFeelings;
    const isLocked = (isUserA && activeCase.status === 'LOCKED_A') ||
        (!isUserA && activeCase.status === 'DELIBERATING') ||
        activeCase.status === 'RESOLVED';

    // Verdict View
    if (activeCase.status === 'RESOLVED' && activeCase.verdict) {
        const verdict = activeCase.verdict;
        return (
            <div className="space-y-4">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="glass-card p-5 text-center"
                >
                    <motion.div
                        animate={{ rotate: [-5, 5, -5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="w-16 h-16 bg-gradient-to-br from-amber-100 to-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-3"
                    >
                        <Award className="w-8 h-8 text-amber-500" />
                    </motion.div>

                    <h2 className="text-lg font-bold text-neutral-800 mb-1">Verdict Delivered! ⚖️</h2>
                    <p className="text-xs text-neutral-500">Judge Whiskers has spoken</p>
                </motion.div>

                {/* Summary */}
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="glass-card p-4 space-y-2"
                >
                    <div className="flex items-center gap-2 text-sm font-bold text-violet-600">
                        <Scroll className="w-4 h-4" />
                        Summary
                    </div>
                    <p className="text-neutral-700 text-sm leading-relaxed">{verdict.summary}</p>
                </motion.div>

                {/* Ruling */}
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="glass-card p-4 bg-gradient-to-br from-pink-50/80 to-violet-50/80 space-y-2"
                >
                    <div className="flex items-center gap-2 text-sm font-bold text-pink-600">
                        <Trophy className="w-4 h-4" />
                        The Ruling
                    </div>
                    <p className="text-neutral-800 font-semibold">{verdict.ruling}</p>
                </motion.div>

                {/* Sentence */}
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="glass-card p-4 bg-gradient-to-br from-amber-50/80 to-white space-y-2"
                >
                    <div className="flex items-center gap-2 text-sm font-bold text-amber-600">
                        <Scale className="w-4 h-4" />
                        Sentence
                    </div>
                    <p className="text-neutral-700 text-sm">{verdict.sentence}</p>
                </motion.div>

                {/* Actions */}
                <div className="flex gap-3">
                    <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={resetCase}
                        className="btn-primary flex-1 flex items-center justify-center gap-2"
                    >
                        <RotateCcw className="w-4 h-4" />
                        New Case
                    </motion.button>
                    <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => navigate('/history')}
                        className="glass-card px-4 py-3 flex items-center justify-center gap-2 text-violet-600 font-bold text-sm"
                    >
                        <History className="w-4 h-4" />
                        History
                    </motion.button>
                </div>
            </div>
        );
    }

    // Deliberating View
    if (activeCase.status === 'DELIBERATING') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card p-6 text-center max-w-sm w-full"
                >
                    <motion.div
                        animate={{ y: [0, -8, 0] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        className="w-24 h-24 bg-gradient-to-br from-violet-100 to-pink-100 rounded-3xl flex items-center justify-center mx-auto mb-4"
                    >
                        <span className="text-5xl">🐱</span>
                    </motion.div>

                    <h2 className="text-xl font-bold text-neutral-800 mb-2">Judge is Deliberating...</h2>
                    <p className="text-neutral-500 text-sm mb-4">The wise one ponders your case</p>

                    <div className="flex justify-center gap-1">
                        {[0, 1, 2].map((i) => (
                            <motion.div
                                key={i}
                                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
                                className="w-2.5 h-2.5 bg-violet-400 rounded-full"
                            />
                        ))}
                    </div>
                </motion.div>
            </div>
        );
    }

    // Locked View
    if (isLocked) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card p-6 text-center max-w-sm w-full"
                >
                    <motion.div
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="w-16 h-16 bg-gradient-to-br from-violet-100 to-pink-100 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    >
                        <Lock className="w-8 h-8 text-violet-500" />
                    </motion.div>

                    <h2 className="text-lg font-bold text-neutral-800 mb-2">Evidence Sealed! 🔒</h2>
                    <p className="text-neutral-500 text-sm mb-4">
                        Pass the phone to <span className="text-gradient font-bold">{isUserA ? 'Partner B' : 'Partner A'}</span>
                    </p>

                    <div className="bg-violet-50 text-violet-600 text-xs rounded-xl px-4 py-3 flex items-center justify-center gap-2">
                        <span>💡</span> Switch users using the toggle at the top
                    </div>
                </motion.div>
            </div>
        );
    }

    // Main Input View
    return (
        <div className="space-y-5">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center"
            >
                <motion.div
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity }}
                    className="w-14 h-14 bg-gradient-to-br from-amber-100 to-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-3"
                >
                    <Scale className="w-7 h-7 text-amber-600" />
                </motion.div>
                <h1 className="text-xl font-bold text-gradient">The Courtroom</h1>
                <p className="text-neutral-500 text-sm">File your grievance 🐱</p>
            </motion.div>

            {/* Form Card */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-card p-4 space-y-5"
            >
                {/* Facts Input */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-bold text-violet-600">
                        <MessageCircle className="w-4 h-4" />
                        The Facts
                    </label>
                    <textarea
                        value={myInput}
                        onChange={(e) => updateCaseInput(e.target.value, 'facts')}
                        placeholder="What happened?"
                        className="w-full h-28 bg-white/70 border-2 border-violet-100 rounded-xl p-3 text-neutral-700 placeholder:text-neutral-400 focus:ring-2 focus:ring-violet-200 focus:border-violet-300 focus:outline-none resize-none text-sm"
                    />
                </div>

                {/* Feelings Input */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-bold text-pink-500">
                        <Heart className="w-4 h-4" />
                        The Feelings
                    </label>
                    <textarea
                        value={myFeelings}
                        onChange={(e) => updateCaseInput(e.target.value, 'feelings')}
                        placeholder="How did it make you feel?"
                        className="w-full h-20 bg-white/70 border-2 border-pink-100 rounded-xl p-3 text-neutral-700 placeholder:text-neutral-400 focus:ring-2 focus:ring-pink-200 focus:border-pink-300 focus:outline-none resize-none text-sm"
                    />
                </div>

                {/* Submit Button */}
                <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={submitSide}
                    disabled={!myInput.trim()}
                    className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Send className="w-4 h-4" />
                    Submit Evidence
                </motion.button>
            </motion.div>

            {/* History Link */}
            <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                onClick={() => navigate('/history')}
                className="w-full text-center text-sm text-violet-500 font-medium flex items-center justify-center gap-2"
            >
                <History className="w-4 h-4" />
                View Past Cases
            </motion.button>

            {/* Tip */}
            <p className="text-center text-xs text-neutral-400 italic">
                🐾 The judge values honesty and treats! 🐾
            </p>
        </div>
    );
};

export default CourtroomPage;
