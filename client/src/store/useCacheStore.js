import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';
import { quotaSafeSessionStorage } from './quotaSafeStorage';

const isOnline = () => typeof navigator !== 'undefined' && navigator.onLine;

/**
 * Memory limit constants for LRU eviction
 */
const CACHE_MEMORY_LIMITS = {
    MAX_ENTRIES: 100,           // Maximum number of cache entries
    MAX_ENTRY_SIZE_KB: 500,     // Maximum size per entry in KB (estimated)
    TARGET_ENTRIES_AFTER_EVICT: 80, // Target entry count after eviction
};

/**
 * Estimate size of a cache entry in bytes (rough approximation)
 * @param {any} data - Data to estimate size for
 * @returns {number} Estimated size in bytes
 */
const estimateSize = (data) => {
    try {
        const str = JSON.stringify(data);
        return str ? str.length * 2 : 0; // UTF-16 characters = 2 bytes each
    } catch {
        // Intentionally ignored: non-critical size estimation fallback
        return 1024; // Default estimate for non-serializable data
    }
};

/**
 * Cache TTL constants (in milliseconds)
 */
export const CACHE_TTL = {
    STREAK: 10 * 60 * 1000,         // 10 minutes
    DAILY_QUESTION: 2 * 60 * 1000,  // 2 minutes
    DAILY_HISTORY: 5 * 60 * 1000,   // 5 minutes
    CALENDAR_EVENTS: 10 * 60 * 1000, // 10 minutes
    CASE_HISTORY: 5 * 60 * 1000,    // 5 minutes
    APPRECIATIONS: 5 * 60 * 1000,   // 5 minutes
    EVENT_PLANS: 30 * 60 * 1000,    // 30 minutes
    STATS: 5 * 60 * 1000,           // 5 minutes - unified stats cache
    MEMORIES: 5 * 60 * 1000,        // 5 minutes
    INSIGHTS: 5 * 60 * 1000,        // 5 minutes
    CHALLENGES: 60 * 1000,          // 1 minute
    LEVEL: 2 * 60 * 1000,           // 2 minutes
};

/**
 * Stale thresholds for SWR-style revalidation (in milliseconds)
 */
export const CACHE_STALE = {
    STREAK: 60 * 1000,              // 1 minute
    DAILY_QUESTION: 20 * 1000,      // 20 seconds
    DAILY_HISTORY: 60 * 1000,       // 1 minute
    CALENDAR_EVENTS: 2 * 60 * 1000, // 2 minutes
    CASE_HISTORY: 2 * 60 * 1000,    // 2 minutes
    APPRECIATIONS: 60 * 1000,       // 1 minute
    EVENT_PLANS: 10 * 60 * 1000,    // 10 minutes
    STATS: 30 * 1000,               // 30 seconds
    MEMORIES: 60 * 1000,            // 1 minute
    INSIGHTS: 60 * 1000,            // 1 minute
    CHALLENGES: 20 * 1000,          // 20 seconds
    LEVEL: 30 * 1000,               // 30 seconds
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
    MEMORIES: 'memories',
    INSIGHTS: 'insights',
    CHALLENGES: 'challenges',
    LEVEL: 'levels',
};

/**
 * Cache policy per resource for SWR + revalidation tuning
 */
