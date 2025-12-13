/**
 * Courtroom Page - Clean Architecture (WS-first)
 * Uses new courtStore + useCourtSocket.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Gavel, MessageCircle, Heart, Send } from 'lucide-react';

import useAuthStore from '../store/useAuthStore';
import useCourtStore, { VIEW_PHASE } from '../store/courtStore';
import RequirePartner from '../components/RequirePartner';

import {
    CourtAtRest,
    CelebrationAnimation,
    CourtOpeningAnimation,
    WaitingForPartner,
    WaitingForEvidence,
    SummonsReceived,
    VerdictView,
    VerdictRating,
    DeliberatingScreen,
    SettlementButton
} from '../components/court';

export default function CourtroomPageV2() {
    const navigate = useNavigate();

    const { user: authUser, profile, partner } = useAuthStore();

    const {
        myViewPhase,
        session,
        localEvidence,
        localFeelings,
        localAddendum,
        isSubmitting,
        isGeneratingVerdict,
        error,
        setLocalEvidence,
        setLocalFeelings,
        setLocalAddendum,
        setShowRatingPopup,
        markVerdictSeen,
        serve,
        accept,
        cancel,
        submitEvidence,
        acceptVerdict,
        submitAddendum,
        submitVerdictRating,
        fetchState,
        reset
    } = useCourtStore();

    const { isConnected } = useCourtStore();

    const myName = profile?.display_name || profile?.name || 'You';
    const partnerName = partner?.display_name || partner?.name || 'Partner';

    const isCreator = session?.creatorId === authUser?.id;

    const verdictResponse = session?.verdict;
    const verdict = useMemo(() => {
        if (!verdictResponse) return null;
        return verdictResponse.judgeContent || verdictResponse;
    }, [verdictResponse]);

    const analysis = useMemo(() => {
        if (!verdictResponse) return null;
        return verdictResponse?._meta?.analysis || null;
    }, [verdictResponse]);

    const activeCase = useMemo(() => {
        return {
            userAAccepted: !!session?.verdictAcceptances?.creator,
            userBAccepted: !!session?.verdictAcceptances?.partner
        };
    }, [session?.verdictAcceptances?.creator, session?.verdictAcceptances?.partner]);

    // Fetch state on mount if WS isn't connected.
    useEffect(() => {
        if (authUser?.id && !session && !isConnected) {
            fetchState();
        }
    }, [authUser?.id, session, isConnected, fetchState]);

    // Opening animation: play when transitioning from PENDING → EVIDENCE.
    const prevViewPhaseRef = useRef(myViewPhase);
    const [showOpeningAnimation, setShowOpeningAnimation] = useState(false);
    const [showCelebration, setShowCelebration] = useState(false);
    useEffect(() => {
        const prev = prevViewPhaseRef.current;
        const next = myViewPhase;
        prevViewPhaseRef.current = next;

        const cameFromPending = prev === VIEW_PHASE.PENDING_CREATOR || prev === VIEW_PHASE.PENDING_PARTNER;
        if (cameFromPending && next === VIEW_PHASE.EVIDENCE) {
            setShowOpeningAnimation(true);
        }

        const cameFromVerdictFlow = prev === VIEW_PHASE.VERDICT || prev === VIEW_PHASE.WAITING_ACCEPT;
        if (cameFromVerdictFlow && next === VIEW_PHASE.CLOSED) {
            // Celebration first, then rating.
            setShowRatingPopup(false);
            setShowCelebration(true);
        } else if (prev !== VIEW_PHASE.CLOSED && next === VIEW_PHASE.CLOSED) {
            // If we didn't witness the verdict flow (e.g. came back later), just show rating.
            setShowRatingPopup(true);
        }
    }, [myViewPhase, setShowRatingPopup]);

    // Bug fix: If we sent an action but didn't get a state update (WS hiccup), force a REST resync.
    const lastSyncAt = useCourtStore((s) => s.lastSyncAt);
    useEffect(() => {
        if (!isSubmitting) return;
        const t = setTimeout(() => {
            const stale = !lastSyncAt || Date.now() - lastSyncAt > 2500;
            if (stale) {
                fetchState({ force: true });
            }
        }, 2600);
        return () => clearTimeout(t);
    }, [isSubmitting, lastSyncAt, fetchState]);

    // If a verdict arrives, clear the dock indicator once the user has viewed it.
    useEffect(() => {
        if (!session?.verdict) return;
        if (myViewPhase === VIEW_PHASE.VERDICT || myViewPhase === VIEW_PHASE.WAITING_ACCEPT) {
            markVerdictSeen();
        }
    }, [myViewPhase, session?.verdict, markVerdictSeen]);

    const handleCelebrationComplete = () => {
        setShowCelebration(false);
        setShowRatingPopup(true);
    };

    const [showAddendumModal, setShowAddendumModal] = useState(false);

    const handleServe = async (judgeType = 'logical') => {
        const partnerId = partner?.id;
        if (!partnerId) return;
        await serve(partnerId, null, judgeType);
    };

    const handleSubmitEvidence = async () => {
        await submitEvidence();
    };

    const handleSubmitAddendum = async () => {
        // Close immediately for snappy UX (submission continues in background).
        setShowAddendumModal(false);
        await submitAddendum();
    };

    const renderContent = () => {
        // Bug 1: Ensure opening animation shows BEFORE evidence UI is visible.
        if (showOpeningAnimation && myViewPhase === VIEW_PHASE.EVIDENCE) {
            return null;
        }
        switch (myViewPhase) {
            case VIEW_PHASE.IDLE:
                return <CourtAtRest onServe={handleServe} navigate={navigate} />;

            case VIEW_PHASE.PENDING_CREATOR:
                return (
                    <WaitingForPartner
                        session={session}
                        partnerName={partnerName}
                        myName={myName}
                        isCreator
                        onCancel={cancel}
                    />
                );

            case VIEW_PHASE.PENDING_PARTNER:
                return <SummonsReceived session={session} senderName={partnerName} onJoin={accept} />;

            case VIEW_PHASE.EVIDENCE:
                return (
                    <EvidenceForm
                        localEvidence={localEvidence}
                        localFeelings={localFeelings}
                        setLocalEvidence={setLocalEvidence}
                        setLocalFeelings={setLocalFeelings}
                        onSubmit={handleSubmitEvidence}
                        isSubmitting={isSubmitting}
                        myName={myName}
                        partnerName={partnerName}
                    />
                );

            case VIEW_PHASE.WAITING_EVIDENCE:
                return <WaitingForEvidence session={session} partnerName={partnerName} myName={myName} />;

            case VIEW_PHASE.DELIBERATING:
                return <DeliberatingScreen isLoading={isGeneratingVerdict || true} />;

            case VIEW_PHASE.WAITING_ACCEPT:
            case VIEW_PHASE.VERDICT: {
                const userAName = isCreator ? myName : partnerName;
                const userBName = isCreator ? partnerName : myName;

                return (
                    <VerdictView
                        activeCase={activeCase}
                        verdict={verdict}
                        analysis={analysis}
                        allVerdicts={verdict ? [{ ...verdict, version: 0 }] : []}
                        selectedVerdictVersion={0}
                        setSelectedVerdictVersion={() => { }}
                        userAName={userAName}
                        userBName={userBName}
                        setShowAddendumModal={setShowAddendumModal}
                        resetCase={reset}
                        navigate={navigate}
                        currentUser={null}
                        onAcceptVerdict={acceptVerdict}
                        isInitiator={isCreator}
                    />
                );
            }

            case VIEW_PHASE.CLOSED:
                return <CourtAtRest onServe={handleServe} navigate={navigate} />;

            default:
                return <CourtAtRest onServe={handleServe} navigate={navigate} />;
        }
    };

    return (
        <RequirePartner>
            <div className="min-h-screen bg-gradient-to-b from-court-cream to-court-tan/20 p-4">
                {showOpeningAnimation && (
                    <CourtOpeningAnimation onComplete={() => setShowOpeningAnimation(false)} />
                )}

                {showCelebration && (
                    <CelebrationAnimation onComplete={handleCelebrationComplete} />
                )}

                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-sm"
                    >
                        {error}
                    </motion.div>
                )}

                {renderContent()}

                <AddendumModal
                    open={showAddendumModal}
                    onClose={() => setShowAddendumModal(false)}
                    value={localAddendum}
                    onChange={setLocalAddendum}
                    onSubmit={handleSubmitAddendum}
                    isSubmitting={isSubmitting}
                />

                {/* Rating popup mounts globally so it can appear after CLOSED */}
                <VerdictRating
                    onRate={(rating) => submitVerdictRating(rating)}
                    onSkip={() => reset()}
                />
            </div>
        </RequirePartner>
    );
}

