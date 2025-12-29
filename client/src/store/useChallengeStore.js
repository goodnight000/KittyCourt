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
    available: [],
    completed: [],
    isLoading: false,
    error: null,
    lastFetched: null,

    // Computed
    hasActiveChallenges: () => get().active.length > 0,
    hasChallenges: () => get().active.length > 0 || get().available.length > 0,

    // Actions
    fetchChallenges: async () => {
        if (!isXPSystemEnabled()) {
            set({ active: [], available: [], completed: [], isLoading: false });
            return;
        }

        // Prevent duplicate fetches
        if (get().isLoading) return;

        set({ isLoading: true, error: null });

        try {
    const response = await api.get('/challenges');
            const data = response?.data || {};

            set({
                active: data.active || [],
                available: data.available || [],
                completed: data.completed || [],
                isLoading: false,
                lastFetched: new Date().toISOString(),
                error: null,
            });
        } catch (error) {
            console.error('[ChallengeStore] Failed to fetch challenges:', error);
            set({
                isLoading: false,
                error: error.message || 'Failed to load challenges',
            });
        }
    },

    // Skip challenge with optimistic UI
    skipChallenge: async (challengeId) => {
        const { active, available } = get();
        const { fetchChallenges } = get();

        // Optimistic: remove from lists immediately
        const originalActive = [...active];
        const originalAvailable = [...available];

        set({
            active: active.filter(c => c.id !== challengeId),
            available: available.filter(c => c.id !== challengeId),
        });

        try {
            await api.post(`/challenges/${challengeId}/skip`);
            fetchChallenges();
        } catch (error) {
            console.error('[ChallengeStore] Failed to skip challenge:', error);
            // Revert optimistic update
            set({
                active: originalActive,
                available: originalAvailable,
                error: 'Failed to skip challenge. Please try again.',
            });
        }
    },

    // Start a challenge (move available → active)
    startChallenge: async (challengeId) => {
        const { available, active } = get();
        const { fetchChallenges } = get();
        const challenge = available.find(c => c.id === challengeId);

        if (!challenge) return;

        // Optimistic: move to active
        const originalAvailable = [...available];
        const originalActive = [...active];

        set({
            available: available.filter(c => c.id !== challengeId),
            active: [...active, { ...challenge, status: 'active' }],
        });

        try {
            await api.post(`/challenges/${challengeId}/start`);
            fetchChallenges();
        } catch (error) {
            console.error('[ChallengeStore] Failed to start challenge:', error);
            // Revert
            set({
                available: originalAvailable,
                active: originalActive,
                error: 'Failed to start challenge. Please try again.',
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
            set({ error: 'Failed to complete challenge. Please try again.' });
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
            set({ error: 'Failed to confirm challenge. Please try again.' });
        }
    },

    // Clear error
    clearError: () => set({ error: null }),

    // Reset store
    reset: () => set({
        active: [],
        available: [],
        completed: [],
        isLoading: false,
        error: null,
        lastFetched: null,
    }),
}));

export default useChallengeStore;
