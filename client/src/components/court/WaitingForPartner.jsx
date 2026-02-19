import React from 'react';
import { motion } from 'framer-motion';
import { Bell, Users, Check, Clock, X, Scale, Lightbulb } from 'lucide-react';
import { useI18n } from '../../i18n';
import ButtonLoader from '../shared/ButtonLoader';
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion';

/**
 * WaitingForPartner - Shows when waiting for partner to join court
 * Displays court attendance status and waiting animation
 */
const WaitingForPartner = ({ session, partnerName, myName, isCreator, onCancel, isSubmitting }) => {
    const { t } = useI18n();
    const prefersReducedMotion = usePrefersReducedMotion();
    const displayPartnerName = partnerName || t('common.yourPartner');
    const displayMyName = myName || t('common.you');

    return (
        <div className="max-w-md mx-auto space-y-4 pb-4 pt-2">
            {/* Main Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card overflow-hidden border border-court-gold/15 bg-white/85"
            >
                {/* Header Banner */}
                <div className="bg-gradient-to-r from-court-gold via-court-goldDark to-court-brown p-3 text-center">
                    <motion.div
                        animate={prefersReducedMotion ? undefined : { y: [0, -4, 0], rotate: [-2, 2, -2] }}
                        transition={prefersReducedMotion ? undefined : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                        className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/15"
                    >
                        <Bell className="w-6 h-6 text-white" />
                    </motion.div>
                    <h2 className="text-base font-semibold text-white mt-2">
                        {t('court.waitingPartner.title')}
                    </h2>
                </div>

                {/* Content */}
                <div className="p-4 text-center">
                    {/* Animated Waiting Indicator */}
                    <div className="relative w-20 h-20 mx-auto mb-4">
                        <motion.div
                            animate={prefersReducedMotion ? undefined : { scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                            transition={prefersReducedMotion ? undefined : { duration: 2, repeat: Infinity }}
                            className="absolute inset-0 rounded-full border-4 border-court-gold/30"
                        />
                        <motion.div
                            animate={prefersReducedMotion ? undefined : { rotate: 360 }}
                            transition={prefersReducedMotion ? undefined : { duration: 8, repeat: Infinity, ease: "linear" }}
                            className="absolute inset-2 rounded-full border-2 border-dashed border-court-gold/50"
                        />
                        <div className="absolute inset-3 bg-gradient-to-br from-court-cream to-white rounded-full flex items-center justify-center shadow-lg">
                            <motion.div
                                animate={prefersReducedMotion ? undefined : { y: [0, -3, 0] }}
                                transition={prefersReducedMotion ? undefined : { duration: 1.5, repeat: Infinity }}
                            >
                                <Clock className="w-6 h-6 text-court-gold" />
                            </motion.div>
                        </div>
                    </div>

                    {/* Status Message */}
                    <p className="text-court-brown font-medium mb-4">
                        {t('court.waitingPartner.statusIntro')}{' '}
                        <span className="text-court-gold font-bold">{displayPartnerName}</span>
                        {t('court.waitingPartner.statusOutro')}
                    </p>

                    {/* Court Status Panel */}
                    <div className="bg-gradient-to-br from-court-ivory/90 to-court-tan/30 rounded-2xl p-4 mb-4 border border-court-tan/30">
                        <div className="flex items-center justify-center gap-2 mb-3">
                            <Users className="w-4 h-4 text-court-gold" />
                            <span className="text-sm font-bold text-court-brown">{t('court.waitingPartner.panelTitle')}</span>
                        </div>

                        <div className="flex justify-center gap-8">
                            {/* You */}
                            <div className="text-center">
                                <motion.div
                                    animate={prefersReducedMotion ? undefined : { scale: [1, 1.05, 1] }}
                                    transition={prefersReducedMotion ? undefined : { duration: 2, repeat: Infinity }}
                                    className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2 border-2 border-green-400"
                                >
                                    <Check className="w-6 h-6 text-green-600" />
                                </motion.div>
                                <span className="text-xs font-medium text-court-brown">{displayMyName}</span>
                                <div className="text-[10px] text-green-600 font-medium mt-0.5">{t('court.waitingPartner.present')}</div>
                            </div>

                            {/* Divider */}
                            <div className="flex flex-col items-center justify-center">
                                <div className="w-8 h-0.5 bg-court-tan" />
                                <motion.div
                                    animate={prefersReducedMotion ? undefined : { x: [-10, 10, -10] }}
                                    transition={prefersReducedMotion ? undefined : { duration: 2, repeat: Infinity }}
                                    className="my-1"
                                >
                                    <Scale className="w-5 h-5 text-court-gold" />
                                </motion.div>
                                <div className="w-8 h-0.5 bg-court-tan" />
                            </div>

                            {/* Partner */}
                            <div className="text-center">
                                <motion.div
                                    animate={prefersReducedMotion ? undefined : {
                                        scale: [1, 1.08, 1],
                                        opacity: [0.8, 1, 0.8]
                                    }}
                                    transition={prefersReducedMotion ? undefined : { duration: 2, repeat: Infinity }}
                                    className="w-12 h-12 bg-court-cream rounded-full flex items-center justify-center mx-auto mb-2 border-2 border-court-gold/50"
                                >
                                    <Clock className="w-5 h-5 text-court-gold" />
                                </motion.div>
                                <span className="text-xs font-medium text-court-brown">{displayPartnerName}</span>
                                <div className="text-[10px] text-court-gold font-medium mt-0.5">{t('court.waitingPartner.awaiting')}</div>
                            </div>
                        </div>
                    </div>

                    {/* Loading dots */}
                    <div className="flex justify-center gap-1.5 mb-4">
                        {[0, 1, 2].map((i) => (
                            <motion.div
                                key={i}
                                animate={prefersReducedMotion ? undefined : { y: [0, -8, 0], opacity: [0.4, 1, 0.4] }}
                                transition={prefersReducedMotion ? undefined : { duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                                className="w-2.5 h-2.5 bg-court-gold rounded-full"
                            />
                        ))}
                    </div>

                    {/* Cancel Button */}
                    <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={onCancel}
                        disabled={isSubmitting}
                        className="court-btn-ghost mx-auto disabled:opacity-60"
                    >
                        {isSubmitting ? (
                            <ButtonLoader size="sm" tone="court" variant="dots" />
                        ) : (
                            <>
                                <X className="w-4 h-4" />
                                {t('court.waitingPartner.cancel')}
                            </>
                        )}
                    </motion.button>
                </div>
            </motion.div>

            {/* Tip Card */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-card p-3 bg-gradient-to-r from-court-cream/70 via-peach-50/70 to-blush-50/70 border border-court-tan/30"
            >
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                        <Lightbulb className="w-5 h-5 text-court-gold" />
                    </div>
                    <div>
                        <p className="text-sm text-court-brown font-medium">{t('court.waitingPartner.tipTitle')}</p>
                        <p className="text-xs text-court-brownLight mt-1">
                            {t('court.waitingPartner.tipBody')}
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default WaitingForPartner;
