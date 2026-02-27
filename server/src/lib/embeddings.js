/**
 * Embeddings Service
 * 
 * Generates vector embeddings using OpenAI's text-embedding-3-small model
 * Used for:
 * - Memory storage (de-duplication)
 * - RAG retrieval (similarity search)
 */

const { buildUsageTelemetryEvent, emitUsageTelemetry } = require('./abuse/usageTelemetry');

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSION = 1536;

function attachTelemetryOutput(target, telemetryOutput) {
    if (telemetryOutput === undefined || !target || typeof target !== 'object') {
        return;
    }

    Object.defineProperty(target, '_telemetry', {
        value: telemetryOutput,
        enumerable: false,
        configurable: true,
    });
}

/**
 * Generate an embedding for a single text
 * 
 * @param {string} text - The text to embed
 * @param {object} options - Optional telemetry options
 * @param {Function} options.onTelemetry - Optional callback invoked with usage telemetry
 * @param {object} options.telemetryContext - Optional metadata merged into telemetry event
 * @returns {Promise<number[]>} The embedding vector (1536 dimensions)
 */
async function generateEmbedding(text, options = {}) {
    const { onTelemetry = null, telemetryContext = null } = options;
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey || apiKey === 'your_openai_api_key_here') {
        if (process.env.NODE_ENV === 'test') {
            return new Array(EMBEDDING_DIMENSION).fill(0);
        }
        throw new Error('OPENAI_API_KEY is not configured for embeddings.');
    }
    
    const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: EMBEDDING_MODEL,
            input: text,
        }),
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error('[Embeddings] API Error:', errorText);
        throw new Error(`Embeddings API error: ${response.status}`);
    }
    
    const data = await response.json();
    if (!data?.data?.[0]?.embedding) {
        throw new Error('Unexpected embedding response structure');
    }
    const embedding = data.data[0].embedding;

    const telemetryEvent = buildUsageTelemetryEvent({
        source: 'openai.embeddings',
        provider: 'openai',
        model: EMBEDDING_MODEL,
        usage: data.usage,
        metadata: {
            batchSize: 1,
            ...(telemetryContext && typeof telemetryContext === 'object' ? telemetryContext : {}),
        },
    });

    const telemetryOutput = await emitUsageTelemetry(onTelemetry, telemetryEvent);
    attachTelemetryOutput(embedding, telemetryOutput);

    return embedding;
}

/**
 * Generate embeddings for multiple texts (batch)
 * More efficient than calling generateEmbedding multiple times
 * 
 * @param {string[]} texts - Array of texts to embed
 * @param {object} options - Optional telemetry options
 * @param {Function} options.onTelemetry - Optional callback invoked with usage telemetry
 * @param {object} options.telemetryContext - Optional metadata merged into telemetry event
 * @returns {Promise<number[][]>} Array of embedding vectors
 */
async function generateEmbeddings(texts, options = {}) {
    const { onTelemetry = null, telemetryContext = null } = options;
    if (texts.length === 0) return [];
    if (texts.length === 1) return [await generateEmbedding(texts[0], options)];
    
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey || apiKey === 'your_openai_api_key_here') {
        if (process.env.NODE_ENV === 'test') {
            return texts.map(() => new Array(EMBEDDING_DIMENSION).fill(0));
        }
        throw new Error('OPENAI_API_KEY is not configured for embeddings.');
    }
    
    const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: EMBEDDING_MODEL,
            input: texts,
        }),
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error('[Embeddings] API Error:', errorText);
        throw new Error(`Embeddings API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Sort by index to maintain order
    const sorted = data.data.sort((a, b) => a.index - b.index);
    const embeddings = sorted.map(item => item.embedding);

    const telemetryEvent = buildUsageTelemetryEvent({
        source: 'openai.embeddings',
        provider: 'openai',
        model: EMBEDDING_MODEL,
        usage: data.usage,
        metadata: {
            batchSize: texts.length,
            ...(telemetryContext && typeof telemetryContext === 'object' ? telemetryContext : {}),
        },
    });

    const telemetryOutput = await emitUsageTelemetry(onTelemetry, telemetryEvent);
    attachTelemetryOutput(embeddings, telemetryOutput);

    return embeddings;
}

/**
 * Generate a query embedding for RAG retrieval
 * Combines multiple text inputs into a single query vector
 * 
 * @param {object} caseInputs - The case inputs
 * @param {string} caseInputs.userAFacts - User A's facts
 * @param {string} caseInputs.userAFeelings - User A's feelings
 * @param {string} caseInputs.userBFacts - User B's facts
 * @param {string} caseInputs.userBFeelings - User B's feelings
 * @param {Array} caseInputs.addendumHistory - Optional addendum entries
 * @returns {Promise<number[]>} The query embedding vector
 */
async function generateCaseQueryEmbedding(caseInputs) {
    // Combine all case inputs into a single query text
    const addendumText = Array.isArray(caseInputs.addendumHistory)
        ? caseInputs.addendumHistory.map(entry => entry?.text).filter(Boolean).join('\n\n')
        : '';
    const queryText = [
        caseInputs.userAFacts || '',
        caseInputs.userAFeelings || '',
        caseInputs.userBFacts || '',
        caseInputs.userBFeelings || '',
        addendumText
    ].filter(Boolean).join('\n\n');
    
    return generateEmbedding(queryText);
}

/**
 * Generate a user-focused query embedding for RAG retrieval
 * 
 * @param {object} inputs - The user-specific inputs
 * @param {string} inputs.userFacts - User's facts
 * @param {string} inputs.userFeelings - User's feelings
 * @param {Array} inputs.addendumHistory - Optional addendum entries
 * @returns {Promise<number[]>} The query embedding vector
 */
async function generateUserQueryEmbedding(inputs) {
    const addendumText = Array.isArray(inputs.addendumHistory)
        ? inputs.addendumHistory.map(entry => entry?.text).filter(Boolean).join('\n\n')
        : '';
    const queryText = [
        inputs.userFacts || '',
        inputs.userFeelings || '',
        addendumText
    ].filter(Boolean).join('\n\n');

    if (!queryText.trim()) {
        return new Array(EMBEDDING_DIMENSION).fill(0);
    }

    return generateEmbedding(queryText);
}

/**
 * Check if embeddings are configured
 * @returns {boolean}
 */
function isEmbeddingsConfigured() {
    return !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here');
}

module.exports = {
    generateEmbedding,
    generateEmbeddings,
    generateCaseQueryEmbedding,
    generateUserQueryEmbedding,
    isEmbeddingsConfigured,
    EMBEDDING_MODEL,
    EMBEDDING_DIMENSION,
};
