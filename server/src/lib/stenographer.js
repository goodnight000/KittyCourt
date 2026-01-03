/**
 * Stenographer Agent - Memory Extraction Service
 * 
 * This "Extractor Agent" runs in the background after a verdict is delivered.
 * It analyzes case inputs to extract deep, reusable psychological insights
 * about each user for long-term memory storage.
 * 
 * Uses DeepSeek v3.2 via OpenRouter with reasoning for high-quality extraction.
 */

const embeddings = require('./embeddings');
const supabase = require('./supabase');
const { createChatCompletion, isOpenRouterConfigured } = require('./openrouter');
const { repairAndParseJSON } = require('./jsonRepair');
const { getLanguageLabel, normalizeLanguage } = require('./language');

// Configuration
const CONFIG = {
    model: 'deepseek/deepseek-v3.2', // DeepSeek's reasoning model via OpenRouter
    temperature: 0.3, // Low temperature for consistent extraction
    maxTokens: 6000, // Increased for reasoning tokens
    similarityThreshold: 0.92, // For de-duplication
};

const DAILY_QUESTION_CONFIG = {
    model: 'deepseek/deepseek-v3.2',
    temperature: 0.2,
    maxTokens: 2000,
    similarityThreshold: 0.9,
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

const DAILY_QUESTION_SYSTEM_PROMPT = `You are a relationship researcher extracting durable, user-specific insights from daily question answers.

## YOUR TASK
From each person's answer, extract stable preferences, values, or patterns that are likely to remain relevant over time.

## INSIGHT TYPES
- preference: Stable likes/dislikes or recurring choices
- core_value: Deeply held beliefs or principles
- pattern: Recurring behavioral tendencies

## RULES
1. Extract ONLY durable insights (ignore one-off details)
2. Each insight should be 8-20 words
3. Assign a confidence score (0.5-1.0)
4. Include an optional subtype when helpful (e.g., "preference.food", "preference.activities")
5. Maximum 3 insights per person
6. Do NOT include names

## OUTPUT FORMAT
Return JSON in this structure:
{
  "userA": { "insights": [ { "text": "...", "type": "preference|core_value|pattern", "subtype": "string|null", "confidence": 0.5 } ] },
  "userB": { "insights": [ { "text": "...", "type": "preference|core_value|pattern", "subtype": "string|null", "confidence": 0.5 } ] }
}`;

const DAILY_QUESTION_JSON_SCHEMA = {
    name: 'daily_question_insights',
    strict: true,
    schema: {
        type: 'object',
        properties: {
            userA: {
                type: 'object',
                properties: {
                    insights: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                text: { type: 'string' },
                                type: { type: 'string', enum: ['preference', 'core_value', 'pattern'] },
                                subtype: { type: ['string', 'null'] },
                                confidence: { type: 'number', minimum: 0.5, maximum: 1.0 },
                            },
                            required: ['text', 'type', 'confidence'],
                            additionalProperties: false,
                        }
                    }
                },
                required: ['insights'],
                additionalProperties: false,
            },
            userB: {
                type: 'object',
                properties: {
                    insights: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                text: { type: 'string' },
                                type: { type: 'string', enum: ['preference', 'core_value', 'pattern'] },
                                subtype: { type: ['string', 'null'] },
                                confidence: { type: 'number', minimum: 0.5, maximum: 1.0 },
                            },
                            required: ['text', 'type', 'confidence'],
                            additionalProperties: false,
                        }
                    }
                },
                required: ['insights'],
                additionalProperties: false,
            }
        },
        required: ['userA', 'userB'],
        additionalProperties: false,
    },
};

/**
 * Build the user prompt for insight extraction
 * 
 * @param {object} caseData - The case data with submissions
 * @returns {string} The formatted prompt
 */
