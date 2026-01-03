import React from 'react';
import { motion } from 'framer-motion';
import { Clock, AlertTriangle } from 'lucide-react';
import { useI18n } from '../../i18n';

/**
 * Countdown Timer Display
 * 
 * Shows remaining time with visual urgency indicators.
 * Changes color based on urgency level:
 * - normal: amber/gold
 * - warning: orange (last 15 min)
 * - critical: red pulsing (last 5 min)
 */

export default function TimeoutDisplay({
    timeFormatted,
    urgency = 'normal',
    label = null,
    className = ''
}) {
    const { t } = useI18n();
    if (!timeFormatted || timeFormatted === '00:00') return null;
    const displayLabel = label || t('court.timeout.label');

    const urgencyStyles = {
        normal: {
            container: 'bg-amber-500/20 border-amber-500/30 text-amber-200',
            icon: 'text-amber-400',
            time: 'text-amber-100'
        },
        warning: {
            container: 'bg-orange-500/20 border-orange-500/30 text-orange-200',
            icon: 'text-orange-400',
            time: 'text-orange-100'
        },
        critical: {
            container: 'bg-red-500/20 border-red-500/30 text-red-200',
            icon: 'text-red-400',
            time: 'text-red-100'
        }
    };

    const styles = urgencyStyles[urgency] || urgencyStyles.normal;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{
                opacity: 1,
                scale: 1,
                ...(urgency === 'critical' && {
                    scale: [1, 1.02, 1],
                })
            }}
            transition={{
                duration: 0.3,
                ...(urgency === 'critical' && {
                    scale: {
                        duration: 1,
                        repeat: Infinity,
                        ease: 'easeInOut'
                    }
                })
            }}
            className={`
                inline-flex items-center gap-2 px-3 py-1.5 rounded-full 
                border backdrop-blur-sm
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
