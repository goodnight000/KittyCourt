/**
 * LLM Retry Handler
 *
 * Generic retry handler for LLM API calls with:
 * - Exponential backoff (Math.pow(2, attempt - 1))
 * - JSON parsing with repair fallback
 * - Zod schema validation
 * - Configurable retry count and base delay
 */

const { repairAndParseJSON } = require('../jsonRepair');

/**
 * Call LLM with automatic retry and validation
 *
 * @param {object} config - LLM call configuration
 * @param {Function} config.llmFunction - Function that returns Promise with LLM response
 * @param {object} config.schema - Zod schema for validation
 * @param {object} options - Retry options
 * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
 * @param {number} options.baseDelayMs - Base delay in ms for exponential backoff (default: 1000)
 * @param {string} options.operationName - Name for logging (default: 'LLM call')
 * @param {Function} options.onSuccess - Optional callback on success (receives validated result)
 * @param {Function} options.onError - Optional callback on error (receives error, attempt number)
 * @param {Function} options.onRetry - Optional callback before retry (receives attempt number)
 *
 * @returns {Promise<object>} Validated response
 * @throws {Error} After max retries exhausted
 */
async function callLLMWithRetry(config, options = {}) {
    const {
        llmFunction,
        schema,
    } = config;

    const {
        maxRetries = 3,
        baseDelayMs = 1000,
        operationName = 'LLM call',
        onSuccess,
        onError,
        onRetry,
    } = options;

    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            if (attempt > 1 && onRetry) {
                onRetry(attempt);
            }

            // Execute the LLM call
            const response = await llmFunction();

            // Extract content from response
            const content = response.choices?.[0]?.message?.content;
            if (!content) {
                throw new Error('No content in LLM response');
            }

            // Check for truncation
            const finishReason = response.choices?.[0]?.finish_reason;
            if (finishReason === 'length') {
                console.warn(`[llmRetryHandler] WARNING: ${operationName} response was truncated!`);
            }

            // Parse JSON with repair fallback
            let parsed;
            try {
                parsed = JSON.parse(content);
            } catch (parseError) {
                console.log(`[llmRetryHandler] ${operationName} direct parse failed, attempting repair...`);
                parsed = repairAndParseJSON(content);
            }

            // Validate with Zod schema
            const validated = schema.parse(parsed);

            // Success callback
            if (onSuccess) {
                onSuccess(validated);
            }

            return validated;

        } catch (error) {
            console.error(`[llmRetryHandler] ${operationName} attempt ${attempt}/${maxRetries} failed:`, error.message);
            lastError = error;

            // Error callback
            if (onError) {
                onError(error, attempt);
            }

            // Don't retry if we're on the last attempt
            if (attempt < maxRetries) {
                // CRITICAL: Exponential backoff using Math.pow(2, attempt - 1)
                // attempt 1: 2^0 = 1x base delay
                // attempt 2: 2^1 = 2x base delay
                // attempt 3: 2^2 = 4x base delay
                const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
                console.log(`[llmRetryHandler] Retrying ${operationName} in ${delayMs}ms...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
    }

    // All retries exhausted
    throw new Error(`${operationName} failed after ${maxRetries} attempts: ${lastError?.message}`);
}

/**
 * Simplified wrapper for common LLM retry pattern
 *
 * @param {Function} createChatCompletion - LLM API function
 * @param {object} llmConfig - Configuration for createChatCompletion
 * @param {object} schema - Zod schema for validation
 * @param {object} options - Retry options (same as callLLMWithRetry)
 * @returns {Promise<object>} Validated response
 */
async function retryLLMCall(createChatCompletion, llmConfig, schema, options = {}) {
    return callLLMWithRetry({
        llmFunction: () => createChatCompletion(llmConfig),
        schema,
    }, options);
}

module.exports = {
    callLLMWithRetry,
    retryLLMCall,
};
