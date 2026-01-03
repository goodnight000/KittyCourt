import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../i18n';

/**
 * LoadingScreen - Premium, cute, full, and immersive loading experience
 * Features: Floating decorations, animated cat, sparkles, warm atmosphere
 */

// Walking paw positions across the screen
const PAW_POSITIONS = [
    { x: 12, y: 30, rotate: -20, delay: 0 },
    { x: 28, y: 42, rotate: 15, delay: 0.25 },
    { x: 44, y: 32, rotate: -8, delay: 0.5 },
    { x: 60, y: 46, rotate: 22, delay: 0.75 },
    { x: 76, y: 36, rotate: -12, delay: 1.0 },
    { x: 88, y: 48, rotate: 18, delay: 1.25 },
];

// Floating decoration positions
const SPARKLE_POSITIONS = [
    { x: 15, y: 20, size: 'sm', delay: 0 },
    { x: 85, y: 15, size: 'md', delay: 0.5 },
    { x: 10, y: 70, size: 'sm', delay: 1 },
    { x: 90, y: 75, size: 'lg', delay: 0.3 },
    { x: 25, y: 85, size: 'md', delay: 0.8 },
    { x: 75, y: 25, size: 'sm', delay: 1.2 },
    { x: 50, y: 12, size: 'md', delay: 0.6 },
    { x: 95, y: 50, size: 'sm', delay: 0.2 },
];

const HEART_POSITIONS = [
    { x: 20, y: 25, delay: 0.2 },
    { x: 80, y: 30, delay: 0.8 },
    { x: 35, y: 80, delay: 1.2 },
    { x: 65, y: 75, delay: 0.5 },
];

const FALLBACK_MESSAGES = [
    { text: 'Warming up the courtroom...', emoji: '🐾' },
    { text: 'Stretching our whiskers...', emoji: '✨' },
    { text: 'Preparing pawsitive vibes...', emoji: '💖' },
    { text: 'Almost ready, meow!', emoji: '🐱' },
];

// Single paw print SVG
const PawPrint = ({ className = "" }) => (
    <svg viewBox="0 0 100 100" className={className} fill="currentColor">
        <ellipse cx="50" cy="65" rx="22" ry="18" />
        <ellipse cx="30" cy="38" rx="10" ry="12" />
        <ellipse cx="50" cy="30" rx="10" ry="12" />
        <ellipse cx="70" cy="38" rx="10" ry="12" />
    </svg>
);

// Sparkle decoration
const Sparkle = ({ size = 'md', className = "" }) => {
    const sizeClasses = {
        sm: 'w-3 h-3',
        md: 'w-4 h-4',
        lg: 'w-5 h-5'
    };
    return (
        <svg viewBox="0 0 24 24" className={`${sizeClasses[size]} ${className}`} fill="currentColor">
            <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
        </svg>
    );
};

// Heart decoration
const Heart = ({ className = "" }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
);

// Cute cat face SVG
const CatFace = ({ className = "" }) => (
    <svg viewBox="0 0 120 100" className={className} fill="currentColor">
        {/* Ears */}
        <path d="M15 45 L25 5 L45 35 Z" />
        <path d="M105 45 L95 5 L75 35 Z" />
        {/* Inner ears */}
        <path d="M22 38 L28 12 L40 32 Z" fill="currentColor" opacity="0.4" />
        <path d="M98 38 L92 12 L80 32 Z" fill="currentColor" opacity="0.4" />
        {/* Head */}
        <ellipse cx="60" cy="60" rx="45" ry="38" />
        {/* Eyes */}
        <ellipse cx="42" cy="52" rx="8" ry="10" fill="white" />
        <ellipse cx="78" cy="52" rx="8" ry="10" fill="white" />
        <ellipse cx="43" cy="54" rx="4" ry="5" fill="#2d2d2d" />
        <ellipse cx="79" cy="54" rx="4" ry="5" fill="#2d2d2d" />
        <ellipse cx="44" cy="52" rx="1.5" ry="2" fill="white" />
        <ellipse cx="80" cy="52" rx="1.5" ry="2" fill="white" />
        {/* Nose */}
        <ellipse cx="60" cy="68" rx="5" ry="4" fill="#f8a5b6" />
        {/* Mouth */}
        <path d="M60 72 Q55 78 48 75" fill="none" stroke="#2d2d2d" strokeWidth="2" strokeLinecap="round" />
        <path d="M60 72 Q65 78 72 75" fill="none" stroke="#2d2d2d" strokeWidth="2" strokeLinecap="round" />
        {/* Whiskers */}
        <line x1="20" y1="60" x2="38" y2="62" stroke="#2d2d2d" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="18" y1="68" x2="37" y2="68" stroke="#2d2d2d" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="82" y1="62" x2="100" y2="60" stroke="#2d2d2d" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="83" y1="68" x2="102" y2="68" stroke="#2d2d2d" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

// Animated paw that walks
const AnimatedPaw = ({ x, y, rotate, delay }) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.3 }}
        animate={{
            opacity: [0, 0.6, 0.6, 0],
            scale: [0.3, 1, 1, 0.6],
        }}
        transition={{
            duration: 2.8,
            delay,
            ease: "easeInOut",
            repeat: Infinity,
            repeatDelay: PAW_POSITIONS.length * 0.2,
        }}
        className="absolute"
        style={{
            left: `${x}%`,
            top: `${y}%`,
            transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
        }}
    >
        <PawPrint className="w-10 h-10 text-amber-600/50" />
    </motion.div>
);

