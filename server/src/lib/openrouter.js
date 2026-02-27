/**
 * OpenRouter Client Configuration
 *
 * JSON Mode: Uses response_format with json_schema for structured output
 * Rate Limiting: Implements exponential backoff with retry on 429 errors
 */

let _openRouterClient = null;
const { buildUsageTelemetryEvent, emitUsageTelemetry } = require('./abuse/usageTelemetry');
const DEFAULT_TIMEOUT_MS = Number(process.env.OPENROUTER_TIMEOUT_MS || 60000);
const DEFAULT_MODERATION_TIMEOUT_MS = Number(process.env.OPENAI_MODERATION_TIMEOUT_MS || 15000);
const VALID_DATA_COLLECTION_MODES = new Set(['allow', 'deny']);
const DEFAULT_DATA_COLLECTION_MODE = String(process.env.OPENROUTER_DATA_COLLECTION || 'deny').toLowerCase();
const DEFAULT_REQUIRE_ZDR = String(process.env.OPENROUTER_ZDR || 'false').toLowerCase() === 'true';

// Rate limit configuration
const RATE_LIMIT_CONFIG = {
    maxRetries: 3,                    // Maximum retries on rate limit
    baseDelayMs: 1000,               // Base delay for exponential backoff
    maxDelayMs: 30000,               // Maximum delay cap
    jitterFactor: 0.2,               // Add randomness to avoid thundering herd
};

/**
 * Rate limit state tracking per model
 * Stores last rate limit hit time and current backoff level
 */
const rateLimitState = new Map();

/**
 * Calculate delay with exponential backoff and jitter
 * @param {number} attempt - Current attempt number (1-indexed)
 * @param {number} retryAfter - Optional retry-after header value in seconds
 * @returns {number} Delay in milliseconds
 */
function calculateBackoffDelay(attempt, retryAfter = null) {
    // If server specifies retry-after, respect it
    if (retryAfter && retryAfter > 0) {
        return Math.min(retryAfter * 1000, RATE_LIMIT_CONFIG.maxDelayMs);
    }

    // Exponential backoff: base * 2^(attempt-1)
    const exponentialDelay = RATE_LIMIT_CONFIG.baseDelayMs * Math.pow(2, attempt - 1);

    // Add jitter to prevent thundering herd
    const jitter = exponentialDelay * RATE_LIMIT_CONFIG.jitterFactor * Math.random();

    // Cap at maximum delay
    return Math.min(exponentialDelay + jitter, RATE_LIMIT_CONFIG.maxDelayMs);
}

/**
 * Check if a response indicates rate limiting
 * @param {Response} response - Fetch response object
 * @returns {boolean}
 */
function isRateLimited(response) {
    return response.status === 429;
}

/**
 * Extract retry-after value from response headers
 * @param {Response} response - Fetch response object
 * @returns {number|null} Retry-after in seconds, or null if not specified
 */
function getRetryAfter(response) {
    const retryAfter = response.headers.get('retry-after');
    if (!retryAfter) return null;

    // Can be a number of seconds or a date
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) return seconds;

    // Try parsing as date
    const date = new Date(retryAfter);
    if (!isNaN(date.getTime())) {
        return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 1000));
    }

    return null;
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Build OpenRouter provider privacy preferences.
 * See: https://openrouter.ai/docs/features/provider-routing
 *
 * data_collection:
 * - deny: only route to providers that opt out of training/retention collection
 * - allow: provider default behavior (less strict)
 *
 * zdr:
 * - true: require Zero Data Retention providers only (strictest, may reduce model availability)
 */
function buildProviderPreferences() {
    const mode = VALID_DATA_COLLECTION_MODES.has(DEFAULT_DATA_COLLECTION_MODE)
        ? DEFAULT_DATA_COLLECTION_MODE
        : 'deny';

    const provider = {
        data_collection: mode,
    };

    if (DEFAULT_REQUIRE_ZDR) {
        provider.zdr = true;
    }

    return provider;
}

