import React from 'react';
import { motion } from 'framer-motion';

/**
 * FloatingDecorations - Cute floating decorative elements
 * Add personality and warmth to any page
 */
const FloatingDecorations = ({ variant = 'default' }) => {
    const decorations = {
        default: ['✨', '💫', '⭐', '🌸'],
        love: ['💕', '💗', '💖', '✨'],
        celebration: ['🎉', '🎊', '✨', '⭐'],
        court: ['⚖️', '📜', '✨', '🐾'],
        coins: ['🪙', '✨', '💫', '⭐'],
    };

    const items = decorations[variant] || decorations.default;

    return (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
            {items.map((emoji, index) => (
                <motion.div
                    key={index}
                    initial={{ 
                        opacity: 0,
                        x: `${20 + (index * 20)}%`,
                        y: `${10 + (index * 25)}%`,
                    }}
                    animate={{ 
                        opacity: [0.2, 0.5, 0.2],
                        y: [`${10 + (index * 25)}%`, `${5 + (index * 25)}%`, `${10 + (index * 25)}%`],
                        rotate: [0, 10, -10, 0],
                    }}
                    transition={{
                        duration: 5 + index,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: index * 0.5,
                    }}
                    className="absolute text-2xl"
                    style={{
                        left: `${15 + (index * 22)}%`,
                    }}
                >
                    {emoji}
                </motion.div>
            ))}
        </div>
    );
};

/**
 * PawPrints - Cute paw print trail decoration
 */
export const PawPrints = ({ count = 5 }) => {
    return (
        <div className="fixed bottom-0 left-0 right-0 pointer-events-none overflow-hidden opacity-20">
            <div className="flex justify-around pb-24">
                {Array.from({ length: count }).map((_, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 0.3, scale: 1 }}
                        transition={{ delay: i * 0.2 }}
                        className="text-pink-300 text-xl"
                    >
                        🐾
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

/**
 * Sparkle - Single animated sparkle
 */
export const Sparkle = ({ delay = 0, size = 'md', className = '' }) => {
    const sizes = {
        sm: 'w-2 h-2',
        md: 'w-3 h-3',
        lg: 'w-4 h-4',
    };

    return (
        <motion.div
            animate={{
                scale: [1, 1.5, 1],
                opacity: [0.5, 1, 0.5],
                rotate: [0, 180, 360],
            }}
            transition={{
                duration: 2,
                repeat: Infinity,
                delay,
            }}
            className={`${sizes[size]} ${className}`}
        >
            ✨
        </motion.div>
    );
};

/**
 * HeartBubble - Floating heart bubble
 */
export const HeartBubble = ({ delay = 0 }) => {
    return (
        <motion.div
            initial={{ y: 0, opacity: 0 }}
            animate={{ 
                y: -100,
                opacity: [0, 1, 0],
            }}
            transition={{
                duration: 3,
                repeat: Infinity,
                delay,
            }}
            className="text-pink-400 text-lg"
        >
            💕
        </motion.div>
    );
};

export default FloatingDecorations;
