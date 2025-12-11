import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

/**
 * Court State Machine:
 * IDLE → PENDING → IN_SESSION → SUBMITTING → DELIBERATING → VERDICT → RATING → CLOSED
 * 
 * State transitions:
 * - IDLE: No active session
 * - PENDING: Waiting for partner to join
 * - IN_SESSION: Both joined, opening animation plays
 * - SUBMITTING: Evidence collection phase (60-min timeout → case tossed)
 * - DELIBERATING: AI generating verdict (stenographer runs in background after)
 * - VERDICT: Verdict displayed, awaiting acceptance (60-min auto-accept)
 * - RATING: 1-5 star rating popup (skippable)
 * - CLOSED: Session ended, celebration if valid verdict
 */

// Court phase constants
export const COURT_PHASES = {
    IDLE: 'IDLE',
    WAITING: 'WAITING',           // Changed from PENDING for consistency
    IN_SESSION: 'IN_SESSION',
    SUBMITTING: 'SUBMITTING',
    DELIBERATING: 'DELIBERATING',
    VERDICT: 'VERDICT',
    RATING: 'RATING',
    CLOSED: 'CLOSED',
    SETTLED: 'SETTLED',
    TIMED_OUT: 'TIMED_OUT'
};

// Map backend status → frontend phase
// This is THE mapping for single source of truth
const STATUS_TO_PHASE = {
    'WAITING': COURT_PHASES.WAITING,
    'IN_SESSION': COURT_PHASES.IN_SESSION,
    'WAITING_FOR_PARTNER': COURT_PHASES.SUBMITTING,
    'WAITING_FOR_CREATOR': COURT_PHASES.SUBMITTING,
    'DELIBERATING': COURT_PHASES.DELIBERATING,
    'VERDICT': COURT_PHASES.VERDICT,
    'CLOSED': COURT_PHASES.CLOSED,
    'SETTLED': COURT_PHASES.SETTLED,
    'TIMED_OUT': COURT_PHASES.TIMED_OUT,
};

// Get auth store helpers
const getAuthState = async () => {
    const authStore = await import('./useAuthStore').then(m => m.default);
    return authStore.getState();
};

