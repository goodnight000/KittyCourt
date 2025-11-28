import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

/**
 * GlassCard - Premium soft glassmorphic card component
 * @param {Object} props
 * @param {React.ReactNode} props.children - Card content
 * @param {'default'|'gradient'|'elevated'|'glow'|'pastel'} props.variant - Card style variant
 * @param {'pink'|'lavender'|'cream'|'mint'|'peach'} props.accent - Accent color
 * @param {string} props.className - Additional Tailwind classes
 * @param {boolean} props.hover - Enable hover effect
 * @param {boolean} props.animate - Enable entry animation
 */
const GlassCard = ({
    children,
    variant = 'default',
    accent,
    className = '',
    hover = false,
    animate = false,
    ...rest
}) => {
    const variants = {
        default: 'bg-white/70 backdrop-blur-xl border border-white/60 shadow-soft',
        gradient: 'bg-gradient-to-br from-white/80 via-pink-50/50 to-lavender-50/50 backdrop-blur-xl border border-white/60 shadow-soft-md',
        elevated: 'bg-white/85 backdrop-blur-xl border border-white/70 shadow-soft-lg',
        glow: 'bg-white/75 backdrop-blur-xl border border-pink-200/40 shadow-glow-pink',
        pastel: 'bg-gradient-to-br from-pink-50/80 via-white/70 to-lavender-50/80 backdrop-blur-xl border border-white/60 shadow-soft',
    };

    const accents = {
        pink: 'border-l-4 border-l-pink-300',
        lavender: 'border-l-4 border-l-lavender-300',
        cream: 'border-l-4 border-l-cream-300',
        mint: 'border-l-4 border-l-mint-300',
        peach: 'border-l-4 border-l-peach-300',
    };

    const Component = animate ? motion.div : 'div';
    const animationProps = animate ? {
        initial: { opacity: 0, y: 20, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1 },
        transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] }
    } : {};

    return (
        <Component
            className={clsx(
                variants[variant],
                accent && accents[accent],
                hover && 'hover:bg-white/90 hover:shadow-soft-lg hover:-translate-y-1 cursor-pointer transition-all duration-300',
                'rounded-3xl p-6',
                className
            )}
            {...animationProps}
            {...rest}
        >
            {children}
        </Component>
    );
};

export default GlassCard;
