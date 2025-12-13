import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Crown, Zap, Scale, Gavel, Wand2, Check, Sparkles, Lock } from 'lucide-react';
import useSubscriptionStore from '../store/useSubscriptionStore';

/**
 * Paywall Modal
 * 
 * Premium upgrade modal showcasing Pause Gold benefits.
 * Matches the app's "cute, premium, luxurious" aesthetic.
 */
const Paywall = ({ isOpen, onClose, triggerReason = null }) => {
    const { purchaseGold, restorePurchases, isLoading } = useSubscriptionStore();
    const [restoring, setRestoring] = useState(false);
    const [error, setError] = useState(null);

    const handlePurchase = async () => {
        setError(null);
        const result = await purchaseGold();

        if (result.success) {
            onClose();
        } else if (result.error) {
            setError(result.error);
        }
        // If cancelled, just stay open
    };

    const handleRestore = async () => {
        setRestoring(true);
        setError(null);

        const result = await restorePurchases();
        setRestoring(false);

        if (result.success && result.isGold) {
            onClose();
        } else if (!result.isGold) {
            setError('No previous purchase found');
        } else if (result.error) {
            setError(result.error);
        }
    };

    const features = [
        {
            icon: Zap,
            title: 'Judge Lightning',
            free: '3/month',
            gold: 'Unlimited ✨',
            color: 'text-blue-500',
        },
        {
            icon: Scale,
            title: 'Judge Mittens',
            free: '1/month',
            gold: '100/month',
            color: 'text-emerald-500',
        },
        {
            icon: Gavel,
            title: 'Judge Whiskers',
            free: 'Locked 🔒',
            gold: '10/month',
            color: 'text-amber-500',
        },
        {
            icon: Wand2,
            title: 'Help Me Plan',
            free: 'Locked 🔒',
            gold: 'Unlimited ✨',
            color: 'text-purple-500',
        },
    ];

    return (
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
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="relative w-full max-w-md glass-card p-6 max-h-[90vh] overflow-y-auto"
                    >
                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-2 rounded-full hover:bg-court-tan/50 transition-colors"
                        >
                            <X className="w-5 h-5 text-court-brown" />
                        </button>

                        {/* Header */}
                        <div className="text-center mb-6">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.1, type: 'spring' }}
                                className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-court-gold to-amber-600 mb-4"
                            >
                                <Crown className="w-8 h-8 text-white" />
                            </motion.div>

                            <h2 className="text-2xl font-bold text-court-brown flex items-center justify-center gap-2">
                                Invest in "Us"
                            </h2>

                            <p className="text-sm text-court-brownLight mt-2">
                                The toolkit happy couples use to stop fighting, deepen connection, and keep their promises of forever.
                            </p>

                            {/* Trigger reason */}
                            {triggerReason && (
                                <p className="text-xs text-amber-600 mt-2 bg-amber-50 rounded-lg px-3 py-1 inline-block">
                                    {triggerReason}
                                </p>
                            )}
                        </div>

                        {/* Feature Comparison */}
                        <div className="bg-white/50 rounded-xl p-4 mb-6">
                            <div className="grid grid-cols-3 gap-2 text-xs font-medium text-court-brownLight mb-3">
                                <div></div>
                                <div className="text-center">Free</div>
                                <div className="text-center text-court-gold">Gold</div>
                            </div>

                            <div className="space-y-3">
                                {features.map((feature, index) => (
                                    <motion.div
                                        key={feature.title}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.1 + index * 0.05 }}
                                        className="grid grid-cols-3 gap-2 items-center"
                                    >
                                        <div className="flex items-center gap-2">
                                            <feature.icon className={`w-4 h-4 ${feature.color}`} />
                                            <span className="text-sm font-medium text-court-brown truncate">
                                                {feature.title}
                                            </span>
                                        </div>
                                        <div className="text-center text-xs text-court-brownLight">
                                            {feature.free}
                                        </div>
                                        <div className="text-center text-xs font-medium text-court-gold">
                                            {feature.gold}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>

                        {/* Price */}
                        <div className="text-center mb-6">
                            <div className="text-3xl font-bold text-court-brown">
                                $8.88<span className="text-lg font-normal text-court-brownLight">/month</span>
                            </div>
                            <p className="text-xs text-court-brownLight mt-1">
                                Cancel anytime • Billed monthly
                            </p>
                        </div>

                        {/* Error display */}
                        {error && (
                            <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3 mb-4 text-center">
                                {error}
                            </div>
                        )}

                        {/* Purchase Button */}
                        <motion.button
                            onClick={handlePurchase}
                            disabled={isLoading}
                            whileTap={{ scale: 0.98 }}
                            className="w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 bg-gradient-to-r from-court-gold to-amber-600 shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                        >
                            {isLoading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Crown className="w-5 h-5" />
                                    Upgrade to Gold
                                    <Sparkles className="w-4 h-4" />
                                </>
                            )}
                        </motion.button>

                        {/* Restore Purchases */}
                        <button
                            onClick={handleRestore}
                            disabled={isLoading || restoring}
                            className="w-full mt-3 py-2 text-sm text-court-brownLight hover:text-court-brown transition-colors disabled:opacity-50"
                        >
                            {restoring ? 'Restoring...' : 'Restore Purchases'}
                        </button>

                        {/* Cancel link */}
                        <button
                            onClick={onClose}
                            className="w-full mt-2 py-2 text-sm text-court-brownLight/70 hover:text-court-brownLight transition-colors"
                        >
                            Not now
                        </button>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default Paywall;
