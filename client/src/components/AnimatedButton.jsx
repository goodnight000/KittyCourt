import React, { useState } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { Loader2 } from 'lucide-react';

/**
 * AnimatedButton - Premium cute button with ripple effect and animations
 * @param {Object} props
 * @param {React.ReactNode} props.children - Button content
 * @param {'primary'|'secondary'|'ghost'|'gold'|'soft'} props.variant - Button style
 * @param {'sm'|'md'|'lg'} props.size - Button size
 * @param {boolean} props.loading - Show loading state
 * @param {boolean} props.disabled - Disable button
 * @param {Function} props.onClick - Click handler
 */
const AnimatedButton = ({
    children,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    onClick,
    className = '',
    icon,
    ...rest
}) => {
    const [ripples, setRipples] = useState([]);

    const createRipple = (event) => {
        const button = event.currentTarget;
        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;

        const newRipple = {
            x,
            y,
            size,
            id: Date.now(),
        };

        setRipples(prev => [...prev, newRipple]);
        setTimeout(() => {
            setRipples(prev => prev.filter(r => r.id !== newRipple.id));
        }, 600);
    };

    const handleClick = (e) => {
        if (!disabled && !loading) {
            createRipple(e);
            onClick?.(e);
        }
    };

    const variants = {
        primary: 'bg-gradient-to-r from-pink-400 to-lavender-400 hover:from-pink-500 hover:to-lavender-500 text-white shadow-glow-pink hover:shadow-lg',
        secondary: 'bg-white/80 hover:bg-white/95 text-lavender-600 border-2 border-lavender-200 hover:border-lavender-300 shadow-soft',
        ghost: 'bg-transparent hover:bg-pink-50/50 text-pink-500 hover:text-pink-600',
        gold: 'bg-gradient-to-r from-cream-400 to-peach-400 hover:from-cream-500 hover:to-peach-500 text-white shadow-glow-cream hover:shadow-lg',
        soft: 'bg-white/70 hover:bg-white/90 text-lavender-600 border border-white/60 shadow-soft hover:shadow-soft-md',
    };

    const sizes = {
        sm: 'px-4 py-2 text-sm rounded-xl',
        md: 'px-6 py-3 text-base rounded-2xl',
        lg: 'px-8 py-4 text-lg rounded-2xl',
    };

    return (
        <motion.button
            whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
            whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
            onClick={handleClick}
            disabled={disabled || loading}
            className={clsx(
                'relative overflow-hidden font-bold transition-all duration-300',
                'flex items-center justify-center gap-2',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:saturate-50',
                variants[variant],
                sizes[size],
                className
            )}
            {...rest}
        >
            {/* Ripple Effect */}
            {ripples.map(ripple => (
                <span
                    key={ripple.id}
                    className="absolute bg-white/40 rounded-full animate-ping"
                    style={{
                        left: ripple.x,
                        top: ripple.y,
                        width: ripple.size,
                        height: ripple.size,
                    }}
                />
            ))}

            {/* Content */}
            <span className="relative flex items-center gap-2">
                {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                    <>
                        {icon && <span className="flex-shrink-0">{icon}</span>}
                        {children}
                    </>
                )}
            </span>
        </motion.button>
    );
};

export default AnimatedButton;
