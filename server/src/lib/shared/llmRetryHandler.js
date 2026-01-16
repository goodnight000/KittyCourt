/**
 * LLM Retry Handler
 *
 * Generic retry handler for LLM API calls with:
 * - Exponential backoff (Math.pow(2, attempt - 1))
 * - JSON parsing with repair fallback
 * - Zod schema validation
 * - Configurable retry count and base delay
 * - Model fallback capability when primary model fails
 */

const { repairAndParseJSON } = require('../jsonRepair');

/**
 * Default model fallback chains for different model tiers
 * Each tier has a primary model and fallback options
 */
const MODEL_FALLBACK_CHAINS = {
    // Best tier - Claude Opus -> Claude Sonnet -> GPT-4o
    'anthropic/claude-opus-4.5': [
        'anthropic/claude-sonnet-4',
        'openai/gpt-4o',
    ],
    'anthropic/claude-sonnet-4': [
        'openai/gpt-4o',
        'anthropic/claude-haiku-3.5',
    ],
    // Fast tier - DeepSeek -> GPT-4o-mini -> Claude Haiku
    'deepseek/deepseek-v3.2': [
        'openai/gpt-4o-mini',
        'anthropic/claude-haiku-3.5',
    ],
    'deepseek/deepseek-chat': [
        'openai/gpt-4o-mini',
        'anthropic/claude-haiku-3.5',
    ],
    // Logical tier - Gemini -> GPT-4o -> Claude Sonnet
    'google/gemini-3-flash-preview': [
        'openai/gpt-4o',
        'anthropic/claude-sonnet-4',
    ],
    'google/gemini-2.5-flash-preview': [
        'openai/gpt-4o',
        'anthropic/claude-sonnet-4',
    ],
    // Default fallbacks for unknown models
    'default': [
        'openai/gpt-4o-mini',
        'anthropic/claude-haiku-3.5',
    ],
};

/**
 * Get fallback models for a given primary model
 * @param {string} primaryModel - The primary model that failed
 * @returns {string[]} Array of fallback model IDs
 */
function getFallbackModels(primaryModel) {
    return MODEL_FALLBACK_CHAINS[primaryModel] || MODEL_FALLBACK_CHAINS['default'];
}

/**
 * Check if an error is a model-specific failure that warrants fallback
 * @param {Error} error - The error to check
 * @returns {boolean} Whether this error should trigger model fallback
 */
function isModelFailure(error) {
    const message = error.message?.toLowerCase() || '';
    const modelFailurePatterns = [
        'model not available',
        'model is currently overloaded',
        'model capacity',
        'service unavailable',
        '503',
        '502',
        'gateway timeout',
        'model error',
        'upstream error',
        'provider error',
        'context length exceeded',
        'token limit',
    ];
    return modelFailurePatterns.some(pattern => message.includes(pattern));
}

/**
 * Call LLM with automatic retry and validation
 *
 * @param {object} config - LLM call configuration
 * @param {Function} config.llmFunction - Function that returns Promise with LLM response (can accept model override)
 * @param {object} config.schema - Zod schema for validation
 * @param {string} config.primaryModel - Optional primary model ID for fallback chain
 * @param {object} options - Retry options
 * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
 * @param {number} options.baseDelayMs - Base delay in ms for exponential backoff (default: 1000)
 * @param {string} options.operationName - Name for logging (default: 'LLM call')
 * @param {boolean} options.enableModelFallback - Enable fallback to alternate models (default: true)
 * @param {string[]} options.fallbackModels - Custom fallback model chain (optional)
 * @param {Function} options.onSuccess - Optional callback on success (receives validated result, model used)
 * @param {Function} options.onError - Optional callback on error (receives error, attempt number)
 * @param {Function} options.onRetry - Optional callback before retry (receives attempt number)
 * @param {Function} options.onModelFallback - Optional callback when falling back to different model
 *
 * @returns {Promise<object>} Validated response with _modelUsed metadata
 * @throws {Error} After max retries exhausted on all models
 */
