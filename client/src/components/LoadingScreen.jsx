import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../i18n';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion';

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

// Judge Whiskers — orange cat with wig, robe, and gavel
const JudgeWhiskers = ({ className = "" }) => (
    <svg viewBox="0 0 140 160" className={className} data-testid="judge-whiskers-svg">
        {/* Judge's robe (black) */}
        <path d="M30 105 Q30 95 45 90 L70 88 L95 90 Q110 95 110 105 L115 155 Q115 160 110 160 L30 160 Q25 160 25 155 Z" fill="#1a1a1a" />
        {/* White V-collar */}
        <path d="M55 90 L70 115 L85 90" fill="none" stroke="white" strokeWidth="4" strokeLinejoin="round" />
        {/* White shirt visible in V */}
        <path d="M57 92 L70 112 L83 92 Z" fill="white" opacity="0.9" />

        {/* Judge's wig (white/grey curls) */}
        <ellipse cx="70" cy="30" rx="40" ry="22" fill="#e8e0d0" />
        {/* Wig curls - top */}
        <circle cx="42" cy="22" r="10" fill="#f0ebe0" />
        <circle cx="58" cy="16" r="9" fill="#ece7db" />
        <circle cx="75" cy="14" r="10" fill="#f0ebe0" />
        <circle cx="92" cy="18" r="9" fill="#ece7db" />
        <circle cx="100" cy="28" r="8" fill="#f0ebe0" />
        <circle cx="38" cy="32" r="8" fill="#ece7db" />
        {/* Wig side curls */}
        <ellipse cx="32" cy="48" rx="8" ry="12" fill="#e8e0d0" />
        <ellipse cx="108" cy="48" rx="8" ry="12" fill="#e8e0d0" />
        <circle cx="30" cy="58" r="7" fill="#f0ebe0" />
        <circle cx="110" cy="58" r="7" fill="#f0ebe0" />

        {/* Cat head (orange/tan) */}
        <ellipse cx="70" cy="55" rx="35" ry="30" fill="#e8975d" />
        {/* Ears */}
        <path d="M38 35 L42 12 L55 30 Z" fill="#e8975d" />
        <path d="M102 35 L98 12 L85 30 Z" fill="#e8975d" />
        {/* Inner ears */}
        <path d="M42 32 L44 18 L52 30 Z" fill="#f0b088" />
        <path d="M98 32 L96 18 L88 30 Z" fill="#f0b088" />
        {/* Lighter face patch */}
        <ellipse cx="70" cy="62" rx="22" ry="18" fill="#f0b088" />

        {/* Eyes — serious expression */}
        <ellipse cx="56" cy="50" rx="6" ry="7" fill="white" />
        <ellipse cx="84" cy="50" rx="6" ry="7" fill="white" />
        <ellipse cx="57" cy="51" rx="3.5" ry="4.5" fill="#3a2a1a" />
        <ellipse cx="85" cy="51" rx="3.5" ry="4.5" fill="#3a2a1a" />
        <ellipse cx="58" cy="49" rx="1.5" ry="2" fill="white" />
        <ellipse cx="86" cy="49" rx="1.5" ry="2" fill="white" />
        {/* Slight frown / serious brow lines */}
        <line x1="49" y1="42" x2="58" y2="43" stroke="#8b5e3c" strokeWidth="2" strokeLinecap="round" />
        <line x1="91" y1="42" x2="82" y2="43" stroke="#8b5e3c" strokeWidth="2" strokeLinecap="round" />

        {/* Nose */}
        <ellipse cx="70" cy="60" rx="4" ry="3" fill="#f8a5b6" />
        {/* Mouth */}
        <path d="M70 63 Q66 68 60 66" fill="none" stroke="#5a3825" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M70 63 Q74 68 80 66" fill="none" stroke="#5a3825" strokeWidth="1.5" strokeLinecap="round" />

        {/* Whiskers */}
        <line x1="30" y1="55" x2="48" y2="57" stroke="#5a3825" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="28" y1="62" x2="47" y2="62" stroke="#5a3825" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="92" y1="57" x2="110" y2="55" stroke="#5a3825" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="93" y1="62" x2="112" y2="62" stroke="#5a3825" strokeWidth="1.2" strokeLinecap="round" />

        {/* Gavel in right hand */}
        <g className="judge-gavel">
            {/* Handle */}
            <rect x="108" y="120" width="4" height="28" rx="2" fill="#8b6914" transform="rotate(-25 110 134)" />
            {/* Head */}
            <rect x="98" y="112" width="20" height="10" rx="3" fill="#6b4f10" transform="rotate(-25 108 117)" />
        </g>
    </svg>
);

