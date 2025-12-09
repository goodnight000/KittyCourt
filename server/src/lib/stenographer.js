/**
 * Stenographer Agent - Memory Extraction Service
 * 
 * This "Extractor Agent" runs in the background after a verdict is delivered.
 * It analyzes case inputs to extract deep, reusable psychological insights
 * about each user for long-term memory storage.
 * 
 * Uses Grok 4.1 Fast via OpenRouter with reasoning for high-quality extraction.
 */

const { generateEmbedding, generateEmbeddings } = require('./embeddings');
const {
    searchSimilarMemories,
    insertMemory,
    reinforceMemory,
    isSupabaseConfigured
} = require('./supabase');
const { createChatCompletion, isOpenRouterConfigured } = require('./openrouter');

// Configuration
const CONFIG = {
    model: 'deepseek/deepseek-v3.2', // DeepSeek's reasoning model via OpenRouter
    temperature: 0.3, // Low temperature for consistent extraction
    maxTokens: 6000, // Increased for reasoning tokens
    similarityThreshold: 0.92, // For de-duplication
};

/**
 * System prompt for the Stenographer/Extractor Agent
 * This agent is a psychological profiler that extracts reusable insights
 */
const STENOGRAPHER_SYSTEM_PROMPT = `You are a clinical psychologist specializing in relationship dynamics. Your role is to extract deep, reusable psychological insights from couple conflict data.

## YOUR TASK
Analyze the conflict inputs from both partners and extract LASTING insights that would be relevant to future conflicts. Focus on patterns that transcend this specific disagreement.

## INSIGHT CATEGORIES

### 1. TRIGGERS (emotional_trigger)
Specific situations, words, or behaviors that activate strong emotional responses.
Examples:
- "Feels abandoned when partner works late without notice"
- "Triggered by perceived criticism of parenting decisions"
- "Sensitive to being compared to ex-partners"

### 2. CORE VALUES (core_value)
Deeply held beliefs and principles that drive behavior and cause conflict when violated.
Examples:
- "Values financial security and stability above spontaneity"
- "Prioritizes quality time as primary love language"
- "Believes in equal division of household responsibilities"

### 3. PATTERNS (behavioral_pattern)
Recurring behavioral tendencies in conflict situations.
Examples:
- "Tends to withdraw and stonewall when overwhelmed"
- "Escalates to criticism when feeling unheard"
- "Uses humor as a defense mechanism to avoid vulnerability"

## CRITICAL RULES
1. Extract ONLY deep, reusable insights - ignore surface-level details
2. Each insight must be applicable to FUTURE conflicts
3. Be concise but specific - each insight should be 10-25 words
4. Assign a confidence score (0.5-1.0) based on how clearly the pattern emerged
5. Do NOT include names - use "this person" or similar
6. Focus on the UNDERLYING psychology, not the specific disagreement
7. Maximum 6 insights total per person (prioritize quality over quantity)

## OUTPUT FORMAT
Respond with a JSON object containing insights for each user:

{
  "userA": {
    "insights": [
      {
        "text": "string - the insight description",
        "type": "trigger" | "core_value" | "pattern",
        "confidence": 0.5-1.0
      }
    ]
  },
  "userB": {
    "insights": [
      {
        "text": "string - the insight description",
        "type": "trigger" | "core_value" | "pattern",
        "confidence": 0.5-1.0
      }
    ]
  }
}

If you cannot extract meaningful insights for a user, return an empty insights array for that user.`;

/**
 * Build the user prompt for insight extraction
 * 
 * @param {object} caseData - The case data with submissions
 * @returns {string} The formatted prompt
 */
function buildExtractionPrompt(caseData) {
    const { participants, submissions } = caseData;

    return `Extract psychological insights from this couple's conflict:

## User A: ${participants.userA.name}
**What happened (their perspective):** "${submissions.userA.cameraFacts}"
**Primary emotion:** ${submissions.userA.selectedPrimaryEmotion}
**Their inner narrative:** "${submissions.userA.theStoryIamTellingMyself}"
**What they need:** ${submissions.userA.coreNeed}

## User B: ${participants.userB.name}
**What happened (their perspective):** "${submissions.userB.cameraFacts}"
**Primary emotion:** ${submissions.userB.selectedPrimaryEmotion}
**Their inner narrative:** "${submissions.userB.theStoryIamTellingMyself}"
**What they need:** ${submissions.userB.coreNeed}

Extract lasting psychological insights about each person that would be relevant for understanding future conflicts.`;
}

/**
 * Call the extraction LLM (Grok 4.1 Fast via OpenRouter)
 * 
 * @param {string} systemPrompt - The system prompt
 * @param {string} userPrompt - The user prompt
 * @returns {Promise<object>} The extracted insights
 */
