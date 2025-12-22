/**
 * Embeddings Service
 * 
 * Generates vector embeddings using OpenAI's text-embedding-3-small model
 * Used for:
 * - Memory storage (de-duplication)
 * - RAG retrieval (similarity search)
 */

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSION = 1536;

/**
 * Generate an embedding for a single text
 * 
 * @param {string} text - The text to embed
 * @returns {Promise<number[]>} The embedding vector (1536 dimensions)
 */
async function generateEmbedding(text) {
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
    return data.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts (batch)
 * More efficient than calling generateEmbedding multiple times
 * 
 * @param {string[]} texts - Array of texts to embed
 * @returns {Promise<number[][]>} Array of embedding vectors
 */
async function generateEmbeddings(texts) {
    if (texts.length === 0) return [];
    if (texts.length === 1) return [await generateEmbedding(texts[0])];
    
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
    return sorted.map(item => item.embedding);
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
    isEmbeddingsConfigured,
    EMBEDDING_MODEL,
    EMBEDDING_DIMENSION,
};
