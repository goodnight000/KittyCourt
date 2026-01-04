/**
 * Evidence Service
 *
 * Handles evidence submission logic for court sessions.
 *
 * Responsibilities:
 * - Validate evidence submissions
 * - Update user state with evidence
 * - Check if both users submitted
 * - Trigger verdict generation when ready
 */

const { PHASE } = require('./stateSerializer');

class EvidenceService {
    /**
     * Submit evidence for a user
     *
     * @param {Object} session - Session object (mutated in place)
     * @param {string} userId - User submitting evidence
     * @param {string} evidence - Evidence text
     * @param {string} feelings - Feelings text
     * @returns {Object} - { bothSubmitted: boolean }
     */
    submitEvidence(session, userId, evidence, feelings) {
        // Validate user is part of this session
        if (session.creatorId !== userId && session.partnerId !== userId) {
            throw new Error('User not authorized for this session');
        }

        if (session.phase !== PHASE.EVIDENCE) {
            throw new Error('Not in EVIDENCE phase');
        }

        const isCreator = session.creatorId === userId;
        const userState = isCreator ? session.creator : session.partner;

        if (userState.evidenceSubmitted) {
            throw new Error('Evidence already submitted');
        }

        // Update user state
        userState.evidenceSubmitted = true;
        userState.evidence = evidence;
        userState.feelings = feelings;

        // Check if both users submitted
        const bothSubmitted = session.creator.evidenceSubmitted && session.partner.evidenceSubmitted;

        return { bothSubmitted };
    }
}

module.exports = EvidenceService;
