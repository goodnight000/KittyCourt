/**
 * Prompt Injection Detection System
 *
 * Detects potential prompt injection attacks using pattern matching
 * and heuristic analysis.
 */

const { INJECTION_PATTERNS, SEVERITY_SCORES } = require('./patterns/injectionPatterns');
const { securityConfig } = require('./config/securityConfig');

/**
 * Heuristic indicators of potential injection attacks
 */
const HEURISTIC_CHECKS = [
  {
    name: 'excessive_newlines',
    check: (input) => (input.match(/\n/g) || []).length > 20,
    score: 1,
    description: 'Unusually many newlines',
  },
  {
    name: 'high_special_char_ratio',
    check: (input) => {
      if (input.length < 20) return false;
      const specialChars = input.match(/[^a-zA-Z0-9\s.,!?'"()\-\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/g) || [];
      return specialChars.length / input.length > 0.3;
    },
    score: 2,
    description: 'High ratio of special characters',
  },
  {
    name: 'repeating_patterns',
    check: (input) => /(.{10,})\1{3,}/.test(input),
    score: 2,
    description: 'Repeating character patterns',
  },
  {
    name: 'unicode_lookalikes',
    check: (input) => {
      // Detect homoglyph attacks - expanded to cover many Unicode scripts
      // that contain characters visually similar to Latin letters

      // Cyrillic (U+0400-04FF) - contains many Latin lookalikes: a, e, o, c, etc.
      const hasCyrillic = /[\u0400-\u04FF]/.test(input);
      // Greek (U+0370-03FF) - contains Latin lookalikes: A, B, E, H, etc.
      const hasGreek = /[\u0370-\u03FF]/.test(input);
      // Mathematical Alphanumeric Symbols (U+1D400-1D7FF) - styled Latin letters
      const hasMathAlphanumeric = /[\u{1D400}-\u{1D7FF}]/u.test(input);
      // Fullwidth Latin Letters (U+FF00-FFEF) - wide versions of ASCII
      const hasFullwidth = /[\uFF00-\uFFEF]/.test(input);
      // Cherokee (U+13A0-13FF) - some characters look like Latin
      const hasCherokee = /[\u13A0-\u13FF]/.test(input);
      // Armenian (U+0530-058F) - contains some Latin lookalikes
      const hasArmenian = /[\u0530-\u058F]/.test(input);
      // Coptic (U+2C80-2CFF) - related to Greek with Latin lookalikes
      const hasCoptic = /[\u2C80-\u2CFF]/.test(input);
      // Letterlike Symbols (U+2100-214F) - stylized letters and symbols
      const hasLetterlike = /[\u2100-\u214F]/.test(input);
      // Enclosed Alphanumerics (U+2460-24FF) - circled/parenthesized letters
      const hasEnclosed = /[\u2460-\u24FF]/.test(input);
      // Latin Extended Additional (combining marks abuse)
      const hasSuspiciousCombining = /[\u0300-\u036F]{3,}/.test(input);
      // Zero-width characters that can hide content
      const hasZeroWidth = /[\u200B-\u200F\u2060-\u206F\uFEFF]/.test(input);
      // Superscripts and Subscripts that mimic regular letters
      const hasSuperSub = /[\u2070-\u209F]/.test(input);

      const hasLatin = /[a-zA-Z]/.test(input);

      // Flag if any suspicious Unicode range is mixed with Latin
      const suspiciousScript = hasCyrillic || hasGreek || hasMathAlphanumeric ||
        hasFullwidth || hasCherokee || hasArmenian || hasCoptic ||
        hasLetterlike || hasEnclosed || hasSuperSub;

      // Zero-width chars or excessive combining marks are always suspicious
      const alwaysSuspicious = hasZeroWidth || hasSuspiciousCombining;

      return alwaysSuspicious || (suspiciousScript && hasLatin);
    },
    score: 3,
    description: 'Mixed scripts or suspicious Unicode that may indicate homoglyph attack',
  },
  {
    name: 'base64_like',
    check: (input) => {
      // Long strings that look like base64 encoding
      return /[A-Za-z0-9+/]{100,}={0,2}/.test(input);
    },
    score: 2,
    description: 'Base64-like encoded content',
  },
  {
    name: 'instruction_keywords_cluster',
    check: (input) => {
      const keywords = ['instruction', 'prompt', 'system', 'ignore', 'override', 'bypass', 'forget', 'pretend'];
      const inputLower = input.toLowerCase();
      const matchCount = keywords.filter(k => inputLower.includes(k)).length;
      return matchCount >= 3;
    },
    score: 3,
    description: 'Multiple instruction-related keywords',
  },
  {
    name: 'json_structure_injection',
    check: (input) => {
      // Detect attempts to inject JSON that looks like system responses
      return /"(role|content|system|assistant)":\s*"/.test(input);
    },
    score: 2,
    description: 'JSON structure that mimics chat format',
  },
  {
    name: 'excessive_brackets',
    check: (input) => {
      const brackets = (input.match(/[[\]{}()<>]/g) || []).length;
      return brackets > 30 && brackets / input.length > 0.1;
    },
    score: 1,
    description: 'Excessive bracket characters',
  },
];

/**
 * Calculate injection risk score based on patterns and heuristics
 * @param {string} input - Sanitized input to analyze
 * @returns {Object} - Risk assessment result
 */
function analyzeInjectionRisk(input) {
  if (typeof input !== 'string' || input.length === 0) {
    return {
      riskLevel: 'NONE',
      totalScore: 0,
      patternMatches: [],
      heuristicMatches: [],
      isBlocked: false,
      requiresReview: false,
    };
  }

  const matches = [];
  let totalScore = 0;

  // Check against known patterns
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.regex.test(input)) {
      const score = SEVERITY_SCORES[pattern.severity];
      totalScore += score;
      matches.push({
        pattern: pattern.description,
        severity: pattern.severity,
        category: pattern.category,
        score,
      });
    }
  }

  // Apply heuristic checks
  const heuristicMatches = [];
  for (const heuristic of HEURISTIC_CHECKS) {
    try {
      if (heuristic.check(input)) {
        totalScore += heuristic.score;
        heuristicMatches.push({
          name: heuristic.name,
          description: heuristic.description,
          score: heuristic.score,
        });
      }
    } catch (e) {
      // Heuristic check failed, skip it
      console.warn(`[InjectionDetector] Heuristic check ${heuristic.name} failed:`, e.message);
    }
  }

  // Determine risk level based on thresholds
  const { riskThresholds } = securityConfig;
  let riskLevel;
  if (totalScore >= riskThresholds.block) {
    riskLevel = 'CRITICAL';
  } else if (totalScore >= riskThresholds.flag) {
    riskLevel = 'HIGH';
  } else if (totalScore >= riskThresholds.warn) {
    riskLevel = 'MEDIUM';
  } else if (totalScore >= 1) {
    riskLevel = 'LOW';
  } else {
    riskLevel = 'NONE';
  }

  return {
    riskLevel,
    totalScore,
    patternMatches: matches,
    heuristicMatches,
    isBlocked: totalScore >= riskThresholds.block,
    requiresReview: riskLevel === 'HIGH',
  };
}

