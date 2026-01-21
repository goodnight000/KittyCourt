import React from 'react';
import { motion } from 'framer-motion';
import { Scale, Gavel, Bell, ChevronRight, History, Star } from 'lucide-react';
import { useI18n } from '../../i18n';

/**
 * StartCourtView - Entry point for starting a new court session
 * Shows instructions and button to serve partner
 * Premium, immersive design with floating decorative elements
 */
const StartCourtView = ({ onServe, navigate }) => {
    const { t } = useI18n();

    // Floating decorative elements for visual delight
    const floatingElements = [
        { Icon: Star, color: 'text-court-gold', size: 'w-3.5 h-3.5', left: '8%', top: '5%', delay: 0 },
        { Icon: Star, color: 'text-court-goldLight/60', size: 'w-3 h-3', left: '85%', top: '10%', delay: 0.5 },
        { Icon: Scale, color: 'text-court-gold/70', size: 'w-3 h-3', left: '92%', top: '35%', delay: 1 },
        { Icon: Star, color: 'text-lavender-300/50', size: 'w-3 h-3', left: '5%', top: '45%', delay: 1.5 },
        { Icon: Star, color: 'text-court-gold/40', size: 'w-3.5 h-3.5', left: '90%', top: '60%', delay: 2 },
    ];

    return (
        <div className="relative space-y-6">
            {/* Ambient Background Glows */}
            <div className="absolute -top-16 -right-10 w-40 h-40 rounded-full bg-court-gold/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-8 w-32 h-32 rounded-full bg-lavender-100/20 blur-2xl pointer-events-none" />
            <div className="absolute inset-x-0 top-6 h-10 bg-gradient-to-r from-transparent via-court-gold/10 to-transparent blur-xl pointer-events-none" />

            {/* Floating Decorative Elements */}
            {floatingElements.map((el, i) => (
                <motion.span
                    key={i}
                    animate={{
                        y: [0, -8, 0],
                        rotate: [0, 5, -5, 0],
                        opacity: [0.4, 0.7, 0.4]
                    }}
                    transition={{
                        duration: 4 + i * 0.5,
                        repeat: Infinity,
                        delay: el.delay,
                        ease: "easeInOut"
                    }}
                    className={`absolute ${el.color} opacity-60 pointer-events-none drop-shadow-sm`}
                    style={{ left: el.left, top: el.top }}
                >
                    <el.Icon className={el.size} />
                </motion.span>
            ))}

            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative text-center z-10"
            >
                <motion.div
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                    className="relative w-20 h-20 bg-gradient-to-br from-court-gold/20 to-court-tan rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg"
                >
                    {/* Inner glow ring */}
                    <div className="absolute inset-0 rounded-3xl ring-1 ring-court-gold/20" />
                    {/* Outer ambient glow */}
                    <motion.div
                        animate={{ opacity: [0.3, 0.5, 0.3], scale: [1, 1.05, 1] }}
                        transition={{ duration: 3, repeat: Infinity }}
                        className="absolute -inset-2 bg-court-gold/10 rounded-[28px] blur-xl"
                    />
                    <Scale className="w-10 h-10 text-court-gold relative z-10" />
                </motion.div>
                <h1 className="text-2xl font-bold text-gradient">{t('court.start.title')}</h1>
                <p className="text-court-brownLight text-sm mt-1">{t('court.start.subtitle')}</p>
            </motion.div>

            {/* Court Info Card */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="relative glass-card p-5 space-y-4 z-10 border border-court-gold/15 bg-gradient-to-br from-court-ivory via-white/90 to-court-tan/30"
            >
                {/* Card ambient glow */}
                <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-court-gold/8 blur-2xl pointer-events-none" />
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-court-gold/20 to-court-tan rounded-xl flex items-center justify-center">
                        <Gavel className="w-6 h-6 text-court-gold" />
                    </div>
                    <div>
                        <h3 className="font-bold text-court-brown">{t('court.start.card.title')}</h3>
                        <p className="text-xs text-court-brownLight">{t('court.start.card.subtitle')}</p>
                    </div>
                </div>

                <div className="bg-court-cream/80 border border-court-gold/10 rounded-2xl p-4 space-y-3">
                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-court-gold/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs font-bold text-court-gold">1</span>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-court-brown">{t('court.start.steps.serve.title')}</p>
                            <p className="text-xs text-court-brownLight">{t('court.start.steps.serve.subtitle')}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-court-gold/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs font-bold text-court-gold">2</span>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-court-brown">{t('court.start.steps.wait.title')}</p>
                            <p className="text-xs text-court-brownLight">{t('court.start.steps.wait.subtitle')}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-court-gold/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs font-bold text-court-gold">3</span>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-court-brown">{t('court.start.steps.present.title')}</p>
                            <p className="text-xs text-court-brownLight">{t('court.start.steps.present.subtitle')}</p>
                        </div>
                    </div>
                </div>

                <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onServe}
                    className="court-btn-primary w-full"
                >
                    <Bell className="w-4 h-4" />
                    {t('court.start.cta')}
                    <ChevronRight className="w-4 h-4" />
                </motion.button>
            </motion.div>

            {/* History Link */}
            <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/history')}
                className="relative w-full glass-card p-4 flex items-center justify-between z-10 border border-court-tan/40 bg-white/80"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-court-gold/15 to-court-tan/30 rounded-xl flex items-center justify-center">
                        <History className="w-5 h-5 text-court-gold" />
                    </div>
                    <span className="font-medium text-court-brown">{t('court.start.history')}</span>
                </div>
                <ChevronRight className="w-5 h-5 text-court-brownLight" />
            </motion.button>
        </div>
    );
};

export default StartCourtView;
