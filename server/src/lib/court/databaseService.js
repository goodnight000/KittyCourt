/**
 * Database Service - Court Session Helper
 * 
 * Handles database checkpoint operations and session recovery.
 */

const { PHASE } = require('./stateSerializer');

/**
 * Database operation wrappers for court sessions.
 * These wrap the actual dbService calls with error handling.
 */
function createDatabaseOperations(dbService) {
    return {
        /**
         * Checkpoint session state to database
         */
        async checkpoint(session, action) {
            if (!dbService) return;
            try {
                await dbService.checkpoint(session, action);
            } catch (error) {
                console.error('[Court] DB checkpoint failed:', error);
            }
        },

        /**
         * Delete session from database
         */
        async deleteSession(sessionId) {
            if (!dbService) return;
            try {
                await dbService.deleteSession(sessionId);
            } catch (error) {
                console.error('[Court] DB delete failed:', error);
            }
        },

        /**
         * Recover sessions from database records
         */
        async recoverSessions(dbSessions) {
            const recoveredSessions = [];
            for (const dbSession of dbSessions) {
                try {
                    const session = reconstructFromDB(dbSession);
                    recoveredSessions.push(session);
                } catch (error) {
                    console.error('[Court] Failed to recover session:', error);
                }
            }
            return recoveredSessions;
        }
    };
}

/**
 * Reconstruct session object from database row
 */
function reconstructFromDB(db) {
    const evidence = db.evidence_submissions || {};
    const acceptances = db.verdict_acceptances || {};

    const status = String(db.phase || db.status || '').toUpperCase();
    const phaseFromStatus = (() => {
        if (status === 'CLOSED') return PHASE.CLOSED;
        if (status === 'PENDING' || status === 'WAITING') return PHASE.PENDING;
        if (status === 'ANALYZING') return PHASE.ANALYZING;
        if (status === 'PRIMING') return PHASE.PRIMING;
        if (status === 'JOINT_READY') return PHASE.JOINT_READY;
        if (status === 'RESOLUTION') return PHASE.RESOLUTION;
        if (status === 'VERDICT') return PHASE.VERDICT;
        if (status === 'EVIDENCE') return PHASE.EVIDENCE;
        // Fallback heuristics
        if (db.verdict) return PHASE.VERDICT;
        return PHASE.EVIDENCE;
    })();

    const settle = db.settle_requests || {};
    const settlementRequested = settle.creator && !settle.partner
        ? db.created_by
        : (settle.partner && !settle.creator ? db.partner_id : null);

    const session = {
        id: db.id,
        coupleId: db.couple_id || `${db.created_by}-${db.partner_id}`,
        creatorId: db.created_by,
        partnerId: db.partner_id,
        phase: phaseFromStatus,
        caseId: db.case_id || null,
        creator: {
            evidenceSubmitted: evidence.creator?.submitted || !!db.user_a_evidence,
            evidence: evidence.creator?.evidence || db.user_a_evidence || null,
            feelings: evidence.creator?.feelings || db.user_a_feelings || null,
            needs: evidence.creator?.needs || db.user_a_needs || null,
            verdictAccepted: acceptances.creator || false,
            primingReady: db.user_a_priming_ready || false,
            jointReady: db.user_a_joint_ready || false
        },
        partner: {
            evidenceSubmitted: evidence.partner?.submitted || !!db.user_b_evidence,
            evidence: evidence.partner?.evidence || db.user_b_evidence || null,
            feelings: evidence.partner?.feelings || db.user_b_feelings || null,
            needs: evidence.partner?.needs || db.user_b_needs || null,
            verdictAccepted: acceptances.partner || false,
            primingReady: db.user_b_priming_ready || false,
            jointReady: db.user_b_joint_ready || false
        },
        verdict: db.verdict,
        addendumHistory: db.addendum_history || [],
        addendumCount: db.addendum_count || (db.addendum_history ? db.addendum_history.length : 0),
        verdictHistory: db.verdict_history || [],
        settlementRequested,
        timeoutId: null,
        settlementTimeoutId: null,
        createdAt: new Date(db.created_at).getTime(),
        judgeType: db.judge_type || 'logical',
        // V2.0 fields
        analysis: db.analysis || null,
        resolutions: db.resolutions || null,
        assessedIntensity: db.assessed_intensity || null,
        primingContent: db.priming_content || null,
        jointMenu: db.joint_menu || null,
        userAResolutionPick: db.user_a_resolution_pick || null,
        userBResolutionPick: db.user_b_resolution_pick || null,
        hybridResolution: db.hybrid_resolution || null,
        finalResolution: db.final_resolution || null,
        mismatchOriginal: null,
        mismatchPicks: null,
        mismatchLock: null,
        mismatchLockBy: null,
        hybridResolutionPending: false,
        historicalContext: null
    };

    // Reconstruct mismatch state if applicable
    if (
        session.phase === PHASE.RESOLUTION
        && session.userAResolutionPick
        && session.userBResolutionPick
        && session.userAResolutionPick !== session.userBResolutionPick
        && !session.finalResolution
    ) {
        session.mismatchOriginal = {
            userA: session.userAResolutionPick,
            userB: session.userBResolutionPick
        };
        session.mismatchPicks = { userA: null, userB: null };
    }

    return session;
}

module.exports = {
    createDatabaseOperations,
    reconstructFromDB
};
