import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Clock, ArrowRight, Star } from 'lucide-react';
import { useI18n } from '../../i18n';

const ResolutionSelectPage = ({
    resolutions = [],
    myPick,
    myName,
    partnerName,
    onConfirm,
    isSubmitting,
    mode = 'select',
    myOriginalPickId = null,
    partnerOriginalPickId = null,
    mismatchPick = null,
    hybridResolution = null,
    hybridPending = false
}) => {
    const { t } = useI18n();
    const displayPartnerName = partnerName || t('common.yourPartner');
    const displayMyName = myName || t('common.you');
    const isMismatch = mode === 'mismatch';
    const [pendingPick, setPendingPick] = useState(null);
    const optionLabels = ['A', 'B', 'C'].map((label) => t('court.resolution.optionLabel', { label }));
    const journeySteps = [
        t('court.journey.priming'),
        t('court.journey.joint'),
        t('court.journey.resolution'),
        t('court.journey.verdict')
    ];
    const currentStepIndex = 3;


    const findResolution = (id) => {
        if (!id) return null;
        if (hybridResolution?.id === id) return hybridResolution;
        return resolutions.find((res) => res.id === id);
    };

    useEffect(() => {
        if (isMismatch) {
            setPendingPick(mismatchPick || null);
            return;
        }
        if (mode !== 'select') {
            setPendingPick(null);
            return;
        }
        if (myPick) {
            setPendingPick(myPick);
        }
    }, [isMismatch, mode, myPick, mismatchPick]);

    const selectedId = pendingPick || (isMismatch ? mismatchPick : myPick) || null;
    const selectedResolution = selectedId ? findResolution(selectedId) : null;
    const canConfirm = Boolean(pendingPick) && !isSubmitting && (!isMismatch || pendingPick !== mismatchPick);
    const isMismatchChanging = isMismatch && mismatchPick && pendingPick && pendingPick !== mismatchPick;
    const confirmLabel = useMemo(() => {
        if (isMismatch) {
            if (mismatchPick && !isMismatchChanging) return t('court.resolution.confirm.waiting', { name: displayPartnerName });
            if (!pendingPick) return t('court.resolution.confirm.selectShared');
            return t('court.resolution.confirm.confirmShared');
        }
        if (!pendingPick) return t('court.resolution.confirm.selectPlan');
        return t('court.resolution.confirm.confirmMine');
    }, [isMismatch, pendingPick, mismatchPick, displayPartnerName, isMismatchChanging, t]);

    if (!resolutions.length) {
        return (
            <div className="max-w-md mx-auto glass-card p-4 text-center">
                <p className="text-sm text-court-brown">{t('court.resolution.loadingTitle')}</p>
                <p className="text-xs text-court-brownLight mt-1">{t('court.resolution.loadingSubtitle')}</p>
            </div>
        );
    }


    const renderJourneyMap = () => (
        <div className="sticky top-3 z-10">
            <div className="glass-card p-3 bg-white/80 border border-court-gold/15">
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
    );

    const mismatchOptions = useMemo(() => {
        if (!isMismatch) return [];
        const options = [];
        const seen = new Set();
        const pushById = (id) => {
            if (!id || seen.has(id)) return;
            const resolution = resolutions.find((res) => res.id === id);
            if (!resolution) return;
            options.push(resolution);
            seen.add(id);
        };

        pushById(myOriginalPickId);
        pushById(partnerOriginalPickId);

        if (hybridResolution) {
            options.push(hybridResolution);
        } else if (hybridPending) {
            options.push({
                id: 'resolution_hybrid',
                title: t('court.resolution.hybrid.title'),
                combinedDescription: t('court.resolution.hybrid.description'),
                rationale: t('court.resolution.hybrid.rationale'),
                estimatedDuration: t('court.resolution.hybrid.duration'),
                isPlaceholder: true
            });
        }

        return options;
    }, [isMismatch, myOriginalPickId, partnerOriginalPickId, hybridResolution, hybridPending, resolutions, t]);

    const renderResolutionCard = (resolution, selected, onSelect, badge, disabled = false) => {
        const description = resolution.combinedDescription || resolution.description;
        return (
            <motion.div
                key={resolution.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{
                    opacity: 1,
                    y: 0,
                    scale: selected ? 1.02 : 1
                }}
                transition={{
                    scale: { type: 'spring', stiffness: 400, damping: 25 }
                }}
                whileTap={!disabled ? { scale: 0.98 } : undefined}
                className={`glass-card p-4 space-y-3 border-2 relative overflow-hidden cursor-pointer ${
                    selected ? 'border-green-500/80 bg-white animate-glow-green' : 'border-court-gold/15 bg-white/85'
                } ${disabled ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
                <div
                    className={`absolute inset-x-0 top-0 h-1 ${selected ? 'bg-green-500/70' : 'bg-gradient-to-r from-court-gold/60 via-court-tan/40 to-transparent'
                        }`}
                />
                {badge && (
                    <div className="text-[10px] font-bold text-court-brownLight uppercase tracking-wide">
                        {badge}
                    </div>
                )}
                <button
                    onClick={() => onSelect?.(resolution.id)}
                    className="relative text-left w-full space-y-3"
                    type="button"
                    disabled={disabled}
                >
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h3 className="text-sm font-bold text-court-brown">{resolution.title}</h3>
                            <div className="flex items-center gap-2 text-[11px] text-court-brownLight mt-1">
                                <Clock className="w-3 h-3" />
                                <span>{resolution.estimatedDuration}</span>
                            </div>
                        </div>
                        {selected && (
                            <motion.div
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{
                                    type: 'spring',
                                    stiffness: 500,
                                    damping: 15,
                                    delay: 0.05
                                }}
                                className="flex items-center gap-1 text-xs font-bold text-green-600"
                            >
                                <CheckCircle className="w-4 h-4" />
                                {t('court.resolution.selected')}
                            </motion.div>
                        )}
                    </div>
                    <p className="text-sm text-court-brown leading-relaxed">
                        {description}
                    </p>
                    <p className="text-xs text-court-brownLight italic">
                        {resolution.rationale}
                    </p>
                </button>
            </motion.div>
        );
    };

    const myResolution = myPick ? findResolution(myPick) : null;

    if (mode === 'waiting') {
        return (
            <div className="max-w-2xl mx-auto space-y-5 pb-6 relative">
                <motion.div
                    aria-hidden
                    animate={{ opacity: [0.25, 0.45, 0.25], y: [0, -6, 0] }}
                    transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute -top-12 -right-8 w-32 h-32 rounded-full bg-court-gold/15 blur-2xl pointer-events-none"
                />
                {renderJourneyMap()}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card p-5 bg-gradient-to-br from-court-ivory via-white/95 to-court-tan/40 text-center relative overflow-hidden border border-court-gold/15"
                >
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-court-gold/60 to-transparent" />
                    <h2 className="text-lg font-bold text-court-brown">{t('court.resolution.waiting.title')}</h2>
                    <p className="text-sm text-court-brownLight">{t('court.resolution.waiting.subtitle', { name: displayPartnerName })}</p>
                </motion.div>
                {myResolution && renderResolutionCard(myResolution, true, null, t('court.resolution.waiting.badge'), true)}
            </div>
        );
    }

    const headerTitle = isMismatch
        ? t('court.resolution.header.mismatchTitle')
        : t('court.resolution.header.title');
    const headerSubtitle = isMismatch
        ? t('court.resolution.header.mismatchSubtitle')
        : t('court.resolution.header.subtitle');

    const resolutionList = isMismatch ? mismatchOptions : resolutions;

    const resolveBadge = (resolution, index) => {
        if (!isMismatch) return optionLabels[index] || t('court.resolution.optionNumber', { count: index + 1 });
        if (resolution.id === myOriginalPickId) return t('court.resolution.badges.picked', { name: displayMyName });
        if (resolution.id === partnerOriginalPickId) return t('court.resolution.badges.picked', { name: displayPartnerName });
        return t('court.resolution.badges.blended');
    };

    return (
        <div className="max-w-2xl mx-auto space-y-5 pb-6 relative">
            <motion.div
                aria-hidden
                animate={{ opacity: [0.2, 0.4, 0.2], scale: [1, 1.05, 1] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -top-10 -left-10 w-32 h-32 rounded-full bg-mint-200/20 blur-2xl pointer-events-none"
            />
            <motion.div
                aria-hidden
                animate={{ opacity: [0.25, 0.45, 0.25], y: [0, -6, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute top-1/3 -right-10 w-36 h-36 rounded-full bg-court-gold/15 blur-2xl pointer-events-none"
            />
            {renderJourneyMap()}

            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-5 bg-gradient-to-br from-court-ivory via-white/95 to-court-tan/40 relative overflow-hidden border border-court-gold/15"
            >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-court-gold/70 via-court-tan/40 to-transparent" />
                <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-court-gold/15 flex items-center justify-center">
                        <CheckCircle className="w-6 h-6 text-court-gold" />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-lg font-bold text-court-brown">{headerTitle}</h2>
                        <p className="text-sm text-court-brownLight">
                            {headerSubtitle}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-court-brownLight">
                            <span className="inline-flex items-center gap-1 rounded-full border border-court-tan/40 bg-white/60 px-2 py-1">
                                <Star className="w-3 h-3 text-court-gold" />
                                {t('court.resolution.header.alignTogether')}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full border border-court-tan/40 bg-white/60 px-2 py-1">
                                <Clock className="w-3 h-3 text-court-brown" />
                                {t('court.resolution.header.pickConfirm')}
                            </span>
                        </div>
                    </div>
                </div>
            </motion.div>

            {isMismatch && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="glass-card p-4 space-y-2 border-l-4 border-court-gold/50 relative overflow-hidden bg-white/80"
                >
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-court-gold/60 to-transparent" />
                    <p className="text-sm font-semibold text-court-brown">
                        {t('court.resolution.mismatch.intro', { name: displayPartnerName })}
                    </p>
                    <p className="text-xs text-court-brownLight">
                        {t('court.resolution.mismatch.hint')}
                    </p>
                </motion.div>
            )}

            {isMismatch && mismatchPick && !isMismatchChanging && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 }}
                    className="glass-card p-4 border border-court-tan/30 bg-white/85 flex items-center gap-3 relative overflow-hidden"
                >
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-green-500/60 to-transparent" />
                    <div className="w-9 h-9 rounded-xl bg-court-cream flex items-center justify-center border border-court-tan/30">
                        <Clock className="w-4 h-4 text-court-brown" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-court-brown">{t('court.resolution.mismatch.lockedTitle')}</p>
                        <p className="text-xs text-court-brownLight">{t('court.resolution.mismatch.lockedSubtitle', { name: displayPartnerName })}</p>
                    </div>
                </motion.div>
            )}

            <div className="space-y-4">
                {resolutionList.map((resolution, index) => {
                    const isPlaceholder = !!resolution.isPlaceholder;
                    const badge = resolveBadge(resolution, index);
                    return renderResolutionCard(
                        resolution,
                        selectedId === resolution.id,
                        isPlaceholder ? null : setPendingPick,
                        badge,
                        isPlaceholder
                    );
                })}
            </div>

            <div className="glass-card p-4 space-y-3 relative overflow-hidden bg-white/85 border border-court-tan/30">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-court-gold/60 to-transparent" />
                {selectedResolution ? (
                    <div className="text-xs text-court-brownLight">
                        {t('court.resolution.selectionLabel', { title: selectedResolution.title })}
                    </div>
                ) : (
                    <div className="text-xs text-court-brownLight">
                        {t('court.resolution.selectionHint')}
                    </div>
                )}
                <motion.button
                    whileHover={{ scale: canConfirm ? 1.01 : 1 }}
                    whileTap={{ scale: canConfirm ? 0.98 : 1 }}
                    onClick={() => onConfirm?.(pendingPick)}
                    disabled={!canConfirm}
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
                            {confirmLabel}
                        </>
                    )}
                </motion.button>
            </div>
        </div>
    );
};

export default ResolutionSelectPage;
