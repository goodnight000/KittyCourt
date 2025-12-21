/**
 * Court Store - Clean Architecture
 * 
 * Single source of truth for client-side court state.
 * Receives state updates exclusively from WebSocket or API.
 */

import { create } from 'zustand';
import api from '../services/api';
import useAuthStore from './useAuthStore';

// View phases (must match server)
export const VIEW_PHASE = {
    IDLE: 'IDLE',
    PENDING_CREATOR: 'PENDING_CREATOR',
    PENDING_PARTNER: 'PENDING_PARTNER',
    EVIDENCE: 'EVIDENCE',
    WAITING_EVIDENCE: 'WAITING_EVIDENCE',
    // Legacy
    DELIBERATING: 'DELIBERATING',
    IN_SESSION: 'IN_SESSION', // Legacy alias
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

// Alias for backward compatibility with CourtroomPage
export const COURT_PHASES = VIEW_PHASE;

// Socket reference (set by useCourtSocket hook)
let socketRef = null;
export const setSocketRef = (socket) => { socketRef = socket; };
export const getSocketRef = () => socketRef;

// API base path
const COURT_API = '/court';

const useCourtStore = create((set, get) => ({
    // === State (from server) ===
    phase: 'IDLE',
    myViewPhase: VIEW_PHASE.IDLE,
    session: null,

    // === Connection State ===
    isConnected: false,

    // Last time we received authoritative state (ms since epoch)
    lastSyncAt: 0,

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

        const nextSessionId = session?.id;
        const isNewSession = !!(nextSessionId && nextSessionId !== prevSessionId);
        const isSessionCleared = !session;

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
            // Detect deliberating
            isGeneratingVerdict: [VIEW_PHASE.DELIBERATING, VIEW_PHASE.ANALYZING].includes(myViewPhase),
            // UI-only animations never persist across sessions
            ...(isSessionCleared || isNewSession ? { showOpeningAnimation: false, showCelebrationAnimation: false } : {}),
            // Clear stale local inputs when a session ends or a new session starts
            ...(isSessionCleared || isNewSession
                ? { localEvidence: '', localFeelings: '', localAddendum: '' }
                : {}),
            // Settlement request UI should not persist across ended sessions
            ...(isSessionCleared ? { showSettlementRequest: false } : {}),
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
            await new Promise((resolve) => {
                let done = false;
                const timeout = setTimeout(() => {
                    if (done) return;
                    done = true;
                    set({ isSubmitting: false });
                    // Force resync in case WS state didn't arrive
                    get().fetchState({ force: true }).finally(resolve);
                }, 2500);

                socketRef.emit('court:serve', { partnerId, coupleId, judgeType }, (resp) => {
                    if (done) return;
                    done = true;
                    clearTimeout(timeout);
                    if (resp?.state) get().onStateSync(resp.state);
                    if (resp?.error) get().onError(resp.error);
                    set({ isSubmitting: false });
                    resolve();
                });
            });
        } else {
            // API fallback
            try {
                const userId = get()._getUserId();
                const response = await api.post(`${COURT_API}/serve`, { userId, partnerId, coupleId, judgeType });
                get().onStateSync(response.data);
            } catch (error) {
                get().onError(error.response?.data?.error || error.message);
            }
        }
    },

    /**
     * Accept pending summons
     */
    accept: async () => {
        set({ isSubmitting: true, error: null });

        if (socketRef?.connected) {
            await new Promise((resolve) => {
                let done = false;
                const timeout = setTimeout(() => {
                    if (done) return;
                    done = true;
                    set({ isSubmitting: false });
                    get().fetchState({ force: true }).finally(resolve);
                }, 2500);

                socketRef.emit('court:accept', (resp) => {
                    if (done) return;
                    done = true;
                    clearTimeout(timeout);
                    if (resp?.state) get().onStateSync(resp.state);
                    if (resp?.error) get().onError(resp.error);
                    set({ isSubmitting: false });
                    resolve();
                });
            });
        } else {
            try {
                const userId = get()._getUserId();
                const response = await api.post(`${COURT_API}/accept`, { userId });
                get().onStateSync(response.data);
            } catch (error) {
                get().onError(error.response?.data?.error || error.message);
            }
        }
    },

    /**
     * Cancel pending session
     */
    cancel: async () => {
        set({ isSubmitting: true, error: null });

        if (socketRef?.connected) {
            await new Promise((resolve) => {
                let done = false;
                const timeout = setTimeout(() => {
                    if (done) return;
                    done = true;
                    set({ isSubmitting: false });
                    get().fetchState({ force: true }).finally(resolve);
                }, 2500);

                socketRef.emit('court:cancel', (resp) => {
                    if (done) return;
                    done = true;
                    clearTimeout(timeout);
                    if (resp?.state) get().onStateSync(resp.state);
                    if (resp?.error) get().onError(resp.error);
                    set({ isSubmitting: false });
                    resolve();
                });
            });
        } else {
            try {
                const userId = get()._getUserId();
                const response = await api.post(`${COURT_API}/cancel`, { userId });
                get().onStateSync(response.data);
            } catch (error) {
                get().onError(error.response?.data?.error || error.message);
            }
        }
    },

    /**
     * Dismiss session from any phase (for error recovery)
     */
    dismiss: async () => {
        set({ isSubmitting: true, error: null });

        if (socketRef?.connected) {
            await new Promise((resolve) => {
                let done = false;
                const timeout = setTimeout(() => {
                    if (done) return;
                    done = true;
                    set({ isSubmitting: false });
                    // Force reset local state even if server didn't respond
                    get().reset();
                    resolve();
                }, 2500);

                socketRef.emit('court:dismiss', (resp) => {
                    if (done) return;
                    done = true;
                    clearTimeout(timeout);
                    if (resp?.state) get().onStateSync(resp.state);
                    if (resp?.error) {
                        // If dismiss fails (e.g., no session), just reset locally
                        get().reset();
                    }
                    set({ isSubmitting: false });
                    resolve();
                });
            });
        } else {
            // No API fallback for dismiss - just reset locally
            get().reset();
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

            await new Promise((resolve) => {
                let done = false;
                const timeout = setTimeout(() => {
                    if (done) return;
                    done = true;
                    set({ isSubmitting: false });
                    // Force resync if WS state didn't arrive
                    get().fetchState({ force: true }).finally(resolve);
                }, 2500);

                socketRef.emit(
                    'court:submit_evidence',
                    { evidence: localEvidence, feelings: localFeelings },
                    (resp) => {
                        if (done) return;
                        done = true;
                        clearTimeout(timeout);
                        if (resp?.state) get().onStateSync(resp.state);
                        if (resp?.error) get().onError(resp.error);
                        set({ isSubmitting: false });
                        resolve();
                    }
                );
            });
        } else {
            try {
                const userId = get()._getUserId();
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
        }
    },

    /**
     * Accept verdict
     */
    acceptVerdict: async () => {
        set({ isSubmitting: true, error: null });

        if (socketRef?.connected) {
            await new Promise((resolve) => {
                let done = false;
                const timeout = setTimeout(() => {
                    if (done) return;
                    done = true;
                    set({ isSubmitting: false });
                    get().fetchState({ force: true }).finally(resolve);
                }, 2500);

                socketRef.emit('court:accept_verdict', (resp) => {
                    if (done) return;
                    done = true;
                    clearTimeout(timeout);
                    if (resp?.state) get().onStateSync(resp.state);
                    if (resp?.error) get().onError(resp.error);
                    set({ isSubmitting: false });
                    resolve();
                });
            });
        } else {
            try {
                const userId = get()._getUserId();
                const response = await api.post(`${COURT_API}/verdict/accept`, { userId });
                get().onStateSync(response.data);
            } catch (error) {
                get().onError(error.response?.data?.error || error.message);
            }
        }
    },

    /**
     * Request settlement
     */
    requestSettlement: async () => {
        set({ error: null });

        if (socketRef?.connected) {
            socketRef.emit('court:request_settle', (resp) => {
                if (resp?.state) get().onStateSync(resp.state);
                if (resp?.error) get().onError(resp.error);
            });
        } else {
            try {
                const userId = get()._getUserId();
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
            await new Promise((resolve) => {
                let done = false;
                const timeout = setTimeout(() => {
                    if (done) return;
                    done = true;
                    set({ isSubmitting: false });
                    get().fetchState({ force: true }).finally(resolve);
                }, 2500);

                socketRef.emit('court:accept_settle', (resp) => {
                    if (done) return;
                    done = true;
                    clearTimeout(timeout);
                    if (resp?.state) get().onStateSync(resp.state);
                    if (resp?.error) get().onError(resp.error);
                    set({ isSubmitting: false });
                    resolve();
                });
            });
        } else {
            try {
                const userId = get()._getUserId();
                const response = await api.post(`${COURT_API}/settle/accept`, { userId });
                get().onStateSync(response.data);
            } catch (error) {
                get().onError(error.response?.data?.error || error.message);
            }
        }
    },

    /**
     * Decline settlement (case continues)
     */
    declineSettlement: async () => {
        set({ isSubmitting: true, error: null, showSettlementRequest: false });

        if (socketRef?.connected) {
            await new Promise((resolve) => {
                let done = false;
                const timeout = setTimeout(() => {
                    if (done) return;
                    done = true;
                    set({ isSubmitting: false });
                    get().fetchState({ force: true }).finally(resolve);
                }, 2500);

                socketRef.emit('court:decline_settle', (resp) => {
                    if (done) return;
                    done = true;
                    clearTimeout(timeout);
                    if (resp?.state) get().onStateSync(resp.state);
                    if (resp?.error) get().onError(resp.error);
                    set({ isSubmitting: false });
                    resolve();
                });
            });
        } else {
            try {
                const userId = get()._getUserId();
                const response = await api.post(`${COURT_API}/settle/decline`, { userId });
                get().onStateSync(response.data);
            } catch (error) {
                get().onError(error.response?.data?.error || error.message);
            }
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

            await new Promise((resolve) => {
                let done = false;
                const timeout = setTimeout(() => {
                    if (done) return;
                    done = true;
                    set({ isSubmitting: false });
                    get().fetchState({ force: true }).finally(resolve);
                }, 4000);

                socketRef.emit('court:submit_addendum', { text: localAddendum }, (resp) => {
                    if (done) return;
                    done = true;
                    clearTimeout(timeout);
                    if (resp?.state) get().onStateSync(resp.state);
                    if (resp?.error) get().onError(resp.error);
                    set({ isSubmitting: false });
                    resolve();
                });
            });
        } else {
            try {
                const userId = get()._getUserId();
                const response = await api.post(`${COURT_API}/addendum`, {
                    userId,
                    text: localAddendum
                });
                get().onStateSync(response.data);
                set({ localAddendum: '' });
            } catch (error) {
                get().onError(error.response?.data?.error || error.message);
            }
        }
    },

    /**
     * Mark priming as complete (v2.0)
     */
    markPrimingComplete: async () => {
        set({ isSubmitting: true, error: null });

        if (socketRef?.connected) {
            await new Promise((resolve) => {
                let done = false;
                const timeout = setTimeout(() => {
                    if (done) return;
                    done = true;
                    set({ isSubmitting: false });
                    get().fetchState({ force: true }).finally(resolve);
                }, 2500);

                socketRef.emit('court:priming_complete', (resp) => {
                    if (done) return;
                    done = true;
                    clearTimeout(timeout);
                    if (resp?.state) get().onStateSync(resp.state);
                    if (resp?.error) get().onError(resp.error);
                    set({ isSubmitting: false });
                    resolve();
                });
            });
        } else {
            try {
                const userId = get()._getUserId();
                const response = await api.post(`${COURT_API}/priming/complete`, { userId });
                get().onStateSync(response.data);
            } catch (error) {
                get().onError(error.response?.data?.error || error.message);
            }
        }
    },

    /**
     * Mark joint menu as ready (v2.0)
     */
    markJointReady: async () => {
        set({ isSubmitting: true, error: null });

        if (socketRef?.connected) {
            await new Promise((resolve) => {
                let done = false;
                const timeout = setTimeout(() => {
                    if (done) return;
                    done = true;
                    set({ isSubmitting: false });
                    get().fetchState({ force: true }).finally(resolve);
                }, 2500);

                socketRef.emit('court:joint_ready', (resp) => {
                    if (done) return;
                    done = true;
                    clearTimeout(timeout);
                    if (resp?.state) get().onStateSync(resp.state);
                    if (resp?.error) get().onError(resp.error);
                    set({ isSubmitting: false });
                    resolve();
                });
            });
        } else {
            try {
                const userId = get()._getUserId();
                const response = await api.post(`${COURT_API}/joint/ready`, { userId });
                get().onStateSync(response.data);
            } catch (error) {
                get().onError(error.response?.data?.error || error.message);
            }
        }
    },

    /**
     * Submit resolution pick (v2.0)
     */
    submitResolutionPick: async (resolutionId) => {
        if (!resolutionId) return;
        set({ isSubmitting: true, error: null });

        if (socketRef?.connected) {
            await new Promise((resolve) => {
                let done = false;
                const timeout = setTimeout(() => {
                    if (done) return;
                    done = true;
                    set({ isSubmitting: false });
                    get().fetchState({ force: true }).finally(resolve);
                }, 2500);

                socketRef.emit('court:resolution_pick', { resolutionId }, (resp) => {
                    if (done) return;
                    done = true;
                    clearTimeout(timeout);
                    if (resp?.state) get().onStateSync(resp.state);
                    if (resp?.error) get().onError(resp.error);
                    set({ isSubmitting: false });
                    resolve();
                });
            });
        } else {
            try {
                const userId = get()._getUserId();
                const response = await api.post(`${COURT_API}/resolution/pick`, { userId, resolutionId });
                get().onStateSync(response.data);
            } catch (error) {
                get().onError(error.response?.data?.error || error.message);
            }
        }
    },

    /**
     * Accept partner's resolution (v2.0)
     */
    acceptPartnerResolution: async () => {
        set({ isSubmitting: true, error: null });

        if (socketRef?.connected) {
            await new Promise((resolve) => {
                let done = false;
                const timeout = setTimeout(() => {
                    if (done) return;
                    done = true;
                    set({ isSubmitting: false });
                    get().fetchState({ force: true }).finally(resolve);
                }, 2500);

                socketRef.emit('court:resolution_accept_partner', (resp) => {
                    if (done) return;
                    done = true;
                    clearTimeout(timeout);
                    if (resp?.state) get().onStateSync(resp.state);
                    if (resp?.error) get().onError(resp.error);
                    set({ isSubmitting: false });
                    resolve();
                });
            });
        } else {
            try {
                const userId = get()._getUserId();
                const response = await api.post(`${COURT_API}/resolution/accept-partner`, { userId });
                get().onStateSync(response.data);
            } catch (error) {
                get().onError(error.response?.data?.error || error.message);
            }
        }
    },

    /**
     * Request hybrid resolution (v2.0)
     */
    requestHybridResolution: async () => {
        set({ isSubmitting: true, error: null });

        if (socketRef?.connected) {
            await new Promise((resolve) => {
                let done = false;
                const timeout = setTimeout(() => {
                    if (done) return;
                    done = true;
                    set({ isSubmitting: false });
                    get().fetchState({ force: true }).finally(resolve);
                }, 5000);

                socketRef.emit('court:resolution_hybrid', (resp) => {
                    if (done) return;
                    done = true;
                    clearTimeout(timeout);
                    if (resp?.state) get().onStateSync(resp.state);
                    if (resp?.error) get().onError(resp.error);
                    set({ isSubmitting: false });
                    resolve();
                });
            });
        } else {
            try {
                const userId = get()._getUserId();
                const response = await api.post(`${COURT_API}/resolution/hybrid`, { userId });
                get().onStateSync(response.data);
            } catch (error) {
                get().onError(error.response?.data?.error || error.message);
            }
        }
    },

    /**
     * Submit verdict rating (1-5) for the latest verdict on the resolved case.
     * Stored per-user on the backend.
     */
    submitVerdictRating: async (rating) => {
        try {
            const userId = get()._getUserId();
            let caseId = get().session?.caseId;
            if (!userId) {
                throw new Error('Missing userId');
            }
            if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
                throw new Error('Invalid rating');
            }

            // If caseId isn't present yet (race on close), attempt to resolve latest case for the couple.
            if (!caseId) {
                const partnerId = useAuthStore.getState().partner?.id;
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
            const userId = get()._getUserId();
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

    // === Helpers ===

    /**
     * Get user ID from auth store
     */
    _getUserId: () => {
        return useAuthStore.getState().user?.id;
    },

    /**
     * Check if current user is the session creator
     */
    isCreator: () => {
        const { session } = get();
        const userId = get()._getUserId();
        return session?.creatorId === userId;
    },

    /**
     * Get partner info from session
     */
    getPartner: () => {
        const { session } = get();
        const userId = get()._getUserId();
        if (!session) return null;

        return {
            id: session.creatorId === userId ? session.partnerId : session.creatorId,
            isCreator: session.creatorId !== userId
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
