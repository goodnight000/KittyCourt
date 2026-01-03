/**
 * Challenge Store - Zustand store for challenges state
 * 
 * Phase 2B: Client wiring for /api/challenges
 * Includes optimistic UI for skip action.
 */
import { create } from 'zustand';
import api from '../services/api';

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

    // Computed
    hasActiveChallenges: () => get().active.length > 0,
    hasChallenges: () => get().active.length > 0,

        // Actions
    fetchChallenges: async () => {
        if (!isXPSystemEnabled()) {
            set({ active: [], completed: [], isLoading: false, error: null, errorCode: null });
            return;
        }

        // Prevent duplicate fetches
        if (get().isLoading) return;

        set({ isLoading: true, error: null, errorCode: null });

        try {
            const response = await api.get('/challenges');
            const data = response?.data || {};

            set({
                active: data.active || [],
                completed: data.completed || [],
                isLoading: false,
                lastFetched: new Date().toISOString(),
                error: null,
                errorCode: null,
            });
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
            fetchChallenges();
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
            fetchChallenges();
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
            fetchChallenges();
        } catch (error) {
            console.error('[ChallengeStore] Failed to confirm challenge:', error);
            set({ error: 'Failed to confirm challenge. Please try again.', errorCode: 'CONFIRM_FAILED' });
        }
    },

    // Clear error
    clearError: () => set({ error: null, errorCode: null }),

    // Reset store
    reset: () => set({
        active: [],
        completed: [],
        isLoading: false,
        error: null,
        errorCode: null,
        lastFetched: null,
    }),
}));

export default useChallengeStore;
