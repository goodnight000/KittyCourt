/**
 * Judge Engine Service
 * 
 * This is the core deliberation pipeline that processes couple disputes
 * through a multi-step LLM chain based on Gottman Method and NVC principles.
 * 
 * Now using OpenRouter with x-ai/grok-4.1-fast:free model
 * 
 * Pipeline Steps:
 * 1. Safety Guardrail (Moderation API)
 * 2. Memory Retrieval (RAG - fetch historical context)
 * 3. Analytical Phase (Psychological analysis, JSON mode)
 * 4. Verdict Generation (Judge Whiskers persona)
 * 5. Background Memory Extraction (Stenographer agent)
 */

const { isOpenRouterConfigured, createChatCompletion, createModeration } = require('./openrouter');
const { DeliberationInputSchema, AnalysisSchema, JudgeContentSchema } = require('./schemas');
const { ANALYSIS_JSON_SCHEMA, VERDICT_JSON_SCHEMA } = require('./jsonSchemas');
const {
    ANALYST_SYSTEM_PROMPT,
    JUDGE_SYSTEM_PROMPT,
    buildAnalystUserPrompt,
    buildJudgeUserPrompt,
} = require('./prompts');
const { retrieveHistoricalContext, formatContextForPrompt, hasHistoricalContext } = require('./memoryRetrieval');
const { triggerBackgroundExtraction } = require('./stenographer');
const { repairAndParseJSON } = require('./jsonRepair');

// Configuration - Using OpenRouter with fast model for quick verdicts
const CONFIG = {
    model: 'x-ai/grok-4.1-fast:free', // Grok's fast reasoning model via OpenRouter
    analysisTemperature: 0.5, // Lower temp for consistent clinical analysis
    verdictTemperature: 0.7,  // Higher temp for creative cat persona
    maxTokens: 10000,          // Sufficient for complete responses
    maxRetries: 2,            // Number of retries on failure
};

/**
 * Step 1: Safety Guardrail
 * Runs moderation check on user-submitted text to detect harmful content
 * 
 * @param {object} input - The validated deliberation input
 * @returns {Promise<{safe: boolean, flags?: string[]}>}
 */
async function runModerationCheck(input) {
    const textsToCheck = [
        input.submissions.userA.cameraFacts,
        input.submissions.userA.theStoryIamTellingMyself,
        input.submissions.userB.cameraFacts,
        input.submissions.userB.theStoryIamTellingMyself,
    ];

    const combinedText = textsToCheck.join('\n\n');

    try {
        const moderation = await createModeration(combinedText);
        const result = moderation.results[0];

        if (result.flagged) {
            // Extract which categories were flagged
            const flaggedCategories = Object.entries(result.categories)
                .filter(([_, flagged]) => flagged)
                .map(([category]) => category);

            // Check for severe flags that require intervention
            const severeFlags = ['self-harm', 'self-harm/intent', 'self-harm/instructions', 'violence/graphic'];
            const hasSevereFlag = flaggedCategories.some(cat => severeFlags.includes(cat));

            return {
                safe: !hasSevereFlag,
                flagged: true,
                categories: flaggedCategories,
                requiresCounseling: hasSevereFlag,
            };
        }

        return { safe: true, flagged: false };
    } catch (error) {
        console.error('Moderation check failed:', error);
        // Fail open but log the error - don't block legitimate requests
        return { safe: true, flagged: false, error: error.message };
    }
}

/**
 * Step 2: Analytical Phase
 * Sends inputs to LLM for deep psychological analysis
 * 
 * Uses JSON mode with schema for consistent structured output
 * Includes retry logic and JSON repair for reliability
 * 
 * @param {object} input - The validated deliberation input
 * @returns {Promise<object>} - Structured psychological analysis
 */
async function runAnalysis(input) {
    const userPrompt = buildAnalystUserPrompt(input);
    let lastError = null;

    for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
        try {
            console.log(`[Judge Engine] Analysis attempt ${attempt}/${CONFIG.maxRetries}`);

            const response = await createChatCompletion({
                model: CONFIG.model,
                messages: [
                    { role: 'system', content: ANALYST_SYSTEM_PROMPT },
                    { role: 'user', content: userPrompt },
                ],
                temperature: CONFIG.analysisTemperature,
                maxTokens: CONFIG.maxTokens,
                jsonSchema: ANALYSIS_JSON_SCHEMA,
            });

            const content = response.choices[0].message.content;
            console.log('[Judge Engine] Raw analysis response:', content.substring(0, 200) + '...');

            // Try to parse with repair capability
            let parsed;
            try {
                parsed = JSON.parse(content);
            } catch (parseError) {
                console.log('[Judge Engine] Direct parse failed, attempting repair...');
                parsed = repairAndParseJSON(content);
            }

            // Handle case where LLM returns fields directly without 'analysis' wrapper
            if (!parsed.analysis && (parsed.identifiedDynamic || parsed.userA_Horsemen)) {
                parsed = { analysis: parsed };
            }

            // Validate against schema (will be flexible for new fields)
            const validated = AnalysisSchema.parse(parsed);
            return validated;
        } catch (error) {
            console.error(`[Judge Engine] Analysis attempt ${attempt} failed:`, error.message);
            lastError = error;

            if (attempt < CONFIG.maxRetries) {
                console.log('[Judge Engine] Retrying analysis...');
                await new Promise(resolve => setTimeout(resolve, 1000)); // Brief delay before retry
            }
        }
    }

    throw new Error(`Analysis failed after ${CONFIG.maxRetries} attempts: ${lastError?.message}`);
}

