/**
 * Judge Engine Service
 * 
 * This is the core deliberation pipeline that processes couple disputes
 * through a multi-step LLM chain based on Gottman Method and NVC principles.
 * 
 * Pipeline Steps:
 * 1. Safety Guardrail (Moderation API)
 * 2. Analytical Phase (Psychological analysis, JSON mode)
 * 3. Verdict Generation (Judge Mittens persona)
 */

const { getOpenAI, isOpenAIConfigured } = require('./openai');
const { DeliberationInputSchema, AnalysisSchema, JudgeContentSchema } = require('./schemas');
const {
    ANALYST_SYSTEM_PROMPT,
    JUDGE_SYSTEM_PROMPT,
    buildAnalystUserPrompt,
    buildJudgeUserPrompt,
} = require('./prompts');

// Configuration
const CONFIG = {
    analysisModel: 'gpt-4.1',
    verdictModel: 'gpt-4.1',
    temperature: 0.7,
    maxTokens: 2000,
};

/**
 * Step 1: Safety Guardrail
 * Runs moderation check on user-submitted text to detect harmful content
 * 
 * @param {object} input - The validated deliberation input
 * @returns {Promise<{safe: boolean, flags?: string[]}>}
 */
async function runModerationCheck(input) {
    const openai = getOpenAI();
    const textsToCheck = [
        input.submissions.userA.cameraFacts,
        input.submissions.userA.theStoryIamTellingMyself,
        input.submissions.userB.cameraFacts,
        input.submissions.userB.theStoryIamTellingMyself,
    ];

    const combinedText = textsToCheck.join('\n\n');

    try {
        const moderation = await openai.moderations.create({
            input: combinedText,
        });

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
 * NEW FRAMEWORK: Identifies relationship dynamics, Four Horsemen,
 * vulnerable emotions, and conflict intensity.
 * 
 * @param {object} input - The validated deliberation input
 * @returns {Promise<object>} - Structured psychological analysis
 */
async function runAnalysis(input) {
    const openai = getOpenAI();
    const userPrompt = buildAnalystUserPrompt(input);

    try {
        const response = await openai.chat.completions.create({
            model: CONFIG.analysisModel,
            messages: [
                { role: 'system', content: ANALYST_SYSTEM_PROMPT },
                { role: 'user', content: userPrompt },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.5, // Lower temp for consistent clinical analysis
            max_tokens: 1500, // Increased for deeper analysis
        });

        const content = response.choices[0].message.content;
        console.log('[Judge Engine] Raw analysis response:', content);
        
        let parsed = JSON.parse(content);
        
        // Handle case where LLM returns fields directly without 'analysis' wrapper
        if (!parsed.analysis && (parsed.identifiedDynamic || parsed.userA_Horsemen)) {
            parsed = { analysis: parsed };
        }

        // Validate against schema (will be flexible for new fields)
        const validated = AnalysisSchema.parse(parsed);
        return validated;
    } catch (error) {
        console.error('Analysis phase failed:', error);
        throw new Error(`Analysis failed: ${error.message}`);
    }
}

/**
 * Step 3: Verdict Generation
 * Generates the Therapist Cat verdict with the new psychological framework
 * 
 * NEW FRAMEWORK: 
 * - theSummary (Translation of the real dynamic)
 * - theRuling_ThePurr (Deep validation)
 * - theRuling_TheHiss (Behavioral accountability, not blame)
 * - theSentence (Targeted repair matched to wound type)
 * 
 * @param {object} input - The validated deliberation input
 * @param {object} analysis - The psychological analysis from Step 2
 * @returns {Promise<object>} - The complete verdict content
 */
async function generateVerdict(input, analysis) {
    const openai = getOpenAI();
    const userPrompt = buildJudgeUserPrompt(input, analysis);

    try {
        const response = await openai.chat.completions.create({
            model: CONFIG.verdictModel,
            messages: [
                { role: 'system', content: JUDGE_SYSTEM_PROMPT },
                { role: 'user', content: userPrompt },
            ],
            response_format: { type: 'json_object' },
            temperature: CONFIG.temperature,
            max_tokens: CONFIG.maxTokens,
        });

        const content = response.choices[0].message.content;
        const parsed = JSON.parse(content);
        
        // Validate and normalize the verdict using the schema transform
        const validated = JudgeContentSchema.parse(parsed);

        return validated;
    } catch (error) {
        console.error('Verdict generation failed:', error);
        throw new Error(`Verdict generation failed: ${error.message}`);
    }
}

/**
 * Main Deliberation Pipeline
 * Orchestrates the full judge engine workflow
 * 
 * @param {object} rawInput - Raw input from the API request
 * @returns {Promise<object>} - Complete verdict response
 */
async function deliberate(rawInput) {
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

    // Step 2: Analysis Phase
    console.log('[Judge Engine] Step 2: Running psychological analysis...');
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

    // Step 3: Verdict Generation
    console.log('[Judge Engine] Step 3: Generating verdict...');
    let judgeContent;
    try {
        judgeContent = await generateVerdict(input, analysis);
        console.log('[Judge Engine] Verdict generated successfully');
    } catch (error) {
        return {
            verdictId: generateVerdictId(),
            timestamp: new Date().toISOString(),
            status: 'error',
            error: error.message,
        };
    }

    const duration = Date.now() - startTime;
    console.log(`[Judge Engine] Pipeline completed in ${duration}ms`);

    // Build final response
    return {
        verdictId: generateVerdictId(),
        timestamp: new Date().toISOString(),
        status: 'success',
        judgeContent,
        _meta: {
            analysis: analysis.analysis,
            moderationPassed: !moderationResult.flagged,
            processingTimeMs: duration,
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
