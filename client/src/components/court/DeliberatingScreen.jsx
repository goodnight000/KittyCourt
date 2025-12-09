import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scale, Sparkles, BookOpen, Eye, Heart } from 'lucide-react';

/**
 * DeliberatingScreen - Premium waiting screen while Judge Whiskers generates verdict
 * 
 * Features:
 * - Rotating cat-themed thinking messages
 * - Animated gavel/scale icons
 * - Particle effect stars
 * - Judge Whiskers avatar with glow
 * - Glassmorphic info cards
 */

// Rotating phrases that cycle through
const THINKING_PHRASES = [
    { text: "Reviewing the evidence...", icon: BookOpen, emoji: "📋" },
    { text: "Consulting ancient cat law...", icon: Scale, emoji: "⚖️" },
    { text: "Weighing both sides fairly...", icon: Heart, emoji: "💭" },
    { text: "Seeking feline wisdom...", icon: Sparkles, emoji: "✨" },
    { text: "Reading between the lines...", icon: Eye, emoji: "🔍" },
    { text: "Considering mitigating circumstances...", icon: Scale, emoji: "🐱" },
];

// Fun cat law facts
const CAT_LAW_FACTS = [
    "Cat Law Article 3.7: All disputes must be resolved with fairness and treats.",
    "Ancient Whisker Wisdom: The best verdict is one both parties can live with.",
    "Judge Whiskers has resolved over 9,000 cases (that's right, over 9 lives worth!).",
    "Fun fact: Judge Whiskers always deliberates with a cup of warm milk nearby.",
    "Cat Court Rule #1: No hissing until the verdict is read.",
];

