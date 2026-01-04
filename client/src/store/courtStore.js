/**
 * Court Store - Clean Architecture
 *
 * Single source of truth for client-side court state.
 * Receives state updates exclusively from WebSocket or API.
 *
 * This store listens to auth events from the event bus to:
 * - Reset court state on logout
 */

import { create } from 'zustand';
import api from '../services/api';
import { createSocketAction } from '../utils/socketActionHelper';
import { eventBus, EVENTS } from '../lib/eventBus';

// View phases (must match server)
export const VIEW_PHASE = {
    IDLE: 'IDLE',
    PENDING_CREATOR: 'PENDING_CREATOR',
    PENDING_PARTNER: 'PENDING_PARTNER',
    EVIDENCE: 'EVIDENCE',
    WAITING_EVIDENCE: 'WAITING_EVIDENCE',
    // V2.0 new view phases
    ANALYZING: 'ANALYZING',
    PRIMING: 'PRIMING',
    WAITING_PRIMING: 'WAITING_PRIMING',
    JOINT_MENU: 'JOINT_MENU',
    WAITING_JOINT: 'WAITING_JOINT',
    RESOLUTION_SELECT: 'RESOLUTION_SELECT',
    RESOLUTION_MISMATCH: 'RESOLUTION_MISMATCH',
    WAITING_RESOLUTION: 'WAITING_RESOLUTION',
    // Final phases
    VERDICT: 'VERDICT',
    WAITING_ACCEPT: 'WAITING_ACCEPT',
    RATING: 'RATING',
    CLOSED: 'CLOSED'
};

// Alias for UI convenience
export const COURT_PHASES = VIEW_PHASE;

// Socket reference (set by useCourtSocket hook)
let socketRef = null;
export const setSocketRef = (socket) => { socketRef = socket; };
export const getSocketRef = () => socketRef;

// API base path
const COURT_API = '/court';

// Event bus listener cleanup functions
let eventCleanupFns = [];

