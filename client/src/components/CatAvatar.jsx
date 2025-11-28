import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

/**
 * CatAvatar - Cute animated cat avatar with various moods
 * @param {Object} props
 * @param {'happy'|'judging'|'sleeping'|'excited'|'thinking'} props.mood - Cat's current mood
 * @param {'sm'|'md'|'lg'|'xl'} props.size - Avatar size
 * @param {boolean} props.crown - Show crown accessory
 * @param {boolean} props.animate - Enable floating animation
 */
const CatAvatar = ({
    mood = 'happy',
    size = 'md',
    crown = false,
    animate = true,
    className = '',
}) => {
    const moods = {
        happy: '😺',
        judging: '🐱',
        sleeping: '😿',
        excited: '😻',
        thinking: '🙀',
        love: '😽',
    };

    const sizes = {
        sm: 'w-12 h-12 text-2xl',
        md: 'w-20 h-20 text-4xl',
        lg: 'w-28 h-28 text-5xl',
        xl: 'w-36 h-36 text-6xl',
    };

    const crownSizes = {
        sm: 'text-sm -top-2',
        md: 'text-lg -top-3',
        lg: 'text-2xl -top-4',
        xl: 'text-3xl -top-5',
    };

    const Wrapper = animate ? motion.div : 'div';
    const animationProps = animate ? {
        animate: { y: [0, -8, 0] },
        transition: { duration: 3, repeat: Infinity, ease: "easeInOut" }
    } : {};

    return (
        <Wrapper
            className={clsx('relative inline-block', className)}
            {...animationProps}
        >
            <div className={clsx(
                sizes[size],
                'bg-gradient-to-br from-pink-100 to-lavender-100',
                'rounded-[2rem] flex items-center justify-center',
                'border-4 border-white shadow-soft-lg',
                'relative'
            )}>
                <span>{moods[mood]}</span>
                
                {/* Blush marks */}
                <div className="absolute left-1 top-1/2 w-2 h-1 bg-pink-200 rounded-full opacity-60" />
                <div className="absolute right-1 top-1/2 w-2 h-1 bg-pink-200 rounded-full opacity-60" />
            </div>
            
            {crown && (
                <motion.div
                    animate={{ rotate: [-5, 5, -5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className={clsx(
                        'absolute left-1/2 -translate-x-1/2',
                        crownSizes[size]
                    )}
                >
                    👑
                </motion.div>
            )}
            
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-pink-300/20 to-lavender-300/20 rounded-[2rem] blur-xl -z-10" />
        </Wrapper>
    );
};

export default CatAvatar;