// Floating sparkle decoration
const FloatingSparkle = ({ x, y, size, delay }) => (
    <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{
            opacity: [0, 1, 1, 0],
            scale: [0.5, 1, 1, 0.5],
            rotate: [0, 180, 360],
        }}
        transition={{
            duration: 3,
            delay,
            ease: "easeInOut",
            repeat: Infinity,
            repeatDelay: 1,
        }}
        className="absolute"
        style={{ left: `${x}%`, top: `${y}%` }}
    >
        <Sparkle size={size} className="text-amber-400/60" />
    </motion.div>
);

// Floating heart decoration
const FloatingHeart = ({ x, y, delay }) => (
    <motion.div
        initial={{ opacity: 0, y: 0 }}
        animate={{
            opacity: [0, 0.7, 0.7, 0],
            y: [-10, -30, -50, -70],
            scale: [0.5, 1, 0.9, 0.4],
        }}
        transition={{
            duration: 4,
            delay,
            ease: "easeOut",
            repeat: Infinity,
            repeatDelay: 2,
        }}
        className="absolute"
        style={{ left: `${x}%`, top: `${y}%` }}
    >
        <Heart className="w-5 h-5 text-rose-400/60" />
    </motion.div>
);

const LoadingScreen = ({
    message = null,
    showResetButton = true,
    onReset = null,
}) => {
    const { t } = useI18n();
    const [showReset, setShowReset] = useState(false);
    const [messageIndex, setMessageIndex] = useState(0);
    const localizedMessages = t('loadingScreen.messages');
    const messagePool = Array.isArray(localizedMessages) && localizedMessages.length
        ? localizedMessages
        : FALLBACK_MESSAGES;

    useEffect(() => {
        if (!showResetButton) return;
        const timer = setTimeout(() => setShowReset(true), 5000);
        return () => clearTimeout(timer);
    }, [showResetButton]);

    useEffect(() => {
        if (message) return;
        const timer = setInterval(() => {
            setMessageIndex((prev) => (prev + 1) % messagePool.length);
        }, 3000);
        return () => clearInterval(timer);
    }, [message, messagePool.length]);

    const handleReset = () => {
        if (onReset) {
            onReset();
        } else {
            localStorage.clear();
            window.location.href = '/signin';
        }
    };

    const currentMessage = message
        ? { text: message, emoji: '🐾' }
        : messagePool[messageIndex % messagePool.length];

    return (
        <div className="min-h-screen bg-gradient-to-br from-amber-50 via-rose-50/50 to-orange-50 flex flex-col items-center justify-center relative overflow-hidden">
            {/* Warm atmospheric layers */}
            <div className="absolute inset-0 pointer-events-none">
                <motion.div
                    animate={{
                        opacity: [0.4, 0.6, 0.4],
                        scale: [1, 1.2, 1],
                    }}
                    transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-0 left-0 w-[60%] h-[50%] rounded-full bg-gradient-to-br from-amber-200/40 to-transparent blur-[80px]"
                />
                <motion.div
                    animate={{
                        opacity: [0.3, 0.5, 0.3],
                        scale: [1, 1.15, 1],
                    }}
                    transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                    className="absolute bottom-0 right-0 w-[50%] h-[60%] rounded-full bg-gradient-to-tl from-rose-200/40 to-transparent blur-[80px]"
                />
                <motion.div
                    animate={{
                        opacity: [0.2, 0.4, 0.2],
                        y: [0, -30, 0],
                    }}
                    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[40%] rounded-full bg-gradient-to-r from-orange-100/30 via-rose-100/40 to-amber-100/30 blur-[60px]"
                />
            </div>

            {/* Walking paw prints */}
            <div className="absolute inset-0 pointer-events-none">
                {PAW_POSITIONS.map((pos, index) => (
                    <AnimatedPaw key={index} {...pos} />
                ))}
            </div>

            {/* Floating sparkles */}
            <div className="absolute inset-0 pointer-events-none">
                {SPARKLE_POSITIONS.map((pos, index) => (
                    <FloatingSparkle key={index} {...pos} />
                ))}
            </div>

            {/* Floating hearts */}
            <div className="absolute inset-0 pointer-events-none">
                {HEART_POSITIONS.map((pos, index) => (
                    <FloatingHeart key={index} {...pos} />
                ))}
            </div>

            {/* Main content */}
            <div className="relative z-10 text-center px-8 flex flex-col items-center">
                {/* Animated cat face - no box, just the cute face */}
                <motion.div
                    animate={{
                        y: [0, -12, 0],
                        rotate: [0, -3, 3, 0],
                    }}
                    transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                    className="mb-8"
                >
                    <motion.div
                        animate={{
                            scale: [1, 1.05, 1],
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                    >
                        <CatFace className="w-32 h-32 text-amber-700 drop-shadow-lg" />
                    </motion.div>
                </motion.div>

                {/* Animated paw prints below cat */}
                <div className="flex items-center gap-3 mb-8">
                    {[0, 1, 2].map((i) => (
                        <motion.div
                            key={i}
                            animate={{
                                opacity: [0.3, 1, 0.3],
                                scale: [0.8, 1.1, 0.8],
                                y: [0, -4, 0],
                            }}
                            transition={{
                                duration: 1.5,
                                delay: i * 0.2,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                        >
                            <PawPrint className="w-6 h-6 text-amber-500/70" />
                        </motion.div>
                    ))}
                </div>

                {/* Message with fade transition */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentMessage.text}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        transition={{ duration: 0.4 }}
                        className="space-y-3"
                    >
                        <h2 className="text-xl font-bold text-amber-900 tracking-wide">
                            {currentMessage.text}
                        </h2>
                        <motion.p
                            animate={{
                                scale: [1, 1.3, 1],
                                rotate: [0, 10, -10, 0]
                            }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="text-3xl"
                        >
                            {currentMessage.emoji}
                        </motion.p>
                    </motion.div>
                </AnimatePresence>

                {/* Premium progress indicator */}
                <div className="flex items-center justify-center gap-2 mt-8">
                    {[0, 1, 2, 3, 4].map((i) => (
                        <motion.div
                            key={i}
                            animate={{
                                opacity: [0.2, 1, 0.2],
                                scale: [0.6, 1.2, 0.6],
                            }}
                            transition={{
                                duration: 1.4,
                                delay: i * 0.12,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                            className="w-2 h-2 rounded-full bg-gradient-to-br from-amber-400 to-amber-600"
                        />
                    ))}
                </div>

                {/* Reset button */}
                {showReset && showResetButton && (
                    <motion.button
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={handleReset}
                        className="mt-10 px-6 py-2.5 bg-white/80 backdrop-blur-sm border border-amber-200/60 rounded-full text-sm text-amber-700 hover:bg-amber-50 hover:text-red-500 hover:border-red-200 transition-all shadow-sm"
                    >
                        {t('loadingScreen.reset')}
                    </motion.button>
                )}
            </div>

            {/* Bottom decorative wave */}
            <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none overflow-hidden">
                <motion.div
                    animate={{ x: [0, -50, 0] }}
                    transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute bottom-0 left-0 right-0 h-full"
                    style={{
                        background: 'linear-gradient(to top, rgba(251, 191, 36, 0.1) 0%, transparent 100%)',
                    }}
                />
            </div>
        </div>
    );
};

export default LoadingScreen;