const FALLBACK_MESSAGES = [
    { text: 'Warming up the courtroom...' },
    { text: 'Stretching our whiskers...' },
    { text: 'Preparing pawsitive vibes...' },
    { text: 'Almost ready, meow!' },
];

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
    const prefersReducedMotion = usePrefersReducedMotion();
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
        ? { text: message }
        : messagePool[messageIndex % messagePool.length];

    return (
        <div className="min-h-screen bg-gradient-to-br from-amber-50 via-rose-50/50 to-orange-50 flex flex-col items-center justify-center relative overflow-hidden">
            {/* Warm atmospheric layers */}
            <div className="absolute inset-0 pointer-events-none">
                <motion.div
                    animate={prefersReducedMotion ? undefined : {
                        opacity: [0.4, 0.6, 0.4],
                        scale: [1, 1.2, 1],
                    }}
                    transition={prefersReducedMotion ? undefined : { duration: 6, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-0 left-0 w-[60%] h-[50%] rounded-full bg-gradient-to-br from-amber-200/40 to-transparent blur-[56px]"
                />
                <motion.div
                    animate={prefersReducedMotion ? undefined : {
                        opacity: [0.3, 0.5, 0.3],
                        scale: [1, 1.15, 1],
                    }}
                    transition={prefersReducedMotion ? undefined : { duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                    className="absolute bottom-0 right-0 w-[50%] h-[60%] rounded-full bg-gradient-to-tl from-rose-200/40 to-transparent blur-[56px]"
                />
                <motion.div
                    animate={prefersReducedMotion ? undefined : {
                        opacity: [0.2, 0.4, 0.2],
                        y: [0, -30, 0],
                    }}
                    transition={prefersReducedMotion ? undefined : { duration: 8, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[40%] rounded-full bg-gradient-to-r from-orange-100/30 via-rose-100/40 to-amber-100/30 blur-[48px]"
                />
            </div>

            {/* Walking paw prints */}
            {!prefersReducedMotion && (
                <div className="absolute inset-0 pointer-events-none">
                    {PAW_POSITIONS.map((pos, index) => (
                        <AnimatedPaw key={index} {...pos} />
                    ))}
                </div>
            )}

            {/* Floating sparkles */}
            {!prefersReducedMotion && (
                <div className="absolute inset-0 pointer-events-none">
                    {SPARKLE_POSITIONS.map((pos, index) => (
                        <FloatingSparkle key={index} {...pos} />
                    ))}
                </div>
            )}

            {/* Floating hearts */}
            {!prefersReducedMotion && (
                <div className="absolute inset-0 pointer-events-none">
                    {HEART_POSITIONS.map((pos, index) => (
                        <FloatingHeart key={index} {...pos} />
                    ))}
                </div>
            )}

            {/* Main content */}
            <div className="relative z-10 text-center px-8 flex flex-col items-center">
                {/* Animated Judge Whiskers */}
                <motion.div
                    animate={prefersReducedMotion ? undefined : {
                        y: [0, -12, 0],
                        rotate: [0, -3, 3, 0],
                    }}
                    transition={prefersReducedMotion ? undefined : {
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                    className="mb-8"
                >
                    <motion.div
                        animate={prefersReducedMotion ? undefined : {
                            scale: [1, 1.03, 1],
                            rotate: [0, 4, -2, 4, 0],
                        }}
                        transition={prefersReducedMotion ? undefined : {
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                    >
                        <JudgeWhiskers className="w-36 h-40 drop-shadow-lg" />
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
                                repeat: prefersReducedMotion ? 0 : Infinity,
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
                                repeat: prefersReducedMotion ? 0 : Infinity,
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
                        aria-label="Reset loading state"
                        className="mt-10 px-6 py-2.5 bg-white/80 backdrop-blur-sm border border-amber-200/60 rounded-full text-sm text-amber-700 hover:bg-amber-50 hover:text-red-500 hover:border-red-200 transition-colors shadow-sm"
                    >
                        {t('loadingScreen.reset')}
                    </motion.button>
                )}
            </div>

            {/* Bottom decorative wave */}
            <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none overflow-hidden">
                <motion.div
                    animate={prefersReducedMotion ? undefined : { x: [0, -50, 0] }}
                    transition={prefersReducedMotion ? undefined : { duration: 10, repeat: Infinity, ease: "easeInOut" }}
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
