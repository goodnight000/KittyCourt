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
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={onCancel}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl text-center"
            >
                {/* Icon */}
                <motion.div
                    animate={{
                        scale: [1, 1.1, 1],
                        rotate: [0, 5, -5, 0]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-pink-100 to-rose-100 rounded-3xl flex items-center justify-center"
                >
                    <Handshake className="w-10 h-10 text-pink-500" />
                </motion.div>

                {/* Title */}
                <h2 className="text-xl font-bold text-neutral-800 mb-2">
                    {partnerWantsToSettle ? t('court.settleModal.title.accept') : t('court.settleModal.title.request')}
                </h2>

                {/* Description */}
                <p className="text-neutral-500 text-sm mb-6">
                    {partnerWantsToSettle ? (
                        <>
                            <span className="font-bold text-pink-500">{partnerName}</span>{' '}
                            {t('court.settleModal.body.accept')}
                        </>
                    ) : (
                        <>
                            {t('court.settleModal.body.requestIntro')}{' '}
                            <span className="font-bold text-pink-500">{partnerName}</span>{' '}
                            {t('court.settleModal.body.requestOutro')}
                        </>
                    )}
                </p>

                {/* Love Quote */}
                <div className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-2xl p-4 mb-6">
                    <p className="text-sm text-pink-700 italic">
                        {t('court.settleModal.quote')}
                    </p>
                    <p className="text-xs text-pink-400 mt-1">{t('court.settleModal.signature')}</p>
                </div>

                {/* Buttons */}
                <div className="flex gap-3">
                    <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={onCancel}
                        className="flex-1 py-3 px-4 bg-neutral-100 text-neutral-600 rounded-2xl font-medium text-sm"
                    >
                        {t('court.settleModal.keep')}
                    </motion.button>
                    <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={onConfirm}
                        className="flex-1 py-3 px-4 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-2xl font-bold text-sm shadow-lg flex items-center justify-center gap-2"
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
