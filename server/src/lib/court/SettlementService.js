/**
 * Settlement Service
 *
 * Handles settlement request/accept/decline logic.
 *
 * Responsibilities:
 * - Process settlement requests
 * - Handle settlement acceptance
 * - Handle settlement decline
 * - Manage settlement timeouts
 */

const { PHASE } = require('./StateSerializer');
const { TIMEOUT } = require('./timeoutHandlers');

class SettlementService {
    /**
     * Request settlement from partner
     *
     * @param {Object} session - Session object (mutated in place)
     * @param {string} userId - User requesting settlement
     * @param {Function} onTimeout - Callback for settlement timeout
     * @returns {Object} - { partnerId }
     */
    requestSettlement(session, userId, onTimeout) {
        // Validate user is part of this session
        if (session.creatorId !== userId && session.partnerId !== userId) {
            throw new Error('User not authorized for this session');
        }

        if (![PHASE.EVIDENCE, PHASE.ANALYZING].includes(session.phase)) {
            throw new Error('Settlement only allowed during EVIDENCE or ANALYZING');
        }

        session.settlementRequested = userId;
        session.settlementRequestedAt = Date.now();

        // Clear existing timeout
        if (session.settlementTimeoutId) {
            clearTimeout(session.settlementTimeoutId);
            session.settlementTimeoutId = null;
        }

        // Set timeout to expire the request if ignored
        session.settlementTimeoutId = setTimeout(() => {
            onTimeout(session.coupleId, userId);
        }, TIMEOUT.SETTLE_REQUEST);

        // Return partner ID for notification
        const partnerId = session.creatorId === userId ? session.partnerId : session.creatorId;

        console.log(`[Court] Settlement requested by ${userId}`);

        return { partnerId };
    }

    /**
     * Accept settlement request
     */
    acceptSettlement(session, userId) {
        // Validate user is part of this session
        if (session.creatorId !== userId && session.partnerId !== userId) {
            throw new Error('User not authorized for this session');
        }

        if (!session.settlementRequested) {
            throw new Error('No settlement request pending');
        }

        if (session.settlementRequested === userId) {
            throw new Error('Cannot accept your own settlement');
        }

        // Clear timeout
        if (session.settlementTimeoutId) {
            clearTimeout(session.settlementTimeoutId);
            session.settlementTimeoutId = null;
        }

        console.log(`[Court] Session ${session.id} settled`);
    }

    /**
     * Decline settlement request
     */
    declineSettlement(session, userId) {
        // Validate user is part of this session
        if (session.creatorId !== userId && session.partnerId !== userId) {
            throw new Error('User not authorized for this session');
        }

        if (!session.settlementRequested) {
            throw new Error('No settlement request pending');
        }

        if (session.settlementRequested === userId) {
            throw new Error('Cannot decline your own settlement');
        }

        const requesterId = session.settlementRequested;

        // Clear timeout
        if (session.settlementTimeoutId) {
            clearTimeout(session.settlementTimeoutId);
            session.settlementTimeoutId = null;
        }

        session.settlementRequested = null;
        session.settlementRequestedAt = null;

        console.log(`[Court] Settlement declined by ${userId}`);

        return { requesterId };
    }

    /**
     * Handle settlement timeout (request expires)
     */
    handleSettlementTimeout(session, originalRequesterId) {
        if (!session) return false;
        if (session.settlementRequested !== originalRequesterId) return false;

        session.settlementRequested = null;
        session.settlementRequestedAt = null;
        session.settlementTimeoutId = null;

        console.log(`[Court] Settlement request expired for ${originalRequesterId}`);

        return true;
    }
}

module.exports = SettlementService;
