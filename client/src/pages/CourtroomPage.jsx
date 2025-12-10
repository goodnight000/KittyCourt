import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import useAppStore from '../store/useAppStore';
import useCourtStore, { COURT_PHASES } from '../store/useCourtStore';
import useAuthStore from '../store/useAuthStore';
import api from '../services/api';
import RequirePartner from '../components/RequirePartner';
import {
    Lock, Send, Scale, Heart, MessageCircle, RotateCcw, History,
    Sparkles, AlertTriangle, HeartHandshake, Quote, Gavel, Users,
    Bell, ChevronRight, Plus, Clock, FileText, Check, PartyPopper,
    Moon, Coffee, Zap, Cat, Handshake, X
} from 'lucide-react';

// Import extracted court components
import {
    DeliberatingScreen,
    CourtAtRest,
    CelebrationAnimation,
    CourtOpeningAnimation,
    WaitingForPartner,
    SummonsReceived,
    SettleModal,
    SettleSuccessAnimation,
    StartCourtView,
    VerdictView,
    VerdictRating
} from '../components/court';

// Alias for backwards compatibility with existing code
const WaitingScreen = DeliberatingScreen;

// Main Courtroom Page
const CourtroomPage = () => {
    const navigate = useNavigate();
    const { hasPartner, user: authUser, profile, partner: connectedPartner } = useAuthStore();
    // User state from app store
    const { currentUser, users } = useAppStore();

    // Court state and actions from court store
    const {
        phase,
        activeCase, courtSession,
        isAnimationPlaying, showCelebration, showRatingPopup,
        checkActiveSession, servePartner, joinCourt,
        finishAnimation, updateInput, setInitiator, submitEvidence,
        submitAddendum, acceptVerdict, closeCelebration,
        requestSettlement, reset, submitRating, skipRating
    } = useCourtStore();

    const [showAddendumModal, setShowAddendumModal] = useState(false);
    const [addendumText, setAddendumText] = useState('');
    const [isSubmittingAddendum, setIsSubmittingAddendum] = useState(false);
    const [selectedVerdictVersion, setSelectedVerdictVersion] = useState(0);
    const [isSettling, setIsSettling] = useState(false);
    const [settleMessage, setSettleMessage] = useState('');
    const [showSettleModal, setShowSettleModal] = useState(false);
    const [settleSuccess, setSettleSuccess] = useState(false);

    // Determine if current user is the initiator (User A role) based on:
    // 1. For court sessions: check if they created the session
    // 2. For active cases: check if they're the initiator
    // Note: Supabase returns snake_case (created_by), but we also check camelCase for compatibility
    const isCreator = (courtSession?.created_by === authUser?.id) || (courtSession?.createdBy === authUser?.id);
    const isInitiator = activeCase?.initiatorId === authUser?.id || (!activeCase?.initiatorId && isCreator);
    const isUserA = isInitiator;
    const currentUserRole = isUserA ? 'userA' : 'userB';
    const myInput = isUserA ? (activeCase?.userAInput || '') : (activeCase?.userBInput || '');
    const myFeelings = isUserA ? (activeCase?.userAFeelings || '') : (activeCase?.userBFeelings || '');

    // Get partner names for display from auth store (Supabase profiles)
    const myName = profile?.display_name || profile?.name || 'You';
    const partnerName = connectedPartner?.display_name || connectedPartner?.name || 'Your Partner';

    // Check if partner has requested to settle
    const partnerWantsToSettle = courtSession?.settle_requests && (
        (courtSession.settle_requests.creator && !isCreator) ||
        (courtSession.settle_requests.partner && isCreator)
    );

    // Check if I have already requested to settle
    const iHaveRequestedSettle = courtSession?.settle_requests && (
        (courtSession.settle_requests.creator && isCreator) ||
        (courtSession.settle_requests.partner && !isCreator)
    );

    // For verdict display: User A is initiator, User B is partner
    const userAName = isInitiator ? myName : partnerName;
    const userBName = isInitiator ? partnerName : myName;

    // Check for active session on mount
    useEffect(() => {
        checkActiveSession();
    }, []);

    // Restore case data when session has a linked case (RESOLVED status)
    // This handles the case when user refreshes after verdict was delivered
    useEffect(() => {
        const restoreCaseFromSession = async () => {
            // If session is RESOLVED and has a case_id but activeCase is not populated
            if ((courtSession?.status === 'VERDICT' || courtSession?.status === 'RESOLVED') && courtSession?.case_id) {
                const { activeCase } = useCourtStore.getState();

                // Only fetch if we don't have the case data or it's stale
                if (!activeCase?.id || activeCase.id !== courtSession.case_id || (activeCase.status !== 'VERDICT' && activeCase.status !== 'RESOLVED')) {
                    try {
                        // Fetch the case from the database
                        const response = await api.get(`/cases/${courtSession.case_id}`);
                        const caseData = response.data;

                        if (caseData) {
                            // Use the loadCase function to restore the case state
                            useCourtStore.getState().loadCase(caseData);
                        }
                    } catch (error) {
                        console.error('Failed to restore case:', error);
                    }
                }
            }

            // If session is DELIBERATING, ensure we have evidence from both users
            if (courtSession?.status === 'DELIBERATING' && courtSession?.evidence_submissions) {
                const { activeCase } = useCourtStore.getState();
                const evidence = courtSession.evidence_submissions;

                // Update activeCase with evidence from server if missing
                const needsUpdate =
                    (!activeCase?.userAInput && evidence?.creator?.evidence) ||
                    (!activeCase?.userBInput && evidence?.partner?.evidence);

                if (needsUpdate) {
                    useCourtStore.setState({
                        activeCase: {
                            ...activeCase,
                            userAInput: evidence?.creator?.evidence || activeCase?.userAInput || '',
                            userAFeelings: evidence?.creator?.feelings || activeCase?.userAFeelings || '',
                            userASubmitted: evidence?.creator?.submitted || false,
                            userBInput: evidence?.partner?.evidence || activeCase?.userBInput || '',
                            userBFeelings: evidence?.partner?.feelings || activeCase?.userBFeelings || '',
                            userBSubmitted: evidence?.partner?.submitted || false,
                            status: 'DELIBERATING'
                        }
                    });
                }
            }
        };

        restoreCaseFromSession();
    }, [courtSession?.status, courtSession?.case_id, courtSession?.evidence_submissions]);

    // Poll for session updates when waiting for partner to join
    // This allows the creator to be notified when partner accepts the summons
    useEffect(() => {
        // Only poll if we have a session in WAITING status and current user is the creator
        if (!courtSession || courtSession.status !== 'WAITING' || !isCreator) {
            return;
        }

        const pollInterval = setInterval(async () => {
            const updatedSession = await checkActiveSession();

            // If session changed to IN_SESSION, trigger the animation
            if (updatedSession && updatedSession.status === 'IN_SESSION') {
                // Update store to trigger animation
                useCourtStore.setState({ isAnimationPlaying: true, phase: COURT_PHASES.IN_SESSION });
            }
        }, 3000); // Poll every 3 seconds

        return () => clearInterval(pollInterval);
    }, [courtSession?.status, courtSession?.id, isCreator, checkActiveSession]);

    // Poll for session updates when user has submitted evidence and is waiting for partner
    // OR when session is in DELIBERATING status (to detect when verdict is ready)
    useEffect(() => {
        // Poll if session is in a waiting state OR deliberating
        const isWaitingForEvidence = courtSession?.status === 'WAITING_FOR_PARTNER' ||
            courtSession?.status === 'WAITING_FOR_CREATOR' ||
            courtSession?.status === 'IN_SESSION';

        const isDeliberating = courtSession?.status === 'DELIBERATING';

        const iHaveSubmitted = isCreator
            ? courtSession?.evidence_submissions?.creator?.submitted
            : courtSession?.evidence_submissions?.partner?.submitted;

        // Poll during DELIBERATING (always) or during waiting states (if submitted)
        const shouldPoll = isDeliberating || (isWaitingForEvidence && iHaveSubmitted);

        if (!courtSession?.id || !shouldPoll) {
            return;
        }


        const pollInterval = setInterval(async () => {
            const updatedSession = await checkActiveSession();

            if (updatedSession) {
                // Check if both have now submitted
                const bothSubmitted = updatedSession.evidence_submissions?.creator?.submitted &&
                    updatedSession.evidence_submissions?.partner?.submitted;

                if (bothSubmitted && updatedSession.status === 'DELIBERATING') {
                    // Get partner's evidence and update local state for judging
                    const { activeCase } = useCourtStore.getState();

                    // IMPORTANT: Copy BOTH users' evidence from courtSession to activeCase
                    // This ensures the state is up-to-date when the verdict polling detects completion
                    const newCase = {
                        ...activeCase,
                        // Always get creator's evidence from session
                        userAInput: updatedSession.evidence_submissions?.creator?.evidence || activeCase?.userAInput || '',
                        userAFeelings: updatedSession.evidence_submissions?.creator?.feelings || activeCase?.userAFeelings || '',
                        userASubmitted: true,
                        // Always get partner's evidence from session
                        userBInput: updatedSession.evidence_submissions?.partner?.evidence || activeCase?.userBInput || '',
                        userBFeelings: updatedSession.evidence_submissions?.partner?.feelings || activeCase?.userBFeelings || '',
                        userBSubmitted: true,
                        status: 'DELIBERATING'
                    };
                    useCourtStore.setState({ activeCase: newCase, phase: COURT_PHASES.DELIBERATING });

                    // Note: generateVerdict is called by the user who submitted last (making bothSubmitted=true).
                    // The isGeneratingVerdict lock in the store prevents duplicate calls.
                    // We no longer call generateVerdict here to avoid duplicate LLM calls.
                }

                // CRITICAL: Poll for VERDICT status - this is the fallback when WebSocket fails
                // If session is VERDICT and has a verdict, update local state
                if ((updatedSession.status === 'VERDICT' || updatedSession.status === 'RESOLVED') && updatedSession.verdict) {
                    const { activeCase } = useCourtStore.getState();
                    // Only update if we don't already have the verdict
                    if (activeCase?.status !== 'VERDICT' && activeCase?.status !== 'RESOLVED') {
                        console.log('[Polling] Detected VERDICT status with verdict, updating state');
                        useCourtStore.setState({
                            activeCase: {
                                ...activeCase,
                                verdict: updatedSession.verdict,
                                status: 'VERDICT'
                            },
                            phase: COURT_PHASES.VERDICT,
                            verdictDeadline: Date.now() + (60 * 60 * 1000)
                        });
                    }
                }
            }
        }, 3000); // Poll every 3 seconds

        return () => clearInterval(pollInterval);
    }, [courtSession?.status, courtSession?.id, courtSession?.evidence_submissions, isCreator, checkActiveSession]);


    // Poll for session updates during IN_SESSION phase (for settlement requests and general sync)
    // This allows both users to see when their partner requests settlement
    useEffect(() => {
        // Only poll during IN_SESSION status when user hasn't submitted yet
        const iHaveSubmitted = isCreator
            ? courtSession?.evidence_submissions?.creator?.submitted
            : courtSession?.evidence_submissions?.partner?.submitted;

        if (!courtSession?.id || courtSession?.status !== 'IN_SESSION' || iHaveSubmitted) {
            return;
        }

        const pollInterval = setInterval(async () => {
            await checkActiveSession();
            // courtSession will be updated by the store, triggering re-render
            // and SettlementButton/partnerWantsToSettle will reflect the change
        }, 3000); // Poll every 3 seconds

        return () => clearInterval(pollInterval);
    }, [courtSession?.id, courtSession?.status, courtSession?.evidence_submissions, isCreator, checkActiveSession]);

    // Poll for partner acceptance when current user has accepted but partner hasn't
    useEffect(() => {
        const hasAccepted = isUserA ? activeCase.userAAccepted : activeCase.userBAccepted;
        const partnerHasAccepted = isUserA ? activeCase.userBAccepted : activeCase.userAAccepted;

        // Only poll if: we're in resolved state, user has accepted, and partner hasn't
        if ((activeCase.status !== 'VERDICT' && activeCase.status !== 'RESOLVED') || !hasAccepted || partnerHasAccepted || !courtSession?.id) {
            return;
        }

        const pollInterval = setInterval(async () => {
            const updatedSession = await checkActiveSession();

            if (updatedSession?.verdict_acceptances) {
                // Check if both have now accepted
                const bothAccepted = updatedSession.verdict_acceptances.creator &&
                    updatedSession.verdict_acceptances.partner;

                if (bothAccepted) {
                    // Partner accepted! Award kibble and celebrate
                    const kibbleReward = activeCase.verdict?.kibbleReward || { userA: 10, userB: 10 };
                    const reward = isUserA ? kibbleReward.userA : kibbleReward.userB;

                    try {
                        await api.post('/economy/transaction', {
                            userId: authUser?.id,
                            amount: reward,
                            type: 'EARN',
                            description: 'Case resolved - verdict accepted'
                        });
                    } catch (error) {
                        console.log('Error awarding kibble:', error.message);
                    }

                    // Show celebration!
                    useCourtStore.setState({ showCelebration: true, courtSession: null, phase: COURT_PHASES.CLOSED });
                }
            }
        }, 3000); // Poll every 3 seconds

        return () => clearInterval(pollInterval);
    }, [activeCase.status, activeCase.userAAccepted, activeCase.userBAccepted, isUserA, courtSession?.id, activeCase.verdict, authUser?.id, checkActiveSession]);

    // Require partner to access courtroom
    if (!hasPartner) {
        return (
            <RequirePartner
                feature="Court"
                description="The courtroom requires both partners to be connected. Resolve disputes together, share your perspectives, and let Judge Whiskers deliver fair verdicts!"
            >
                {/* Preview content */}
                <div className="space-y-4">
                    <div className="glass-card p-5 text-center bg-gradient-to-br from-court-cream to-court-tan/30">
                        <Gavel className="w-12 h-12 mx-auto text-court-gold mb-3" />
                        <h2 className="text-lg font-bold text-court-brown">The Courtroom</h2>
                        <p className="text-sm text-court-brownLight">Present your case to Judge Whiskers</p>
                    </div>
                </div>
            </RequirePartner>
        );
    }

    // Handle serving partner
    const handleServe = async () => {
        try {
            await servePartner();
        } catch (error) {
            console.error("Failed to serve partner", error);
        }
    };

    // Handle joining court
    const handleJoin = async () => {
        try {
            await joinCourt();
        } catch (error) {
            console.error("Failed to join court", error);
        }
    };

    // Handle cancel session
    const handleCancelSession = async () => {
        try {
            if (courtSession?.id) {
                // Close the session on the server
                await api.post(`/court-sessions/${courtSession.id}/close`, {
                    reason: 'cancelled'
                });
            }
            // Reset local state
            reset();
        } catch (error) {
            console.error('Failed to cancel session:', error);
            // Still reset local state even if API fails
            reset();
        }
    };

    // Handle settle out of court request
    const handleSettle = async () => {
        setIsSettling(true);
        setShowSettleModal(false);
        try {
            const result = await requestSettlement();
            if (result.settled) {
                setSettleSuccess(true);
                // Navigate home after animation
                setTimeout(() => {
                    navigate('/');
                }, 3500);
            } else {
                setSettleMessage('Settlement requested. Waiting for your partner to agree...');
            }
        } catch (error) {
            console.error("Failed to settle", error);
            setSettleMessage('Failed to request settlement. Please try again.');
        }
        setIsSettling(false);
    };

    // Handle addendum submission
    const handleSubmitAddendum = async () => {
        if (!addendumText.trim()) return;
        setIsSubmittingAddendum(true);
        try {
            await submitAddendum(addendumText);
            setShowAddendumModal(false);
            setAddendumText('');
        } catch (error) {
            console.error("Failed to submit addendum", error);
        }
        setIsSubmittingAddendum(false);
    };

    // Handle accept verdict
    const handleAcceptVerdict = async () => {
        await acceptVerdict();
    };

    // Handle celebration complete - go back to home
    const handleCelebrationComplete = () => {
        closeCelebration();
        navigate('/');
    };

    // Get current verdict to display
    const allVerdicts = activeCase.allVerdicts || [];

    // DEBUG: Log render state to understand blank page issue
    console.log('[CourtroomPage Render]', {
        phase,
        showCelebration,
        isAnimationPlaying,
        activeCaseStatus: activeCase?.status,
        activeCaseVerdict: !!activeCase?.verdict,
        courtSessionStatus: courtSession?.status,
        hasCourtSession: !!courtSession
    });

    // Show celebration animation
    if (showCelebration) {
        return (
            <CelebrationAnimation
                onComplete={handleCelebrationComplete}
                kibbleReward={activeCase.verdict?.kibbleReward}
            />
        );
    }

    // Show court animation
    if (isAnimationPlaying) {
        return <CourtOpeningAnimation onComplete={finishAnimation} />;
    }

    // Verdict View
    if ((activeCase.status === 'VERDICT' || activeCase.status === 'RESOLVED') && activeCase.verdict) {
        const currentVerdict = selectedVerdictVersion === 0
            ? activeCase.verdict
            : allVerdicts.find(v => v.version === selectedVerdictVersion);

        const verdict = selectedVerdictVersion === 0
            ? activeCase.verdict
            : (typeof currentVerdict?.content === 'string' ? JSON.parse(currentVerdict.content) : currentVerdict?.content) || activeCase.verdict;
        const analysis = verdict.analysis;

        return (
            <>
                <VerdictView
                    activeCase={activeCase}
                    verdict={verdict}
                    analysis={analysis}
                    allVerdicts={allVerdicts}
                    selectedVerdictVersion={selectedVerdictVersion}
                    setSelectedVerdictVersion={setSelectedVerdictVersion}
                    userAName={userAName}
                    userBName={userBName}
                    setShowAddendumModal={setShowAddendumModal}
                    resetCase={reset}
                    navigate={navigate}
                    currentUser={currentUser}
                    onAcceptVerdict={handleAcceptVerdict}
                    isInitiator={isInitiator}
                />

                {/* Addendum Modal */}
                <AnimatePresence>
                    {showAddendumModal && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-end justify-center p-4 pb-20"
                            onClick={() => setShowAddendumModal(false)}
                        >
                            <motion.div
                                initial={{ y: 100, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: 100, opacity: 0 }}
                                onClick={(e) => e.stopPropagation()}
                                className="bg-white rounded-3xl w-full max-w-md p-5 space-y-4 shadow-xl"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-court-gold/20 rounded-xl flex items-center justify-center">
                                        <FileText className="w-5 h-5 text-court-gold" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-court-brown">File an Addendum</h3>
                                        <p className="text-xs text-court-brownLight">Add context for Judge Whiskers to reconsider</p>
                                    </div>
                                </div>

                                <textarea
                                    value={addendumText}
                                    onChange={(e) => setAddendumText(e.target.value)}
                                    placeholder="What additional context or clarification would you like to share?"
                                    className="w-full h-32 bg-court-cream/50 border-2 border-court-tan/50 rounded-xl p-3 text-court-brown placeholder:text-court-brownLight/60 focus:ring-2 focus:ring-court-gold/30 focus:border-court-gold focus:outline-none resize-none text-sm"
                                />

                                <div className="bg-court-gold/10 rounded-xl p-3 flex items-start gap-2">
                                    <Clock className="w-4 h-4 text-court-gold mt-0.5 flex-shrink-0" />
                                    <p className="text-xs text-court-brown">
                                        This will trigger a new deliberation. Judge Whiskers will consider all previous context plus your addendum.
                                    </p>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowAddendumModal(false)}
                                        className="flex-1 py-3 rounded-xl font-medium text-court-brownLight hover:bg-court-cream transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <motion.button
                                        whileTap={{ scale: 0.98 }}
                                        onClick={handleSubmitAddendum}
                                        disabled={!addendumText.trim() || isSubmittingAddendum}
                                        className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {isSubmittingAddendum ? (
                                            <motion.div
                                                animate={{ rotate: 360 }}
                                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                                className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                                            />
                                        ) : (
                                            <>
                                                <Check className="w-4 h-4" />
                                                Submit
                                            </>
                                        )}
                                    </motion.button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </>
        );
    }

    // Deliberating View - Show calming breathing meditation screen
    if (activeCase.status === 'DELIBERATING') {
        return <WaitingScreen isLoading={true} />;
    }

    // Locked View - handles both LOCKED_A and LOCKED_B
    if (activeCase.status === 'LOCKED_A' || activeCase.status === 'LOCKED_B') {
        const waitingFor = activeCase.status === 'LOCKED_A' ? userBName : userAName;
        const hasCurrentUserSubmitted = isUserA ? activeCase.userASubmitted : activeCase.userBSubmitted;

        // If current user hasn't submitted yet, show the input form
        if (!hasCurrentUserSubmitted) {
            // Fall through to the input form below
        } else {
            // Current user has submitted, show locked view
            return (
                <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-card p-6 text-center max-w-sm w-full"
                    >
                        <motion.div
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="w-16 h-16 bg-gradient-to-br from-court-gold/20 to-court-tan/20 rounded-2xl flex items-center justify-center mx-auto mb-4"
                        >
                            <Lock className="w-8 h-8 text-court-gold" />
                        </motion.div>

                        <h2 className="text-lg font-bold text-neutral-800 mb-2">Evidence Sealed! 🔒</h2>
                        <p className="text-neutral-500 text-sm mb-4">
                            Waiting for <span className="text-gradient font-bold">{waitingFor}</span> to submit their side
                        </p>

                        <div className="bg-court-cream text-court-brown text-xs rounded-xl px-4 py-3 flex items-center justify-center gap-2">

                        </div>
                    </motion.div>
                </div>
            );
        }
    }

    // Check court session status - Show Court at Rest when no active session or session is finished
    // CLOSED and SETTLED sessions should show the rest view (sleeping judge)
    if (!courtSession || courtSession.status === 'CLOSED' || courtSession.status === 'SETTLED') {
        // Always show the sleeping judge when court is not in session
        return <CourtAtRest onServe={handleServe} navigate={navigate} />;
    }

    if (courtSession.status === 'WAITING') {
        // Check if current user has joined based on creator status
        const hasJoined = isCreator
            ? (courtSession.creatorJoined || courtSession.userAJoined)
            : (courtSession.partnerJoined || courtSession.userBJoined);

        // If the current user is the creator, they're waiting for partner
        if (isCreator) {
            return <WaitingForPartner
                session={courtSession}
                partnerName={partnerName}
                myName={myName}
                isCreator={true}
                onCancel={handleCancelSession}
            />;
        } else {
            // Current user is the partner who received the summons
            return <SummonsReceived
                session={courtSession}
                senderName={partnerName}
                onJoin={handleJoin}
            />;
        }
    }

    // Main Input View (when IN_SESSION)
    return (
        <div className="space-y-5">
            {/* Courtroom Header */}
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

                {/* Participants Status */}
                <div className="flex items-center justify-center gap-4">
                    <div className="flex flex-col items-center text-center min-w-[80px]">
                        <p className="text-sm font-bold text-court-brown">{userAName}</p>
                        <p className="text-[10px] text-court-brownLight">{isUserA ? 'You' : 'Partner'}</p>
                    </div>
                    <div className="text-court-tan font-bold text-lg">vs</div>
                    <div className="flex flex-col items-center text-center min-w-[80px]">
                        <p className="text-sm font-bold text-court-brown">{userBName}</p>
                        <p className="text-[10px] text-court-brownLight">{!isUserA ? 'You' : 'Partner'}</p>
                    </div>
                </div>
            </motion.div>

            {/* Form Card */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-card p-4 space-y-5"
            >
                {/* Partner Settlement Request Banner */}
                {partnerWantsToSettle && !iHaveRequestedSettle && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-gradient-to-r from-pink-100 to-rose-100 border-2 border-pink-200 rounded-2xl p-4"
                    >
                        <div className="flex items-center gap-3">
                            <motion.div
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 1, repeat: Infinity }}
                                className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm"
                            >
                                <Handshake className="w-6 h-6 text-pink-500" />
                            </motion.div>
                            <div className="flex-1">
                                <p className="text-sm font-bold text-pink-700">
                                    {partnerName} wants to settle 💕
                                </p>
                                <p className="text-xs text-pink-600">
                                    They're choosing love over winning. Will you?
                                </p>
                            </div>
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setShowSettleModal(true)}
                                className="px-4 py-2 bg-pink-500 text-white rounded-xl text-sm font-bold shadow-lg"
                            >
                                Accept
                            </motion.button>
                        </div>
                    </motion.div>
                )}

                {/* Facts Input */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-bold text-court-gold">
                        <MessageCircle className="w-4 h-4" />
                        The Facts
                    </label>
                    <textarea
                        value={myInput}
                        onChange={(e) => {
                            // Set initiator on first input if not already set
                            if (!activeCase?.initiatorId && authUser?.id) {
                                setInitiator(authUser.id);
                            }
                            updateInput(e.target.value, 'facts', isUserA);
                        }}
                        placeholder="What happened? (Be specific and factual)"
                        className="w-full h-28 bg-white/70 border-2 border-court-tan/50 rounded-xl p-3 text-court-brown placeholder:text-court-brownLight/60 focus:ring-2 focus:ring-court-gold/30 focus:border-court-gold focus:outline-none resize-none text-sm"
                    />
                </div>

                {/* Feelings Input */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-bold text-court-maroon">
                        <Heart className="w-4 h-4" />
                        The Feelings
                    </label>
                    <textarea
                        value={myFeelings}
                        onChange={(e) => {
                            // Set initiator on first input if not already set
                            if (!activeCase?.initiatorId && authUser?.id) {
                                setInitiator(authUser.id);
                            }
                            updateInput(e.target.value, 'feelings', isUserA);
                        }}
                        placeholder="How did it make you feel? What story are you telling yourself?"
                        className="w-full h-20 bg-white/70 border-2 border-court-maroon/20 rounded-xl p-3 text-court-brown placeholder:text-court-brownLight/60 focus:ring-2 focus:ring-court-maroon/20 focus:border-court-maroon/40 focus:outline-none resize-none text-sm"
                    />
                </div>

                {/* Button Row */}
                <div className="flex gap-3">
                    {/* Submit Button */}
                    <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={async () => {
                            try {
                                await submitEvidence();
                            } catch (error) {
                                console.error('Failed to submit evidence:', error);
                                alert('Failed to submit evidence. Please try again.');
                            }
                        }}
                        disabled={!myInput.trim()}
                        className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Send className="w-4 h-4" />
                        Submit Evidence
                    </motion.button>

                    {/* Settle Out of Court Button */}
                    <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowSettleModal(true)}
                        disabled={isSettling || iHaveRequestedSettle}
                        className={`glass-card px-4 py-3 flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${iHaveRequestedSettle
                            ? 'bg-pink-100 text-pink-500'
                            : 'text-court-brownLight hover:text-court-brown hover:bg-white/80'
                            }`}
                        title={iHaveRequestedSettle ? 'Settlement Requested' : 'Settle Out of Court'}
                    >
                        <Handshake className="w-5 h-5" />
                        {iHaveRequestedSettle && <Clock className="w-3 h-3 animate-pulse" />}
                    </motion.button>
                </div>

                {/* Settlement Status */}
                {iHaveRequestedSettle && !partnerWantsToSettle && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3 p-3 bg-pink-50 border border-pink-200 rounded-xl"
                    >
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        >
                            <Clock className="w-5 h-5 text-pink-400" />
                        </motion.div>
                        <div className="flex-1">
                            <p className="text-sm font-medium text-pink-700">Settlement Requested</p>
                            <p className="text-xs text-pink-500">Waiting for {partnerName} to accept...</p>
                        </div>
                    </motion.div>
                )}

                {/* Settle Message (for errors) */}
                <AnimatePresence>
                    {settleMessage && settleMessage.includes('Failed') && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className={`flex items-center gap-2 p-3 rounded-xl text-sm ${settleMessage.includes('dismissed')
                                ? 'bg-green-100 text-green-700'
                                : settleMessage.includes('Failed')
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-court-cream text-court-brown'
                                }`}
                        >
                            <X className="w-4 h-4 flex-shrink-0" />
                            <span>{settleMessage}</span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            {/* Tip */}
            <p className="text-center text-xs text-court-brownLight italic">
                🐾 Judge Whiskers values honesty and emotional vulnerability 🐾
            </p>

            {/* Settle Modal */}
            <AnimatePresence>
                {showSettleModal && (
                    <SettleModal
                        onConfirm={handleSettle}
                        onCancel={() => setShowSettleModal(false)}
                        partnerName={partnerName}
                        partnerWantsToSettle={partnerWantsToSettle}
                    />
                )}
            </AnimatePresence>

            {/* Settlement Success Animation */}
            <AnimatePresence>
                {settleSuccess && (
                    <SettleSuccessAnimation partnerName={partnerName} />
                )}
            </AnimatePresence>

            {/* Verdict Rating Popup - shown when both users accept verdict */}
            <VerdictRating />
        </div>
    );
};

export default CourtroomPage;