/**
 * Get the OpenRouter client instance
 * Uses the standard fetch-based approach for OpenRouter API
 * 
 * @returns {object} The OpenRouter client methods
 * @throws {Error} If OPENROUTER_API_KEY is not configured
 */
function getOpenRouter() {
    if (!_openRouterClient) {
        if (!process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY === 'your_openrouter_api_key_here') {
            throw new Error('OPENROUTER_API_KEY is not configured. Judge Whiskers needs an API key to function.');
        }

        _openRouterClient = {
            apiKey: process.env.OPENROUTER_API_KEY,
            baseUrl: 'https://openrouter.ai/api/v1',
        };
    }
    return _openRouterClient;
}

/**
 * Check if OpenRouter is configured
 * @returns {boolean}
 */
function isOpenRouterConfigured() {
    return process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY !== 'your_openrouter_api_key_here';
}

/**
 * Make a chat completion request to OpenRouter
 * Uses JSON mode with json_schema response format for consistent output
 * Implements automatic retry with exponential backoff on rate limiting (429)
 *
 * @param {object} options - The completion options
 * @param {string} options.model - The model to use
 * @param {array} options.messages - The chat messages
 * @param {number} options.temperature - The temperature
 * @param {number} options.maxTokens - Maximum tokens to generate
 * @param {object} options.jsonSchema - The JSON schema for structured output
 * @param {string} options.reasoningEffort - Optional reasoning effort: low|medium|high
 * @param {boolean} options.skipRateLimitRetry - Skip rate limit retry (for internal use)
 * @param {Function} options.onTelemetry - Optional callback invoked with usage telemetry
 * @param {object} options.telemetryContext - Optional metadata merged into telemetry event
 * @returns {Promise<object>} The completion response
 */
async function createChatCompletion({
    model,
    messages,
    temperature = 0.7,
    maxTokens = 2000,
    jsonSchema = null,
    reasoningEffort = null,
    skipRateLimitRetry = false,
    onTelemetry = null,
    telemetryContext = null,
}) {
    const client = getOpenRouter();
    const providerPreferences = buildProviderPreferences();

    const body = {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        provider: providerPreferences,
    };

    // Add JSON mode with schema if provided (Moonshot API style)
    if (jsonSchema) {
        body.response_format = {
            type: 'json_schema',
            json_schema: jsonSchema
        };
    }

    // Add reasoning parameter for models that support it (e.g., Grok, OpenAI o1/o3, DeepSeek R1)
    // This enables extended thinking/reasoning before generating the response
    if (model.includes('grok') || model.includes('deepseek-v3.2') || model.includes('deepseek-reasoner')) {
        body.reasoning = {
            effort: reasoningEffort || 'high' // Default to high unless specified
        };
    }

    console.log(`[OpenRouter] Calling ${model} with JSON schema: ${jsonSchema ? 'yes' : 'no'}, reasoning: ${body.reasoning ? `yes (effort=${body.reasoning.effort})` : 'no'}, data_collection=${providerPreferences.data_collection}, zdr=${providerPreferences.zdr ? 'true' : 'false'}`);

    // Retry loop for rate limiting
    let lastError = null;
    const maxAttempts = skipRateLimitRetry ? 1 : RATE_LIMIT_CONFIG.maxRetries + 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
        let response;

        try {
            response = await fetch(`${client.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${client.apiKey}`,
                    'HTTP-Referer': 'https://catjudge.app',
                    'X-Title': 'Cat Judge - Relationship Dispute Resolution',
                },
                body: JSON.stringify(body),
                signal: controller.signal,
            });
        } catch (fetchError) {
            clearTimeout(timeoutId);
            // Network error or abort - don't retry on abort
            if (fetchError.name === 'AbortError') {
                throw new Error(`OpenRouter API timeout after ${DEFAULT_TIMEOUT_MS}ms`);
            }
            throw fetchError;
        } finally {
            clearTimeout(timeoutId);
        }

        // Handle rate limiting with retry
        if (isRateLimited(response)) {
            const retryAfter = getRetryAfter(response);
            const delayMs = calculateBackoffDelay(attempt, retryAfter);

            // Update rate limit state for this model
            rateLimitState.set(model, {
                lastHit: Date.now(),
                consecutiveHits: (rateLimitState.get(model)?.consecutiveHits || 0) + 1,
            });

            // Log rate limit hit
            const errorText = await response.text().catch(() => '');
            console.warn(`[OpenRouter] Rate limited (429) on ${model}, attempt ${attempt}/${maxAttempts}. Retry-After: ${retryAfter || 'not specified'}. Waiting ${delayMs}ms...`);

            // If this is not the last attempt, wait and retry
            if (attempt < maxAttempts) {
                await sleep(delayMs);
                continue;
            }

            // All retries exhausted
            lastError = new Error(`OpenRouter rate limit exceeded after ${maxAttempts} attempts: ${errorText}`);
            lastError.isRateLimited = true;
            lastError.model = model;
            throw lastError;
        }

        // Handle other errors
        if (!response.ok) {
            const errorText = await response.text();
            console.error('[OpenRouter] API Error:', errorText);

            // Check for specific error types that might benefit from retry
            const isServerError = response.status >= 500 && response.status < 600;
            if (isServerError && attempt < maxAttempts && !skipRateLimitRetry) {
                const delayMs = calculateBackoffDelay(attempt);
                console.warn(`[OpenRouter] Server error (${response.status}), retrying in ${delayMs}ms...`);
                await sleep(delayMs);
                continue;
            }

            throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
        }

        // Success - clear rate limit state for this model
        if (rateLimitState.has(model)) {
            rateLimitState.delete(model);
        }

        const data = await response.json();

        const result = {
            choices: data.choices,
            usage: data.usage,
            _rateLimitRetries: attempt - 1, // Metadata: how many retries were needed
        };

        const telemetryEvent = buildUsageTelemetryEvent({
            source: 'openrouter.chat.completions',
            provider: 'openrouter',
            model,
            usage: data.usage,
            metadata: {
                rateLimitRetries: attempt - 1,
                ...(telemetryContext && typeof telemetryContext === 'object' ? telemetryContext : {}),
            },
        });

        const telemetryOutput = await emitUsageTelemetry(onTelemetry, telemetryEvent);
        if (telemetryOutput !== undefined) {
            result._telemetry = telemetryOutput;
        }

        return result;
    }

    // Should not reach here, but safety fallback
    throw lastError || new Error('OpenRouter request failed unexpectedly');
}

