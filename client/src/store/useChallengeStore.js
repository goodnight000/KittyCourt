/**
 * Challenge Store - Zustand store for challenges state
 * 
 * Phase 2B: Client wiring for /api/challenges
 * Includes optimistic UI for skip action.
 */
import { create } from 'zustand';
import api from '../services/api';
import useCacheStore, { CACHE_POLICY, cacheKey } from './useCacheStore';
import { eventBus, EVENTS } from '../lib/eventBus';

let cacheListenerKey = null;
let cacheUnsubscribe = null;
let eventCleanupFns = [];

// Feature flag check
const isXPSystemEnabled = () => import.meta.env.VITE_XP_SYSTEM_ENABLED === 'true';

const useChallengeStore = create((set, get) => ({
    // State
    active: [],
    completed: [],
    isLoading: false,
    error: null,
    errorCode: null,
    lastFetched: null,
    _authUserId: null,
    _authPartnerId: null,

    // Computed
    hasActiveChallenges: () => get().active.length > 0,
    hasChallenges: () => get().active.length > 0,

    init: () => {
        eventCleanupFns.forEach(fn => fn());
        eventCleanupFns = [];

        const unsubLogin = eventBus.on(EVENTS.AUTH_LOGIN, (payload) => {
            set({
                _authUserId: payload?.userId || null,
                _authPartnerId: payload?.partner?.id || payload?.profile?.partner_id || null,
            });
        });

        const unsubProfile = eventBus.on(EVENTS.PROFILE_UPDATED, (payload) => {
            if (!payload?.profile && !payload?.partner) return;
            set({
                _authPartnerId: payload?.partner?.id || payload?.profile?.partner_id || null,
            });
        });

        const unsubPartner = eventBus.on(EVENTS.PARTNER_CONNECTED, (payload) => {
            if (payload?.partnerId) {
                set({ _authPartnerId: payload.partnerId });
            }
        });

        const unsubLogout = eventBus.on(EVENTS.AUTH_LOGOUT, () => {
            get().reset();
        });

        eventCleanupFns.push(unsubLogin, unsubProfile, unsubPartner, unsubLogout);
    },

    cleanup: () => {
        eventCleanupFns.forEach(fn => fn());
        eventCleanupFns = [];
    },

        // Actions
    fetchChallenges: async ({ force = false } = {}) => {
        if (!isXPSystemEnabled()) {
            set({ active: [], completed: [], isLoading: false, error: null, errorCode: null });
            return;
        }

        // Prevent duplicate fetches
        if (get().isLoading) return;

        set({ isLoading: true, error: null, errorCode: null });

        try {
            const cacheStore = useCacheStore.getState();
            const userId = get()._authUserId;
            const partnerId = get()._authPartnerId || null;

            const applyPayload = (payload) => {
                const data = payload || {};
                set({
                    active: data.active || [],
                    completed: data.completed || [],
                    isLoading: false,
                    lastFetched: new Date().toISOString(),
                    error: null,
                    errorCode: null,
                });
            };

            if (userId) {
                const key = cacheKey.challenges(userId, partnerId);
                if (cacheListenerKey !== key) {
                    if (cacheUnsubscribe) cacheUnsubscribe();
                    cacheUnsubscribe = cacheStore.subscribeKey(key, (payload) => {
                        applyPayload(payload);
                    });
                    cacheListenerKey = key;
                }
                if (force) {
                    const fresh = await cacheStore.fetchAndCache(key, async () => {
                        const response = await api.get('/challenges');
                        return response?.data || {};
                    }, CACHE_POLICY.CHALLENGES);
                    applyPayload(fresh);
                    return;
                }

                const { data, promise } = await cacheStore.getOrFetch({
                    key,
                    fetcher: async () => {
                        const response = await api.get('/challenges');
                        return response?.data || {};
                    },
                    ...CACHE_POLICY.CHALLENGES,
                    revalidateOnInterval: true,
                });

                applyPayload(data);

                if (promise) {
                    promise.then((fresh) => applyPayload(fresh)).catch(() => {});
                }
                return;
            }

            const response = await api.get('/challenges');
            applyPayload(response?.data || {});
        } catch (error) {
            console.error('[ChallengeStore] Failed to fetch challenges:', error);
            set({
                isLoading: false,
                error: error.message || 'Failed to load challenges',
                errorCode: 'LOAD_FAILED',
            });
        }
    },

    // Skip challenge with optimistic UI
    skipChallenge: async (challengeId) => {
        const { active } = get();
        const { fetchChallenges } = get();

        // Optimistic: remove from lists immediately
        const originalActive = [...active];

        set({
            active: active.filter(c => c.id !== challengeId),
        });

        try {
            await api.post(`/challenges/${challengeId}/skip`);
            fetchChallenges({ force: true });
        } catch (error) {
            console.error('[ChallengeStore] Failed to skip challenge:', error);
            // Revert optimistic update
            set({
                active: originalActive,
                error: 'Failed to skip challenge. Please try again.',
                errorCode: 'SKIP_FAILED',
            });
        }
    },

    // Request completion (behavioral challenges)
    completeChallenge: async (challengeId) => {
        const { fetchChallenges } = get();
        try {
            await api.post(`/challenges/${challengeId}/complete`);
            fetchChallenges({ force: true });
        } catch (error) {
            console.error('[ChallengeStore] Failed to request completion:', error);
            set({ error: 'Failed to complete challenge. Please try again.', errorCode: 'COMPLETE_FAILED' });
        }
    },

    // Confirm partner completion
    confirmChallenge: async (challengeId) => {
        const { fetchChallenges } = get();
        try {
            await api.post(`/challenges/${challengeId}/confirm`);
            fetchChallenges({ force: true });
        } catch (error) {
            console.error('[ChallengeStore] Failed to confirm challenge:', error);
            set({ error: 'Failed to confirm challenge. Please try again.', errorCode: 'CONFIRM_FAILED' });
        }
    },

    // Clear error
    clearError: () => set({ error: null, errorCode: null }),

    // Reset store
    reset: () => {
        if (cacheUnsubscribe) cacheUnsubscribe();
        cacheUnsubscribe = null;
        cacheListenerKey = null;
        set({
            active: [],
            completed: [],
            isLoading: false,
            error: null,
            errorCode: null,
            lastFetched: null,
            _authUserId: null,
            _authPartnerId: null,
        });
    },
}));

export default useChallengeStore;