/**
 * Main injection detection function
 * @param {string} input - Input to analyze
 * @param {Object} context - Context for logging (userId, fieldName, endpoint)
 * @returns {Object} - Detection result with action recommendation
 */
function detectInjection(input, context = {}) {
  const analysis = analyzeInjectionRisk(input);

  // Determine action based on analysis
  let action;
  let message;

  if (analysis.isBlocked) {
    action = 'BLOCK';
    message = 'Your input contains content that cannot be processed. Please rephrase your message using natural language.';
  } else if (analysis.requiresReview) {
    action = 'FLAG';
    message = null; // Will be processed but flagged for review
  } else {
    action = 'ALLOW';
    message = null;
  }

  return {
    ...analysis,
    action,
    message,
    context,
  };
}

/**
 * Quick check for blocking decisions
 * @param {string} input - Input to check
 * @returns {boolean} - Whether input should be blocked
 */
function shouldBlockInput(input) {
  const result = analyzeInjectionRisk(input);
  return result.isBlocked;
}

/**
 * Check multiple fields and return combined result
 * @param {Object} fields - Object with field names as keys and inputs as values
 * @param {Object} context - Context for logging
 * @returns {Object} - Combined detection result
 */
function detectInjectionInFields(fields, context = {}) {
  const results = {};
  let overallAction = 'ALLOW';
  let blockedField = null;
  let highestRiskLevel = 'NONE';
  let totalPatternMatches = 0;

  const riskOrder = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

  for (const [fieldName, value] of Object.entries(fields)) {
    if (typeof value !== 'string') continue;

    const result = detectInjection(value, { ...context, fieldName });
    results[fieldName] = result;

    // Track highest risk
    if (riskOrder.indexOf(result.riskLevel) > riskOrder.indexOf(highestRiskLevel)) {
      highestRiskLevel = result.riskLevel;
    }

    totalPatternMatches += result.patternMatches.length;

    // Update overall action (BLOCK > FLAG > ALLOW)
    if (result.action === 'BLOCK') {
      overallAction = 'BLOCK';
      blockedField = fieldName;
    } else if (result.action === 'FLAG' && overallAction !== 'BLOCK') {
      overallAction = 'FLAG';
    }
  }

  return {
    fieldResults: results,
    overallAction,
    blockedField,
    highestRiskLevel,
    totalPatternMatches,
    message: overallAction === 'BLOCK'
      ? `Invalid content detected in ${blockedField}. Please rephrase using natural language.`
      : null,
  };
}

/**
 * Get a summary of detected patterns for logging
 * @param {Object} analysis - Result from analyzeInjectionRisk
 * @returns {string} - Summary string
 */
function getDetectionSummary(analysis) {
  if (analysis.riskLevel === 'NONE') {
    return 'No risks detected';
  }

  const parts = [];
  if (analysis.patternMatches.length > 0) {
    const categories = [...new Set(analysis.patternMatches.map(m => m.category))];
    parts.push(`Patterns: ${categories.join(', ')}`);
  }
  if (analysis.heuristicMatches.length > 0) {
    parts.push(`Heuristics: ${analysis.heuristicMatches.map(h => h.name).join(', ')}`);
  }

  return `[${analysis.riskLevel}] Score: ${analysis.totalScore} | ${parts.join(' | ')}`;
}

module.exports = {
  detectInjection,
  analyzeInjectionRisk,
  shouldBlockInput,
  detectInjectionInFields,
  getDetectionSummary,
  HEURISTIC_CHECKS,
};
