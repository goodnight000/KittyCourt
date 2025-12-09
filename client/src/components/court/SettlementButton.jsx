import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Handshake, Heart, X } from 'lucide-react';
import useCourtStore from '../../store/useCourtStore';
import useAuthStore from '../../store/useAuthStore';

/**
 * Settlement Button Component
 * 
 * Shows during SUBMITTING phase to allow users to settle out of court.
 * Displays partner's settlement request if they've already requested.
 * Both users must agree to settle for case to be dismissed.
 */

export default function SettlementButton({ className = '' }) {
    const [isLoading, setIsLoading] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);

    const { courtSession, requestSettlement } = useCourtStore();
    const { user, partner } = useAuthStore();

    // Check if partner has requested settlement
    const isCreator = courtSession?.created_by === user?.id;
    const partnerWantsToSettle = courtSession?.settle_requests && (
        (courtSession.settle_requests.creator && !isCreator) ||
        (courtSession.settle_requests.partner && isCreator)
    );

    // Check if I have already requested
    const iHaveRequested = courtSession?.settle_requests && (
        (courtSession.settle_requests.creator && isCreator) ||
        (courtSession.settle_requests.partner && !isCreator)
    );

    const partnerName = partner?.display_name || partner?.name || 'Your partner';

    const handleSettle = async () => {
        setIsLoading(true);
        try {
            await requestSettlement();
            setShowConfirmation(false);
        } catch (error) {
            console.error('Settlement request failed:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // If partner wants to settle, show prominent notification
    if (partnerWantsToSettle && !iHaveRequested) {
        return (
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-gradient-to-r from-pink-500/20 to-rose-500/20 border border-pink-500/30 rounded-xl p-4 ${className}`}
            >
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-pink-500/20 rounded-full">
                        <Heart className="w-5 h-5 text-pink-400" />
                    </div>
                    <div>
                        <p className="text-white font-medium">{partnerName} wants to settle</p>
                        <p className="text-sm text-pink-200/70">Agree to dismiss the case and hug it out?</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleSettle}
                        disabled={isLoading}
                        className="flex-1 py-2 px-4 bg-gradient-to-r from-pink-500 to-rose-500 rounded-lg text-white font-medium hover:from-pink-600 hover:to-rose-600 transition disabled:opacity-50"
                    >
                        {isLoading ? 'Settling...' : 'Accept & Settle 💕'}
                    </button>
                    <button
                        onClick={() => { }} // Continue to court
                        className="py-2 px-4 bg-white/10 border border-white/20 rounded-lg text-white/70 hover:bg-white/20 transition"
                    >
                        Continue
                    </button>
                </div>
            </motion.div>
        );
    }

    // If I already requested, show waiting state
    if (iHaveRequested) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`flex items-center gap-2 text-pink-300/70 ${className}`}
            >
                <Handshake className="w-4 h-4" />
                <span className="text-sm">Waiting for {partnerName} to agree to settle...</span>
            </motion.div>
        );
    }

    // Default: Show settlement button
    return (
        <>
            <button
                onClick={() => setShowConfirmation(true)}
                className={`flex items-center gap-2 text-sm text-pink-300/70 hover:text-pink-300 transition ${className}`}
            >
                <Handshake className="w-4 h-4" />
                <span>Want to settle instead?</span>
            </button>

            {/* Confirmation Modal */}
            <AnimatePresence>
                {showConfirmation && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => setShowConfirmation(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-xl"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-pink-500/20 rounded-full">
                                    <Handshake className="w-6 h-6 text-pink-400" />
                                </div>
                                <button
                                    onClick={() => setShowConfirmation(false)}
                                    className="p-1 text-white/40 hover:text-white/60"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <h3 className="text-xl font-bold text-white mb-2">
                                Request to Settle?
                            </h3>
                            <p className="text-white/60 text-sm mb-4">
                                This will send a settlement request to {partnerName}.
                                If they agree, the case will be dismissed without a verdict.
                            </p>
                            <p className="text-pink-300/70 text-xs mb-6">
                                💕 Sometimes the best resolution is to hug it out!
                            </p>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowConfirmation(false)}
                                    className="flex-1 py-2.5 px-4 bg-white/10 border border-white/20 rounded-xl text-white/70 font-medium hover:bg-white/20 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSettle}
                                    disabled={isLoading}
                                    className="flex-1 py-2.5 px-4 bg-gradient-to-r from-pink-500 to-rose-500 rounded-xl text-white font-medium hover:from-pink-600 hover:to-rose-600 transition disabled:opacity-50"
                                >
                                    {isLoading ? 'Requesting...' : 'Request Settlement'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