async function callLLMWithRetry(config, options = {}) {
    const {
        llmFunction,
        schema,
        primaryModel,
    } = config;

    const {
        maxRetries = 3,
        baseDelayMs = 1000,
        operationName = 'LLM call',
        enableModelFallback = true,
        fallbackModels: customFallbackModels,
        onSuccess,
        onError,
        onRetry,
        onModelFallback,
    } = options;

    // Build model chain: primary + fallbacks
    const modelChain = primaryModel
        ? [primaryModel, ...(customFallbackModels || getFallbackModels(primaryModel))]
        : [null]; // null means use llmFunction's default model

    let lastError = null;
    let currentModelIndex = 0;

    while (currentModelIndex < modelChain.length) {
        const currentModel = modelChain[currentModelIndex];
        const isUsingFallback = currentModelIndex > 0;

        if (isUsingFallback) {
            console.log(`[llmRetryHandler] Falling back to model: ${currentModel}`);
            if (onModelFallback) {
                onModelFallback(currentModel, currentModelIndex);
            }
        }

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                if (attempt > 1 && onRetry) {
                    onRetry(attempt);
                }

                // Execute the LLM call, passing model override if available
                const response = currentModel
                    ? await llmFunction(currentModel)
                    : await llmFunction();

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

                // Add metadata about which model was used
                validated._modelUsed = currentModel || 'default';
                validated._usedFallback = isUsingFallback;

                // Success callback
                if (onSuccess) {
                    onSuccess(validated, currentModel);
                }

                return validated;

            } catch (error) {
                const modelLabel = currentModel || 'default';
                console.error(`[llmRetryHandler] ${operationName} attempt ${attempt}/${maxRetries} (model: ${modelLabel}) failed:`, error.message);
                lastError = error;

                // Error callback
                if (onError) {
                    onError(error, attempt);
                }

                // Check if this is a model-specific failure that should trigger fallback
                if (enableModelFallback && isModelFailure(error) && currentModelIndex < modelChain.length - 1) {
                    console.log(`[llmRetryHandler] Model failure detected, will try fallback model`);
                    break; // Exit retry loop to try next model
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

        // Move to next model in fallback chain
        if (enableModelFallback && currentModelIndex < modelChain.length - 1) {
            currentModelIndex++;
        } else {
            break; // No more models to try
        }
    }

    // All retries exhausted on all models
    const modelsTriedMsg = enableModelFallback && modelChain.length > 1
        ? ` (tried models: ${modelChain.filter(Boolean).join(', ')})`
        : '';
    throw new Error(`${operationName} failed after ${maxRetries} attempts${modelsTriedMsg}: ${lastError?.message}`);
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
    const primaryModel = llmConfig.model;

    return callLLMWithRetry({
        // llmFunction accepts optional model override for fallback
        llmFunction: (modelOverride) => createChatCompletion({
            ...llmConfig,
            model: modelOverride || llmConfig.model,
        }),
        schema,
        primaryModel,
    }, options);
}

/**
 * Call LLM with model fallback support (no retry, just fallback on failure)
 * Useful when you want to try multiple models but not retry the same model
 *
 * @param {Function} createChatCompletion - LLM API function
 * @param {object} llmConfig - Configuration for createChatCompletion
 * @param {object} schema - Zod schema for validation
 * @param {object} options - Options
 * @param {string[]} options.fallbackModels - Models to try if primary fails
 * @param {string} options.operationName - Name for logging
 * @returns {Promise<object>} Validated response
 */
async function callWithModelFallback(createChatCompletion, llmConfig, schema, options = {}) {
    const primaryModel = llmConfig.model;
    const fallbackModels = options.fallbackModels || getFallbackModels(primaryModel);
    const modelChain = [primaryModel, ...fallbackModels];
    const operationName = options.operationName || 'LLM call';

    let lastError = null;

    for (let i = 0; i < modelChain.length; i++) {
        const model = modelChain[i];
        const isUsingFallback = i > 0;

        if (isUsingFallback) {
            console.log(`[llmRetryHandler] ${operationName} falling back to model: ${model}`);
        }

        try {
            const response = await createChatCompletion({
                ...llmConfig,
                model,
            });

            const content = response.choices?.[0]?.message?.content;
            if (!content) {
                throw new Error('No content in LLM response');
            }

            // Parse JSON with repair fallback
            let parsed;
            try {
                parsed = JSON.parse(content);
            } catch (parseError) {
                parsed = repairAndParseJSON(content);
            }

            // Validate with Zod schema
            const validated = schema.parse(parsed);

            // Add metadata about which model was used
            validated._modelUsed = model;
            validated._usedFallback = isUsingFallback;

            return validated;

        } catch (error) {
            console.error(`[llmRetryHandler] ${operationName} failed with model ${model}:`, error.message);
            lastError = error;

            // Only try fallback if this is a model failure
            if (!isModelFailure(error) && i < modelChain.length - 1) {
                // Not a model failure, still try fallback but log it
                console.log(`[llmRetryHandler] Non-model error, attempting fallback anyway`);
            }
        }
    }

    throw new Error(`${operationName} failed on all models (${modelChain.join(', ')}): ${lastError?.message}`);
}

module.exports = {
    callLLMWithRetry,
    retryLLMCall,
    callWithModelFallback,
    getFallbackModels,
    isModelFailure,
    MODEL_FALLBACK_CHAINS,
};
