/**
 * Rate Limiting and Abuse Detection
 *
 * Provides per-user, per-endpoint rate limiting and tracks
 * abuse patterns for automatic blocking.
 *
 * Supports Redis for multi-instance deployments with in-memory fallback.
 */

const { securityConfig } = require('./config/securityConfig');
const { auditLogger } = require('./auditLogger');
const { getRedisClient } = require('../redis');

// In-memory stores (fallback for single-instance deployments without Redis)
const memoryRateLimitStore = new Map();
const memoryAbuseStore = new Map();
const memoryBlocklistStore = new Map();

// Clean up old entries periodically (for in-memory fallback)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

setInterval(() => {
  const now = Date.now();

  // Clean rate limit store
  for (const [key, record] of memoryRateLimitStore.entries()) {
    const maxWindowMs = Math.max(...Object.values(securityConfig.rateLimits).map(r => r.windowMs));
    if (record.lastActivity && now - record.lastActivity > maxWindowMs * 2) {
      memoryRateLimitStore.delete(key);
    }
  }

  // Clean abuse store (keep for 24 hours after last activity)
  for (const [key, record] of memoryAbuseStore.entries()) {
    if (record.lastActivity && now - record.lastActivity > 24 * 60 * 60 * 1000) {
      memoryAbuseStore.delete(key);
    }
  }

  // Clean expired blocks
  for (const [userId, block] of memoryBlocklistStore.entries()) {
    if (now > block.expiresAt) {
      memoryBlocklistStore.delete(userId);
    }
  }
}, CLEANUP_INTERVAL_MS);

/**
 * Get rate limit key for a user and endpoint
 * @param {string} userId - User ID
 * @param {string} endpoint - Endpoint name
 * @returns {string} - Rate limit key
 */
function getRateLimitKey(userId, endpoint) {
  return `ratelimit:${endpoint}:${userId}`;
}

/**
 * Check rate limit using in-memory store (fallback)
 * @param {string} userId - User ID
 * @param {string} endpoint - Endpoint name
 * @param {Object} config - Rate limit config
 * @returns {Object} - Rate limit status
 */
function checkInMemoryRateLimit(userId, endpoint, config) {
  const key = getRateLimitKey(userId, endpoint);
  const now = Date.now();
  const windowStart = now - config.windowMs;

  // Get existing record or create new
  let record = memoryRateLimitStore.get(key);
  if (!record) {
    record = { requests: [], lastActivity: now };
  }

  // Filter requests within current window
  record.requests = record.requests.filter(ts => ts > windowStart);
  record.lastActivity = now;

  // Check if limit exceeded
  if (record.requests.length >= config.requests) {
    const oldestRequest = record.requests[0];
    const resetAt = oldestRequest + config.windowMs;
    const retryAfterMs = resetAt - now;

    return {
      allowed: false,
      limited: true,
      remaining: 0,
      resetAt,
      retryAfter: Math.ceil(retryAfterMs / 1000),
      retryAfterMs,
    };
  }

  // Add current request
  record.requests.push(now);
  memoryRateLimitStore.set(key, record);

  return {
    allowed: true,
    limited: false,
    remaining: config.requests - record.requests.length,
    resetAt: now + config.windowMs,
    total: config.requests,
  };
}

/**
 * Check rate limit for a user on an endpoint (async, Redis-backed)
 * @param {string} userId - User ID
 * @param {string} endpoint - Endpoint name (e.g., 'judgeEngine', 'eventPlanner')
 * @returns {Promise<Object>} - Rate limit status
 */
