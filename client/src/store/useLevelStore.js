/**
 * Level Store - Zustand store for couple level/XP state
 * 
 * Uses API data when enabled; falls back to defaults when disabled.
 */
import { create } from 'zustand';
import api from '../services/api';
import useCacheStore, { CACHE_POLICY, cacheKey } from './useCacheStore';
import { eventBus, EVENTS } from '../lib/eventBus';

let cacheListenerKey = null;
let cacheUnsubscribe = null;
let eventCleanupFns = [];

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
    { level: 50, xpRequired: 100000, title: 'Cat Royalty' },
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
    lastSeenLevel: null,
    pendingLevelUps: [],
    serverAvailable: true,
    error: null,
    _authUserId: null,
    _authPartnerId: null,

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
        // Note: Also requires Pause Gold, checked separately
        return level >= 10;
    },

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
    fetchLevel: async ({ force = false } = {}) => {
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
                lastSeenLevel: null,
                pendingLevelUps: [],
                serverAvailable: true,
                error: null,
            });
            return;
        }

        set({ isLoading: true, error: null });

        try {
            const cacheStore = useCacheStore.getState();
            const userId = get()._authUserId;
            const partnerId = get()._authPartnerId || null;

            const applyPayload = (payload) => {
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
                        lastSeenLevel: null,
                        pendingLevelUps: [],
                        serverAvailable: true,
                        error: null,
                    });
                    return;
                }

                const lastSeenLevel = Number.isFinite(payload.lastSeenLevel)
                    ? payload.lastSeenLevel
                    : payload.level;
                const queuedLevels = getLevelUpsToQueue(lastSeenLevel, payload.level);

                set((state) => ({
                    ...payload,
                    questionsAnswered: payload.questionsAnswered || 0,
                    isLoading: false,
                    lastFetched: new Date().toISOString(),
                    lastSeenLevel,
                    pendingLevelUps: mergeLevelUps(state.pendingLevelUps, queuedLevels),
                    serverAvailable: true,
                    error: null,
                }));
            };

            if (userId) {
                const key = cacheKey.level(userId, partnerId);
                if (cacheListenerKey !== key) {
                    if (cacheUnsubscribe) cacheUnsubscribe();
                    cacheUnsubscribe = cacheStore.subscribeKey(key, (payload) => {
                        applyPayload(payload || {});
                    });
                    cacheListenerKey = key;
                }
                if (force) {
                    const fresh = await cacheStore.fetchAndCache(key, async () => {
                        const response = await api.get('/levels/status');
                        return response?.data || {};
                    }, CACHE_POLICY.LEVEL);
                    applyPayload(fresh);
                    return;
                }

                const { data, promise } = await cacheStore.getOrFetch({
                    key,
                    fetcher: async () => {
                        const response = await api.get('/levels/status');
                        return response?.data || {};
                    },
                    ...CACHE_POLICY.LEVEL,
                    revalidateOnInterval: true,
                });

                applyPayload(data || {});

                if (promise) {
                    promise.then((fresh) => applyPayload(fresh || {})).catch(() => {});
                }
                return;
            }

            const response = await api.get('/levels/status');
            applyPayload(response?.data || {});
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
                    lastSeenLevel: null,
                    pendingLevelUps: [],
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
        if (cacheUnsubscribe) cacheUnsubscribe();
        cacheUnsubscribe = null;
        cacheListenerKey = null;
        set({
            level: 1,
            totalXP: 0,
            currentXP: 0,
            xpForNextLevel: 100,
            title: 'Curious Kittens',
            questionsAnswered: 0,
            isLoading: false,
            lastFetched: null,
            lastSeenLevel: null,
            pendingLevelUps: [],
            serverAvailable: true,
            error: null,
            _authUserId: null,
            _authPartnerId: null,
        });
    },

    acknowledgeLevelUp: async (level) => {
        const safeLevel = Number(level);
        if (!Number.isFinite(safeLevel)) return;

        set((state) => ({
            pendingLevelUps: state.pendingLevelUps.filter((item) => item.level !== safeLevel),
            lastSeenLevel: Math.max(state.lastSeenLevel || 0, safeLevel),
        }));

        try {
            await api.post('/levels/seen', { level: safeLevel });
        } catch (error) {
            console.error('[LevelStore] Failed to acknowledge level:', error);
        }
    },
}));

export default useLevelStore;
export { LEVEL_CONFIG, getLevelFromXP };

function getLevelUpsToQueue(lastSeenLevel, currentLevel) {
    if (!Number.isFinite(lastSeenLevel) || !Number.isFinite(currentLevel)) return [];

    return LEVEL_CONFIG.filter((entry) => entry.level > lastSeenLevel && entry.level <= currentLevel)
        .map((entry) => ({ level: entry.level, title: entry.title }));
}

function mergeLevelUps(existing, incoming) {
    if (!incoming?.length) return existing || [];

    const seen = new Set((existing || []).map((item) => item.level));
    const merged = [...(existing || [])];

    for (const item of incoming) {
        if (!seen.has(item.level)) {
            seen.add(item.level);
            merged.push(item);
        }
    }

    return merged.sort((a, b) => a.level - b.level);
}
