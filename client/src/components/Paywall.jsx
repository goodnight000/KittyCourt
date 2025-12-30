import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Crown, Heart, Check, Sparkles, Users, Zap, Gavel, Wand2, ChevronRight, Clock, Star, BookHeart } from 'lucide-react';
import useSubscriptionStore from '../store/useSubscriptionStore';

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
const Paywall = ({ isOpen, onClose, triggerReason = null }) => {
    const { purchaseGold, restorePurchases, isLoading, trialEligible } = useSubscriptionStore();
    const [restoring, setRestoring] = useState(false);
    const [error, setError] = useState(null);
    const [selectedPlan, setSelectedPlan] = useState('yearly');

    const handlePurchase = async () => {
        setError(null);
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

    // Outcome-focused benefits with varied colors
    const benefits = [
        {
            icon: Zap,
            title: 'Resolve Arguments Efficiently',
            description: 'Quick and effective resolutions before tensions escalate',
            color: '#C9921A',
            bgColor: 'rgba(201, 146, 26, 0.14)',
        },
        {
            icon: Gavel,
            title: 'Meet Judge Whiskers',
            description: 'Your wisest advisor trained for the tricky disagreements',
            color: '#B86B5E',
            bgColor: 'rgba(184, 107, 94, 0.14)',
        },
        {
            icon: Wand2,
            title: 'Effortless Quality Time',
            description: 'AI plans perfect date nights you\'ll actually love',
            color: '#8B7019',
            bgColor: 'rgba(139, 112, 25, 0.14)',
        },
        {
            icon: BookHeart,
            title: 'Never Lose The Plot',
            description: 'Personlized daily questions to keep the spark alive',
            color: '#5B8B6E',
            bgColor: 'rgba(91, 139, 110, 0.14)',
        },
    ];

    // Loss aversion - what they miss without Gold
    const withoutGold = [
        'Limited to just 3 judgments per month',
        'Judge Whiskers stays locked',
        'No AI-powered date planning',
        'Risk small issues becoming big fights',
    ];

    // Floating sparkle particles
    const SparkleParticles = () => (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(12)].map((_, i) => (
                <motion.div
                    key={i}
                    className="absolute"
                    initial={{
                        x: Math.random() * 100 + '%',
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
                        duration: 4 + Math.random() * 3,
                        repeat: Infinity,
                        delay: Math.random() * 4,
                        ease: 'easeOut',
                    }}
                >
                </motion.div>
            ))}
        </div>
    );

    const PaywallBackdrop = () => (
        <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-32 -right-20 h-64 w-64 rounded-full bg-amber-200/30 blur-3xl" />
            <div className="absolute top-20 -left-24 h-72 w-72 rounded-full bg-rose-200/25 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-amber-100/40 blur-3xl" />
            <div
                className="absolute inset-0 opacity-50"
                style={{
                    backgroundImage:
                        'radial-gradient(circle at 18% 20%, rgba(255,255,255,0.8) 0%, transparent 55%), radial-gradient(circle at 80% 12%, rgba(255,235,210,0.9) 0%, transparent 60%)'
                }}
            />
        </div>
    );


    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex flex-col overflow-hidden"
                    style={{
                        background: 'linear-gradient(180deg, #FFF9F0 0%, #F5EDE0 50%, #E8DCCB 100%)',
                    }}
                >
                    <PaywallBackdrop />
                    <SparkleParticles />

                    {/* Scrollable content - with bottom padding for sticky CTA */}
                    <div className="flex-1 overflow-y-auto px-6 pb-48 relative z-10">
                        {/* Hero Section - More Impactful */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="mt-14 mb-6"
                        >
                            <div className="relative overflow-hidden rounded-[32px] border border-white/80 bg-white/85 px-6 py-8 text-center shadow-soft-lg">
                                <div className="absolute -top-10 -right-10 h-24 w-24 rounded-full bg-amber-200/35 blur-2xl" />
                                <div className="absolute -bottom-12 -left-10 h-28 w-28 rounded-full bg-rose-200/30 blur-3xl" />
                                <motion.div
                                    initial={{ scale: 0, rotate: -180 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                                    className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-4 relative border border-amber-200/80 bg-amber-100/80 shadow-soft"
                                >
                                    <motion.div
                                        className="absolute inset-0 rounded-3xl border border-amber-300/70"
                                        animate={{
                                            scale: [1, 1.2, 1.2],
                                            opacity: [0.6, 0, 0],
                                        }}
                                        transition={{
                                            duration: 2,
                                            repeat: Infinity,
                                            ease: 'easeOut',
                                        }}
                                    />
                                    <Crown className="w-10 h-10 text-amber-700" />
                                </motion.div>

                                <motion.h1
                                    className="text-3xl font-bold text-court-brown mb-2 font-display"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                >
                                    Pause Gold
                                </motion.h1>
                                <motion.p
                                    className="text-court-brownLight text-sm max-w-xs mx-auto"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.4 }}
                                >
                                    For couples serious about staying close through every argument
                                </motion.p>
                            </div>
                        </motion.div>

                        {/* Free Trial Badge - Only show if eligible */}
                        {trialEligible && (
                            <motion.div
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
                                        Try FREE for 7 days — cancel anytime
                                    </span>
                                </div>
                            </motion.div>
                        )}

                        {/* Key Value Prop - Both Partners */}
                        <motion.div
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
                                    One subscription = Gold status for <span className="text-amber-600">both</span> of you
                                </span>
                                <motion.div
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                >
                                    <Heart className="w-4 h-4 text-amber-600" />
                                </motion.div>
                            </div>
                        </motion.div>

                        {/* Trigger Reason */}
                        {triggerReason && (
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-xs text-court-maroon text-center mb-4 bg-white/70 border border-amber-200/60 rounded-2xl px-3 py-2"
                            >
                                {triggerReason}
                            </motion.p>
                        )}

                        {/* Benefits Section - Outcome-Focused with Varied Colors */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.35 }}
                            className="mb-6"
                        >
                            <h3 className="text-[11px] font-semibold text-court-brownLight uppercase tracking-[0.3em] mb-3 font-display">
                                Transform Your Relationship
                            </h3>
                            <div className="space-y-3">
                                {benefits.map((benefit, index) => (
                                    <motion.div
                                        key={benefit.title}
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
                                                {benefit.title}
                                            </p>
                                            <p className="text-xs text-court-brownLight mt-0.5">
                                                {benefit.description}
                                            </p>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>

                        {/* Loss Aversion Section - MOVED ABOVE PRICING */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="mb-6 p-4 rounded-3xl bg-rose-50/60 border border-rose-200/70"
                        >
                            <h4 className="text-[11px] font-semibold text-rose-600 uppercase tracking-[0.3em] mb-3 font-display">
                                Without Gold...
                            </h4>
                            <ul className="space-y-1.5">
                                {withoutGold.map((item, index) => (
                                    <li key={index} className="flex items-center gap-2 text-sm text-court-brown/70">
                                        <X className="w-3.5 h-3.5 text-rose-500/70 flex-shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </motion.div>

                        {/* Pricing Plans */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.55 }}
                            className="mb-6 relative"
                        >

                            <h3 className="text-[11px] font-semibold text-court-brownLight uppercase tracking-[0.3em] mb-3 font-display">
                                Choose Your Plan
                            </h3>
                            <div className="space-y-3">
                                {/* Yearly Plan - Recommended */}
                                <motion.div
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
                                        ✨ BEST VALUE
                                    </div>
                                    <button
                                        onClick={() => setSelectedPlan('yearly')}
                                        className={`w-full p-4 pt-5 rounded-[28px] text-left transition-all duration-200 ease-out border relative overflow-hidden ${selectedPlan === 'yearly'
                                            ? 'border-amber-300/80 bg-white shadow-soft-lg'
                                            : 'border-white/80 bg-white/70 hover:border-amber-200/70'
                                            }`}
                                    >
                                        <div className="absolute inset-x-6 top-0 h-0.5 bg-gradient-to-r from-transparent via-amber-200/70 to-transparent" />
                                        <div className="flex items-center gap-3 relative z-10">
                                            {/* Selection Circle */}
                                            <div
                                                className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center border-2 transition-all duration-200"
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
                                                    <p className="font-bold text-court-brown font-display">Yearly</p>
                                                    <p className="text-xs text-court-brownLight">
                                                        {trialEligible ? '7 days free, then billed annually' : 'Billed annually'}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <div className="flex items-baseline gap-1.5">
                                                        <del className="text-sm text-court-brownLight/60 line-through">$9.99</del>
                                                        <span className="text-2xl font-bold text-court-brown font-display">$7.50</span>
                                                        <span className="text-sm text-court-brownLight">/mo</span>
                                                    </div>
                                                    <p className="text-xs text-green-600 font-semibold">Save 25%</p>
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                </motion.div>

                                {/* Monthly Plan */}
                                <motion.div
                                    animate={{ scale: selectedPlan === 'monthly' ? 1 : 0.94 }}
                                    transition={{ duration: 0.2, ease: 'easeOut' }}
                                >
                                    <button
                                        onClick={() => setSelectedPlan('monthly')}
                                        className={`w-full p-4 rounded-[28px] text-left transition-all duration-200 ease-out border relative overflow-hidden ${selectedPlan === 'monthly'
                                            ? 'border-amber-300/80 bg-white shadow-soft-lg'
                                            : 'border-white/80 bg-white/70 hover:border-amber-200/70'
                                            }`}
                                    >
                                        <div className="absolute inset-x-6 top-0 h-0.5 bg-gradient-to-r from-transparent via-amber-200/70 to-transparent" />
                                        <div className="flex items-center gap-3 relative z-10">
                                            {/* Selection Circle */}
                                            <div
                                                className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center border-2 transition-all duration-200"
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
                                                    <p className="font-bold text-court-brown font-display">Monthly</p>
                                                    <p className="text-xs text-court-brownLight">
                                                        {trialEligible ? '7 days free, then billed monthly' : 'Billed monthly'}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <div className="flex items-baseline gap-1">
                                                        <span className="text-2xl font-bold text-court-brown font-display">$9.99</span>
                                                        <span className="text-sm text-court-brownLight">/mo</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                </motion.div>
                            </div>

                            {/* Price context + Cancel anytime */}
                            <div className="text-center mt-3">
                                <p className="text-xs text-court-brownLight">
                                    {selectedPlan === 'yearly'
                                        ? '☕ Less than 2 coffees per month for a happier relationship'
                                        : '☕ Less than 3 coffees per month for a happier relationship'
                                    }
                                </p>
                                <p className="text-xs text-court-brownLight/70 mt-1 flex items-center justify-center gap-1">
                                    <Check className="w-3 h-3" />
                                    Cancel anytime
                                </p>
                            </div>
                        </motion.div>

                        {/* Social Proof - Specific Names */}
                        <motion.div
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
                                    "We used to argue for hours. Now it takes 2 minutes with Judge Whiskers. Game changer!"
                                </p>
                                <p className="text-xs text-court-brownLight text-center mt-2 font-medium">
                                    — Sarah & Mike, San Francisco
                                </p>
                                <p className="text-xs text-court-brownLight/60 text-center mt-1">
                                    Joined by 1,000+ happy couples
                                </p>
                            </div>
                        </motion.div>



                        {/* Error display */}
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-rose-50 text-rose-600 text-sm rounded-2xl p-3 mb-4 text-center border border-rose-200/70"
                            >
                                {error}
                            </motion.div>
                        )}

                        {/* Restore Purchases */}
                        <button
                            onClick={handleRestore}
                            disabled={isLoading || restoring}
                            className="w-full py-2 text-xs font-semibold text-court-brownLight hover:text-court-brown transition-colors disabled:opacity-50 mb-2"
                        >
                            {restoring ? 'Restoring...' : 'Restore Purchases'}
                        </button>

                        {/* Maybe Later with consequence */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.7 }}
                            className="text-center pb-4"
                        >
                        </motion.div>
                    </div>

                    {/* STICKY CTA BUTTON - Fixed at bottom */}
                    <motion.div
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
                            <motion.button
                                onClick={handlePurchase}
                                disabled={isLoading}
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.98 }}
                                className="w-full rounded-[28px] border border-amber-200/80 bg-white/90 px-4 py-4 text-left disabled:opacity-50 transition-all font-display relative overflow-hidden shadow-soft-lg"
                            >
                                <div className="absolute inset-x-6 top-0 h-0.5 bg-gradient-to-r from-transparent via-amber-200/80 to-transparent" />
                                <div className="absolute -top-8 -right-6 h-16 w-16 rounded-full bg-amber-200/35 blur-2xl" />
                                {isLoading ? (
                                    <div className="relative flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl border border-amber-200/70 bg-amber-100/70 flex items-center justify-center">
                                            <div className="w-5 h-5 border-2 border-amber-300/60 border-t-amber-700 rounded-full animate-spin" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-bold text-neutral-800">Processing...</div>
                                            <div className="text-xs text-neutral-500">Hang tight while we unlock Gold.</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="relative flex items-center gap-3">
                                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-200/70 bg-amber-100/70">
                                            <Sparkles className="w-5 h-5 text-amber-600" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-bold text-neutral-800">
                                                {trialEligible ? 'Start 7-Day Free Trial' : 'Subscribe Now'}
                                            </div>
                                            <div className="text-xs text-neutral-500">
                                                Cancel anytime · Gold for both of you
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="rounded-full border border-amber-200/70 bg-amber-100/70 px-3 py-1 text-xs font-bold text-amber-700">
                                                {selectedPlan === 'yearly' ? '$7.50/mo' : '$9.99/mo'}
                                            </div>
                                            <ChevronRight className="w-5 h-5 text-amber-600" />
                                        </div>
                                    </div>
                                )}
                            </motion.button>
                            {trialEligible && (
                                <p className="text-xs text-court-brownLight/70 text-center mt-2">
                                    You won't be charged for 7 days
                                </p>
                            )}

                            {/* Maybe Later Button */}
                            <button
                                onClick={onClose}
                                className="w-full mt-4 py-2 text-center text-court-brown/80 text-sm font-medium hover:text-court-brown transition-colors"
                            >
                                Maybe later — stay on free tier
                            </button>
                            <p className="text-xs text-court-brownLight/60 text-center">
                                You can upgrade anytime from Settings
                            </p>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default Paywall;
