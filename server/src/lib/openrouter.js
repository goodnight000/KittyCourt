/**
 * OpenRouter Client Configuration
 * Uses OpenRouter API with x-ai/grok-4.1-fast:free model
 * 
 * JSON Mode: Uses response_format with json_schema for structured output
 */

let _openRouterClient = null;

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
            throw new Error('OPENROUTER_API_KEY is not configured. Judge Mittens needs an API key to function.');
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
 * 
 * @param {object} options - The completion options
 * @param {string} options.model - The model to use
 * @param {array} options.messages - The chat messages
 * @param {number} options.temperature - The temperature
 * @param {number} options.maxTokens - Maximum tokens to generate
 * @param {object} options.jsonSchema - The JSON schema for structured output
 * @returns {Promise<object>} The completion response
 */
async function createChatCompletion({ model, messages, temperature = 0.7, maxTokens = 2000, jsonSchema = null }) {
    const client = getOpenRouter();

    const body = {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
    };

    // Add JSON mode with schema if provided (Moonshot API style)
    if (jsonSchema) {
        body.response_format = {
            type: 'json_schema',
            json_schema: jsonSchema
        };
    }

    // Add reasoning parameter for models that support it (e.g., Grok, OpenAI o1/o3)
    // This enables extended thinking/reasoning before generating the response
    if (model.includes('grok') || model.includes('o1') || model.includes('o3')) {
        body.reasoning = {
            effort: 'high' // Use high effort for maximum reasoning quality
        };
    }

    console.log(`[OpenRouter] Calling ${model} with JSON schema: ${jsonSchema ? 'yes' : 'no'}, reasoning: ${body.reasoning ? `yes (effort=${body.reasoning.effort})` : 'no'}`);

    const response = await fetch(`${client.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${client.apiKey}`,
            'HTTP-Referer': 'https://catjudge.app', // Optional but good practice
            'X-Title': 'Cat Judge - Relationship Dispute Resolution',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[OpenRouter] API Error:', errorText);
        throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    return {
        choices: data.choices,
        usage: data.usage,
    };
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
        const response = await fetch('https://api.openai.com/v1/moderations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openaiKey}`,
            },
            body: JSON.stringify({ input: text }),
        });

        if (!response.ok) {
            console.error('[OpenRouter] Moderation API error, returning safe');
            return { results: [{ flagged: false, categories: {} }] };
        }

        return await response.json();
    } catch (error) {
        console.error('[OpenRouter] Moderation check failed:', error);
        return { results: [{ flagged: false, categories: {} }] };
    }
}

module.exports = {
    getOpenRouter,
    isOpenRouterConfigured,
    createChatCompletion,
    createModeration,
};