async function checkRateLimit(userId, endpoint) {
  const config = securityConfig.rateLimits[endpoint];
  if (!config) {
    // No rate limit configured for this endpoint
    return { allowed: true, remaining: Infinity, limited: false };
  }

  const redis = getRedisClient();

  // If no Redis, use in-memory fallback
  if (!redis) {
    const result = checkInMemoryRateLimit(userId, endpoint, config);
    if (!result.allowed) {
      auditLogger.logRateLimitExceeded(userId, endpoint, {
        limit: config.requests,
        windowMs: config.windowMs,
        currentCount: config.requests,
      });
    }
    return result;
  }

  const key = getRateLimitKey(userId, endpoint);
  const now = Date.now();
  const windowStart = now - config.windowMs;

  try {
    // Use Redis sorted set with timestamps for sliding window
    // Remove entries outside the window
    await redis.zremrangebyscore(key, '-inf', windowStart);

    // Get count of requests in current window
    const count = await redis.zcard(key);

    if (count >= config.requests) {
      // Get oldest entry to calculate reset time
      const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
      const resetAt = oldest.length >= 2 ? Number(oldest[1]) + config.windowMs : now + config.windowMs;
      const retryAfterMs = resetAt - now;

      auditLogger.logRateLimitExceeded(userId, endpoint, {
        limit: config.requests,
        windowMs: config.windowMs,
        currentCount: count,
      });

      return {
        allowed: false,
        limited: true,
        remaining: 0,
        resetAt,
        retryAfter: Math.ceil(retryAfterMs / 1000),
        retryAfterMs,
      };
    }

    // Add current request with unique member (timestamp + random suffix)
    const member = `${now}-${Math.random().toString(36).substring(7)}`;
    await redis.zadd(key, now, member);

    // Set TTL to auto-cleanup (window duration + buffer)
    await redis.expire(key, Math.ceil(config.windowMs / 1000) + 60);

    return {
      allowed: true,
      limited: false,
      remaining: config.requests - count - 1,
      resetAt: now + config.windowMs,
      total: config.requests,
    };
  } catch (err) {
    console.error('[Rate Limit] Redis error, falling back to memory:', err);
    const result = checkInMemoryRateLimit(userId, endpoint, config);
    if (!result.allowed) {
      auditLogger.logRateLimitExceeded(userId, endpoint, {
        limit: config.requests,
        windowMs: config.windowMs,
        currentCount: config.requests,
      });
    }
    return result;
  }
}

/**
 * Track an abuse indicator for a user
 * @param {string} userId - User ID
 * @param {string} indicatorType - Type of abuse indicator
 * @param {Object} details - Additional details
 */
