import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import api from '../services/api';
import useCacheStore, { CACHE_POLICY, cacheKey } from './useCacheStore';
import useCourtStore from './useCourtStore';
import { quotaSafeLocalStorage, sanitizeProfileForStorage } from './quotaSafeStorage';
import { eventBus, EVENTS } from '../lib/eventBus';

const isOnline = () => typeof navigator !== 'undefined' && navigator.onLine;

const normalizeAppreciations = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
};

/**
 * useAppStore - Application-wide state
 *
 * This store handles:
 * - User/profile data
 * - Case history
 * - Appreciations
 * - Economy (kibble)
 * - Daily questions
 *
 * Court session logic has been moved to useCourtStore.js
 *
 * This store listens to auth events from the event bus to:
 * - Reset state on logout
 * - Initialize user-specific state on login
 */

// Event bus listener cleanup functions
let eventCleanupFns = [];
let cacheCleanupFns = [];

const clearCacheListeners = () => {
    cacheCleanupFns.forEach(fn => fn());
    cacheCleanupFns = [];
};

const useAppStore = create(
    persist(
        (set, get) => ({
            // --- User State ---
            currentUser: null,
            users: [],
            isLoading: false,
            error: null,

            // Local cache of auth data from events (to avoid circular dependencies)
            _authUserId: null,
            _authProfile: null,
            _authPartner: null,

            // --- Actions ---
            fetchUsers: async () => {
                if (!isOnline()) return;
                set({ isLoading: true });
                try {
                    const { _authUserId, _authProfile, _authPartner } = get();

                    if (!_authUserId || !_authProfile) {
                        set({ users: [], currentUser: null, isLoading: false });
                        return;
                    }

                    // Build users array from cached auth data
                    const users = [_authProfile];
                    if (_authPartner) {
                        users.push(_authPartner);
                    }

                    // Fetch kibble balances for each user
                    for (const user of users) {
                        try {
                            if (user.id === _authUserId) {
                                const balanceRes = await api.get(`/economy/balance/${user.id}`);
                                user.kibbleBalance = balanceRes.data.balance || 0;
                            } else {
                                user.kibbleBalance = user.kibbleBalance || 0;
                            }
                        } catch {
                            // Intentionally ignored: non-critical balance prefetch
                            user.kibbleBalance = 0;
                        }
                    }

                    // Current user is the auth profile with balance
                    const currentUser = users.find(u => u.id === _authUserId) || _authProfile;

                    set({ users, currentUser, isLoading: false });
                } catch (error) {
                    set({ error: error.message, isLoading: false });
                }
            },

            switchUser: () => {
                console.warn('User switching is disabled in production mode.');
                // No-op
            },

            // --- Case History ---
            caseHistory: [],
            showCelebration: false,

            fetchCaseHistory: async () => {
                if (!isOnline()) return;
                try {
                    const { _authUserId, _authPartner } = get();
                    if (!_authUserId || !_authPartner?.id) return;

                    const cacheStore = useCacheStore.getState();
                    const key = cacheKey.caseHistory(_authUserId, _authPartner.id);

                    // Build query params for filtering
                    const params = new URLSearchParams();
                    params.set('userAId', _authUserId);
                    params.set('userBId', _authPartner.id);

                    const { data, promise } = await cacheStore.getOrFetch({
                        key,
                        fetcher: async () => {
                            const url = `/cases?${params.toString()}`;
                            const response = await api.get(url);
                            return response.data || [];
                        },
                        ...CACHE_POLICY.CASE_HISTORY,
                    });

                    set({ caseHistory: Array.isArray(data) ? data : [] });

                    if (promise) {
                        promise.then((fresh) => {
                            set({ caseHistory: Array.isArray(fresh) ? fresh : [] });
                        }).catch(() => {});
                    }
                } catch (error) {
                    console.error("Failed to fetch case history", error);
                }
            },

            // Load a specific case from history (for viewing/adding addendums)
            loadCase: (caseItem) => {
                const verdict = typeof caseItem.verdict === 'string'
                    ? JSON.parse(caseItem.verdict)
                    : caseItem.verdict;

                // This updates useCourtStore's session for viewing
                useCourtStore.setState({
                    activeCase: {
                        id: caseItem.id,
                        userAInput: caseItem.userAInput,
                        userAFeelings: caseItem.userAFeelings,
                        userBInput: caseItem.userBInput,
                        userBFeelings: caseItem.userBFeelings,
                        verdict,
                        allVerdicts: caseItem.allVerdicts || [],
                        caseTitle: caseItem.caseTitle,
                        severityLevel: caseItem.severityLevel,
                        primaryHissTag: caseItem.primaryHissTag,
                        shortResolution: caseItem.shortResolution
                    }
                });
            },

            // --- Appreciation State ---
            appreciations: [], // Appreciations received by current user from partner

            // Fetch appreciations that the current user received
            fetchAppreciations: async () => {
                const { _authUserId } = get();
                if (!_authUserId) return;

                const cacheStore = useCacheStore.getState();
                const key = cacheKey.appreciations(_authUserId);

                try {
                    const { data, promise } = await cacheStore.getOrFetch({
                        key,
                        fetcher: async () => {
                            const response = await api.get(`/appreciations/${_authUserId}`);
                            return normalizeAppreciations(response.data);
                        },
                        ...CACHE_POLICY.APPRECIATIONS,
                    });

                    set({ appreciations: normalizeAppreciations(data) });

                    if (promise) {
                        promise.then((fresh) => {
                            set({ appreciations: normalizeAppreciations(fresh) });
                        }).catch(() => {});
                    }
                } catch (error) {
                    console.error("Failed to fetch appreciations", error);
                }
            },

            // --- Economy Actions ---
            // When you show appreciation, you're logging something your PARTNER did
            // So the kibble goes to your partner and it's logged as an appreciation
            logGoodDeed: async (description) => {
                const { _authUserId, _authPartner } = get();
                if (!_authUserId || !_authPartner?.id) return;

                try {
                    // Log appreciation (partner receives it)
                    // Note: Backend automatically awards kibble, so no separate transaction needed
                    await api.post('/appreciations', {
                        toUserId: _authPartner.id,
                        message: description
                    });

                    // Invalidate partner's appreciations cache (they received a new one)
                    const cacheStore = useCacheStore.getState();
                    cacheStore.invalidate(cacheKey.appreciations(_authPartner.id));
                    cacheStore.invalidate(cacheKey.stats(_authPartner.id));
                    cacheStore.invalidate(cacheKey.stats(_authUserId));
                    const statsRefresh = cacheStore.revalidate(cacheKey.stats(_authUserId), { onlyStale: false });
                    if (statsRefresh?.catch) statsRefresh.catch(() => {});

                    // Refresh users and appreciations
                    get().fetchUsers();
                    get().fetchAppreciations();
                } catch (error) {
                    console.error("Failed to log good deed", error);
                }
            },

            redeemCoupon: async (coupon) => {
                const { _authUserId } = get();
                if (!_authUserId) return;

                try {
                    // Check if user has enough kibble
                    const currentUser = get().currentUser;
                    if (!currentUser || currentUser.kibbleBalance < coupon.cost) {
                        throw new Error('Not enough kibble!');
                    }

                    // Deduct kibble (the transaction description serves as the redemption log)
                    await api.post('/economy/transaction', {
                        userId: _authUserId,
                        amount: -coupon.cost,
                        type: 'SPEND',
                        description: `Redeemed: ${coupon.title}`
                    });

                    // Refresh user balance
                    get().fetchUsers();

                    return { success: true };
                } catch (error) {
                    console.error("Failed to redeem coupon", error);
                    throw error;
                }
            },

            // --- Event Bus Integration ---

            setupCacheListeners: ({ userId, partnerId }) => {
                clearCacheListeners();

                const cacheStore = useCacheStore.getState();
                if (userId) {
                    cacheCleanupFns.push(
                        cacheStore.subscribeKey(cacheKey.appreciations(userId), (data) => {
                            set({ appreciations: normalizeAppreciations(data) });
                        })
                    );
                }

                if (userId && partnerId) {
                    cacheCleanupFns.push(
                        cacheStore.subscribeKey(cacheKey.caseHistory(userId, partnerId), (data) => {
                            set({ caseHistory: Array.isArray(data) ? data : [] });
                        })
                    );
                }
            },

            /**
             * Initialize event bus listeners
             * Call this once during app startup
             */
            init: () => {
                // Clear any existing listeners
                eventCleanupFns.forEach(fn => fn());
                eventCleanupFns = [];
                clearCacheListeners();

                // Listen for auth logout - reset all state
                const unsubLogout = eventBus.on(EVENTS.AUTH_LOGOUT, () => {
                    if (import.meta.env.DEV) console.log('[AppStore] Received AUTH_LOGOUT event, resetting state');
                    clearCacheListeners();
                    set({
                        currentUser: null,
                        users: [],
                        caseHistory: [],
                        appreciations: [],
                        showCelebration: false,
                        error: null,
                        _authUserId: null,
                        _authProfile: null,
                        _authPartner: null
                    });
                });
                eventCleanupFns.push(unsubLogout);

                // Listen for auth login - initialize user-specific state
                const unsubLogin = eventBus.on(EVENTS.AUTH_LOGIN, ({ userId, profile, partner }) => {
                    if (import.meta.env.DEV) console.log('[AppStore] Received AUTH_LOGIN event, initializing for userId:', userId);
                    // Cache auth data locally to avoid circular dependencies
                    set({
                        _authUserId: userId,
                        _authProfile: profile,
                        _authPartner: partner
                    });
                    get().setupCacheListeners({ userId, partnerId: partner?.id });
                    // Fetch users (which includes kibble balance)
                    get().fetchUsers();
                    // Fetch appreciations for the logged-in user
                    get().fetchAppreciations();
                    // Fetch case history if partner is connected
                    if (partner) {
                        get().fetchCaseHistory();
                    }
                });
                eventCleanupFns.push(unsubLogin);

                // Listen for partner connection - refresh case history and users
                const unsubPartner = eventBus.on(EVENTS.PARTNER_CONNECTED, ({ partnerId, partnerProfile }) => {
                    if (import.meta.env.DEV) console.log('[AppStore] Received PARTNER_CONNECTED event, partner:', partnerId);
                    // Update cached partner data
                    set({ _authPartner: partnerProfile || { id: partnerId } });
                    get().setupCacheListeners({ userId: get()._authUserId, partnerId });
                    // Refresh case history now that partner is connected
                    get().fetchCaseHistory();
                    // Refresh users to get partner data
                    get().fetchUsers();
                });
                eventCleanupFns.push(unsubPartner);

                // Listen for profile updates - refresh cached profile
                const unsubProfile = eventBus.on(EVENTS.PROFILE_UPDATED, ({ userId, changes }) => {
                    if (import.meta.env.DEV) console.log('[AppStore] Received PROFILE_UPDATED event for userId:', userId);
                    const { _authUserId, _authProfile } = get();
                    if (userId === _authUserId && _authProfile) {
                        set({ _authProfile: { ..._authProfile, ...changes } });
                        // Re-fetch users to update currentUser
                        get().fetchUsers();
                    }
                });
                eventCleanupFns.push(unsubProfile);

                if (import.meta.env.DEV) console.log('[AppStore] Event bus listeners initialized');
            },

            /**
             * Cleanup event bus listeners
             */
            cleanup: () => {
                eventCleanupFns.forEach(fn => fn());
                eventCleanupFns = [];
                clearCacheListeners();
                if (import.meta.env.DEV) console.log('[AppStore] Event bus listeners cleaned up');
            },

        }),
        {
            name: 'cat-judge-storage',
            storage: createJSONStorage(() => quotaSafeLocalStorage),
            partialize: (state) => ({
                // Keep persisted payload small. Large fields like base64 avatar_url
                // can easily exceed localStorage quota.
                currentUser: sanitizeProfileForStorage(state.currentUser),
                users: Array.isArray(state.users)
                    ? state.users.map(sanitizeProfileForStorage)
                    : [],
            }),
        }
    )
);

export default useAppStore;