function buildExtractionPrompt(caseData) {
    const { participants, submissions, addendumHistory } = caseData;
    const defaultLanguage = normalizeLanguage(caseData?.language) || 'en';
    const userALanguage = normalizeLanguage(participants?.userA?.language) || defaultLanguage;
    const userBLanguage = normalizeLanguage(participants?.userB?.language) || defaultLanguage;
    const userALabel = getLanguageLabel(userALanguage);
    const userBLabel = getLanguageLabel(userBLanguage);
    const addendumLines = Array.isArray(addendumHistory) && addendumHistory.length > 0
        ? addendumHistory.map((entry, index) => {
            const fromLabel = entry.fromUser === 'userA'
                ? participants.userA.name
                : entry.fromUser === 'userB'
                    ? participants.userB.name
                    : 'A partner';
            return `${index + 1}. ${fromLabel}: "${entry.text}"`;
        }).join('\n')
        : 'No addendums filed.';

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

## Addendums
${addendumLines}

## Output Language
- Write User A insights in ${userALabel} (${userALanguage})
- Write User B insights in ${userBLabel} (${userBLanguage})
- Keep JSON keys and insight type values in English

Extract lasting psychological insights about each person that would be relevant for understanding future conflicts.`;
}

/**
 * Build the prompt for daily question insight extraction
 * 
 * @param {object} payload - Daily question payload
 * @returns {string} The formatted prompt
 */
function buildDailyQuestionPrompt(payload) {
    const userALanguage = normalizeLanguage(payload?.userALanguage) || 'en';
    const userBLanguage = normalizeLanguage(payload?.userBLanguage) || 'en';
    const userALabel = getLanguageLabel(userALanguage);
    const userBLabel = getLanguageLabel(userBLanguage);
    return `Extract durable insights from these daily question answers.

## Question
${payload.question}

## User A: ${payload.userAName}
Answer: "${payload.userAAnswer}"

## User B: ${payload.userBName}
Answer: "${payload.userBAnswer}"

${payload.category ? `Category: ${payload.category}` : ''}
${payload.emoji ? `Emoji: ${payload.emoji}` : ''}

## Output Language
- Write User A insights in ${userALabel} (${userALanguage})
- Write User B insights in ${userBLabel} (${userBLanguage})
- Keep JSON keys and insight type values in English`.trim();
}

/**
 * Call the extraction LLM (Grok 4.1 Fast via OpenRouter)
 * 
 * @param {string} systemPrompt - The system prompt
 * @param {string} userPrompt - The user prompt
 * @returns {Promise<object>} The extracted insights
 */
async function callExtractionLLM(systemPrompt, userPrompt, jsonSchema = null, configOverride = null) {
    if (!isOpenRouterConfigured()) {
        throw new Error('OPENROUTER_API_KEY is not configured for extraction agent.');
    }

    console.log('[Stenographer] Calling extraction LLM with reasoning enabled...');

    const config = configOverride || CONFIG;
    const response = await createChatCompletion({
        model: config.model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        jsonSchema,
    });

    let content = response.choices[0].message.content;

    // Strip markdown code block wrappers if present (e.g., ```json ... ```)
    if (content.includes('```')) {
        // Extract JSON from markdown code block
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            content = jsonMatch[1].trim();
        }
    }

    // Try to parse JSON, with fallback handling
    try {
        return JSON.parse(content);
    } catch (error) {
        try {
            return repairAndParseJSON(content);
        } catch (repairError) {
            console.error('[Stenographer] Failed to parse JSON response:', content);
            throw new Error('Failed to parse extraction response as JSON');
        }
    }
}


/**
 * De-duplicate and store insights for a single user
 * 
 * @param {string} userId - The user ID
 * @param {Array} insights - Array of extracted insights
 * @param {string|object} sourceCaseIdOrOptions - Case ID or options
 * @returns {Promise<object>} Stats about stored/reinforced insights
 */
