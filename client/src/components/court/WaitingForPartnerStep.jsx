import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Users } from 'lucide-react';
import { useI18n } from '../../i18n';

const WaitingForPartnerStep = ({ title, subtitle, partnerName }) => {
    const { t } = useI18n();
    const displayPartnerName = partnerName || t('common.yourPartner');
    return (
        <div className="max-w-md mx-auto space-y-4 pb-4 pt-2">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card overflow-hidden border border-court-gold/15 bg-white/85 relative"
            >
                <div className="absolute -top-12 -right-10 w-28 h-28 rounded-full bg-court-gold/15 blur-2xl" />
                <div className="absolute -bottom-16 -left-12 w-36 h-36 rounded-full bg-lavender-200/20 blur-2xl" />
                <div className="bg-gradient-to-r from-court-gold via-court-goldDark to-court-brown p-3 text-center">
                    <motion.div
                        animate={{ scale: [1, 1.08, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/15"
                    >
                        <Clock className="w-5 h-5 text-white" />
                    </motion.div>
                    <h2 className="text-lg font-bold text-white mt-2">{title}</h2>
                    <p className="text-court-cream/80 text-sm">{subtitle}</p>
                </div>

                <div className="p-4 text-center space-y-4">
                    <div className="relative w-20 h-20 mx-auto">
                        <motion.div
                            animate={{ scale: [1, 1.2, 1], opacity: [0.25, 0.55, 0.25] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="absolute inset-0 rounded-full border-4 border-court-gold/30"
                        />
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                            className="absolute inset-2 rounded-full border-2 border-dashed border-court-gold/50"
                        />
                        <div className="absolute inset-3 bg-gradient-to-br from-court-cream to-white rounded-full flex items-center justify-center shadow-lg">
                            <motion.div animate={{ y: [0, -3, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
                                <Clock className="w-6 h-6 text-court-gold" />
                            </motion.div>
                        </div>
                    </div>

                    <p className="text-court-brown font-medium">
                        {t('court.waitingStep.statusIntro')}{' '}
                        <span className="text-court-gold font-bold">{displayPartnerName}</span>…
                    </p>

                    <div className="bg-gradient-to-br from-court-ivory/90 to-court-tan/30 rounded-2xl p-4 border border-court-tan/30">
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <Users className="w-4 h-4 text-court-gold" />
                            <span className="text-sm font-bold text-court-brown">{t('court.waitingStep.panelTitle')}</span>
                        </div>
                        <p className="text-xs text-court-brownLight">
                            {t('court.waitingStep.panelBody', { name: displayPartnerName })}
                        </p>
                    </div>

                    <p className="text-xs text-court-brownLight italic">
                        {t('court.waitingStep.note')}
                    </p>
                </div>
            </motion.div>
        </div>
    );
};

export default WaitingForPartnerStep;
