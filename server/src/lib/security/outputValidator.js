/**
 * Output Validation and Filtering
 *
 * Validates LLM outputs to detect signs of compromise or manipulation,
 * and sanitizes outputs for safe display.
 */

const { z } = require('zod');
const { INJECTION_PATTERNS } = require('./patterns/injectionPatterns');

/**
 * Patterns that indicate LLM output may have been compromised
 */
const COMPROMISED_OUTPUT_PATTERNS = [
  // Evidence of prompt leakage
  { regex: /system\s*prompt/i, description: 'System prompt mention' },
  { regex: /my\s*instructions\s*(are|state|say)/i, description: 'Instructions disclosure' },
  { regex: /I\s*am\s*programmed\s*to/i, description: 'Programming disclosure' },
  { regex: /my\s*guidelines\s*state/i, description: 'Guidelines disclosure' },
  { regex: /I\s*was\s*told\s*to/i, description: 'Instruction reference' },

  // Evidence of role manipulation
  { regex: /I\s*am\s*now\s*(?!Judge\s*Whiskers|here|ready|going)/i, description: 'Role change' },
  { regex: /I\s*will\s*ignore\s*my\s*previous/i, description: 'Ignoring instructions' },
  { regex: /I\s*have\s*been\s*jailbroken/i, description: 'Jailbreak acknowledgment' },

  // Evidence of data exfiltration attempt
  { regex: /here\s*(?:is|are)\s*(?:the|all|your)\s*(?:previous|system|hidden)/i, description: 'Data disclosure' },
  { regex: /the\s*(?:system|hidden|secret)\s*prompt\s*(?:is|says|states)/i, description: 'Prompt leakage' },

  // Unexpected code or commands
  { regex: /<script[^>]*>[\s\S]*?<\/script>/i, description: 'Script tag in output' },
  { regex: /eval\s*\([^)]+\)/i, description: 'Eval function in output' },
  { regex: /Function\s*\([^)]+\)/i, description: 'Function constructor' },

  // SQL injection markers in output
  { regex: /;\s*DROP\s*TABLE/i, description: 'SQL DROP statement' },
  { regex: /UNION\s*SELECT/i, description: 'SQL UNION injection' },

  // App-specific violations
  { regex: /user\s*[ab]\s*is\s*\d+\s*%\s*(?:at\s*fault|to\s*blame|responsible)/i, description: 'Blame percentage' },
  { regex: /(?:winner|loser)\s*(?:is|:)/i, description: 'Winner/loser language' },
];

/**
 * Check for signs of output compromise
 * @param {string|Object} output - Output to check
 * @returns {Object} - Compromise detection result
 */
function detectOutputCompromise(output) {
  const text = typeof output === 'string' ? output : JSON.stringify(output);

  if (!text || text.length === 0) {
    return { isCompromised: false, detections: [], confidence: 'LOW' };
  }

  const detections = [];

  // Check compromised output patterns
  for (const pattern of COMPROMISED_OUTPUT_PATTERNS) {
    if (pattern.regex.test(text)) {
      detections.push({
        description: pattern.description,
        type: 'compromised_output',
      });
    }
  }

  // Check for injection patterns echoed in output (could indicate attack success)
  for (const injectionPattern of INJECTION_PATTERNS) {
    if (injectionPattern.severity === 'CRITICAL' && injectionPattern.regex.test(text)) {
      detections.push({
        description: injectionPattern.description,
        type: 'injection_echo',
        category: injectionPattern.category,
      });
    }
  }

  // Determine confidence level
  let confidence;
  if (detections.length >= 3) {
    confidence = 'HIGH';
  } else if (detections.length >= 1) {
    confidence = 'MEDIUM';
  } else {
    confidence = 'LOW';
  }

  return {
    isCompromised: detections.length > 0,
    detections,
    confidence,
    detectionCount: detections.length,
  };
}

/**
 * Validate that output conforms to expected Zod schema
 * @param {any} output - LLM output to validate
 * @param {z.ZodSchema} schema - Zod schema for validation
 * @returns {Object} - Validation result
 */
function validateSchema(output, schema) {
  try {
    const parsed = schema.parse(output);
    return {
      valid: true,
      data: parsed,
      errors: [],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        data: null,
        errors: error.issues.map(e => ({
          path: e.path.join('.'),
          message: e.message,
          code: e.code,
        })),
      };
    }
    throw error;
  }
}

/**
 * Sanitize LLM output for safe display
 * @param {string|Object} output - Output to sanitize
 * @returns {string|Object} - Sanitized output
 */
