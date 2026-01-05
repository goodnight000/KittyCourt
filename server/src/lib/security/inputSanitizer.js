/**
 * Input Sanitization Layer for LLM Inputs
 *
 * Handles unicode normalization, dangerous character removal,
 * and structural sanitization to prevent prompt injection.
 */

const { securityConfig } = require('./config/securityConfig');

// Dangerous unicode ranges that can be used for attacks
const DANGEROUS_UNICODE_PATTERNS = [
  /[\u200B-\u200F]/g,     // Zero-width characters
  /[\u2028-\u2029]/g,     // Line/paragraph separators
  /[\uFEFF]/g,            // Byte order mark
  /[\u202A-\u202E]/g,     // Bidirectional text controls
  /[\u2066-\u2069]/g,     // Bidirectional isolates
  /[\u0000-\u0008]/g,     // Control characters (except tab, newline)
  /[\u000B-\u000C]/g,     // Vertical tab, form feed
  /[\u000E-\u001F]/g,     // More control characters
  /[\u007F]/g,            // Delete character
  /[\uFFF0-\uFFFF]/g,     // Specials block
];

// Characters/sequences that need escaping in prompt context
const PROMPT_METACHARACTERS = {
  '```': '` ` `',           // Prevent code block injection
  '###': '# # #',           // Prevent markdown header injection
  '---': '- - -',           // Prevent horizontal rule injection
  '<|': '< |',              // Prevent special tokens
  '|>': '| >',              // Prevent special tokens
  '<<': '< <',              // Prevent heredoc-style injection
  '>>': '> >',              // Prevent heredoc-style injection
  '${': '$ {',              // Prevent template literal injection
  '{{': '{ {',              // Prevent template injection
  '}}': '} }',              // Prevent template injection
  '[SYSTEM]': '[S Y S T E M]',
  '[INST]': '[I N S T]',
  '[/INST]': '[/ I N S T]',
};

/**
 * Normalize unicode to NFC form and remove dangerous characters
 * @param {string} input - Raw user input
 * @returns {string} - Normalized input
 */
function normalizeUnicode(input) {
  if (typeof input !== 'string') {
    return '';
  }

  // Normalize to NFC (canonical composition)
  let normalized = input.normalize('NFC');

  // Remove dangerous unicode ranges
  for (const pattern of DANGEROUS_UNICODE_PATTERNS) {
    normalized = normalized.replace(pattern, '');
  }

  return normalized;
}

/**
 * Escape prompt metacharacters that could be used for injection
 * @param {string} input - Normalized input
 * @returns {string} - Escaped input
 */
function escapePromptMetacharacters(input) {
  let escaped = input;

  for (const [dangerous, safe] of Object.entries(PROMPT_METACHARACTERS)) {
    // Use split/join for literal string replacement (not regex)
    escaped = escaped.split(dangerous).join(safe);
  }

  return escaped;
}

/**
 * Remove or escape XML/HTML-like tags that could confuse LLMs
 * @param {string} input - Input to process
 * @returns {string} - Sanitized input
 */
function sanitizeTagLikeContent(input) {
  // Escape angle brackets in tag-like patterns that look like system markers
  return input
    // Escape tags that look like system/instruction markers
    .replace(/<\/?(?:system|user|assistant|human|ai|instruction|prompt|admin)[^>]*>/gi, (match) => {
      return match.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    })
    // Escape special tokens format
    .replace(/<\|[^|>]+\|>/g, (match) => {
      return match.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    });
}

/**
 * Remove excessive whitespace and normalize line breaks
 * @param {string} input - Input to normalize
 * @returns {string} - Normalized input
 */
function normalizeWhitespace(input) {
  return input
    // Normalize all line endings to \n
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Collapse multiple consecutive newlines to max 2
    .replace(/\n{3,}/g, '\n\n')
    // Remove leading/trailing whitespace from each line
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    // Trim overall
    .trim();
}

/**
 * Truncate input to maximum allowed length
 * @param {string} input - Input to truncate
 * @param {number} maxLength - Maximum allowed length
 * @returns {{ text: string, wasTruncated: boolean }} - Truncated input and flag
 */
function truncateInput(input, maxLength) {
  if (input.length <= maxLength) {
    return { text: input, wasTruncated: false };
  }

  // Try to truncate at a word boundary
  let truncated = input.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > maxLength * 0.8) {
    truncated = truncated.slice(0, lastSpace);
  }

  return { text: truncated, wasTruncated: true };
}

/**
 * Main sanitization function - applies all sanitization layers
 * @param {string} input - Raw user input
 * @param {Object} options - Sanitization options
 * @returns {Object} - Sanitized input and metadata
 */
