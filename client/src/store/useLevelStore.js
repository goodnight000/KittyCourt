/**
 * Level Store - Zustand store for couple level/XP state
 * 
 * Uses API data when enabled; falls back to defaults when disabled.
 */
import { create } from 'zustand';
import api from '../services/api';

// Level titles and XP thresholds (from implementation plan)
const LEVEL_CONFIG = [
    { level: 1, xpRequired: 0, title: 'Curious Kittens' },
    { level: 2, xpRequired: 100, title: 'Playful Paws' },
    { level: 3, xpRequired: 250, title: 'Snuggle Buddies' },
    { level: 5, xpRequired: 700, title: 'Cozy Companions' },
    { level: 7, xpRequired: 1200, title: 'Cuddle Champions' },
    { level: 10, xpRequired: 3000, title: 'Purr-fect Partners' },
    { level: 15, xpRequired: 7500, title: 'Soulmates' },
    { level: 20, xpRequired: 15000, title: 'Legendary Bond' },
    { level: 30, xpRequired: 35000, title: 'Eternal Flame' },
    { level: 50, xpRequired: 100000, title: 'Cat Royalty 👑' },
];

// Helper: Get level info from total XP
function getLevelFromXP(totalXP) {
    let currentLevel = LEVEL_CONFIG[0];
    let nextLevel = LEVEL_CONFIG[1];

    for (let i = 0; i < LEVEL_CONFIG.length; i++) {
        if (totalXP >= LEVEL_CONFIG[i].xpRequired) {
            currentLevel = LEVEL_CONFIG[i];
            nextLevel = LEVEL_CONFIG[i + 1] || null;
        }
    }

    return {
        level: currentLevel.level,
        title: currentLevel.title,
        currentXP: totalXP - currentLevel.xpRequired,
        xpForNextLevel: nextLevel
            ? nextLevel.xpRequired - currentLevel.xpRequired
            : 0, // Max level
        totalXP,
    };
}

// Feature flag check
const isXPSystemEnabled = () => import.meta.env.VITE_XP_SYSTEM_ENABLED === 'true';

const useLevelStore = create((set, get) => ({
    // State (matches API shape)
    level: 1,
    totalXP: 0,
    currentXP: 0,
    xpForNextLevel: 100,
    title: 'Curious Kittens',
    questionsAnswered: 0,
    isLoading: false,
    lastFetched: null,
    serverAvailable: true,
    error: null,

    // Progressive disclosure check
    shouldShowLevelBanner: () => {
        if (!isXPSystemEnabled()) return false;
        const { questionsAnswered, serverAvailable } = get();
        if (!serverAvailable) return false;
        return questionsAnswered >= 3;
    },

    shouldShowChallenges: () => {
        if (!isXPSystemEnabled()) return false;
        const { level, serverAvailable } = get();
        if (!serverAvailable) return false;
        return level >= 5;
    },

    shouldShowInsights: () => {
        if (!isXPSystemEnabled()) return false;
        const { level, serverAvailable } = get();
        if (!serverAvailable) return false;
        // Note: Also requires AI consent, checked separately
        return level >= 10;
    },

    // Actions
    fetchLevel: async () => {
        const { isLoading, serverAvailable } = get();
        if (isLoading || !serverAvailable) return;
        // Feature flag check - if disabled, use mock data
        if (!isXPSystemEnabled()) {
            set({
                level: 1,
                totalXP: 0,
                currentXP: 0,
                xpForNextLevel: 100,
                title: 'Curious Kittens',
                questionsAnswered: 0,
                isLoading: false,
                lastFetched: null,
                serverAvailable: true,
                error: null,
            });
            return;
        }

        set({ isLoading: true, error: null });

        try {
            const response = await api.get('/levels/status');
            const payload = response?.data || {};

            if (payload?.enabled === false || !payload?.level) {
            set({
                level: 1,
                totalXP: 0,
                    currentXP: 0,
                    xpForNextLevel: 100,
                    title: 'Curious Kittens',
                    questionsAnswered: 0,
                isLoading: false,
                lastFetched: new Date().toISOString(),
                serverAvailable: true,
                error: null,
            });
            return;
        }

            set({
                ...payload,
                questionsAnswered: payload.questionsAnswered || 0,
                isLoading: false,
                lastFetched: new Date().toISOString(),
                serverAvailable: true,
                error: null,
            });
        } catch (error) {
            const status = error?.response?.status;
            if (status === 404) {
                set({
                    level: 1,
                    totalXP: 0,
                    currentXP: 0,
                    xpForNextLevel: 100,
                    title: 'Curious Kittens',
                    questionsAnswered: 0,
                    isLoading: false,
                    lastFetched: new Date().toISOString(),
                    serverAvailable: false,
                    error: null,
                });
                return;
            }

            console.error('[LevelStore] Failed to fetch level:', error);
            set({
                isLoading: false,
                serverAvailable: true,
                error: error.message,
            });
        }
    },

    // For testing progressive disclosure
    setMockQuestionsAnswered: (count) => {
        set({ questionsAnswered: count });
    },

    // For testing different levels
    setMockLevel: (totalXP) => {
        const levelInfo = getLevelFromXP(totalXP);
        set({
            ...levelInfo,
            questionsAnswered: Math.floor(totalXP / 50), // Rough estimate
        });
    },

    // Reset to initial state
    reset: () => {
        set({
            level: 1,
            totalXP: 0,
            currentXP: 0,
            xpForNextLevel: 100,
            title: 'Curious Kittens',
            questionsAnswered: 0,
            isLoading: false,
            lastFetched: null,
            serverAvailable: true,
            error: null,
        });
    },
}));

export default useLevelStore;
export { LEVEL_CONFIG, getLevelFromXP };