async function callExtractionLLM(systemPrompt, userPrompt) {
    if (!isOpenRouterConfigured()) {
        throw new Error('OPENROUTER_API_KEY is not configured for extraction agent.');
    }

    console.log('[Stenographer] Calling extraction LLM with reasoning enabled...');

    const response = await createChatCompletion({
        model: CONFIG.model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
        temperature: CONFIG.temperature,
        maxTokens: CONFIG.maxTokens,
        // Note: OpenRouter's createChatCompletion doesn't support json_schema yet for Grok
        // We'll parse the JSON from the response
    });

    const content = response.choices[0].message.content;

    // Try to parse JSON, with fallback handling
    try {
        return JSON.parse(content);
    } catch (error) {
        console.error('[Stenographer] Failed to parse JSON response:', content);
        throw new Error('Failed to parse extraction response as JSON');
    }
}

/**
 * De-duplicate and store insights for a single user
 * 
 * @param {string} userId - The user ID
 * @param {Array} insights - Array of extracted insights
 * @param {string} sourceCaseId - The case ID that generated these insights
 * @returns {Promise<object>} Stats about stored/reinforced insights
 */
async function processUserInsights(userId, insights, sourceCaseId) {
    const stats = {
        stored: 0,
        reinforced: 0,
        discarded: 0,
    };

    if (!insights || insights.length === 0) {
        return stats;
    }

    // Generate embeddings for all insights in batch
    const insightTexts = insights.map(i => i.text);
    const embeddings = await generateEmbeddings(insightTexts);

    for (let i = 0; i < insights.length; i++) {
        const insight = insights[i];
        const embedding = embeddings[i];

        try {
            // Search for similar existing memories
            const similar = await searchSimilarMemories(
                embedding,
                userId,
                CONFIG.similarityThreshold,
                1
            );

            if (similar.length > 0) {
                // Found a similar memory - reinforce it instead of duplicating
                await reinforceMemory(similar[0].id);
                stats.reinforced++;
                console.log(`[Stenographer] Reinforced existing memory: "${similar[0].memory_text.slice(0, 50)}..."`);
            } else {
                // No match - insert new memory
                await insertMemory({
                    userId,
                    memoryText: insight.text,
                    memoryType: insight.type,
                    embedding,
                    sourceCaseId,
                    confidenceScore: insight.confidence || 0.8,
                });
                stats.stored++;
                console.log(`[Stenographer] Stored new memory: "${insight.text.slice(0, 50)}..."`);
            }
        } catch (error) {
            console.error(`[Stenographer] Error processing insight:`, error);
            stats.discarded++;
        }
    }

    return stats;
}

/**
 * Main extraction pipeline
 * Call this AFTER a verdict has been delivered to extract and store insights
 * 
 * @param {object} caseData - The original case data
 * @param {string} caseId - The case ID for reference
 * @returns {Promise<object>} Extraction results
 */
async function extractAndStoreInsights(caseData, caseId) {
    console.log('[Stenographer] Starting insight extraction for case:', caseId);

    // Check if Supabase is configured
    if (!isSupabaseConfigured()) {
        console.log('[Stenographer] Supabase not configured, skipping memory extraction');
        return {
            success: false,
            error: 'Supabase not configured',
            userA: { stored: 0, reinforced: 0, discarded: 0 },
            userB: { stored: 0, reinforced: 0, discarded: 0 },
        };
    }

    try {
        // Step 1: Call extraction LLM
        const prompt = buildExtractionPrompt(caseData);
        const extracted = await callExtractionLLM(STENOGRAPHER_SYSTEM_PROMPT, prompt);

        console.log('[Stenographer] Extracted insights:', JSON.stringify(extracted, null, 2));

        // Step 2: Process insights for each user
        const userAId = caseData.participants.userA.id;
        const userBId = caseData.participants.userB.id;

        const [userAStats, userBStats] = await Promise.all([
            processUserInsights(userAId, extracted.userA?.insights || [], caseId),
            processUserInsights(userBId, extracted.userB?.insights || [], caseId),
        ]);

        console.log('[Stenographer] Processing complete:', { userA: userAStats, userB: userBStats });

        return {
            success: true,
            userA: userAStats,
            userB: userBStats,
            totalStored: userAStats.stored + userBStats.stored,
            totalReinforced: userAStats.reinforced + userBStats.reinforced,
        };
    } catch (error) {
        console.error('[Stenographer] Extraction failed:', error);
        return {
            success: false,
            error: error.message,
            userA: { stored: 0, reinforced: 0, discarded: 0 },
            userB: { stored: 0, reinforced: 0, discarded: 0 },
        };
    }
}

/**
 * Trigger extraction in the background (non-blocking)
 * This is the main entry point to be called after verdict delivery
 * 
 * @param {object} caseData - The original case data
 * @param {string} caseId - The case ID
 */
function triggerBackgroundExtraction(caseData, caseId) {
    // Run extraction in the background without awaiting
    setImmediate(async () => {
        try {
            await extractAndStoreInsights(caseData, caseId);
        } catch (error) {
            console.error('[Stenographer] Background extraction failed:', error);
        }
    });
}

module.exports = {
    extractAndStoreInsights,
    triggerBackgroundExtraction,
    processUserInsights,
    STENOGRAPHER_SYSTEM_PROMPT,
    buildExtractionPrompt,
    CONFIG,
};