async function trackAbuseIndicator(userId, indicatorType, details = {}) {
  const redis = getRedisClient();
  const now = Date.now();

  if (!redis) {
    // In-memory fallback
    const key = `abuse:${userId}`;
    let record = memoryAbuseStore.get(key);

    if (!record) {
      record = {
        indicators: [],
        injectionAttempts: 0,
        flaggedRequests: 0,
        lastActivity: now,
      };
    }

    // Add indicator
    record.indicators.push({
      type: indicatorType,
      timestamp: now,
      details,
    });

    // Keep only last 100 indicators
    if (record.indicators.length > 100) {
      record.indicators = record.indicators.slice(-100);
    }

    // Update counters
    if (indicatorType === 'injection_attempt') {
      record.injectionAttempts++;
    } else if (indicatorType === 'flagged_request') {
      record.flaggedRequests++;
    }

    record.lastActivity = now;
    memoryAbuseStore.set(key, record);

    // Check if user should be blocked
    const { abuseThresholds } = securityConfig;
    if (record.injectionAttempts >= abuseThresholds.injectionAttemptsBeforeBlock) {
      await blockUser(userId, 'Excessive injection attempts detected', abuseThresholds.blockDurationMs);
    }

    // Log if threshold approached
    if (record.injectionAttempts >= abuseThresholds.suspiciousPatternsBeforeAlert) {
      auditLogger.logAbusePattern(userId, {
        injectionAttempts: record.injectionAttempts,
        flaggedRequests: record.flaggedRequests,
        recentIndicators: record.indicators.slice(-5),
      });
    }
    return;
  }

  // Redis-backed abuse tracking
  const abuseKey = `abuse:${userId}`;
  const indicatorKey = `abuse:indicators:${userId}`;

  try {
    // Increment counters
    if (indicatorType === 'injection_attempt') {
      await redis.hincrby(abuseKey, 'injectionAttempts', 1);
    } else if (indicatorType === 'flagged_request') {
      await redis.hincrby(abuseKey, 'flaggedRequests', 1);
    }
    await redis.hset(abuseKey, 'lastActivity', now);

    // Set TTL for 24 hours
    await redis.expire(abuseKey, 24 * 60 * 60);

    // Store indicator in a list (keep last 100)
    const indicator = JSON.stringify({ type: indicatorType, timestamp: now, details });
    await redis.lpush(indicatorKey, indicator);
    await redis.ltrim(indicatorKey, 0, 99);
    await redis.expire(indicatorKey, 24 * 60 * 60);

    // Check if user should be blocked
    const injectionAttempts = parseInt(await redis.hget(abuseKey, 'injectionAttempts') || '0', 10);
    const flaggedRequests = parseInt(await redis.hget(abuseKey, 'flaggedRequests') || '0', 10);
    const { abuseThresholds } = securityConfig;

    if (injectionAttempts >= abuseThresholds.injectionAttemptsBeforeBlock) {
      await blockUser(userId, 'Excessive injection attempts detected', abuseThresholds.blockDurationMs);
    }

    // Log if threshold approached
    if (injectionAttempts >= abuseThresholds.suspiciousPatternsBeforeAlert) {
      const indicators = await redis.lrange(indicatorKey, 0, 4);
      auditLogger.logAbusePattern(userId, {
        injectionAttempts,
        flaggedRequests,
        recentIndicators: indicators.map(i => JSON.parse(i)),
      });
    }
  } catch (err) {
    console.error('[Rate Limit] Redis abuse tracking error:', err);
    // Fall through - don't fail the request
  }
}

/**
 * Block a user
 * @param {string} userId - User ID to block
 * @param {string} reason - Reason for block
 * @param {number} durationMs - Block duration in milliseconds
 */
async function blockUser(userId, reason, durationMs = securityConfig.abuseThresholds.blockDurationMs) {
  const redis = getRedisClient();
  const now = Date.now();
  const expiresAt = now + durationMs;

  if (!redis) {
    // In-memory fallback
    memoryBlocklistStore.set(userId, {
      reason,
      blockedAt: now,
      expiresAt,
    });
    auditLogger.logUserBlocked(userId, reason, durationMs);
    return;
  }

  try {
    const blockData = JSON.stringify({
      reason,
      blockedAt: now,
      expiresAt,
    });

    // Set with TTL in milliseconds (PX option)
    await redis.set(`blocklist:${userId}`, blockData, 'PX', durationMs);
    auditLogger.logUserBlocked(userId, reason, durationMs);
  } catch (err) {
    console.error('[Rate Limit] Redis block error, using memory fallback:', err);
    memoryBlocklistStore.set(userId, {
      reason,
      blockedAt: now,
      expiresAt,
    });
    auditLogger.logUserBlocked(userId, reason, durationMs);
  }
}

/**
 * Check if a user is blocked (async, Redis-backed)
 * @param {string} userId - User ID to check
 * @returns {Promise<Object>} - Block status
 */