const useCourtStore = create((set, get) => ({
    // === State (from server) ===
    phase: 'IDLE',
    myViewPhase: VIEW_PHASE.IDLE,
    session: null,

    // === Connection State ===
    isConnected: false,

    // Last time we received authoritative state (ms since epoch)
    lastSyncAt: 0,

    // Local cache of auth data from events (to avoid circular dependencies)
    _authUserId: null,
    _authPartnerId: null,

    // === Local Input (not synced until submit) ===
    localEvidence: '',
    localFeelings: '',
    localAddendum: '',

    // === UI State ===
    isSubmitting: false,
    isGeneratingVerdict: false,
    showOpeningAnimation: false,
    showCelebrationAnimation: false,
    showRatingPopup: false,
    showSettlementRequest: false,
    settlementDeclinedNotice: null,
    hasUnreadVerdict: false,
    dismissedRatingSessionId: null,
    error: null,

    // === State Setters ===

    setLocalEvidence: (text) => set({ localEvidence: text }),
    setLocalFeelings: (text) => set({ localFeelings: text }),
    setLocalAddendum: (text) => set({ localAddendum: text }),
    setShowOpeningAnimation: (show) => set({ showOpeningAnimation: show }),
    setShowCelebrationAnimation: (show) => set({ showCelebrationAnimation: show }),
    setShowRatingPopup: (show) => set({ showRatingPopup: show }),
    setShowSettlementRequest: (show) => set({ showSettlementRequest: show }),
    clearSettlementDeclinedNotice: () => set({ settlementDeclinedNotice: null }),
    setIsConnected: (connected) => set({ isConnected: connected }),
    markVerdictSeen: () => set({ hasUnreadVerdict: false }),
    dismissRating: (sessionId) => set({ dismissedRatingSessionId: sessionId || null, showRatingPopup: false }),

    // === Handlers (from WebSocket/API) ===

    onStateSync: ({ phase, myViewPhase, session }) => {
        const prevView = get().myViewPhase;
        const prevSessionId = get().session?.id;
        const userId = get()._authUserId;

        const nextSessionId = session?.id;
        const isNewSession = !!(nextSessionId && nextSessionId !== prevSessionId);
        const isSessionCleared = !session;
        const settlementRequested = session?.settlementRequested || null;
        const shouldShowSettlementRequest = !!(settlementRequested && userId && settlementRequested !== userId);

        const nextHasUnreadVerdict = (() => {
            const verdictPhases = [VIEW_PHASE.VERDICT, VIEW_PHASE.WAITING_ACCEPT];
            const prevWasVerdict = verdictPhases.includes(prevView);
            const nextIsVerdict = verdictPhases.includes(myViewPhase);
            if (nextIsVerdict && !prevWasVerdict) return true;
            return get().hasUnreadVerdict;
        })();

        set({
            phase,
            myViewPhase,
            session,
            error: null,
            isSubmitting: false,
            lastSyncAt: Date.now(),
            hasUnreadVerdict: nextHasUnreadVerdict,
            showSettlementRequest: isSessionCleared ? false : shouldShowSettlementRequest,
            // Detect deliberating
            isGeneratingVerdict: VIEW_PHASE.ANALYZING === myViewPhase,
            // UI-only animations never persist across sessions
            ...(isSessionCleared || isNewSession ? { showOpeningAnimation: false, showCelebrationAnimation: false } : {}),
            // Clear stale local inputs when a session ends or a new session starts
            ...(isSessionCleared || isNewSession
                ? { localEvidence: '', localFeelings: '', localAddendum: '' }
                : {}),
            // Decline indicator should not leak across sessions
            ...(isSessionCleared || isNewSession ? { settlementDeclinedNotice: null } : {}),
            ...(isSessionCleared || isNewSession ? { dismissedRatingSessionId: null } : {})
        });
    },

    onError: (message) => {
        set({ error: message, isSubmitting: false });
    },

    onSettlementRequested: () => {
        set({ showSettlementRequest: true });
    },

    onSettlementDeclined: ({ byUserId } = {}) => {
        set({ settlementDeclinedNotice: { byUserId: byUserId || null, at: Date.now() } });
    },

    // === Actions ===

    /**
     * Serve partner (create pending session)
     * @param {string} partnerId - Partner's user ID
     * @param {string} coupleId - Optional couple ID
     * @param {string} judgeType - Selected judge: 'best', 'fast', or 'logical'
     */
    serve: async (partnerId, coupleId, judgeType = 'logical') => {
        set({ isSubmitting: true, error: null });

        if (socketRef?.connected) {
            const serveAction = createSocketAction('court:serve', {
                timeoutMs: 2500,
                fallbackFn: () => get().fetchState({ force: true })
            });

            const response = await serveAction(socketRef, { partnerId, coupleId, judgeType });

            if (response?.state) get().onStateSync(response.state);
            if (response?.error) get().onError(response.error);

            set({ isSubmitting: false });
        } else {
            // API fallback
            try {
                const userId = get()._authUserId;
                const response = await api.post(`${COURT_API}/serve`, { userId, partnerId, coupleId, judgeType });
                get().onStateSync(response.data);
            } catch (error) {
                get().onError(error.response?.data?.error || error.message);
            }
            set({ isSubmitting: false });
        }
    },

    /**
     * Accept pending summons
     */
    accept: async () => {
        set({ isSubmitting: true, error: null });

        if (socketRef?.connected) {
            const acceptAction = createSocketAction('court:accept', {
                timeoutMs: 2500,
                fallbackFn: () => get().fetchState({ force: true })
            });

            const response = await acceptAction(socketRef, {});

            if (response?.state) get().onStateSync(response.state);
            if (response?.error) get().onError(response.error);

            set({ isSubmitting: false });
        } else {
            try {
                const userId = get()._authUserId;
                const response = await api.post(`${COURT_API}/accept`, { userId });
                get().onStateSync(response.data);
            } catch (error) {
                get().onError(error.response?.data?.error || error.message);
            }
            set({ isSubmitting: false });
        }
    },

    /**
     * Cancel pending session
     */
    cancel: async () => {
        set({ isSubmitting: true, error: null });

        if (socketRef?.connected) {
            const cancelAction = createSocketAction('court:cancel', {
                timeoutMs: 2500,
                fallbackFn: () => get().fetchState({ force: true })
            });

            const response = await cancelAction(socketRef, {});

            if (response?.state) get().onStateSync(response.state);
            if (response?.error) get().onError(response.error);

            set({ isSubmitting: false });
        } else {
            try {
                const userId = get()._authUserId;
                const response = await api.post(`${COURT_API}/cancel`, { userId });
                get().onStateSync(response.data);
            } catch (error) {
                get().onError(error.response?.data?.error || error.message);
            }
            set({ isSubmitting: false });
        }
    },

    /**
     * Dismiss session from any phase (for error recovery)
     */
    dismiss: async () => {
        set({ isSubmitting: true, error: null });

        if (socketRef?.connected) {
            const dismissAction = createSocketAction('court:dismiss', {
                timeoutMs: 2500,
                fallbackFn: () => {
                    // Force reset local state even if server didn't respond
                    get().reset();
                    return Promise.resolve();
                }
            });

            const response = await dismissAction(socketRef, {});

            if (response?.state) get().onStateSync(response.state);
            if (response?.error) {
                // If dismiss fails (e.g., no session), just reset locally
                get().reset();
            }

            set({ isSubmitting: false });
        } else {
            // No API fallback for dismiss - just reset locally
            get().reset();
            set({ isSubmitting: false });
        }
    },

    /**
     * Submit evidence
     */
    submitEvidence: async () => {
        const { localEvidence, localFeelings } = get();
        set({ isSubmitting: true, error: null });

        if (socketRef?.connected) {
            // Clear local inputs on submit (optimistic)
            set({ localEvidence: '', localFeelings: '' });

            const submitAction = createSocketAction('court:submit_evidence', {
                timeoutMs: 2500,
                fallbackFn: () => get().fetchState({ force: true })
            });

            const response = await submitAction(socketRef, { evidence: localEvidence, feelings: localFeelings });

            if (response?.state) get().onStateSync(response.state);
            if (response?.error) get().onError(response.error);

            set({ isSubmitting: false });
        } else {
            try {
                const userId = get()._authUserId;
                const response = await api.post(`${COURT_API}/evidence`, {
                    userId,
                    evidence: localEvidence,
                    feelings: localFeelings
                });
                get().onStateSync(response.data);
                set({ localEvidence: '', localFeelings: '' });
            } catch (error) {
                get().onError(error.response?.data?.error || error.message);
            }
            set({ isSubmitting: false });
        }
    },

    /**
     * Accept verdict
     */
    acceptVerdict: async () => {
        set({ isSubmitting: true, error: null });

        if (socketRef?.connected) {
            const acceptVerdictAction = createSocketAction('court:accept_verdict', {
                timeoutMs: 2500,
                fallbackFn: () => get().fetchState({ force: true })
            });

            const response = await acceptVerdictAction(socketRef, {});

            if (response?.state) get().onStateSync(response.state);
            if (response?.error) get().onError(response.error);

            set({ isSubmitting: false });
        } else {
            try {
                const userId = get()._authUserId;
                const response = await api.post(`${COURT_API}/verdict/accept`, { userId });
                get().onStateSync(response.data);
            } catch (error) {
                get().onError(error.response?.data?.error || error.message);
            }
            set({ isSubmitting: false });
        }
    },

    /**
     * Request settlement
     */
    requestSettlement: async () => {
        set({ error: null });

        if (socketRef?.connected) {
            const requestSettleAction = createSocketAction('court:request_settle', {
                timeoutMs: 2500
            });

            const response = await requestSettleAction(socketRef, {});

            if (response?.state) get().onStateSync(response.state);
            if (response?.error) get().onError(response.error);
        } else {
            try {
                const userId = get()._authUserId;
                await api.post(`${COURT_API}/settle/request`, { userId });
            } catch (error) {
                get().onError(error.response?.data?.error || error.message);
            }
        }
    },

    /**
     * Accept settlement
     */
    acceptSettlement: async () => {
        set({ isSubmitting: true, error: null, showSettlementRequest: false });

        if (socketRef?.connected) {
            const acceptSettleAction = createSocketAction('court:accept_settle', {
                timeoutMs: 2500,
                fallbackFn: () => get().fetchState({ force: true })
            });

            const response = await acceptSettleAction(socketRef, {});

            if (response?.state) get().onStateSync(response.state);
            if (response?.error) get().onError(response.error);

            set({ isSubmitting: false });
        } else {
            try {
                const userId = get()._authUserId;
                const response = await api.post(`${COURT_API}/settle/accept`, { userId });
                get().onStateSync(response.data);
            } catch (error) {
                get().onError(error.response?.data?.error || error.message);
            }
            set({ isSubmitting: false });
        }
    },

    /**
     * Decline settlement (case continues)
     */
    declineSettlement: async () => {
        set({ isSubmitting: true, error: null, showSettlementRequest: false });

        if (socketRef?.connected) {
            const declineSettleAction = createSocketAction('court:decline_settle', {
                timeoutMs: 2500,
                fallbackFn: () => get().fetchState({ force: true })
            });

            const response = await declineSettleAction(socketRef, {});

            if (response?.state) get().onStateSync(response.state);
            if (response?.error) get().onError(response.error);

            set({ isSubmitting: false });
        } else {
            try {
                const userId = get()._authUserId;
                const response = await api.post(`${COURT_API}/settle/decline`, { userId });
                get().onStateSync(response.data);
            } catch (error) {
                get().onError(error.response?.data?.error || error.message);
            }
            set({ isSubmitting: false });
        }
    },

    /**
     * Submit addendum
     */
    submitAddendum: async () => {
        const { localAddendum } = get();
        if (!localAddendum.trim()) return;

        set({ isSubmitting: true, error: null });

        if (socketRef?.connected) {
            set({ localAddendum: '' });

            const submitAddendumAction = createSocketAction('court:submit_addendum', {
                timeoutMs: 4000,
                fallbackFn: () => get().fetchState({ force: true })
            });

            const response = await submitAddendumAction(socketRef, { text: localAddendum });

            if (response?.state) get().onStateSync(response.state);
            if (response?.error) get().onError(response.error);

            set({ isSubmitting: false });
        } else {
            try {
                const userId = get()._authUserId;
                const response = await api.post(`${COURT_API}/addendum`, {
                    userId,
                    text: localAddendum
                });
                get().onStateSync(response.data);
                set({ localAddendum: '' });
            } catch (error) {
                get().onError(error.response?.data?.error || error.message);
            }
            set({ isSubmitting: false });
        }
    },

    /**
     * Mark priming as complete (v2.0)
     */
    markPrimingComplete: async () => {
        set({ isSubmitting: true, error: null });

        if (socketRef?.connected) {
            const primingCompleteAction = createSocketAction('court:priming_complete', {
                timeoutMs: 2500,
                fallbackFn: () => get().fetchState({ force: true })
            });

            const response = await primingCompleteAction(socketRef, {});

            if (response?.state) get().onStateSync(response.state);
            if (response?.error) get().onError(response.error);

            set({ isSubmitting: false });
        } else {
            try {
                const userId = get()._authUserId;
                const response = await api.post(`${COURT_API}/priming/complete`, { userId });
                get().onStateSync(response.data);
            } catch (error) {
                get().onError(error.response?.data?.error || error.message);
            }
            set({ isSubmitting: false });
        }
    },

    /**
     * Mark joint menu as ready (v2.0)
     */
    markJointReady: async () => {
        set({ isSubmitting: true, error: null });

        if (socketRef?.connected) {
            const jointReadyAction = createSocketAction('court:joint_ready', {
                timeoutMs: 2500,
                fallbackFn: () => get().fetchState({ force: true })
            });

            const response = await jointReadyAction(socketRef, {});

            if (response?.state) get().onStateSync(response.state);
            if (response?.error) get().onError(response.error);

            set({ isSubmitting: false });
        } else {
            try {
                const userId = get()._authUserId;
                const response = await api.post(`${COURT_API}/joint/ready`, { userId });
                get().onStateSync(response.data);
            } catch (error) {
                get().onError(error.response?.data?.error || error.message);
            }
            set({ isSubmitting: false });
        }
    },

    /**
     * Submit resolution pick (v2.0)
     */
    submitResolutionPick: async (resolutionId) => {
        if (!resolutionId) return;
        set({ isSubmitting: true, error: null });

        if (socketRef?.connected) {
            const resolutionPickAction = createSocketAction('court:resolution_pick', {
                timeoutMs: 2500,
                fallbackFn: () => get().fetchState({ force: true })
            });

            const response = await resolutionPickAction(socketRef, { resolutionId });

            if (response?.state) get().onStateSync(response.state);
            if (response?.error) get().onError(response.error);

            set({ isSubmitting: false });
        } else {
            try {
                const userId = get()._authUserId;
                const response = await api.post(`${COURT_API}/resolution/pick`, { userId, resolutionId });
                get().onStateSync(response.data);
            } catch (error) {
                get().onError(error.response?.data?.error || error.message);
            }
            set({ isSubmitting: false });
        }
    },

    /**
     * Accept partner's resolution (v2.0)
     */
    acceptPartnerResolution: async () => {
        set({ isSubmitting: true, error: null });

        if (socketRef?.connected) {
            const acceptPartnerAction = createSocketAction('court:resolution_accept_partner', {
                timeoutMs: 2500,
                fallbackFn: () => get().fetchState({ force: true })
            });

            const response = await acceptPartnerAction(socketRef, {});

            if (response?.state) get().onStateSync(response.state);
            if (response?.error) get().onError(response.error);

            set({ isSubmitting: false });
        } else {
            try {
                const userId = get()._authUserId;
                const response = await api.post(`${COURT_API}/resolution/accept-partner`, { userId });
                get().onStateSync(response.data);
            } catch (error) {
                get().onError(error.response?.data?.error || error.message);
            }
            set({ isSubmitting: false });
        }
    },

    /**
     * Request hybrid resolution (v2.0)
     */
    requestHybridResolution: async () => {
        set({ isSubmitting: true, error: null });

        if (socketRef?.connected) {
            const hybridAction = createSocketAction('court:resolution_hybrid', {
                timeoutMs: 5000,
                fallbackFn: () => get().fetchState({ force: true })
            });

            const response = await hybridAction(socketRef, {});

            if (response?.state) get().onStateSync(response.state);
            if (response?.error) get().onError(response.error);

            set({ isSubmitting: false });
        } else {
            try {
                const userId = get()._authUserId;
                const response = await api.post(`${COURT_API}/resolution/hybrid`, { userId });
                get().onStateSync(response.data);
            } catch (error) {
                get().onError(error.response?.data?.error || error.message);
            }
            set({ isSubmitting: false });
        }
    },

    /**
     * Submit verdict rating (1-5) for the latest verdict on the resolved case.
     * Stored per-user on the backend.
     */
    submitVerdictRating: async (rating) => {
        try {
            const userId = get()._authUserId;
            let caseId = get().session?.caseId;
            if (!userId) {
                throw new Error('Missing userId');
            }
            if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
                throw new Error('Invalid rating');
            }

            // If caseId isn't present yet (race on close), attempt to resolve latest case for the couple.
            if (!caseId) {
                const partnerId = get()._authPartnerId;
                if (partnerId) {
                    const { data: cases } = await api.get('/cases', {
                        params: { userAId: userId, userBId: partnerId }
                    });
                    caseId = Array.isArray(cases) ? cases?.[0]?.id : null;
                }
            }

            if (!caseId) {
                throw new Error('Missing caseId');
            }

            await api.post(`/cases/${caseId}/rate`, { userId, rating });
            return true;
        } catch (error) {
            console.error('[CourtStore] submitVerdictRating error:', error);
            set({ error: 'Could not save verdict rating. Please try again.' });
            throw error;
        }
    },

    /**
     * Fetch state from API (for initial load or reconnection)
     */
    fetchState: async ({ force = false } = {}) => {
        try {
            const userId = get()._authUserId;
            if (!userId) return;

            // If WebSocket is connected, server will push the authoritative state.
            const lastSyncAt = get().lastSyncAt;
            const stale = !lastSyncAt || Date.now() - lastSyncAt > 10000;
            if (!force && (socketRef?.connected || get().isConnected) && !stale) {
                return;
            }

            const response = await api.get(`${COURT_API}/state`, { params: { userId } });
            get().onStateSync(response.data);
        } catch (error) {
            // In production, the WS path may be deployed before REST fallback routes.
            // Avoid spamming the console if the fallback endpoint is unavailable.
            const status = error?.response?.status;
            if (status && status !== 404) {
                console.error('[CourtStore] fetchState error:', error);
            }
        }
    },

    /**
     * Reset to idle state
     */
    reset: () => {
        set({
            phase: 'IDLE',
            myViewPhase: VIEW_PHASE.IDLE,
            session: null,
            localEvidence: '',
            localFeelings: '',
            localAddendum: '',
            isSubmitting: false,
            isGeneratingVerdict: false,
            showRatingPopup: false,
            showSettlementRequest: false,
            error: null
        });
    },

    // === Event Bus Integration ===

    /**
     * Initialize event bus listeners
     * Call this once during app startup
     */
    init: () => {
        // Clear any existing listeners
        eventCleanupFns.forEach(fn => fn());
        eventCleanupFns = [];

        // Listen for auth logout - reset court state
        const unsubLogout = eventBus.on(EVENTS.AUTH_LOGOUT, () => {
            console.log('[CourtStore] Received AUTH_LOGOUT event, resetting court state');
            set({ _authUserId: null, _authPartnerId: null });
            get().reset();
        });
        eventCleanupFns.push(unsubLogout);

        // Listen for auth login - cache user data
        const unsubLogin = eventBus.on(EVENTS.AUTH_LOGIN, ({ userId, partner }) => {
            console.log('[CourtStore] Received AUTH_LOGIN event, caching userId:', userId);
            set({
                _authUserId: userId,
                _authPartnerId: partner?.id || null
            });
        });
        eventCleanupFns.push(unsubLogin);

        // Listen for partner connection - cache partner ID
        const unsubPartner = eventBus.on(EVENTS.PARTNER_CONNECTED, ({ partnerId }) => {
            console.log('[CourtStore] Received PARTNER_CONNECTED event, caching partnerId:', partnerId);
            set({ _authPartnerId: partnerId });
        });
        eventCleanupFns.push(unsubPartner);

        console.log('[CourtStore] Event bus listeners initialized');
    },

    /**
     * Cleanup event bus listeners
     */
    cleanup: () => {
        eventCleanupFns.forEach(fn => fn());
        eventCleanupFns = [];
        console.log('[CourtStore] Event bus listeners cleaned up');
    },

    // === Helpers ===

    /**
     * Check if current user is the session creator
     */
    isCreator: () => {
        const { session, _authUserId } = get();
        return session?.creatorId === _authUserId;
    },

    /**
     * Get partner info from session
     */
    getPartner: () => {
        const { session, _authUserId } = get();
        if (!session) return null;

        return {
            id: session.creatorId === _authUserId ? session.partnerId : session.creatorId,
            isCreator: session.creatorId !== _authUserId
        };
    },

    /**
     * Get current phase (for backward compatibility)
     */
    getPhase: () => {
        return get().myViewPhase || get().phase || VIEW_PHASE.IDLE;
    }
}));

export default useCourtStore;
