/**
 * Rate Limiting and Abuse Detection
 *
 * Provides per-user, per-endpoint rate limiting and tracks
 * abuse patterns for automatic blocking.
 */

const { securityConfig } = require('./config/securityConfig');
const { auditLogger } = require('./auditLogger');

// In-memory stores (replace with Redis in production for multi-instance support)
const rateLimitStore = new Map();
const abuseStore = new Map();
const blocklistStore = new Map();

// Clean up old entries periodically
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

setInterval(() => {
  const now = Date.now();

  // Clean rate limit store
  for (const [key, record] of rateLimitStore.entries()) {
    const maxWindowMs = Math.max(...Object.values(securityConfig.rateLimits).map(r => r.windowMs));
    if (record.lastActivity && now - record.lastActivity > maxWindowMs * 2) {
      rateLimitStore.delete(key);
    }
  }

  // Clean abuse store (keep for 24 hours after last activity)
  for (const [key, record] of abuseStore.entries()) {
    if (record.lastActivity && now - record.lastActivity > 24 * 60 * 60 * 1000) {
      abuseStore.delete(key);
    }
  }

  // Clean expired blocks
  for (const [userId, block] of blocklistStore.entries()) {
    if (now > block.expiresAt) {
      blocklistStore.delete(userId);
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
 * Check rate limit for a user on an endpoint
 * @param {string} userId - User ID
 * @param {string} endpoint - Endpoint name (e.g., 'judgeEngine', 'eventPlanner')
 * @returns {Object} - Rate limit status
 */
function checkRateLimit(userId, endpoint) {
  const config = securityConfig.rateLimits[endpoint];
  if (!config) {
    // No rate limit configured for this endpoint
    return { allowed: true, remaining: Infinity, limited: false };
  }

  const key = getRateLimitKey(userId, endpoint);
  const now = Date.now();
  const windowStart = now - config.windowMs;

  // Get existing record or create new
  let record = rateLimitStore.get(key);
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

    auditLogger.logRateLimitExceeded(userId, endpoint, {
      limit: config.requests,
      windowMs: config.windowMs,
      currentCount: record.requests.length,
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

  // Add current request
  record.requests.push(now);
  rateLimitStore.set(key, record);

  return {
    allowed: true,
    limited: false,
    remaining: config.requests - record.requests.length,
    resetAt: now + config.windowMs,
    total: config.requests,
  };
}

/**
 * Track an abuse indicator for a user
 * @param {string} userId - User ID
 * @param {string} indicatorType - Type of abuse indicator
 * @param {Object} details - Additional details
 */
function trackAbuseIndicator(userId, indicatorType, details = {}) {
  const key = `abuse:${userId}`;
  let record = abuseStore.get(key);

  if (!record) {
    record = {
      indicators: [],
      injectionAttempts: 0,
      flaggedRequests: 0,
      lastActivity: Date.now(),
    };
  }

  // Add indicator
  record.indicators.push({
    type: indicatorType,
    timestamp: Date.now(),
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

  record.lastActivity = Date.now();
  abuseStore.set(key, record);

  // Check if user should be blocked
  const { abuseThresholds } = securityConfig;
  if (record.injectionAttempts >= abuseThresholds.injectionAttemptsBeforeBlock) {
    blockUser(userId, 'Excessive injection attempts detected', abuseThresholds.blockDurationMs);
  }

  // Log if threshold approached
  if (record.injectionAttempts >= abuseThresholds.suspiciousPatternsBeforeAlert) {
    auditLogger.logAbusePattern(userId, {
      injectionAttempts: record.injectionAttempts,
      flaggedRequests: record.flaggedRequests,
      recentIndicators: record.indicators.slice(-5),
    });
  }
}

/**
 * Block a user
 * @param {string} userId - User ID to block
 * @param {string} reason - Reason for block
 * @param {number} durationMs - Block duration in milliseconds
 */
function blockUser(userId, reason, durationMs = securityConfig.abuseThresholds.blockDurationMs) {
  const expiresAt = Date.now() + durationMs;

  blocklistStore.set(userId, {
    reason,
    blockedAt: Date.now(),
    expiresAt,
  });

  auditLogger.logUserBlocked(userId, reason, durationMs);
}

/**
 * Check if a user is blocked
 * @param {string} userId - User ID to check
 * @returns {Object} - Block status
 */
function isUserBlocked(userId) {
  const block = blocklistStore.get(userId);

  if (!block) {
    return { blocked: false };
  }

  const now = Date.now();
  if (now > block.expiresAt) {
    blocklistStore.delete(userId);
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

/**
 * Manually unblock a user
 * @param {string} userId - User ID to unblock
 */
function unblockUser(userId) {
  const wasBlocked = blocklistStore.has(userId);
  blocklistStore.delete(userId);

  if (wasBlocked) {
    auditLogger.info({
      type: 'USER_UNBLOCKED',
      userId,
    });
  }

  return wasBlocked;
}

/**
 * Get abuse metrics for a user
 * @param {string} userId - User ID
 * @returns {Object} - Abuse metrics
 */
function getAbuseMetrics(userId) {
  const record = abuseStore.get(`abuse:${userId}`);

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

/**
 * Reset abuse tracking for a user (admin function)
 * @param {string} userId - User ID
 */
function resetAbuseTracking(userId) {
  abuseStore.delete(`abuse:${userId}`);
  auditLogger.info({
    type: 'ABUSE_TRACKING_RESET',
    userId,
  });
}

/**
 * Get current rate limit status for a user across all endpoints
 * @param {string} userId - User ID
 * @returns {Object} - Rate limit status per endpoint
 */
function getRateLimitStatus(userId) {
  const status = {};

  for (const endpoint of Object.keys(securityConfig.rateLimits)) {
    const key = getRateLimitKey(userId, endpoint);
    const record = rateLimitStore.get(key);
    const config = securityConfig.rateLimits[endpoint];

    if (record) {
      const now = Date.now();
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
