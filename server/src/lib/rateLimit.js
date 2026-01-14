/**
 * Express Rate Limiting Middleware
 *
 * Creates rate limiting middleware for Express routes.
 * Supports Redis for multi-instance deployments with in-memory fallback.
 */

const { getRedisClient } = require('./redis');

/**
 * Create a rate limiter middleware
 * @param {Object} options - Rate limiter options
 * @param {number} options.windowMs - Window duration in milliseconds
 * @param {number} options.max - Maximum requests per window
 * @param {Function} [options.keyGenerator] - Function to generate unique key from request
 * @returns {Function} Express middleware function
 */
function createRateLimiter({ windowMs, max, keyGenerator }) {
    if (!Number.isFinite(windowMs) || windowMs <= 0) throw new Error('windowMs must be > 0');
    if (!Number.isFinite(max) || max <= 0) throw new Error('max must be > 0');

    // In-memory fallback store
    const memoryHits = new Map(); // key -> { count, resetAt }

    const getKey = keyGenerator || ((req) => req.ip || 'unknown');

    // Cleanup interval for memory store (every 5 minutes)
    const cleanupInterval = setInterval(() => {
        const now = Date.now();
        for (const [key, data] of memoryHits.entries()) {
            if (now >= data.resetAt) {
                memoryHits.delete(key);
            }
        }
    }, 5 * 60 * 1000);

    // Prevent memory leak if middleware is recreated
    cleanupInterval.unref();

    /**
     * In-memory rate limiting (fallback)
     */
    function checkMemoryRateLimit(key) {
        const now = Date.now();
        const current = memoryHits.get(key);

        if (!current || now >= current.resetAt) {
            memoryHits.set(key, { count: 1, resetAt: now + windowMs });
            return {
                allowed: true,
                count: 1,
                remaining: max - 1,
                resetAt: now + windowMs,
            };
        }

        current.count += 1;

        if (current.count > max) {
            return {
                allowed: false,
                count: current.count,
                remaining: 0,
                resetAt: current.resetAt,
            };
        }

        return {
            allowed: true,
            count: current.count,
            remaining: max - current.count,
            resetAt: current.resetAt,
        };
    }

    /**
     * Redis-backed rate limiting using sliding window
     */
    async function checkRedisRateLimit(redis, key) {
        const now = Date.now();
        const windowStart = now - windowMs;
        const redisKey = `express:ratelimit:${key}`;

        try {
            // Remove entries outside the window
            await redis.zremrangebyscore(redisKey, '-inf', windowStart);

            // Get count of requests in current window
            const count = await redis.zcard(redisKey);

            if (count >= max) {
                // Get oldest entry to calculate reset time
                const oldest = await redis.zrange(redisKey, 0, 0, 'WITHSCORES');
                const resetAt = oldest.length >= 2 ? Number(oldest[1]) + windowMs : now + windowMs;

                return {
                    allowed: false,
                    count: count,
                    remaining: 0,
                    resetAt,
                };
            }

            // Add current request with unique member
            const member = `${now}-${Math.random().toString(36).substring(7)}`;
            await redis.zadd(redisKey, now, member);

            // Set TTL to auto-cleanup (window duration + buffer)
            await redis.expire(redisKey, Math.ceil(windowMs / 1000) + 60);

            return {
                allowed: true,
                count: count + 1,
                remaining: max - count - 1,
                resetAt: now + windowMs,
            };
        } catch (err) {
            console.error('[RateLimit Middleware] Redis error:', err);
            // Fall back to memory on Redis error
            return null;
        }
    }

    /**
     * Middleware function
     */
    return async function rateLimit(req, res, next) {
        const key = String(getKey(req) || 'unknown');
        const redis = getRedisClient();

        let result;

        if (redis) {
            result = await checkRedisRateLimit(redis, key);
        }

        // Fall back to memory if Redis is unavailable or errored
        if (!result) {
            result = checkMemoryRateLimit(key);
        }

        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', String(max));
        res.setHeader('X-RateLimit-Remaining', String(Math.max(0, result.remaining)));
        res.setHeader('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));

        if (!result.allowed) {
            res.status(429).json({ error: 'Too many requests' });
            return;
        }

        return next();
    };
}

module.exports = { createRateLimiter };
