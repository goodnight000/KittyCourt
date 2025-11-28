import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

/**
 * StatCard - Cute animated stat display card
 * @param {Object} props
 * @param {string|number} props.value - Stat value
 * @param {string} props.label - Stat label
 * @param {React.ReactNode} props.icon - Icon component
 * @param {string} props.trend - Trend indicator ('+5%', etc.)
 * @param {string} props.color - Color theme ('lavender'|'cream'|'pink'|'mint'|'peach')
 */
const StatCard = ({
    value,
    label,
    icon,
    trend,
    color = 'lavender',
    className = '',
}) => {
    const colors = {
        lavender: {
            bg: 'from-lavender-100/80 via-white/70 to-lavender-50/60',
            icon: 'text-lavender-500 bg-lavender-100/80',
            iconBorder: 'border-lavender-200/50',
            text: 'text-lavender-600',
            trend: 'bg-lavender-100 text-lavender-600',
        },
        cream: {
            bg: 'from-cream-100/80 via-white/70 to-cream-50/60',
            icon: 'text-cream-600 bg-cream-100/80',
            iconBorder: 'border-cream-200/50',
            text: 'text-cream-700',
            trend: 'bg-cream-100 text-cream-700',
        },
        pink: {
            bg: 'from-pink-100/80 via-white/70 to-pink-50/60',
            icon: 'text-pink-500 bg-pink-100/80',
            iconBorder: 'border-pink-200/50',
            text: 'text-pink-600',
            trend: 'bg-pink-100 text-pink-600',
        },
        mint: {
            bg: 'from-mint-100/80 via-white/70 to-mint-50/60',
            icon: 'text-mint-600 bg-mint-100/80',
            iconBorder: 'border-mint-200/50',
            text: 'text-mint-700',
            trend: 'bg-mint-100 text-mint-700',
        },
        peach: {
            bg: 'from-peach-100/80 via-white/70 to-peach-50/60',
            icon: 'text-peach-600 bg-peach-100/80',
            iconBorder: 'border-peach-200/50',
            text: 'text-peach-700',
            trend: 'bg-peach-100 text-peach-700',
        },
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            whileHover={{ y: -4, scale: 1.02 }}
            transition={{ duration: 0.3 }}
            className={clsx(
                'relative overflow-hidden p-6 rounded-3xl backdrop-blur-xl',
                'bg-gradient-to-br border border-white/60',
                colors[color].bg,
                'shadow-soft hover:shadow-soft-md transition-all duration-300',
                className
            )}
        >
            {/* Decorative blob */}
            <div className={clsx(
                'absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-30 blur-2xl',
                color === 'lavender' && 'bg-lavender-300',
                color === 'cream' && 'bg-cream-300',
                color === 'pink' && 'bg-pink-300',
                color === 'mint' && 'bg-mint-300',
                color === 'peach' && 'bg-peach-300',
            )} />

            <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                    <motion.div 
                        whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
                        transition={{ duration: 0.5 }}
                        className={clsx(
                            'p-3 rounded-2xl border',
                            colors[color].icon,
                            colors[color].iconBorder
                        )}
                    >
                        {icon}
                    </motion.div>
                    {trend && (
                        <motion.span 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className={clsx(
                                'text-xs font-bold px-3 py-1.5 rounded-full',
                                colors[color].trend
                            )}
                        >
                            {trend}
                        </motion.span>
                    )}
                </div>
                <div>
                    <motion.h3
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-3xl font-display font-bold text-neutral-800 mb-1"
                    >
                        {value}
                    </motion.h3>
                    <p className={clsx('text-sm font-medium', colors[color].text)}>{label}</p>
                </div>
            </div>
        </motion.div>
    );
};

export default StatCard;