export const CACHE_POLICY = {
    STATS: { ttlMs: CACHE_TTL.STATS, staleMs: CACHE_STALE.STATS, revalidateOnInterval: true },
    DAILY_QUESTION: { ttlMs: CACHE_TTL.DAILY_QUESTION, staleMs: CACHE_STALE.DAILY_QUESTION, revalidateOnInterval: true },
    DAILY_HISTORY: { ttlMs: CACHE_TTL.DAILY_HISTORY, staleMs: CACHE_STALE.DAILY_HISTORY, revalidateOnInterval: true },
    CALENDAR_EVENTS: { ttlMs: CACHE_TTL.CALENDAR_EVENTS, staleMs: CACHE_STALE.CALENDAR_EVENTS, revalidateOnInterval: true },
    CASE_HISTORY: { ttlMs: CACHE_TTL.CASE_HISTORY, staleMs: CACHE_STALE.CASE_HISTORY, revalidateOnInterval: true },
    APPRECIATIONS: { ttlMs: CACHE_TTL.APPRECIATIONS, staleMs: CACHE_STALE.APPRECIATIONS, revalidateOnInterval: true },
    MEMORIES: { ttlMs: CACHE_TTL.MEMORIES, staleMs: CACHE_STALE.MEMORIES },
    INSIGHTS: { ttlMs: CACHE_TTL.INSIGHTS, staleMs: CACHE_STALE.INSIGHTS },
    CHALLENGES: { ttlMs: CACHE_TTL.CHALLENGES, staleMs: CACHE_STALE.CHALLENGES, revalidateOnInterval: true },
    LEVEL: { ttlMs: CACHE_TTL.LEVEL, staleMs: CACHE_STALE.LEVEL, revalidateOnInterval: true },
};

/**
 * Cache key builders for consistent read/write
 */
export const cacheKey = {
    stats: (userId) => `${CACHE_KEYS.STATS}:${userId}`,
    dailyQuestion: (userId, partnerId, language = 'en') => {
        const safeLanguage = language || 'en';
        return `${CACHE_KEYS.DAILY_QUESTION}:${userId}:${partnerId}:${safeLanguage}`;
    },
    dailyHistory: (userId, partnerId, language = 'en') => {
        const safeLanguage = language || 'en';
        return `${CACHE_KEYS.DAILY_HISTORY}:${userId}:${partnerId}:${safeLanguage}`;
    },
    calendarEvents: (userId, partnerId) =>
        `${CACHE_KEYS.CALENDAR_EVENTS}:${userId}:${partnerId || 'solo'}`,
    caseHistory: (userId, partnerId) =>
        `${CACHE_KEYS.CASE_HISTORY}:${userId}:${partnerId}`,
    appreciations: (userId) => `${CACHE_KEYS.APPRECIATIONS}:${userId}`,
    memories: (userId) => `${CACHE_KEYS.MEMORIES}:${userId}`,
    insights: (userId) => `${CACHE_KEYS.INSIGHTS}:${userId}`,
    challenges: (userId, partnerId) =>
        `${CACHE_KEYS.CHALLENGES}:${userId}:${partnerId || 'solo'}`,
    level: (userId, partnerId) => `${CACHE_KEYS.LEVEL}:${userId}:${partnerId || 'solo'}`,
};

const inflightRequests = new Map();
const fetchRegistry = new Map();
const keyListeners = new Map();
const ACTIVE_WINDOW_MS = 5 * 60 * 1000;
const CACHE_ACCESS_TOUCH_INTERVAL_MS = 15 * 1000;

const normalizeStaleMs = (ttlMs, staleMs) => {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) return 0;
    if (!Number.isFinite(staleMs) || staleMs <= 0) return ttlMs;
    return Math.min(staleMs, ttlMs);
};

const buildCacheEntry = (data, ttlMs, staleMs) => {
    const now = Date.now();
    const normalizedStale = normalizeStaleMs(ttlMs, staleMs);

    return {
        data,
        cachedAt: now,
        lastAccessedAt: now, // For LRU tracking
        staleAt: normalizedStale ? now + normalizedStale : null,
        expiresAt: now + ttlMs,
        sizeBytes: estimateSize(data), // Track estimated size
    };
};

const getEntryState = (entry) => {
    if (!entry) return null;
    const now = Date.now();
    return {
        ...entry,
        isExpired: now > entry.expiresAt,
        isStale: entry.staleAt ? now > entry.staleAt : false,
    };
};

const notifyKey = (key, data) => {
    const listeners = keyListeners.get(key);
    if (!listeners) return;
    listeners.forEach((callback) => {
        try {
            callback(data);
        } catch {
            // Intentionally ignored: best-effort listener notification
        }
    });
};

/**
 * useCacheStore - Lightweight caching layer for API responses
 *
 * Features:
 * - TTL-based expiration
 * - LRU eviction with memory limits
 * - Persisted to sessionStorage
 * - Prefix-based invalidation for related data
 */