/**
 * Run moderation check using OpenAI moderation (still uses OpenAI for this)
 * OpenRouter doesn't have a native moderation endpoint
 * 
 * @param {string} text - The text to check
 * @returns {Promise<object>} The moderation result
 */
async function createModeration(text) {
    // If OpenAI is configured, use it for moderation
    // Otherwise, skip moderation (return safe)
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!openaiKey || openaiKey === 'your_openai_api_key_here') {
        console.log('[OpenRouter] No OpenAI key for moderation, skipping...');
        return { results: [{ flagged: false, categories: {} }] };
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), DEFAULT_MODERATION_TIMEOUT_MS);
        let response;
        try {
            response = await fetch('https://api.openai.com/v1/moderations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${openaiKey}`,
                },
                body: JSON.stringify({ input: text }),
                signal: controller.signal,
            });
        } finally {
            clearTimeout(timeoutId);
        }

        if (!response.ok) {
            console.error('[OpenRouter] Moderation API error, returning safe');
            return { results: [{ flagged: false, categories: {} }] };
        }

        return await response.json();
    } catch (error) {
        console.error('[OpenRouter] Moderation check failed:', error);
        // Fail-closed: treat as flagged when API fails
        return {
            results: [{
                flagged: true,
                categories: { error: true },
                _moderationError: true
            }]
        };
    }
}

module.exports = {
    getOpenRouter,
    isOpenRouterConfigured,
    createChatCompletion,
    createModeration,
    // Rate limit utilities (exported for testing and monitoring)
    RATE_LIMIT_CONFIG,
    rateLimitState,
    calculateBackoffDelay,
    isRateLimited,
    getRetryAfter,
};