const useCourtStore = create(
    persist(
        (set, get) => ({
            // === STATE ===

            // Current phase in the state machine
            phase: COURT_PHASES.IDLE,

            // Court session from server
            courtSession: null,

            // Active case data
            activeCase: {
                id: null,
                status: null,  // Added: Track case status for render conditions
                initiatorId: null,
                userAInput: '',
                userAFeelings: '',
                userBInput: '',
                userBFeelings: '',
                userASubmitted: false,
                userBSubmitted: false,
                userAAccepted: false,
                userBAccepted: false,
                verdict: null,
                analysis: null,
                allVerdicts: [],
                rating: null,
            },

            // UI state
            isAnimationPlaying: false,
            isGeneratingVerdict: false,
            showCelebration: false,
            showRatingPopup: false,

            // Timers (in ms, null when not active)
            submissionDeadline: null, // 60-min timeout for evidence
            verdictDeadline: null,    // 60-min auto-accept timer

            // Settlement state
            settlementRequested: { creator: false, partner: false },

            // Case history
            caseHistory: [],

            // === COMPUTED HELPERS ===

            // Get current user's role
            getRole: async () => {
                const { user: authUser } = await getAuthState();
                const { courtSession, activeCase } = get();

                const isCreator = courtSession?.created_by === authUser?.id;
                const isInitiator = activeCase?.initiatorId === authUser?.id;

                return {
                    isCreator,
                    isInitiator,
                    isUserA: isInitiator || (!activeCase?.initiatorId && isCreator)
                };
            },

            // SINGLE SOURCE OF TRUTH: Derive phase from session.status
            // This replaces all manual phase management
            getPhase: () => {
                const { courtSession, showRatingPopup, showCelebration } = get();

                // Local UI overrides (popups)
                if (showRatingPopup) return COURT_PHASES.RATING;
                if (showCelebration) return COURT_PHASES.CLOSED;

                // No session = IDLE
                if (!courtSession) return COURT_PHASES.IDLE;

                // Map server status to frontend phase
                return STATUS_TO_PHASE[courtSession.status] || COURT_PHASES.IDLE;
            },

            // === ACTIONS ===

            // Transition to a new phase
            setPhase: (phase) => {
                console.log(`[CourtStore] Phase transition: ${get().phase} → ${phase}`);
                set({ phase });
            },

            // Check for active session on mount
            checkActiveSession: async () => {
                try {
                    const { user: authUser, partner } = await getAuthState();

                    const params = new URLSearchParams();
                    if (authUser?.id) params.set('userId', authUser.id);
                    if (partner?.id) params.set('partnerId', partner.id);

                    const url = params.toString()
                        ? `/court-sessions/active?${params.toString()}`
                        : '/court-sessions/active';

                    const response = await api.get(url);
                    const session = response.data;

                    if (session) {
                        set({ courtSession: session });
                        // Sync phase with server session status
                        get().syncPhaseWithSession(session);
                    } else {
                        // No active session - only reset if not in verdict acceptance flow
                        const { phase, showRatingPopup, showCelebration, activeCase } = get();

                        // Additional guards: don't reset if verdict exists or user has accepted
                        const hasActiveVerdict = activeCase?.verdict;
                        const hasAccepted = activeCase?.userAAccepted || activeCase?.userBAccepted;

                        console.log('[CourtStore] Guard check:', {
                            phase,
                            showRatingPopup,
                            showCelebration,
                            hasActiveVerdict: !!hasActiveVerdict,
                            hasAccepted,
                            willReset: phase !== COURT_PHASES.IDLE && !showRatingPopup && !showCelebration && !hasActiveVerdict && !hasAccepted
                        });

                        // Only reset if truly idle - not mid-verdict-acceptance
                        if (phase !== COURT_PHASES.IDLE && !showRatingPopup && !showCelebration && !hasActiveVerdict && !hasAccepted) {
                            console.log('[CourtStore] No server session, resetting to IDLE');
                            get().reset();
                        }
                    }

                    return session;
                } catch (error) {
                    console.error('[CourtStore] Failed to check active session:', error);
                    return null;
                }
            },

            // Sync session from server - phase is derived via getPhase()
            // Only updates courtSession, does not manually set phase
            syncPhaseWithSession: (session) => {
                if (!session) {
                    set({ courtSession: null });
                    return;
                }

                // Skip sync during active rating/celebration popups
                const { showRatingPopup, showCelebration } = get();
                if (showRatingPopup || showCelebration) {
                    console.log('[CourtStore] syncPhaseWithSession: Skipping - popup active');
                    set({ courtSession: session });
                    return;
                }

                // Only sync courtSession - phase is derived via getPhase()
                // Also sync activeCase.status for components that still check it
                const { activeCase } = get();
                set({
                    courtSession: session,
                    activeCase: {
                        ...activeCase,
                        status: session.status
                    }
                });
            },

            // IDLE → PENDING: Serve partner
            servePartner: async () => {
                const { user: authUser, partner } = await getAuthState();

                if (!authUser?.id) throw new Error('Must be logged in');
                if (!partner?.id) throw new Error('Must have a partner');

                try {
                    const response = await api.post('/court-sessions', {
                        createdBy: authUser.id,
                        partnerId: partner.id
                    });

                    set({
                        courtSession: response.data,
                        phase: COURT_PHASES.WAITING  // Changed from PENDING
                    });

                    return response.data;
                } catch (error) {
                    console.error('[CourtStore] Failed to serve partner:', error);
                    throw error;
                }
            },

            // PENDING → IN_SESSION: Partner joins
            joinCourt: async () => {
                const { courtSession } = get();
                if (!courtSession) return null;

                const { user: authUser } = await getAuthState();
                if (!authUser?.id) throw new Error('Must be logged in');

                try {
                    const response = await api.post(
                        `/court-sessions/${courtSession.id}/join`,
                        { userId: authUser.id }
                    );

                    const updated = response.data;
                    set({ courtSession: updated });

                    if (updated.status === 'IN_SESSION') {
                        set({ phase: COURT_PHASES.IN_SESSION, isAnimationPlaying: true });
                    }

                    return updated;
                } catch (error) {
                    console.error('[CourtStore] Failed to join court:', error);
                    throw error;
                }
            },

            // IN_SESSION → SUBMITTING: After animation completes
            finishAnimation: () => {
                set({
                    isAnimationPlaying: false,
                    phase: COURT_PHASES.SUBMITTING,
                    // Start 60-min submission deadline
                    submissionDeadline: Date.now() + (60 * 60 * 1000)
                });
            },

            // Update case input (facts or feelings)
            updateInput: (input, field = 'facts', isUserA = true) => {
                const { activeCase } = get();
                const key = isUserA
                    ? (field === 'facts' ? 'userAInput' : 'userAFeelings')
                    : (field === 'facts' ? 'userBInput' : 'userBFeelings');

                set({ activeCase: { ...activeCase, [key]: input } });
            },

            // Set initiator on first input
            setInitiator: (initiatorId) => {
                const { activeCase } = get();
                if (!activeCase.initiatorId) {
                    set({ activeCase: { ...activeCase, initiatorId } });
                }
            },

            // SUBMITTING: Submit evidence
            submitEvidence: async () => {
                const { activeCase, courtSession } = get();
                const { user: authUser } = await getAuthState();

                console.log('[CourtStore] submitEvidence called:', {
                    hasSession: !!courtSession,
                    sessionId: courtSession?.id,
                    sessionStatus: courtSession?.status,
                    userId: authUser?.id,
                    activeCase: activeCase
                });

                if (!courtSession?.id) {
                    console.error('[CourtStore] No active session');
                    return;
                }

                if (!authUser?.id) {
                    console.error('[CourtStore] No authenticated user');
                    return;
                }

                const { isUserA } = await get().getRole();
                const evidence = isUserA ? activeCase.userAInput : activeCase.userBInput;
                const feelings = isUserA ? activeCase.userAFeelings : activeCase.userBFeelings;

                console.log('[CourtStore] Submitting evidence:', {
                    isUserA,
                    evidence: evidence?.substring(0, 50) + '...',
                    feelings: feelings?.substring(0, 50) + '...',
                    endpoint: `/court-sessions/${courtSession.id}/submit-evidence`
                });

                try {
                    const response = await api.post(
                        `/court-sessions/${courtSession.id}/submit-evidence`,
                        { userId: authUser.id, evidence, feelings }
                    );

                    const updated = response.data;
                    set({ courtSession: updated });

                    // Update local submission status
                    const caseUpdate = isUserA
                        ? { userASubmitted: true, initiatorId: authUser.id }
                        : { userBSubmitted: true };

                    if (updated.bothSubmitted) {
                        // Both submitted → DELIBERATING
                        caseUpdate.userASubmitted = true;
                        caseUpdate.userBSubmitted = true;
                        caseUpdate.status = 'DELIBERATING';  // Update activeCase.status for render
                        caseUpdate.userAInput = updated.evidence_submissions?.creator?.evidence || activeCase.userAInput;
                        caseUpdate.userAFeelings = updated.evidence_submissions?.creator?.feelings || activeCase.userAFeelings;
                        caseUpdate.userBInput = updated.evidence_submissions?.partner?.evidence || activeCase.userBInput;
                        caseUpdate.userBFeelings = updated.evidence_submissions?.partner?.feelings || activeCase.userBFeelings;

                        set({
                            activeCase: { ...activeCase, ...caseUpdate },
                            phase: COURT_PHASES.DELIBERATING,
                            submissionDeadline: null
                        });

                        // Start verdict generation
                        get().generateVerdict();
                    } else {
                        // Only I submitted → show waiting screen (LOCKED status)
                        console.log('[CourtStore] First submission done, waiting for partner');
                        caseUpdate.status = isUserA ? 'LOCKED_A' : 'LOCKED_B';  // Update for render
                        set({
                            activeCase: { ...activeCase, ...caseUpdate },
                            phase: COURT_PHASES.SUBMITTING  // Show waiting for partner screen
                        });
                    }

                    return updated;
                } catch (error) {
                    console.error('[CourtStore] Failed to submit evidence:', error);
                    throw error;
                }
            },

            // DELIBERATING: Generate verdict
            generateVerdict: async () => {
                if (get().isGeneratingVerdict) {
                    console.log('[CourtStore] Already generating verdict');
                    return;
                }

                set({ isGeneratingVerdict: true });

                try {
                    const { activeCase, courtSession } = get();
                    const { user: authUser, profile, partner } = await getAuthState();

                    // Determine names for userA (creator) and userB (partner)
                    const isCreator = courtSession?.created_by === authUser?.id;
                    const userAName = isCreator ? (profile?.display_name || profile?.name || 'Partner A')
                        : (partner?.display_name || partner?.name || 'Partner A');
                    const userBName = isCreator ? (partner?.display_name || partner?.name || 'Partner B')
                        : (profile?.display_name || profile?.name || 'Partner B');

                    // Get profile data for userA (creator) and userB (partner)
                    const userAProfile = isCreator ? profile : partner;
                    const userBProfile = isCreator ? partner : profile;

                    // Build payload matching DeliberationInputSchema with profile context
                    const payload = {
                        sessionId: courtSession?.id,  // For database update
                        coupleId: profile?.couple_id || courtSession?.id,  // Fallback to session ID for WebSocket
                        participants: {
                            userA: {
                                id: activeCase.initiatorId || courtSession?.created_by,
                                name: userAName,
                                // Profile data for personalized verdicts
                                loveLanguage: userAProfile?.love_language,
                                communicationStyle: userAProfile?.communication_style,
                                conflictStyle: userAProfile?.conflict_style,
                                petPeeves: userAProfile?.pet_peeves || [],
                                appreciationStyle: userAProfile?.appreciation_style
                            },
                            userB: {
                                id: courtSession?.partner_id,
                                name: userBName,
                                // Profile data for personalized verdicts
                                loveLanguage: userBProfile?.love_language,
                                communicationStyle: userBProfile?.communication_style,
                                conflictStyle: userBProfile?.conflict_style,
                                petPeeves: userBProfile?.pet_peeves || [],
                                appreciationStyle: userBProfile?.appreciation_style
                            }
                        },
                        submissions: {
                            userA: {
                                cameraFacts: activeCase.userAInput || '',
                                theStoryIamTellingMyself: activeCase.userAFeelings || '',
                                coreNeed: 'understanding' // Default if not collected
                            },
                            userB: {
                                cameraFacts: activeCase.userBInput || '',
                                theStoryIamTellingMyself: activeCase.userBFeelings || '',
                                coreNeed: 'understanding' // Default if not collected
                            }
                        },
                        previousVerdicts: activeCase.allVerdicts || []
                    };

                    const response = await api.post('/judge/deliberate', payload);
                    const verdictResponse = response.data;

                    // Extract the actual verdict content (judgeContent) from the API response
                    // The API returns { verdictId, status, judgeContent, _meta, ... }
                    // VerdictView expects verdict.theSummary, verdict.theRuling_ThePurr, etc.
                    const verdict = verdictResponse.judgeContent || verdictResponse;
                    const analysis = verdictResponse._meta?.analysis || null;

                    // Store verdict
                    const newVerdict = {
                        version: (activeCase.allVerdicts?.length || 0) + 1,
                        content: verdict,
                        timestamp: new Date().toISOString()
                    };

                    set({
                        activeCase: {
                            ...activeCase,
                            verdict,
                            analysis,  // Store analysis separately for VerdictView
                            status: 'VERDICT',  // Update status for render
                            allVerdicts: [...(activeCase.allVerdicts || []), newVerdict]
                        },
                        phase: COURT_PHASES.VERDICT,
                        // Start 60-min auto-accept timer
                        verdictDeadline: Date.now() + (60 * 60 * 1000)
                    });

                    // Save case to database for history
                    try {
                        const savedCase = await api.post('/cases', {
                            userAId: payload.participants.userA.id,
                            userBId: payload.participants.userB.id,
                            userAInput: activeCase.userAInput,
                            userAFeelings: activeCase.userAFeelings || '',
                            userBInput: activeCase.userBInput,
                            userBFeelings: activeCase.userBFeelings || '',
                            status: 'VERDICT',
                            verdict: JSON.stringify(verdict),
                            caseTitle: analysis?.caseTitle,
                            severityLevel: analysis?.severityLevel,
                            primaryHissTag: analysis?.primaryHissTag,
                            shortResolution: analysis?.shortResolution
                        });

                        console.log('[CourtStore] Case saved to database:', savedCase.data.id);

                        // Update activeCase with database ID and add to history
                        set({
                            activeCase: {
                                ...get().activeCase,
                                id: savedCase.data.id
                            },
                            caseHistory: [savedCase.data, ...get().caseHistory]
                        });
                    } catch (saveError) {
                        console.error('[CourtStore] Failed to save case to database:', saveError);
                        // Continue even if save fails - verdict is still shown
                    }


                } catch (error) {
                    console.error('[CourtStore] Verdict generation failed:', error);
                    // Set fallback error verdict
                    const { activeCase } = get();
                    set({
                        activeCase: {
                            ...activeCase,
                            verdict: {
                                status: 'error',
                                message: 'Judge Whiskers is taking a catnap. Please try again later.',
                                error: error.message
                            }
                        },
                        phase: COURT_PHASES.VERDICT
                    });
                } finally {
                    set({ isGeneratingVerdict: false });
                }
            },

            // VERDICT: Accept verdict
            acceptVerdict: async () => {
                const { activeCase, courtSession } = get();
                const { user: authUser } = await getAuthState();
                const { isUserA } = await get().getRole();

                try {
                    // Update local state immediately
                    const caseUpdate = isUserA
                        ? { userAAccepted: true }
                        : { userBAccepted: true };

                    set({ activeCase: { ...activeCase, ...caseUpdate } });

                    // Call backend
                    const response = await api.post(
                        `/court-sessions/${courtSession.id}/accept-verdict`,
                        { userId: authUser.id, caseId: activeCase.id }
                    );

                    console.log('[CourtStore] Accept verdict response:', response.data);

                    if (response.data.bothAccepted) {
                        console.log('[CourtStore] Both accepted! Showing celebration first');

                        // Refresh case history so it shows in history page
                        try {
                            await get().fetchCaseHistory();
                        } catch (e) {
                            console.log('[CourtStore] Failed to refresh case history:', e.message);
                        }

                        // Both accepted → show celebration first, then auto-show rating popup after 1s
                        set({
                            showCelebration: true,
                            verdictDeadline: null
                        });

                        // Auto-show rating popup 1 second after celebration starts
                        setTimeout(() => {
                            set({ showRatingPopup: true });
                            console.log('[CourtStore] Auto-showing rating popup after 1s');
                        }, 1000);

                        console.log('[CourtStore] State after set:', { showCelebration: get().showCelebration });
                    }

                    return response.data;
                } catch (error) {
                    console.error('[CourtStore] Failed to accept verdict:', error);
                    throw error;
                }
            },

            // RATING: Submit rating
            submitRating: async (rating) => {
                const { activeCase, courtSession } = get();

                try {
                    if (rating) {
                        await api.post(`/court-sessions/${courtSession.id}/rate`, { rating });
                    }

                    console.log('[CourtStore] Rating submitted, resetting to idle');
                    set({
                        activeCase: { ...activeCase, rating },
                        showRatingPopup: false
                    });
                    // Reset to idle after rating is complete
                    get().reset();
                } catch (error) {
                    console.error('[CourtStore] Failed to submit rating:', error);
                    // Still proceed to reset even if rating fails
                    set({ showRatingPopup: false });
                    get().reset();
                }
            },

            // Skip rating
            skipRating: () => {
                console.log('[CourtStore] Rating skipped, resetting to idle');
                set({ showRatingPopup: false });
                get().reset();
            },

            // Close celebration - show rating popup
            closeCelebration: async () => {
                console.log('[CourtStore] Celebration closed, showing rating popup');

                // After celebration, show rating popup
                set({
                    showCelebration: false,
                    phase: COURT_PHASES.RATING,
                    showRatingPopup: true
                });
            },

            // Request settlement
            requestSettlement: async () => {
                const { courtSession } = get();
                if (!courtSession) return null;

                const { user: authUser } = await getAuthState();

                try {
                    const response = await api.post(
                        `/court-sessions/${courtSession.id}/settle`,
                        { userId: authUser.id }
                    );

                    const result = response.data;
                    set({ courtSession: result });

                    if (result.settled) {
                        set({ phase: COURT_PHASES.SETTLED });
                        // Show settlement animation, then reset
                        setTimeout(() => get().reset(), 3500);
                    }

                    return result;
                } catch (error) {
                    console.error('[CourtStore] Failed to request settlement:', error);
                    throw error;
                }
            },

            // Submit addendum (returns to DELIBERATING)
            submitAddendum: async (addendumText) => {
                const { activeCase, courtSession } = get();
                const { user: authUser } = await getAuthState();
                const { isUserA } = await get().getRole();

                // Add addendum to verdict history
                const addendumVerdict = {
                    version: (activeCase.allVerdicts?.length || 0) + 1,
                    addendumBy: isUserA ? 'userA' : 'userB',
                    addendumText,
                    timestamp: new Date().toISOString()
                };

                set({
                    activeCase: {
                        ...activeCase,
                        allVerdicts: [...(activeCase.allVerdicts || []), addendumVerdict],
                        // Reset acceptances for new verdict
                        userAAccepted: false,
                        userBAccepted: false
                    },
                    phase: COURT_PHASES.DELIBERATING,
                    verdictDeadline: null
                });

                // Generate new verdict with addendum context
                await get().generateVerdict();
            },

            // Reset all court state
            reset: () => {
                set({
                    phase: COURT_PHASES.IDLE,
                    courtSession: null,
                    activeCase: {
                        id: null,
                        status: null,  // Reset status field
                        initiatorId: null,
                        userAInput: '',
                        userAFeelings: '',
                        userBInput: '',
                        userBFeelings: '',
                        userASubmitted: false,
                        userBSubmitted: false,
                        userAAccepted: false,
                        userBAccepted: false,
                        verdict: null,
                        analysis: null,
                        allVerdicts: [],
                        rating: null
                    },
                    isAnimationPlaying: false,
                    isGeneratingVerdict: false,
                    showCelebration: false,
                    showRatingPopup: false,
                    submissionDeadline: null,
                    verdictDeadline: null,
                    settlementRequested: { creator: false, partner: false }
                });
            },

            // Fetch case history
            fetchCaseHistory: async () => {
                try {
                    const { user: authUser, partner } = await getAuthState();
                    if (!authUser?.id) return;

                    // Build query params for the correct endpoint
                    const params = new URLSearchParams();
                    params.set('userAId', authUser.id);
                    if (partner?.id) params.set('userBId', partner.id);

                    const url = `/cases?${params.toString()}`;
                    console.log('[CourtStore] Fetching case history from:', url);
                    const response = await api.get(url);
                    set({ caseHistory: response.data || [] });
                } catch (error) {
                    console.error('[CourtStore] Failed to fetch history:', error);
                }
            },

            // Load a case from history
            loadCase: (caseData) => {
                set({
                    activeCase: {
                        id: caseData.id,
                        initiatorId: caseData.initiator_id,
                        userAInput: caseData.user_a_input,
                        userAFeelings: caseData.user_a_feelings,
                        userBInput: caseData.user_b_input,
                        userBFeelings: caseData.user_b_feelings,
                        userASubmitted: true,
                        userBSubmitted: true,
                        userAAccepted: true,
                        userBAccepted: true,
                        verdict: caseData.verdict,
                        allVerdicts: caseData.all_verdicts || [{ version: 1, content: caseData.verdict }],
                        rating: caseData.rating
                    },
                    phase: COURT_PHASES.CLOSED
                });
            }
        }),
        {
            name: 'court-store',
            partialize: (state) => ({
                activeCase: state.activeCase,
                phase: state.phase,
                caseHistory: state.caseHistory
            })
        }
    )
);

export default useCourtStore;
