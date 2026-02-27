import React from 'react';
import { motion } from 'framer-motion';
import { Cat, Clock, Heart, Moon, Search, Star } from 'lucide-react';
import clsx from 'clsx';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion';

/**
 * EmptyState - Cute empty state component with cat illustrations
 * @param {Object} props
 * @param {string} props.title - Main title
 * @param {string} props.description - Description text
 * @param {'sleeping'|'searching'|'waiting'|'happy'} props.variant - Cat mood variant
 * @param {React.ReactNode} props.action - Optional action button
 */
const EmptyState = ({
    title,
    description,
    variant = 'sleeping',
    action,
    className = '',
}) => {
    const prefersReducedMotion = usePrefersReducedMotion();
    const cats = {
        sleeping: { accent: Moon },
        searching: { accent: Search },
        waiting: { accent: Clock },
        happy: { accent: Star },
        love: { accent: Heart },
    };

    const cat = cats[variant] || cats.sleeping;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={clsx(
                'flex flex-col items-center justify-center py-12 px-6 text-center',
                className
            )}
        >
            <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="relative mb-6"
            >
                <div className="w-24 h-24 bg-gradient-to-br from-court-cream to-court-tan rounded-3xl flex items-center justify-center border-4 border-white shadow-soft-lg">
                    <Cat className="w-12 h-12 text-amber-700" />
                </div>
                
                <motion.div
                    animate={{ 
                        y: [0, -5, 0],
                        opacity: [0.5, 1, 0.5],
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute -top-2 -right-2 text-xl"
                >
                    {React.createElement(cat.accent, { className: 'w-5 h-5 text-amber-500' })}
                </motion.div>
            </motion.div>

            <h3 className="text-lg font-display font-bold text-court-brown mb-2">
                {title}
            </h3>
            
            <p className="text-sm text-court-brownLight max-w-xs mb-4">
                {description}
            </p>

            {action && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                >
                    {action}
                </motion.div>
            )}
        </motion.div>
    );
};

export default EmptyState;
