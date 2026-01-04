/**
 * Session State Repository
 *
 * Pure storage layer for court sessions.
 * No business logic - only CRUD operations on in-memory session state.
 *
 * Responsibilities:
 * - Store and retrieve sessions by coupleId
 * - Maintain userId → coupleId lookup
 * - Create and initialize new sessions
 * - Clean up sessions from memory
 */

const { v4: uuidv4 } = require('uuid');
const { PHASE } = require('./stateSerializer');

class SessionStateRepository {
    constructor() {
        // coupleId → Session
        this.sessions = new Map();

        // userId → coupleId (quick lookup)
        this.userToCouple = new Map();
    }

    // === Lookups ===

    /**
     * Get session by coupleId
     */
    getSession(coupleId) {
        return this.sessions.get(coupleId);
    }

    /**
     * Get session for a specific user
     */
    getSessionForUser(userId) {
        const coupleId = this.userToCouple.get(userId);
        return coupleId ? this.sessions.get(coupleId) : null;
    }

    /**
     * Check if either user is already in a session
     */
    hasActiveSession(creatorId, partnerId) {
        return this.userToCouple.has(creatorId) || this.userToCouple.has(partnerId);
    }

    /**
     * Get all active sessions (for recovery/debugging)
     */
    getAllSessions() {
        return Array.from(this.sessions.values());
    }

    // === Session Creation ===

    /**
     * Create and store a new session
     */
    createSession(params) {
        const {
            creatorId,
            partnerId,
            coupleId,
            judgeType = 'logical',
            creatorLanguage = 'en',
            partnerLanguage = 'en',
            caseLanguage = 'en'
        } = params;

        const effectiveCoupleId = coupleId || `${creatorId}-${partnerId}`;
        const sessionId = uuidv4();

        const session = {
            id: sessionId,
            coupleId: effectiveCoupleId,
            creatorId,
            partnerId,
            phase: PHASE.PENDING,
            caseId: null,
            judgeType,
            creatorLanguage,
            partnerLanguage,
            caseLanguage,
            creator: this._emptyUserState(),
            partner: this._emptyUserState(),
            verdict: null,
            addendumHistory: [],
            addendumCount: 0,
            verdictHistory: [],
            settlementRequested: null,
            settlementTimeoutId: null,
            timeoutId: null,
            createdAt: Date.now(),
            // V2.0 fields
            analysis: null,
            resolutions: null,
            assessedIntensity: null,
            primingContent: null,
            jointMenu: null,
            userAResolutionPick: null,
            userBResolutionPick: null,
            hybridResolution: null,
            finalResolution: null,
            mismatchOriginal: null,
            mismatchPicks: null,
            mismatchLock: null,
            mismatchLockBy: null,
            hybridResolutionPending: false,
            historicalContext: null
        };

        this.sessions.set(effectiveCoupleId, session);
        this.userToCouple.set(creatorId, effectiveCoupleId);
        this.userToCouple.set(partnerId, effectiveCoupleId);

        return session;
    }

    /**
     * Restore session from database (for crash recovery)
     */
    restoreSession(session) {
        this.sessions.set(session.coupleId, session);
        this.userToCouple.set(session.creatorId, session.coupleId);
        this.userToCouple.set(session.partnerId, session.coupleId);
    }

    // === Session Cleanup ===

    /**
     * Remove session from memory and lookups
     */
    deleteSession(coupleId) {
        const session = this.sessions.get(coupleId);
        if (!session) return null;

        // Clean up timeouts
        if (session.timeoutId) {
            clearTimeout(session.timeoutId);
        }
        if (session.settlementTimeoutId) {
            clearTimeout(session.settlementTimeoutId);
        }

        // Remove from lookups
        this.userToCouple.delete(session.creatorId);
        this.userToCouple.delete(session.partnerId);
        this.sessions.delete(coupleId);

        return session;
    }

    // === Stats ===

    /**
     * Get repository statistics
     */
    getStats() {
        return {
            activeSessions: this.sessions.size,
            userMappings: this.userToCouple.size
        };
    }

    // === Private Helpers ===

    _emptyUserState() {
        return {
            evidenceSubmitted: false,
            evidence: null,
            feelings: null,
            verdictAccepted: false,
            // V2.0 fields
            primingReady: false,
            jointReady: false
        };
    }
}

module.exports = SessionStateRepository;
