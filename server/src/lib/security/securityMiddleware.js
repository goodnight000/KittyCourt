/**
 * Security Middleware for LLM-Related Endpoints
 *
 * Integrates all security layers into Express middleware:
 * - User blocking check
 * - Rate limiting
 * - Input sanitization
 * - Injection detection
 * - Language validation
 */

const { sanitizeInput, sanitizeFields } = require('./inputSanitizer');
const { detectInjection, detectInjectionInFields } = require('./injectionDetector');
const { checkRateLimit, isUserBlocked, trackAbuseIndicator } = require('./rateLimiter');
const { auditLogger } = require('./auditLogger');
const { securityConfig } = require('./config/securityConfig');

/**
 * PII patterns for sanitization in logs
 * These patterns are used to redact sensitive information before logging
 */
const PII_PATTERNS = [
  // Email addresses
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[EMAIL_REDACTED]' },
  // Phone numbers (various formats)
  { pattern: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, replacement: '[PHONE_REDACTED]' },
  // SSN-like patterns
  { pattern: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g, replacement: '[SSN_REDACTED]' },
  // Credit card numbers (basic patterns)
  { pattern: /\b(?:\d{4}[-.\s]?){3}\d{4}\b/g, replacement: '[CARD_REDACTED]' },
  // IP addresses (IPv4)
  { pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, replacement: '[IP_REDACTED]' },
  // Dates of birth patterns (MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD)
  { pattern: /\b(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})\b/g, replacement: '[DOB_REDACTED]' },
];

/**
 * Sanitize PII from a string before logging
 * @param {string} input - Input string that may contain PII
 * @returns {string} - Sanitized string with PII redacted
 */
function sanitizePIIForLogging(input) {
  if (typeof input !== 'string') {
    return input;
  }

  let sanitized = input;
  for (const { pattern, replacement } of PII_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  return sanitized;
}

/**
 * Main security middleware for LLM-related endpoints
 * @param {string} endpointName - Name of the endpoint for rate limiting
 * @returns {Function} - Express middleware function
 */
function llmSecurityMiddleware(endpointName) {
  return async (req, res, next) => {
    // Only accept userId from authenticated session to prevent rate limit bypass
    const userId = req.user?.id || `ip:${req.ip}`;

    try {
      // Step 1: Check if user is blocked (async - Redis-backed)
      const blockStatus = await isUserBlocked(userId);
      if (blockStatus.blocked) {
        auditLogger.logBlockedRequest(userId, blockStatus.reason, { endpoint: endpointName });

        return res.status(403).json({
          error: 'Access temporarily restricted',
          message: 'Your access has been temporarily restricted. Please contact support if you believe this is an error.',
          retryAfter: Math.ceil(blockStatus.remainingMs / 1000),
        });
      }

      // Step 2: Check rate limits (async - Redis-backed)
      const rateLimit = await checkRateLimit(userId, endpointName);
      if (!rateLimit.allowed) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'You have made too many requests. Please wait before trying again.',
          retryAfter: rateLimit.retryAfter,
        });
      }

      // Add rate limit headers
      res.set('X-RateLimit-Remaining', String(rateLimit.remaining));
      res.set('X-RateLimit-Reset', String(rateLimit.resetAt));
      if (rateLimit.total) {
        res.set('X-RateLimit-Limit', String(rateLimit.total));
      }

      // Step 3: Identify and process LLM-related fields
      const fieldsToProcess = identifyLLMFields(req.body, endpointName);

      if (fieldsToProcess.length > 0) {
        const sanitizedBody = JSON.parse(JSON.stringify(req.body)); // Deep clone
        let hasBlockingIssue = false;
        const securityIssues = [];

        for (const { fieldPath, maxLength } of fieldsToProcess) {
          const value = getNestedValue(req.body, fieldPath);
          if (typeof value !== 'string' || value.length === 0) continue;

          // Sanitize the field
          const sanitized = sanitizeInput(value, {
            maxLength,
            fieldName: fieldPath,
          });

          // Check for injection
          const injectionCheck = detectInjection(sanitized.sanitized, {
            userId,
            fieldName: fieldPath,
            endpoint: endpointName,
          });

          if (injectionCheck.action === 'BLOCK') {
            hasBlockingIssue = true;
            securityIssues.push({
              field: fieldPath,
              action: 'BLOCK',
              riskLevel: injectionCheck.riskLevel,
            });

            // Track the injection attempt
            trackAbuseIndicator(userId, 'injection_attempt', {
              field: fieldPath,
              riskLevel: injectionCheck.riskLevel,
              patternMatches: injectionCheck.patternMatches.length,
            });

            auditLogger.logInjectionAttempt(userId, {
              endpoint: endpointName,
              fieldName: fieldPath,
              riskLevel: injectionCheck.riskLevel,
              totalScore: injectionCheck.totalScore,
              patterns: injectionCheck.patternMatches.map(m => m.pattern),
              // Sanitize PII from input preview before logging to prevent PII exposure
              inputPreview: sanitizePIIForLogging(value.slice(0, 100)),
            });
          } else if (injectionCheck.action === 'FLAG') {
            securityIssues.push({
              field: fieldPath,
              action: 'FLAG',
              riskLevel: injectionCheck.riskLevel,
            });

            trackAbuseIndicator(userId, 'flagged_request', {
              field: fieldPath,
              riskLevel: injectionCheck.riskLevel,
            });
          }

          // Log if input was modified during sanitization
          if (sanitized.wasModified) {
            auditLogger.logInputSanitized(userId, fieldPath, sanitized.modifications);
          }

          // Update the body with sanitized value
          setNestedValue(sanitizedBody, fieldPath, sanitized.sanitized);
        }

        // Block request if critical issues found
        if (hasBlockingIssue) {
          return res.status(400).json({
            error: 'Invalid input',
            message: 'Your input contains content that cannot be processed. Please rephrase using natural language.',
            code: 'SECURITY_BLOCK',
          });
        }

        // Attach sanitized body for downstream use
        req.sanitizedBody = sanitizedBody;
        req.securityContext = {
          userId,
          endpoint: endpointName,
          flaggedFields: securityIssues.filter(i => i.action === 'FLAG'),
          rateLimitRemaining: rateLimit.remaining,
          wasModified: true,
        };
      } else {
        // No fields to process, pass through original body
        req.sanitizedBody = req.body;
        req.securityContext = {
          userId,
          endpoint: endpointName,
          flaggedFields: [],
          rateLimitRemaining: rateLimit.remaining,
          wasModified: false,
        };
      }

      next();
    } catch (error) {
      auditLogger.error({
        type: 'SECURITY_MIDDLEWARE_ERROR',
        userId,
        endpoint: endpointName,
        error: error.message,
        stack: error.stack,
      });

      // Fail closed - reject request on error
      return res.status(500).json({
        error: 'Security check failed',
        message: 'An error occurred while processing your request. Please try again.',
      });
    }
  };
}

