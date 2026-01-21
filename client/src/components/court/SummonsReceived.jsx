import React from 'react';
import { motion } from 'framer-motion';
import { Gavel, Star, Heart, FileText } from 'lucide-react';
import { useI18n } from '../../i18n';
import ButtonLoader from '../shared/ButtonLoader';

/**
 * SummonsReceived - Premium Court Invitation Experience
 * Shows when partner has filed a case - makes the invitation feel special and ceremonial
 */

// Floating decorative elements for magical ambiance
const floatingElements = [
    // Gold stars (ceremonial)
    { Icon: Star, color: 'text-court-gold', size: 'w-3.5 h-3.5', left: '8%', top: '5%', delay: 0 },
    { Icon: Star, color: 'text-court-goldLight', size: 'w-3 h-3', left: '88%', top: '10%', delay: 0.8 },
    { Icon: Star, color: 'text-court-gold', size: 'w-4 h-4', left: '92%', top: '40%', delay: 1.5 },
    // Lavender accents (dreamy)
    { Icon: Star, color: 'text-lavender-300', size: 'w-3.5 h-3.5', left: '5%', top: '35%', delay: 0.5 },
    { Icon: Star, color: 'text-lavender-400', size: 'w-3 h-3', left: '90%', top: '65%', delay: 1.2 },
    // Hearts (love theme - it's a couples app)
    { Icon: Heart, color: 'text-blush-300', size: 'w-3 h-3', left: '6%', top: '60%', delay: 1.8 },
    { Icon: Heart, color: 'text-blush-400', size: 'w-3.5 h-3.5', left: '85%', top: '25%', delay: 0.3 },
    // Scroll accent
    { Icon: Star, color: 'text-court-goldLight', size: 'w-3 h-3', left: '12%', top: '80%', delay: 2.0 },
];

const SummonsReceived = ({ session, senderName, onJoin, isSubmitting }) => {
    const { t } = useI18n();
    const displaySenderName = senderName || t('common.yourPartner');

    return (
        <div className="relative min-h-[400px] flex items-center justify-center px-4 py-8">
            {/* Ambient glow blobs */}
            <div className="absolute -top-10 -right-8 w-40 h-40 rounded-full bg-court-gold/15 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-10 w-48 h-48 rounded-full bg-lavender-200/20 blur-3xl pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-blush-200/10 blur-3xl pointer-events-none" />

            {/* Floating decorative elements */}
            {floatingElements.map((el, i) => (
                <motion.span
                    key={i}
                    animate={{
                        y: [0, -10, 0],
                        opacity: [0.4, 0.9, 0.4],
                        scale: [0.9, 1.15, 0.9],
                    }}
                    transition={{
                        duration: 3 + Math.random() * 2,
                        delay: el.delay,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                    className={`absolute ${el.color} drop-shadow-sm pointer-events-none`}
                    style={{ left: el.left, top: el.top }}
                >
                    <el.Icon className={el.size} />
                </motion.span>
            ))}

            {/* Main card */}
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="relative z-10 glass-card p-8 text-center max-w-sm mx-auto
                    bg-gradient-to-br from-court-ivory via-white/95 to-court-tan/40
                    border border-court-gold/20 shadow-xl overflow-hidden"
            >
                {/* Inner glow effect */}
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-court-gold/5 via-transparent to-lavender-100/10 pointer-events-none" />

                {/* Decorative top border accent */}
                <div className="absolute inset-x-8 top-0 h-0.5 bg-gradient-to-r from-transparent via-court-gold/40 to-transparent" />
                <div className="absolute -right-10 -top-10 w-24 h-24 rounded-full bg-court-gold/10 blur-2xl pointer-events-none" />

                {/* Scroll icon with ceremonial styling */}
                <motion.div
                    initial={{ rotate: -2, scale: 0.98 }}
                    animate={{
                        rotate: [-2, 2, -2],
                        scale: [0.98, 1.02, 0.98],
                    }}
                    transition={{
                        duration: 3.6,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                    className="relative mb-6 flex justify-center w-full"
                >
                    {/* Outer glow ring */}
                    <motion.div
                        animate={{
                            scale: [1, 1.1, 1],
                            opacity: [0.3, 0.6, 0.3]
                        }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="absolute -inset-4 bg-gradient-to-br from-court-gold/30 via-lavender-200/20 to-blush-200/25 rounded-full blur-xl"
                    />

                    {/* Scroll container */}
                    <div className="relative w-28 h-28 bg-gradient-to-br from-white to-court-cream rounded-3xl
                        flex items-center justify-center shadow-lg border border-court-gold/20">
                        <FileText className="w-12 h-12 text-court-gold" />

                        {/* Accent */}
                        <motion.div
                            animate={{ rotate: [0, 12, -12, 0], opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 2.6, repeat: Infinity }}
                            className="absolute -top-1 -right-1"
                        >
                            <Star className="w-5 h-5 text-court-gold" />
                        </motion.div>
                    </div>
                </motion.div>

                {/* Kicker text */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full
                        bg-gradient-to-r from-court-gold/10 via-lavender-100/20 to-blush-100/15
                        border border-court-gold/15 mb-3"
                >
                    <Gavel className="w-3 h-3 text-court-gold" />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-court-gold">
                        {t('court.summons.officialBadge')}
                    </span>
                </motion.div>

                {/* Title */}
                <motion.h2
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-2xl font-bold text-court-brown mb-3"
                >
                    {t('court.summons.title')}
                </motion.h2>

                {/* Body text */}
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-court-brownLight text-sm mb-6 leading-relaxed"
                >
                    <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-court-gold to-court-goldDark">
                        {displaySenderName}
                    </span>
                    <span className="ml-1">.</span>{' '}
                    {t('court.summons.body')}
                </motion.p>

                {/* Premium CTA button */}
                <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onJoin}
                    disabled={isSubmitting}
                    className="relative w-full court-btn-primary overflow-hidden group disabled:opacity-60"
                >
                    {/* Button shimmer effect */}
                    <motion.div
                        animate={{ x: ['-100%', '200%'] }}
                        transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"
                    />

                    {isSubmitting ? (
                        <ButtonLoader
                            size="sm"
                            tone="white"
                        />
                    ) : (
                        <>
                            <Gavel className="w-5 h-5 relative z-10" />
                            <span className="relative z-10">{t('court.summons.cta')}</span>
                        </>
                    )}
                </motion.button>

                {/* Expiry notice */}
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="text-xs text-court-brownLight/70 mt-5 flex items-center justify-center gap-1.5"
                >
                    <span className="inline-block w-1 h-1 rounded-full bg-court-gold/50" />
                    {t('court.summons.expiry')}
                    <span className="inline-block w-1 h-1 rounded-full bg-court-gold/50" />
                </motion.p>
            </motion.div>
        </div>
    );
};

export default SummonsReceived;
