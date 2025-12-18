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
            color: '#FF6B6B', // Coral
            bgColor: 'rgba(255, 107, 107, 0.12)',
        },
        {
            icon: Gavel,
            title: 'Meet Judge Whiskers',
            description: 'Your wisest advisor trained for the tricky disagreements',
            color: '#9B59B6', // Purple
            bgColor: 'rgba(155, 89, 182, 0.12)',
        },
        {
            icon: Wand2,
            title: 'Effortless Quality Time',
            description: 'AI plans perfect date nights you\'ll actually love',
            color: '#3498DB', // Blue
            bgColor: 'rgba(52, 152, 219, 0.12)',
        },
        {
            icon: BookHeart,
            title: 'Never Lose The Plot',
            description: 'Personlized daily questions to keep the spark alive',
            color: '#27AE60', // Green
            bgColor: 'rgba(39, 174, 96, 0.12)',
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
                    <Sparkles
                        className="text-court-gold/40"
                        style={{ width: 12 + Math.random() * 12, height: 12 + Math.random() * 12 }}
                    />
                </motion.div>
            ))}
        </div>
    );


    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex flex-col"
                    style={{
                        background: 'linear-gradient(180deg, #FFFBF5 0%, #F5EDE0 50%, #E6D5C3 100%)',
                    }}
                >

                    {/* Scrollable content - with bottom padding for sticky CTA */}
                    <div className="flex-1 overflow-y-auto px-6 pb-48 relative z-10">
                        {/* Hero Section - More Impactful */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}

                            className="text-center mt-20 mb-6"
                        >
                            {/* Glowing Animated Crown */}
                            <motion.div
                                initial={{ scale: 0, rotate: -180 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                                className="inline-flex items-center justify-center w-24 h-24 rounded-full mb-4 relative"
                                style={{
                                    background: 'linear-gradient(135deg, #D4AF37 0%, #B8972E 100%)',
                                    boxShadow: '0 0 60px rgba(212, 175, 55, 0.5), 0 0 100px rgba(212, 175, 55, 0.3), 0 12px 40px rgba(212, 175, 55, 0.4)',
                                }}
                            >
                                {/* Pulsing ring */}
                                <motion.div
                                    className="absolute inset-0 rounded-full border-2 border-court-gold"
                                    animate={{
                                        scale: [1, 1.3, 1.3],
                                        opacity: [0.6, 0, 0],
                                    }}
                                    transition={{
                                        duration: 2,
                                        repeat: Infinity,
                                        ease: 'easeOut',
                                    }}
                                />
                                <Crown className="w-12 h-12 text-white" />
                            </motion.div>

                            <motion.h1
                                className="text-4xl font-bold text-court-brown mb-2 font-display"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                            >
                                Pause Gold
                            </motion.h1>
                            <motion.p
                                className="text-court-brownLight text-base max-w-xs mx-auto"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.4 }}
                            >
                                For couples serious about staying close through every argument
                            </motion.p>
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
                                        background: 'linear-gradient(135deg, rgba(39, 174, 96, 0.15) 0%, rgba(46, 204, 113, 0.1) 100%)',
                                        border: '1.5px solid rgba(39, 174, 96, 0.4)',
                                    }}
                                >
                                    <Clock className="w-5 h-5 text-green-600" />
                                    <span className="text-sm font-bold text-green-700 font-display">
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
                                    background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.15) 0%, rgba(184, 151, 46, 0.1) 100%)',
                                    border: '1px solid rgba(212, 175, 55, 0.3)',
                                }}
                            >
                                <Users className="w-5 h-5 text-court-gold" />
                                <span className="text-sm font-semibold text-court-brown font-display">
                                    One subscription = Gold status for <span className="text-court-gold">both</span> of you
                                </span>
                                <motion.div
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                >
                                    <Heart className="w-4 h-4 text-court-gold" />
                                </motion.div>
                            </div>
                        </motion.div>

                        {/* Trigger Reason */}
                        {triggerReason && (
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-xs text-court-maroon text-center mb-4 bg-court-tan/30 rounded-lg px-3 py-2"
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
                            <h3 className="text-sm font-bold text-court-brownLight uppercase tracking-wider mb-3 font-display">
                                Transform Your Relationship
                            </h3>
                            <div className="space-y-2.5">
                                {benefits.map((benefit, index) => (
                                    <motion.div
                                        key={benefit.title}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.4 + index * 0.05 }}
                                        className="flex items-start gap-3 p-3 rounded-xl bg-white/70 border border-white/80 mt-2"
                                        style={{ boxShadow: '0 2px 8px rgba(74, 55, 40, 0.04)' }}
                                    >
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
                            className="mb-6 p-4 rounded-2xl bg-court-tan/20 border border-court-tan/30"
                        >
                            <h4 className="text-xs font-bold text-court-brownLight uppercase tracking-wider mb-3 font-display">
                                Without Gold...
                            </h4>
                            <ul className="space-y-1.5">
                                {withoutGold.map((item, index) => (
                                    <li key={index} className="flex items-center gap-2 text-sm text-court-brown/70">
                                        <X className="w-3.5 h-3.5 text-court-maroon/70 flex-shrink-0" />
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

                            <h3 className="text-sm font-bold text-court-brownLight uppercase tracking-wider mb-3 font-display">
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
                                        className="absolute -top-3 left-4 px-3 py-1 rounded-full text-xs font-bold text-white font-display z-20"
                                        style={{
                                            background: 'linear-gradient(135deg, #D4AF37 0%, #B8972E 100%)',
                                            boxShadow: '0 2px 8px rgba(212, 175, 55, 0.4)',
                                        }}
                                    >
                                        ✨ BEST VALUE
                                    </div>
                                    <button
                                        onClick={() => setSelectedPlan('yearly')}
                                        className={`w-full p-4 pt-5 rounded-2xl text-left transition-all duration-200 ease-out border-2 relative overflow-hidden ${selectedPlan === 'yearly'
                                            ? 'border-court-gold bg-white shadow-lg'
                                            : 'border-court-tan/50 bg-white/50 hover:border-court-tan'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3 relative z-10">
                                            {/* Selection Circle */}
                                            <div
                                                className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center border-2 transition-all duration-200"
                                                style={{
                                                    borderColor: selectedPlan === 'yearly' ? '#D4AF37' : '#D4C4A8',
                                                    backgroundColor: selectedPlan === 'yearly' ? '#D4AF37' : 'white',
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
                                        className={`w-full p-4 rounded-2xl text-left transition-all duration-200 ease-out border-2 relative overflow-hidden ${selectedPlan === 'monthly'
                                            ? 'border-court-gold bg-white shadow-lg'
                                            : 'border-court-tan/50 bg-white/50 hover:border-court-tan'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3 relative z-10">
                                            {/* Selection Circle */}
                                            <div
                                                className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center border-2 transition-all duration-200"
                                                style={{
                                                    borderColor: selectedPlan === 'monthly' ? '#D4AF37' : '#D4C4A8',
                                                    backgroundColor: selectedPlan === 'monthly' ? '#D4AF37' : 'white',
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
                            <div className="p-4 rounded-2xl bg-white/60 border border-white/80">
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
                                className="bg-red-50 text-red-600 text-sm rounded-xl p-3 mb-4 text-center border border-red-100"
                            >
                                {error}
                            </motion.div>
                        )}

                        {/* Restore Purchases */}
                        <button
                            onClick={handleRestore}
                            disabled={isLoading || restoring}
                            className="w-full py-2 text-sm text-court-brownLight hover:text-court-brown transition-colors disabled:opacity-50 mb-2"
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
                            background: 'linear-gradient(to top, rgba(230, 213, 195, 1) 0%, rgba(230, 213, 195, 0.95) 70%, transparent 100%)',
                        }}
                    >
                        {/* Safe area padding for iOS */}
                        <div className="safe-bottom">
                            <motion.button
                                onClick={handlePurchase}
                                disabled={isLoading}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50 transition-all font-display text-lg relative overflow-hidden"
                                style={{
                                    background: 'linear-gradient(135deg, #27AE60 0%, #219A52 100%)',
                                    boxShadow: '0 8px 32px rgba(39, 174, 96, 0.4), 0 4px 12px rgba(39, 174, 96, 0.3)',
                                }}
                            >
                                {/* Shimmer effect */}
                                <motion.div
                                    className="absolute inset-0 opacity-20"
                                    style={{
                                        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                                    }}
                                    animate={{
                                        x: ['-100%', '100%'],
                                    }}
                                    transition={{
                                        duration: 2,
                                        repeat: Infinity,
                                        repeatDelay: 1,
                                    }}
                                />
                                {isLoading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-5 h-5" />
                                        {trialEligible ? 'Start 7-Day Free Trial' : 'Subscribe Now'}
                                        <ChevronRight className="w-5 h-5" />
                                    </>
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
