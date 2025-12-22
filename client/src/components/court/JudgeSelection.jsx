import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Gavel, Zap, Scale, Sparkles, Lock, Crown } from 'lucide-react';
import useSubscriptionStore from '../../store/useSubscriptionStore';
import Paywall from '../Paywall';

/**
 * Judge Selection Modal
 * Allows users to pick a judge before serving their partner
 * Now includes subscription-based usage limits and gating
 */

const JUDGES = [
    {
        id: 'fast',
        name: 'Judge Lightning',
        subtitle: 'Quick Verdicts',
        description: 'Swift and efficient. Perfect for timely resolutions.',
        model: 'DeepSeek v3.2',
        avatar: '/assets/avatars/judge_fast.png',
        accentColor: 'bg-blue-500',
        borderColor: 'border-blue-400',
        icon: Zap
    },
    {
        id: 'logical',
        name: 'Judge Mittens',
        subtitle: 'The Logical Judge',
        description: 'Balanced and methodical. Works for any case size.',
        model: 'Kimi K2',
        avatar: '/assets/avatars/judge_logical.png',
        accentColor: 'bg-emerald-500',
        borderColor: 'border-emerald-400',
        icon: Scale
    },
    {
        id: 'best',
        name: 'Judge Whiskers',
        subtitle: 'The Best Judge',
        description: 'Empathic, logical, and experienced. Only for the most heated cases.',
        model: 'Opus 4.5',
        avatar: '/assets/avatars/judge_whiskers.png',
        accentColor: 'bg-amber-500',
        borderColor: 'border-amber-400',
        icon: Gavel
    }

];

const JudgeSelection = ({ isOpen, onClose, onServe }) => {
    const [selectedJudge, setSelectedJudge] = useState(null);
    const [showPaywall, setShowPaywall] = useState(false);
    const [paywallReason, setPaywallReason] = useState(null);

    const { canUseJudge, getUsageDisplay, isGold, isLoading, fetchUsage } = useSubscriptionStore();

    // Refresh usage data when modal opens to ensure accurate counts
    useEffect(() => {
        if (isOpen) {
            fetchUsage();
        }
    }, [isOpen, fetchUsage]);

    const handleJudgeClick = (judge) => {
        const status = canUseJudge(judge.id);

        if (!status.allowed) {
            // Show paywall with reason
            if (judge.id === 'best' && !isGold) {
                setPaywallReason('Judge Whiskers is exclusive to Pause Gold members');
            } else {
                setPaywallReason(`You've used all your ${judge.name} rulings this month`);
            }
            setShowPaywall(true);
            return;
        }

        setSelectedJudge(judge.id);
    };

    const handleServe = () => {
        if (selectedJudge) {
            onServe(selectedJudge);
            setSelectedJudge(null);
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

    return (
        <>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    >
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                            onClick={handleClose}
                        />

                        {/* Modal */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="relative w-full max-w-md glass-card p-6 max-h-[90vh] overflow-y-auto"
                        >
                            {/* Close button */}
                            <button
                                onClick={handleClose}
                                className="absolute top-4 right-4 p-2 rounded-full hover:bg-court-tan/50 transition-colors"
                            >
                                <X className="w-5 h-5 text-court-brown" />
                            </button>

                            {/* Header */}
                            <div className="text-center mb-6">
                                <div className="inline-flex items-center gap-2 mb-2">
                                    <h2 className="text-xl font-bold text-court-brown">
                                        Choose Your Judge!
                                    </h2>
                                </div>
                                <p className="text-sm text-court-brownLight">
                                    Select a judge to preside over your case
                                </p>

                                {/* Gold badge */}
                                {isGold && (
                                    <div className="inline-flex items-center gap-1 mt-2 px-2 py-1 bg-gradient-to-r from-court-gold/20 to-amber-500/20 rounded-full">
                                        <Crown className="w-3 h-3 text-court-gold" />
                                        <span className="text-xs font-medium text-court-gold">Pause Gold</span>
                                    </div>
                                )}
                            </div>

                            {/* Judge Cards */}
                            <div className="space-y-3 mb-6">
                                {JUDGES.map((judge) => {
                                    const isSelected = selectedJudge === judge.id;
                                    const IconComponent = judge.icon;
                                    const status = canUseJudge(judge.id);
                                    const isLocked = !status.allowed;
                                    const usageText = getUsageDisplay(judge.id);

                                    return (
                                        <motion.button
                                            key={judge.id}
                                            onClick={() => handleJudgeClick(judge)}
                                            whileTap={{ scale: 0.98 }}
                                            className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-200 relative ${isLocked
                                                ? 'border-court-tan/30 bg-white/30 opacity-75'
                                                : isSelected
                                                    ? `${judge.borderColor} bg-white shadow-lg`
                                                    : 'border-court-tan/50 bg-white/50 hover:border-court-tan hover:bg-white/80'
                                                }`}
                                        >
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
                                                        alt={judge.name}
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => {
                                                            e.target.src = '/assets/avatars/judge_whiskers.png';
                                                        }}
                                                    />
                                                    {isSelected && !isLocked && (
                                                        <motion.div
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
                                                            {judge.name}
                                                        </h3>
                                                        <IconComponent className={`w-4 h-4 ${isLocked
                                                            ? 'text-court-brownLight/50'
                                                            : isSelected
                                                                ? 'text-court-gold'
                                                                : 'text-court-brownLight'
                                                            }`} />
                                                    </div>
                                                    <p className="text-xs text-court-brownLight mb-1">
                                                        {judge.subtitle}
                                                    </p>

                                                    {/* Usage indicator */}
                                                    <div className={`inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 ${isLocked
                                                        ? 'bg-red-50 text-red-600'
                                                        : status.remaining === Infinity
                                                            ? 'bg-court-gold/10 text-court-gold'
                                                            : 'bg-court-tan/50 text-court-brownLight'
                                                        }`}>
                                                        {isLocked && <Lock className="w-3 h-3" />}
                                                        {!isLocked && status.remaining === Infinity && <Sparkles className="w-3 h-3" />}
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
                                                        <motion.div
                                                            initial={{ scale: 0 }}
                                                            animate={{ scale: 1 }}
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
                                                        Upgrade to Pause Gold
                                                    </span>
                                                </div>
                                            )}
                                        </motion.button>
                                    );
                                })}
                            </div>

                            {/* Serve Button */}
                            <motion.button
                                onClick={handleServe}
                                disabled={!selectedJudge}
                                whileTap={selectedJudge ? { scale: 0.98 } : {}}
                                className={`w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all duration-300 ${selectedJudge
                                    ? 'btn-primary shadow-lg'
                                    : 'bg-court-tan/50 cursor-not-allowed text-court-brownLight'
                                    }`}
                            >
                                <Gavel className="w-5 h-5" />
                                {selectedJudge ? 'Serve Your Partner' : 'Select a Judge'}
                            </motion.button>

                            {/* Cancel link */}
                            <button
                                onClick={handleClose}
                                className="w-full mt-3 py-2 text-sm text-court-brownLight hover:text-court-brown transition-colors"
                            >
                                Cancel
                            </button>
                        </motion.div>
                    </motion.div>
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
