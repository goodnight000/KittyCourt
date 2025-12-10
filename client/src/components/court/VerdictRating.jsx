import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, X, Sparkles } from 'lucide-react';
import useCourtStore from '../../store/useCourtStore';

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
    1: { text: 'Hisss... disappointing', emoji: '😾' },
    2: { text: 'Could be better', emoji: '😿' },
    3: { text: 'Purrfectly fair', emoji: '🐱' },
    4: { text: 'Very wise ruling!', emoji: '😺' },
    5: { text: 'Absolutely purrfect!', emoji: '😻' }
};

export default function VerdictRating() {
    const [hoveredStar, setHoveredStar] = useState(0);
    const [selectedRating, setSelectedRating] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { showRatingPopup, submitRating, skipRating } = useCourtStore();

    const handleSubmit = async () => {
        if (selectedRating === 0) return;

        setIsSubmitting(true);
        await submitRating(selectedRating);
    };

    const displayRating = hoveredStar || selectedRating;
    const ratingInfo = RATING_DESCRIPTIONS[displayRating];

    console.log('[VerdictRating] showRatingPopup:', showRatingPopup);

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
                        onClick={skipRating}
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
                        <div className="relative overflow-hidden rounded-3xl">
                            {/* Gradient background */}
                            <div className="absolute inset-0 bg-gradient-to-br from-purple-900/80 via-indigo-900/80 to-slate-900/80" />

                            {/* Glass overlay */}
                            <div className="absolute inset-0 bg-white/5 backdrop-blur-xl" />

                            {/* Sparkle decorations */}
                            <div className="absolute top-4 right-8 text-yellow-400/30">
                                <Sparkles className="w-6 h-6" />
                            </div>
                            <div className="absolute bottom-8 left-6 text-purple-400/30">
                                <Sparkles className="w-4 h-4" />
                            </div>

                            {/* Content */}
                            <div className="relative p-8">
                                {/* Close button */}
                                <button
                                    onClick={skipRating}
                                    className="absolute top-4 right-4 p-2 text-white/40 hover:text-white/70 transition"
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
                                    <h2 className="text-2xl font-bold text-white mb-1">
                                        Rate This Verdict
                                    </h2>
                                    <p className="text-white/60 text-sm">
                                        How fair was Judge Whiskers' ruling?
                                    </p>
                                </div>

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
                                                    ? 'fill-yellow-400 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]'
                                                    : 'text-white/30'
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
                                                className="text-lg text-white/80"
                                            >
                                                <span className="mr-2">{ratingInfo.emoji}</span>
                                                {ratingInfo.text}
                                            </motion.p>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-3">
                                    <button
                                        onClick={skipRating}
                                        className="flex-1 py-3 px-4 rounded-xl text-white/50 hover:text-white/70 hover:bg-white/5 transition font-medium"
                                    >
                                        Skip
                                    </button>
                                    <motion.button
                                        onClick={handleSubmit}
                                        disabled={selectedRating === 0 || isSubmitting}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        className={`flex-1 py-3 px-4 rounded-xl font-semibold transition ${selectedRating > 0
                                            ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white shadow-lg shadow-yellow-500/25'
                                            : 'bg-white/10 text-white/30 cursor-not-allowed'
                                            }`}
                                    >
                                        {isSubmitting ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <motion.div
                                                    animate={{ rotate: 360 }}
                                                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                                    className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full"
                                                />
                                                Submitting...
                                            </span>
                                        ) : (
                                            'Submit Rating'
                                        )}
                                    </motion.button>
                                </div>

                                {/* Footer hint */}
                                <p className="text-center text-white/30 text-xs mt-4">
                                    Your rating helps Judge Whiskers improve! 🐱
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
