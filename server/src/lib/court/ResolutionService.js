/**
 * Resolution Service
 *
 * Handles resolution picking and mismatch resolution logic.
 *
 * Responsibilities:
 * - Process resolution picks from users
 * - Detect and handle resolution mismatches
 * - Generate hybrid resolutions when needed
 * - Find resolutions by ID
 */

const { PHASE } = require('./StateSerializer');
const { acquireLock } = require('../redis');

const HYBRID_RESOLUTION_ID = 'resolution_hybrid';

class ResolutionService {
    constructor(dependencies) {
        this.judgeEngine = dependencies.judgeEngine;
    }

    // === Resolution Picking ===

    /**
     * Submit resolution pick for a user
     *
     * @param {Object} session - Session object (mutated in place)
     * @param {string} userId - User ID
     * @param {string} resolutionId - Resolution ID selected
     * @returns {Promise<Object>} - { bothPicked, sameChoice, mismatch }
     */
    async submitResolutionPick(session, userId, resolutionId) {
        // Validate user is part of this session
        if (session.creatorId !== userId && session.partnerId !== userId) {
            throw new Error('User not authorized for this session');
        }

        if (session.phase !== PHASE.RESOLUTION) {
            throw new Error('Not in RESOLUTION phase');
        }

        // WS-H-003: Validate resolution ID before processing
        if (!resolutionId || typeof resolutionId !== 'string') {
            throw new Error('Invalid resolution ID');
        }

        // Validate the resolution ID exists in the session
        const resolution = this.findResolutionById(session, resolutionId);
        if (!resolution) {
            throw new Error('Resolution not found');
        }

        const isCreator = session.creatorId === userId;

        // Handle mismatch state separately (uses distributed locking)
        if (this.isMismatchActive(session)) {
            return await this._handleMismatchPick(session, userId, resolutionId, isCreator);
        }

        // Regular picking
        if (isCreator) {
            session.userAResolutionPick = resolutionId;
        } else {
            session.userBResolutionPick = resolutionId;
        }

        const bothPicked = session.userAResolutionPick && session.userBResolutionPick;
        const sameChoice = bothPicked && session.userAResolutionPick === session.userBResolutionPick;

        if (sameChoice && !session.finalResolution) {
            session.finalResolution = resolution;
        }

        return {
            bothPicked,
            sameChoice,
            mismatch: bothPicked && !sameChoice
        };
    }

    /**
     * Accept partner's resolution choice
     */
    acceptPartnerResolution(session, userId) {
        // Validate user is part of this session
        if (session.creatorId !== userId && session.partnerId !== userId) {
            throw new Error('User not authorized for this session');
        }

        if (session.phase !== PHASE.RESOLUTION) {
            throw new Error('Not in RESOLUTION phase');
        }

        const isCreator = session.creatorId === userId;
        const partnerPick = isCreator ? session.userBResolutionPick : session.userAResolutionPick;

        if (!partnerPick) {
            throw new Error('Partner has not picked yet');
        }

        const chosenResolution = this.findResolutionById(session, partnerPick);
        session.finalResolution = chosenResolution;

        return { session };
    }

    // === Mismatch Handling ===

    /**
     * Check if session is in mismatch state
     */
    isMismatchActive(session) {
        if (session.mismatchOriginal) return true;
        if (!session.userAResolutionPick || !session.userBResolutionPick) return false;
        if (session.finalResolution) return false;
        return session.userAResolutionPick !== session.userBResolutionPick;
    }

    /**
     * Initialize mismatch state
     */
    initializeMismatch(session) {
        if (session.mismatchOriginal) return;
        if (!this.isMismatchActive(session)) return;

        session.mismatchOriginal = {
            userA: session.userAResolutionPick,
            userB: session.userBResolutionPick
        };
        session.mismatchPicks = { userA: null, userB: null };
        session.mismatchLock = null;
        session.mismatchLockBy = null;
        session.hybridResolution = null;
        session.hybridResolutionPending = true;
    }

