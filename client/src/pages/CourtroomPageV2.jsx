/**
 * Courtroom Page - Clean Architecture (WS-first)
 * Uses new courtStore + useCourtSocket.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
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
    SettlementButton,
    PrimingPage,
    JointMenuPage,
    ResolutionSelectPage,
    WaitingForPartnerStep
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
        showOpeningAnimation,
        showCelebrationAnimation,
        error,
        dismissedRatingSessionId,
        setLocalEvidence,
        setLocalFeelings,
        setLocalAddendum,
        setShowOpeningAnimation,
        setShowCelebrationAnimation,
        setShowRatingPopup,
        markVerdictSeen,
        serve,
        accept,
        cancel,
        dismiss,
        submitEvidence,
        acceptVerdict,
        submitAddendum,
        submitVerdictRating,
        markPrimingComplete,
        markJointReady,
        submitResolutionPick,
        fetchState,
        reset
    } = useCourtStore();

    const { isConnected } = useCourtStore();

    const myName = profile?.display_name || profile?.name || 'You';
    const partnerName = partner?.display_name || partner?.name || 'Partner';

    const isCreator = session?.creatorId === authUser?.id;

    const verdictResponse = session?.verdict;
    const verdictError = verdictResponse?.status && verdictResponse.status !== 'success'
        ? verdictResponse
        : null;
    const verdict = useMemo(() => {
        if (!verdictResponse) return null;
        return verdictResponse.judgeContent || verdictResponse;
    }, [verdictResponse]);

    const analysis = useMemo(() => {
        if (verdictResponse?._meta?.analysis) return verdictResponse._meta.analysis;
        return session?.analysis?.analysis || null;
    }, [verdictResponse, session?.analysis]);

    const primingContent = useMemo(() => {
        if (!session?.primingContent) return null;
        return isCreator ? session.primingContent.userA : session.primingContent.userB;
    }, [session?.primingContent, isCreator]);

    const jointMenu = session?.jointMenu || null;
    const resolutions = session?.resolutions || [];
    const addendumLimit = session?.addendumLimit ?? 2;
    const addendumCount = session?.addendumCount ?? 0;
    const addendumRemaining = session?.addendumRemaining ?? Math.max(addendumLimit - addendumCount, 0);

    const myPick = useMemo(() => {
        if (!session?.resolutionPicks) return null;
        return isCreator ? session.resolutionPicks.userA : session.resolutionPicks.userB;
    }, [session?.resolutionPicks, isCreator]);

    const mismatchOriginal = session?.mismatchOriginal || null;
    const mismatchPicks = session?.mismatchPicks || null;
    const myMismatchPick = mismatchPicks
        ? (isCreator ? mismatchPicks.userA : mismatchPicks.userB)
        : null;
    const myOriginalPickId = mismatchOriginal
        ? (isCreator ? mismatchOriginal.userA : mismatchOriginal.userB)
        : null;
    const partnerOriginalPickId = mismatchOriginal
        ? (isCreator ? mismatchOriginal.userB : mismatchOriginal.userA)
        : null;

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
    useEffect(() => {
        const prev = prevViewPhaseRef.current;
        const next = myViewPhase;
        prevViewPhaseRef.current = next;
        const ratingDismissed = session?.id && dismissedRatingSessionId === session.id;

        const cameFromPending = prev === VIEW_PHASE.PENDING_CREATOR || prev === VIEW_PHASE.PENDING_PARTNER;
        if (cameFromPending && next === VIEW_PHASE.EVIDENCE) {
            setShowOpeningAnimation(true);
        }

        const cameFromVerdictFlow = prev === VIEW_PHASE.VERDICT || prev === VIEW_PHASE.WAITING_ACCEPT;
        if (cameFromVerdictFlow && next === VIEW_PHASE.CLOSED) {
            // Celebration first, then rating.
            setShowRatingPopup(false);
            if (!ratingDismissed) {
                setShowCelebrationAnimation(true);
            }
        } else if (prev !== VIEW_PHASE.CLOSED && next === VIEW_PHASE.CLOSED) {
            // If we didn't witness the verdict flow (e.g. came back later), just show rating.
            if (!ratingDismissed) {
                setShowRatingPopup(true);
            }
        }
    }, [myViewPhase, session?.id, dismissedRatingSessionId, setShowRatingPopup, setShowOpeningAnimation, setShowCelebrationAnimation]);

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
        setShowCelebrationAnimation(false);
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
        if (addendumRemaining <= 0) {
            return;
        }
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

            case VIEW_PHASE.ANALYZING:
                return <DeliberatingScreen isLoading={isGeneratingVerdict || true} />;

            case VIEW_PHASE.PRIMING:
                return (
                    <PrimingPage
                        priming={primingContent}
                        myName={myName}
                        partnerName={partnerName}
                        onComplete={markPrimingComplete}
                        isSubmitting={isSubmitting}
                    />
                );

            case VIEW_PHASE.WAITING_PRIMING:
                return (
                    <WaitingForPartnerStep
                        title="Priming complete"
                        subtitle="Waiting for your partner to finish their reflection"
                        partnerName={partnerName}
                    />
                );

            case VIEW_PHASE.JOINT_MENU:
                return (
                    <JointMenuPage
                        jointMenu={jointMenu}
                        myName={myName}
                        partnerName={partnerName}
                        isCreator={isCreator}
                        onReady={markJointReady}
                        isSubmitting={isSubmitting}
                    />
                );

            case VIEW_PHASE.WAITING_JOINT:
                return (
                    <WaitingForPartnerStep
                        title="Joint menu viewed"
                        subtitle="Waiting for your partner to continue"
                        partnerName={partnerName}
                    />
                );

            case VIEW_PHASE.RESOLUTION_SELECT:
                return (
                    <ResolutionSelectPage
                        resolutions={resolutions}
                        myPick={myPick}
                        myName={myName}
                        partnerName={partnerName}
                        onConfirm={submitResolutionPick}
                        isSubmitting={isSubmitting}
                        mode={myPick ? 'waiting' : 'select'}
                    />
                );

            case VIEW_PHASE.RESOLUTION_MISMATCH:
                return (
                    <ResolutionSelectPage
                        resolutions={resolutions}
                        myName={myName}
                        partnerName={partnerName}
                        onConfirm={submitResolutionPick}
                        isSubmitting={isSubmitting}
                        mode="mismatch"
                        myOriginalPickId={myOriginalPickId}
                        partnerOriginalPickId={partnerOriginalPickId}
                        mismatchPick={myMismatchPick}
                        hybridResolution={session?.hybridResolution || null}
                        hybridPending={session?.hybridResolutionPending || false}
                    />
                );

            case VIEW_PHASE.WAITING_RESOLUTION:
                return (
                    <ResolutionSelectPage
                        resolutions={resolutions}
                        myPick={myPick}
                        myName={myName}
                        partnerName={partnerName}
                        onConfirm={submitResolutionPick}
                        isSubmitting={isSubmitting}
                        mode="waiting"
                    />
                );

            case VIEW_PHASE.WAITING_ACCEPT:
            case VIEW_PHASE.VERDICT: {
                const userAName = isCreator ? myName : partnerName;
                const userBName = isCreator ? partnerName : myName;

                if (verdictError) {
                    return (
                        <VerdictErrorCard
                            message={verdictError.error || 'Verdict generation failed. Please try again.'}
                            onReset={dismiss}
                        />
                    );
                }

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
                        addendumRemaining={addendumRemaining}
                        addendumLimit={addendumLimit}
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
            <div className="min-h-screen bg-gradient-to-b from-court-cream to-court-tan/20">
                {showOpeningAnimation && (
                    <CourtOpeningAnimation onComplete={() => setShowOpeningAnimation(false)} />
                )}

                {showCelebrationAnimation && (
                    <CelebrationAnimation onComplete={handleCelebrationComplete} />
                )}

                <div className="w-full">
                    {error && (
                        <Motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="glass-card p-3 bg-red-50/80 text-red-700 mb-4 text-sm"
                        >
                            {error}
                        </Motion.div>
                    )}

                    {renderContent()}
                </div>

                <AddendumModal
                    open={showAddendumModal}
                    onClose={() => setShowAddendumModal(false)}
                    value={localAddendum}
                    onChange={setLocalAddendum}
                    onSubmit={handleSubmitAddendum}
                    isSubmitting={isSubmitting}
                    addendumRemaining={addendumRemaining}
                    addendumLimit={addendumLimit}
                />

                {/* Rating popup mounts globally so it can appear after CLOSED */}
                <VerdictRating
                    onRate={(rating) => submitVerdictRating(rating)}
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
    const maxLen = 2000;
    const evidenceLen = localEvidence?.length || 0;
    const feelingsLen = localFeelings?.length || 0;

    return (
        <div className="space-y-5">
            <Motion.div
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
            </Motion.div>

            <Motion.div
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
                        maxLength={maxLen}
                        className="w-full h-32 px-4 py-3 rounded-xl border-2 border-court-tan/30 
                            focus:border-court-gold focus:ring-2 focus:ring-court-gold/20 
                            bg-white/50 text-court-brown placeholder-court-brownLight/50
                            transition-all resize-none"
                    />
                    <div className="flex items-center justify-between mt-2">
                        <span className="text-[11px] text-court-brownLight/80">Aim for clarity over completeness</span>
                        <span className="text-[11px] text-neutral-400">{evidenceLen}/{maxLen}</span>
                    </div>
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
                        maxLength={maxLen}
                        className="w-full h-32 px-4 py-3 rounded-xl border-2 border-court-tan/30 
                            focus:border-court-gold focus:ring-2 focus:ring-court-gold/20 
                            bg-white/50 text-court-brown placeholder-court-brownLight/50
                            transition-all resize-none"
                    />
                    <div className="flex items-center justify-between mt-2">
                        <span className="text-[11px] text-court-brownLight/80">Name the emotion, not the verdict</span>
                        <span className="text-[11px] text-neutral-400">{feelingsLen}/{maxLen}</span>
                    </div>
                </div>

                <div className="space-y-3">
                    <Motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={onSubmit}
                        disabled={isSubmitting || !localEvidence.trim() || !localFeelings.trim()}
                        className="w-full py-3 px-4 rounded-xl text-white font-extrabold flex items-center justify-center gap-2
                            disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                        style={{ background: 'linear-gradient(135deg, #1c1c84 0%, #000035 100%)' }}
                    >
                        {isSubmitting ? (
                            <Motion.div
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
                    </Motion.button>

                    <SettlementButton className="w-full" />

                    <p className="text-center text-xs text-court-brownLight/80">
                        ✨ Judge Whiskers values honesty and emotional vulnerability ✨
                    </p>
                </div>
            </Motion.div>
        </div>
    );
}

function AddendumModal({ open, onClose, value, onChange, onSubmit, isSubmitting, addendumRemaining, addendumLimit }) {
    const limitReached = addendumRemaining !== null && addendumRemaining <= 0;
    return (
        <AnimatePresence>
            {open && (
                <Motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
                    onClick={onClose}
                >
                    <Motion.div
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
                        {addendumLimit !== null && (
                            <div className="mb-4 rounded-xl border border-court-tan/40 bg-court-cream/60 px-3 py-2 text-xs text-court-brown">
                                Shared addendums: {addendumRemaining} of {addendumLimit} remaining.
                            </div>
                        )}
                        <textarea
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            placeholder="What did Judge Whiskers not consider?"
                            className="w-full h-32 px-4 py-3 rounded-xl border-2 border-court-tan/30 
                                focus:border-court-gold focus:ring-2 focus:ring-court-gold/20 
                                bg-white/50 text-court-brown placeholder-court-brownLight/50
                                transition-all resize-none"
                            disabled={limitReached}
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
                                disabled={limitReached || isSubmitting || !value?.trim()}
                                className="flex-1 py-2 px-4 rounded-lg text-white font-extrabold disabled:opacity-50 shadow-lg"
                                style={{ background: 'linear-gradient(135deg, #1c1c84 0%, #000035 100%)' }}
                            >
                                {limitReached ? 'Limit reached' : 'Submit'}
                            </button>
                        </div>
                    </Motion.div>
                </Motion.div>
            )}
        </AnimatePresence>
    );
}

function VerdictErrorCard({ message, onReset }) {
    return (
        <div className="max-w-md mx-auto glass-card p-5 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-red-100 mx-auto flex items-center justify-center">
                <Gavel className="w-6 h-6 text-red-500" />
            </div>
            <h2 className="text-lg font-bold text-court-brown">Unable to Generate Verdict</h2>
            <p className="text-sm text-court-brownLight">{message}</p>
            <button
                onClick={onReset}
                className="w-full py-2.5 px-4 rounded-xl text-white font-extrabold shadow-lg"
                style={{ background: 'linear-gradient(135deg, #1c1c84 0%, #000035 100%)' }}
            >
                Return to Court Lobby
            </button>
        </div>
    );
}
