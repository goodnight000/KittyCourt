import React from 'react';
import { motion } from 'framer-motion';
import { Handshake, Heart } from 'lucide-react';
import { useI18n } from '../../i18n';

/**
 * SettleModal - Confirmation modal for settling out of court
 */
const SettleModal = ({ onConfirm, onCancel, partnerName, partnerWantsToSettle }) => {
    const { t } = useI18n();
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4"
            onClick={onCancel}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="relative glass-card bg-gradient-to-br from-court-ivory via-white/95 to-court-tan/30 border border-court-gold/20 rounded-3xl w-full max-w-sm p-6 shadow-2xl text-center"
            >
                <div className="absolute inset-x-8 top-0 h-0.5 bg-gradient-to-r from-transparent via-court-gold/60 to-transparent" />
                {/* Icon */}
                <motion.div
                    animate={{
                        scale: [1, 1.1, 1],
                        rotate: [0, 5, -5, 0]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-court-gold/20 to-court-tan/40 rounded-3xl flex items-center justify-center border border-court-gold/20"
                >
                    <Handshake className="w-10 h-10 text-court-gold" />
                </motion.div>

                {/* Title */}
                <h2 className="text-xl font-bold text-court-brown mb-2">
                    {partnerWantsToSettle ? t('court.settleModal.title.accept') : t('court.settleModal.title.request')}
                </h2>

                {/* Description */}
                <p className="text-court-brownLight text-sm mb-6">
                    {partnerWantsToSettle ? (
                        <>
                            <span className="font-bold text-court-gold">{partnerName}</span>{' '}
                            {t('court.settleModal.body.accept')}
                        </>
                    ) : (
                        <>
                            {t('court.settleModal.body.requestIntro')}{' '}
                            <span className="font-bold text-court-gold">{partnerName}</span>{' '}
                            {t('court.settleModal.body.requestOutro')}
                        </>
                    )}
                </p>

                {/* Love Quote */}
                <div className="bg-gradient-to-r from-court-cream/70 to-court-tan/40 rounded-2xl p-4 mb-6 border border-court-tan/30">
                    <p className="text-sm text-court-brown italic">
                        {t('court.settleModal.quote')}
                    </p>
                    <p className="text-xs text-court-brownLight mt-1">{t('court.settleModal.signature')}</p>
                </div>

                {/* Buttons */}
                <div className="flex gap-3">
                    <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={onCancel}
                        className="court-btn-secondary flex-1"
                    >
                        {t('court.settleModal.keep')}
                    </motion.button>
                    <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={onConfirm}
                        className="court-btn-primary flex-1 flex items-center justify-center gap-2"
                    >
                        <Heart className="w-4 h-4" />
                        {partnerWantsToSettle ? t('court.settleModal.accept') : t('court.settleModal.request')}
                    </motion.button>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default SettleModal;