/**
 * Language validation middleware
 * Validates that language parameter is in the allowlist
 */
function validateLanguageMiddleware(req, res, next) {
  const language = req.body?.language || req.query?.language;

  if (language && !securityConfig.allowedLanguages.includes(language)) {
    const userId = req.user?.id || req.body?.userId || 'anonymous';

    auditLogger.warn({
      type: 'INVALID_LANGUAGE',
      userId,
      requestedLanguage: language,
      allowedLanguages: securityConfig.allowedLanguages,
    });

    return res.status(400).json({
      error: 'Invalid language',
      message: `Language must be one of: ${securityConfig.allowedLanguages.join(', ')}`,
      code: 'INVALID_LANGUAGE',
    });
  }

  next();
}

/**
 * Simple rate limiting middleware (without full security checks)
 * For endpoints that just need rate limiting
 */
function rateLimitMiddleware(endpointName) {
  return async (req, res, next) => {
    // Only accept userId from authenticated session to prevent rate limit bypass
    const userId = req.user?.id || `ip:${req.ip}`;

    try {
      // Check if blocked (async - Redis-backed)
      const blockStatus = await isUserBlocked(userId);
      if (blockStatus.blocked) {
        return res.status(403).json({
          error: 'Access temporarily restricted',
          retryAfter: Math.ceil(blockStatus.remainingMs / 1000),
        });
      }

      // Check rate limit (async - Redis-backed)
      const rateLimit = await checkRateLimit(userId, endpointName);
      if (!rateLimit.allowed) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          retryAfter: rateLimit.retryAfter,
        });
      }

      res.set('X-RateLimit-Remaining', String(rateLimit.remaining));
      next();
    } catch (error) {
      // Fail closed - reject request if rate limiting fails (security-first approach)
      auditLogger.error({
        type: 'RATE_LIMIT_MIDDLEWARE_ERROR',
        userId,
        endpoint: endpointName,
        error: error.message,
      });

      return res.status(503).json({
        error: 'Service temporarily unavailable',
        message: 'Unable to process your request at this time. Please try again later.',
        retryAfter: 30,
      });
    }
  };
}

