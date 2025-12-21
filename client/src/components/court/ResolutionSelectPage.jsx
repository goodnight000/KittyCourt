import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Clock, ArrowRight, Sparkles } from 'lucide-react';

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
    const displayPartnerName = partnerName || 'your partner';
    const displayMyName = myName || 'You';
    const isMismatch = mode === 'mismatch';
    const [pendingPick, setPendingPick] = useState(null);
    const [scrollProgress, setScrollProgress] = useState(0);
    const optionLabels = ['Option A', 'Option B', 'Option C'];
    const journeySteps = ['Evidence', 'Priming', 'Joint', 'Resolution', 'Verdict'];
    const currentStepIndex = 3;

    useEffect(() => {
        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
            const total = scrollHeight - clientHeight;
            const progress = total > 0 ? Math.min(1, Math.max(0, scrollTop / total)) : 0;
            setScrollProgress(progress);
        };
        handleScroll();
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

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
            if (mismatchPick && !isMismatchChanging) return `Waiting for ${displayPartnerName} to confirm`;
            if (!pendingPick) return 'Select a shared resolution';
            return 'Confirm this resolution';
        }
        if (!pendingPick) return 'Select a plan to continue';
        return 'Confirm my selection';
    }, [isMismatch, pendingPick, mismatchPick, displayPartnerName, isMismatchChanging]);

    if (!resolutions.length) {
        return (
            <div className="max-w-md mx-auto glass-card p-4 text-center">
                <p className="text-sm text-court-brown">Resolutions are still loading.</p>
                <p className="text-xs text-court-brownLight mt-1">Please wait a moment.</p>
            </div>
        );
    }

    const renderProgress = () => (
        <div className="sticky top-0 z-20">
            <div className="h-1 w-full rounded-full bg-white/70 overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-court-gold via-court-tan to-court-brown"
                    style={{ width: `${Math.round(scrollProgress * 100)}%` }}
                />
            </div>
        </div>
    );

    const renderJourneyMap = () => (
        <div className="sticky top-3 z-10">
            <div className="glass-card p-3 bg-white/70 border border-court-tan/30">
                <div className="text-[10px] uppercase tracking-[0.2em] text-court-brownLight">
                    Journey map
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
                                <span className={`text-[11px] font-semibold ${isActive ? 'text-court-brown' : 'text-court-brownLight'}`}>
                                    {step}
                                </span>
                                {index < journeySteps.length - 1 && <span className="h-px w-6 bg-court-tan/40" />}
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
                title: 'Blended option in progress',
                combinedDescription: 'We are drafting a blended plan that honors both choices.',
                rationale: 'This option will appear shortly.',
                estimatedDuration: '10-20 minutes',
                isPlaceholder: true
            });
        }

        return options;
    }, [isMismatch, myOriginalPickId, partnerOriginalPickId, hybridResolution, hybridPending, resolutions]);

    const renderResolutionCard = (resolution, selected, onSelect, badge, disabled = false) => {
        const description = resolution.combinedDescription || resolution.description;
        return (
            <motion.div
                key={resolution.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`glass-card p-4 space-y-3 border-2 relative overflow-hidden ${
                    selected ? 'border-green-500/80 bg-white' : 'border-court-tan/30 bg-white/70'
                } ${disabled ? 'opacity-70' : ''}`}
            >
                <div
                    className={`absolute inset-x-0 top-0 h-1 ${
                        selected ? 'bg-green-500/70' : 'bg-gradient-to-r from-court-gold/60 via-court-tan/40 to-transparent'
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
                            <div className="flex items-center gap-1 text-xs font-bold text-green-600">
                                <CheckCircle className="w-4 h-4" />
                                Selected
                            </div>
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
            <div className="max-w-2xl mx-auto space-y-5 pb-6">
                {renderProgress()}
                {renderJourneyMap()}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card p-5 bg-gradient-to-br from-court-cream to-court-tan/30 text-center relative overflow-hidden"
                >
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-court-gold/60 to-transparent" />
                    <h2 className="text-lg font-bold text-court-brown">Choice Recorded</h2>
                    <p className="text-sm text-court-brownLight">Waiting for {displayPartnerName} to choose.</p>
                </motion.div>
                {myResolution && renderResolutionCard(myResolution, true, null, 'Your pick', true)}
            </div>
        );
    }

    const headerTitle = isMismatch ? 'Find a shared resolution' : 'Pick a Resolution';
    const headerSubtitle = isMismatch
        ? 'You chose different paths. Select one option together to move forward.'
        : 'Choose the option that feels most workable to you.';

    const resolutionList = isMismatch ? mismatchOptions : resolutions;

    const resolveBadge = (resolution, index) => {
        if (!isMismatch) return optionLabels[index] || `Option ${index + 1}`;
        if (resolution.id === myOriginalPickId) return `${displayMyName} picked`;
        if (resolution.id === partnerOriginalPickId) return `${displayPartnerName} picked`;
        return 'Blended option';
    };

    return (
        <div className="max-w-2xl mx-auto space-y-5 pb-6">
            {renderProgress()}
            {renderJourneyMap()}

            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-5 bg-gradient-to-br from-court-cream to-court-tan/30 relative overflow-hidden"
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
                                <Sparkles className="w-3 h-3 text-court-gold" />
                                Align together
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full border border-court-tan/40 bg-white/60 px-2 py-1">
                                <Clock className="w-3 h-3 text-court-brown" />
                                Pick + confirm
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
                    className="glass-card p-4 space-y-2 border-l-4 border-court-gold/40 relative overflow-hidden"
                >
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-court-gold/60 to-transparent" />
                    <p className="text-sm font-semibold text-court-brown">
                        Your first pick and {displayPartnerName}'s first pick are listed below.
                    </p>
                    <p className="text-xs text-court-brownLight">
                        Choose the same resolution to continue. A blended option will appear if generated.
                    </p>
                </motion.div>
            )}

            {isMismatch && mismatchPick && !isMismatchChanging && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 }}
                    className="glass-card p-4 border border-court-tan/30 bg-white/70 flex items-center gap-3 relative overflow-hidden"
                >
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-green-500/60 to-transparent" />
                    <div className="w-9 h-9 rounded-xl bg-court-cream flex items-center justify-center border border-court-tan/30">
                        <Clock className="w-4 h-4 text-court-brown" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-court-brown">Choice locked in</p>
                        <p className="text-xs text-court-brownLight">Waiting for {displayPartnerName} to match it.</p>
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

            <div className="glass-card p-4 space-y-3 relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-court-gold/60 to-transparent" />
                {selectedResolution ? (
                    <div className="text-xs text-court-brownLight">
                        You are selecting: <span className="font-semibold text-court-brown">{selectedResolution.title}</span>
                    </div>
                ) : (
                    <div className="text-xs text-court-brownLight">
                        Choose one option above to continue.
                    </div>
                )}
                <motion.button
                    whileHover={{ scale: canConfirm ? 1.01 : 1 }}
                    whileTap={{ scale: canConfirm ? 0.98 : 1 }}
                    onClick={() => onConfirm?.(pendingPick)}
                    disabled={!canConfirm}
                    className="w-full py-2.5 px-4 rounded-xl text-white font-extrabold flex items-center justify-center gap-2
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
                            {confirmLabel}
                        </>
                    )}
                </motion.button>
            </div>
        </div>
    );
};

export default ResolutionSelectPage;
