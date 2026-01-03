import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Gavel, Sparkles } from 'lucide-react';
import { useI18n } from '../../i18n';

/**
 * CourtOpeningAnimation - Plays when both partners join court
 * Gavel animation with "Court is Now in Session" message
 */
const CourtOpeningAnimation = ({ onComplete }) => {
    const { t } = useI18n();
    useEffect(() => {
        const timer = setTimeout(onComplete, 4000);
        return () => clearTimeout(timer);
    }, [onComplete]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-gradient-to-br from-court-brown via-court-brownLight to-court-maroon flex items-center justify-center"
        >
            <div className="text-center space-y-8">
                {/* Gavel Animation */}
                <motion.div
                    initial={{ rotate: -45, y: -50 }}
                    animate={{
                        rotate: [-45, 15, -45, 15, 0],
                        y: [-50, 0, -50, 0, 0]
                    }}
                    transition={{
                        duration: 2,
                        times: [0, 0.25, 0.5, 0.75, 1],
                        ease: "easeInOut"
                    }}
                    className="relative mx-auto w-32 h-32"
                >
                    <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 0.3, delay: 0.25, repeat: 3 }}
                        className="w-32 h-32 bg-gradient-to-br from-court-gold to-court-goldDark rounded-2xl flex items-center justify-center shadow-2xl"
                    >
                        <Gavel className="w-16 h-16 text-white" />
                    </motion.div>

                    {/* Impact stars */}
                    {[0.25, 0.75, 1.25].map((delay, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: [0, 1, 0], scale: [0, 1.5, 0] }}
                            transition={{ delay, duration: 0.4 }}
                            className="absolute inset-0 flex items-center justify-center"
                        >
                            <Sparkles className="w-12 h-12 text-court-goldLight" />
                        </motion.div>
                    ))}
                </motion.div>

                {/* Text Reveal */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 2 }}
                    className="space-y-2"
                >
                    <motion.h1
                        className="text-4xl font-bold text-court-cream"
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ delay: 2.5, duration: 0.5 }}
                    >
                        {t('court.opening.title')}
                    </motion.h1>
                    <p className="text-court-tan text-lg">{t('court.opening.subtitle')}</p>
                </motion.div>

                {/* Judge Whiskers Entrance */}
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 2.8, type: "spring", bounce: 0.4 }}
                    className="mt-8"
                >
                    <motion.div
                        animate={{ y: [0, -10, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: 3.2 }}
                        className="w-32 h-32 rounded-full mx-auto overflow-hidden shadow-2xl border-4 border-court-gold"
                    >
                        <img
                            src="/assets/avatars/judge_whiskers.png"
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
