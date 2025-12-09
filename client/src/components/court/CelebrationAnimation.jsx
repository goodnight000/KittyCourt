import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Heart } from 'lucide-react';

/**
 * CelebrationAnimation - Shows when both users accept verdict
 * Confetti, bouncing cat, kibble reward display
 */
const CelebrationAnimation = ({ onComplete, kibbleReward }) => {
    useEffect(() => {
        const timer = setTimeout(onComplete, 5000);
        return () => clearTimeout(timer);
    }, [onComplete]);

    const confettiColors = ['#FFD700', '#FF6B9D', '#A855F7', '#10B981', '#F59E0B', '#EC4899'];

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-gradient-to-br from-court-cream via-white to-pink-50 flex items-center justify-center overflow-hidden"
        >
            {/* Confetti Particles */}
            {[...Array(50)].map((_, i) => (
                <motion.div
                    key={i}
                    initial={{
                        y: -20,
                        x: Math.random() * window.innerWidth,
                        rotate: 0,
                        scale: 0
                    }}
                    animate={{
                        y: window.innerHeight + 100,
                        rotate: Math.random() * 720 - 360,
                        scale: [0, 1, 1, 0.5]
                    }}
                    transition={{
                        duration: 3 + Math.random() * 2,
                        delay: Math.random() * 0.5,
                        ease: "easeOut"
                    }}
                    className="absolute w-3 h-3 rounded-sm"
                    style={{
                        backgroundColor: confettiColors[i % confettiColors.length],
                        left: `${Math.random() * 100}%`
                    }}
                />
            ))}

            {/* Stars burst */}
            {[...Array(12)].map((_, i) => (
                <motion.div
                    key={`star-${i}`}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{
                        scale: [0, 1.5, 0],
                        opacity: [0, 1, 0],
                        x: Math.cos((i * 30) * Math.PI / 180) * 150,
                        y: Math.sin((i * 30) * Math.PI / 180) * 150
                    }}
                    transition={{ duration: 1.5, delay: 0.5 }}
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                >
                    <Sparkles className="w-8 h-8 text-court-gold" />
                </motion.div>
            ))}

            <div className="relative z-10 text-center px-6 space-y-6">
                {/* Bouncing Cat */}
                <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", bounce: 0.5, delay: 0.3 }}
                    className="relative mx-auto"
                >
                    <motion.div
                        animate={{
                            y: [0, -20, 0],
                            rotate: [-5, 5, -5]
                        }}
                        transition={{ duration: 1, repeat: Infinity }}
                        className="w-32 h-32 rounded-full mx-auto overflow-hidden shadow-2xl border-4 border-court-gold bg-white"
                    >
                        <img
                            src="/assets/avatars/judge_whiskers.png"
                            alt="Judge Whiskers"
                            className="w-full h-full object-cover"
                        />
                    </motion.div>

                    {/* Crown */}
                    <motion.div
                        initial={{ y: -50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.8, type: "spring" }}
                        className="absolute -top-6 left-1/2 -translate-x-1/2 text-4xl"
                    >
                        👑
                    </motion.div>
                </motion.div>

                {/* Title */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                >
                    <motion.h1
                        className="text-3xl font-bold text-gradient mb-2"
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
                    >
                        Harmony Restored! 🎉
                    </motion.h1>
                    <p className="text-court-brownLight text-lg">
                        You've both accepted the verdict
                    </p>
                </motion.div>

                {/* Kibble Reward */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1 }}
                    className="glass-card p-6 mx-auto max-w-xs bg-gradient-to-br from-amber-50 to-white"
                >
                    <motion.div
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 0.5 }}
                        className="text-4xl mb-2"
                    >
                        🪙
                    </motion.div>
                    <p className="text-sm text-court-brownLight mb-1">You both earned</p>
                    <p className="text-3xl font-bold text-court-gold">
                        +{kibbleReward?.userA || 10} Kibble
                    </p>
                    <p className="text-xs text-court-brownLight mt-2">
                        For resolving your dispute peacefully
                    </p>
                </motion.div>

                {/* Hearts floating up */}
                {[...Array(6)].map((_, i) => (
                    <motion.div
                        key={`heart-${i}`}
                        initial={{ y: 100, opacity: 0, x: (i - 2.5) * 40 }}
                        animate={{ y: -200, opacity: [0, 1, 0] }}
                        transition={{ duration: 3, delay: 1.5 + i * 0.2, repeat: Infinity }}
                        className="absolute bottom-20 left-1/2"
                    >
                        <Heart className="w-6 h-6 text-pink-400 fill-pink-400" />
                    </motion.div>
                ))}

                {/* Message */}
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.5 }}
                    className="text-court-brownLight text-sm italic"
                >
                    "Love is not about winning, it's about choosing each other every day"
                    <br />
                    <span className="text-court-tan">— Judge Whiskers</span>
                </motion.p>

                {/* Auto-redirect notice */}
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2 }}
                    className="text-xs text-court-tan"
                >
                    Returning home in a moment...
                </motion.p>
            </div>
        </motion.div>
    );
};

export default CelebrationAnimation;
