import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { Handshake, Heart, X } from 'lucide-react';
import useCourtStore from '../../store/courtStore';
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

    // Single animated value driving the entire modal transition (blur, opacity, scale)
    const animationProgress = useMotionValue(0);
    const springProgress = useSpring(animationProgress, { stiffness: 400, damping: 30, mass: 0.8 });

    // Derived values from the single progress
    const popupOpacity = useTransform(springProgress, [0, 1], [0, 1]);
    const popupScale = useTransform(springProgress, [0, 1], [0.92, 1]);
    const overlayAlpha = useTransform(springProgress, [0, 1], [0, 0.03]);

    // Drive animation when showConfirmation changes
    useEffect(() => {
        animationProgress.set(showConfirmation ? 1 : 0);
    }, [showConfirmation, animationProgress]);

    const {
        session,
        requestSettlement,
        acceptSettlement,
        declineSettlement,
        showSettlementRequest,
        setShowSettlementRequest,
        settlementDeclinedNotice,
        clearSettlementDeclinedNotice
    } = useCourtStore();
    const { user, partner } = useAuthStore();

    useEffect(() => {
        if (!settlementDeclinedNotice?.at) return;
        const t = setTimeout(() => clearSettlementDeclinedNotice(), 6000);
        return () => clearTimeout(t);
    }, [settlementDeclinedNotice?.at, clearSettlementDeclinedNotice]);

    // Check if partner has requested settlement (from server notification)
    const partnerWantsToSettle = showSettlementRequest;

    // Check if I have already requested
    const iHaveRequested = session?.settlementRequested === user?.id;

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

    const handleAcceptPartnerSettlement = async () => {
        setIsLoading(true);
        try {
            await acceptSettlement();
        } catch (error) {
            console.error('Accept settlement failed:', error);
        } finally {
            setIsLoading(false);
            setShowSettlementRequest(false);
        }
    };

    const handleDeclinePartnerSettlement = async () => {
        setIsLoading(true);
        try {
            await declineSettlement();
        } catch (error) {
            console.error('Decline settlement failed:', error);
        } finally {
            setIsLoading(false);
            setShowSettlementRequest(false);
        }
    };

    if (partnerWantsToSettle && !iHaveRequested) {
        return (
            <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                className={`relative overflow-hidden ${className}`}
                style={{
                    borderRadius: '24px',
                    /* Soft shadow for depth */
                    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.15), 0 8px 24px rgba(0, 0, 0, 0.08)',
                }}
            >
                {/* ═══ GLASS MATERIAL LAYERS ═══ */}

                {/* Layer 1: True Background Blur (inside panel only) */}
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        borderRadius: '24px',
                        backdropFilter: 'blur(40px) saturate(150%)',
                        WebkitBackdropFilter: 'blur(40px) saturate(150%)',
                    }}
                />

                {/* Layer 2: Soft White Tint (light and airy) */}
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        borderRadius: '24px',
                        background: 'rgba(255, 255, 255, 0.24)',
                    }}
                />

                {/* Layer 3: Vertical Glass Gradient (brighter top, more transparent bottom) */}
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        borderRadius: '24px',
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0.14) 100%)',
                    }}
                />

                {/* Layer 4: 1px Outer Stroke (stronger at top) */}
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        borderRadius: '24px',
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.50) 0%, rgba(255,255,255,0.20) 100%)',
                        mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                        maskComposite: 'exclude',
                        WebkitMaskComposite: 'xor',
                        padding: '1px',
                    }}
                />

                {/* ═══ CONTENT ═══ */}
                <div className="relative z-10 p-4">
                    <div className="flex items-center gap-3 mb-3">
                        {/* Vibrancy Icon Circle */}
                        <div
                            className="p-2 rounded-full"
                            style={{
                                background: 'rgba(255, 200, 220, 0.25)',
                                backdropFilter: 'blur(12px) saturate(150%)',
                                WebkitBackdropFilter: 'blur(12px) saturate(150%)',
                                border: '1px solid rgba(255, 255, 255, 0.35)',
                                boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.4)',
                            }}
                        >
                            <Heart className="w-5 h-5" style={{ color: 'rgba(219, 39, 119, 0.9)' }} />
                        </div>
                        <div>
                            <p
                                className="font-bold"
                                style={{
                                    color: 'rgba(35, 25, 20, 0.92)',
                                    textShadow: '0 1px 2px rgba(255,255,255,0.3)',
                                }}
                            >
                                {partnerName} wants to settle
                            </p>
                            <p
                                className="text-sm"
                                style={{ color: 'rgba(60, 45, 40, 0.75)' }}
                            >
                                A sweet reset: dismiss the case and hug it out?
                            </p>
                        </div>
                    </div>

                    {/* Integrated Buttons */}
                    <div className="flex gap-2">
                        {/* Primary: Pink gradient over glass */}
                        <button
                            onClick={handleAcceptPartnerSettlement}
                            disabled={isLoading}
                            className="flex-1 py-2 px-4 rounded-full font-bold text-white transition-all disabled:opacity-50"
                            style={{
                                background: 'linear-gradient(135deg, rgba(236,72,153,0.92) 0%, rgba(244,114,182,0.88) 100%)',
                                backdropFilter: 'blur(4px)',
                                border: '1px solid rgba(255, 180, 210, 0.4)',
                                boxShadow: '0 6px 20px rgba(236, 72, 153, 0.32), inset 0 1px 0 0 rgba(255,255,255,0.25)',
                            }}
                        >
                            {isLoading ? 'Settling...' : 'Accept & Settle 💕'}
                        </button>

                        {/* Secondary: Outline style on glass */}
                        <button
                            onClick={handleDeclinePartnerSettlement}
                            className="py-2 px-4 rounded-full font-medium transition-all"
                            style={{
                                background: 'rgba(255, 255, 255, 0.18)',
                                backdropFilter: 'blur(8px)',
                                border: '1px solid rgba(255, 255, 255, 0.4)',
                                color: 'rgba(50, 35, 30, 0.85)',
                                boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.25)',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.32)';
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.55)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.18)';
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                            }}
                        >
                            Reject
                        </button>
                    </div>
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
            {settlementDeclinedNotice && (
                <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`relative overflow-hidden ${className}`}
                    style={{ borderRadius: '18px' }}
                >
                    <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            backdropFilter: 'blur(18px) saturate(140%)',
                            WebkitBackdropFilter: 'blur(18px) saturate(140%)',
                            background: 'rgba(255, 255, 255, 0.22)'
                        }}
                    />
                    <div className="relative z-10 flex items-center justify-between gap-3 px-4 py-3">
                        <div className="text-sm font-medium" style={{ color: 'rgba(60, 45, 40, 0.85)' }}>
                            Settlement declined — case continues.
                        </div>
                        <button
                            onClick={clearSettlementDeclinedNotice}
                            className="p-1 rounded-full"
                            style={{
                                background: 'rgba(255, 255, 255, 0.22)',
                                border: '1px solid rgba(255, 255, 255, 0.4)'
                            }}
                            aria-label="Dismiss"
                        >
                            <X className="w-4 h-4" style={{ color: 'rgba(60, 45, 40, 0.75)' }} />
                        </button>
                    </div>
                </motion.div>
            )}

            <button
                onClick={() => setShowConfirmation(true)}
                className={`flex items-center justify-center gap-2 text-sm font-semibold text-pink-600/90 hover:text-pink-700 transition ${className}`}
            >
                <Handshake className="w-4 h-4" />
                <span>Want to settle instead?</span>
            </button>

            {/* Confirmation Modal - Apple Liquid Glass with Synchronized Animation */}
            <AnimatePresence>
                {showConfirmation && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                        onClick={() => setShowConfirmation(false)}
                    >
                        {/* Light overlay (barely visible) - animated alpha */}
                        <motion.div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                                backgroundColor: 'black',
                                opacity: overlayAlpha,
                            }}
                        />

                        {/* Popup Container */}
                        <motion.div
                            onClick={(e) => e.stopPropagation()}
                            className="relative max-w-sm w-full overflow-hidden"
                            style={{
                                borderRadius: '28px',
                                opacity: popupOpacity,
                                scale: popupScale,
                                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.18), 0 10px 30px rgba(0, 0, 0, 0.10)',
                            }}
                        >
                            {/* ═══ GLASS MATERIAL LAYERS ═══ */}

                            {/* Layer 1: True Background Blur (opacity animated in sync with popup) */}
                            <motion.div
                                className="absolute inset-0 pointer-events-none"
                                style={{
                                    borderRadius: '28px',
                                    backdropFilter: 'blur(40px) saturate(150%)',
                                    WebkitBackdropFilter: 'blur(40px) saturate(150%)',
                                    opacity: popupOpacity,
                                }}
                            />

                            {/* Layer 2: Soft White Tint (light and airy) */}
                            <div
                                className="absolute inset-0 pointer-events-none"
                                style={{
                                    borderRadius: '28px',
                                    background: 'rgba(255, 255, 255, 0.24)',
                                }}
                            />

                            {/* Layer 3: Vertical Glass Gradient (brighter top, more transparent bottom) */}
                            <div
                                className="absolute inset-0 pointer-events-none"
                                style={{
                                    borderRadius: '28px',
                                    background: 'linear-gradient(180deg, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0.14) 100%)',
                                }}
                            />

                            {/* Layer 4: 1px Outer Stroke (stronger at top) */}
                            <div
                                className="absolute inset-0 pointer-events-none"
                                style={{
                                    borderRadius: '28px',
                                    background: 'linear-gradient(180deg, rgba(255,255,255,0.50) 0%, rgba(255,255,255,0.20) 100%)',
                                    mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                                    maskComposite: 'exclude',
                                    WebkitMaskComposite: 'xor',
                                    padding: '1px',
                                }}
                            />

                            {/* ═══ CONTENT CONTAINER ═══ */}
                            <div className="relative z-10 p-6">
                                {/* Header: Icon + Close */}
                                <div className="flex justify-between items-start mb-4">
                                    {/* Vibrancy Icon Circle (responds to background) */}
                                    <div
                                        className="p-3 rounded-full"
                                        style={{
                                            background: 'rgba(255, 200, 220, 0.25)',
                                            backdropFilter: 'blur(12px) saturate(150%)',
                                            WebkitBackdropFilter: 'blur(12px) saturate(150%)',
                                            border: '1px solid rgba(255, 255, 255, 0.35)',
                                            boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.4)',
                                        }}
                                    >
                                        <Handshake className="w-6 h-6" style={{ color: 'rgba(219, 39, 119, 0.9)' }} />
                                    </div>
                                    <button
                                        onClick={() => setShowConfirmation(false)}
                                        className="p-2 rounded-full transition-all"
                                        style={{
                                            color: 'rgba(80, 60, 55, 0.5)',
                                            background: 'rgba(255, 255, 255, 0.15)',
                                            backdropFilter: 'blur(8px)',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.35)';
                                            e.currentTarget.style.color = 'rgba(80, 60, 55, 0.8)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                                            e.currentTarget.style.color = 'rgba(80, 60, 55, 0.5)';
                                        }}
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Title: Bold, dark, high contrast */}
                                <h3
                                    className="text-xl font-extrabold mb-2"
                                    style={{
                                        color: 'rgba(35, 25, 20, 0.92)',
                                        textShadow: '0 1px 2px rgba(255,255,255,0.3)',
                                    }}
                                >
                                    Request to Settle?
                                </h3>

                                {/* Body: Slightly dimmer but readable */}
                                <p
                                    className="text-sm mb-4 leading-relaxed"
                                    style={{ color: 'rgba(60, 45, 40, 0.78)' }}
                                >
                                    This will send a settlement request to {partnerName}.
                                    If they agree, the case will be dismissed without a verdict.
                                </p>

                                <p
                                    className="text-xs mb-6"
                                    style={{ color: 'rgba(180, 50, 90, 0.85)' }}
                                >
                                    💕 Sometimes the best resolution is to hug it out!
                                </p>

                                {/* ═══ BUTTONS (Integrated with Glass) ═══ */}
                                <div className="flex gap-3">
                                    {/* Secondary: Outline style on glass */}
                                    <button
                                        onClick={() => setShowConfirmation(false)}
                                        className="flex-1 py-2.5 px-4 rounded-full font-semibold transition-all"
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.18)',
                                            backdropFilter: 'blur(8px)',
                                            border: '1px solid rgba(255, 255, 255, 0.4)',
                                            color: 'rgba(50, 35, 30, 0.85)',
                                            boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.25)',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.32)';
                                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.55)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.18)';
                                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                                        }}
                                    >
                                        Cancel
                                    </button>

                                    {/* Primary: Pink gradient, slightly translucent over glass */}
                                    <button
                                        onClick={handleSettle}
                                        disabled={isLoading}
                                        className="flex-1 py-2.5 px-4 rounded-full text-white font-extrabold transition-all disabled:opacity-50"
                                        style={{
                                            background: 'linear-gradient(135deg, rgba(236,72,153,0.92) 0%, rgba(244,114,182,0.88) 100%)',
                                            backdropFilter: 'blur(4px)',
                                            border: '1px solid rgba(255, 180, 210, 0.4)',
                                            boxShadow: '0 6px 24px rgba(236, 72, 153, 0.35), inset 0 1px 0 0 rgba(255,255,255,0.25)',
                                        }}
                                    >
                                        {isLoading ? 'Requesting...' : 'Request Settlement'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