/**
 * Identify fields that should be sanitized based on endpoint
 * @param {Object} body - Request body
 * @param {string} endpointName - Endpoint name
 * @returns {Array} - Array of field configs
 */
function identifyLLMFields(body, endpointName) {
  const fieldMappings = {
    judgeEngine: [
      { fieldPath: 'submissions.userA.cameraFacts', maxLength: securityConfig.fieldLimits.cameraFacts },
      { fieldPath: 'submissions.userA.theStoryIamTellingMyself', maxLength: securityConfig.fieldLimits.theStoryIamTellingMyself },
      { fieldPath: 'submissions.userB.cameraFacts', maxLength: securityConfig.fieldLimits.cameraFacts },
      { fieldPath: 'submissions.userB.theStoryIamTellingMyself', maxLength: securityConfig.fieldLimits.theStoryIamTellingMyself },
    ],
    court: [
      // Evidence submission fields (primary field names used by API)
      { fieldPath: 'evidence', maxLength: securityConfig.fieldLimits.cameraFacts },
      { fieldPath: 'feelings', maxLength: securityConfig.fieldLimits.theStoryIamTellingMyself },
      { fieldPath: 'needs', maxLength: securityConfig.fieldLimits.theStoryIamTellingMyself },
      // Legacy field names (for backwards compatibility)
      { fieldPath: 'cameraFacts', maxLength: securityConfig.fieldLimits.cameraFacts },
      { fieldPath: 'theStoryIamTellingMyself', maxLength: securityConfig.fieldLimits.theStoryIamTellingMyself },
      // Addendum fields
      { fieldPath: 'text', maxLength: securityConfig.fieldLimits.addendum },
      { fieldPath: 'message', maxLength: securityConfig.fieldLimits.addendum },
    ],
    eventPlanner: [
      { fieldPath: 'title', maxLength: securityConfig.fieldLimits.eventTitle },
      { fieldPath: 'notes', maxLength: securityConfig.fieldLimits.eventNotes },
      { fieldPath: 'description', maxLength: securityConfig.fieldLimits.eventDescription },
      { fieldPath: 'event.title', maxLength: securityConfig.fieldLimits.eventTitle },
      { fieldPath: 'event.notes', maxLength: securityConfig.fieldLimits.eventNotes },
    ],
    dailyQuestions: [
      { fieldPath: 'answer', maxLength: securityConfig.fieldLimits.dailyQuestionAnswer },
      { fieldPath: 'response', maxLength: securityConfig.fieldLimits.dailyQuestionAnswer },
    ],
    stenographer: [
      { fieldPath: 'submissions.userA.cameraFacts', maxLength: securityConfig.fieldLimits.cameraFacts },
      { fieldPath: 'submissions.userA.theStoryIamTellingMyself', maxLength: securityConfig.fieldLimits.theStoryIamTellingMyself },
      { fieldPath: 'submissions.userB.cameraFacts', maxLength: securityConfig.fieldLimits.cameraFacts },
      { fieldPath: 'submissions.userB.theStoryIamTellingMyself', maxLength: securityConfig.fieldLimits.theStoryIamTellingMyself },
    ],
  };

  return fieldMappings[endpointName] || [];
}

/**
 * Get nested value from object using dot notation path
 * @param {Object} obj - Source object
 * @param {string} path - Dot notation path
 * @returns {any} - Value at path
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((curr, key) => curr?.[key], obj);
}

/**
 * Set nested value in object using dot notation path
 * @param {Object} obj - Target object
 * @param {string} path - Dot notation path
 * @param {any} value - Value to set
 */
function setNestedValue(obj, path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const target = keys.reduce((curr, key) => {
    if (curr[key] === undefined) curr[key] = {};
    return curr[key];
  }, obj);
  target[lastKey] = value;
}

/**
 * Create a combined middleware that applies multiple security checks
 * @param {string} endpointName - Endpoint name
 * @param {Object} options - Options
 * @returns {Array} - Array of middleware functions
 */
function createSecurityStack(endpointName, options = {}) {
  const { validateLanguage = true } = options;

  const stack = [llmSecurityMiddleware(endpointName)];

  if (validateLanguage) {
    stack.push(validateLanguageMiddleware);
  }

  return stack;
}

module.exports = {
  llmSecurityMiddleware,
  validateLanguageMiddleware,
  rateLimitMiddleware,
  createSecurityStack,
  identifyLLMFields,
  getNestedValue,
  setNestedValue,
  sanitizePIIForLogging,
};
