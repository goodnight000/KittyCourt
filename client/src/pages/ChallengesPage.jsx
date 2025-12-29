/**
 * ChallengesPage - Challenges page with API integration
 * 
 * Phase 2B: Uses useChallengeStore for API data.
 */
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, Sparkles, ChevronDown, ChevronUp, RefreshCw, AlertCircle } from 'lucide-react';
import ChallengeCard from '../components/ChallengeCard';
import useLevelStore from '../store/useLevelStore';
import useChallengeStore from '../store/useChallengeStore';
import useAuthStore from '../store/useAuthStore';

// Loading skeleton component
const ChallengeSkeleton = () => (
    <div className="rounded-2xl p-4 bg-neutral-100 animate-pulse">
        <div className="flex items-start gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-neutral-200" />
            <div className="flex-1 space-y-2">
                <div className="h-4 bg-neutral-200 rounded w-3/4" />
                <div className="h-3 bg-neutral-200 rounded w-1/2" />
            </div>
        </div>
        <div className="h-2 bg-neutral-200 rounded w-full" />
    </div>
);

const ChallengesPage = () => {
    const navigate = useNavigate();
    const { hasPartner, user } = useAuthStore();
    const { level, shouldShowChallenges, fetchLevel } = useLevelStore();
    const {
        active,
        available,
        completed,
        isLoading,
        error,
        fetchChallenges,
        skipChallenge,
        startChallenge,
        completeChallenge,
        confirmChallenge,
        clearError
    } = useChallengeStore();
    const [showCompleted, setShowCompleted] = useState(false);
    const currentUserId = user?.id || null;

    useEffect(() => {
        if (hasPartner) {
            fetchLevel();
            fetchChallenges();
        }
    }, [hasPartner, fetchLevel, fetchChallenges]);

    const handleSkip = async (id) => {
        await skipChallenge(id);
    };

    const handleStart = async (id) => {
        await startChallenge(id);
    };

    const handleComplete = async (id) => {
        await completeChallenge(id);
    };

    const handleConfirm = async (id) => {
        await confirmChallenge(id);
    };

    const handleRetry = () => {
        clearError();
        fetchChallenges();
    };

    // Progressive disclosure: Level 5+ required
    if (!shouldShowChallenges()) {
        return (
            <div className="p-4 min-h-screen bg-gradient-to-b from-neutral-50 to-neutral-100">
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-1 text-neutral-600 mb-6"
                >
                    <ArrowLeft className="w-5 h-5" />
                    <span>Back</span>
                </motion.button>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center py-16"
                >
                    <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-violet-100 to-pink-100 flex items-center justify-center mb-4">
                        <Trophy className="w-10 h-10 text-violet-400" />
                    </div>
                    <h2 className="text-xl font-bold text-neutral-800 mb-2">
                        Challenges Unlock at Level 5
                    </h2>
                    <p className="text-neutral-500 mb-4">
                        You're currently Level {level}. Keep earning XP together!
                    </p>
                    <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => navigate('/profile')}
                        className="px-6 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 text-white font-bold"
                    >
                        View Your Progress
                    </motion.button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="p-4 min-h-screen bg-gradient-to-b from-neutral-50 to-neutral-100">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 mb-6"
            >
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate(-1)}
                    className="p-2 rounded-xl bg-white shadow-sm"
                >
                    <ArrowLeft className="w-5 h-5 text-neutral-600" />
                </motion.button>
                <div className="flex-1">
                    <h1 className="text-xl font-bold text-neutral-800">Challenges</h1>
                    <p className="text-sm text-neutral-500">Earn XP together as a couple</p>
                </div>
                <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gradient-to-r from-violet-100 to-pink-100">
                    <Sparkles className="w-4 h-4 text-violet-500" />
                    <span className="text-sm font-bold text-violet-600">Level {level}</span>
                </div>
            </motion.div>

            {/* Error State */}
            {error && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 flex items-center gap-3"
                >
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <div className="flex-1">
                        <p className="text-sm text-red-700">{error}</p>
                    </div>
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={handleRetry}
                        className="p-2 rounded-lg bg-red-100 text-red-600"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </motion.button>
                </motion.div>
            )}

            {/* Loading State */}
            {isLoading && (
                <div className="space-y-3 mb-6">
                    <ChallengeSkeleton />
                    <ChallengeSkeleton />
                </div>
            )}

            {/* Active Challenges */}
            {!isLoading && active.length > 0 && (
                <section className="mb-6">
                    <h2 className="font-bold text-neutral-700 mb-3 flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-amber-500" />
                        Active Challenges
                    </h2>
                    <div className="space-y-3">
                        {active.map((challenge) => (
                            <ChallengeCard
                                key={challenge.id}
                                {...challenge}
                                actionLabel={
                                    challenge.requiresConfirmation
                                        ? challenge.confirmationStatus === 'none'
                                            ? 'Mark done'
                                            : challenge.confirmationStatus === 'pending'
                                                ? (challenge.confirmRequestedBy && challenge.confirmRequestedBy !== currentUserId
                                                    ? 'Confirm'
                                                    : 'Waiting')
                                                : null
                                        : null
                                }
                                actionDisabled={
                                    challenge.requiresConfirmation
                                        && challenge.confirmationStatus === 'pending'
                                        && (!challenge.confirmRequestedBy || challenge.confirmRequestedBy === currentUserId)
                                }
                                onAction={() => {
                                    if (!challenge.requiresConfirmation) return;
                                    if (challenge.confirmationStatus === 'none') {
                                        handleComplete(challenge.id);
                                    } else if (challenge.confirmationStatus === 'pending'
                                        && challenge.confirmRequestedBy
                                        && challenge.confirmRequestedBy !== currentUserId) {
                                        handleConfirm(challenge.id);
                                    }
                                }}
                                onSkip={() => handleSkip(challenge.id)}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* Available Challenges */}
            {!isLoading && available.length > 0 && (
                <section className="mb-6">
                    <h2 className="font-bold text-neutral-700 mb-3">Available to Start</h2>
                    <div className="space-y-3">
                        {available.map((challenge) => (
                            <ChallengeCard
                                key={challenge.id}
                                {...challenge}
                                onClick={() => handleStart(challenge.id)}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* Completed Challenges (Collapsible) */}
            {!isLoading && completed.length > 0 && (
                <section>
                    <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowCompleted(!showCompleted)}
                        className="w-full flex items-center justify-between py-3 text-neutral-600"
                    >
                        <span className="font-bold">
                            Completed ({completed.length})
                        </span>
                        {showCompleted ? (
                            <ChevronUp className="w-5 h-5" />
                        ) : (
                            <ChevronDown className="w-5 h-5" />
                        )}
                    </motion.button>

                    <AnimatePresence>
                        {showCompleted && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="space-y-3 overflow-hidden"
                            >
                                {completed.map((challenge) => (
                                    <ChallengeCard
                                        key={challenge.id}
                                        {...challenge}
                                    />
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </section>
            )}

            {/* Empty state */}
            {!isLoading && !error && active.length === 0 && available.length === 0 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-12"
                >
                    <div className="w-16 h-16 mx-auto rounded-full bg-neutral-100 flex items-center justify-center mb-4">
                        <Trophy className="w-8 h-8 text-neutral-300" />
                    </div>
                    <p className="text-neutral-500">No active challenges right now</p>
                    <p className="text-sm text-neutral-400 mt-1">Check back tomorrow for new ones!</p>
                </motion.div>
            )}
        </div>
    );
};

export default ChallengesPage;
