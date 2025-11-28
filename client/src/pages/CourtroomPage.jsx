import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import useAppStore from '../store/useAppStore';
import { Lock, Send, Scale, Heart, MessageCircle, RotateCcw, History, Sparkles, AlertTriangle, HeartHandshake, Quote } from 'lucide-react';

const CourtroomPage = () => {
    const navigate = useNavigate();
    const { activeCase, currentUser, updateCaseInput, submitSide, resetCase, users } = useAppStore();

    const isUserA = currentUser?.name?.includes('User A');
    const myInput = isUserA ? activeCase.userAInput : activeCase.userBInput;
    const myFeelings = isUserA ? activeCase.userAFeelings : activeCase.userBFeelings;
    const isLocked = (isUserA && activeCase.status === 'LOCKED_A') ||
        (!isUserA && activeCase.status === 'DELIBERATING') ||
        activeCase.status === 'RESOLVED';

    // Get partner names for display
    const userAName = users?.find(u => u.name?.includes('User A'))?.name || 'Partner A';
    const userBName = users?.find(u => u.name?.includes('User B'))?.name || 'Partner B';

    // Verdict View - NEW PSYCHOLOGICAL FRAMEWORK
    if (activeCase.status === 'RESOLVED' && activeCase.verdict) {
        const verdict = activeCase.verdict;
        const analysis = verdict.analysis;
        
        return (
            <div className="space-y-4 pb-4">
                {/* Header */}
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="glass-card p-5 text-center bg-gradient-to-br from-violet-50/80 to-pink-50/80"
                >
                    <motion.div
                        animate={{ rotate: [-5, 5, -5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="w-20 h-20 bg-gradient-to-br from-amber-100 to-amber-50 rounded-3xl flex items-center justify-center mx-auto mb-3 shadow-lg"
                    >
                        <span className="text-4xl">🐱</span>
                    </motion.div>

                    <h2 className="text-xl font-bold text-neutral-800 mb-1">Judge Mittens Has Spoken</h2>
                    <p className="text-xs text-neutral-500">The Therapist Cat delivers wisdom</p>
                    
                    {/* Dynamic Badge */}
                    {analysis?.identifiedDynamic && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="mt-3 inline-flex items-center gap-1.5 bg-violet-100 text-violet-700 text-xs font-bold px-3 py-1.5 rounded-full"
                        >
                            <Sparkles className="w-3 h-3" />
                            {analysis.identifiedDynamic} Pattern Detected
                        </motion.div>
                    )}
                </motion.div>

                {/* The Summary - Translation */}
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="glass-card p-4 space-y-3"
                >
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-violet-100 to-violet-50 rounded-xl flex items-center justify-center">
                            <Quote className="w-4 h-4 text-violet-600" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-violet-600">The Real Story</h3>
                            <p className="text-[10px] text-neutral-400">What you're really fighting about</p>
                        </div>
                    </div>
                    <p className="text-neutral-700 text-sm leading-relaxed pl-10">
                        {verdict.theSummary || verdict.summary}
                    </p>
                </motion.div>

                {/* The Purr - Validation */}
                {verdict.theRuling_ThePurr && (
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="glass-card p-4 space-y-4 bg-gradient-to-br from-green-50/60 to-emerald-50/60"
                    >
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-green-100 to-green-50 rounded-xl flex items-center justify-center">
                                <span className="text-lg">😻</span>
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-green-700">The Purr</h3>
                                <p className="text-[10px] text-green-600/70">Your feelings are valid</p>
                            </div>
                        </div>
                        
                        <div className="space-y-3 pl-2">
                            {/* User A Validation */}
                            <div className="border-l-2 border-green-200 pl-3">
                                <p className="text-xs font-bold text-green-700 mb-1">{userAName}</p>
                                <p className="text-neutral-700 text-sm leading-relaxed">
                                    {verdict.theRuling_ThePurr.userA}
                                </p>
                            </div>
                            
                            {/* User B Validation */}
                            <div className="border-l-2 border-green-200 pl-3">
                                <p className="text-xs font-bold text-green-700 mb-1">{userBName}</p>
                                <p className="text-neutral-700 text-sm leading-relaxed">
                                    {verdict.theRuling_ThePurr.userB}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* The Hiss - Accountability */}
                {verdict.theRuling_TheHiss && verdict.theRuling_TheHiss.length > 0 && (
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="glass-card p-4 space-y-3 bg-gradient-to-br from-amber-50/60 to-orange-50/60"
                    >
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-amber-100 to-amber-50 rounded-xl flex items-center justify-center">
                                <span className="text-lg">🙀</span>
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-amber-700">The Hiss</h3>
                                <p className="text-[10px] text-amber-600/70">Behaviors to work on</p>
                            </div>
                        </div>
                        
                        <div className="space-y-2 pl-2">
                            {verdict.theRuling_TheHiss.map((hiss, index) => (
                                <div key={index} className="flex items-start gap-2 text-sm text-neutral-700">
                                    <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                                    <p className="leading-relaxed">{hiss}</p>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* The Sentence - Repair Attempt */}
                {verdict.theSentence && (
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="glass-card p-4 space-y-3 bg-gradient-to-br from-pink-50/80 to-violet-50/80 border-2 border-pink-200/50"
                    >
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-pink-100 to-pink-50 rounded-xl flex items-center justify-center">
                                <HeartHandshake className="w-4 h-4 text-pink-600" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-pink-700">The Repair</h3>
                                <p className="text-[10px] text-pink-600/70">Your path to reconnection</p>
                            </div>
                        </div>
                        
                        <div className="bg-white/60 rounded-xl p-4 space-y-2">
                            <h4 className="font-bold text-neutral-800 flex items-center gap-2">
                                <span className="text-lg">✨</span>
                                {verdict.theSentence.title}
                            </h4>
                            <p className="text-neutral-700 text-sm leading-relaxed">
                                {verdict.theSentence.description}
                            </p>
                            {verdict.theSentence.rationale && (
                                <p className="text-xs text-pink-600 italic mt-2 pt-2 border-t border-pink-100">
                                    💡 {verdict.theSentence.rationale}
                                </p>
                            )}
                        </div>
                    </motion.div>
                )}

                {/* Closing Statement */}
                {verdict.closingStatement && (
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="text-center px-4 py-3"
                    >
                        <p className="text-neutral-600 text-sm italic leading-relaxed">
                            "{verdict.closingStatement}"
                        </p>
                        <p className="text-neutral-400 text-xs mt-2">— Judge Mittens 🐱</p>
                    </motion.div>
                )}

                {/* Four Horsemen Detected (if any severe ones) */}
                {analysis && (analysis.userA_Horsemen?.length > 0 || analysis.userB_Horsemen?.length > 0) && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 }}
                        className="glass-card p-3 bg-neutral-50/50"
                    >
                        <p className="text-xs text-neutral-500 text-center mb-2">Gottman's Four Horsemen Detected</p>
                        <div className="flex flex-wrap justify-center gap-1.5">
                            {[...new Set([...(analysis.userA_Horsemen || []), ...(analysis.userB_Horsemen || [])])].filter(h => h !== 'None').map((horseman, i) => (
                                <span key={i} className={`text-xs px-2 py-1 rounded-full ${
                                    horseman === 'Contempt' || horseman === 'Stonewalling' 
                                        ? 'bg-red-100 text-red-700' 
                                        : 'bg-amber-100 text-amber-700'
                                }`}>
                                    {horseman}
                                </span>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
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

                    <h2 className="text-xl font-bold text-neutral-800 mb-2">Judge Mittens is Thinking...</h2>
                    <p className="text-neutral-500 text-sm mb-1">Analyzing your conflict patterns</p>
                    <p className="text-neutral-400 text-xs mb-4">Using the Gottman Method 💜</p>

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
                        Pass the phone to <span className="text-gradient font-bold">{isUserA ? userBName : userAName}</span>
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
