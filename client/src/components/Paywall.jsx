import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { X, Crown, Heart, Check, Users, Zap, Gavel, Wand2, ChevronRight, Clock, Star, RotateCcw, Brain } from 'lucide-react';
import useSubscriptionStore from '../store/useSubscriptionStore';
import usePartnerStore from '../store/usePartnerStore';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion';
import { useI18n } from '../i18n';
import ButtonLoader from './shared/ButtonLoader';

/**
 * Paywall Modal - High-Converting Premium Experience
 * 
 * Optimized for conversion with:
 * - 7-day free trial prominent messaging
 * - Urgency elements (limited offer)
 * - Loss aversion section before CTA
 * - Outcome-focused benefit copy
 * - Sticky CTA button
 * - Visual delight (sparkles, animations)
 * - Contrasting CTA color for attention
 * - Specific social proof with names
 */
const isActiveGold = (profile) => {
    if (!profile || profile.subscription_tier !== 'pause_gold') return false;
    if (!profile.subscription_expires_at) return true;
    const expiresAt = new Date(profile.subscription_expires_at);
    return !Number.isNaN(expiresAt.valueOf()) && expiresAt >= new Date();
};

const seededRandom = (seed) => {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
};

const SPARKLE_PARTICLES = Array.from({ length: 12 }, (_, index) => ({
    id: index,
    x: `${Math.round(seededRandom(index + 1) * 100)}%`,
    duration: 4 + seededRandom(index + 101) * 3,
    delay: seededRandom(index + 201) * 4,
    size: 6 + Math.round(seededRandom(index + 301) * 4),
}));

const SparkleParticles = ({ prefersReducedMotion }) => {
    if (prefersReducedMotion) {
        return null;
    }

    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {SPARKLE_PARTICLES.map((particle) => (
                <Motion.div
                    key={particle.id}
                    className="absolute rounded-full bg-amber-300/70 shadow-[0_0_10px_rgba(245,158,11,0.45)]"
                    style={{
                        width: particle.size,
                        height: particle.size,
                    }}
                    initial={{
                        x: particle.x,
                        y: '110%',
                        opacity: 0,
                        scale: 0.5,
                    }}
                    animate={{
                        y: '-10%',
                        opacity: [0, 1, 1, 0],
                        scale: [0.5, 1, 0.8, 0.3],
                    }}
                    transition={{
                        duration: particle.duration,
                        repeat: Infinity,
                        delay: particle.delay,
                        ease: 'easeOut',
                    }}
                />
            ))}
        </div>
    );
};

const PaywallBackdrop = ({ prefersReducedMotion }) => (
    <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -right-20 h-64 w-64 rounded-full bg-amber-200/30 blur-2xl" />
        {!prefersReducedMotion && (
            <>
                <div className="absolute top-20 -left-24 h-72 w-72 rounded-full bg-rose-200/25 blur-2xl" />
                <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-amber-100/40 blur-2xl" />
            </>
        )}
        <div
            className="absolute inset-0 opacity-50"
            style={{
                backgroundImage:
                    'radial-gradient(circle at 18% 20%, rgba(255,255,255,0.8) 0%, transparent 55%), radial-gradient(circle at 80% 12%, rgba(255,235,210,0.9) 0%, transparent 60%)'
            }}
        />
    </div>
);

