import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Gavel } from 'lucide-react';
import { useI18n } from '../../i18n';
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion';

/**
 * CourtOpeningAnimation - Plays when both partners join court
 * Gavel animation with "Court is Now in Session" message
 */
const CourtOpeningAnimation = ({ onComplete, judgeAvatar }) => {
    const { t } = useI18n();
    const prefersReducedMotion = usePrefersReducedMotion();
    const avatarSrc = judgeAvatar || '/assets/avatars/judge_whiskers.png';
    useEffect(() => {
        const timer = setTimeout(onComplete, 4200);
        return () => clearTimeout(timer);
    }, [onComplete]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-gradient-to-br from-court-brown via-court-brownLight to-court-maroon flex items-center justify-center overflow-hidden"
        >
            <motion.div
                aria-hidden
                animate={prefersReducedMotion ? undefined : { opacity: [0.2, 0.4, 0.2], scale: [1, 1.04, 1] }}
                transition={prefersReducedMotion ? undefined : { duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-16 -right-8 w-72 h-72 rounded-full bg-court-gold/20 blur-2xl"
            />
            <motion.div
                aria-hidden
                animate={prefersReducedMotion ? undefined : { opacity: [0.15, 0.35, 0.15], y: [0, -8, 0] }}
                transition={prefersReducedMotion ? undefined : { duration: 5.4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -bottom-24 -left-12 w-80 h-80 rounded-full bg-lavender-200/20 blur-2xl"
            />

            {/* Curtains */}
            <motion.div
                aria-hidden
                initial={{ x: '0%' }}
                animate={{ x: '-110%' }}
                transition={{ delay: 0.6, duration: 1.8, ease: 'easeInOut' }}
                className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-b from-court-maroon via-court-brown to-court-brownDark shadow-xl"
            />
            <motion.div
                aria-hidden
                initial={{ x: '0%' }}
                animate={{ x: '110%' }}
                transition={{ delay: 0.6, duration: 1.8, ease: 'easeInOut' }}
                className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-b from-court-maroon via-court-brown to-court-brownDark shadow-xl"
            />

            <div className="relative z-10 text-center space-y-6">
                {/* Court Seal */}
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.9, type: 'spring', stiffness: 220, damping: 18 }}
                    className="relative mx-auto w-36 h-36"
                >
                    <motion.div
                        animate={prefersReducedMotion ? undefined : { rotate: [0, 4, -4, 0] }}
                        transition={prefersReducedMotion ? undefined : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute inset-0 rounded-[32px] bg-gradient-to-br from-court-gold/40 via-court-gold/15 to-transparent border border-court-gold/30 shadow-2xl"
                    />
                    <motion.div
                        animate={prefersReducedMotion ? undefined : { scale: [0.9, 1.05, 0.9] }}
                        transition={prefersReducedMotion ? undefined : { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute -inset-3 rounded-[40px] border border-court-gold/30 opacity-60"
                    />
                    <motion.div
                        initial={{ rotate: -20, y: -10 }}
                        animate={prefersReducedMotion ? { rotate: 0, y: 0 } : { rotate: [0, -12, 0], y: [0, -6, 0] }}
                        transition={prefersReducedMotion ? { duration: 0.2 } : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                        className="relative w-36 h-36 rounded-[32px] bg-gradient-to-br from-court-gold to-court-goldDark flex items-center justify-center shadow-2xl"
                    >
                        <Gavel className="w-16 h-16 text-white" />
                    </motion.div>
                </motion.div>

                {/* Text Reveal */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.6 }}
                    className="space-y-2"
                >
                    <motion.h1
                        className="text-4xl font-bold text-court-cream"
                        animate={{ scale: [1, 1.03, 1] }}
                        transition={{ delay: 1.9, duration: 0.6 }}
                    >
                        {t('court.opening.title')}
                    </motion.h1>
                    <p className="text-court-tan text-lg">{t('court.opening.subtitle')}</p>
                </motion.div>

                {/* Judge Entrance */}
                <motion.div
                    initial={{ y: 40, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 2.2, type: "spring", bounce: 0.3 }}
                    className="mt-4"
                >
                    <motion.div
                        animate={prefersReducedMotion ? undefined : { y: [0, -6, 0] }}
                        transition={prefersReducedMotion ? undefined : { duration: 2, repeat: Infinity, delay: 2.6 }}
                        className="w-36 h-36 rounded-full mx-auto overflow-hidden shadow-2xl border-4 border-court-gold"
                    >
                        <img
                            src={avatarSrc}
                            alt={t('court.opening.judgeAlt')}
                            className="w-full h-full object-cover"
                        />
                    </motion.div>
                </motion.div>
            </div>
        </motion.div>
    );
};

export default CourtOpeningAnimation;
