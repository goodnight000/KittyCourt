import React, { useState, useEffect, useCallback } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Crown, Gavel, Lock, Star, X } from 'lucide-react';
import useSubscriptionStore from '../../store/useSubscriptionStore';
import Paywall from '../Paywall';
import { useI18n } from '../../i18n';
import StandardButton from '../shared/StandardButton';
import ButtonLoader from '../shared/ButtonLoader';
import { JUDGE_OPTIONS } from '../../lib/judgeMetadata';
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion';

// Floating decorative elements for premium ambiance
// Duration is pre-computed to avoid Math.random() during render
const floatingElements = [
    { Icon: Star, color: 'text-court-gold', size: 'w-3 h-3', left: '5%', top: '8%', delay: 0, duration: 3.5 },
    { Icon: Star, color: 'text-court-goldLight', size: 'w-2.5 h-2.5', left: '90%', top: '15%', delay: 0.6, duration: 4.2 },
    { Icon: Star, color: 'text-court-gold', size: 'w-3.5 h-3.5', left: '92%', top: '55%', delay: 1.2, duration: 3.8 },
    { Icon: Star, color: 'text-lavender-300', size: 'w-2.5 h-2.5', left: '4%', top: '45%', delay: 0.4, duration: 4.5 },
    { Icon: Star, color: 'text-court-goldLight', size: 'w-3 h-3', left: '8%', top: '85%', delay: 1.8, duration: 3.2 },
];

/**
 * Judge Selection Modal
 * Allows users to pick a judge before serving their partner
 * Now includes subscription-based usage limits and gating
 */

const JUDGES = JUDGE_OPTIONS;

