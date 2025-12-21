/**
 * Judge Engine Service v2.0
 * 
 * Multi-step therapeutic pipeline for couple conflict resolution:
 * 
 * NEW V2.0 PIPELINE:
 * 1. Safety Guardrail (Moderation API)
 * 2. Memory Retrieval (RAG - fetch historical context)
 * 3. Analyst + Repair Selection (intensity, dynamics, 3 resolutions)
 * 4. Priming + Joint Menu (individual content + shared content)
 * 5. Hybrid Resolution (if users pick different options)
 * 6. Background Memory Extraction (Stenographer agent)
 * 
 * LEGACY PIPELINE (still supported for backward compat):
 * 1. Moderation → 2. RAG → 3. Analysis → 4. Verdict
 */

const { isOpenRouterConfigured, createChatCompletion, createModeration } = require('./openrouter');
const {
    DeliberationInputSchema,
    AnalysisSchema,
    JudgeContentSchema,
    AnalystRepairOutputSchema,
    PrimingJointOutputSchema,
    HybridResolutionOutputSchema,
} = require('./schemas');
const {
    ANALYSIS_JSON_SCHEMA,
    VERDICT_JSON_SCHEMA,
    ANALYST_REPAIR_JSON_SCHEMA,
    PRIMING_JOINT_JSON_SCHEMA,
    HYBRID_RESOLUTION_JSON_SCHEMA,
} = require('./jsonSchemas');
const {
    // Legacy prompts
    ANALYST_SYSTEM_PROMPT,
    JUDGE_SYSTEM_PROMPT,
    buildAnalystUserPrompt,
    buildJudgeUserPrompt,
    // New v2.0 prompts
    ANALYST_REPAIR_SYSTEM_PROMPT,
    PRIMING_JOINT_SYSTEM_PROMPT,
    HYBRID_RESOLUTION_SYSTEM_PROMPT,
    buildAnalystRepairUserPrompt,
    buildPrimingJointUserPrompt,
    buildHybridResolutionUserPrompt,
} = require('./prompts');
const { retrieveHistoricalContext, formatContextForPrompt, hasHistoricalContext } = require('./memoryRetrieval');
const { triggerBackgroundExtraction } = require('./stenographer');
const { repairAndParseJSON } = require('./jsonRepair');

const DEBUG_LOGS = process.env.NODE_ENV !== 'production';

// Configuration
const CONFIG = {
    model: 'deepseek/deepseek-v3.2',
    analysisTemperature: 0.5,
    verdictTemperature: 0.7,
    maxTokens: 8000,
    maxRetries: 3,
};

// Judge types for verdict generation (user-selectable)
const JUDGE_MODELS = {
    best: 'anthropic/claude-opus-4.5',
    fast: 'deepseek/deepseek-v3.2',
    logical: 'google/gemini-3-flash-preview'
};

// Hybrid resolution always uses this fast model
const HYBRID_MODEL = 'x-ai/grok-4.1-fast';

// ============================================================================
// V2.0 PIPELINE FUNCTIONS
// ============================================================================

/**
 * V2.0 Step 1: Analyst + Repair Selection
 * 
 * Performs deep psychological analysis and selects 3 resolution options.
 * Uses user-selected model.
 * 
 * @param {object} input - Validated deliberation input
 * @param {string} historicalContext - Formatted RAG context
 * @param {string} judgeType - User-selected model type
 * @returns {Promise<object>} - Analysis with 3 resolutions
 */