/**
 * Step 3: Verdict Generation
 * Generates the Therapist Cat verdict with the new psychological framework
 * 
 * Uses JSON mode with schema for consistent structured output
 * Includes retry logic and JSON repair for reliability
 * 
 * @param {object} input - The validated deliberation input
 * @param {object} analysis - The psychological analysis from Step 2
 * @param {string} historicalContext - Optional formatted historical context from RAG
 * @returns {Promise<object>} - The complete verdict content
 */
async function generateVerdict(input, analysis, historicalContext = '') {
    const userPrompt = buildJudgeUserPrompt(input, analysis, historicalContext);
    let lastError = null;

    for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
        try {
            console.log(`[Judge Engine] Verdict attempt ${attempt}/${CONFIG.maxRetries}`);

            const response = await createChatCompletion({
                model: CONFIG.model,
                messages: [
                    { role: 'system', content: JUDGE_SYSTEM_PROMPT },
                    { role: 'user', content: userPrompt },
                ],
                temperature: CONFIG.verdictTemperature,
                maxTokens: CONFIG.maxTokens,
                jsonSchema: VERDICT_JSON_SCHEMA,
            });

            const content = response.choices[0].message.content;
            console.log('[Judge Engine] Raw verdict response:', content.substring(0, 200) + '...');

            // Try to parse with repair capability
            let parsed;
            try {
                parsed = JSON.parse(content);
            } catch (parseError) {
                console.log('[Judge Engine] Direct parse failed, attempting repair...');
                parsed = repairAndParseJSON(content);
            }

            // Validate and normalize the verdict using the schema transform
            const validated = JudgeContentSchema.parse(parsed);

            return validated;
        } catch (error) {
            console.error(`[Judge Engine] Verdict attempt ${attempt} failed:`, error.message);
            lastError = error;

            if (attempt < CONFIG.maxRetries) {
                console.log('[Judge Engine] Retrying verdict generation...');
                await new Promise(resolve => setTimeout(resolve, 1000)); // Brief delay before retry
            }
        }
    }

    // After all retries failed, return a graceful fallback verdict
    console.error(`[Judge Engine] All ${CONFIG.maxRetries} verdict attempts failed, using fallback`);
    return getFallbackVerdict(input, lastError);
}

/**
 * Generate a fallback verdict when LLM fails
 * Provides a valid verdict structure with honest messaging
 */
function getFallbackVerdict(input, error) {
    return {
        theSummary: "Judge Whiskers experienced some technical difficulties while processing your case. Both of your feelings are valid, and this conflict deserves proper attention. Please try submitting again in a moment.",
        theRuling_ThePurr: {
            userA: `${input.participants.userA.name}, your feelings about this situation are completely valid. Even though I couldn't fully analyze your case, I can tell this matters to you.`,
            userB: `${input.participants.userB.name}, your perspective is equally important. Technical issues prevented a full analysis, but your experience deserves to be heard.`
        },
        theRuling_TheHiss: [
            "Due to technical difficulties, no specific patterns could be identified. This is not a reflection of your conflict's validity."
        ],
        theSentence: {
            title: "The Patient Pause",
            description: "Take 5 minutes to sit together in comfortable silence. Hold hands if you feel comfortable. When ready, try submitting your case again.",
            rationale: "Sometimes the universe asks us to slow down and simply be present with each other before diving into solutions."
        },
        closingStatement: "Judge Whiskers apologizes for the interruption. Your case is important, and the court will be ready to give it proper attention shortly. In the meantime, remember: you're on the same team. 🐱💜",
        _meta: {
            fallback: true,
            error: error?.message
        }
    };
}

/**
 * Main Deliberation Pipeline
 * Orchestrates the full judge engine workflow
 * 
 * @param {object} rawInput - Raw input from the API request
 * @param {object} options - Optional configuration
 * @param {object} options.previousVerdict - Previous verdict for addendum flow
 * @param {string} options.addendumText - New information to consider
 * @param {string} options.addendumFrom - Who submitted the addendum (userA/userB)
 * @returns {Promise<object>} - Complete verdict response
 */
