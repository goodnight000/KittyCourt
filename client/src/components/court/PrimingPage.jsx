import React from 'react';
import { motion } from 'framer-motion';
import { HeartHandshake, Eye, MessageCircle, HelpCircle, ArrowRight, Star, Clock, Feather } from 'lucide-react';
import { useI18n } from '../../i18n';
import JourneyProgress from './JourneyProgress';

const PrimingPage = ({ priming, myName, partnerName, onComplete, isSubmitting }) => {
    const { t } = useI18n();
    const displayPartnerName = partnerName || t('common.yourPartner');
    if (!priming) {
        return (
            <div className="max-w-md mx-auto glass-card p-4 text-center">
                <p className="text-sm text-court-brown">{t('court.priming.loadingTitle')}</p>
                <p className="text-xs text-court-brownLight mt-1">{t('court.priming.loadingSubtitle')}</p>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-5 pb-6 relative">
            <motion.div
                aria-hidden
                animate={{ opacity: [0.3, 0.5, 0.3], y: [0, -8, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -top-10 -right-8 w-32 h-32 rounded-full bg-blush-200/25 blur-2xl pointer-events-none"
            />
            <motion.div
                aria-hidden
                animate={{ opacity: [0.25, 0.45, 0.25], scale: [1, 1.05, 1] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute top-1/3 -left-10 w-36 h-36 rounded-full bg-lavender-200/25 blur-2xl pointer-events-none"
            />
            <motion.div
                aria-hidden
                animate={{ opacity: [0.2, 0.4, 0.2], y: [0, 6, 0] }}
                transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute bottom-10 right-6 w-28 h-28 rounded-full bg-court-gold/15 blur-2xl pointer-events-none"
            />

            <JourneyProgress currentStep={1} />
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-5 bg-gradient-to-br from-court-ivory via-white/95 to-court-tan/40 relative overflow-hidden border border-court-gold/15"
            >
                <div className="absolute -top-10 -right-8 w-32 h-32 rounded-full bg-court-gold/10 blur-2xl" />
                <div className="absolute -bottom-12 -left-10 w-40 h-40 rounded-full bg-court-tan/20 blur-2xl" />
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-court-gold/60 to-transparent" />
                <div className="absolute left-6 top-4 h-2 w-12 rounded-full bg-court-gold/20" />
                <div className="flex items-start gap-3 relative">
                    <div className="w-12 h-12 rounded-2xl bg-court-gold/15 flex items-center justify-center">
                        <Eye className="w-6 h-6 text-court-gold" />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-lg font-bold text-court-brown">{t('court.priming.header.title')}</h2>
                        <p className="text-sm text-court-brownLight">
                            {t('court.priming.header.subtitle', { name: myName })}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-court-brownLight">
                            <span className="inline-flex items-center gap-1 rounded-full border border-court-tan/40 bg-white/60 px-2 py-1">
                                <Star className="w-3 h-3 text-court-gold" />
                                {t('court.priming.header.badges.private')}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full border border-court-tan/40 bg-white/60 px-2 py-1">
                                <Clock className="w-3 h-3 text-court-brown" />
                                {t('court.priming.header.badges.readTime')}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full border border-court-tan/40 bg-white/60 px-2 py-1">
                                <Feather className="w-3 h-3 text-court-brown" />
                                {t('court.priming.header.badges.gentle')}
                            </span>
                        </div>
                    </div>
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-card p-4 space-y-3 border-l-4 border-blush-300/70 relative overflow-hidden bg-gradient-to-br from-blush-50/70 via-white/85 to-court-cream/80"
            >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-court-gold/60 to-transparent" />
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blush-200/60 flex items-center justify-center">
                        <HeartHandshake className="w-4 h-4 text-blush-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-court-brown">{t('court.priming.feelings.title')}</h3>
                        <p className="text-[10px] text-court-brownLight">{t('court.priming.feelings.subtitle')}</p>
                    </div>
                </div>
                <div className="rounded-2xl border border-blush-200/60 bg-white/80 p-3 text-sm text-court-brown leading-relaxed">
                    {priming.yourFeelings}
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="glass-card p-4 space-y-3 border-l-4 border-sky-300/70 relative overflow-hidden bg-gradient-to-br from-sky-50/70 via-white/85 to-court-cream/80"
            >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-court-tan/60 to-transparent" />
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-sky-100 flex items-center justify-center">
                        <MessageCircle className="w-4 h-4 text-sky-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-court-brown">{t('court.priming.partnerPerspective.title')}</h3>
                        <p className="text-[10px] text-court-brownLight">{t('court.priming.partnerPerspective.subtitle')}</p>
                    </div>
                </div>
                <div className="rounded-2xl border border-sky-200/60 bg-white/80 p-3 text-sm text-court-brown leading-relaxed">
                    {priming.partnerPerspective}
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-card p-4 space-y-3 relative overflow-hidden bg-gradient-to-br from-lavender-50/70 via-white/85 to-court-cream/80 border border-lavender-100/60"
            >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-court-cream/80 to-transparent" />
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-lavender-100 flex items-center justify-center border border-lavender-200/60">
                        <HelpCircle className="w-4 h-4 text-lavender-700" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-court-brown">{t('court.priming.reflection.title')}</h3>
                        <p className="text-[10px] text-court-brownLight">{t('court.priming.reflection.subtitle')}</p>
                    </div>
                </div>
                <ul className="grid gap-3 sm:grid-cols-2 text-sm text-court-brown">
                    {(priming.reflectionQuestions || []).map((question, index) => (
                        <li key={`${question}-${index}`} className="rounded-2xl border border-lavender-200/60 bg-white/80 p-3 flex gap-3">
                            <span className="w-7 h-7 rounded-full bg-lavender-100 border border-lavender-200/60 flex items-center justify-center text-xs font-bold text-lavender-700">
                                {index + 1}
                            </span>
                            <span className="flex-1">{question}</span>
                        </li>
                    ))}
                </ul>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="glass-card p-4 space-y-3 relative overflow-hidden bg-gradient-to-br from-amber-50/70 via-white/85 to-court-cream/80 border border-amber-100/60"
            >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-court-gold/40 to-transparent" />
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center border border-amber-200/70">
                        <HelpCircle className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-court-brown">
                            {t('court.priming.questionsForPartner.title', { name: displayPartnerName })}
                        </h3>
                        <p className="text-[10px] text-court-brownLight">{t('court.priming.questionsForPartner.subtitle')}</p>
                    </div>
                </div>
                <ul className="grid gap-3 sm:grid-cols-2 text-sm text-court-brown">
                    {(priming.questionsForPartner || []).map((question, index) => (
                        <li key={`${question}-${index}`} className="rounded-2xl border border-amber-200/70 bg-white/80 p-3 flex gap-3">
                            <span className="w-7 h-7 rounded-full bg-amber-100 border border-amber-200/70 flex items-center justify-center text-xs font-bold text-amber-600">
                                {index + 1}
                            </span>
                            <span className="flex-1">{question}</span>
                        </li>
                    ))}
                </ul>
            </motion.div>

            <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={onComplete}
                disabled={isSubmitting}
                className="court-btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed"
            >
                {isSubmitting ? (
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                    />
                ) : (
                    <>
                        <ArrowRight className="w-5 h-5" />
                        {t('court.priming.actions.continue')}
                    </>
                )}
            </motion.button>
        </div>
    );
};

export default PrimingPage;
