/**
 * Security Configuration for LLM Guardrails
 *
 * Centralized configuration for all security-related settings
 */

const securityConfig = {
  // Input length limits by field
  fieldLimits: {
    cameraFacts: 5000,
    theStoryIamTellingMyself: 2000,
    unmetNeeds: 2000,
    addendum: 2000,
    eventTitle: 200,
    eventNotes: 1000,
    eventDescription: 2000,
    dailyQuestionAnswer: 1000,
    displayName: 50,
    partnerCode: 20,
  },

  // Default for unlisted fields
  defaultMaxLength: 2000,

  // Language allowlist
  allowedLanguages: ['en', 'zh-Hans', 'zh-Hant', 'es', 'fr', 'de', 'ja', 'ko', 'pt', 'it', 'ru'],

  // Rate limiting configuration (requests per window)
  rateLimits: {
    judgeEngine: { requests: 10, windowMs: 60 * 60 * 1000 }, // 10/hour
    eventPlanner: { requests: 20, windowMs: 60 * 60 * 1000 }, // 20/hour
    stenographer: { requests: 50, windowMs: 60 * 60 * 1000 }, // 50/hour (internal)
    moderation: { requests: 100, windowMs: 60 * 60 * 1000 }, // 100/hour
    dailyQuestions: { requests: 20, windowMs: 60 * 60 * 1000 }, // 20/hour
  },

  // Abuse detection thresholds
  abuseThresholds: {
    injectionAttemptsBeforeBlock: 5,
    blockDurationMs: 24 * 60 * 60 * 1000, // 24 hours
    suspiciousPatternsBeforeAlert: 3,
  },

  // Audit logging configuration
  auditConfig: {
    logLevel: process.env.SECURITY_LOG_LEVEL || 'INFO',
    retentionDays: 90,
    alertOnSeverity: ['ERROR', 'CRITICAL'],
    enableConsole: process.env.NODE_ENV !== 'production',
  },

  // Risk score thresholds
  riskThresholds: {
    block: 8,      // Block input if score >= this
    flag: 5,       // Flag for review if score >= this
    warn: 3,       // Log warning if score >= this
  },
};

module.exports = { securityConfig };
