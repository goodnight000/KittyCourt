import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * LoadingScreen - Premium loading experience with cat paw prints walking animation
 * Fits the app's cute, premium, and luxurious theme
 */

const PAW_POSITIONS = [
    { x: 20, y: 35, rotate: -15, delay: 0 },
    { x: 35, y: 45, rotate: 25, delay: 0.3 },
    { x: 50, y: 38, rotate: -10, delay: 0.6 },
    { x: 65, y: 50, rotate: 20, delay: 0.9 },
    { x: 80, y: 42, rotate: -5, delay: 1.2 },
];

const MESSAGES = [
    { text: "Warming up the courtroom...", emoji: "🐾" },
    { text: "Stretching our whiskers...", emoji: "✨" },
    { text: "Almost ready...", emoji: "💫" },
    { text: "Loading Pause...", emoji: "⚖️" },
];

// Single paw print SVG component
const PawPrint = ({ className = "" }) => (
    <svg
        viewBox="0 0 100 100"
        className={className}
        fill="currentColor"
    >
        {/* Main pad */}
        <ellipse cx="50" cy="65" rx="22" ry="18" />
        {/* Toe pads */}
        <ellipse cx="30" cy="38" rx="10" ry="12" />
        <ellipse cx="50" cy="30" rx="10" ry="12" />
        <ellipse cx="70" cy="38" rx="10" ry="12" />
    </svg>
);

// Animated paw that appears and fades
const AnimatedPaw = ({ x, y, rotate, delay, isVisible }) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={isVisible ? {
            opacity: [0, 0.7, 0.7, 0],
            scale: [0.5, 1, 1, 0.8],
        } : { opacity: 0, scale: 0.5 }}
        transition={{
            duration: 2.5,
            delay,
            ease: "easeInOut",
            repeat: Infinity,
            repeatDelay: PAW_POSITIONS.length * 0.3,
        }}
        className="absolute"
        style={{
            left: `${x}%`,
            top: `${y}%`,
            transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
        }}
    >
        <PawPrint className="w-8 h-8 text-court-gold/60" />
    </motion.div>
);

const LoadingScreen = ({
    message = null,
    showResetButton = true,
    onReset = null,
}) => {
    const [showReset, setShowReset] = useState(false);
    const [messageIndex, setMessageIndex] = useState(0);

    // Show reset button after timeout
    useEffect(() => {
        if (!showResetButton) return;
        const timer = setTimeout(() => setShowReset(true), 5000);
        return () => clearTimeout(timer);
    }, [showResetButton]);

    // Cycle through messages
    useEffect(() => {
        if (message) return; // Don't cycle if custom message provided
        const timer = setInterval(() => {
            setMessageIndex((prev) => (prev + 1) % MESSAGES.length);
        }, 3000);
        return () => clearInterval(timer);
    }, [message]);

    const handleReset = () => {
        if (onReset) {
            onReset();
        } else {
            localStorage.clear();
            window.location.href = '/signin';
        }
    };

    const currentMessage = message ? { text: message, emoji: "🐾" } : MESSAGES[messageIndex];

    return (
        <div className="min-h-screen bg-gradient-to-br from-court-cream via-white to-court-tan/30 flex flex-col items-center justify-center relative overflow-hidden">
            {/* Ambient background glow */}
            <motion.div
                animate={{
                    opacity: [0.3, 0.5, 0.3],
                    scale: [1, 1.1, 1],
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-court-gold/10 blur-3xl"
            />
            <motion.div
                animate={{
                    opacity: [0.2, 0.4, 0.2],
                    y: [0, -20, 0],
                }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full bg-court-maroon/5 blur-3xl"
            />

            {/* Walking paw prints */}
            <div className="absolute inset-0 pointer-events-none">
                {PAW_POSITIONS.map((pos, index) => (
                    <AnimatedPaw
                        key={index}
                        {...pos}
                        isVisible={true}
                    />
                ))}
            </div>

            {/* Main content */}
            <div className="relative z-10 text-center px-6">
                {/* Animated paw icon */}
                <motion.div
                    animate={{
                        y: [0, -8, 0],
                        rotate: [0, 5, -5, 0],
                    }}
                    transition={{
                        duration: 2.5,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                    className="mb-6 inline-block"
                >
                    <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-court-gold to-court-goldDark flex items-center justify-center shadow-lg border border-court-goldLight/30">
                        <PawPrint className="w-10 h-10 text-white" />
                    </div>
                </motion.div>

                {/* Message with fade transition */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentMessage.text}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-2"
                    >
                        <h2 className="text-xl font-bold text-court-brown">
                            {currentMessage.text}
                        </h2>
                        <motion.p
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                            className="text-2xl"
                        >
                            {currentMessage.emoji}
                        </motion.p>
                    </motion.div>
                </AnimatePresence>

                {/* Subtle progress dots */}
                <div className="flex items-center justify-center gap-2 mt-6">
                    {[0, 1, 2, 3].map((i) => (
                        <motion.div
                            key={i}
                            animate={{
                                opacity: [0.3, 1, 0.3],
                                scale: [0.8, 1, 0.8],
                            }}
                            transition={{
                                duration: 1.2,
                                delay: i * 0.15,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                            className="w-2 h-2 rounded-full bg-court-gold/70"
                        />
                    ))}
                </div>

                {/* Reset button */}
                {showReset && showResetButton && (
                    <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        onClick={handleReset}
                        className="mt-8 px-6 py-2 bg-white border border-neutral-200 rounded-full text-sm text-neutral-500 hover:bg-neutral-50 hover:text-red-500 transition-colors shadow-sm"
                    >
                        Taking too long? Tap to Reset
                    </motion.button>
                )}
            </div>
        </div>
    );
};

export default LoadingScreen;
