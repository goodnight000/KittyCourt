import React, { useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Scale, Star, X } from 'lucide-react';
import useCourtStore from '../../store/useCourtStore';
import { useI18n } from '../../i18n';
import EmojiIcon from '../shared/EmojiIcon';
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion';

/**
 * Verdict Rating Component
 * 
 * Glassmorphic 1-5 star rating popup that appears after both users accept the verdict.
 * Features:
 * - Interactive star rating with hover effects
 * - Cat-themed rating descriptions
 * - Skip option for those who don't want to rate
 * - Celebration animation on submit
 */

const RATING_DESCRIPTIONS = {
    1: { textKey: 'court.rating.descriptions.one', emoji: '😾' },
    2: { textKey: 'court.rating.descriptions.two', emoji: '😿' },
    3: { textKey: 'court.rating.descriptions.three', emoji: '🐱' },
    4: { textKey: 'court.rating.descriptions.four', emoji: '😺' },
    5: { textKey: 'court.rating.descriptions.five', emoji: '😻' }
};

export default function VerdictRating({ onRate, onSkip }) {
    const [hoveredStar, setHoveredStar] = useState(0);
    const [selectedRating, setSelectedRating] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [localError, setLocalError] = useState('');
    const { t } = useI18n();
    const prefersReducedMotion = usePrefersReducedMotion();

    const {
        showRatingPopup,
        setShowRatingPopup,
        dismissRating,
        session,
        error: storeError
    } = useCourtStore();

    const handleSubmit = async () => {
        if (selectedRating === 0) return;

        setIsSubmitting(true);
        setLocalError('');
        try {
            if (onRate) {
                await onRate(selectedRating);
            }
            // Only close after successful submission.
            dismissRating(session?.id);
            setShowRatingPopup(false);
        } catch {
            setLocalError(t('court.rating.saveError'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSkip = () => {
        if (onSkip) {
            onSkip();
        }
        dismissRating(session?.id);
        setShowRatingPopup(false);
    };

    const displayRating = hoveredStar || selectedRating;
    const ratingInfo = RATING_DESCRIPTIONS[displayRating];
    const modalTransition = prefersReducedMotion
        ? { duration: 0.16 }
        : { type: 'spring', damping: 20, stiffness: 300 };

    return (
        <AnimatePresence>
            {showRatingPopup && (
                <Motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                >
                    {/* Backdrop */}
                    <Motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={prefersReducedMotion ? { duration: 0.12 } : undefined}
                        className={`absolute inset-0 bg-black/70 ${prefersReducedMotion ? 'backdrop-blur-sm' : 'backdrop-blur-md'}`}
                        onClick={handleSkip}
                    />

                    {/* Modal */}
                    <Motion.div
                        initial={{ scale: prefersReducedMotion ? 1 : 0.92, opacity: 0, y: prefersReducedMotion ? 8 : 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: prefersReducedMotion ? 1 : 0.92, opacity: 0, y: prefersReducedMotion ? 8 : 20 }}
                        transition={modalTransition}
                        className="relative z-10 w-full max-w-md"
                    >
                        {/* Glassmorphic Card */}
                        <div className="relative overflow-hidden rounded-3xl border border-court-gold/20 shadow-soft-lg">
                            {/* Gradient background - soft premium */}
                            <div className="absolute inset-0 bg-gradient-to-br from-court-ivory via-white to-court-tan/60" />

                            {/* Glass overlay - warm tint */}
                            <div className={`absolute inset-0 bg-white/60 ${prefersReducedMotion ? 'backdrop-blur-sm' : 'backdrop-blur-md'}`} />
                            <div className="absolute inset-x-8 top-0 h-0.5 bg-gradient-to-r from-transparent via-court-gold/60 to-transparent" />

                            {/* Content */}
                            <div className="relative p-8">
                                {/* Close button */}
                                <button
                                    onClick={handleSkip}
                                    className="absolute top-4 right-4 p-2 text-court-brownLight hover:text-court-brown transition"
                                >
                                    <X className="w-5 h-5" />
                                </button>

                                {/* Header */}
                                <div className="text-center mb-6">
                                    <Motion.div
                                        animate={prefersReducedMotion ? { opacity: 1 } : { rotate: [0, -5, 5, 0] }}
                                        transition={prefersReducedMotion ? { duration: 0.12 } : { duration: 0.5, delay: 0.3 }}
                                        className="mb-3 flex items-center justify-center"
                                    >
                                        <Scale className="w-12 h-12 text-court-gold" />
                                    </Motion.div>
                                    <h2 className="text-2xl font-bold text-court-brown mb-1">
                                        {t('court.rating.title')}
                                    </h2>
                                    <p className="text-court-brownLight text-sm">
                                        {t('court.rating.subtitle')}
                                    </p>
                                </div>

                                {(localError || storeError) && (
                                    <div className="mb-4 rounded-xl border border-rose-200/60 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                        {localError || storeError}
                                    </div>
                                )}

                                {/* Stars */}
                                <div className="flex justify-center gap-2 mb-4">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <Motion.button
                                            key={star}
                                            onMouseEnter={() => setHoveredStar(star)}
                                            onMouseLeave={() => setHoveredStar(0)}
                                            onClick={() => setSelectedRating(star)}
                                            whileHover={prefersReducedMotion ? undefined : { scale: 1.15 }}
                                            whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
                                            className="relative p-1"
                                        >
                                            <Star
                                                className={`w-10 h-10 transition-all duration-200 ${star <= displayRating
                                                    ? 'fill-current text-court-gold drop-shadow-[0_0_8px_rgba(212,175,55,0.5)]'
                                                    : 'fill-transparent text-court-tan/70'
                                                    }`}
                                            />
                                        </Motion.button>
                                    ))}
                                </div>

                                {/* Rating description */}
                                <div className="h-8 mb-6 text-center">
                                    <AnimatePresence mode="wait">
                                        {ratingInfo && (
                                            <Motion.p
                                                key={displayRating}
                                                initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -5 }}
                                                transition={prefersReducedMotion ? { duration: 0.1 } : undefined}
                                                className="text-lg text-court-brown inline-flex items-center justify-center gap-2"
                                            >
                                                <EmojiIcon emoji={ratingInfo.emoji} className="w-5 h-5 text-court-gold" />
                                                {t(ratingInfo.textKey)}
                                            </Motion.p>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-3">
                                    <button
                                        onClick={handleSkip}
                                        className="court-btn-secondary flex-1"
                                    >
                                        {t('court.rating.skip')}
                                    </button>
                                    <Motion.button
                                        onClick={handleSubmit}
                                        disabled={selectedRating === 0 || isSubmitting}
                                        whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
                                        whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                                        className={`flex-1 transition ${selectedRating > 0
                                            ? 'court-btn-primary'
                                            : 'py-3 px-4 rounded-xl font-semibold bg-court-tan/40 text-court-brownLight border border-court-tan/40 cursor-not-allowed'
                                            }`}
                                    >
                                        {isSubmitting ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <Motion.div
                                                    animate={{ rotate: 360 }}
                                                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                                    className="w-4 h-4 border-2 border-court-gold/40 border-t-court-gold rounded-full"
                                                />
                                                {t('court.rating.submitting')}
                                            </span>
                                        ) : (
                                            t('court.rating.submit')
                                        )}
                                    </Motion.button>
                                </div>

                                {/* Footer hint */}
                                <p className="text-center text-court-brownLight text-xs mt-4">
                                    {t('court.rating.footer')}
                                </p>
                            </div>
                        </div>
                    </Motion.div>
                </Motion.div>
            )}
        </AnimatePresence>
    );
}