function sanitizeInput(input, options = {}) {
  const {
    maxLength = securityConfig.defaultMaxLength,
    fieldName = 'unknown',
    normalizeSpaces = true,
    strictMode = false,
  } = options;

  if (typeof input !== 'string') {
    return {
      sanitized: String(input ?? ''),
      original: input,
      wasModified: true,
      modifications: ['converted_to_string'],
    };
  }

  const modifications = [];
  let sanitized = input;

  // Step 1: Unicode normalization
  const normalized = normalizeUnicode(sanitized);
  if (normalized !== sanitized) {
    modifications.push('unicode_normalized');
    sanitized = normalized;
  }

  // Step 2: Escape prompt metacharacters
  const escaped = escapePromptMetacharacters(sanitized);
  if (escaped !== sanitized) {
    modifications.push('metacharacters_escaped');
    sanitized = escaped;
  }

  // Step 3: Sanitize tag-like content
  const tagSanitized = sanitizeTagLikeContent(sanitized);
  if (tagSanitized !== sanitized) {
    modifications.push('tags_sanitized');
    sanitized = tagSanitized;
  }

  // Step 4: Normalize whitespace (optional)
  if (normalizeSpaces) {
    const spacesNormalized = normalizeWhitespace(sanitized);
    if (spacesNormalized !== sanitized) {
      modifications.push('whitespace_normalized');
      sanitized = spacesNormalized;
    }
  }

  // Step 5: Truncate if necessary
  const { text: truncated, wasTruncated } = truncateInput(sanitized, maxLength);
  if (wasTruncated) {
    modifications.push('truncated');
    sanitized = truncated;
  }

  // Step 6: Strict mode additional sanitization
  if (strictMode) {
    // Remove any remaining non-printable characters (keep basic multilingual plane)
    const strictSanitized = sanitized.replace(/[^\x20-\x7E\n\t\u00A0-\uD7FF\uE000-\uFFFD]/g, '');
    if (strictSanitized !== sanitized) {
      modifications.push('strict_sanitized');
      sanitized = strictSanitized;
    }
  }

  return {
    sanitized,
    original: input,
    wasModified: modifications.length > 0,
    modifications,
    fieldName,
    originalLength: input.length,
    sanitizedLength: sanitized.length,
  };
}

/**
 * Batch sanitize multiple fields with field-specific configs
 * @param {Object} fields - Object with field names as keys and inputs as values
 * @param {Object} fieldConfigs - Configuration for each field (optional)
 * @returns {Object} - Sanitized fields and metadata
 */
function sanitizeFields(fields, fieldConfigs = {}) {
  const results = {};
  const allModifications = {};

  for (const [fieldName, value] of Object.entries(fields)) {
    if (value === undefined || value === null) {
      results[fieldName] = '';
      continue;
    }

    // Get field-specific max length from config or use default
    const maxLength = securityConfig.fieldLimits[fieldName] || securityConfig.defaultMaxLength;
    const config = { maxLength, fieldName, ...fieldConfigs[fieldName] };

    const result = sanitizeInput(value, config);

    results[fieldName] = result.sanitized;
    if (result.wasModified) {
      allModifications[fieldName] = result.modifications;
    }
  }

  return {
    sanitized: results,
    modifications: allModifications,
    hasModifications: Object.keys(allModifications).length > 0,
  };
}

/**
 * Sanitize case submission data specifically
 * @param {Object} submission - User submission with cameraFacts and theStoryIamTellingMyself
 * @returns {Object} - Sanitized submission
 */
function sanitizeCaseSubmission(submission) {
  if (!submission || typeof submission !== 'object') {
    return { cameraFacts: '', theStoryIamTellingMyself: '', selectedPrimaryEmotion: '', coreNeed: '' };
  }

  const result = sanitizeFields({
    cameraFacts: submission.cameraFacts,
    theStoryIamTellingMyself: submission.theStoryIamTellingMyself,
    selectedPrimaryEmotion: submission.selectedPrimaryEmotion,
    coreNeed: submission.coreNeed,
  });

  return result.sanitized;
}

/**
 * Sanitize event data for event planner
 * @param {Object} event - Event data
 * @returns {Object} - Sanitized event
 */
function sanitizeEventData(event) {
  if (!event || typeof event !== 'object') {
    return { title: '', notes: '', type: '', description: '' };
  }

  const result = sanitizeFields({
    eventTitle: event.title,
    eventNotes: event.notes,
    eventDescription: event.description,
  });

  return {
    ...event,
    title: result.sanitized.eventTitle || '',
    notes: result.sanitized.eventNotes || '',
    description: result.sanitized.eventDescription || '',
  };
}

module.exports = {
  sanitizeInput,
  sanitizeFields,
  sanitizeCaseSubmission,
  sanitizeEventData,
  normalizeUnicode,
  escapePromptMetacharacters,
  sanitizeTagLikeContent,
  normalizeWhitespace,
  truncateInput,
};
