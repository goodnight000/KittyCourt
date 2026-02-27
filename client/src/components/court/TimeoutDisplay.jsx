import React from 'react';
import { motion } from 'framer-motion';
import { Clock, AlertTriangle } from 'lucide-react';
import { useI18n } from '../../i18n';
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion';

/**
 * Countdown Timer Display
 *
 * Shows remaining time with visual urgency indicators.
 * Changes color based on urgency level:
 * - normal: court-gold (champagne warmth)
 * - warning: amber (last 15 min)
 * - critical: rose pulsing (last 5 min)
 */

export default function TimeoutDisplay({
    timeFormatted,
    urgency = 'normal',
    label = null,
    className = ''
}) {
    const { t } = useI18n();
    const prefersReducedMotion = usePrefersReducedMotion();
    if (!timeFormatted || timeFormatted === '00:00') return null;
    const displayLabel = label || t('court.timeout.label');

    const urgencyStyles = {
        normal: {
            container: 'bg-court-cream/80 border-court-gold/30 text-court-brown',
            icon: 'text-court-gold',
            time: 'text-court-goldDark'
        },
        warning: {
            container: 'bg-amber-500/20 border-amber-500/40 text-amber-100',
            icon: 'text-amber-400',
            time: 'text-amber-100'
        },
        critical: {
            container: 'bg-rose-500/20 border-rose-500/40 text-rose-100',
            icon: 'text-rose-400',
            time: 'text-rose-100'
        }
    };

    const styles = urgencyStyles[urgency] || urgencyStyles.normal;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{
                opacity: 1,
                scale: 1,
                ...(urgency === 'critical' && !prefersReducedMotion && {
                    scale: [1, 1.02, 1],
                })
            }}
            transition={{
                duration: 0.3,
                ...(urgency === 'critical' && !prefersReducedMotion && {
                    scale: {
                        duration: 1,
                        repeat: Infinity,
                        ease: 'easeInOut'
                    }
                })
            }}
            className={`
                inline-flex items-center gap-2 px-3 py-1.5 rounded-full 
                border backdrop-blur-sm shadow-soft
                ${styles.container}
                ${className}
            `}
        >
            {urgency === 'critical' ? (
                <AlertTriangle className={`w-4 h-4 ${styles.icon}`} />
            ) : (
                <Clock className={`w-4 h-4 ${styles.icon}`} />
            )}
            <span className="text-xs font-medium">{displayLabel}:</span>
            <span className={`text-sm font-mono font-bold ${styles.time}`}>
                {timeFormatted}
            </span>
        </motion.div>
    );
}