const DeliberatingScreen = ({ isLoading }) => {
    const [phraseIndex, setPhraseIndex] = useState(0);
    const [factIndex, setFactIndex] = useState(0);

    // Rotate through phrases
    useEffect(() => {
        if (!isLoading) return;

        const interval = setInterval(() => {
            setPhraseIndex((prev) => (prev + 1) % THINKING_PHRASES.length);
        }, 3500);

        return () => clearInterval(interval);
    }, [isLoading]);

    // Rotate through facts
    useEffect(() => {
        if (!isLoading) return;

        const interval = setInterval(() => {
            setFactIndex((prev) => (prev + 1) % CAT_LAW_FACTS.length);
        }, 8000);

        return () => clearInterval(interval);
    }, [isLoading]);

    if (!isLoading) return null;

    const currentPhrase = THINKING_PHRASES[phraseIndex];
    const IconComponent = currentPhrase.icon;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 flex flex-col items-center justify-center overflow-hidden"
        >
            {/* Animated gradient overlay */}
            <motion.div
                animate={{
                    background: [
                        'radial-gradient(circle at 30% 20%, rgba(139,92,246,0.15) 0%, transparent 50%)',
                        'radial-gradient(circle at 70% 80%, rgba(139,92,246,0.15) 0%, transparent 50%)',
                        'radial-gradient(circle at 30% 20%, rgba(139,92,246,0.15) 0%, transparent 50%)',
                    ]
                }}
                transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0"
            />

            {/* Floating particles */}
            {[...Array(30)].map((_, i) => (
                <motion.div
                    key={i}
                    initial={{
                        opacity: 0,
                        y: '100vh',
                        x: `${Math.random() * 100}vw`
                    }}
                    animate={{
                        opacity: [0, 0.8, 0],
                        y: '-20vh',
                    }}
                    transition={{
                        duration: 6 + Math.random() * 4,
                        delay: Math.random() * 5,
                        repeat: Infinity,
                        ease: 'linear'
                    }}
                    className="absolute"
                    style={{ left: `${Math.random() * 100}%` }}
                >
                    <Sparkles className={`w-${2 + Math.floor(Math.random() * 3)} h-${2 + Math.floor(Math.random() * 3)} text-amber-400/40`} />
                </motion.div>
            ))}

            {/* Static ambient stars */}
            {[...Array(40)].map((_, i) => (
                <motion.div
                    key={`star-${i}`}
                    animate={{ opacity: [0.1, 0.6, 0.1], scale: [1, 1.2, 1] }}
                    transition={{
                        duration: 2 + Math.random() * 3,
                        delay: Math.random() * 3,
                        repeat: Infinity
                    }}
                    className="absolute w-1 h-1 bg-white rounded-full"
                    style={{
                        left: `${Math.random() * 100}%`,
                        top: `${Math.random() * 100}%`
                    }}
                />
            ))}

            {/* Main content */}
            <div className="relative z-10 flex flex-col items-center max-w-lg mx-auto px-6">

                {/* Title with gavel animation */}
                <motion.div
                    initial={{ opacity: 0, y: -30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="flex items-center gap-3 mb-8"
                >
                    <motion.span
                        animate={{ rotate: [-15, 15, -15] }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
                        className="text-4xl"
                    >
                        🔨
                    </motion.span>
                    <h1 className="text-2xl md:text-3xl font-bold text-white">
                        Court is in Session
                    </h1>
                </motion.div>

                {/* Judge Whiskers Avatar */}
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3, type: 'spring' }}
                    className="relative mb-8"
                >
                    {/* Outer glow ring */}
                    <motion.div
                        animate={{
                            scale: [1, 1.15, 1],
                            opacity: [0.3, 0.6, 0.3]
                        }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute -inset-4 rounded-full"
                        style={{
                            background: 'radial-gradient(circle, rgba(251,191,36,0.4) 0%, transparent 70%)',
                        }}
                    />

                    {/* Inner glow */}
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                        className="absolute -inset-2 rounded-full"
                        style={{
                            background: 'conic-gradient(from 0deg, transparent, rgba(251,191,36,0.3), transparent, rgba(168,85,247,0.3), transparent)',
                        }}
                    />

                    {/* Avatar container */}
                    <motion.div
                        animate={{ y: [0, -6, 0] }}
                        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                        className="relative w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-4 border-amber-400/50 shadow-2xl shadow-amber-500/20"
                    >
                        {/* Placeholder avatar - gradient background */}
                        <div className="w-full h-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                            <span className="text-6xl md:text-7xl">🐱</span>
                        </div>

                        {/* When you have an image, use this instead:
                        <img
                            src="/assets/avatars/judge_whiskers.png"
                            alt="Judge Whiskers"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                e.target.style.display = 'none';
                            }}
                        />
                        */}
                    </motion.div>

                    {/* Thinking bubble */}
                    <motion.div
                        animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="absolute -right-2 -top-2 bg-white/90 rounded-full px-3 py-1 shadow-lg"
                    >
                        <div className="flex gap-1">
                            {[0, 1, 2].map((i) => (
                                <motion.span
                                    key={i}
                                    animate={{ opacity: [0.3, 1, 0.3] }}
                                    transition={{
                                        duration: 1,
                                        delay: i * 0.2,
                                        repeat: Infinity
                                    }}
                                    className="text-lg"
                                >
                                    💭
                                </motion.span>
                            ))}
                        </div>
                    </motion.div>
                </motion.div>

                {/* Rotating status message */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="mb-8"
                >
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={phraseIndex}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                            className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-full px-6 py-3 border border-white/10"
                        >
                            <motion.span
                                animate={{ rotate: [0, 10, -10, 0] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="text-2xl"
                            >
                                {currentPhrase.emoji}
                            </motion.span>
                            <span className="text-white/90 font-medium">
                                {currentPhrase.text}
                            </span>
                        </motion.div>
                    </AnimatePresence>
                </motion.div>

                {/* Progress indicator */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="flex items-center gap-3 mb-8"
                >
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                        className="w-5 h-5 border-2 border-amber-400/30 border-t-amber-400 rounded-full"
                    />
                    <span className="text-white/50 text-sm">
                        Judge Whiskers is contemplating...
                    </span>
                </motion.div>

                {/* Fun fact card */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="w-full"
                >
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={factIndex}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.4 }}
                            className="bg-gradient-to-r from-purple-500/10 to-indigo-500/10 backdrop-blur-sm rounded-2xl p-4 border border-purple-500/20"
                        >
                            <div className="flex items-start gap-3">
                                <span className="text-2xl">📜</span>
                                <p className="text-white/60 text-sm italic">
                                    {CAT_LAW_FACTS[factIndex]}
                                </p>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </motion.div>
            </div>

            {/* Bottom decorative scales */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.3 }}
                transition={{ delay: 0.7 }}
                className="absolute bottom-8 left-1/2 -translate-x-1/2"
            >
                <motion.div
                    animate={{ rotate: [-5, 5, -5] }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                >
                    <Scale className="w-12 h-12 text-amber-400/30" />
                </motion.div>
            </motion.div>
        </motion.div>
    );
};

export default DeliberatingScreen;
