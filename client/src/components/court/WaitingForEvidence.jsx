import React from 'react';
import { motion } from 'framer-motion';
import { FileCheck, Clock, Users } from 'lucide-react';
import SettlementButton from './SettlementButton';
import { useI18n } from '../../i18n';

/**
 * WaitingForEvidence
 * Shown after YOU submit evidence, while waiting for your partner to submit theirs.
 * This is intentionally separate from WaitingForPartner (which is only for joining the session).
 */
const WaitingForEvidence = ({ session, partnerName, myName }) => {
    const { t } = useI18n();
    const displayPartnerName = partnerName || t('common.yourPartner');
    const displayMyName = myName || t('common.you');

    const creatorSubmitted = !!session?.evidence?.creator?.submitted;
    const partnerSubmitted = !!session?.evidence?.partner?.submitted;

    return (
        <div className="max-w-md mx-auto space-y-6">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card overflow-hidden"
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-court-gold via-court-goldDark to-court-brown p-4 text-center">
                    <motion.div
                        animate={{ scale: [1, 1.08, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="inline-block"
                    >
                        <span className="text-4xl">🗂️</span>
                    </motion.div>
                    <h2 className="text-xl font-bold text-white mt-2">{t('court.waitingEvidence.title')}</h2>
                    <p className="text-court-cream/80 text-sm">
                        {t('court.waitingEvidence.subtitle', { name: displayPartnerName })}
                    </p>
                </div>

                {/* Content */}
                <div className="p-6 text-center">
                    {/* Animated Waiting Indicator */}
                    <div className="relative w-24 h-24 mx-auto mb-6">
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
                        <div className="absolute inset-4 bg-gradient-to-br from-court-cream to-white rounded-full flex items-center justify-center shadow-lg">
                            <motion.div animate={{ y: [0, -3, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
                                <Clock className="w-8 h-8 text-court-gold" />
                            </motion.div>
                        </div>
                    </div>

                    {/* Status Message */}
                    <p className="text-court-brown font-medium mb-6">
                        {t('court.waitingEvidence.statusIntro')}{' '}
                        <span className="text-court-gold font-bold">{displayPartnerName}</span>
                        {t('court.waitingEvidence.statusOutro')}
                    </p>

                    {/* Submission Status Panel */}
                    <div className="bg-gradient-to-br from-court-cream to-court-tan/30 rounded-2xl p-4 mb-6">
                        <div className="flex items-center justify-center gap-2 mb-3">
                            <Users className="w-4 h-4 text-court-gold" />
                            <span className="text-sm font-bold text-court-brown">{t('court.waitingEvidence.panelTitle')}</span>
                        </div>

                        <div className="flex justify-center gap-8">
                            <div className="text-center">
                                <motion.div
                                    animate={{ scale: [1, 1.05, 1] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 border-2 ${creatorSubmitted ? 'bg-green-100 border-green-400' : 'bg-court-cream border-court-gold/50'}`}
                                >
                                    <FileCheck className={`w-6 h-6 ${creatorSubmitted ? 'text-green-600' : 'text-court-gold'}`} />
                                </motion.div>
                                <span className="text-xs font-medium text-court-brown">{displayMyName}</span>
                                <div className={`text-[10px] font-medium mt-0.5 ${creatorSubmitted ? 'text-green-600' : 'text-court-gold'}`}>
                                    {creatorSubmitted ? t('court.waitingEvidence.submitted') : t('court.waitingEvidence.pending')}
                                </div>
                            </div>

                            <div className="text-center">
                                <motion.div
                                    animate={{
                                        boxShadow: [
                                            '0 0 0 0 rgba(201, 162, 39, 0)',
                                            '0 0 0 8px rgba(201, 162, 39, 0.25)',
                                            '0 0 0 0 rgba(201, 162, 39, 0)'
                                        ]
                                    }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 border-2 ${partnerSubmitted ? 'bg-green-100 border-green-400' : 'bg-court-cream border-court-gold/50'}`}
                                >
                                    <FileCheck className={`w-6 h-6 ${partnerSubmitted ? 'text-green-600' : 'text-court-gold'}`} />
                                </motion.div>
                                <span className="text-xs font-medium text-court-brown">{displayPartnerName}</span>
                                <div className={`text-[10px] font-medium mt-0.5 ${partnerSubmitted ? 'text-green-600' : 'text-court-gold'}`}>
                                    {partnerSubmitted ? t('court.waitingEvidence.submitted') : t('court.waitingEvidence.waiting')}
                                </div>
                            </div>
                        </div>
                    </div>

                    <p className="text-xs text-court-brownLight italic">
                        {t('court.waitingEvidence.note')}
                    </p>

                    <div className="mt-5">
                        <SettlementButton className="w-full" />
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default WaitingForEvidence;