async function deliberate(rawInput, options = {}) {
    const startTime = Date.now();

    // Validate input
    let input;
    try {
        input = DeliberationInputSchema.parse(rawInput);
    } catch (error) {
        return {
            verdictId: generateVerdictId(),
            timestamp: new Date().toISOString(),
            status: 'error',
            error: `Invalid input: ${error.message}`,
        };
    }

    // Check if OpenRouter is configured
    if (!isOpenRouterConfigured()) {
        return {
            verdictId: generateVerdictId(),
            timestamp: new Date().toISOString(),
            status: 'error',
            error: 'Judge Whiskers is sleeping. OpenRouter API key not configured.',
        };
    }

    // If this is an addendum, augment the input
    if (options.addendumText) {
        const field = options.addendumFrom === 'userA' ? 'userA' : 'userB';
        input.submissions[field].cameraFacts += `\n\n[ADDENDUM]: ${options.addendumText}`;

        // Add context about the previous verdict
        if (options.previousVerdict) {
            input._previousContext = {
                previousSummary: options.previousVerdict.theSummary,
                previousRepair: options.previousVerdict.theSentence?.title,
                addendumNote: `${field === 'userA' ? input.participants.userA.name : input.participants.userB.name} has submitted additional context after the initial verdict.`
            };
        }
    }

    // Step 1: Moderation Check
    console.log('[Judge Engine] Step 1: Running moderation check...');
    const moderationResult = await runModerationCheck(input);

    if (moderationResult.requiresCounseling) {
        console.log('[Judge Engine] Moderation flagged severe content');
        return {
            verdictId: generateVerdictId(),
            timestamp: new Date().toISOString(),
            status: 'unsafe_counseling_recommended',
            error: 'The content submitted has been flagged for safety concerns. We recommend speaking with a professional counselor. If you or someone you know is in crisis, please contact a crisis helpline.',
            flaggedCategories: moderationResult.categories,
        };
    }

    // Step 2: Memory Retrieval (RAG Pipeline)
    console.log('[Judge Engine] Step 2: Retrieving historical context...');
    let historicalContext = null;
    let formattedContext = '';
    try {
        historicalContext = await retrieveHistoricalContext(input);
        if (hasHistoricalContext(historicalContext)) {
            formattedContext = formatContextForPrompt(historicalContext, input.participants);
            console.log('[Judge Engine] Historical context retrieved:', {
                profilesFound: Object.keys(historicalContext.profiles.userA).length > 0 ||
                    Object.keys(historicalContext.profiles.userB).length > 0,
                memoriesFound: historicalContext.memories.length,
            });
        } else {
            console.log('[Judge Engine] No historical context available');
        }
    } catch (error) {
        console.log('[Judge Engine] Memory retrieval failed (non-blocking):', error.message);
        // Continue without historical context - this is non-blocking
    }

    // Step 3: Analysis Phase
    console.log('[Judge Engine] Step 3: Running psychological analysis...');
    let analysis;
    try {
        analysis = await runAnalysis(input);
        console.log('[Judge Engine] Analysis complete:', JSON.stringify(analysis, null, 2));
    } catch (error) {
        return {
            verdictId: generateVerdictId(),
            timestamp: new Date().toISOString(),
            status: 'error',
            error: error.message,
        };
    }

    // Step 4: Verdict Generation
    console.log('[Judge Engine] Step 4: Generating verdict...');
    let judgeContent;
    try {
        judgeContent = await generateVerdict(input, analysis, formattedContext);
        console.log('[Judge Engine] Verdict generated successfully');
    } catch (error) {
        return {
            verdictId: generateVerdictId(),
            timestamp: new Date().toISOString(),
            status: 'error',
            error: error.message,
        };
    }

    const verdictId = generateVerdictId();
    const duration = Date.now() - startTime;
    console.log(`[Judge Engine] Pipeline completed in ${duration}ms`);

    // Step 5: Trigger background memory extraction (non-blocking)
    // This runs after the verdict is returned to the user
    console.log('[Judge Engine] Step 5: Triggering background memory extraction...');
    triggerBackgroundExtraction(input, verdictId);

    // Build final response
    return {
        verdictId,
        timestamp: new Date().toISOString(),
        status: 'success',
        judgeContent,
        isAddendum: !!options.addendumText,
        _meta: {
            analysis: analysis.analysis,
            moderationPassed: !moderationResult.flagged,
            processingTimeMs: duration,
            model: CONFIG.model,
            hasHistoricalContext: hasHistoricalContext(historicalContext),
            memoriesUsed: historicalContext?.memories?.length || 0,
        },
    };
}

/**
 * Generate a unique verdict ID
 */
function generateVerdictId() {
    // Use crypto.randomUUID if available, fallback to timestamp-based
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return `v_${crypto.randomUUID().slice(0, 8)}`;
    }
    return `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

module.exports = {
    deliberate,
    runModerationCheck,
    runAnalysis,
    generateVerdict,
    CONFIG,
};
