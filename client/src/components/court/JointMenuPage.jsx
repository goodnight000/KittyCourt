import React from 'react';
import { motion } from 'framer-motion';
import { Users, Sparkles, Heart, Leaf, ArrowRight, Clock } from 'lucide-react';
import { useI18n } from '../../i18n';

const JointMenuPage = ({ jointMenu, myName, partnerName, isCreator, onReady, isSubmitting }) => {
    const { t } = useI18n();
    const displayPartnerName = partnerName || t('common.partner');
    const displayMyName = myName || t('common.you');
    const journeySteps = [
        t('court.journey.priming'),
        t('court.journey.joint'),
        t('court.journey.resolution'),
        t('court.journey.verdict')
    ];
    const currentStepIndex = 2;

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
        <div className="max-w-2xl mx-auto space-y-5 pb-6">
            <div className="sticky top-3 z-10">
                <div className="glass-card p-3 bg-white/70 border border-court-tan/30">
                    <div className="text-[12px] uppercase tracking-[0.2em] text-court-brownLight">
                        {t('court.journey.title')}
                    </div>
                    <div className="mt-2 flex items-center gap-3 overflow-x-auto">
                        {journeySteps.map((step, index) => {
                            const isActive = index === currentStepIndex;
                            const isComplete = index < currentStepIndex;
                            return (
                                <div key={step} className="flex items-center gap-2 shrink-0">
                                    <span
                                        className={`w-2 h-2 rounded-full ${isActive ? 'bg-court-gold' : isComplete ? 'bg-green-500/80' : 'bg-court-tan/40'}`}
                                    />
                                    <span className={`text-[12px] font-semibold ${isActive ? 'text-court-brown' : 'text-court-brownLight'}`}>
                                        {step}
                                    </span>
                                    {index < journeySteps.length - 1 && <span className="h-px w-12 bg-court-tan/40" />}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-5 bg-gradient-to-br from-court-cream to-court-tan/30 relative overflow-hidden"
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
                                <Sparkles className="w-3 h-3 text-court-gold" />
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
                className="glass-card p-4 space-y-3 border-l-4 border-court-gold/40 relative overflow-hidden"
            >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-court-gold/60 to-transparent" />
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-court-gold/20 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-court-gold" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-court-brown">{t('court.jointMenu.realIssue.title')}</h3>
                        <p className="text-[10px] text-court-brownLight">{t('court.jointMenu.realIssue.subtitle')}</p>
                    </div>
                </div>
                <div className="rounded-2xl border border-court-tan/30 bg-white/70 p-3 text-sm text-court-brown leading-relaxed">
                    {jointMenu.theSummary}
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="glass-card p-4 space-y-4 relative overflow-hidden"
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
                className="glass-card p-4 space-y-4 relative overflow-hidden"
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
                className="glass-card p-4 space-y-3 border-l-4 border-court-gold/40 relative overflow-hidden"
            >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-court-gold/60 to-transparent" />
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-court-gold/10 flex items-center justify-center border border-court-gold/20">
                        <Sparkles className="w-4 h-4 text-court-gold" />
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
                className="glass-card p-4 text-center bg-gradient-to-br from-court-cream to-court-tan/20 border border-court-tan/30 relative overflow-hidden"
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
                className="w-full py-3 px-4 rounded-xl text-white font-extrabold flex items-center justify-center gap-2
                    disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                style={{ background: 'linear-gradient(135deg, #1c1c84 0%, #000035 100%)' }}
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
