/**
 * Phase Transition Controller
 *
 * Manages court session phase transitions and validations.
 * Implements the state machine logic for session lifecycle.
 *
 * Phases: IDLE → PENDING → EVIDENCE → ANALYZING → PRIMING → JOINT_READY → RESOLUTION → VERDICT → CLOSED
 *
 * Responsibilities:
 * - Validate phase transitions
 * - Update session phase
 * - Manage phase timeouts
 * - Handle verdict acceptance and session closure
 */

const { PHASE } = require('./stateSerializer');
const { TIMEOUT } = require('./timeoutHandlers');
const { buildCaseData } = require('./caseDataBuilder');

class PhaseTransitionController {
    constructor(dependencies) {
        this.dbService = dependencies.dbService;
        this.wsService = dependencies.wsService;
        this.judgeEngine = dependencies.judgeEngine;
    }

    // === PENDING → EVIDENCE ===

    /**
     * Accept pending session (partner accepts summons)
     * Transition: PENDING → EVIDENCE
     */
    async acceptSession(session) {
        if (session.phase !== PHASE.PENDING) {
            throw new Error('Session not in PENDING phase');
        }

        // Clear pending timeout
        if (session.timeoutId) {
            clearTimeout(session.timeoutId);
            session.timeoutId = null;
        }

        // Transition to EVIDENCE
        session.phase = PHASE.EVIDENCE;
        session.phaseStartedAt = Date.now();

        console.log(`[Court] Session ${session.id} accepted (EVIDENCE)`);

        return session;
    }

    // === EVIDENCE → ANALYZING ===

    /**
     * Check if both users submitted evidence
     */
    bothUsersSubmittedEvidence(session) {
        return session.creator.evidenceSubmitted && session.partner.evidenceSubmitted;
    }

    /**
     * Transition to ANALYZING phase after both submit evidence
     */
    async transitionToAnalyzing(session) {
        if (session.phase !== PHASE.EVIDENCE) {
            throw new Error('Must be in EVIDENCE phase');
        }

        // Clear evidence timeout
        if (session.timeoutId) {
            clearTimeout(session.timeoutId);
            session.timeoutId = null;
        }

        // Transition to analysis phase (v2)
        session.phase = PHASE.ANALYZING;
        session.phaseStartedAt = Date.now();
        console.log(`[Court] Session ${session.id} → ANALYZING`);

        return session;
    }

    // === ANALYZING → PRIMING ===

    /**
     * Transition to PRIMING phase after analysis completes
     */
    async transitionToPriming(session) {
        if (session.phase !== PHASE.ANALYZING) {
            throw new Error('Must be in ANALYZING phase');
        }

        // Clear analysis timeout
        if (session.timeoutId) {
            clearTimeout(session.timeoutId);
            session.timeoutId = null;
        }

        session.phase = PHASE.PRIMING;
        session.phaseStartedAt = Date.now();
        console.log(`[Court] Session ${session.id} → PRIMING`);

        return session;
    }

    /**
     * Check if both users completed priming
     */
    bothUsersCompletedPriming(session) {
        return session.creator.primingReady && session.partner.primingReady;
    }

    // === PRIMING → JOINT_READY ===

    /**
     * Transition to JOINT_READY phase after both complete priming
     */
    async transitionToJointReady(session) {
        if (session.phase !== PHASE.PRIMING) {
            throw new Error('Must be in PRIMING phase');
        }

        // Clear priming timeout
        if (session.timeoutId) {
            clearTimeout(session.timeoutId);
            session.timeoutId = null;
        }

        session.phase = PHASE.JOINT_READY;
        session.phaseStartedAt = Date.now();
        console.log(`[Court] Session ${session.id} → JOINT_READY`);

        return session;
    }

    /**
     * Check if both users are ready to proceed from joint menu
     */
    bothUsersJointReady(session) {
        return session.creator.jointReady && session.partner.jointReady;
    }

    // === JOINT_READY → RESOLUTION ===

    /**
     * Transition to RESOLUTION phase after both ready from joint menu
     */
    async transitionToResolution(session) {
        if (session.phase !== PHASE.JOINT_READY) {
            throw new Error('Must be in JOINT_READY phase');
        }

        // Clear joint timeout
        if (session.timeoutId) {
            clearTimeout(session.timeoutId);
            session.timeoutId = null;
        }

        session.phase = PHASE.RESOLUTION;
        session.phaseStartedAt = Date.now();
        console.log(`[Court] Session ${session.id} → RESOLUTION`);

        return session;
    }

    // === RESOLUTION → VERDICT ===