async function isUserBlocked(userId) {
  const redis = getRedisClient();
  const now = Date.now();

  if (!redis) {
    // In-memory fallback
    const block = memoryBlocklistStore.get(userId);

    if (!block) {
      return { blocked: false };
    }

    if (now > block.expiresAt) {
      memoryBlocklistStore.delete(userId);
      return { blocked: false };
    }

    return {
      blocked: true,
      reason: block.reason,
      expiresAt: block.expiresAt,
      remainingMs: block.expiresAt - now,
      blockedAt: block.blockedAt,
    };
  }

  try {
    const blockData = await redis.get(`blocklist:${userId}`);

    if (!blockData) {
      return { blocked: false };
    }

    const block = JSON.parse(blockData);

    // Redis TTL handles expiration, but double-check
    if (now > block.expiresAt) {
      await redis.del(`blocklist:${userId}`);
      return { blocked: false };
    }

    return {
      blocked: true,
      reason: block.reason,
      expiresAt: block.expiresAt,
      remainingMs: block.expiresAt - now,
      blockedAt: block.blockedAt,
    };
  } catch (err) {
    console.error('[Rate Limit] Redis blocklist check error:', err);
    // Fall back to memory check
    const block = memoryBlocklistStore.get(userId);
    if (!block) return { blocked: false };
    if (now > block.expiresAt) {
      memoryBlocklistStore.delete(userId);
      return { blocked: false };
    }
    return {
      blocked: true,
      reason: block.reason,
      expiresAt: block.expiresAt,
      remainingMs: block.expiresAt - now,
      blockedAt: block.blockedAt,
    };
  }
}

/**
 * Manually unblock a user
 * @param {string} userId - User ID to unblock
 * @returns {Promise<boolean>} - Whether user was previously blocked
 */
async function unblockUser(userId) {
  const redis = getRedisClient();

  if (!redis) {
    const wasBlocked = memoryBlocklistStore.has(userId);
    memoryBlocklistStore.delete(userId);

    if (wasBlocked) {
      auditLogger.info({
        type: 'USER_UNBLOCKED',
        userId,
      });
    }
    return wasBlocked;
  }

  try {
    const existed = await redis.del(`blocklist:${userId}`);
    const wasBlocked = existed > 0;

    // Also clear memory fallback
    memoryBlocklistStore.delete(userId);

    if (wasBlocked) {
      auditLogger.info({
        type: 'USER_UNBLOCKED',
        userId,
      });
    }
    return wasBlocked;
  } catch (err) {
    console.error('[Rate Limit] Redis unblock error:', err);
    const wasBlocked = memoryBlocklistStore.has(userId);
    memoryBlocklistStore.delete(userId);
    return wasBlocked;
  }
}

/**
 * Get abuse metrics for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Abuse metrics
 */
async function getAbuseMetrics(userId) {
  const redis = getRedisClient();

  if (!redis) {
    const record = memoryAbuseStore.get(`abuse:${userId}`);

    if (!record) {
      return {
        injectionAttempts: 0,
        flaggedRequests: 0,
        recentIndicators: [],
        riskLevel: 'LOW',
        lastActivity: null,
      };
    }

    // Calculate risk level
    let riskLevel = 'LOW';
    const { abuseThresholds } = securityConfig;
    if (record.injectionAttempts >= abuseThresholds.injectionAttemptsBeforeBlock) {
      riskLevel = 'BLOCKED';
    } else if (record.injectionAttempts >= abuseThresholds.suspiciousPatternsBeforeAlert) {
      riskLevel = 'HIGH';
    } else if (record.injectionAttempts >= 2) {
      riskLevel = 'MEDIUM';
    } else if (record.injectionAttempts >= 1) {
      riskLevel = 'LOW';
    }

    return {
      injectionAttempts: record.injectionAttempts,
      flaggedRequests: record.flaggedRequests,
      recentIndicators: record.indicators.slice(-10),
      riskLevel,
      lastActivity: record.lastActivity,
    };
  }

  try {
    const abuseKey = `abuse:${userId}`;
    const indicatorKey = `abuse:indicators:${userId}`;

    const [injectionAttempts, flaggedRequests, lastActivity, indicators] = await Promise.all([
      redis.hget(abuseKey, 'injectionAttempts'),
      redis.hget(abuseKey, 'flaggedRequests'),
      redis.hget(abuseKey, 'lastActivity'),
      redis.lrange(indicatorKey, 0, 9),
    ]);

    const inj = parseInt(injectionAttempts || '0', 10);
    const flagged = parseInt(flaggedRequests || '0', 10);

    // Calculate risk level
    let riskLevel = 'LOW';
    const { abuseThresholds } = securityConfig;
    if (inj >= abuseThresholds.injectionAttemptsBeforeBlock) {
      riskLevel = 'BLOCKED';
    } else if (inj >= abuseThresholds.suspiciousPatternsBeforeAlert) {
      riskLevel = 'HIGH';
    } else if (inj >= 2) {
      riskLevel = 'MEDIUM';
    } else if (inj >= 1) {
      riskLevel = 'LOW';
    }

    return {
      injectionAttempts: inj,
      flaggedRequests: flagged,
      recentIndicators: indicators.map(i => JSON.parse(i)),
      riskLevel,
      lastActivity: lastActivity ? parseInt(lastActivity, 10) : null,
    };
  } catch (err) {
    console.error('[Rate Limit] Redis abuse metrics error:', err);
    return {
      injectionAttempts: 0,
      flaggedRequests: 0,
      recentIndicators: [],
      riskLevel: 'LOW',
      lastActivity: null,
    };
  }
}

