import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';
import useCacheStore, { CACHE_TTL, CACHE_KEYS } from './useCacheStore';

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
 */
const useAppStore = create(
    persist(
        (set, get) => ({
            // --- User State ---
            currentUser: null,
            users: [],
            isLoading: false,
            error: null,

            // --- Actions ---
            fetchUsers: async () => {
                set({ isLoading: true });
                try {
                    // Get real auth user and partner from auth store
                    const { user: authUser, profile: authProfile, partner: connectedPartner } = await import('./useAuthStore').then(m => m.default.getState());

                    if (!authUser || !authProfile) {
                        set({ users: [], currentUser: null, isLoading: false });
                        return;
                    }

                    // Build users array from auth store data (not from legacy /users endpoint)
                    const users = [authProfile];
                    if (connectedPartner) {
                        users.push(connectedPartner);
                    }

                    // Fetch kibble balances for each user
                    for (const user of users) {
                        try {
                            const balanceRes = await api.get(`/economy/balance/${user.id}`);
                            user.kibbleBalance = balanceRes.data.balance || 0;
                        } catch {
                            user.kibbleBalance = 0;
                        }
                    }

                    // Current user is the auth profile with balance
                    const currentUser = users.find(u => u.id === authUser.id) || authProfile;

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
                try {
                    // Get auth user and partner to filter cases for this couple
                    const { user: authUser, partner: connectedPartner } = await import('./useAuthStore').then(m => m.default.getState());
                    if (!authUser?.id || !connectedPartner?.id) return;

                    const cacheKey = `${CACHE_KEYS.CASE_HISTORY}:${authUser.id}:${connectedPartner.id}`;

                    // Check cache first
                    const cached = useCacheStore.getState().getCached(cacheKey);
                    if (cached !== null) {
                        set({ caseHistory: cached });
                        return;
                    }

                    // Build query params for filtering
                    const params = new URLSearchParams();
                    if (authUser?.id) params.set('userAId', authUser.id);
                    if (connectedPartner?.id) params.set('userBId', connectedPartner.id);

                    const url = params.toString() ? `/cases?${params.toString()}` : '/cases';
                    const response = await api.get(url);
                    const data = response.data || [];

                    // Cache the result
                    useCacheStore.getState().setCache(cacheKey, data, CACHE_TTL.CASE_HISTORY);
                    set({ caseHistory: data });
                } catch (error) {
                    console.error("Failed to fetch case history", error);
                }
            },

            // Load a specific case from history (for viewing/adding addendums)
            loadCase: (caseItem) => {
                const verdict = typeof caseItem.verdict === 'string'
                    ? JSON.parse(caseItem.verdict)
                    : caseItem.verdict;

                // This updates courtStore's session for viewing
                import('./courtStore').then(m => {
                    m.default.setState({
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
                });
            },

            // --- Appreciation State ---
            appreciations: [], // Appreciations received by current user from partner

            // Fetch appreciations that the current user received
            fetchAppreciations: async () => {
                // Get auth user from auth store
                const { user: authUser } = await import('./useAuthStore').then(m => m.default.getState());
                if (!authUser?.id) return;

                const cacheKey = `${CACHE_KEYS.APPRECIATIONS}:${authUser.id}`;

                // Check cache first
                const cached = useCacheStore.getState().getCached(cacheKey);
                if (cached !== null) {
                    set({ appreciations: cached });
                    return;
                }

                try {
                    const response = await api.get(`/appreciations/${authUser.id}`);
                    const data = response.data || [];

                    // Cache the result
                    useCacheStore.getState().setCache(cacheKey, data, CACHE_TTL.APPRECIATIONS);
                    set({ appreciations: data });
                } catch (error) {
                    console.error("Failed to fetch appreciations", error);
                }
            },

            // --- Economy Actions ---
            // When you show appreciation, you're logging something your PARTNER did
            // So the kibble goes to your partner and it's logged as an appreciation
            logGoodDeed: async (description) => {
                // Get auth user and partner from auth store
                const { user: authUser, partner: connectedPartner } = await import('./useAuthStore').then(m => m.default.getState());
                if (!authUser?.id || !connectedPartner?.id) return;

                try {
                    // Log appreciation (partner receives it)
                    // Note: Backend automatically awards kibble, so no separate transaction needed
                    await api.post('/appreciations', {
                        toUserId: connectedPartner.id,
                        message: description
                    });

                    // Invalidate partner's appreciations cache (they received a new one)
                    useCacheStore.getState().invalidate(`${CACHE_KEYS.APPRECIATIONS}:${connectedPartner.id}`);

                    // Refresh users and appreciations
                    get().fetchUsers();
                    get().fetchAppreciations();
                } catch (error) {
                    console.error("Failed to log good deed", error);
                }
            },

            redeemCoupon: async (coupon) => {
                // Get auth user from auth store
                const { user: authUser } = await import('./useAuthStore').then(m => m.default.getState());
                if (!authUser?.id) return;

                try {
                    // Check if user has enough kibble
                    const currentUser = get().currentUser;
                    if (!currentUser || currentUser.kibbleBalance < coupon.cost) {
                        throw new Error('Not enough kibble!');
                    }

                    // Deduct kibble (the transaction description serves as the redemption log)
                    await api.post('/economy/transaction', {
                        userId: authUser.id,
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

        }),
        {
            name: 'cat-judge-storage',
            partialize: (state) => ({
                currentUser: state.currentUser,
                users: state.users,
            }),
        }
    )
);

export default useAppStore;
