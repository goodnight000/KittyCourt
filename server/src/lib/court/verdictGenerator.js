/**
 * Verdict Generator - Court Session Helper
 * 
 * Handles the V2.0 LLM pipeline for generating verdicts:
 * - Phase 1: Analyst + Repair Selection
 * - Phase 2: Priming + Joint Menu
 */

const { PHASE } = require('./stateSerializer');
const { TIMEOUT } = require('./timeoutHandlers');

/**
 * Map judge type to usage tracking type
 */
function mapJudgeTypeToUsage(judgeType) {
    if (judgeType === 'fast') return 'lightning';
    if (judgeType === 'best') return 'whiskers';
    return 'mittens';
}

/**
 * Run the V2.0 verdict generation pipeline
 * 
 * @param {Object} session - Session object (mutated in place)
 * @param {Object} deps - Dependencies
 * @param {Object} deps.judgeEngine - LLM engine with deliberatePhase1/Phase2
 * @param {Function} deps.canUseFeature - Subscription limit checker
 * @param {Function} deps.incrementUsage - Usage tracker
 * @param {Function} deps.buildCaseData - Builds case data from session
 * @param {Function} deps.dbCheckpoint - Persists session state
 * @param {Function} deps.notifyBoth - Notifies both users
 * @param {Function} deps.setAnalyzingTimeout - Sets analyzing phase timeout
 * @param {Function} deps.setPrimingTimeout - Sets priming phase timeout
 * @param {Function} deps.clearTimeout - Clears existing timeout
 */
async function runVerdictPipeline(session, deps) {
    const {
        judgeEngine,
        canUseFeature,
        incrementUsage,
        buildCaseData,
        dbCheckpoint,
        notifyBoth,
        setAnalyzingTimeout,
        setPrimingTimeout,
        clearTimeout: clearTimeoutFn
    } = deps;

    // Check judge engine availability
    if (!judgeEngine) {
        console.error('[Court] No judge engine configured');
        session.verdict = { status: 'error', error: 'Judge engine unavailable. Please restart the server.' };
        session.resolvedAt = Date.now();
        session.phase = PHASE.VERDICT;
        await dbCheckpoint(session, 'engine_unavailable');
        notifyBoth(session);
        return;
    }

    try {
        console.log(`[Court] Starting v2.0 pipeline for session ${session.id}`);

        // Clear stale timers
        if (session.timeoutId) {
            clearTimeoutFn(session.timeoutId);
            session.timeoutId = null;
        }

        const caseData = buildCaseData(session);
        const usageType = mapJudgeTypeToUsage(session.judgeType || 'logical');

        // Enforce subscription limits
        try {
            const usage = await canUseFeature({ userId: session.creatorId, type: usageType });
            if (!usage.allowed) {
                console.warn(`[Court] Usage limit reached for session ${session.id}`);
                session.verdict = { status: 'error', error: 'Usage limit reached. Please upgrade to continue.', usage };
                session.resolvedAt = Date.now();
                session.phase = PHASE.VERDICT;
                await dbCheckpoint(session, 'usage_blocked');
                notifyBoth(session);
                return;
            }
        } catch (e) {
            console.warn('[Court] Failed to verify usage limits:', e?.message || e);
        }

        // Check V2.0 pipeline availability
        const canUseV2 = typeof judgeEngine?.deliberatePhase1 === 'function'
            && typeof judgeEngine?.deliberatePhase2 === 'function';

        if (!canUseV2) {
            console.error('[Court] V2.0 pipeline unavailable');
            session.verdict = { status: 'error', error: 'V2 pipeline unavailable. Please restart the server.' };
            session.resolvedAt = Date.now();
            session.phase = PHASE.VERDICT;
            await dbCheckpoint(session, 'pipeline_unavailable');
            notifyBoth(session);
            return;
        }

        // V2.0 Pipeline: Phase 1 - Analyst + Repair Selection
        session.phase = PHASE.ANALYZING;
        notifyBoth(session);

        // Safety timeout for long-running analysis
        session.timeoutId = setAnalyzingTimeout(session.coupleId);

        console.log(`[Court] V2.0 Phase 1: Analyst + Repair for session ${session.id}`);
        const phase1Result = await judgeEngine.deliberatePhase1(caseData, {
            judgeType: session.judgeType || 'logical'
        });

        // Store analysis and resolutions
        session.analysis = phase1Result.analysis;
        session.resolutions = phase1Result.resolutions;
        session.assessedIntensity = phase1Result.assessedIntensity;
        session.historicalContext = phase1Result.historicalContext || null;

        // V2.0 Pipeline: Phase 2 - Priming + Joint Menu
        console.log(`[Court] V2.0 Phase 2: Priming + Joint Menu for session ${session.id}`);
        const phase2Result = await judgeEngine.deliberatePhase2(phase1Result, {
            judgeType: session.judgeType || 'logical'
        });

        // Store priming and joint content
        session.primingContent = phase2Result.primingContent;
        session.jointMenu = phase2Result.jointMenu;

        // Clear analysis timeout before moving on
        if (session.timeoutId) {
            clearTimeoutFn(session.timeoutId);
            session.timeoutId = null;
        }

        // Record usage
        try {
            await incrementUsage({ userId: session.creatorId, type: usageType });
        } catch (e) {
            console.warn('[Court] Failed to increment usage:', e?.message || e);
        }

        // Transition to PRIMING phase
        session.phase = PHASE.PRIMING;

        // Set priming timeout
        session.timeoutId = setPrimingTimeout(session.coupleId);

        await dbCheckpoint(session, 'priming_generated');
        notifyBoth(session);

        console.log(`[Court] V2.0 pipeline complete for session ${session.id} → PRIMING`);
    } catch (error) {
        console.error('[Court] Verdict generation failed:', error);
        session.verdict = { status: 'error', error: error?.message || 'Verdict generation failed' };
        session.resolvedAt = Date.now();
        session.phase = PHASE.VERDICT;
        await dbCheckpoint(session, 'verdict_failed');
        notifyBoth(session);
    }
}

module.exports = {
    runVerdictPipeline,
    mapJudgeTypeToUsage
};
