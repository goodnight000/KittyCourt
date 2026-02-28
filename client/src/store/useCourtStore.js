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
import useCacheStore, { cacheKey } from './useCacheStore';

const isOnline = () => typeof navigator !== 'undefined' && navigator.onLine;

const DRAFT_KEY = 'pause-court-draft';

const saveDraft = (get) => {
    const { localEvidence, localFeelings, localNeeds } = get();
    if (localEvidence || localFeelings || localNeeds) {
        try {
            localStorage.setItem(DRAFT_KEY, JSON.stringify({ localEvidence, localFeelings, localNeeds }));
        } catch (_e) { /* quota exceeded - best effort */ }
    } else {
        try {
            localStorage.removeItem(DRAFT_KEY);
        } catch (_e) { /* best effort */ }
    }
};

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

// API base path
const COURT_API = '/court';
const STALE_THRESHOLD_MS = 10000;

// Event bus listener cleanup functions
let eventCleanupFns = [];

// Module-level socket reference (non-reactive, prevents unnecessary re-renders)
let socketInstance = null;

const useCourtStore = create((set, get) => {
    const fallbackFetch = () => get().fetchState({ force: true });
    const createCourtAction = ({
        socketEvent,
        apiPath,
        timeoutMs = 2500,
        fallbackFn = fallbackFetch,
        syncState = true,
        onSocketError = null,
        onApiError = null,
        includeUserId = true
    }) => async (payload = {}) => {
        if (socketInstance?.connected) {
            const action = createSocketAction(socketEvent, { timeoutMs, fallbackFn });
            const response = await action(socketInstance, payload);

            if (syncState && response?.state) get().onStateSync(response.state);
            if (response?.error) {
                if (onSocketError) {
                    onSocketError(response.error);
                } else {
                    get().onError(response.error);
                }
            }

            return response;
        }

        if (!apiPath) return null;

        try {
            const userId = get()._authUserId;
            const body = includeUserId ? { userId, ...payload } : payload;
            const response = await api.post(`${COURT_API}${apiPath}`, body);

            if (syncState && response?.data) get().onStateSync(response.data);
            return response?.data || null;
        } catch (error) {
            const message = error.response?.data?.error || error.message;
            if (onApiError) {
                onApiError(message);
            } else {
                get().onError(message);
            }
            return null;
        }
    };

    return ({
    // === State (from server) ===
    phase: 'IDLE',
    myViewPhase: VIEW_PHASE.IDLE,
    session: null,

    // === Connection State ===
    isConnected: false,
    // Note: Socket reference is stored in module-level socketInstance variable
    // to prevent unnecessary re-renders. Use getSocketRef() to access.

    // Last time we received authoritative state (ms since epoch)
    lastSyncAt: 0,

    // Local cache of auth data from events (to avoid circular dependencies)
    _authUserId: null,
    _authPartnerId: null,

    // === Local Input (not synced until submit) ===
    localEvidence: '',
    localFeelings: '',
    localNeeds: '',
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

    setLocalEvidence: (text) => { set({ localEvidence: text }); saveDraft(get); },
    setLocalFeelings: (text) => { set({ localFeelings: text }); saveDraft(get); },
    setLocalNeeds: (text) => { set({ localNeeds: text }); saveDraft(get); },
    setLocalAddendum: (text) => set({ localAddendum: text }),

    loadDraft: () => {
        try {
            const raw = localStorage.getItem(DRAFT_KEY);
            if (!raw) return;
            const { localEvidence, localFeelings, localNeeds } = JSON.parse(raw);
            set({
                localEvidence: localEvidence || '',
                localFeelings: localFeelings || '',
                localNeeds: localNeeds || ''
            });
        } catch (_e) { /* malformed JSON or no access - best effort */ }
    },

    clearDraft: () => {
        try {
            localStorage.removeItem(DRAFT_KEY);
        } catch (_e) { /* best effort */ }
    },
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
        const partnerId = get()._authPartnerId;

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
                ? { localEvidence: '', localFeelings: '', localNeeds: '', localAddendum: '' }
                : {}),
            // Decline indicator should not leak across sessions
            ...(isSessionCleared || isNewSession ? { settlementDeclinedNotice: null } : {}),
            ...(isSessionCleared || isNewSession ? { dismissedRatingSessionId: null } : {})
        });

        if (isSessionCleared || isNewSession) {
            const cacheStore = useCacheStore.getState();
            if (userId && partnerId) {
                cacheStore.invalidate(cacheKey.caseHistory(userId, partnerId));
                const caseRefresh = cacheStore.revalidate(cacheKey.caseHistory(userId, partnerId), { onlyStale: false });
                if (caseRefresh?.catch) caseRefresh.catch(() => {});
            }
            if (userId) {
                cacheStore.invalidate(cacheKey.stats(userId));
                const statsRefresh = cacheStore.revalidate(cacheKey.stats(userId), { onlyStale: false });
                if (statsRefresh?.catch) statsRefresh.catch(() => {});
            }
        }
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
     * @param {string} judgeType - Selected judge: 'classic', 'swift', or 'wise'
     */
    serve: async (partnerId, coupleId, judgeType = 'swift') => {
        set({ isSubmitting: true, error: null });
        await createCourtAction({
            socketEvent: 'court:serve',
            apiPath: '/serve'
        })({ partnerId, coupleId, judgeType });
        set({ isSubmitting: false });
    },

    /**
     * Accept pending summons
     */
    accept: async () => {
        set({ isSubmitting: true, error: null });
        await createCourtAction({
            socketEvent: 'court:accept',
            apiPath: '/accept'
        })();
        set({ isSubmitting: false });
    },

    /**
     * Cancel pending session
     */
    cancel: async () => {
        set({ isSubmitting: true, error: null });
        await createCourtAction({
            socketEvent: 'court:cancel',
            apiPath: '/cancel'
        })();
        set({ isSubmitting: false });
    },

    /**
     * Dismiss session from any phase (for error recovery)
     */
    dismiss: async () => {
        set({ isSubmitting: true, error: null });

        if (!socketInstance?.connected) {
            get().reset();
            set({ isSubmitting: false });
            return;
        }

        await createCourtAction({
            socketEvent: 'court:dismiss',
            apiPath: null,
            fallbackFn: () => {
                get().reset();
                return Promise.resolve();
            },
            onSocketError: () => {
                get().reset();
            }
        })();

        set({ isSubmitting: false });
    },

    /**
     * Submit evidence
     */
    submitEvidence: async () => {
        const { localEvidence, localFeelings, localNeeds } = get();
        set({ isSubmitting: true, error: null });
        const payload = { evidence: localEvidence, feelings: localFeelings, needs: localNeeds };
        const shouldClearBefore = socketInstance?.connected;

        if (shouldClearBefore) {
            set({ localEvidence: '', localFeelings: '', localNeeds: '' });
            get().clearDraft();
        }

        await createCourtAction({
            socketEvent: 'court:submit_evidence',
            apiPath: '/evidence'
        })(payload);

        if (!shouldClearBefore) {
            set({ localEvidence: '', localFeelings: '', localNeeds: '' });
            get().clearDraft();
        }

        set({ isSubmitting: false });
    },

    /**
     * Accept verdict
     */
    acceptVerdict: async () => {
        set({ isSubmitting: true, error: null });
        await createCourtAction({
            socketEvent: 'court:accept_verdict',
            apiPath: '/verdict/accept'
        })();
        set({ isSubmitting: false });
    },

    /**
     * Request settlement
     */
    requestSettlement: async () => {
        set({ error: null });
        await createCourtAction({
            socketEvent: 'court:request_settle',
            apiPath: '/settle/request'
        })();
    },

    /**
     * Accept settlement
     */
    acceptSettlement: async () => {
        set({ isSubmitting: true, error: null, showSettlementRequest: false });
        await createCourtAction({
            socketEvent: 'court:accept_settle',
            apiPath: '/settle/accept'
        })();
        set({ isSubmitting: false });
    },

    /**
     * Decline settlement (case continues)
     */
    declineSettlement: async () => {
        set({ isSubmitting: true, error: null, showSettlementRequest: false });
        await createCourtAction({
            socketEvent: 'court:decline_settle',
            apiPath: '/settle/decline'
        })();
        set({ isSubmitting: false });
    },

    /**
     * Submit addendum
     */
    submitAddendum: async () => {
        const { localAddendum } = get();
        if (!localAddendum.trim()) return;

        set({ isSubmitting: true, error: null });
        const shouldClearBefore = socketInstance?.connected;
        if (shouldClearBefore) {
            set({ localAddendum: '' });
        }

        await createCourtAction({
            socketEvent: 'court:submit_addendum',
            apiPath: '/addendum',
            timeoutMs: 4000
        })({ text: localAddendum });

        if (!shouldClearBefore) {
            set({ localAddendum: '' });
        }

        set({ isSubmitting: false });
    },

    /**
     * Mark priming as complete (v2.0)
     */
    markPrimingComplete: async () => {
        set({ isSubmitting: true, error: null });
        await createCourtAction({
            socketEvent: 'court:priming_complete',
            apiPath: '/priming/complete'
        })();
        set({ isSubmitting: false });
    },

    /**
     * Mark joint menu as ready (v2.0)
     */
    markJointReady: async () => {
        set({ isSubmitting: true, error: null });
        await createCourtAction({
            socketEvent: 'court:joint_ready',
            apiPath: '/joint/ready'
        })();
        set({ isSubmitting: false });
    },

    /**
     * Submit resolution pick (v2.0)
     */
    submitResolutionPick: async (resolutionId) => {
        if (!resolutionId) return;
        set({ isSubmitting: true, error: null });
        await createCourtAction({
            socketEvent: 'court:resolution_pick',
            apiPath: '/resolution/pick'
        })({ resolutionId });
        set({ isSubmitting: false });
    },

    /**
     * Accept partner's resolution (v2.0)
     */
    acceptPartnerResolution: async () => {
        set({ isSubmitting: true, error: null });
        await createCourtAction({
            socketEvent: 'court:resolution_accept_partner',
            apiPath: '/resolution/accept-partner'
        })();
        set({ isSubmitting: false });
    },

    /**
     * Request hybrid resolution (v2.0)
     */
    requestHybridResolution: async () => {
        set({ isSubmitting: true, error: null });
        await createCourtAction({
            socketEvent: 'court:resolution_hybrid',
            apiPath: '/resolution/hybrid',
            timeoutMs: 5000
        })();
        set({ isSubmitting: false });
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
            const cacheStore = useCacheStore.getState();
            if (userId && get()._authPartnerId) {
                const partnerId = get()._authPartnerId;
                cacheStore.invalidate(cacheKey.caseHistory(userId, partnerId));
                const caseRefresh = cacheStore.revalidate(cacheKey.caseHistory(userId, partnerId), { onlyStale: false });
                if (caseRefresh?.catch) caseRefresh.catch(() => {});
            }
            cacheStore.invalidate(cacheKey.stats(userId));
            const statsRefresh = cacheStore.revalidate(cacheKey.stats(userId), { onlyStale: false });
            if (statsRefresh?.catch) statsRefresh.catch(() => {});
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
        if (!isOnline()) return;
        try {
            const userId = get()._authUserId;
            if (!userId) return;

            // If WebSocket is connected, server will push the authoritative state.
            const lastSyncAt = get().lastSyncAt;
            const stale = !lastSyncAt || Date.now() - lastSyncAt > STALE_THRESHOLD_MS;
            if (!force && (socketInstance?.connected || get().isConnected) && !stale) {
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
        get().clearDraft();
        set({
            phase: 'IDLE',
            myViewPhase: VIEW_PHASE.IDLE,
            session: null,
            localEvidence: '',
            localFeelings: '',
            localNeeds: '',
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
            if (import.meta.env.DEV) console.log('[CourtStore] Received AUTH_LOGOUT event, resetting court state');
            set({ _authUserId: null, _authPartnerId: null });
            get().reset();
        });
        eventCleanupFns.push(unsubLogout);

        // Listen for auth login - cache user data
        const unsubLogin = eventBus.on(EVENTS.AUTH_LOGIN, ({ userId, partner }) => {
            if (import.meta.env.DEV) console.log('[CourtStore] Received AUTH_LOGIN event, caching userId:', userId);
            set({
                _authUserId: userId,
                _authPartnerId: partner?.id || null
            });
        });
        eventCleanupFns.push(unsubLogin);

        // Listen for partner connection - cache partner ID
        const unsubPartner = eventBus.on(EVENTS.PARTNER_CONNECTED, ({ partnerId }) => {
            if (import.meta.env.DEV) console.log('[CourtStore] Received PARTNER_CONNECTED event, caching partnerId:', partnerId);
            set({ _authPartnerId: partnerId });
        });
        eventCleanupFns.push(unsubPartner);

        if (import.meta.env.DEV) console.log('[CourtStore] Event bus listeners initialized');
    },

    /**
     * Cleanup event bus listeners
     */
    cleanup: () => {
        eventCleanupFns.forEach(fn => fn());
        eventCleanupFns = [];
        if (import.meta.env.DEV) console.log('[CourtStore] Event bus listeners cleaned up');
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
    });
});

export const setSocketRef = (socket) => {
    socketInstance = socket;
};

export const getSocketRef = () => socketInstance;

export default useCourtStore;
