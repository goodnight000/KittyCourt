import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, X } from 'lucide-react';
import useCourtStore from '../../store/useCourtStore';
import { useI18n } from '../../i18n';

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
        } catch (e) {
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

    return (
        <AnimatePresence>
            {showRatingPopup && (
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
                        className="absolute inset-0 bg-black/70 backdrop-blur-md"
                        onClick={handleSkip}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.8, opacity: 0, y: 20 }}
                        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                        className="relative z-10 w-full max-w-md"
                    >
                        {/* Glassmorphic Card */}
                        <div className="relative overflow-hidden rounded-3xl border border-court-gold/20 shadow-soft-lg">
                            {/* Gradient background - soft premium */}
                            <div className="absolute inset-0 bg-gradient-to-br from-court-ivory via-white to-court-tan/60" />

                            {/* Glass overlay - warm tint */}
                            <div className="absolute inset-0 bg-white/60 backdrop-blur-xl" />
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
                                    <motion.div
                                        animate={{ rotate: [0, -5, 5, 0] }}
                                        transition={{ duration: 0.5, delay: 0.3 }}
                                        className="text-5xl mb-3"
                                    >
                                        ⚖️
                                    </motion.div>
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
                                        <motion.button
                                            key={star}
                                            onMouseEnter={() => setHoveredStar(star)}
                                            onMouseLeave={() => setHoveredStar(0)}
                                            onClick={() => setSelectedRating(star)}
                                            whileHover={{ scale: 1.15 }}
                                            whileTap={{ scale: 0.95 }}
                                            className="relative p-1"
                                        >
                                            <Star
                                                className={`w-10 h-10 transition-all duration-200 ${star <= displayRating
                                                    ? 'fill-court-gold text-court-gold drop-shadow-[0_0_8px_rgba(212,175,55,0.5)]'
                                                    : 'text-court-tan/70'
                                                    }`}
                                            />
                                            {star <= displayRating && (
                                                <motion.div
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    className="absolute inset-0 flex items-center justify-center"
                                                >
                                                    <div className="w-2 h-2 rounded-full bg-yellow-200 blur-sm" />
                                                </motion.div>
                                            )}
                                        </motion.button>
                                    ))}
                                </div>

                                {/* Rating description */}
                                <div className="h-8 mb-6 text-center">
                                    <AnimatePresence mode="wait">
                                        {ratingInfo && (
                                            <motion.p
                                                key={displayRating}
                                                initial={{ opacity: 0, y: 5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -5 }}
                                                className="text-lg text-court-brown"
                                            >
                                                <span className="mr-2">{ratingInfo.emoji}</span>
                                                {t(ratingInfo.textKey)}
                                            </motion.p>
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
                                    <motion.button
                                        onClick={handleSubmit}
                                        disabled={selectedRating === 0 || isSubmitting}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        className={`flex-1 transition ${selectedRating > 0
                                            ? 'court-btn-primary'
                                            : 'py-3 px-4 rounded-xl font-semibold bg-court-tan/40 text-court-brownLight border border-court-tan/40 cursor-not-allowed'
                                            }`}
                                    >
                                        {isSubmitting ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <motion.div
                                                    animate={{ rotate: 360 }}
                                                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                                    className="w-4 h-4 border-2 border-court-gold/40 border-t-court-gold rounded-full"
                                                />
                                                {t('court.rating.submitting')}
                                            </span>
                                        ) : (
                                            t('court.rating.submit')
                                        )}
                                    </motion.button>
                                </div>

                                {/* Footer hint */}
                                <p className="text-center text-court-brownLight text-xs mt-4">
                                    {t('court.rating.footer')}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
