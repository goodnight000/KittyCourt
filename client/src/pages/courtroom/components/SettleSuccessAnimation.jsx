import React from 'react';
import { motion } from 'framer-motion';
import { Heart, Handshake } from 'lucide-react';

/**
 * SettleSuccessAnimation - Shown after both partners agree to settle
 */
const SettleSuccessAnimation = ({ partnerName }) => {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-gradient-to-br from-pink-50 via-white to-rose-50 flex items-center justify-center overflow-hidden"
        >
            {/* Floating Hearts */}
            {[...Array(20)].map((_, i) => (
                <motion.div
                    key={i}
                    initial={{ y: window.innerHeight, x: Math.random() * window.innerWidth, opacity: 0 }}
                    animate={{
                        y: -100,
                        opacity: [0, 1, 1, 0],
                        rotate: Math.random() * 360
                    }}
                    transition={{
                        duration: 4 + Math.random() * 2,
                        delay: Math.random() * 2,
                        repeat: Infinity
                    }}
                    className="absolute text-2xl"
                >
                    {['💕', '💗', '💖', '✨', '🤍'][i % 5]}
                </motion.div>
            ))}

            <div className="text-center px-6 z-10">
                {/* Handshake Icon */}
                <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", bounce: 0.5, delay: 0.2 }}
                    className="w-32 h-32 mx-auto mb-6 bg-gradient-to-br from-pink-200 to-rose-200 rounded-full flex items-center justify-center shadow-2xl"
                >
                    <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                    >
                        <Handshake className="w-16 h-16 text-pink-600" />
                    </motion.div>
                </motion.div>

                {/* Title */}
                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="text-3xl font-bold text-pink-600 mb-3"
                >
                    Case Dismissed! 🕊️
                </motion.h1>

                {/* Subtitle */}
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                    className="text-neutral-600 text-lg mb-6"
                >
                    You both chose love over winning
                </motion.p>

                {/* Card */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.9 }}
                    className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-xl max-w-xs mx-auto"
                >
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center text-2xl">
                            🐱
                        </div>
                        <Heart className="w-6 h-6 text-pink-400 fill-pink-400" />
                        <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center text-2xl">
                            🐱
                        </div>
                    </div>
                    <p className="text-sm text-neutral-600 italic">
                        "The strongest couples know when to put down their swords
                        and pick up each other's hearts."
                    </p>
                    <p className="text-xs text-neutral-400 mt-2">— Judge Whiskers</p>
                </motion.div>

                {/* Redirect notice */}
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.5 }}
                    className="text-neutral-400 text-sm mt-6"
                >
                    Returning to home...
                </motion.p>
            </div>
        </motion.div>
    );
};

export default SettleSuccessAnimation;
