import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { Handshake, Heart, X } from 'lucide-react';
import useCourtStore from '../../store/useCourtStore';
import useAuthStore from '../../store/useAuthStore';
import usePartnerStore from '../../store/usePartnerStore';
import { useI18n } from '../../i18n';
import ButtonLoader from '../shared/ButtonLoader';

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
    const { t } = useI18n();

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
    const { user } = useAuthStore();
    const { partner } = usePartnerStore();

    useEffect(() => {
        if (!settlementDeclinedNotice?.at) return;
        const t = setTimeout(() => clearSettlementDeclinedNotice(), 6000);
        return () => clearTimeout(t);
    }, [settlementDeclinedNotice?.at, clearSettlementDeclinedNotice]);

    // Check if partner has requested settlement (from server notification)
    const partnerWantsToSettle = showSettlementRequest;

    // Check if I have already requested
    const iHaveRequested = session?.settlementRequested === user?.id;

    const partnerName = partner?.display_name || partner?.name || t('common.yourPartner');

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
                        <div className="p-2 rounded-full bg-court-gold/15 border border-court-gold/30 shadow-inner-soft">
                            <Heart className="w-5 h-5 text-court-gold" />
                        </div>
                        <div>
                            <p
                                className="font-bold"
                                style={{
                                    color: 'rgba(35, 25, 20, 0.92)',
                                    textShadow: '0 1px 2px rgba(255,255,255,0.3)',
                                }}
                            >
                                {t('court.settlement.partnerRequest.title', { name: partnerName })}
                            </p>
                            <p
                                className="text-sm"
                                style={{ color: 'rgba(60, 45, 40, 0.75)' }}
                            >
                                {t('court.settlement.partnerRequest.subtitle')}
                            </p>
                        </div>
                    </div>

                    {/* Integrated Buttons */}
                    <div className="flex gap-2">
                        <button
                            onClick={handleAcceptPartnerSettlement}
                            disabled={isLoading}
                            className="court-btn-primary flex-1 disabled:opacity-60"
                        >
                            {isLoading ? (
                                <ButtonLoader
                                    size="sm"
                                    tone="white"
                                />
                            ) : (
                                t('court.settlement.partnerRequest.accept')
                            )}
                        </button>
                        <button
                            onClick={handleDeclinePartnerSettlement}
                            className="court-btn-secondary flex-1"
                        >
                            {t('court.settlement.partnerRequest.reject')}
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
                className={`inline-flex items-center gap-2 rounded-full border border-court-gold/20 bg-court-cream/80 px-3 py-1 text-court-brown ${className}`}
            >
                <Handshake className="w-4 h-4" />
                <span className="text-sm">{t('court.settlement.waiting', { name: partnerName })}</span>
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
                            {t('court.settlement.declined')}
                        </div>
                        <button
                            onClick={clearSettlementDeclinedNotice}
                            className="p-1 rounded-full"
                            style={{
                                background: 'rgba(255, 255, 255, 0.22)',
                                border: '1px solid rgba(255, 255, 255, 0.4)'
                            }}
                            aria-label={t('court.settlement.dismiss')}
                        >
                            <X className="w-4 h-4" style={{ color: 'rgba(60, 45, 40, 0.75)' }} />
                        </button>
                    </div>
                </motion.div>
            )}

            <button
                onClick={() => setShowConfirmation(true)}
                className={`court-btn-secondary ${className}`}
            >
                <Handshake className="w-4 h-4" />
                <span>{t('court.settlement.cta')}</span>
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
                                    <div className="p-3 rounded-full bg-court-gold/15 border border-court-gold/30 shadow-inner-soft">
                                        <Handshake className="w-6 h-6 text-court-gold" />
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
                                    {t('court.settlement.modal.title')}
                                </h3>

                                {/* Body: Slightly dimmer but readable */}
                                <p
                                    className="text-sm mb-4 leading-relaxed"
                                    style={{ color: 'rgba(60, 45, 40, 0.78)' }}
                                >
                                    {t('court.settlement.modal.body', { name: partnerName })}
                                </p>

                                <p className="text-xs mb-6 text-court-goldDark">
                                    {t('court.settlement.modal.note')}
                                </p>

                                {/* ═══ BUTTONS (Integrated with Glass) ═══ */}
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowConfirmation(false)}
                                        className="court-btn-secondary flex-1"
                                    >
                                        {t('common.cancel')}
                                    </button>

                                    <button
                                        onClick={handleSettle}
                                        disabled={isLoading}
                                        className="court-btn-primary flex-1 disabled:opacity-60"
                                    >
                                        {isLoading ? (
                                            <ButtonLoader
                                                size="sm"
                                                tone="white"
                                            />
                                        ) : (
                                            t('court.settlement.modal.confirm')
                                        )}
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
