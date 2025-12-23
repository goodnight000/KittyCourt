/**
 * Timeout Handlers - Court Session Helper
 * 
 * Handles session timeouts for various phases.
 */

const { PHASE, VIEW_PHASE } = require('./stateSerializer');

// Timeout durations (in ms)
const TIMEOUT = {
    PENDING: 10 * 60 * 1000,        // 10 minutes
    EVIDENCE: 60 * 60 * 1000,       // 1 hour
    ANALYZING: 5 * 60 * 1000,       // 5 minutes
    PRIMING: 60 * 60 * 1000,        // 1 hour
    JOINT_READY: 60 * 60 * 1000,    // 1 hour
    RESOLUTION: 60 * 60 * 1000,     // 1 hour
    VERDICT: 60 * 60 * 1000,        // 1 hour
    SETTLE_REQUEST: 5 * 60 * 1000   // 5 minutes
};

/**
 * Create timeout handler functions for a session manager instance.
 * These are factory functions to maintain proper `this` binding.
 */
function createTimeoutHandlers(manager) {
    return {
        /**
         * Handle pending timeout (creator didn't get response)
         */
        async handlePendingTimeout(coupleId) {
            const session = manager.sessions.get(coupleId);
            if (!session || session.phase !== PHASE.PENDING) return;

            console.log(`[Court] Pending timeout for session ${session.id}`);
            await manager._deleteSession(session);
            manager._cleanup(coupleId);
        },

        /**
         * Handle evidence timeout (one user didn't submit)
         */
        async handleEvidenceTimeout(coupleId) {
            const session = manager.sessions.get(coupleId);
            if (!session || session.phase !== PHASE.EVIDENCE) return;

            console.log(`[Court] Evidence timeout for session ${session.id}`);
            await manager._deleteSession(session);
            manager._cleanup(coupleId);
        },

        /**
         * Handle verdict timeout (auto-accept)
         */
        async handleVerdictTimeout(coupleId) {
            const session = manager.sessions.get(coupleId);
            if (!session || session.phase !== PHASE.VERDICT) return;

            console.log(`[Court] Verdict timeout for session ${session.id} - auto-accepting`);

            session.creator.verdictAccepted = true;
            session.partner.verdictAccepted = true;

            await manager._closeSession(session, 'auto-accepted');
        },

        /**
         * Handle analyzing timeout (LLM call took too long)
         */
        async handleAnalyzingTimeout(coupleId) {
            const session = manager.sessions.get(coupleId);
            if (!session || session.phase !== PHASE.ANALYZING) return;

            console.log(`[Court] Analyzing timeout for session ${session.id} - case tossed`);
            await manager._deleteSession(session);
            manager._cleanup(coupleId);
        },

        /**
         * Handle priming timeout (user didn't complete priming)
         */
        async handlePrimingTimeout(coupleId) {
            const session = manager.sessions.get(coupleId);
            if (!session || session.phase !== PHASE.PRIMING) return;

            console.log(`[Court] Priming timeout for session ${session.id} - case tossed`);
            await manager._deleteSession(session);
            manager._cleanup(coupleId);
        },

        /**
         * Handle joint menu timeout (users didn't proceed)
         */
        async handleJointTimeout(coupleId) {
            const session = manager.sessions.get(coupleId);
            if (!session || session.phase !== PHASE.JOINT_READY) return;

            console.log(`[Court] Joint timeout for session ${session.id} - case tossed`);
            await manager._deleteSession(session);
            manager._cleanup(coupleId);
        },

        /**
         * Handle resolution timeout (users didn't pick)
         */
        async handleResolutionTimeout(coupleId) {
            const session = manager.sessions.get(coupleId);
            if (!session || session.phase !== PHASE.RESOLUTION) return;

            console.log(`[Court] Resolution timeout for session ${session.id} - case tossed`);
            await manager._deleteSession(session);
            manager._cleanup(coupleId);
        }
    };
}

module.exports = {
    TIMEOUT,
    createTimeoutHandlers
};