async function runAnalystRepair(input, historicalContext = '', judgeType = 'logical') {
    const model = JUDGE_MODELS[judgeType] || CONFIG.model;
    const userPrompt = buildAnalystRepairUserPrompt(input, historicalContext);
    let lastError = null;

    for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
        try {
            console.log(`[Judge Engine v2] Analyst+Repair attempt ${attempt}/${CONFIG.maxRetries} using ${model}`);

            const response = await createChatCompletion({
                model,
                messages: [
                    { role: 'system', content: ANALYST_REPAIR_SYSTEM_PROMPT },
                    { role: 'user', content: userPrompt },
                ],
                temperature: CONFIG.analysisTemperature,
                maxTokens: CONFIG.maxTokens,
                jsonSchema: ANALYST_REPAIR_JSON_SCHEMA,
            });

            const content = response.choices[0].message.content;
            const finishReason = response.choices[0].finish_reason;

            console.log('[Judge Engine v2] Raw analyst response length:', content?.length);
            if (finishReason === 'length') {
                console.warn('[Judge Engine v2] WARNING: Response was truncated!');
            }

            let parsed;
            try {
                parsed = JSON.parse(content);
            } catch (parseError) {
                console.log('[Judge Engine v2] Direct parse failed, attempting repair...');
                parsed = repairAndParseJSON(content);
            }

            // Validate against v2.0 schema
            const validated = AnalystRepairOutputSchema.parse(parsed);

            console.log('[Judge Engine v2] Analyst+Repair complete:', {
                intensity: validated.assessedIntensity,
                resolutionCount: validated.resolutions?.length,
            });

            return validated;
        } catch (error) {
            console.error(`[Judge Engine v2] Analyst attempt ${attempt} failed:`, error.message);
            lastError = error;

            if (attempt < CONFIG.maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    throw new Error(`Analyst+Repair failed after ${CONFIG.maxRetries} attempts: ${lastError?.message}`);
}

/**
 * V2.0 Step 2: Priming + Joint Menu Generation
 * 
 * Generates individual priming content for both users AND joint menu content
 * in a single LLM call for efficiency.
 * 
 * @param {object} input - Validated deliberation input
 * @param {object} analysis - Output from runAnalystRepair
 * @param {string} historicalContext - Formatted RAG context
 * @param {string} judgeType - User-selected model type
 * @returns {Promise<object>} - Priming + Joint menu content
 */
async function runPrimingJoint(input, analysis, historicalContext = '', judgeType = 'logical') {
    const model = JUDGE_MODELS[judgeType] || CONFIG.model;
    const userPrompt = buildPrimingJointUserPrompt(
        input,
        analysis,
        analysis.resolutions,
        historicalContext
    );
    let lastError = null;

    for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
        try {
            console.log(`[Judge Engine v2] Priming+Joint attempt ${attempt}/${CONFIG.maxRetries} using ${model}`);

            const response = await createChatCompletion({
                model,
                messages: [
                    { role: 'system', content: PRIMING_JOINT_SYSTEM_PROMPT },
                    { role: 'user', content: userPrompt },
                ],
                temperature: CONFIG.verdictTemperature,
                maxTokens: CONFIG.maxTokens,
                jsonSchema: PRIMING_JOINT_JSON_SCHEMA,
            });

            const content = response.choices[0].message.content;

            let parsed;
            try {
                parsed = JSON.parse(content);
            } catch (parseError) {
                console.log('[Judge Engine v2] Direct parse failed, attempting repair...');
                parsed = repairAndParseJSON(content);
            }

            const validated = PrimingJointOutputSchema.parse(parsed);

            console.log('[Judge Engine v2] Priming+Joint complete:', {
                voiceUsed: validated.voiceUsed,
                hasUserAPriming: !!validated.individualPriming?.userA,
                hasUserBPriming: !!validated.individualPriming?.userB,
                hasJointMenu: !!validated.jointMenu,
            });

            return validated;
        } catch (error) {
            console.error(`[Judge Engine v2] Priming+Joint attempt ${attempt} failed:`, error.message);
            lastError = error;

            if (attempt < CONFIG.maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    throw new Error(`Priming+Joint failed after ${CONFIG.maxRetries} attempts: ${lastError?.message}`);
}

/**
 * V2.0 Step 3: Hybrid Resolution Generation
 * 
 * Called ONLY when users pick different resolution options.
 * Creates a hybrid that honors both choices.
 * 
 * ALWAYS uses x-ai/grok-4.1-fast for speed.
 * 
 * @param {object} input - Validated deliberation input
 * @param {object} analysis - Output from runAnalystRepair
 * @param {object} userAChoice - Resolution chosen by User A
 * @param {object} userBChoice - Resolution chosen by User B
 * @param {string} historicalContext - Formatted RAG context
 * @returns {Promise<object>} - Hybrid resolution
 */
async function runHybridResolution(input, analysis, userAChoice, userBChoice, historicalContext = '') {
    const userPrompt = buildHybridResolutionUserPrompt(
        input,
        analysis,
        userAChoice,
        userBChoice,
        historicalContext
    );
    let lastError = null;

    for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
        try {
            console.log(`[Judge Engine v2] Hybrid attempt ${attempt}/${CONFIG.maxRetries} using ${HYBRID_MODEL}`);

            const response = await createChatCompletion({
                model: HYBRID_MODEL,
                messages: [
                    { role: 'system', content: HYBRID_RESOLUTION_SYSTEM_PROMPT },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.5,
                maxTokens: 2000,
                jsonSchema: HYBRID_RESOLUTION_JSON_SCHEMA,
            });

            const content = response.choices[0].message.content;

            let parsed;
            try {
                parsed = JSON.parse(content);
            } catch (parseError) {
                console.log('[Judge Engine v2] Direct parse failed, attempting repair...');
                parsed = repairAndParseJSON(content);
            }

            const validated = HybridResolutionOutputSchema.parse(parsed);

            console.log('[Judge Engine v2] Hybrid resolution generated:', validated.hybridResolution?.title);

            return validated;
        } catch (error) {
            console.error(`[Judge Engine v2] Hybrid attempt ${attempt} failed:`, error.message);
            lastError = error;

            if (attempt < CONFIG.maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    }

    throw new Error(`Hybrid resolution failed after ${CONFIG.maxRetries} attempts: ${lastError?.message}`);
}

/**
 * V2.0 Full Pipeline - Phase 1
 * 
 * Runs moderation, RAG retrieval, and analyst+repair selection.
 * Returns analysis and 3 resolution options.
 * 
 * @param {object} rawInput - Raw input from API
 * @param {object} options - { judgeType, userReportedIntensity }
 * @returns {Promise<object>} - { analysis, resolutions, historicalContext }
 */
async function deliberatePhase1(rawInput, options = {}) {
    const startTime = Date.now();

    // Validate input
    let input;
    try {
        input = DeliberationInputSchema.parse(rawInput);
    } catch (error) {
        throw new Error(`Invalid input: ${error.message}`);
    }

    if (!isOpenRouterConfigured()) {
        throw new Error('OpenRouter API key not configured');
    }

    // Inject user-reported intensity if provided
    if (options.userReportedIntensity) {
        input.userReportedIntensity = options.userReportedIntensity;
    }

    // Step 1: Moderation
    console.log('[Judge Engine v2] Running moderation...');
    const modResult = await runModerationCheck(input);
    if (modResult.requiresCounseling) {
        throw new Error('Content flagged for safety. Counseling recommended.');
    }

    // Step 2: RAG
    console.log('[Judge Engine v2] Retrieving historical context...');
    let historicalContext = null;
    let formattedContext = '';
    try {
        historicalContext = await retrieveHistoricalContext(input);
        if (hasHistoricalContext(historicalContext)) {
            formattedContext = formatContextForPrompt(historicalContext, input.participants);
        }
    } catch (error) {
        console.log('[Judge Engine v2] RAG failed (non-blocking):', error.message);
    }

    // Step 3: Analyst + Repair
    console.log('[Judge Engine v2] Running analyst + repair selection...');
    const judgeType = options.judgeType || 'logical';
    const analysisResult = await runAnalystRepair(input, formattedContext, judgeType);

    const duration = Date.now() - startTime;
    console.log(`[Judge Engine v2] Phase 1 complete in ${duration}ms`);

    return {
        input,
        analysis: analysisResult,
        resolutions: analysisResult.resolutions,
        assessedIntensity: analysisResult.assessedIntensity,
        historicalContext: formattedContext,
        _meta: {
            processingTimeMs: duration,
            judgeType,
            model: JUDGE_MODELS[judgeType] || CONFIG.model,
        },
    };
}

/**
 * V2.0 Full Pipeline - Phase 2
 * 
 * Generates priming and joint menu content.
 * 
 * @param {object} phase1Result - Output from deliberatePhase1
 * @param {object} options - { judgeType }
 * @returns {Promise<object>} - { primingContent, jointMenu }
 */
async function deliberatePhase2(phase1Result, options = {}) {
    const startTime = Date.now();
    const judgeType = options.judgeType || 'logical';

    const result = await runPrimingJoint(
        phase1Result.input,
        phase1Result.analysis,
        phase1Result.historicalContext,
        judgeType
    );

    const duration = Date.now() - startTime;
    console.log(`[Judge Engine v2] Phase 2 complete in ${duration}ms`);

    return {
        voiceUsed: result.voiceUsed,
        primingContent: result.individualPriming,
        jointMenu: result.jointMenu,
        _meta: {
            processingTimeMs: duration,
        },
    };
}

// ============================================================================
// LEGACY PIPELINE FUNCTIONS (for backward compatibility)
// ============================================================================

/**
 * Step 1: Safety Guardrail
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
            const flaggedCategories = Object.entries(result.categories)
                .filter(([_, flagged]) => flagged)
                .map(([category]) => category);

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
        return { safe: true, flagged: false, error: error.message };
    }
}

/**
 * Legacy Step 2: Analysis (backward compat)
 */
async function runAnalysis(input, analysisModel) {
    const userPrompt = buildAnalystUserPrompt(input);
    let lastError = null;

    for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
        try {
            console.log(`[Judge Engine] Analysis attempt ${attempt}/${CONFIG.maxRetries}`);

            const response = await createChatCompletion({
                model: analysisModel,
                messages: [
                    { role: 'system', content: ANALYST_SYSTEM_PROMPT },
                    { role: 'user', content: userPrompt },
                ],
                temperature: CONFIG.analysisTemperature,
                maxTokens: CONFIG.maxTokens,
                jsonSchema: ANALYSIS_JSON_SCHEMA,
            });

            const content = response.choices[0].message.content;

            let parsed;
            try {
                parsed = JSON.parse(content);
            } catch (parseError) {
                parsed = repairAndParseJSON(content);
            }

            if (!parsed.analysis && (parsed.identifiedDynamic || parsed.userA_Horsemen)) {
                parsed = { analysis: parsed };
            }

            const validated = AnalysisSchema.parse(parsed);
            return validated;
        } catch (error) {
            console.error(`[Judge Engine] Analysis attempt ${attempt} failed:`, error.message);
            lastError = error;

            if (attempt < CONFIG.maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    throw new Error(`Analysis failed after ${CONFIG.maxRetries} attempts: ${lastError?.message}`);
}

/**
 * Legacy Step 3: Verdict Generation (backward compat)
 */
async function generateVerdict(input, analysis, historicalContext = '', judgeType = 'logical') {
    const userPrompt = buildJudgeUserPrompt(input, analysis, historicalContext);
    const verdictModel = JUDGE_MODELS[judgeType] || JUDGE_MODELS.logical;
    let lastError = null;

    for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
        try {
            const response = await createChatCompletion({
                model: verdictModel,
                messages: [
                    { role: 'system', content: JUDGE_SYSTEM_PROMPT },
                    { role: 'user', content: userPrompt },
                ],
                temperature: CONFIG.verdictTemperature,
                maxTokens: CONFIG.maxTokens,
                jsonSchema: VERDICT_JSON_SCHEMA,
            });

            if (!response?.choices?.[0]?.message?.content) {
                throw new Error('OpenRouter returned unexpected response structure');
            }

            const content = response.choices[0].message.content;

            let parsed;
            try {
                parsed = JSON.parse(content);
            } catch (parseError) {
                parsed = repairAndParseJSON(content);
            }

            const validated = JudgeContentSchema.parse(parsed);
            return validated;
        } catch (error) {
            console.error(`[Judge Engine] Verdict attempt ${attempt} failed:`, error.message);
            lastError = error;

            if (attempt < CONFIG.maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    return getFallbackVerdict(input, lastError);
}

/**
 * Generate a fallback verdict when LLM fails
 */
function getFallbackVerdict(input, error) {
    return {
        theSummary: "Judge Whiskers experienced technical difficulties. Both of your feelings are valid. Please try again.",
        theRuling_ThePurr: {
            userA: `${input.participants.userA.name}, your feelings are valid.`,
            userB: `${input.participants.userB.name}, your perspective is important.`
        },
        theRuling_TheHiss: [
            "Technical issues prevented pattern identification."
        ],
        theSentence: {
            title: "The Patient Pause",
            description: "Take 5 minutes to sit together. Hold hands. Try again.",
            rationale: "Sometimes we need to slow down."
        },
        closingStatement: "Judge Whiskers apologizes. Your case is important. 🐱💜",
        _meta: { fallback: true, error: error?.message }
    };
}

/**
 * Legacy Main Pipeline (backward compat)
 */
async function deliberate(rawInput, options = {}) {
    const startTime = Date.now();

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

    if (!isOpenRouterConfigured()) {
        return {
            verdictId: generateVerdictId(),
            timestamp: new Date().toISOString(),
            status: 'error',
            error: 'OpenRouter API key not configured.',
        };
    }

    if (options.addendumText) {
        const field = options.addendumFrom === 'userA' ? 'userA' : 'userB';
        input.submissions[field].cameraFacts += `\n\n[ADDENDUM]: ${options.addendumText}`;
    }

    // Moderation
    const moderationResult = await runModerationCheck(input);
    if (moderationResult.requiresCounseling) {
        return {
            verdictId: generateVerdictId(),
            timestamp: new Date().toISOString(),
            status: 'unsafe_counseling_recommended',
            error: 'Content flagged for safety. Counseling recommended.',
            flaggedCategories: moderationResult.categories,
        };
    }

    // RAG
    let formattedContext = '';
    try {
        const historicalContext = await retrieveHistoricalContext(input);
        if (hasHistoricalContext(historicalContext)) {
            formattedContext = formatContextForPrompt(historicalContext, input.participants);
        }
    } catch (error) {
        console.log('[Judge Engine] RAG failed:', error.message);
    }

    // Analysis
    const judgeType = options.judgeType || 'logical';
    const analysisModel = JUDGE_MODELS[judgeType] || CONFIG.model;
    let analysis;
    try {
        analysis = await runAnalysis(input, analysisModel);
    } catch (error) {
        return {
            verdictId: generateVerdictId(),
            timestamp: new Date().toISOString(),
            status: 'error',
            error: error.message,
        };
    }

    // Verdict
    let judgeContent;
    try {
        judgeContent = await generateVerdict(input, analysis, formattedContext, judgeType);
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

    // Background extraction
    triggerBackgroundExtraction(input, verdictId);

    return {
        verdictId,
        timestamp: new Date().toISOString(),
        status: 'success',
        judgeContent,
        isAddendum: !!options.addendumText,
        _meta: {
            analysis: analysis.analysis,
            processingTimeMs: duration,
            judgeType,
        },
    };
}

function generateVerdictId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return `v_${crypto.randomUUID().slice(0, 8)}`;
    }
    return `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

module.exports = {
    // V2.0 pipeline functions
    runAnalystRepair,
    runPrimingJoint,
    runHybridResolution,
    deliberatePhase1,
    deliberatePhase2,

    // Legacy functions (backward compat)
    deliberate,
    runModerationCheck,
    runAnalysis,
    generateVerdict,

    // Config
    CONFIG,
    JUDGE_MODELS,
    HYBRID_MODEL,
};
