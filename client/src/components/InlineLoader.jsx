import React from 'react';
import { motion } from 'framer-motion';

/**
 * InlineLoader - Cat-themed inline loading indicator
 * Uses sequential paw prints instead of spinning (fits cute + premium theme)
 * 
 * @param {string} size - 'sm' | 'md' | 'lg'
 * @param {string} className - Additional styling
 */

// Mini paw print for inline use
const MiniPaw = ({ className = "" }) => (
    <svg
        viewBox="0 0 100 100"
        className={className}
        fill="currentColor"
    >
        <ellipse cx="50" cy="65" rx="22" ry="18" />
        <ellipse cx="30" cy="38" rx="10" ry="12" />
        <ellipse cx="50" cy="30" rx="10" ry="12" />
        <ellipse cx="70" cy="38" rx="10" ry="12" />
    </svg>
);

const sizeClasses = {
    sm: 'gap-1',
    md: 'gap-1.5',
    lg: 'gap-2',
};

const pawSizes = {
    sm: 'w-2.5 h-2.5',
    md: 'w-3.5 h-3.5',
    lg: 'w-5 h-5',
};

const InlineLoader = ({ size = 'md', className = '' }) => {
    return (
        <div className={`flex items-center ${sizeClasses[size]} ${className}`}>
            {[0, 1, 2].map((i) => (
                <motion.div
                    key={i}
                    animate={{
                        opacity: [0.2, 1, 0.2],
                        scale: [0.7, 1, 0.7],
                        y: [2, -2, 2],
                    }}
                    transition={{
                        duration: 1.2,
                        delay: i * 0.2,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                >
                    <MiniPaw className={`${pawSizes[size]} text-current`} />
                </motion.div>
            ))}
        </div>
    );
};

/**
 * BreathingDots - Alternative loader with gentle breathing animation
 * Like a sleeping cat's gentle breathing
 */
export const BreathingDots = ({ size = 'md', className = '' }) => {
    const dotSizes = {
        sm: 'w-1.5 h-1.5',
        md: 'w-2 h-2',
        lg: 'w-3 h-3',
    };

    return (
        <div className={`flex items-center ${sizeClasses[size]} ${className}`}>
            {[0, 1, 2].map((i) => (
                <motion.div
                    key={i}
                    animate={{
                        scale: [1, 1.4, 1],
                        opacity: [0.4, 1, 0.4],
                    }}
                    transition={{
                        duration: 1.8,
                        delay: i * 0.25,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                    className={`${dotSizes[size]} rounded-full bg-current`}
                />
            ))}
        </div>
    );
};

export default InlineLoader;