function EvidenceForm({
    localEvidence,
    localFeelings,
    setLocalEvidence,
    setLocalFeelings,
    onSubmit,
    isSubmitting,
    myName,
    partnerName
}) {
    return (
        <div className="space-y-5">
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-4 bg-gradient-to-br from-court-cream to-court-tan/30"
            >
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-court-gold/20 to-court-tan rounded-xl flex items-center justify-center">
                            <Gavel className="w-5 h-5 text-court-gold" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-court-brown">Court in Session</h1>
                            <p className="text-xs text-court-brownLight">Present your evidence</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                        LIVE
                    </div>
                </div>

                <div className="flex items-center justify-center gap-4">
                    <div className="flex flex-col items-center text-center min-w-[80px]">
                        <p className="text-sm font-bold text-court-brown">{myName}</p>
                        <p className="text-[10px] text-court-brownLight">You</p>
                    </div>
                    <div className="text-court-tan font-bold text-lg">vs</div>
                    <div className="flex flex-col items-center text-center min-w-[80px]">
                        <p className="text-sm font-bold text-court-brown">{partnerName}</p>
                        <p className="text-[10px] text-court-brownLight">Partner</p>
                    </div>
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-card p-4 space-y-5"
            >
                <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-court-brown mb-2">
                        <MessageCircle className="w-4 h-4" />
                        The Facts
                    </label>
                    <textarea
                        value={localEvidence}
                        onChange={(e) => setLocalEvidence(e.target.value)}
                        placeholder="What happened? Describe the situation objectively..."
                        className="w-full h-32 px-4 py-3 rounded-xl border-2 border-court-tan/30 
                            focus:border-court-gold focus:ring-2 focus:ring-court-gold/20 
                            bg-white/50 text-court-brown placeholder-court-brownLight/50
                            transition-all resize-none"
                    />
                </div>

                <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-court-brown mb-2">
                        <Heart className="w-4 h-4" />
                        The Feelings
                    </label>
                    <textarea
                        value={localFeelings}
                        onChange={(e) => setLocalFeelings(e.target.value)}
                        placeholder="How did this make you feel? What story are you telling yourself?"
                        className="w-full h-32 px-4 py-3 rounded-xl border-2 border-court-tan/30 
                            focus:border-court-gold focus:ring-2 focus:ring-court-gold/20 
                            bg-white/50 text-court-brown placeholder-court-brownLight/50
                            transition-all resize-none"
                    />
                </div>

                <div className="space-y-3">
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={onSubmit}
                        disabled={isSubmitting || !localEvidence.trim() || !localFeelings.trim()}
                        className="w-full py-3 px-4 rounded-xl text-white font-extrabold flex items-center justify-center gap-2
                            disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                        style={{ background: 'linear-gradient(135deg, #1c1c84 0%, #000035 100%)' }}
                    >
                        {isSubmitting ? (
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                            />
                        ) : (
                            <>
                                <Send className="w-5 h-5" />
                                Submit Evidence
                            </>
                        )}
                    </motion.button>

                    <SettlementButton className="w-full" />

                    <p className="text-center text-xs text-court-brownLight/80">
                        ✨ Judge Whiskers values honesty and emotional vulnerability ✨
                    </p>
                </div>
            </motion.div>
        </div>
    );
}

function AddendumModal({ open, onClose, value, onChange, onSubmit, isSubmitting }) {
    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.98, opacity: 0 }}
                        className="glass-card p-5 max-w-md w-full max-h-[80dvh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-bold text-court-brown mb-2">File an Addendum</h3>
                        <p className="text-sm text-court-brownLight mb-4">
                            Add any missing context. The court will re-deliberate and replace the verdict.
                        </p>
                        <textarea
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            placeholder="What did Judge Whiskers not consider?"
                            className="w-full h-32 px-4 py-3 rounded-xl border-2 border-court-tan/30 
                                focus:border-court-gold focus:ring-2 focus:ring-court-gold/20 
                                bg-white/50 text-court-brown placeholder-court-brownLight/50
                                transition-all resize-none"
                        />
                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={onClose}
                                className="flex-1 py-2 px-4 rounded-lg border border-court-tan text-court-brown"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={onSubmit}
                                disabled={isSubmitting || !value?.trim()}
                                className="flex-1 py-2 px-4 rounded-lg text-white font-extrabold disabled:opacity-50 shadow-lg"
                                style={{ background: 'linear-gradient(135deg, #1c1c84 0%, #000035 100%)' }}
                            >
                                Submit
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
