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
const { getRedisClient, getRedisSubscriber } = require('../redis');

const SESSION_KEY_PREFIX = 'court:session:';
const USER_KEY_PREFIX = 'court:user:';
const SESSION_SET_KEY = 'court:sessions';
const SESSION_CHANNEL = 'court:sessions:events';

class SessionStateRepository {
    constructor() {
        // coupleId → Session
        this.sessions = new Map();

        // userId → coupleId (quick lookup)
        this.userToCouple = new Map();

        this.redis = getRedisClient();
        this.redisSubscriber = getRedisSubscriber();
        this.instanceId = uuidv4();

        if (this.redisSubscriber) {
            this.redisSubscriber.subscribe(SESSION_CHANNEL).catch((error) => {
                console.error('[Redis] Subscribe failed:', error?.message || error);
            });
            this.redisSubscriber.on('message', (_channel, message) => {
                this._handleRedisMessage(message);
            });
        }

        if (this.redis) {
            this._hydrateFromRedis().catch((error) => {
                console.error('[Redis] Session hydration failed:', error?.message || error);
            });
            console.log('[SessionStateRepository] Redis persistence enabled');
        } else {
            // Warn in production if Redis is not configured
            const isProd = process.env.NODE_ENV === 'production';
            if (isProd) {
                console.warn('[SessionStateRepository] WARNING: Redis not configured in production. Court sessions will be stored in-memory only and will be lost on server restart. Set REDIS_URL environment variable for session persistence.');
            } else {
                console.log('[SessionStateRepository] Running in memory-only mode (Redis not configured)');
            }
        }
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

        const now = Date.now();
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
            settlementRequestedAt: null,
            settlementTimeoutId: null,
            timeoutId: null,
            createdAt: now,
            phaseStartedAt: now,
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

        this._cacheSession(session);
        this.saveSession(session);

        return session;
    }

    /**
     * Restore session from database (for crash recovery)
     */
    restoreSession(session) {
        this._cacheSession(session);
        this.saveSession(session);
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
        this._removeSessionFromRedis(session);

        return session;
    }

    // === Stats ===

    /**
     * Get repository statistics
     */
    getStats() {
        return {
            activeSessions: this.sessions.size,
            userMappings: this.userToCouple.size,
            redisEnabled: !!this.redis
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

    _serializeSession(session) {
        return {
            ...session,
            timeoutId: null,
            settlementTimeoutId: null,
        };
    }

    _hydrateSession(session) {
        return {
            ...session,
            timeoutId: null,
            settlementTimeoutId: null,
        };
    }

    _cacheSession(session) {
        this.sessions.set(session.coupleId, session);
        this.userToCouple.set(session.creatorId, session.coupleId);
        this.userToCouple.set(session.partnerId, session.coupleId);
    }

    async saveSession(session) {
        if (!this.redis) return;
        try {
            const payload = this._serializeSession(session);
            const serialized = JSON.stringify(payload);
            const multi = this.redis.multi();
            multi.set(`${SESSION_KEY_PREFIX}${session.coupleId}`, serialized);
            multi.sadd(SESSION_SET_KEY, session.coupleId);
            multi.set(`${USER_KEY_PREFIX}${session.creatorId}`, session.coupleId);
            multi.set(`${USER_KEY_PREFIX}${session.partnerId}`, session.coupleId);
            await multi.exec();
            await this._publishRedisEvent({
                type: 'upsert',
                session: payload,
            });
        } catch (error) {
            console.error('[Redis] Failed to persist session:', error?.message || error);
        }
    }

    async _removeSessionFromRedis(session) {
        if (!this.redis) return;
        try {
            const multi = this.redis.multi();
            multi.del(`${SESSION_KEY_PREFIX}${session.coupleId}`);
            multi.del(`${USER_KEY_PREFIX}${session.creatorId}`);
            multi.del(`${USER_KEY_PREFIX}${session.partnerId}`);
            multi.srem(SESSION_SET_KEY, session.coupleId);
            await multi.exec();
            await this._publishRedisEvent({
                type: 'delete',
                coupleId: session.coupleId,
            });
        } catch (error) {
            console.error('[Redis] Failed to delete session:', error?.message || error);
        }
    }

    async _publishRedisEvent(event) {
        if (!this.redis) return;
        const payload = JSON.stringify({
            ...event,
            sourceId: this.instanceId,
        });
        await this.redis.publish(SESSION_CHANNEL, payload);
    }

    async _hydrateFromRedis() {
        const coupleIds = await this.redis.smembers(SESSION_SET_KEY);
        if (!coupleIds || coupleIds.length === 0) return;

        const keys = coupleIds.map((id) => `${SESSION_KEY_PREFIX}${id}`);
        const rawSessions = await this.redis.mget(keys);
        rawSessions.forEach((raw) => {
            if (!raw) return;
            try {
                const parsed = JSON.parse(raw);
                const session = this._hydrateSession(parsed);
                this._cacheSession(session);
            } catch (error) {
                console.warn('[Redis] Skipping invalid session payload:', error?.message || error);
            }
        });
    }

    _handleRedisMessage(message) {
        if (!message) return;
        try {
            const event = JSON.parse(message);
            if (event.sourceId === this.instanceId) return;
            if (event.type === 'upsert' && event.session) {
                const session = this._hydrateSession(event.session);
                this._cacheSession(session);
            } else if (event.type === 'delete' && event.coupleId) {
                const session = this.sessions.get(event.coupleId);
                if (session) {
                    this.userToCouple.delete(session.creatorId);
                    this.userToCouple.delete(session.partnerId);
                }
                this.sessions.delete(event.coupleId);
            }
        } catch (error) {
            console.warn('[Redis] Failed to process session event:', error?.message || error);
        }
    }
}

module.exports = SessionStateRepository;