    /**
     * Handle resolution pick during mismatch state
     * Uses distributed locking to prevent race conditions in multi-instance deployments
     */
    async _handleMismatchPick(session, userId, resolutionId, isCreator) {
        // Acquire lock for this session's mismatch handling
        const lockKey = `court:mismatch:${session.coupleId}`;
        const lock = await acquireLock(lockKey);

        if (!lock.acquired) {
            throw new Error('Another pick is being processed. Please try again.');
        }

        try {
            this._ensureMismatchState(session);

            const myKey = isCreator ? 'userA' : 'userB';
            const partnerKey = isCreator ? 'userB' : 'userA';
            const mismatchPicks = session.mismatchPicks || { userA: null, userB: null };
            const lockId = session.mismatchLock;
            const lockOwner = session.mismatchLockBy;

            // If partner locked a choice, validate we're picking the same
            if (lockId && lockOwner && lockOwner !== userId) {
                if (lockId !== resolutionId) {
                    throw new Error('You both need to pick the same resolution to continue.');
                }
                mismatchPicks[myKey] = resolutionId;
            } else {
                // Validate we match partner's pick if they already picked
                if (mismatchPicks[partnerKey] && mismatchPicks[partnerKey] !== resolutionId) {
                    throw new Error('You both need to pick the same resolution to continue.');
                }
                mismatchPicks[myKey] = resolutionId;
                session.mismatchLock = resolutionId;
                session.mismatchLockBy = userId;
            }

            session.mismatchPicks = mismatchPicks;

            const bothPicked = mismatchPicks.userA && mismatchPicks.userB;
            const sameChoice = bothPicked && mismatchPicks.userA === mismatchPicks.userB;

            if (sameChoice) {
                const chosenResolution = this.findResolutionById(session, mismatchPicks.userA);
                if (!chosenResolution) {
                    throw new Error('Selected resolution not found');
                }
                session.finalResolution = chosenResolution;
            }

            return { bothPicked, sameChoice, mismatch: true };
        } finally {
            await lock.release();
        }
    }

    _ensureMismatchState(session) {
        if (session.mismatchOriginal) return;
        if (!this.isMismatchActive(session)) return;

        session.mismatchOriginal = {
            userA: session.userAResolutionPick,
            userB: session.userBResolutionPick
        };
        session.mismatchPicks = { userA: null, userB: null };
        session.mismatchLock = null;
        session.mismatchLockBy = null;
    }

    // === Hybrid Resolution ===

    /**
     * Generate hybrid resolution from two different picks
     */
    async generateHybridResolution(session, buildCaseData) {
        if (!this.judgeEngine?.runHybridResolution) {
            session.hybridResolutionPending = false;
            throw new Error('Hybrid resolution engine unavailable');
        }

        if (!session.mismatchOriginal) {
            session.hybridResolutionPending = false;
            throw new Error('Hybrid resolution requested without mismatch');
        }

        if (!session.analysis) {
            session.hybridResolutionPending = false;
            throw new Error('Hybrid resolution requested without analysis');
        }

        const userAChoice = this.findResolutionById(session, session.mismatchOriginal.userA);
        const userBChoice = this.findResolutionById(session, session.mismatchOriginal.userB);

        if (!userAChoice || !userBChoice) {
            session.hybridResolutionPending = false;
            throw new Error('Hybrid resolution requested with missing choices');
        }

        const caseData = buildCaseData(session);
        const historicalContext = session.historicalContext || '';
        const result = await this.judgeEngine.runHybridResolution(
            caseData,
            session.analysis,
            userAChoice,
            userBChoice,
            historicalContext
        );

        const hybrid = result?.hybridResolution;
        if (!hybrid) {
            session.hybridResolutionPending = false;
            throw new Error('Hybrid resolution output missing');
        }

        session.hybridResolution = {
            id: HYBRID_RESOLUTION_ID,
            title: hybrid.title,
            description: hybrid.description,
            combinedDescription: hybrid.description,
            rationale: hybrid.rationale,
            estimatedDuration: hybrid.estimatedDuration,
            repairAttemptIds: [],
            fromUserA: hybrid.fromUserA,
            fromUserB: hybrid.fromUserB,
            bridgingMessage: result?.bridgingMessage,
            isHybrid: true
        };
        session.hybridResolutionPending = false;

        return session.hybridResolution;
    }

    // === Resolution Lookup ===

    /**
     * Find resolution by ID
     */
    findResolutionById(session, resolutionId) {
        if (!resolutionId) return null;
        if (session.hybridResolution?.id === resolutionId) return session.hybridResolution;
        return (session.resolutions || []).find((resolution) => resolution.id === resolutionId) || null;
    }
}

module.exports = ResolutionService;