    /**
     * Finalize resolution and transition to VERDICT phase
     */
    async transitionToVerdict(session) {
        if (session.timeoutId) {
            clearTimeout(session.timeoutId);
            session.timeoutId = null;
        }

        // Build verdict from final resolution
        // Get the actual resolution objects for user picks
        const userAPickedResolution = session.userAResolutionPick
            ? this._findResolutionById(session, session.userAResolutionPick)
            : null;
        const userBPickedResolution = session.userBResolutionPick
            ? this._findResolutionById(session, session.userBResolutionPick)
            : null;
        const resolvedFinalResolution = session.finalResolution
            || userAPickedResolution
            || userBPickedResolution
            || session.hybridResolution
            || null;

        if (!session.finalResolution && resolvedFinalResolution) {
            session.finalResolution = resolvedFinalResolution;
        }

        const isHybrid = resolvedFinalResolution?.id
            ? resolvedFinalResolution.id === session.hybridResolution?.id
            : false;

        session.verdict = {
            status: 'success',
            judgeContent: {
                theSummary: session.jointMenu?.theSummary || 'Resolution found.',
                theSentence: {
                    title: resolvedFinalResolution?.title || 'Resolution',
                    description: resolvedFinalResolution?.description || resolvedFinalResolution?.combinedDescription,
                    rationale: resolvedFinalResolution?.rationale
                },
                closingStatement: session.jointMenu?.closingWisdom || 'May this resolution bring you closer together.'
            },
            _meta: {
                analysis: session.analysis || null,
                assessedIntensity: session.assessedIntensity,
                resolutions: session.resolutions,
                primingContent: session.primingContent || null,
                jointMenu: session.jointMenu || null,
                finalResolution: resolvedFinalResolution,
                isHybrid,
                // Track individual resolution picks for history
                userAResolutionPick: userAPickedResolution,
                userBResolutionPick: userBPickedResolution,
                hybridResolution: session.hybridResolution || null
            }
        };

        this._recordVerdictVersion(session);

        session.resolvedAt = Date.now();
        session.phase = PHASE.VERDICT;
        session.phaseStartedAt = Date.now();

        console.log(`[Court] Session ${session.id} → VERDICT`);

        return session;
    }

    /**
     * Check if both users accepted verdict
     */
    bothUsersAcceptedVerdict(session) {
        return session.creator.verdictAccepted && session.partner.verdictAccepted;
    }

    // === VERDICT → CLOSED ===

    /**
     * Close session and persist to case history
     */
    async closeSession(session, reason) {
        if (session.timeoutId) {
            clearTimeout(session.timeoutId);
            session.timeoutId = null;
        }

        if (session.settlementTimeoutId) {
            clearTimeout(session.settlementTimeoutId);
            session.settlementTimeoutId = null;
        }

        session.phase = PHASE.CLOSED;
        session.phaseStartedAt = Date.now();

        // Persist to case history (best-effort)
        try {
            if (this.dbService?.saveCaseFromSession && !session.caseId) {
                session.caseId = await this.dbService.saveCaseFromSession(session);
            }
        } catch (error) {
            console.error('[Court] Failed to persist case history:', error);
        }

        // Trigger background memory extraction
        if (this.judgeEngine?.triggerBackgroundExtraction) {
            const caseData = await buildCaseData(session);
            caseData.submissions.userA.selectedPrimaryEmotion ||= '';
            caseData.submissions.userA.coreNeed ||= '';
            caseData.submissions.userB.selectedPrimaryEmotion ||= '';
            caseData.submissions.userB.coreNeed ||= '';
            this.judgeEngine.triggerBackgroundExtraction(caseData, session.caseId || null);
        }

        console.log(`[Court] Session ${session.id} closed (${reason})`);

        return session;
    }

    // === Addendum Handling ===

    /**
     * Reset session state for addendum re-run
     */
    resetForAddendum(session) {
        // Reset acceptances
        session.creator.verdictAccepted = false;
        session.partner.verdictAccepted = false;

        // Reset v2 pipeline state for re-run
        session.analysis = null;
        session.resolutions = null;
        session.assessedIntensity = null;
        session.primingContent = null;
        session.jointMenu = null;
        session.creator.primingReady = false;
        session.partner.primingReady = false;
        session.creator.jointReady = false;
        session.partner.jointReady = false;
        session.userAResolutionPick = null;
        session.userBResolutionPick = null;
        session.hybridResolution = null;
        session.finalResolution = null;
        session.mismatchOriginal = null;
        session.mismatchPicks = null;
        session.mismatchLock = null;
        session.mismatchLockBy = null;
        session.hybridResolutionPending = false;
        session.verdict = null;
        session.resolvedAt = null;
        session.phase = PHASE.ANALYZING;
        session.phaseStartedAt = Date.now();

        return session;
    }

    // === Private Helpers ===

    _recordVerdictVersion(session) {
        if (!session?.verdict) return;
        const history = Array.isArray(session.verdictHistory) ? session.verdictHistory : [];
        const version = history.length + 1;
        const addendumIndex = version - 2;
        const addendumEntry = addendumIndex >= 0 ? session.addendumHistory?.[addendumIndex] : null;

        history.push({
            version,
            content: session.verdict,
            addendumBy: addendumEntry?.fromUser || null,
            addendumText: addendumEntry?.text || null,
            createdAt: new Date().toISOString()
        });

        session.verdictHistory = history;
    }

    /**
     * Find resolution by ID (checks both resolutions array and hybrid)
     */
    _findResolutionById(session, resolutionId) {
        if (!resolutionId) return null;
        if (session.hybridResolution?.id === resolutionId) return session.hybridResolution;
        return (session.resolutions || []).find((r) => r.id === resolutionId) || null;
    }
}

module.exports = PhaseTransitionController;
