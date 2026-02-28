import React from 'react';
import { motion } from 'framer-motion';
import { Cat, Eye, Moon, Zap, HelpCircle, Heart, Crown } from 'lucide-react';
import clsx from 'clsx';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion';

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
    const prefersReducedMotion = usePrefersReducedMotion();
    const moods = {
        happy: Cat,
        judging: Eye,
        sleeping: Moon,
        excited: Zap,
        thinking: HelpCircle,
        love: Heart,
    };

    const sizes = {
        sm: 'w-12 h-12',
        md: 'w-20 h-20',
        lg: 'w-28 h-28',
        xl: 'w-36 h-36',
    };

    const iconSizes = {
        sm: 'w-6 h-6',
        md: 'w-10 h-10',
        lg: 'w-12 h-12',
        xl: 'w-16 h-16',
    };

    const crownSizes = {
        sm: 'text-sm -top-2',
        md: 'text-lg -top-3',
        lg: 'text-2xl -top-4',
        xl: 'text-3xl -top-5',
    };

    const Wrapper = animate && !prefersReducedMotion ? motion.div : 'div';
    const animationProps = animate && !prefersReducedMotion ? {
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
                {React.createElement(moods[mood] || Cat, {
                    className: clsx(iconSizes[size], 'text-amber-700')
                })}
                
                {/* Blush marks */}
                <div className="absolute left-1 top-1/2 w-2 h-1 bg-pink-200 rounded-full opacity-60" />
                <div className="absolute right-1 top-1/2 w-2 h-1 bg-pink-200 rounded-full opacity-60" />
            </div>
            
            {crown && (
                <motion.div
                    animate={prefersReducedMotion ? undefined : { rotate: [-5, 5, -5] }}
                    transition={prefersReducedMotion ? undefined : { duration: 2, repeat: Infinity }}
                    className={clsx(
                        'absolute left-1/2 -translate-x-1/2',
                        crownSizes[size]
                    )}
                >
                    <Crown className={clsx('text-amber-500', iconSizes[size])} />
                </motion.div>
            )}
            
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-pink-300/20 to-lavender-300/20 rounded-[2rem] blur-xl -z-10" />
        </Wrapper>
    );
};

export default CatAvatar;