const JudgeSelection = ({ isOpen, onClose, onServe }) => {
    const [selectedJudge, setSelectedJudge] = useState(null);
    const [showPaywall, setShowPaywall] = useState(false);
    const [paywallReason, setPaywallReason] = useState(null);
    const [ctaPulse, setCtaPulse] = useState(false);
    const [isServing, setIsServing] = useState(false);
    const { t } = useI18n();
    const prefersReducedMotion = usePrefersReducedMotion();

    const { canUseJudge, getUsageDisplay, isGold, fetchUsage } = useSubscriptionStore();

    // Refresh usage data when modal opens to ensure accurate counts
    useEffect(() => {
        if (isOpen) {
            fetchUsage();
        }
    }, [isOpen, fetchUsage]);

    const getPaywallReason = useCallback((judge) => {
        if (judge.id === 'wise' && !isGold) {
            return t('court.judgeSelection.paywall.bestLocked');
        }
        return t('court.judgeSelection.paywall.limitReached', { judge: t(judge.nameKey) });
    }, [isGold, t]);

    const handleJudgeClick = (judge) => {
        const status = canUseJudge(judge.id);

        if (!status.allowed) {
            setPaywallReason(getPaywallReason(judge));
            setShowPaywall(true);
            return;
        }

        setSelectedJudge(judge.id);
    };

    useEffect(() => {
        if (!selectedJudge) return;
        const status = canUseJudge(selectedJudge);
        if (!status.allowed) {
            const judge = JUDGES.find((item) => item.id === selectedJudge);
            setSelectedJudge(null);
            if (judge) {
                setPaywallReason(getPaywallReason(judge));
                setShowPaywall(true);
            }
        }
    }, [selectedJudge, canUseJudge, getPaywallReason]);

    const handleServe = async () => {
        if (!selectedJudge || isServing) return;

        setIsServing(true);
        try {
            await fetchUsage();
            const status = canUseJudge(selectedJudge);
            if (!status.allowed) {
                const judge = JUDGES.find((item) => item.id === selectedJudge);
                setSelectedJudge(null);
                if (judge) {
                    setPaywallReason(getPaywallReason(judge));
                    setShowPaywall(true);
                }
                return;
            }

            onServe(selectedJudge);
            setSelectedJudge(null);
        } finally {
            setIsServing(false);
        }
    };

    const handleClose = () => {
        setSelectedJudge(null);
        onClose();
    };

    const handlePaywallClose = () => {
        setShowPaywall(false);
        setPaywallReason(null);
    };

    const selectedStatus = selectedJudge ? canUseJudge(selectedJudge) : null;
    const canServe = !!selectedJudge && selectedStatus?.allowed;

    useEffect(() => {
        if (!selectedJudge) return;
        setCtaPulse(true);
        const timer = setTimeout(() => setCtaPulse(false), 450);
        return () => clearTimeout(timer);
    }, [selectedJudge]);

    return (
        <>
            <AnimatePresence>
                {isOpen && (
                    <Motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] flex items-center justify-center p-4 pb-24"
                    >
                        {/* Backdrop */}
                        <Motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                            onClick={handleClose}
                        />

                        {/* Ambient glow blobs */}
                        <div className="absolute -top-16 -right-12 w-48 h-48 rounded-full bg-court-gold/15 blur-3xl pointer-events-none" />
                        <div className="absolute -bottom-16 -left-12 w-56 h-56 rounded-full bg-lavender-200/15 blur-3xl pointer-events-none" />
                        <div className="absolute top-1/3 left-1/4 w-40 h-40 rounded-full bg-blush-200/10 blur-3xl pointer-events-none" />

                        {/* Floating decorative elements */}
                        {!prefersReducedMotion && floatingElements.map((el, i) => {
                            const Icon = el.Icon;
                            return (
                            <Motion.span
                                key={i}
                                animate={{
                                    y: [0, -8, 0],
                                    opacity: [0.3, 0.7, 0.3],
                                    scale: [0.9, 1.1, 0.9],
                                }}
                                transition={{
                                    duration: el.duration,
                                    delay: el.delay,
                                    repeat: Infinity,
                                    ease: "easeInOut",
                                }}
                                className={`absolute drop-shadow-sm pointer-events-none z-10`}
                                style={{ left: el.left, top: el.top }}
                            >
                                <Icon className={`${el.size} ${el.color}`} />
                            </Motion.span>
                        )})}

                        {/* Modal */}
                        <Motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="relative w-full max-w-md glass-card p-5 max-h-[78vh] overflow-y-auto
                                bg-gradient-to-br from-court-cream/60 via-white/90 to-court-tan/30
                                border border-court-gold/15 shadow-xl"
                            style={{ paddingBottom: 'calc(var(--safe-area-bottom) + 16px)' }}
                        >
                            {/* Inner glow effect */}
                            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-court-gold/5 via-transparent to-lavender-100/10 pointer-events-none" />

                            {/* Decorative top border accent */}
                            <div className="absolute inset-x-8 top-0 h-0.5 bg-gradient-to-r from-transparent via-court-gold/30 to-transparent" />
                            {/* Close button */}
                            <button
                                type="button"
                                aria-label={t('common.cancel')}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    handleClose();
                                }}
                                className="absolute top-4 right-4 z-20 p-2 rounded-full hover:bg-court-tan/50 transition-colors"
                            >
                                <X className="w-5 h-5 text-court-brown" />
                            </button>

                            {/* Header */}
                            <div className="relative text-center mb-4 pt-2">
                                {/* Ceremonial gavel icon */}
                                <Motion.div
                                    animate={prefersReducedMotion ? undefined : { rotate: [-3, 3, -3] }}
                                    transition={prefersReducedMotion ? undefined : { duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                                    className="inline-flex items-center justify-center w-12 h-12 mb-3
                                        bg-gradient-to-br from-court-gold/20 via-court-goldLight/10 to-transparent
                                        rounded-full border border-court-gold/20"
                                >
                                    <Gavel className="w-6 h-6 text-court-gold" />
                                </Motion.div>

                                <h2 className="text-xl font-bold text-court-brown mb-1">
                                    {t('court.judgeSelection.title')}
                                </h2>
                                {/* Gold badge - enhanced styling */}
                                {isGold && (
                                    <Motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5
                                            bg-gradient-to-r from-court-gold/15 via-amber-500/10 to-court-goldLight/15
                                            rounded-full border border-court-gold/20 shadow-sm"
                                    >
                                        <Crown className="w-3.5 h-3.5 text-court-gold" />
                                        <span className="text-xs font-semibold text-court-gold tracking-wide">
                                            {t('court.judgeSelection.goldBadge')}
                                        </span>
                                    </Motion.div>
                                )}
                            </div>

                            {/* Judge Cards */}
                            <div className="space-y-3 mb-4">
                                {JUDGES.map((judge) => {
                                    const isSelected = selectedJudge === judge.id;
                                    const IconComponent = judge.icon;
                                    const status = canUseJudge(judge.id);
                                    const isLocked = !status.allowed;
                                    const usageText = getUsageDisplay(judge.id, t);
                                    const judgeName = t(judge.nameKey);

                                    return (
                                        <Motion.button
                                            key={judge.id}
                                            onClick={() => handleJudgeClick(judge)}
                                            whileTap={{ scale: 0.98 }}
                                            animate={isSelected && !isLocked ? { y: -2 } : { y: 0 }}
                                            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                                            className={`w-full p-4 rounded-2xl border-2 text-left transition-all duration-300 relative ${isLocked
                                                ? 'border-court-tan/30 bg-white/30 opacity-75'
                                                : isSelected
                                                    ? `${judge.borderColor} bg-white shadow-lg shadow-court-gold/10`
                                                    : 'border-court-tan/40 bg-white/60 hover:border-court-tan/70 hover:bg-white/90 hover:shadow-md'
                                                }`}
                                        >
                                            {/* Selection glow effect */}
                                            {isSelected && !isLocked && (
                                                <>
                                                    <Motion.div
                                                        layoutId="judgeSelectionHalo"
                                                        transition={{ type: 'spring', stiffness: 240, damping: 24 }}
                                                        className={`absolute inset-0 rounded-2xl border-2 ${judge.borderColor} pointer-events-none`}
                                                    />
                                                    {!prefersReducedMotion && (
                                                    <Motion.div
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: [0.35, 0.6, 0.35], scale: [1, 1.02, 1] }}
                                                        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                                                        className={`absolute inset-0 rounded-2xl ${judge.accentColor}/10 pointer-events-none`}
                                                    />
                                                    )}
                                                </>
                                            )}
                                            <div className="flex items-center gap-4">
                                                {/* Avatar */}
                                                <div className={`relative w-16 h-16 rounded-full overflow-hidden border-2 ${isLocked
                                                    ? 'border-court-tan/50 grayscale'
                                                    : isSelected
                                                        ? judge.borderColor
                                                        : 'border-court-tan'
                                                    }`}>
                                                    <img
                                                        src={judge.avatar}
                                                        alt={t('court.judgeSelection.judgeAlt', { name: judgeName })}
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => {
                                                            e.target.src = '/assets/avatars/judge_whiskers.png';
                                                        }}
                                                    />
                                                    {isSelected && !isLocked && (
                                                        <Motion.div
                                                            initial={{ scale: 0 }}
                                                            animate={{ scale: 1 }}
                                                            className={`absolute inset-0 ${judge.accentColor}/20`}
                                                        />
                                                    )}

                                                    {/* Lock overlay */}
                                                    {isLocked && (
                                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                                            <Lock className="w-5 h-5 text-white" />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className={`font-bold truncate ${isLocked ? 'text-court-brownLight' : 'text-court-brown'}`}>
                                                            {judgeName}
                                                        </h3>
                                                        <IconComponent className={`w-4 h-4 ${isLocked
                                                            ? 'text-court-brownLight/50'
                                                            : isSelected
                                                                ? 'text-court-gold'
                                                                : 'text-court-brownLight'
                                                            }`} />
                                                    </div>
                                                    <p className="text-xs text-court-brownLight mb-1">
                                                        {t(judge.subtitleKey)}
                                                    </p>

                                                    {/* Usage indicator */}
                                                    <div className={`inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 ${isLocked
                                                        ? 'bg-red-50 text-red-600'
                                                        : status.remaining === Infinity
                                                            ? 'bg-court-gold/10 text-court-gold'
                                                            : 'bg-court-tan/50 text-court-brownLight'
                                                        }`}>
                                                        {isLocked && <Lock className="w-3 h-3" />}
                                                        {!isLocked && status.remaining === Infinity && <Crown className="w-3 h-3" />}
                                                        <span>{usageText}</span>
                                                    </div>
                                                </div>

                                                {/* Selection indicator */}
                                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isLocked
                                                    ? 'border-court-tan/30 bg-court-tan/10'
                                                    : isSelected
                                                        ? `${judge.accentColor} border-transparent`
                                                        : 'border-court-tan bg-white'
                                                    }`}>
                                                    {isSelected && !isLocked && (
                                                        <Motion.div
                                                            initial={{ scale: 0 }}
                                                            animate={{ scale: [0, 1.2, 1] }}
                                                            transition={{ duration: 0.35, ease: 'easeOut' }}
                                                            className="w-2 h-2 bg-white rounded-full"
                                                        />
                                                    )}
                                                    {isLocked && (
                                                        <Lock className="w-3 h-3 text-court-brownLight/50" />
                                                    )}
                                                </div>
                                            </div>

                                            {/* Upgrade prompt for locked judges */}
                                            {isLocked && (
                                                <div className="mt-2 pt-2 border-t border-court-tan/30 flex items-center justify-center gap-1">
                                                    <Crown className="w-3 h-3 text-court-gold" />
                                                    <span className="text-xs text-court-gold font-medium">
                                                        {t('court.judgeSelection.upgrade')}
                                                    </span>
                                                </div>
                                            )}
                                        </Motion.button>
                                    );
                                })}
                            </div>

                            {/* Serve Button - Premium Gold Gradient */}
                            <StandardButton
                                type="button"
                                onClick={handleServe}
                                disabled={!canServe || isServing}
                                animate={ctaPulse ? { scale: [1, 1.03, 1] } : { scale: 1 }}
                                transition={{ duration: 0.35, ease: 'easeOut' }}
                                className="relative w-full py-3 overflow-hidden"
                            >
                                {ctaPulse && (
                                    <Motion.span
                                        initial={{ opacity: 0.4, scale: 0.9 }}
                                        animate={{ opacity: 0, scale: 1.35 }}
                                        transition={{ duration: 0.5, ease: 'easeOut' }}
                                        className="absolute inset-0 rounded-full bg-court-gold/25 pointer-events-none"
                                    />
                                )}
                                {/* Button shimmer effect when active */}
                                {canServe && !prefersReducedMotion && (
                                    <Motion.div
                                        animate={{ x: ['-100%', '200%'] }}
                                        transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 4 }}
                                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"
                                    />
                                )}
                                {isServing ? (
                                    <ButtonLoader
                                        size="sm"
                                        tone="white"
                                        className="relative z-10"
                                    />
                                ) : (
                                    <>
                                        <Gavel className="w-5 h-5 relative z-10" />
                                        <span className="relative z-10">
                                            {canServe ? t('court.judgeSelection.serve') : t('court.judgeSelection.selectPrompt')}
                                        </span>
                                    </>
                                )}
                            </StandardButton>
                        </Motion.div>
                    </Motion.div>
                )}
            </AnimatePresence>

            {/* Paywall Modal */}
            <Paywall
                isOpen={showPaywall}
                onClose={handlePaywallClose}
                triggerReason={paywallReason}
            />
        </>
    );
};

export default JudgeSelection;
