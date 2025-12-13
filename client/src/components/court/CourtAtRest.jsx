import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Moon, History, Gavel, Zap, Coffee, Heart } from 'lucide-react';
import JudgeSelection from './JudgeSelection';

/**
 * CourtAtRest - Shows when no court session is active
 * Sleeping Judge Whiskers with options to file new case or view history
 */
const CourtAtRest = ({ onServe, navigate }) => {
    const [catPhase, setCatPhase] = useState(0);
    const [showJudgeSelection, setShowJudgeSelection] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            setCatPhase(prev => (prev + 1) % 3);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    const sleepingPhrases = [
        "Zzz... dreaming of justice...",
        "*purrs softly*",
        "No disputes? Purrfect..."
    ];

    const handleServeWithJudge = (judgeType) => {
        setShowJudgeSelection(false);
        onServe(judgeType);
    };

    return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center px-4">
            {/* Judge Selection Modal */}
            <JudgeSelection
                isOpen={showJudgeSelection}
                onClose={() => setShowJudgeSelection(false)}
                onServe={handleServeWithJudge}
            />

            {/* Sleeping Cat Scene */}
            <div className="relative">
                {/* Moon & Stars Background */}
                <div className="absolute inset-0 -z-10">
                    {[...Array(8)].map((_, i) => (
                        <motion.div
                            key={i}
                            animate={{
                                opacity: [0.3, 1, 0.3],
                                scale: [0.8, 1.2, 0.8]
                            }}
                            transition={{
                                duration: 2 + Math.random() * 2,
                                delay: Math.random() * 2,
                                repeat: Infinity
                            }}
                            className="absolute text-court-gold/40"
                            style={{
                                left: `${20 + Math.random() * 60}%`,
                                top: `${Math.random() * 40}%`
                            }}
                        >
                            ✦
                        </motion.div>
                    ))}
                </div>

                {/* Sleeping Judge Whiskers */}
                <motion.div
                    animate={{
                        y: [0, -8, 0],
                        rotate: [-2, 2, -2]
                    }}
                    transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                    className="relative"
                >
                    {/* Soft glow behind avatar */}
                    <div className="absolute inset-0 w-52 h-52 -left-2 -top-2 bg-court-gold/20 rounded-full blur-xl" />

                    {/* Cat Avatar */}
                    <div className="relative w-48 h-48 rounded-full mx-auto overflow-hidden shadow-xl border-4 border-court-gold/30">
                        <motion.div
                            animate={{ scale: [1, 1.02, 1] }}
                            transition={{ duration: 3, repeat: Infinity }}
                            className="w-full h-full"
                        >
                            <img
                                src="/assets/avatars/sleeping_judge_whiskers.png"
                                alt="Sleeping Judge Whiskers"
                                className="w-full h-full object-cover"
                            />
                        </motion.div>
                    </div>

                    {/* Floating Zzz */}
                    <div className="absolute right-0 top-4">
                        {['z', 'Z', 'Z'].map((letter, i) => (
                            <motion.span
                                key={i}
                                initial={{ opacity: 0, x: 0, y: 0 }}
                                animate={{
                                    opacity: [0, 1, 0],
                                    x: [0, 10 + i * 4, 20 + i * 6],
                                    y: [0, -12 - i * 6, -28 - i * 10]
                                }}
                                transition={{
                                    duration: 2.5,
                                    delay: i * 0.6,
                                    repeat: Infinity,
                                    ease: "easeOut"
                                }}
                                className="absolute text-court-gold font-bold drop-shadow-sm"
                                style={{ fontSize: `${12 + i * 5}px` }}
                            >
                                {letter}
                            </motion.span>
                        ))}
                    </div>

                    {/* Soft breathing pulse */}
                    <motion.div
                        animate={{
                            scale: [1, 1.08, 1],
                            opacity: [0.3, 0.5, 0.3]
                        }}
                        transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                        className="absolute inset-0 w-48 h-48 rounded-full border-2 border-court-gold/30 mx-auto"
                    />
                </motion.div>

                {/* Speech Bubble */}
                <motion.div
                    key={catPhase}
                    initial={{ opacity: 0.8 }}
                    animate={{ opacity: 1 }}
                    className="mt-6 glass-card px-5 py-3 max-w-xs mx-auto text-center"
                >
                    <p className="text-court-brownLight text-sm italic">
                        {sleepingPhrases[catPhase]}
                    </p>
                </motion.div>
            </div>

            {/* Status Card */}
            <div className="mt-8 text-center space-y-2">
                <div className="inline-flex items-center gap-2 bg-court-cream px-4 py-2 rounded-full">
                    <Moon className="w-4 h-4 text-court-gold" />
                    <span className="text-sm font-medium text-court-brown">Court Adjourned</span>
                </div>
                <p className="text-xs text-court-brownLight max-w-[200px] mx-auto">
                    The courtroom is peaceful. No disputes to settle.
                </p>
            </div>

            {/* Action Buttons */}
            <div className="mt-8 w-full max-w-xs space-y-3">
                <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowJudgeSelection(true)}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                >
                    <Gavel className="w-4 h-4" />
                    File a New Case
                    <Zap className="w-4 h-4" />
                </motion.button>

                <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate('/history')}

                    className="w-full glass-card p-3 flex items-center justify-center gap-2 text-court-brown font-medium"
                >
                    <History className="w-4 h-4 text-court-gold" />
                    View Past Cases
                </motion.button>
            </div>

            {/* Fun Stats */}
            <div className="mt-8 flex gap-6 text-center">
                <div>
                    <Coffee className="w-5 h-5 text-court-gold mx-auto mb-1" />
                    <p className="text-xs text-court-brownLight">Harmony<br />Maintained</p>
                </div>
                <div className="w-px bg-court-tan" />
                <div>
                    <Heart className="w-5 h-5 text-pink-400 mx-auto mb-1" />
                    <p className="text-xs text-court-brownLight">Love<br />Thriving</p>
                </div>
            </div>
        </div>
    );
};

export default CourtAtRest;