function sanitizeOutput(output) {
  if (typeof output !== 'string') {
    // For objects, recursively sanitize string values
    if (typeof output === 'object' && output !== null) {
      return sanitizeObjectStrings(output);
    }
    return output;
  }

  let sanitized = output;

  // Remove any HTML/script tags
  sanitized = sanitized.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  sanitized = sanitized.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Escape HTML entities in remaining content (but preserve safe markdown)
  sanitized = sanitized
    .replace(/<(?!\/?(b|i|strong|em|p|br|ul|ol|li)\b)[^>]+>/gi, (match) => {
      return match.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    });

  // Remove suspicious URLs (keep common domains)
  const trustedDomains = ['example.com', 'pause.app', 'catjudge.app'];
  sanitized = sanitized.replace(/https?:\/\/[^\s]+/gi, (url) => {
    const isTrusted = trustedDomains.some(domain => url.includes(domain));
    return isTrusted ? url : '[URL removed]';
  });

  // Remove base64-encoded content that's suspiciously long
  sanitized = sanitized.replace(/[A-Za-z0-9+/]{200,}={0,2}/g, '[encoded content removed]');

  return sanitized;
}

/**
 * Recursively sanitize string values in an object
 * @param {Object} obj - Object to sanitize
 * @returns {Object} - Sanitized object
 */
function sanitizeObjectStrings(obj) {
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObjectStrings(item));
  }

  if (typeof obj === 'object' && obj !== null) {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        result[key] = sanitizeOutput(value);
      } else if (typeof value === 'object') {
        result[key] = sanitizeObjectStrings(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  return obj;
}

/**
 * Validate verdict output specifically
 * @param {Object} verdict - Verdict object from LLM
 * @returns {Object} - Validation result with issues
 */
function validateVerdictOutput(verdict) {
  const issues = [];

  if (!verdict || typeof verdict !== 'object') {
    issues.push({
      type: 'structure_invalid',
      message: 'Verdict is not a valid object',
    });
    return { valid: false, issues, verdict: null };
  }

  // Check for blame percentages (against app guidelines)
  const verdictText = JSON.stringify(verdict);
  if (/\d+\s*%\s*(blame|fault|responsible|at\s*fault)/i.test(verdictText)) {
    issues.push({
      type: 'guideline_violation',
      message: 'Verdict contains blame percentage (not allowed)',
    });
  }

  // Check for "winner" language
  if (/(winner|loser|right\s+party|wrong\s+party)/i.test(verdictText)) {
    issues.push({
      type: 'guideline_violation',
      message: 'Verdict contains winner/loser language',
    });
  }

  // Check for compromise indicators
  const compromiseCheck = detectOutputCompromise(verdict);
  if (compromiseCheck.isCompromised) {
    issues.push({
      type: 'potential_compromise',
      message: 'Output shows signs of manipulation',
      detections: compromiseCheck.detections,
      confidence: compromiseCheck.confidence,
    });
  }

  return {
    valid: issues.length === 0,
    issues,
    verdict: issues.length === 0 ? verdict : null,
  };
}

/**
 * Full output validation pipeline
 * @param {any} output - LLM output
 * @param {Object} options - Validation options
 * @returns {Object} - Complete validation result
 */
function validateOutput(output, options = {}) {
  const {
    schema,
    type = 'generic',
    sanitize = true,
  } = options;

  const results = {
    valid: true,
    issues: [],
    sanitizedOutput: null,
    originalOutput: output,
  };

  // Schema validation (if provided)
  if (schema) {
    const schemaResult = validateSchema(output, schema);
    if (!schemaResult.valid) {
      results.valid = false;
      results.issues.push({
        type: 'schema_validation',
        errors: schemaResult.errors,
      });
    }
  }

  // Compromise detection
  const compromiseResult = detectOutputCompromise(output);
  if (compromiseResult.isCompromised) {
    results.valid = false;
    results.issues.push({
      type: 'compromise_detected',
      confidence: compromiseResult.confidence,
      detections: compromiseResult.detections,
    });
  }

  // Type-specific validation
  if (type === 'verdict') {
    const verdictResult = validateVerdictOutput(output);
    if (!verdictResult.valid) {
      results.valid = false;
      results.issues.push(...verdictResult.issues);
    }
  }

  // Sanitize output
  if (sanitize) {
    results.sanitizedOutput = sanitizeOutput(output);
  } else {
    results.sanitizedOutput = output;
  }

  return results;
}

/**
 * Quick check if output should be blocked
 * @param {any} output - Output to check
 * @returns {boolean} - Whether output should be blocked
 */
function shouldBlockOutput(output) {
  const compromise = detectOutputCompromise(output);
  return compromise.isCompromised && compromise.confidence === 'HIGH';
}

module.exports = {
  detectOutputCompromise,
  validateSchema,
  sanitizeOutput,
  sanitizeObjectStrings,
  validateVerdictOutput,
  validateOutput,
  shouldBlockOutput,
  COMPROMISED_OUTPUT_PATTERNS,
};
