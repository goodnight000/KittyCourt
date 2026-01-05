import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { quotaSafeSessionStorage } from './quotaSafeStorage';

/**
 * Cache TTL constants (in milliseconds)
 */
export const CACHE_TTL = {
    STREAK: 10 * 60 * 1000,         // 10 minutes
    DAILY_HISTORY: 5 * 60 * 1000,   // 5 minutes
    CALENDAR_EVENTS: 10 * 60 * 1000, // 10 minutes
    CASE_HISTORY: 5 * 60 * 1000,    // 5 minutes
    APPRECIATIONS: 5 * 60 * 1000,   // 5 minutes
    EVENT_PLANS: 30 * 60 * 1000,    // 30 minutes
    STATS: 5 * 60 * 1000,           // 5 minutes - unified stats cache
};

/**
 * Cache key prefixes for consistent invalidation
 */
export const CACHE_KEYS = {
    STREAK: 'streak',
    DAILY_HISTORY: 'daily-history',
    DAILY_QUESTION: 'daily-question',
    CALENDAR_EVENTS: 'calendar:events',
    CASE_HISTORY: 'cases',
    APPRECIATIONS: 'appreciations',
    EVENT_PLANS: 'calendar:plans-exist',
    STATS: 'user-stats',            // unified stats from user_stats table
};

/**
 * useCacheStore - Lightweight caching layer for API responses
 * 
 * Features:
 * - TTL-based expiration
 * - Persisted to localStorage
 * - Prefix-based invalidation for related data
 */
const useCacheStore = create(
    persist(
        (set, get) => ({
            cache: {},

            /**
             * Get cached data if still valid
             * @param {string} key - Cache key
             * @returns {any|null} - Cached data or null if expired/missing
             */
            getCached: (key) => {
                const entry = get().cache[key];
                if (!entry) return null;

                if (Date.now() > entry.expiresAt) {
                    // Expired - clean up asynchronously
                    get().invalidate(key);
                    return null;
                }

                return entry.data;
            },

            /**
             * Store data with TTL
             * @param {string} key - Cache key
             * @param {any} data - Data to cache
             * @param {number} ttlMs - Time to live in milliseconds
             */
            setCache: (key, data, ttlMs) => {
                set((state) => ({
                    cache: {
                        ...state.cache,
                        [key]: {
                            data,
                            cachedAt: Date.now(),
                            expiresAt: Date.now() + ttlMs,
                        }
                    }
                }));
            },

            /**
             * Invalidate a specific cache entry
             * @param {string} key - Cache key to invalidate
             */
            invalidate: (key) => {
                set((state) => {
                    const newCache = { ...state.cache };
                    delete newCache[key];
                    return { cache: newCache };
                });
            },

            /**
             * Invalidate all cache entries matching a prefix
             * Useful for invalidating related data (e.g., 'calendar:*')
             * @param {string} prefix - Prefix to match
             */
            invalidatePrefix: (prefix) => {
                set((state) => ({
                    cache: Object.fromEntries(
                        Object.entries(state.cache).filter(([k]) => !k.startsWith(prefix))
                    )
                }));
            },

            /**
             * Clear all cached data
             */
            clearAll: () => set({ cache: {} }),

            /**
             * Get cache statistics for debugging
             */
            getStats: () => {
                const cache = get().cache;
                const entries = Object.entries(cache);
                const now = Date.now();

                return {
                    totalEntries: entries.length,
                    validEntries: entries.filter(([, v]) => v.expiresAt > now).length,
                    expiredEntries: entries.filter(([, v]) => v.expiresAt <= now).length,
                    keys: Object.keys(cache),
                };
            },
        }),
        {
            name: 'pause-cache',
            // Cache can get large (case history/appreciations). Keep it out of localStorage.
            storage: quotaSafeSessionStorage,
            partialize: (state) => ({ cache: state.cache }),
        }
    )
);

export default useCacheStore;
