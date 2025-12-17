import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, History, Gavel } from 'lucide-react';
import JudgeSelection from './JudgeSelection';

/**
 * CourtAtRest - Premium Court Idle Experience V2
 * One-pager design with multi-color accents and compact layout
 */
const CourtAtRest = ({ onServe, navigate }) => {
    const [catPhase, setCatPhase] = useState(0);
    const [showJudgeSelection, setShowJudgeSelection] = useState(false);
    const [displayText, setDisplayText] = useState('');

    const sleepingPhrases = [
        "Zzz... dreaming of justice...",
        "*purrs softly*",
        "No disputes? Purrfect..."
    ];

    // Cycle through phrases
    useEffect(() => {
        const interval = setInterval(() => {
            setCatPhase(prev => (prev + 1) % 3);
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    // Typewriter effect
    useEffect(() => {
        const phrase = sleepingPhrases[catPhase];
        setDisplayText('');
        let i = 0;
        const typeInterval = setInterval(() => {
            if (i < phrase.length) {
                setDisplayText(phrase.slice(0, i + 1));
                i++;
            } else {
                clearInterval(typeInterval);
            }
        }, 40);
        return () => clearInterval(typeInterval);
    }, [catPhase]);

    const handleServeWithJudge = (judgeType) => {
        setShowJudgeSelection(false);
        onServe(judgeType);
    };

    // Floating element configs - positioned relative to the scene container
    const floatingElements = [
        // Gold stars (brand primary)
        { type: '✦', color: 'text-court-gold', size: 'text-sm', left: '5%', top: '10%', delay: 0 },
        { type: '✦', color: 'text-court-gold', size: 'text-xs', left: '88%', top: '15%', delay: 1.2 },
        { type: '✦', color: 'text-court-goldLight', size: 'text-base', left: '85%', top: '45%', delay: 0.5 },
        // Lavender stars (dreamy, complements gold)
        { type: '✦', color: 'text-lavender-300', size: 'text-sm', left: '8%', top: '35%', delay: 0.8 },
        { type: '✦', color: 'text-lavender-400', size: 'text-xs', left: '90%', top: '60%', delay: 1.5 },
        // Blush hearts (love theme)
        { type: '♥', color: 'text-blush-300', size: 'text-xs', left: '6%', top: '55%', delay: 2.0 },
        { type: '♥', color: 'text-blush-400', size: 'text-sm', left: '92%', top: '30%', delay: 0.3 },
        // Moon (sleepy vibe)
        { type: '☽', color: 'text-lavender-300', size: 'text-base', left: '88%', top: '5%', delay: 1.8 },
    ];

    return (
        <div className="relative h-[calc(100dvh-100px)] flex flex-col items-center justify-start px-4 py-2 overflow-hidden">
            {/* Judge Selection Modal */}
            <JudgeSelection
                isOpen={showJudgeSelection}
                onClose={() => setShowJudgeSelection(false)}
                onServe={handleServeWithJudge}
            />

            {/* Floating Decorative Elements - Inside this container */}
            {floatingElements.map((el, i) => (
                <motion.span
                    key={i}
                    animate={{
                        y: [0, -12, 0],
                        opacity: [0.4, 0.8, 0.4],
                        scale: [0.9, 1.1, 0.9],
                    }}
                    transition={{
                        duration: 3 + Math.random() * 2,
                        delay: el.delay,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                    className={`absolute ${el.color} ${el.size} drop-shadow-sm pointer-events-none`}
                    style={{ left: el.left, top: el.top }}
                >
                    {el.type}
                </motion.span>
            ))}

            {/* Main Scene - Compact */}
            <div className="relative z-10 flex flex-col items-center w-full max-w-sm">
                {/* Sleeping Judge */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative"
                >
                    {/* Avatar with gentle breathing */}
                    <motion.div
                        animate={{
                            y: [0, -4, 0],
                            rotate: [-1, 1, -1]
                        }}
                        transition={{
                            duration: 4,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                        className="relative"
                    >
                        {/* Outer glow - multi-color */}
                        <motion.div
                            animate={{
                                scale: [1, 1.05, 1],
                                opacity: [0.3, 0.5, 0.3]
                            }}
                            transition={{ duration: 3, repeat: Infinity }}
                            className="absolute -inset-3 bg-gradient-to-br from-court-gold/20 via-lavender-200/15 to-blush-200/20 rounded-full blur-xl"
                        />

                        {/* Avatar - slightly smaller */}
                        <div className="relative w-36 h-36 rounded-full mx-auto overflow-hidden shadow-xl border-4 border-white/50">
                            <img
                                src="/assets/avatars/sleeping_judge_whiskers.png"
                                alt="Sleeping Judge Whiskers"
                                className="w-full h-full object-cover"
                            />
                        </div>

                        {/* Floating Zzz */}
                        <div className="absolute right-0 top-1">
                            {['z', 'Z', 'Z'].map((letter, i) => (
                                <motion.span
                                    key={i}
                                    animate={{
                                        opacity: [0, 1, 0],
                                        x: [0, 8 + i * 3, 16 + i * 5],
                                        y: [0, -10 - i * 5, -24 - i * 8]
                                    }}
                                    transition={{
                                        duration: 2.5,
                                        delay: i * 0.5,
                                        repeat: Infinity,
                                        ease: "easeOut"
                                    }}
                                    className="absolute text-court-gold font-bold drop-shadow-sm"
                                    style={{ fontSize: `${10 + i * 4}px` }}
                                >
                                    {letter}
                                </motion.span>
                            ))}
                        </div>
                    </motion.div>
                </motion.div>

                {/* Speech Bubble - tighter spacing */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={catPhase}
                        initial={{ opacity: 0, y: 6, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.95 }}
                        className="mt-9 backdrop-blur-sm bg-white/60 px-4 py-2 rounded-2xl shadow-md border border-white/40"
                    >
                        <p className="text-court-brownLight text-sm italic min-h-[1.25rem]">
                            {displayText}
                            <motion.span
                                animate={{ opacity: [1, 0] }}
                                transition={{ duration: 0.5, repeat: Infinity }}
                                className="ml-0.5 text-court-gold"
                            >
                                |
                            </motion.span>
                        </p>
                    </motion.div>
                </AnimatePresence>

                {/* Status Badge - tighter spacing */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="mt-16 text-center"
                >
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full
                        bg-gradient-to-r from-court-gold/10 via-lavender-100/30 to-blush-100/20
                        border border-court-gold/20 shadow-sm"
                    >
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                        >
                            <Moon className="w-3.5 h-3.5 text-lavender-400" />
                        </motion.div>
                        <span className="text-sm font-semibold text-court-brown">Court Adjourned</span>
                    </div>
                    <p className="text-xs text-court-brownLight mt-1 max-w-[200px] mx-auto">
                        The courtroom is peaceful. No disputes to settle.
                    </p>
                </motion.div>

                {/* Action Buttons - Side by Side, tighter spacing */}
                <div className="w-full mt-20">
                    <div className="flex gap-3">
                        {/* Primary CTA - Gold */}
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setShowJudgeSelection(true)}
                            style={{ background: 'linear-gradient(135deg, #B85C6B 0%, #8B4049 100%)' }}
                            className="group relative flex-1 py-3 rounded-2xl font-bold text-white shadow-lg overflow-hidden
                                bg-gradient-to-r from-court-gold via-court-goldLight to-court-gold"
                        >
                            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent
                                group-hover:translate-x-full transition-transform duration-700" />
                            <span className="relative flex items-center justify-center gap-2">
                                <Gavel className="w-4 h-4" />
                                New Case
                            </span>
                        </motion.button>

                        {/* Secondary - Blush tint */}
                        <motion.button
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => navigate('/history')}
                            className="flex-1 py-3 rounded-2xl font-medium text-court-brown
                                bg-gradient-to-r from-blush-50 to-blush-100 border border-blush-200
                                hover:from-blush-100 hover:to-blush-200 transition-all
                                flex items-center justify-center gap-2 shadow-sm"
                        >
                            <History className="w-4 h-4 text-blush-500" />
                            Past Cases
                        </motion.button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CourtAtRest;