async function processUserInsights(userId, insights, sourceCaseIdOrOptions) {
    const stats = {
        stored: 0,
        reinforced: 0,
        discarded: 0,
    };

    if (!insights || insights.length === 0) {
        return stats;
    }

    const options = (sourceCaseIdOrOptions && typeof sourceCaseIdOrOptions === 'object')
        ? sourceCaseIdOrOptions
        : { sourceCaseId: sourceCaseIdOrOptions };
    const sourceType = options.sourceType || (options.sourceCaseId ? 'case' : 'unknown');
    const sourceId = options.sourceId || options.sourceCaseId || null;
    const similarityThreshold = options.similarityThreshold || CONFIG.similarityThreshold;
    const observedAt = options.observedAt || new Date().toISOString();
    const language = normalizeLanguage(options.language) || 'en';

    // Generate embeddings for all insights in batch
    const insightTexts = insights.map(i => (typeof i?.text === 'string' ? i.text : ''));
    const embeddingsBatch = await embeddings.generateEmbeddings(insightTexts);

    for (let i = 0; i < insights.length; i++) {
        const insight = insights[i];
        if (!insight?.text) {
            stats.discarded++;
            continue;
        }
        const embedding = embeddingsBatch[i];

        try {
            // Search for similar existing memories
            const similar = await supabase.searchSimilarMemories(
                embedding,
                userId,
                similarityThreshold,
                1,
                language
            );

            const matchingType = similar.find(entry => entry.memory_type === insight.type);

            if (matchingType) {
                // Found a similar memory - reinforce it instead of duplicating
                await supabase.reinforceMemory(matchingType.id);
                stats.reinforced++;
                console.log(`[Stenographer] Reinforced existing memory: "${matchingType.memory_text.slice(0, 50)}..."`);
            } else {
                // No match - insert new memory
                await supabase.insertMemory({
                    userId,
                    memoryText: insight.text,
                    memoryType: insight.type,
                    memorySubtype: insight.subtype || null,
                    embedding,
                    sourceCaseId: options.sourceCaseId || null,
                    sourceType,
                    sourceId,
                    confidenceScore: insight.confidence || 0.8,
                    observedAt,
                    lastObservedAt: observedAt,
                    language,
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
    if (!supabase.isSupabaseConfigured()) {
        console.log('[Stenographer] Supabase not configured, skipping memory extraction');
        return {
            success: false,
            error: 'Supabase not configured',
            userA: { stored: 0, reinforced: 0, discarded: 0 },
            userB: { stored: 0, reinforced: 0, discarded: 0 },
        };
    }

    // Validate that case data has meaningful content to extract
    const { submissions } = caseData || {};
    const hasUserAContent = submissions?.userA?.cameraFacts?.trim() ||
        submissions?.userA?.theStoryIamTellingMyself?.trim();
    const hasUserBContent = submissions?.userB?.cameraFacts?.trim() ||
        submissions?.userB?.theStoryIamTellingMyself?.trim();

    if (!hasUserAContent && !hasUserBContent) {
        console.log('[Stenographer] No meaningful content to extract, skipping');
        return {
            success: true,
            skipped: true,
            reason: 'No meaningful content in submissions',
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

        const defaultLanguage = normalizeLanguage(caseData?.language) || 'en';
        const userALanguage = normalizeLanguage(caseData?.participants?.userA?.language) || defaultLanguage;
        const userBLanguage = normalizeLanguage(caseData?.participants?.userB?.language) || defaultLanguage;
        const [userAStats, userBStats] = await Promise.all([
            processUserInsights(userAId, extracted.userA?.insights || [], {
                sourceCaseId: caseId,
                language: userALanguage,
            }),
            processUserInsights(userBId, extracted.userB?.insights || [], {
                sourceCaseId: caseId,
                language: userBLanguage,
            }),
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
 * Extract and store insights from daily question answers
 * 
 * @param {object} payload - Daily question payload
 * @returns {Promise<object>} Extraction results
 */
async function extractAndStoreDailyQuestionInsights(payload) {
    console.log('[Stenographer] Starting daily question extraction:', payload?.assignmentId);

    if (!supabase.isSupabaseConfigured()) {
        console.log('[Stenographer] Supabase not configured, skipping daily question extraction');
        return {
            success: false,
            error: 'Supabase not configured',
            userA: { stored: 0, reinforced: 0, discarded: 0 },
            userB: { stored: 0, reinforced: 0, discarded: 0 },
        };
    }

    if (!payload?.userAAnswer || !payload?.userBAnswer) {
        return {
            success: true,
            skipped: true,
            reason: 'Missing answers',
            userA: { stored: 0, reinforced: 0, discarded: 0 },
            userB: { stored: 0, reinforced: 0, discarded: 0 },
        };
    }

    try {
        const prompt = buildDailyQuestionPrompt(payload);
        const extracted = await callExtractionLLM(
            DAILY_QUESTION_SYSTEM_PROMPT,
            prompt,
            DAILY_QUESTION_JSON_SCHEMA,
            DAILY_QUESTION_CONFIG
        );

        console.log('[Stenographer] Extracted daily question insights:', JSON.stringify(extracted, null, 2));

        const observedAt = payload.observedAt || new Date().toISOString();
        const sourceOptions = {
            sourceType: 'daily_question',
            sourceId: payload.assignmentId,
            similarityThreshold: DAILY_QUESTION_CONFIG.similarityThreshold,
            observedAt,
        };

        const [userAStats, userBStats] = await Promise.all([
            processUserInsights(payload.userAId, extracted.userA?.insights || [], {
                ...sourceOptions,
                language: payload?.userALanguage,
            }),
            processUserInsights(payload.userBId, extracted.userB?.insights || [], {
                ...sourceOptions,
                language: payload?.userBLanguage,
            }),
        ]);

        return {
            success: true,
            userA: userAStats,
            userB: userBStats,
            totalStored: userAStats.stored + userBStats.stored,
            totalReinforced: userAStats.reinforced + userBStats.reinforced,
        };
    } catch (error) {
        console.error('[Stenographer] Daily question extraction failed:', error);
        return {
            success: false,
            error: error.message,
            userA: { stored: 0, reinforced: 0, discarded: 0 },
            userB: { stored: 0, reinforced: 0, discarded: 0 },
        };
    }
}

/**
 * Trigger daily question extraction in the background (non-blocking)
 * 
 * @param {object} payload - Daily question payload
 */
function triggerDailyQuestionExtraction(payload) {
    setImmediate(async () => {
        try {
            await extractAndStoreDailyQuestionInsights(payload);
        } catch (error) {
            console.error('[Stenographer] Daily question background extraction failed:', error);
        }
    });
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
    extractAndStoreDailyQuestionInsights,
    triggerBackgroundExtraction,
    triggerDailyQuestionExtraction,
    processUserInsights,
    STENOGRAPHER_SYSTEM_PROMPT,
    DAILY_QUESTION_SYSTEM_PROMPT,
    buildExtractionPrompt,
    buildDailyQuestionPrompt,
    CONFIG,
};
