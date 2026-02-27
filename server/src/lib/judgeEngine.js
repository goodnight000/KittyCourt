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
 */

const { isOpenRouterConfigured, createChatCompletion, createModeration } = require('./openrouter');
const {
    DeliberationInputSchema,
    AnalystRepairOutputSchema,
    PrimingJointOutputSchema,
    HybridResolutionOutputSchema,
} = require('./schemas');
const {
    ANALYST_REPAIR_JSON_SCHEMA,
    PRIMING_JOINT_JSON_SCHEMA,
    HYBRID_RESOLUTION_JSON_SCHEMA,
} = require('./jsonSchemas');
const {
    // New v2.0 prompts
    ANALYST_REPAIR_SYSTEM_PROMPT,
    PRIMING_JOINT_SYSTEM_PROMPT,
    HYBRID_RESOLUTION_SYSTEM_PROMPT,
    buildAnalystRepairUserPrompt,
    buildPrimingJointUserPrompt,
    buildHybridResolutionUserPrompt,
} = require('./prompts');
const { retrieveHistoricalContext, formatContextForPrompt, hasHistoricalContext } = require('./memoryRetrieval');
const { callLLMWithRetry } = require('./shared/llmRetryHandler');
const { validateOutput, shouldBlockOutput } = require('./security/outputValidator');
const { createUsageTelemetryRecorder } = require('./abuse/abuseRepository');

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
// - classic (Mochi): DeepSeek - thoughtful, methodical reasoning
// - swift (Dash): Gemini - fast AND brilliant
// - wise (Whiskers): Gemini 3.1 Pro - deepest emotional intelligence
const JUDGE_MODELS = {
    wise: 'google/gemini-3.1-pro-preview',
    classic: 'deepseek/deepseek-v3.2',
    swift: 'google/gemini-3-flash-preview'
};

// Hybrid resolution always uses this fast model
const HYBRID_MODEL = 'x-ai/grok-4.1-fast';