/**
 * Reset abuse tracking for a user (admin function)
 * @param {string} userId - User ID
 */
async function resetAbuseTracking(userId) {
  const redis = getRedisClient();

  if (!redis) {
    memoryAbuseStore.delete(`abuse:${userId}`);
    auditLogger.info({
      type: 'ABUSE_TRACKING_RESET',
      userId,
    });
    return;
  }

  try {
    await Promise.all([
      redis.del(`abuse:${userId}`),
      redis.del(`abuse:indicators:${userId}`),
    ]);

    // Also clear memory fallback
    memoryAbuseStore.delete(`abuse:${userId}`);

    auditLogger.info({
      type: 'ABUSE_TRACKING_RESET',
      userId,
    });
  } catch (err) {
    console.error('[Rate Limit] Redis reset error:', err);
    memoryAbuseStore.delete(`abuse:${userId}`);
  }
}

/**
 * Get current rate limit status for a user across all endpoints
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Rate limit status per endpoint
 */
async function getRateLimitStatus(userId) {
  const redis = getRedisClient();
  const status = {};
  const now = Date.now();

  for (const endpoint of Object.keys(securityConfig.rateLimits)) {
    const config = securityConfig.rateLimits[endpoint];
    const key = getRateLimitKey(userId, endpoint);

    if (!redis) {
      // In-memory
      const record = memoryRateLimitStore.get(key);
      if (record) {
        const windowStart = now - config.windowMs;
        const activeRequests = record.requests.filter(ts => ts > windowStart).length;
        status[endpoint] = {
          used: activeRequests,
          limit: config.requests,
          remaining: config.requests - activeRequests,
          windowMs: config.windowMs,
        };
      } else {
        status[endpoint] = {
          used: 0,
          limit: config.requests,
          remaining: config.requests,
          windowMs: config.windowMs,
        };
      }
    } else {
      try {
        const windowStart = now - config.windowMs;
        await redis.zremrangebyscore(key, '-inf', windowStart);
        const count = await redis.zcard(key);

        status[endpoint] = {
          used: count,
          limit: config.requests,
          remaining: config.requests - count,
          windowMs: config.windowMs,
        };
      } catch (err) {
        // Fallback to memory on error
        const record = memoryRateLimitStore.get(key);
        if (record) {
          const windowStart = now - config.windowMs;
          const activeRequests = record.requests.filter(ts => ts > windowStart).length;
          status[endpoint] = {
            used: activeRequests,
            limit: config.requests,
            remaining: config.requests - activeRequests,
            windowMs: config.windowMs,
          };
        } else {
          status[endpoint] = {
            used: 0,
            limit: config.requests,
            remaining: config.requests,
            windowMs: config.windowMs,
          };
        }
      }
    }
  }

  return status;
}

module.exports = {
  checkRateLimit,
  trackAbuseIndicator,
  blockUser,
  unblockUser,
  isUserBlocked,
  getAbuseMetrics,
  resetAbuseTracking,
  getRateLimitStatus,
};
