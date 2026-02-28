/**
 * Courtroom Page - Clean Architecture (WS-first)
 * Uses new useCourtStore + useCourtSocket.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Gavel, MessageCircle, Heart, Target, Send } from 'lucide-react';

import useAuthStore from '../store/useAuthStore';
import usePartnerStore from '../store/usePartnerStore';
import useCourtStore, { VIEW_PHASE } from '../store/useCourtStore';
import useSubscriptionStore from '../store/useSubscriptionStore';
import useUpsellStore from '../store/useUpsellStore';
import RequirePartner from '../components/RequirePartner';
import Paywall from '../components/Paywall';
import ButtonLoader from '../components/shared/ButtonLoader';
import { DEFAULT_JUDGE_ID, getJudgeMetadata } from '../lib/judgeMetadata';

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
import { useI18n } from '../i18n';

export default function CourtroomPageV2() {
    const navigate = useNavigate();
    const { t } = useI18n();

    const { user: authUser, profile } = useAuthStore();
    const { partner } = usePartnerStore();

    const {
        myViewPhase,
        session,
        localEvidence,
        localFeelings,
        localNeeds,
        localAddendum,
        isSubmitting,
        isGeneratingVerdict,
        showOpeningAnimation,
        showCelebrationAnimation,
        showRatingPopup,
        error,
        dismissedRatingSessionId,
        setLocalEvidence,
        setLocalFeelings,
        setLocalNeeds,
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
    const { isGold } = useSubscriptionStore();
    const { registerCaseCompletion, markPaywallShown } = useUpsellStore();

    const myName = profile?.display_name || profile?.name || t('common.you');
    const partnerName = partner?.display_name || partner?.name || t('common.partner');

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
    const judgeProfile = useMemo(() => getJudgeMetadata(session?.judgeType), [session?.judgeType]);
    const judgeAvatar = judgeProfile.avatar;
    const judgeName = useMemo(() => t(judgeProfile.nameKey), [judgeProfile.nameKey, t]);

    const myPick = session?.resolutionPicks
        ? (isCreator ? session.resolutionPicks.userA : session.resolutionPicks.userB)
        : null;

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

    // Load any saved draft on mount so evidence fields survive a refresh.
    useEffect(() => {
        useCourtStore.getState().loadDraft();
    }, []);

    // Warn the user before unloading if they have unsaved evidence text.
    useEffect(() => {
        const handler = (e) => {
            const { localEvidence: ev, localFeelings: fe, localNeeds: ne } = useCourtStore.getState();
            if (ev?.trim() || fe?.trim() || ne?.trim()) {
                e.preventDefault();
            }
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, []);

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

    useEffect(() => {
        if (!myViewPhase) return;
        requestAnimationFrame(() => {
            const scrollingEl = document.scrollingElement || document.documentElement;
            if (scrollingEl) {
                scrollingEl.scrollTop = 0;
            }
            document.body.scrollTop = 0;
            window.scrollTo(0, 0);
        });
    }, [myViewPhase]);

    const handleCelebrationComplete = () => {
        setShowCelebrationAnimation(false);
        setShowRatingPopup(true);
    };

    const [showAddendumModal, setShowAddendumModal] = useState(false);
    const [showPaywall, setShowPaywall] = useState(false);
    const [paywallReason, setPaywallReason] = useState(null);
    const pendingUpsellRef = useRef(null);
    const postCaseHandledRef = useRef(null);

    const handlePostCaseUpsell = useCallback((sessionId) => {
        if (!sessionId || postCaseHandledRef.current === sessionId) return;
        postCaseHandledRef.current = sessionId;
        if (isGold) return;

        const { shouldPrompt } = registerCaseCompletion();
        if (!shouldPrompt) return;

        markPaywallShown('case_complete');
        setPaywallReason(t('paywall.postCaseReason'));
        setShowPaywall(true);
    }, [isGold, markPaywallShown, registerCaseCompletion, t]);

    useEffect(() => {
        if (showRatingPopup) return;
        const pendingSession = pendingUpsellRef.current;
        if (!pendingSession) return;
        pendingUpsellRef.current = null;
        handlePostCaseUpsell(pendingSession);
    }, [handlePostCaseUpsell, showRatingPopup]);

    const handleServe = async (judgeType = DEFAULT_JUDGE_ID) => {
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
                        isSubmitting={isSubmitting}
                    />
                );

            case VIEW_PHASE.PENDING_PARTNER:
                return <SummonsReceived session={session} senderName={partnerName} onJoin={accept} isSubmitting={isSubmitting} />;

            case VIEW_PHASE.EVIDENCE:
                return (
                    <EvidenceForm
                        localEvidence={localEvidence}
                        localFeelings={localFeelings}
                        localNeeds={localNeeds}
                        setLocalEvidence={setLocalEvidence}
                        setLocalFeelings={setLocalFeelings}
                        setLocalNeeds={setLocalNeeds}
                        onSubmit={handleSubmitEvidence}
                        isSubmitting={isSubmitting}
                        myName={myName}
                        partnerName={partnerName}
                    />
                );

            case VIEW_PHASE.WAITING_EVIDENCE:
                return <WaitingForEvidence session={session} partnerName={partnerName} myName={myName} />;

            case VIEW_PHASE.ANALYZING:
                return <DeliberatingScreen isLoading={isGeneratingVerdict} judgeAvatar={judgeAvatar} />;

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
                        title={t('courtroom.waiting.primingTitle')}
                        subtitle={t('courtroom.waiting.primingSubtitle')}
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
                        title={t('courtroom.waiting.jointTitle')}
                        subtitle={t('courtroom.waiting.jointSubtitle')}
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
                            message={verdictError.error || t('courtroom.errors.verdictFailed')}
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
                        currentUser={null}
                        onAcceptVerdict={acceptVerdict}
                        isInitiator={isCreator}
                        addendumRemaining={addendumRemaining}
                        addendumLimit={addendumLimit}
                        judgeAvatar={judgeAvatar}
                        judgeName={judgeName}
                    />
                );
            }

            case VIEW_PHASE.CLOSED:
                return <CourtAtRest onServe={handleServe} navigate={navigate} />;

            default:
                return <CourtAtRest onServe={handleServe} navigate={navigate} />;
        }
    };
    const isIdleView = myViewPhase === VIEW_PHASE.IDLE || myViewPhase === VIEW_PHASE.CLOSED;

    return (
        <RequirePartner
            feature={t('courtroom.feature')}
            description={t('courtroom.requirePartnerDescription')}
        >
            <div className={`relative min-h-screen ${isIdleView ? '' : 'overflow-hidden'}`}>
                {!isIdleView && (
                    <>
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_55%_at_50%_0%,_rgba(212,175,55,0.18),_transparent_65%)]" />
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(40%_40%_at_85%_20%,_rgba(244,182,155,0.18),_transparent_70%)]" />
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(45%_40%_at_10%_85%,_rgba(209,198,236,0.18),_transparent_70%)]" />
                        <div className="pointer-events-none absolute -top-24 -right-20 w-72 h-72 rounded-full bg-court-gold/20 blur-3xl" />
                        <div className="pointer-events-none absolute -bottom-24 -left-20 w-80 h-80 rounded-full bg-lavender-200/25 blur-3xl" />
                        <div className="pointer-events-none absolute inset-0 opacity-[0.08] bg-[linear-gradient(120deg,_rgba(74,55,40,0.35)_0%,_rgba(255,255,255,0)_55%,_rgba(74,55,40,0.25)_100%)]" />
                    </>
                )}
                {showOpeningAnimation && (
                    <CourtOpeningAnimation
                        onComplete={() => setShowOpeningAnimation(false)}
                        judgeAvatar={judgeAvatar}
                    />
                )}

                {showCelebrationAnimation && (
                    <CelebrationAnimation
                        onComplete={handleCelebrationComplete}
                        judgeAvatar={judgeAvatar}
                    />
                )}

                <div className="relative z-10 w-full">
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
                    onRate={async (rating) => {
                        await submitVerdictRating(rating);
                        if (session?.id) {
                            pendingUpsellRef.current = session.id;
                        }
                    }}
                    onSkip={() => {
                        if (session?.id) {
                            pendingUpsellRef.current = session.id;
                        }
                    }}
                />

                <Paywall
                    isOpen={showPaywall}
                    onClose={() => {
                        setShowPaywall(false);
                        setPaywallReason(null);
                    }}
                    triggerReason={paywallReason || t('paywall.postCaseReason')}
                />
            </div>
        </RequirePartner>
    );
}

function EvidenceForm({
    localEvidence,
    localFeelings,
    localNeeds,
    setLocalEvidence,
    setLocalFeelings,
    setLocalNeeds,
    onSubmit,
    isSubmitting,
    myName,
    partnerName
}) {
    const { t } = useI18n();
    const maxLen = 2000;
    const evidenceLen = localEvidence?.length || 0;
    const feelingsLen = localFeelings?.length || 0;
    const needsLen = localNeeds?.length || 0;

    return (
        <div className="space-y-5 pb-6">
            <Motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative glass-card p-5 bg-gradient-to-br from-court-ivory via-white/95 to-court-tan/40 border border-court-gold/15 overflow-hidden"
            >
                <div className="absolute inset-x-6 top-0 h-0.5 bg-gradient-to-r from-transparent via-court-gold/60 to-transparent" />
                <div className="absolute -top-12 -right-8 w-28 h-28 rounded-full bg-court-gold/15 blur-2xl" />
                <div className="absolute -bottom-16 -left-10 w-32 h-32 rounded-full bg-lavender-200/20 blur-2xl" />
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-court-gold/20 to-court-tan rounded-xl flex items-center justify-center">
                            <Gavel className="w-5 h-5 text-court-gold" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-court-brown">{t('courtroom.evidence.title')}</h1>
                            <p className="text-xs text-court-brownLight">{t('courtroom.evidence.subtitle')}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 bg-emerald-100/80 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-200/60">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        {t('courtroom.evidence.live')}
                    </div>
                </div>

                <div className="flex items-center justify-center gap-4">
                    <div className="flex flex-col items-center text-center min-w-[80px]">
                        <p className="text-sm font-bold text-court-brown">{myName}</p>
                        <p className="text-[10px] text-court-brownLight">{t('common.you')}</p>
                    </div>
                    <div className="text-court-tan font-bold text-lg">{t('courtroom.evidence.vs')}</div>
                    <div className="flex flex-col items-center text-center min-w-[80px]">
                        <p className="text-sm font-bold text-court-brown">{partnerName}</p>
                        <p className="text-[10px] text-court-brownLight">{t('common.partner')}</p>
                    </div>
                </div>
            </Motion.div>

            <Motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="relative glass-card p-5 space-y-5 bg-white/80 border border-court-tan/30 overflow-hidden"
            >
                <div className="absolute inset-x-6 top-0 h-0.5 bg-gradient-to-r from-court-gold/50 via-court-tan/40 to-transparent" />
                <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-court-brown mb-2">
                        <MessageCircle className="w-4 h-4" />
                        {t('courtroom.evidence.factsLabel')}
                    </label>
                    <textarea
                        value={localEvidence}
                        onChange={(e) => setLocalEvidence(e.target.value)}
                        placeholder={t('courtroom.evidence.factsPlaceholder')}
                        maxLength={maxLen}
                        className="w-full h-32 px-4 py-3 rounded-2xl border-2 border-court-gold/20 
                            focus:border-court-gold focus:ring-2 focus:ring-court-gold/20 
                            bg-court-ivory/80 text-court-brown placeholder-court-brownLight/60
                            transition-all resize-none"
                    />
                    <div className="flex items-center justify-between mt-2">
                        <span className="text-[11px] text-court-brownLight/80">{t('courtroom.evidence.factsHint')}</span>
                        <span className="text-[11px] text-neutral-500">{evidenceLen}/{maxLen}</span>
                    </div>
                </div>

                <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-court-brown mb-2">
                        <Heart className="w-4 h-4" />
                        {t('courtroom.evidence.feelingsLabel')}
                    </label>
                    <textarea
                        value={localFeelings}
                        onChange={(e) => setLocalFeelings(e.target.value)}
                        placeholder={t('courtroom.evidence.feelingsPlaceholder')}
                        maxLength={maxLen}
                        className="w-full h-32 px-4 py-3 rounded-2xl border-2 border-court-gold/20
                            focus:border-court-gold focus:ring-2 focus:ring-court-gold/20
                            bg-court-ivory/80 text-court-brown placeholder-court-brownLight/60
                            transition-all resize-none"
                    />
                    <div className="flex items-center justify-between mt-2">
                        <span className="text-[11px] text-court-brownLight/80">{t('courtroom.evidence.feelingsHint')}</span>
                        <span className="text-[11px] text-neutral-500">{feelingsLen}/{maxLen}</span>
                    </div>
                </div>

                <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-court-brown mb-2">
                        <Target className="w-4 h-4" />
                        {t('courtroom.evidence.needsLabel')}
                    </label>
                    <textarea
                        value={localNeeds}
                        onChange={(e) => setLocalNeeds(e.target.value)}
                        placeholder={t('courtroom.evidence.needsPlaceholder')}
                        maxLength={maxLen}
                        className="w-full h-32 px-4 py-3 rounded-2xl border-2 border-court-gold/20
                            focus:border-court-gold focus:ring-2 focus:ring-court-gold/20
                            bg-court-ivory/80 text-court-brown placeholder-court-brownLight/60
                            transition-all resize-none"
                    />
                    <div className="flex items-center justify-between mt-2">
                        <span className="text-[11px] text-court-brownLight/80">{t('courtroom.evidence.needsHint')}</span>
                        <span className="text-[11px] text-neutral-500">{needsLen}/{maxLen}</span>
                    </div>
                </div>

                <div className="space-y-3">
                    <Motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={onSubmit}
                        disabled={isSubmitting || !localEvidence.trim() || !localFeelings.trim() || !localNeeds.trim()}
                        className="court-btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed"
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
                                {t('courtroom.evidence.submit')}
                            </>
                        )}
                    </Motion.button>

                    <SettlementButton className="w-full" />

                    <p className="text-center text-xs text-court-brownLight/80">
                        {t('courtroom.evidence.footer')}
                    </p>
                </div>
            </Motion.div>
        </div>
    );
}

function AddendumModal({ open, onClose, value, onChange, onSubmit, isSubmitting, addendumRemaining, addendumLimit }) {
    const { t } = useI18n();
    const limitReached = addendumRemaining !== null && addendumRemaining <= 0;
    return (
        <AnimatePresence>
            {open && (
                <Motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-4"
                    onClick={onClose}
                >
                    <Motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.98, opacity: 0 }}
                        className="relative glass-card p-6 max-w-md w-full max-h-[80dvh] overflow-y-auto bg-gradient-to-br from-court-ivory via-white/90 to-court-tan/30 border border-court-gold/20 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="absolute inset-x-6 top-0 h-0.5 bg-gradient-to-r from-transparent via-court-gold/60 to-transparent" />
                        <h3 className="text-lg font-bold text-court-brown mb-2">{t('courtroom.addendum.title')}</h3>
                        <p className="text-sm text-court-brownLight mb-4">
                            {t('courtroom.addendum.subtitle')}
                        </p>
                        {addendumLimit !== null && (
                            <div className="mb-4 rounded-xl border border-court-tan/40 bg-court-cream/60 px-3 py-2 text-xs text-court-brown">
                                {t('courtroom.addendum.remaining', { remaining: addendumRemaining, limit: addendumLimit })}
                            </div>
                        )}
                        <textarea
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            placeholder={t('courtroom.addendum.placeholder')}
                            className="w-full h-32 px-4 py-3 rounded-2xl border-2 border-court-gold/20 
                                focus:border-court-gold focus:ring-2 focus:ring-court-gold/20 
                                bg-court-ivory/80 text-court-brown placeholder-court-brownLight/60
                                transition-all resize-none"
                            disabled={limitReached}
                        />
                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={onClose}
                                className="court-btn-secondary flex-1"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={onSubmit}
                                disabled={limitReached || isSubmitting || !value?.trim()}
                                className="court-btn-primary flex-1 disabled:opacity-60"
                            >
                                {limitReached ? (
                                    t('courtroom.addendum.limitReached')
                                ) : isSubmitting ? (
                                    <ButtonLoader
                                        size="sm"
                                        tone="white"
                                    />
                                ) : (
                                    t('courtroom.addendum.submit')
                                )}
                            </button>
                        </div>
                    </Motion.div>
                </Motion.div>
            )}
        </AnimatePresence>
    );
}

function VerdictErrorCard({ message, onReset }) {
    const { t } = useI18n();
    return (
        <div className="max-w-md mx-auto glass-card p-6 text-center space-y-3 bg-gradient-to-br from-rose-50/80 via-white/90 to-court-cream border border-rose-200/40">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 mx-auto flex items-center justify-center shadow-soft">
                <Gavel className="w-6 h-6 text-rose-500" />
            </div>
            <h2 className="text-lg font-bold text-court-brown">{t('courtroom.errors.title')}</h2>
            <p className="text-sm text-court-brownLight">{message}</p>
            <button
                onClick={onReset}
                className="court-btn-primary w-full"
            >
                {t('courtroom.errors.return')}
            </button>
        </div>
    );
}