const useCacheStore = create(
    persist(
        (set, get) => ({
            cache: {},

            /**
             * Get cached data if still valid (updates LRU timestamp)
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

                const now = Date.now();
                if (!entry.lastAccessedAt || now - entry.lastAccessedAt >= CACHE_ACCESS_TOUCH_INTERVAL_MS) {
                    // Throttle metadata writes to avoid serializing the full cache on every read.
                    set((state) => ({
                        cache: {
                            ...state.cache,
                            [key]: {
                                ...state.cache[key],
                                lastAccessedAt: now,
                            },
                        },
                    }));
                }

                return entry.data;
            },

            /**
             * Get cache entry with stale/expired flags
             * @param {string} key - Cache key
             * @returns {object|null}
             */
            getEntry: (key) => {
                const entry = get().cache[key];
                if (!entry) return null;
                return getEntryState(entry);
            },

            /**
             * Evict least recently used entries to stay within memory limits
             * @returns {number} Number of entries evicted
             */
            _evictLRU: () => {
                const cache = get().cache;
                const entries = Object.entries(cache);
                const entryCount = entries.length;

                // Check if eviction is needed
                if (entryCount < CACHE_MEMORY_LIMITS.MAX_ENTRIES) {
                    return 0;
                }

                // Sort by lastAccessedAt (oldest first) for LRU eviction
                const sortedEntries = entries.sort((a, b) => {
                    const aTime = a[1].lastAccessedAt || a[1].cachedAt || 0;
                    const bTime = b[1].lastAccessedAt || b[1].cachedAt || 0;
                    return aTime - bTime;
                });

                // Calculate how many to evict
                const evictCount = entryCount - CACHE_MEMORY_LIMITS.TARGET_ENTRIES_AFTER_EVICT;
                const keysToEvict = sortedEntries.slice(0, evictCount).map(([key]) => key);

                // Perform eviction
                set((state) => {
                    const newCache = { ...state.cache };
                    keysToEvict.forEach((key) => delete newCache[key]);
                    return { cache: newCache };
                });

                return keysToEvict.length;
            },

            /**
             * Store data with TTL (with LRU eviction)
             * @param {string} key - Cache key
             * @param {any} data - Data to cache
             * @param {number} ttlMs - Time to live in milliseconds
             * @param {number} staleMs - Stale threshold in milliseconds
             */
            setCache: (key, data, ttlMs, staleMs) => {
                const entry = buildCacheEntry(data, ttlMs, staleMs);

                // Check if entry is too large (skip caching very large entries)
                const maxSizeBytes = CACHE_MEMORY_LIMITS.MAX_ENTRY_SIZE_KB * 1024;
                if (entry.sizeBytes > maxSizeBytes) {
                    // Entry too large - skip caching but still notify listeners
                    notifyKey(key, data);
                    return;
                }

                // Evict LRU entries if needed before adding new entry
                get()._evictLRU();

                set((state) => ({
                    cache: {
                        ...state.cache,
                        [key]: entry,
                    }
                }));
                notifyKey(key, data);
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
             * Register fetch metadata for revalidation
             */
            registerFetch: (key, meta) => {
                const existing = fetchRegistry.get(key) || {};
                fetchRegistry.set(key, {
                    ...existing,
                    ...meta,
                    lastUsedAt: Date.now(),
                });
            },

            /**
             * Fetch and cache with in-flight dedupe
             */
            fetchAndCache: async (key, fetcher, options = {}) => {
                const { ttlMs, staleMs, revalidateOnFocus = true, revalidateOnInterval = false } = options;
                const resolvedTtl = Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : 60 * 1000;
                const resolvedStale = Number.isFinite(staleMs) ? staleMs : undefined;
                if (!isOnline()) {
                    const cached = get().getCached(key);
                    if (cached !== null) return cached;
                    throw new Error('Offline and no cached data available');
                }
                if (inflightRequests.has(key)) {
                    return inflightRequests.get(key);
                }

                get().registerFetch(key, {
                    fetcher,
                    ttlMs: resolvedTtl,
                    staleMs: resolvedStale,
                    revalidateOnFocus,
                    revalidateOnInterval,
                });

                const promise = (async () => {
                    const data = await fetcher();
                    get().setCache(key, data, resolvedTtl, resolvedStale);
                    return data;
                })();

                inflightRequests.set(key, promise);

                try {
                    return await promise;
                } finally {
                    inflightRequests.delete(key);
                }
            },

            /**
             * SWR-style fetch helper
             */
            getOrFetch: async ({
                key,
                fetcher,
                ttlMs,
                staleMs,
                allowStale = true,
                background = true,
                revalidateOnFocus = true,
                revalidateOnInterval = false,
            }) => {
                if (!key || typeof fetcher !== 'function') {
                    return { data: null, fromCache: false, isStale: false, promise: null };
                }

                // When offline, return cached data if available
                if (!isOnline()) {
                    const entry = get().getEntry(key);
                    if (entry?.data !== undefined) {
                        return { data: entry.data, fromCache: true, isStale: true, promise: null };
                    }
                    return { data: null, fromCache: false, isStale: false, promise: null };
                }

                get().registerFetch(key, {
                    fetcher,
                    ttlMs,
                    staleMs,
                    revalidateOnFocus,
                    revalidateOnInterval,
                });

                const entry = get().getEntry(key);
                if (entry && !entry.isExpired) {
                    if (!allowStale && entry.isStale) {
                        const data = await get().fetchAndCache(key, fetcher, { ttlMs, staleMs });
                        return { data, fromCache: false, isStale: false, promise: null };
                    }

                    const shouldRevalidate = allowStale && entry.isStale && background;
                    const promise = shouldRevalidate
                        ? get().revalidate(key, { onlyStale: false })
                        : null;
                    return { data: entry.data, fromCache: true, isStale: entry.isStale, promise };
                }

                try {
                    const data = await get().fetchAndCache(key, fetcher, { ttlMs, staleMs });
                    return { data, fromCache: false, isStale: false, promise: null };
                } catch (error) {
                    if (allowStale && entry?.data !== undefined) {
                        return { data: entry.data, fromCache: true, isStale: true, promise: null, error };
                    }
                    throw error;
                }
            },

            /**
             * Revalidate a single cache entry
             */
            revalidate: async (key, { onlyStale = true } = {}) => {
                const meta = fetchRegistry.get(key);
                if (!meta) return null;

                const entry = get().getEntry(key);
                if (!entry) {
                    if (onlyStale) return null;
                    return get().fetchAndCache(key, meta.fetcher, {
                        ttlMs: meta.ttlMs,
                        staleMs: meta.staleMs,
                        revalidateOnFocus: meta.revalidateOnFocus,
                        revalidateOnInterval: meta.revalidateOnInterval,
                    });
                }
                if (onlyStale && !entry.isStale) return null;

                return get().fetchAndCache(key, meta.fetcher, {
                    ttlMs: meta.ttlMs,
                    staleMs: meta.staleMs,
                    revalidateOnFocus: meta.revalidateOnFocus,
                    revalidateOnInterval: meta.revalidateOnInterval,
                });
            },

            /**
             * Revalidate active entries based on last usage
             */
            revalidateActive: async ({ onlyStale = true, windowMs = ACTIVE_WINDOW_MS, reason = 'focus' } = {}) => {
                const now = Date.now();
                const promises = [];

                for (const [key, meta] of fetchRegistry.entries()) {
                    if (windowMs && meta.lastUsedAt && now - meta.lastUsedAt > windowMs) {
                        continue;
                    }
                    if (reason === 'focus' && meta.revalidateOnFocus === false) {
                        continue;
                    }
                    if (reason === 'interval' && meta.revalidateOnInterval === false) {
                        continue;
                    }

                    const entry = get().getEntry(key);
                    if (!entry) continue;
                    if (onlyStale && !entry.isStale) continue;

                    const promise = get().revalidate(key, { onlyStale: false });
                    if (promise) promises.push(promise);
                }

                if (promises.length === 0) return [];
                return Promise.allSettled(promises);
            },

            /**
             * Clear registry entries (best-effort)
             */
            clearRegistry: () => {
                fetchRegistry.clear();
                inflightRequests.clear();
            },

            /**
             * Subscribe to cache updates for a specific key
             * @param {string} key
             * @param {Function} callback
             * @returns {Function} unsubscribe
             */
            subscribeKey: (key, callback) => {
                if (!key || typeof callback !== 'function') return () => {};
                const listeners = keyListeners.get(key) || new Set();
                listeners.add(callback);
                keyListeners.set(key, listeners);
                return () => {
                    const existing = keyListeners.get(key);
                    if (!existing) return;
                    existing.delete(callback);
                    if (existing.size === 0) {
                        keyListeners.delete(key);
                    }
                };
            },

            /**
             * Get cache statistics for debugging
             */
            getStats: () => {
                const cache = get().cache;
                const entries = Object.entries(cache);
                const now = Date.now();

                const totalSizeBytes = entries.reduce((sum, [, v]) => sum + (v.sizeBytes || 0), 0);

                return {
                    totalEntries: entries.length,
                    maxEntries: CACHE_MEMORY_LIMITS.MAX_ENTRIES,
                    validEntries: entries.filter(([, v]) => v.expiresAt > now).length,
                    expiredEntries: entries.filter(([, v]) => v.expiresAt <= now).length,
                    totalSizeKB: Math.round(totalSizeBytes / 1024),
                    maxEntrySizeKB: CACHE_MEMORY_LIMITS.MAX_ENTRY_SIZE_KB,
                    keys: Object.keys(cache),
                };
            },

            /**
             * Pre-fetch and cache all commonly needed data on app load
             * Runs in background - errors are silently ignored
             * @param {string} userId - Current user ID
             * @param {string} partnerId - Partner ID (optional)
             * @param {string} language - Current language code (optional)
             */
            warmCache: async (userId, partnerId, language = 'en') => {
                if (!userId) return;

                const { getOrFetch } = get();

                try {
                    const fetches = [
                        // Stats (always fetch - used in profile section)
                        getOrFetch({
                            key: cacheKey.stats(userId),
                            fetcher: async () => {
                                const res = await api.get('/stats');
                                return res.data;
                            },
                            ...CACHE_POLICY.STATS,
                            revalidateOnInterval: true,
                        }).catch(() => {}),
                    ];

                    // Partner-required data (most features need a partner)
                    if (partnerId) {
                        fetches.push(

                            getOrFetch({
                                key: cacheKey.dailyQuestion(userId, partnerId, language),
                                fetcher: async () => {
                                    const res = await api.get('/daily-questions/today', {
                                        params: { userId, partnerId },
                                    });
                                    return res.data;
                                },
                                ...CACHE_POLICY.DAILY_QUESTION,
                                revalidateOnInterval: true,
                            }).catch(() => {}),

                            getOrFetch({
                                key: cacheKey.calendarEvents(userId, partnerId),
                                fetcher: async () => {
                                    const res = await api.get('/calendar/events');
                                    const payload = res.data;
                                    if (Array.isArray(payload)) return payload;
                                    if (Array.isArray(payload?.data)) return payload.data;
                                    return [];
                                },
                                ...CACHE_POLICY.CALENDAR_EVENTS,
                            }).catch(() => {}),

                            getOrFetch({
                                key: cacheKey.caseHistory(userId, partnerId),
                                fetcher: async () => {
                                    const res = await api.get('/cases', {
                                        params: { userAId: userId, userBId: partnerId },
                                    });
                                    return res.data || [];
                                },
                                ...CACHE_POLICY.CASE_HISTORY,
                            }).catch(() => {}),

                            getOrFetch({
                                key: cacheKey.appreciations(userId),
                                fetcher: async () => {
                                    const res = await api.get(`/appreciations/${userId}`);
                                    const payload = res.data;
                                    if (Array.isArray(payload)) return payload;
                                    if (Array.isArray(payload?.data)) return payload.data;
                                    return [];
                                },
                                ...CACHE_POLICY.APPRECIATIONS,
                            }).catch(() => {})
                        );
                    }

                    await Promise.allSettled(fetches);
                } catch {
                    // Intentionally ignored: cache warming is best-effort and non-critical
                }
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
