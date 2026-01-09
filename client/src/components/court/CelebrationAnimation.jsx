import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Star, Heart } from 'lucide-react';
import { useI18n } from '../../i18n';

/**
 * CelebrationAnimation - Shows when both users accept verdict
 * Confetti, bouncing cat, kibble reward display
 */
const CelebrationAnimation = ({ onComplete, kibbleReward, judgeAvatar }) => {
    const { t } = useI18n();
    const avatarSrc = judgeAvatar || '/assets/avatars/judge_whiskers.png';
    useEffect(() => {
        const timer = setTimeout(onComplete, 5000);
        return () => clearTimeout(timer);
    }, [onComplete]);

    // Warm court palette confetti - gold, blush, maroon, green, champagne, peach
    const confettiColors = ['#D4AF37', '#FF6B9D', '#8B4513', '#10B981', '#E6CFA3', '#FFC3A3'];

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-gradient-to-br from-court-ivory via-white to-court-tan/40 flex items-center justify-center overflow-hidden"
        >
            {/* Confetti Particles */}
            {[...Array(50)].map((_, i) => (
                <motion.div
                    key={i}
                    initial={{
                        y: -20,
                        x: Math.random() * window.innerWidth,
                        rotate: 0,
                        scale: 0
                    }}
                    animate={{
                        y: window.innerHeight + 100,
                        rotate: Math.random() * 720 - 360,
                        scale: [0, 1, 1, 0.5]
                    }}
                    transition={{
                        duration: 3 + Math.random() * 2,
                        delay: Math.random() * 0.5,
                        ease: "easeOut"
                    }}
                    className="absolute w-3 h-3 rounded-sm"
                    style={{
                        backgroundColor: confettiColors[i % confettiColors.length],
                        left: `${Math.random() * 100}%`
                    }}
                />
            ))}

            {/* Stars burst */}
            {[...Array(12)].map((_, i) => (
                <motion.div
                    key={`star-${i}`}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{
                        scale: [0, 1.5, 0],
                        opacity: [0, 1, 0],
                        x: Math.cos((i * 30) * Math.PI / 180) * 150,
                        y: Math.sin((i * 30) * Math.PI / 180) * 150
                    }}
                    transition={{ duration: 1.5, delay: 0.5 }}
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                >
                    <Star className="w-8 h-8 text-court-gold" />
                </motion.div>
            ))}

            <div className="relative z-10 text-center px-6 space-y-6">
                {/* Court Seal */}
                <motion.div
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", bounce: 0.35, delay: 0.2 }}
                    className="relative mx-auto w-44 h-44"
                >
                    <motion.div
                        animate={{ rotate: [0, 6, -6, 0] }}
                        transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute inset-0 rounded-full bg-gradient-to-br from-court-gold/40 via-court-gold/15 to-transparent border border-court-gold/30 shadow-2xl"
                    />
                    <motion.div
                        animate={{ scale: [0.95, 1.04, 0.95] }}
                        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute -inset-3 rounded-full border border-court-gold/30 opacity-60"
                    />
                    <div className="absolute inset-3 rounded-[28px] bg-white/80 shadow-inner-soft flex items-center justify-center overflow-hidden border border-court-gold/20">
                        <img
                            src={avatarSrc}
                            alt={t('court.celebration.judgeAlt')}
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                        className="absolute -bottom-5 left-1/2 -translate-x-1/2 px-6 py-1.5 rounded-full bg-gradient-to-r from-court-maroon to-court-brown text-white text-xs font-bold shadow-lg"
                    >
                        {t('court.celebration.title')}
                    </motion.div>
                </motion.div>

                {/* Title */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                >
                    <motion.h1
                        className="text-2xl font-bold text-court-brown mb-1"
                        animate={{ scale: [1, 1.02, 1] }}
                        transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 1 }}
                    >
                        {t('court.celebration.subtitle')}
                    </motion.h1>
                </motion.div>

                {/* Kibble Reward */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1 }}
                    className="glass-card p-6 mx-auto max-w-xs bg-gradient-to-br from-amber-50 to-white border border-court-gold/15"
                >
                    <motion.div
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 0.5 }}
                        className="text-4xl mb-2"
                    >
                        🪙
                    </motion.div>
                    <p className="text-sm text-court-brownLight mb-1">{t('court.celebration.kibbleIntro')}</p>
                    <p className="text-3xl font-bold text-court-gold">
                        {t('court.celebration.kibbleAmount', { amount: kibbleReward?.userA || 10 })}
                    </p>
                    <p className="text-xs text-court-brownLight mt-2">
                        {t('court.celebration.kibbleOutro')}
                    </p>
                </motion.div>

                {/* Hearts floating up */}
                {[...Array(6)].map((_, i) => (
                    <motion.div
                        key={`heart-${i}`}
                        initial={{ y: 100, opacity: 0, x: (i - 2.5) * 40 }}
                        animate={{ y: -200, opacity: [0, 1, 0] }}
                        transition={{ duration: 3, delay: 1.5 + i * 0.2, repeat: Infinity }}
                        className="absolute bottom-20 left-1/2"
                    >
                        <Heart className="w-6 h-6 text-pink-400 fill-pink-400" />
                    </motion.div>
                ))}

                {/* Message */}
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.5 }}
                    className="text-court-brownLight text-sm italic"
                >
                    {t('court.celebration.quote')}
                    <br />
                    <span className="text-court-tan">{t('court.celebration.signature')}</span>
                </motion.p>

                {/* Auto-redirect notice */}
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2 }}
                    className="text-xs text-court-tan"
                >
                    {t('court.celebration.returning')}
                </motion.p>
            </div>
        </motion.div>
    );
};

export default CelebrationAnimation;
