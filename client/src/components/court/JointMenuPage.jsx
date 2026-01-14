import React from 'react';
import { motion } from 'framer-motion';
import { Users, Star, Heart, Leaf, ArrowRight, Clock } from 'lucide-react';
import { useI18n } from '../../i18n';
import JourneyProgress from './JourneyProgress';

const JointMenuPage = ({ jointMenu, myName, partnerName, isCreator, onReady, isSubmitting }) => {
    const { t } = useI18n();
    const displayPartnerName = partnerName || t('common.partner');
    const displayMyName = myName || t('common.you');
    if (!jointMenu) {
        return (
            <div className="max-w-md mx-auto glass-card p-4 text-center">
                <p className="text-sm text-court-brown">{t('court.jointMenu.loadingTitle')}</p>
                <p className="text-xs text-court-brownLight mt-1">{t('court.jointMenu.loadingSubtitle')}</p>
            </div>
        );
    }

    const myKey = isCreator ? 'userA' : 'userB';
    const partnerKey = isCreator ? 'userB' : 'userA';

    return (
        <div className="max-w-2xl mx-auto space-y-5 pb-6 relative">
            <motion.div
                aria-hidden
                animate={{ opacity: [0.25, 0.45, 0.25], y: [0, -6, 0] }}
                transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -top-12 -right-8 w-32 h-32 rounded-full bg-court-gold/15 blur-2xl pointer-events-none"
            />
            <motion.div
                aria-hidden
                animate={{ opacity: [0.2, 0.4, 0.2], scale: [1, 1.05, 1] }}
                transition={{ duration: 6.2, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute top-1/3 -left-10 w-36 h-36 rounded-full bg-mint-200/20 blur-2xl pointer-events-none"
            />
            <JourneyProgress currentStep={2} />
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-5 bg-gradient-to-br from-court-ivory via-white/95 to-court-tan/40 relative overflow-hidden border border-court-gold/15"
            >
                <div className="absolute -top-12 -right-8 w-32 h-32 rounded-full bg-court-gold/10 blur-2xl" />
                <div className="absolute -bottom-12 -left-8 w-40 h-40 rounded-full bg-court-tan/20 blur-2xl" />
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-court-gold/60 to-transparent" />
                <div className="flex items-start gap-3 relative">
                    <div className="w-12 h-12 rounded-2xl bg-court-gold/15 flex items-center justify-center">
                        <Users className="w-6 h-6 text-court-gold" />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-lg font-bold text-court-brown">{t('court.jointMenu.header.title')}</h2>
                        <p className="text-sm text-court-brownLight">
                            {t('court.jointMenu.header.subtitle')}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-court-brownLight">
                            <span className="inline-flex items-center gap-1 rounded-full border border-court-tan/40 bg-white/60 px-2 py-1">
                                <Users className="w-3 h-3 text-court-gold" />
                                {t('court.jointMenu.header.badges.together')}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full border border-court-tan/40 bg-white/60 px-2 py-1">
                                <Clock className="w-3 h-3 text-court-brown" />
                                {t('court.jointMenu.header.badges.readTime')}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full border border-court-tan/40 bg-white/60 px-2 py-1">
                                <Star className="w-3 h-3 text-court-gold" />
                                {t('court.jointMenu.header.badges.shared')}
                            </span>
                        </div>
                    </div>
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-card p-4 space-y-3 border-l-4 border-court-gold/50 relative overflow-hidden bg-gradient-to-br from-court-cream/70 via-white/85 to-court-tan/30"
            >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-court-gold/60 to-transparent" />
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-court-gold/20 flex items-center justify-center">
                        <Star className="w-4 h-4 text-court-gold" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-court-brown">{t('court.jointMenu.realIssue.title')}</h3>
                        <p className="text-[10px] text-court-brownLight">{t('court.jointMenu.realIssue.subtitle')}</p>
                    </div>
                </div>
                <div className="rounded-2xl border border-court-tan/30 bg-white/80 p-3 text-sm text-court-brown leading-relaxed">
                    {jointMenu.theSummary}
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="glass-card p-4 space-y-4 relative overflow-hidden bg-gradient-to-br from-green-50/70 via-white/85 to-emerald-50/70 border border-green-100/70"
            >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-green-400/70 to-transparent" />
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center">
                        <Heart className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-court-brown">{t('court.jointMenu.goodStuff.title')}</h3>
                        <p className="text-[10px] text-court-brownLight">{t('court.jointMenu.goodStuff.subtitle')}</p>
                    </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-green-50/70 border border-green-100 p-3">
                        <p className="text-xs font-bold text-green-700">{displayMyName}</p>
                        <p className="text-sm text-court-brown mt-1">{jointMenu.theGoodStuff?.[myKey]}</p>
                    </div>
                    <div className="rounded-2xl bg-green-50/70 border border-green-100 p-3">
                        <p className="text-xs font-bold text-green-700">{displayPartnerName}</p>
                        <p className="text-sm text-court-brown mt-1">{jointMenu.theGoodStuff?.[partnerKey]}</p>
                    </div>
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-card p-4 space-y-4 relative overflow-hidden bg-gradient-to-br from-sky-50/70 via-white/85 to-court-cream/80 border border-sky-100/60"
            >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-court-tan/70 to-transparent" />
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-court-tan/40 flex items-center justify-center">
                        <Leaf className="w-4 h-4 text-court-brown" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-court-brown">{t('court.jointMenu.growthEdges.title')}</h3>
                        <p className="text-[10px] text-court-brownLight">{t('court.jointMenu.growthEdges.subtitle')}</p>
                    </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-white/70 border border-court-tan/40 p-3">
                        <p className="text-xs font-bold text-court-brown">{displayMyName}</p>
                        <p className="text-sm text-court-brown mt-1">{jointMenu.theGrowthEdges?.[myKey]}</p>
                    </div>
                    <div className="rounded-2xl bg-white/70 border border-court-tan/40 p-3">
                        <p className="text-xs font-bold text-court-brown">{displayPartnerName}</p>
                        <p className="text-sm text-court-brown mt-1">{jointMenu.theGrowthEdges?.[partnerKey]}</p>
                    </div>
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="glass-card p-4 space-y-3 border-l-4 border-court-gold/50 relative overflow-hidden bg-gradient-to-br from-amber-50/70 via-white/85 to-court-cream/80 border border-amber-100/60"
            >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-court-gold/60 to-transparent" />
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-court-gold/10 flex items-center justify-center border border-court-gold/20">
                        <Star className="w-4 h-4 text-court-gold" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-court-brown">{t('court.jointMenu.resolutionPreview.title')}</h3>
                        <p className="text-[10px] text-court-brownLight">{t('court.jointMenu.resolutionPreview.subtitle')}</p>
                    </div>
                </div>
                <div className="rounded-2xl border border-court-gold/20 bg-court-cream/60 p-3 text-sm text-court-brown leading-relaxed">
                    {jointMenu.resolutionPreview}
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="glass-card p-4 text-center bg-gradient-to-br from-court-ivory via-white/95 to-court-tan/30 border border-court-tan/30 relative overflow-hidden"
            >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-court-tan/60 to-transparent" />
                <div className="text-[10px] uppercase font-bold text-court-brownLight tracking-wide mb-2">
                    {t('court.jointMenu.closing.label')}
                </div>
                <p className="text-sm text-court-brown italic">"{jointMenu.closingWisdom}"</p>
            </motion.div>

            <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={onReady}
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
                        {t('court.jointMenu.actions.continue')}
                    </>
                )}
            </motion.button>
        </div>
    );
};

export default JointMenuPage;
