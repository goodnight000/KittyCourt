/**
 * State Serializer - Court Session Helper
 * 
 * Handles view phase computation and session sanitization for client consumption.
 */

const ADDENDUM_LIMIT = 2;

// Session phases (internal state machine)
const PHASE = {
    IDLE: 'IDLE',
    PENDING: 'PENDING',
    EVIDENCE: 'EVIDENCE',
    ANALYZING: 'ANALYZING',
    PRIMING: 'PRIMING',
    JOINT_READY: 'JOINT_READY',
    RESOLUTION: 'RESOLUTION',
    VERDICT: 'VERDICT',
    CLOSED: 'CLOSED'
};

// View phases (what each user sees)
const VIEW_PHASE = {
    IDLE: 'IDLE',
    PENDING_CREATOR: 'PENDING_CREATOR',
    PENDING_PARTNER: 'PENDING_PARTNER',
    EVIDENCE: 'EVIDENCE',
    WAITING_EVIDENCE: 'WAITING_EVIDENCE',
    ANALYZING: 'ANALYZING',
    PRIMING: 'PRIMING',
    WAITING_PRIMING: 'WAITING_PRIMING',
    JOINT_MENU: 'JOINT_MENU',
    WAITING_JOINT: 'WAITING_JOINT',
    RESOLUTION_SELECT: 'RESOLUTION_SELECT',
    RESOLUTION_MISMATCH: 'RESOLUTION_MISMATCH',
    WAITING_RESOLUTION: 'WAITING_RESOLUTION',
    VERDICT: 'VERDICT',
    WAITING_ACCEPT: 'WAITING_ACCEPT',
    RATING: 'RATING',
    CLOSED: 'CLOSED'
};

/**
 * Compute user's view phase based on session state
 */
function computeViewPhase(session, isCreator, isMismatchActive) {
    const myState = isCreator ? session.creator : session.partner;
    const partnerState = isCreator ? session.partner : session.creator;

    switch (session.phase) {
        case PHASE.PENDING:
            return isCreator ? VIEW_PHASE.PENDING_CREATOR : VIEW_PHASE.PENDING_PARTNER;

        case PHASE.EVIDENCE:
            if (myState.evidenceSubmitted) {
                return VIEW_PHASE.WAITING_EVIDENCE;
            }
            return VIEW_PHASE.EVIDENCE;

        case PHASE.ANALYZING:
            return VIEW_PHASE.ANALYZING;

        case PHASE.PRIMING:
            if (myState.primingReady && !partnerState.primingReady) {
                return VIEW_PHASE.WAITING_PRIMING;
            }
            return VIEW_PHASE.PRIMING;

        case PHASE.JOINT_READY:
            if (myState.jointReady && !partnerState.jointReady) {
                return VIEW_PHASE.WAITING_JOINT;
            }
            return VIEW_PHASE.JOINT_MENU;

        case PHASE.RESOLUTION:
            if (isMismatchActive) {
                return VIEW_PHASE.RESOLUTION_MISMATCH;
            }

            const myPick = isCreator ? session.userAResolutionPick : session.userBResolutionPick;
            const partnerPick = isCreator ? session.userBResolutionPick : session.userAResolutionPick;

            if (!myPick) {
                return VIEW_PHASE.RESOLUTION_SELECT;
            }
            if (myPick && !partnerPick) {
                return VIEW_PHASE.WAITING_RESOLUTION;
            }
            return VIEW_PHASE.RESOLUTION_SELECT;

        case PHASE.VERDICT:
            if (myState.verdictAccepted && !partnerState.verdictAccepted) {
                return VIEW_PHASE.WAITING_ACCEPT;
            }
            return VIEW_PHASE.VERDICT;

        case PHASE.CLOSED:
            return VIEW_PHASE.CLOSED;

        default:
            return VIEW_PHASE.IDLE;
    }
}

/**
 * Sanitize session for client consumption (snake_case internal → camelCase client)
 */
function sanitizeSession(session) {
    return {
        id: session.id,
        coupleId: session.coupleId,
        creatorId: session.creatorId,
        partnerId: session.partnerId,
        phase: session.phase,
        caseId: session.caseId || null,
        evidence: {
            creator: {
                submitted: session.creator.evidenceSubmitted,
                facts: session.creator.evidence,
                feelings: session.creator.feelings
            },
            partner: {
                submitted: session.partner.evidenceSubmitted,
                facts: session.partner.evidence,
                feelings: session.partner.feelings
            }
        },
        verdictAcceptances: {
            creator: session.creator.verdictAccepted,
            partner: session.partner.verdictAccepted
        },
        verdict: session.verdict,
        settlementRequested: session.settlementRequested,
        createdAt: session.createdAt,
        resolvedAt: session.resolvedAt || null,
        addendumCount: session.addendumCount || 0,
        addendumLimit: ADDENDUM_LIMIT,
        addendumRemaining: Math.max(ADDENDUM_LIMIT - (session.addendumCount || 0), 0),
        // V2.0 fields
        analysis: session.analysis || null,
        resolutions: session.resolutions || null,
        assessedIntensity: session.assessedIntensity || null,
        primingContent: session.primingContent || null,
        jointMenu: session.jointMenu || null,
        primingReady: {
            creator: session.creator?.primingReady || false,
            partner: session.partner?.primingReady || false
        },
        jointReady: {
            creator: session.creator?.jointReady || false,
            partner: session.partner?.jointReady || false
        },
        resolutionPicks: {
            userA: session.userAResolutionPick || null,
            userB: session.userBResolutionPick || null
        },
        hybridResolution: session.hybridResolution || null,
        finalResolution: session.finalResolution || null,
        mismatchOriginal: session.mismatchOriginal || null,
        mismatchPicks: session.mismatchPicks || null,
        hybridResolutionPending: session.hybridResolutionPending || false
    };
}

module.exports = {
    PHASE,
    VIEW_PHASE,
    ADDENDUM_LIMIT,
    computeViewPhase,
    sanitizeSession
};