const Paywall = ({ isOpen, onClose, triggerReason = null }) => {
    const { purchaseGold, restorePurchases, isLoading, trialEligible, isGold, checkEntitlement } = useSubscriptionStore();
    const { partner } = usePartnerStore();
    const [restoring, setRestoring] = useState(false);
    const [error, setError] = useState(null);
    const [selectedPlan, setSelectedPlan] = useState('yearly');
    const { t } = useI18n();
    const partnerHasGold = isActiveGold(partner);
    const purchaseBlocked = partnerHasGold && !isGold;
    const prefersReducedMotion = usePrefersReducedMotion();

    // Refs for focus management
    const modalRef = useRef(null);
    const previousActiveElement = useRef(null);
    const closeButtonRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;

        const refreshStatus = async () => {
            const gold = await checkEntitlement();
            if (!cancelled && gold) {
                onClose();
            }
        };

        refreshStatus();

        return () => {
            cancelled = true;
        };
    }, [isOpen, checkEntitlement, onClose]);

    // Focus trapping and management
    useEffect(() => {
        if (!isOpen) return;

        // Store the previously focused element
        previousActiveElement.current = document.activeElement;

        // Focus the close button when modal opens
        const focusTimeout = setTimeout(() => {
            closeButtonRef.current?.focus();
        }, 100);

        return () => {
            clearTimeout(focusTimeout);
            // Restore focus when modal closes
            previousActiveElement.current?.focus();
        };
    }, [isOpen]);

    // Focus trap handler
    const handleKeyDown = useCallback((event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
            return;
        }

        if (event.key !== 'Tab' || !modalRef.current) return;

        const focusableElements = modalRef.current.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) {
            // Shift + Tab: if on first element, go to last
            if (document.activeElement === firstElement) {
                event.preventDefault();
                lastElement?.focus();
            }
        } else {
            // Tab: if on last element, go to first
            if (document.activeElement === lastElement) {
                event.preventDefault();
                firstElement?.focus();
            }
        }
    }, [onClose]);

    const handlePurchase = async () => {
        setError(null);
        if (purchaseBlocked) {
            setError(t('paywall.partnerActive.error'));
            return;
        }
        const result = await purchaseGold(selectedPlan);

        if (result.success) {
            onClose();
        } else if (result.error) {
            setError(result.error);
        }
    };

    const handleRestore = async () => {
        setRestoring(true);
        setError(null);
        if (purchaseBlocked) {
            setRestoring(false);
            setError(t('paywall.partnerActive.error'));
            return;
        }

        const result = await restorePurchases();
        setRestoring(false);

        if (result.success && result.isGold) {
            onClose();
        } else if (!result.isGold) {
            setError(t('paywall.errors.noPurchase'));
        } else if (result.error) {
            setError(result.error);
        }
    };

    // Outcome-focused benefits with varied colors
    const benefits = [
        {
            icon: Zap,
            titleKey: 'paywall.benefits.items.resolve.title',
            descriptionKey: 'paywall.benefits.items.resolve.description',
            color: '#C9921A',
            bgColor: 'rgba(201, 146, 26, 0.14)',
        },
        {
            icon: Gavel,
            titleKey: 'paywall.benefits.items.judge.title',
            descriptionKey: 'paywall.benefits.items.judge.description',
            color: '#B86B5E',
            bgColor: 'rgba(184, 107, 94, 0.14)',
        },
        {
            icon: Wand2,
            titleKey: 'paywall.benefits.items.planning.title',
            descriptionKey: 'paywall.benefits.items.planning.description',
            color: '#8B7019',
            bgColor: 'rgba(139, 112, 25, 0.14)',
        },
        {
            icon: RotateCcw,
            titleKey: 'paywall.benefits.items.streak.title',
            descriptionKey: 'paywall.benefits.items.streak.description',
            color: '#5B8B6E',
            bgColor: 'rgba(91, 139, 110, 0.14)',
        },
        {
            icon: Brain,
            titleKey: 'paywall.benefits.items.insights.title',
            descriptionKey: 'paywall.benefits.items.insights.description',
            color: '#4A6E8A',
            bgColor: 'rgba(74, 110, 138, 0.14)',
        },
    ];

    // Loss aversion - what they miss without Gold
    const withoutGold = [
        'paywall.withoutGold.items.limit',
        'paywall.withoutGold.items.whiskersLocked',
        'paywall.withoutGold.items.noPlanning',
        'paywall.withoutGold.items.noInsights',
        'paywall.withoutGold.items.risk',
    ];

    const translatedError = error
        ? (error === 'Purchases are only available in the iOS/Android app.'
            ? t('paywall.errors.unavailable')
            : error === 'Restore is only available in the iOS/Android app.'
                ? t('paywall.errors.restoreUnavailable')
                : error)
        : null;

    return (
        <AnimatePresence>
            {isOpen && (
                <Motion.div
                    ref={modalRef}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex flex-col overflow-hidden"
                    style={{
                        background: 'linear-gradient(180deg, #FFF9F0 0%, #F5EDE0 50%, #E8DCCB 100%)',
                    }}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="paywall-title"
                    onKeyDown={handleKeyDown}
                >
                    {/* Close button for accessibility */}
                    <button
                        ref={closeButtonRef}
                        onClick={onClose}
                        aria-label={t('common.close') || 'Close'}
                        className="absolute top-4 right-4 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-white/80 border border-neutral-200/70 shadow-soft hover:bg-white transition-colors"
                    >
                        <X className="w-5 h-5 text-neutral-600" />
                    </button>

                    <PaywallBackdrop prefersReducedMotion={prefersReducedMotion} />
                    <SparkleParticles prefersReducedMotion={prefersReducedMotion} />

                    {/* Scrollable content - with bottom padding for sticky CTA */}
                    <div className="flex-1 overflow-y-auto px-6 pb-48 relative z-10">
                        {/* Hero Section - More Impactful */}
                        <Motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="mt-14 mb-6"
                        >
                            <div className="relative overflow-hidden rounded-[32px] border border-white/80 bg-white/85 px-6 py-8 text-center shadow-soft-lg">
                                <div className="absolute -top-10 -right-10 h-24 w-24 rounded-full bg-amber-200/35 blur-2xl" />
                                <div className="absolute -bottom-12 -left-10 h-28 w-28 rounded-full bg-rose-200/30 blur-3xl" />
                                <Motion.div
                                    initial={{ scale: 0, rotate: -180 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                                    className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-4 relative border border-amber-200/80 bg-amber-100/80 shadow-soft"
                                >
                                    <Motion.div
                                        className="absolute inset-0 rounded-3xl border border-amber-300/70"
                                        animate={prefersReducedMotion ? undefined : {
                                            scale: [1, 1.2, 1.2],
                                            opacity: [0.6, 0, 0],
                                        }}
                                        transition={prefersReducedMotion ? undefined : {
                                            duration: 2,
                                            repeat: Infinity,
                                            ease: 'easeOut',
                                        }}
                                    />
                                    <Crown className="w-10 h-10 text-amber-700" />
                                </Motion.div>

                                <Motion.h1
                                    id="paywall-title"
                                    className="text-3xl font-bold text-court-brown mb-2 font-display"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                >
                                    {t('paywall.title')}
                                </Motion.h1>
                                <Motion.p
                                    className="text-court-brownLight text-sm max-w-xs mx-auto"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.4 }}
                                >
                                    {t('paywall.subtitle')}
                                </Motion.p>
                            </div>
                        </Motion.div>

                        {/* Free Trial Badge - Only show if eligible */}
                        {trialEligible && (
                            <Motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.25, type: 'spring' }}
                                className="mb-5"
                            >
                                <div
                                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl"
                                    style={{
                                        background: 'linear-gradient(135deg, rgba(91, 139, 110, 0.15) 0%, rgba(233, 248, 238, 0.6) 100%)',
                                        border: '1.5px solid rgba(91, 139, 110, 0.4)',
                                    }}
                                >
                                    <Clock className="w-5 h-5 text-emerald-600" />
                                    <span className="text-sm font-bold text-emerald-700 font-display">
                                        {t('paywall.trialBadge')}
                                    </span>
                                </div>
                            </Motion.div>
                        )}

                        {/* Key Value Prop - Both Partners */}
                        <Motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="mt-2 mb-6"
                        >
                            <div
                                className="flex items-center justify-center gap-3 py-3 px-4 rounded-2xl"
                                style={{
                                    background: 'linear-gradient(135deg, rgba(201, 162, 39, 0.16) 0%, rgba(255, 245, 226, 0.7) 100%)',
                                    border: '1px solid rgba(201, 162, 39, 0.3)',
                                }}
                            >
                                <Users className="w-5 h-5 text-amber-600" />
                                <span className="text-sm font-semibold text-court-brown font-display">
                                    {t('paywall.bundleNotice.prefix')}{' '}
                                    <span className="text-amber-600">{t('paywall.bundleNotice.emphasis')}</span>{' '}
                                    {t('paywall.bundleNotice.suffix')}
                                </span>
                                <Motion.div
                                    animate={prefersReducedMotion ? undefined : { scale: [1, 1.2, 1] }}
                                    transition={prefersReducedMotion ? undefined : { duration: 1.5, repeat: Infinity }}
                                >
                                    <Heart className="w-4 h-4 text-amber-600" />
                                </Motion.div>
                            </div>
                        </Motion.div>

                        {purchaseBlocked && (
                            <Motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.32 }}
                                className="mt-2 mb-6"
                            >
                                <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/80 px-4 py-3 text-center shadow-soft">
                                    <div className="text-sm font-bold text-emerald-800 font-display">
                                        {t('paywall.partnerActive.title')}
                                    </div>
                                    <div className="text-xs text-emerald-700 mt-1">
                                        {t('paywall.partnerActive.subtitle')}
                                    </div>
                                </div>
                            </Motion.div>
                        )}

                        {/* Trigger Reason */}
                        {triggerReason && (
                            <Motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-xs text-court-maroon text-center mb-4 bg-white/70 border border-amber-200/60 rounded-2xl px-3 py-2"
                            >
                                {triggerReason}
                            </Motion.p>
                        )}

                        {/* Benefits Section - Outcome-Focused with Varied Colors */}
                        <Motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.35 }}
                            className="mb-6"
                        >
                            <h3 className="text-[11px] font-semibold text-court-brownLight uppercase tracking-[0.3em] mb-3 font-display">
                                {t('paywall.benefits.title')}
                            </h3>
                            <div className="space-y-3">
                                {benefits.map((benefit, index) => (
                                    <Motion.div
                                        key={benefit.titleKey}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.4 + index * 0.05 }}
                                        className="relative flex items-start gap-3 p-4 rounded-2xl bg-white/80 border border-white/80"
                                        style={{ boxShadow: '0 6px 18px rgba(74, 55, 40, 0.06)' }}
                                    >
                                        <div className="absolute inset-x-6 top-0 h-0.5 bg-gradient-to-r from-transparent via-amber-200/80 to-transparent" />
                                        {/* Colored Icon */}
                                        <div
                                            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                                            style={{
                                                background: benefit.bgColor,
                                                boxShadow: `0 0 12px ${benefit.bgColor}`,
                                            }}
                                        >
                                            <benefit.icon className="w-4 h-4" style={{ color: benefit.color }} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-court-brown text-sm font-display">
                                                {t(benefit.titleKey)}
                                            </p>
                                            <p className="text-xs text-court-brownLight mt-0.5">
                                                {t(benefit.descriptionKey)}
                                            </p>
                                        </div>
                                    </Motion.div>
                                ))}
                            </div>
                        </Motion.div>

                        {/* Loss Aversion Section - MOVED ABOVE PRICING */}
                        <Motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="mb-6 p-4 rounded-3xl bg-rose-50/60 border border-rose-200/70"
                        >
                            <h4 className="text-[11px] font-semibold text-rose-600 uppercase tracking-[0.3em] mb-3 font-display">
                                {t('paywall.withoutGold.title')}
                            </h4>
                            <ul className="space-y-1.5">
                                {withoutGold.map((item, index) => (
                                    <li key={index} className="flex items-center gap-2 text-sm text-court-brown/70">
                                        <X className="w-3.5 h-3.5 text-rose-500/70 flex-shrink-0" />
                                        {t(item)}
                                    </li>
                                ))}
                            </ul>
                        </Motion.div>

                        {/* Pricing Plans */}
                        {!purchaseBlocked && (
                            <Motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.55 }}
                                className="mb-6 relative"
                            >
                                <h3 className="text-[11px] font-semibold text-court-brownLight uppercase tracking-[0.3em] mb-3 font-display">
                                    {t('paywall.plans.title')}
                                </h3>
                                <div className="space-y-3">
                                    {/* Yearly Plan - Recommended */}
                                    <Motion.div
                                        className="relative"
                                        animate={{ scale: selectedPlan === 'yearly' ? 1 : 0.94 }}
                                        transition={{ duration: 0.2, ease: 'easeOut' }}
                                    >
                                        {/* Best Value Badge - Outside the button */}
                                        <div
                                            className="absolute -top-3 left-4 px-3 py-1 rounded-full text-[10px] font-bold text-amber-700 font-display z-20 border border-amber-200/70 bg-amber-100/80"
                                            style={{
                                                boxShadow: '0 2px 8px rgba(212, 175, 55, 0.25)',
                                            }}
                                        >
                                            {t('paywall.plans.yearly.badge')}
                                        </div>
                                        <button
                                            onClick={() => setSelectedPlan('yearly')}
                                            className={`w-full p-4 pt-5 rounded-[28px] text-left transition-[transform,border-color,background-color,box-shadow] duration-200 ease-out border relative overflow-hidden ${selectedPlan === 'yearly'
                                                ? 'border-amber-300/80 bg-white shadow-soft-lg'
                                                : 'border-white/80 bg-white/70 hover:border-amber-200/70'
                                                }`}
                                        >
                                            <div className="absolute inset-x-6 top-0 h-0.5 bg-gradient-to-r from-transparent via-amber-200/70 to-transparent" />
                                            <div className="flex items-center gap-3 relative z-10">
                                                {/* Selection Circle */}
                                                <div
                                                    className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center border-2 transition-colors duration-200"
                                                    style={{
                                                        borderColor: selectedPlan === 'yearly' ? '#C9A227' : '#D4C4A8',
                                                        backgroundColor: selectedPlan === 'yearly' ? '#C9A227' : 'white',
                                                    }}
                                                >
                                                    {selectedPlan === 'yearly' && (
                                                        <Check className="w-4 h-4 text-white" strokeWidth={3} />
                                                    )}
                                                </div>

                                                {/* Plan Info */}
                                                <div className="flex-1 flex items-center justify-between min-w-0">
                                                    <div>
                                                        <p className="font-bold text-court-brown font-display">{t('paywall.plans.yearly.label')}</p>
                                                        <p className="text-xs text-court-brownLight">
                                                            {trialEligible
                                                                ? t('paywall.plans.yearly.trialNote')
                                                                : t('paywall.plans.yearly.billedNote')}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="flex items-baseline gap-1.5">
                                                            <del className="text-sm text-court-brownLight/60 line-through">$11.99</del>
                                                            <span className="text-2xl font-bold text-court-brown font-display">$9.17</span>
                                                            <span className="text-sm text-court-brownLight">{t('paywall.plans.perMonth')}</span>
                                                        </div>
                                                        <p className="text-xs text-green-600 font-semibold">{t('paywall.plans.yearly.save')}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    </Motion.div>

                                    {/* Monthly Plan */}
                                    <Motion.div
                                        animate={{ scale: selectedPlan === 'monthly' ? 1 : 0.94 }}
                                        transition={{ duration: 0.2, ease: 'easeOut' }}
                                    >
                                        <button
                                            onClick={() => setSelectedPlan('monthly')}
                                            className={`w-full p-4 rounded-[28px] text-left transition-[transform,border-color,background-color,box-shadow] duration-200 ease-out border relative overflow-hidden ${selectedPlan === 'monthly'
                                                ? 'border-amber-300/80 bg-white shadow-soft-lg'
                                                : 'border-white/80 bg-white/70 hover:border-amber-200/70'
                                                }`}
                                        >
                                            <div className="absolute inset-x-6 top-0 h-0.5 bg-gradient-to-r from-transparent via-amber-200/70 to-transparent" />
                                            <div className="flex items-center gap-3 relative z-10">
                                                {/* Selection Circle */}
                                                <div
                                                    className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center border-2 transition-colors duration-200"
                                                    style={{
                                                        borderColor: selectedPlan === 'monthly' ? '#C9A227' : '#D4C4A8',
                                                        backgroundColor: selectedPlan === 'monthly' ? '#C9A227' : 'white',
                                                    }}
                                                >
                                                    {selectedPlan === 'monthly' && (
                                                        <Check className="w-4 h-4 text-white" strokeWidth={3} />
                                                    )}
                                                </div>

                                                {/* Plan Info */}
                                                <div className="flex-1 flex items-center justify-between min-w-0">
                                                    <div>
                                                        <p className="font-bold text-court-brown font-display">{t('paywall.plans.monthly.label')}</p>
                                                        <p className="text-xs text-court-brownLight">
                                                            {trialEligible
                                                                ? t('paywall.plans.monthly.trialNote')
                                                                : t('paywall.plans.monthly.billedNote')}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="flex items-baseline gap-1">
                                                            <span className="text-2xl font-bold text-court-brown font-display">$11.99</span>
                                                            <span className="text-sm text-court-brownLight">{t('paywall.plans.perMonth')}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    </Motion.div>
                                </div>

                                {/* Price context + Cancel anytime */}
                                <div className="text-center mt-3">
                                    <p className="text-xs text-court-brownLight">
                                        {selectedPlan === 'yearly'
                                            ? t('paywall.pricingNote.yearly')
                                            : t('paywall.pricingNote.monthly')
                                        }
                                    </p>
                                    <p className="text-xs text-court-brownLight/70 mt-1 flex items-center justify-center gap-1">
                                        <Check className="w-3 h-3" />
                                        {t('paywall.cancelAnytime')}
                                    </p>
                                </div>
                            </Motion.div>
                        )}

                        {/* Social Proof - Specific Names */}
                        <Motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 }}
                            className="mb-6"
                        >
                            <div className="relative p-4 rounded-3xl bg-white/80 border border-white/80 shadow-soft">
                                <div className="absolute inset-x-6 top-0 h-0.5 bg-gradient-to-r from-transparent via-amber-200/70 to-transparent" />
                                <div className="flex items-center justify-center gap-0.5 mb-2">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <Star key={star} className="w-4 h-4 text-court-gold fill-court-gold" />
                                    ))}
                                </div>
                                <p className="text-sm text-court-brown text-center italic font-display">
                                    {t('paywall.social.quote')}
                                </p>
                                <p className="text-xs text-court-brownLight text-center mt-2 font-medium">
                                    {t('paywall.social.author')}
                                </p>
                                <p className="text-xs text-court-brownLight/60 text-center mt-1">
                                    {t('paywall.social.count')}
                                </p>
                            </div>
                        </Motion.div>



                        {/* Error display */}
                        {error && (
                            <Motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-rose-50 text-rose-600 text-sm rounded-2xl p-3 mb-4 text-center border border-rose-200/70"
                            >
                                {translatedError}
                            </Motion.div>
                        )}

                        {/* Restore Purchases */}
                        <button
                            onClick={handleRestore}
                            disabled={isLoading || restoring || purchaseBlocked}
                            className="w-full py-2 text-xs font-semibold text-court-brownLight hover:text-court-brown transition-colors disabled:opacity-50 mb-2"
                        >
                            {restoring ? (
                                <ButtonLoader
                                    size="sm"
                                    tone="amber"
                                />
                            ) : (
                                t('paywall.restore.cta')
                            )}
                        </button>

                        {/* Maybe Later with consequence */}
                        <Motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.7 }}
                            className="text-center pb-4"
                        >
                        </Motion.div>
                    </div>

                    {/* STICKY CTA BUTTON - Fixed at bottom */}
                    <Motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="fixed bottom-0 left-0 right-0 z-50 px-6 pb-6 pt-4"
                        style={{
                            background: 'linear-gradient(to top, rgba(248, 238, 223, 1) 0%, rgba(248, 238, 223, 0.95) 70%, transparent 100%)',
                        }}
                    >
                        {/* Safe area padding for iOS */}
                        <div className="safe-bottom">
                            {purchaseBlocked ? (
                                <div className="w-full rounded-[28px] border border-emerald-200/70 bg-emerald-50/90 px-4 py-4 text-left font-display relative overflow-hidden shadow-soft-lg">
                                    <div className="absolute inset-x-6 top-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-200/80 to-transparent" />
                                    <div className="absolute -top-8 -right-6 h-16 w-16 rounded-full bg-emerald-200/35 blur-2xl" />
                                    <div className="relative flex items-center gap-3">
                                        <div className="flex-1">
                                            <div className="text-sm font-bold text-emerald-800">
                                                {t('paywall.partnerActive.title')}
                                            </div>
                                            <div className="text-xs text-emerald-700">
                                                {t('paywall.partnerActive.subtitle')}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <Motion.button
                                    onClick={handlePurchase}
                                    disabled={isLoading}
                                    whileHover={prefersReducedMotion ? undefined : { scale: 1.01 }}
                                    whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                                    className="w-full rounded-[28px] border border-amber-200/80 bg-white/90 px-4 py-4 text-left disabled:opacity-50 transition-[transform,opacity] font-display relative overflow-hidden shadow-soft-lg"
                                >
                                    <div className="absolute inset-x-6 top-0 h-0.5 bg-gradient-to-r from-transparent via-amber-200/80 to-transparent" />
                                    <div className="absolute -top-8 -right-6 h-16 w-16 rounded-full bg-amber-200/35 blur-2xl" />
                                    {isLoading ? (
                                        <div className="relative flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-2xl border border-amber-200/70 bg-amber-100/70 flex items-center justify-center">
                                                <div className="w-5 h-5 border-2 border-amber-300/60 border-t-amber-700 rounded-full animate-spin" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-sm font-bold text-neutral-800">{t('paywall.cta.processingTitle')}</div>
                                                <div className="text-xs text-neutral-500">{t('paywall.cta.processingSubtitle')}</div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="relative flex items-center gap-3">
                                            <div className="flex-1">
                                                <div className="text-sm font-bold text-neutral-800">
                                                    {trialEligible ? t('paywall.cta.trial') : t('paywall.cta.subscribe')}
                                                </div>
                                                <div className="text-xs text-neutral-500">
                                                    {t('paywall.cta.subtitle')}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="rounded-full border border-amber-200/70 bg-amber-100/70 px-3 py-1 text-xs font-bold text-amber-700">
                                                    {t('paywall.cta.price', { price: selectedPlan === 'yearly' ? '$9.17' : '$11.99' })}
                                                </div>
                                                <ChevronRight className="w-5 h-5 text-amber-600" />
                                            </div>
                                        </div>
                                    )}
                                </Motion.button>
                            )}
                            {trialEligible && !purchaseBlocked && (
                                <p className="text-xs text-court-brownLight/70 text-center mt-2">
                                    {t('paywall.trialFootnote')}
                                </p>
                            )}

                            {/* Maybe Later Button */}
                            <button
                                onClick={onClose}
                                className="w-full mt-4 py-2 text-center text-court-brown/80 text-sm font-medium hover:text-court-brown transition-colors"
                            >
                                {t('paywall.maybeLater')}
                            </button>
                            <p className="text-xs text-court-brownLight/60 text-center">
                                {t('paywall.settingsHint')}
                            </p>
                        </div>
                    </Motion.div>
                </Motion.div>
            )}
        </AnimatePresence>
    );
};

export default Paywall;
