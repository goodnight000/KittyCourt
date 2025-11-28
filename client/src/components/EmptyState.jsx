import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

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
    const cats = {
        sleeping: { emoji: '😴', accessory: '💤' },
        searching: { emoji: '🔍', accessory: '🐾' },
        waiting: { emoji: '🐱', accessory: '⏳' },
        happy: { emoji: '😺', accessory: '✨' },
        love: { emoji: '😻', accessory: '💕' },
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
                <div className="w-24 h-24 bg-gradient-to-br from-lavender-100 to-pink-100 rounded-3xl flex items-center justify-center border-4 border-white shadow-soft-lg">
                    <span className="text-5xl">{cat.emoji}</span>
                </div>
                
                <motion.div
                    animate={{ 
                        y: [0, -5, 0],
                        opacity: [0.5, 1, 0.5],
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute -top-2 -right-2 text-xl"
                >
                    {cat.accessory}
                </motion.div>
            </motion.div>

            <h3 className="text-lg font-display font-bold text-neutral-700 mb-2">
                {title}
            </h3>
            
            <p className="text-sm text-neutral-500 max-w-xs mb-4">
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