function buildJudgeTelemetryOptions(input, judgeType, pipelineStep, model) {
    const userId = input?.participants?.userA?.id || null;
    return {
        onTelemetry: createUsageTelemetryRecorder({
            userId,
            feature: 'court_verdict',
            judgeType,
            pipelineStep,
        }),
        telemetryContext: {
            endpoint: 'court.verdict',
            judgeType,
            pipelineStep,
            model,
        },
    };
}

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
async function runAnalystRepair(input, historicalContext = '', judgeType = 'swift') {
    const model = JUDGE_MODELS[judgeType] || CONFIG.model;
    const userPrompt = buildAnalystRepairUserPrompt(input, historicalContext);
    const telemetryOptions = buildJudgeTelemetryOptions(input, judgeType, 'analyst_repair', model);

    const result = await callLLMWithRetry(
        {
            llmFunction: () => createChatCompletion({
                model,
                messages: [
                    { role: 'system', content: ANALYST_REPAIR_SYSTEM_PROMPT },
                    { role: 'user', content: userPrompt },
                ],
                temperature: CONFIG.analysisTemperature,
                maxTokens: CONFIG.maxTokens,
                jsonSchema: ANALYST_REPAIR_JSON_SCHEMA,
                ...telemetryOptions,
            }),
            schema: AnalystRepairOutputSchema,
        },
        {
            maxRetries: CONFIG.maxRetries,
            baseDelayMs: 1000,
            operationName: `Analyst+Repair (${model})`,
            onSuccess: (validated) => {
                console.log('[Judge Engine v2] Analyst+Repair complete:', {
                    intensity: validated.assessedIntensity,
                    resolutionCount: validated.resolutions?.length,
                });
            },
        }
    );

    // Validate LLM output for compromise indicators
    if (shouldBlockOutput(result)) {
        console.error('[Judge Engine] Blocking compromised Analyst+Repair output');
        throw new Error('Generated content failed safety validation');
    }

    const validationResult = validateOutput(result, {
        type: 'analysis',
        sanitize: true,
    });

    if (!validationResult.valid) {
        console.warn('[Judge Engine] Analyst+Repair output validation issues:', {
            issues: validationResult.issues,
        });
    }

    return validationResult.sanitizedOutput || result;
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
async function runPrimingJoint(input, analysis, historicalContext = '', judgeType = 'swift') {
    const model = JUDGE_MODELS[judgeType] || CONFIG.model;
    const userPrompt = buildPrimingJointUserPrompt(
        input,
        analysis,
        analysis.resolutions,
        historicalContext
    );
    const telemetryOptions = buildJudgeTelemetryOptions(input, judgeType, 'priming_joint', model);

    const result = await callLLMWithRetry(
        {
            llmFunction: () => createChatCompletion({
                model,
                messages: [
                    { role: 'system', content: PRIMING_JOINT_SYSTEM_PROMPT },
                    { role: 'user', content: userPrompt },
                ],
                temperature: CONFIG.verdictTemperature,
                maxTokens: CONFIG.maxTokens,
                jsonSchema: PRIMING_JOINT_JSON_SCHEMA,
                ...telemetryOptions,
            }),
            schema: PrimingJointOutputSchema,
        },
        {
            maxRetries: CONFIG.maxRetries,
            baseDelayMs: 1000,
            operationName: `Priming+Joint (${model})`,
            onSuccess: (validated) => {
                console.log('[Judge Engine v2] Priming+Joint complete:', {
                    voiceUsed: validated.voiceUsed,
                    hasUserAPriming: !!validated.individualPriming?.userA,
                    hasUserBPriming: !!validated.individualPriming?.userB,
                    hasJointMenu: !!validated.jointMenu,
                });
            },
        }
    );

    // Validate LLM output for compromise indicators
    if (shouldBlockOutput(result)) {
        console.error('[Judge Engine] Blocking compromised Priming+Joint output');
        throw new Error('Generated content failed safety validation');
    }

    // Use 'verdict' type since this contains user-facing therapeutic content
    const validationResult = validateOutput(result, {
        type: 'verdict',
        sanitize: true,
    });

    if (!validationResult.valid) {
        console.warn('[Judge Engine] Priming+Joint output validation issues:', {
            issues: validationResult.issues,
        });
    }

    return validationResult.sanitizedOutput || result;
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
    const telemetryOptions = buildJudgeTelemetryOptions(input, 'hybrid', 'hybrid_resolution', HYBRID_MODEL);

    const result = await callLLMWithRetry(
        {
            llmFunction: () => createChatCompletion({
                model: HYBRID_MODEL,
                messages: [
                    { role: 'system', content: HYBRID_RESOLUTION_SYSTEM_PROMPT },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.5,
                maxTokens: 2000,
                jsonSchema: HYBRID_RESOLUTION_JSON_SCHEMA,
                ...telemetryOptions,
            }),
            schema: HybridResolutionOutputSchema,
        },
        {
            maxRetries: CONFIG.maxRetries,
            baseDelayMs: 500,
            operationName: `Hybrid Resolution (${HYBRID_MODEL})`,
            onSuccess: (validated) => {
                console.log('[Judge Engine v2] Hybrid resolution generated:', validated.hybridResolution?.title);
            },
        }
    );

    // Validate LLM output for compromise indicators
    if (shouldBlockOutput(result)) {
        console.error('[Judge Engine] Blocking compromised Hybrid Resolution output');
        throw new Error('Generated content failed safety validation');
    }

    // Use 'verdict' type since this is resolution content shown to users
    const validationResult = validateOutput(result, {
        type: 'verdict',
        sanitize: true,
    });

    if (!validationResult.valid) {
        console.warn('[Judge Engine] Hybrid Resolution output validation issues:', {
            issues: validationResult.issues,
        });
    }

    return validationResult.sanitizedOutput || result;
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
    if (options.language && !input.language) {
        input.language = options.language;
    }

    // Step 1 + 2: Moderation and RAG can run in parallel
    console.log('[Judge Engine v2] Running moderation + context retrieval...');
    const ragPromise = retrieveHistoricalContext(input).catch((error) => {
        console.log('[Judge Engine v2] RAG failed (non-blocking):', error.message);
        return null;
    });
    const [modResult, historicalContext] = await Promise.all([
        runModerationCheck(input),
        ragPromise,
    ]);

    if (modResult.requiresCounseling) {
        throw new Error('Content flagged for safety. Counseling recommended.');
    }

    let formattedContext = '';
    if (hasHistoricalContext(historicalContext)) {
        formattedContext = formatContextForPrompt(historicalContext, input.participants);
    }

    // Step 3: Analyst + Repair
    console.log('[Judge Engine v2] Running analyst + repair selection...');
    const judgeType = options.judgeType || 'swift';
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
    const judgeType = options.judgeType || 'swift';

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

module.exports = {
    // V2.0 pipeline functions
    runAnalystRepair,
    runPrimingJoint,
    runHybridResolution,
    deliberatePhase1,
    deliberatePhase2,
    runModerationCheck,

    // Config
    CONFIG,
    JUDGE_MODELS,
    HYBRID_MODEL,
};
