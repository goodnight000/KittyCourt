/**
 * LLM Security Guardrails Module
 *
 * Comprehensive security system for protecting against prompt injection,
 * output manipulation, and abuse of LLM-powered features.
 *
 * Components:
 * - Input Sanitizer: Cleans and normalizes user input
 * - Injection Detector: Detects prompt injection attempts
 * - Prompt Armor: Creates injection-resistant prompts
 * - Output Validator: Validates and sanitizes LLM outputs
 * - Rate Limiter: Per-user, per-endpoint rate limiting
 * - Audit Logger: Security event logging
 * - Security Middleware: Express middleware integration
 */

// Configuration
const { securityConfig } = require('./config/securityConfig');

// Input sanitization
const {
  sanitizeInput,
  sanitizeFields,
  sanitizeCaseSubmission,
  sanitizeEventData,
  normalizeUnicode,
  escapePromptMetacharacters,
} = require('./inputSanitizer');

// Injection detection
const {
  detectInjection,
  analyzeInjectionRisk,
  shouldBlockInput,
  detectInjectionInFields,
  getDetectionSummary,
} = require('./injectionDetector');

// Prompt armoring
const {
  generateBoundary,
  createSecurityPreamble,
  wrapUserContent,
  createArmoredPrompt,
  armorAnalystRepairPrompt,
  armorPrimingJointPrompt,
  armorStenographerPrompt,
  armorEventPlannerPrompt,
  formatProfileContext,
  SECURITY_PREAMBLE,
} = require('./promptArmor');

// Output validation
const {
  detectOutputCompromise,
  validateSchema,
  sanitizeOutput,
  validateVerdictOutput,
  validateOutput,
  shouldBlockOutput,
} = require('./outputValidator');

// Rate limiting and abuse detection
const {
  checkRateLimit,
  trackAbuseIndicator,
  blockUser,
  unblockUser,
  isUserBlocked,
  getAbuseMetrics,
  resetAbuseTracking,
  getRateLimitStatus,
} = require('./rateLimiter');

// Audit logging
const {
  auditLogger,
  logSecurityEvent,
  querySecurityLogs,
  getSecurityMetrics,
} = require('./auditLogger');

// Middleware
const {
  llmSecurityMiddleware,
  validateLanguageMiddleware,
  rateLimitMiddleware,
  createSecurityStack,
} = require('./securityMiddleware');

// Patterns
const { INJECTION_PATTERNS, SEVERITY_SCORES } = require('./patterns/injectionPatterns');

/**
 * Convenience function to process input through the full security pipeline
 * @param {string} input - Raw user input
 * @param {Object} options - Processing options
 * @returns {Object} - Processed result
 */
function processSecureInput(input, options = {}) {
  const {
    userId,
    fieldName,
    maxLength,
    endpoint,
  } = options;

  // Step 1: Sanitize
  const sanitized = sanitizeInput(input, { maxLength, fieldName });

  // Step 2: Detect injection
  const detection = detectInjection(sanitized.sanitized, {
    userId,
    fieldName,
    endpoint,
  });

  // Step 3: Track abuse if needed
  if (detection.action === 'BLOCK' && userId) {
    trackAbuseIndicator(userId, 'injection_attempt', {
      field: fieldName,
      riskLevel: detection.riskLevel,
    });
  }

  return {
    input: sanitized.sanitized,
    original: input,
    sanitization: {
      wasModified: sanitized.wasModified,
      modifications: sanitized.modifications,
    },
    security: {
      action: detection.action,
      riskLevel: detection.riskLevel,
      isBlocked: detection.isBlocked,
      message: detection.message,
      patternMatches: detection.patternMatches.length,
    },
    safe: detection.action !== 'BLOCK',
  };
}

/**
 * Convenience function to validate and sanitize LLM output
 * @param {any} output - LLM output
 * @param {Object} options - Validation options
 * @returns {Object} - Validation result
 */
function processSecureOutput(output, options = {}) {
  const { schema, type, userId, endpoint } = options;

  const validation = validateOutput(output, { schema, type, sanitize: true });

  // Log if compromised
  if (!validation.valid && validation.issues.some(i => i.type === 'compromise_detected')) {
    auditLogger.logOutputCompromise(userId, endpoint, {
      issues: validation.issues,
    });
  }

  return {
    output: validation.sanitizedOutput,
    valid: validation.valid,
    issues: validation.issues,
    safe: validation.valid,
  };
}

module.exports = {
  // Configuration
  securityConfig,

  // Input sanitization
  sanitizeInput,
  sanitizeFields,
  sanitizeCaseSubmission,
  sanitizeEventData,
  normalizeUnicode,
  escapePromptMetacharacters,

  // Injection detection
  detectInjection,
  analyzeInjectionRisk,
  shouldBlockInput,
  detectInjectionInFields,
  getDetectionSummary,
  INJECTION_PATTERNS,
  SEVERITY_SCORES,

  // Prompt armoring
  generateBoundary,
  createSecurityPreamble,
  wrapUserContent,
  createArmoredPrompt,
  armorAnalystRepairPrompt,
  armorPrimingJointPrompt,
  armorStenographerPrompt,
  armorEventPlannerPrompt,
  formatProfileContext,
  SECURITY_PREAMBLE,

  // Output validation
  detectOutputCompromise,
  validateSchema,
  sanitizeOutput,
  validateVerdictOutput,
  validateOutput,
  shouldBlockOutput,

  // Rate limiting and abuse detection
  checkRateLimit,
  trackAbuseIndicator,
  blockUser,
  unblockUser,
  isUserBlocked,
  getAbuseMetrics,
  resetAbuseTracking,
  getRateLimitStatus,

  // Audit logging
  auditLogger,
  logSecurityEvent,
  querySecurityLogs,
  getSecurityMetrics,

  // Middleware
  llmSecurityMiddleware,
  validateLanguageMiddleware,
  rateLimitMiddleware,
  createSecurityStack,

  // Convenience functions
  processSecureInput,
  processSecureOutput,
};
