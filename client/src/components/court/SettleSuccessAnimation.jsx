import React from 'react';
import { motion } from 'framer-motion';
import { Cat, Handshake, Heart } from 'lucide-react';
import { useI18n } from '../../i18n';

/**
 * SettleSuccessAnimation - Shows when both partners agree to settle
 * Floating hearts and case dismissed message
 */
const SettleSuccessAnimation = ({ partnerName }) => {
    const { t } = useI18n();
    const heartColors = ['text-rose-400', 'text-pink-400', 'text-amber-300', 'text-rose-300', 'text-pink-300'];
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-gradient-to-br from-court-cream via-white to-court-tan/40 flex items-center justify-center overflow-hidden"
        >
            {/* Floating Hearts */}
            {[...Array(20)].map((_, i) => (
                <motion.div
                    key={i}
                    initial={{ y: window.innerHeight, x: Math.random() * window.innerWidth, opacity: 0 }}
                    animate={{
                        y: -100,
                        opacity: [0, 1, 1, 0],
                        rotate: Math.random() * 360
                    }}
                    transition={{
                        duration: 4 + Math.random() * 2,
                        delay: Math.random() * 2,
                        repeat: Infinity
                    }}
                    className="absolute"
                >
                    <Heart className={`w-6 h-6 ${heartColors[i % heartColors.length]} fill-current`} />
                </motion.div>
            ))}

            <div className="text-center px-6 z-10">
                {/* Handshake Icon */}
                <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", bounce: 0.5, delay: 0.2 }}
                    className="w-32 h-32 mx-auto mb-6 bg-gradient-to-br from-court-gold/25 to-court-tan/50 rounded-full flex items-center justify-center shadow-2xl border border-court-gold/20"
                >
                    <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                    >
                        <Handshake className="w-16 h-16 text-court-gold" />
                    </motion.div>
                </motion.div>

                {/* Title */}
                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="text-3xl font-bold text-gradient mb-3"
                >
                    {t('court.settleSuccess.title')}
                </motion.h1>

                {/* Subtitle */}
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                    className="text-court-brownLight text-lg mb-6"
                >
                    {t('court.settleSuccess.subtitle')}
                </motion.p>

                {/* Card */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.9 }}
                    className="bg-white/85 backdrop-blur-sm rounded-3xl p-6 shadow-xl max-w-xs mx-auto border border-court-tan/30"
                >
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-court-cream rounded-full flex items-center justify-center border border-court-tan/30">
                            <Cat className="w-6 h-6 text-court-brown" />
                        </div>
                        <Heart className="w-6 h-6 text-court-gold fill-court-gold" />
                        <div className="w-12 h-12 bg-court-cream rounded-full flex items-center justify-center border border-court-tan/30">
                            <Cat className="w-6 h-6 text-court-brown" />
                        </div>
                    </div>
                    <p className="text-sm text-court-brownLight italic">
                        {t('court.settleSuccess.quote')}
                    </p>
                    <p className="text-xs text-court-tan mt-2">{t('court.settleSuccess.signature')}</p>
                </motion.div>

                {/* Redirect notice */}
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.5 }}
                    className="text-court-tan text-sm mt-6"
                >
                    {t('court.settleSuccess.returning')}
                </motion.p>
            </div>
        </motion.div>
    );
};

export default SettleSuccessAnimation;
