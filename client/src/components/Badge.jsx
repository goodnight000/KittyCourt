import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

/**
 * Badge - Cute pill-shaped badge component
 * @param {Object} props
 * @param {React.ReactNode} props.children - Badge content
 * @param {'pink'|'lavender'|'cream'|'mint'|'peach'} props.color - Badge color
 * @param {'sm'|'md'|'lg'} props.size - Badge size
 * @param {boolean} props.pulse - Enable pulse animation
 * @param {React.ReactNode} props.icon - Optional icon
 */
const Badge = ({
    children,
    color = 'pink',
    size = 'md',
    pulse = false,
    icon,
    className = '',
}) => {
    const colors = {
        pink: 'bg-pink-100/80 text-pink-600 border-pink-200/60',
        lavender: 'bg-lavender-100/80 text-lavender-600 border-lavender-200/60',
        cream: 'bg-cream-100/80 text-cream-700 border-cream-200/60',
        mint: 'bg-mint-100/80 text-mint-700 border-mint-200/60',
        peach: 'bg-peach-100/80 text-peach-700 border-peach-200/60',
    };

    const sizes = {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-3 py-1 text-sm',
        lg: 'px-4 py-1.5 text-base',
    };

    return (
        <motion.span
            whileHover={{ scale: 1.05 }}
            className={clsx(
                'inline-flex items-center gap-1.5 rounded-full font-bold border backdrop-blur-sm',
                colors[color],
                sizes[size],
                className
            )}
        >
            {pulse && (
                <span className={clsx(
                    'w-1.5 h-1.5 rounded-full animate-pulse',
                    color === 'pink' && 'bg-pink-400',
                    color === 'lavender' && 'bg-lavender-400',
                    color === 'cream' && 'bg-cream-500',
                    color === 'mint' && 'bg-mint-500',
                    color === 'peach' && 'bg-peach-500',
                )} />
            )}
            {icon && <span className="flex-shrink-0">{icon}</span>}
            {children}
        </motion.span>
    );
};

export default Badge;
