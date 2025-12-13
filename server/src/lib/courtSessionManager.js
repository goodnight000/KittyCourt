/**
 * Court Session Manager - Clean Architecture
 * 
 * Single source of truth for court session state.
 * In-memory management with database checkpoints only.
 * 
 * Phases: IDLE → PENDING → EVIDENCE → DELIBERATING → VERDICT → CLOSED
 */

const { v4: uuidv4 } = require('uuid');
const { incrementUsage } = require('./usageTracking');
const { canUseFeature } = require('./usageLimits');

// Session phases (internal state machine)
const PHASE = {
    IDLE: 'IDLE',
    PENDING: 'PENDING',
    EVIDENCE: 'EVIDENCE',
    DELIBERATING: 'DELIBERATING',
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
    DELIBERATING: 'DELIBERATING',
    VERDICT: 'VERDICT',
    WAITING_ACCEPT: 'WAITING_ACCEPT',
    RATING: 'RATING',
    CLOSED: 'CLOSED'
};

// Timeouts
const TIMEOUT = {
    PENDING: 10 * 60 * 1000,      // 10 minutes
    EVIDENCE: 60 * 60 * 1000,     // 1 hour
    VERDICT: 60 * 60 * 1000,      // 1 hour (auto-accept)
    SETTLE_REQUEST: 5 * 60 * 1000 // 5 minutes for settlement response
};

class CourtSessionManager {
    constructor() {
        // coupleId → Session
        this.sessions = new Map();

        // userId → coupleId (quick lookup)
        this.userToCouple = new Map();

        // External services (set after init)
        this.wsService = null;
        this.dbService = null;
        this.judgeEngine = null;
    }

    // === Service Injection ===

    setWebSocketService(ws) { this.wsService = ws; }
    setDatabaseService(db) { this.dbService = db; }
    setJudgeEngine(engine) { this.judgeEngine = engine; }

    // === Session Lookup ===

    getSession(coupleId) {
        return this.sessions.get(coupleId);
    }

    getSessionForUser(userId) {
        const coupleId = this.userToCouple.get(userId);
        return coupleId ? this.sessions.get(coupleId) : null;
    }

    // === State Sync ===

    getStateForUser(userId) {
        const session = this.getSessionForUser(userId);
        if (!session) {
            return { phase: PHASE.IDLE, myViewPhase: VIEW_PHASE.IDLE, session: null };
        }

        const isCreator = session.creatorId === userId;
        const myViewPhase = this._computeViewPhase(session, isCreator);

        return {
            phase: session.phase,
            myViewPhase,
            session: this._sanitize(session)
        };
    }

    _computeViewPhase(session, isCreator) {
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

            case PHASE.DELIBERATING:
                return VIEW_PHASE.DELIBERATING;

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

    _sanitize(session) {
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
            resolvedAt: session.resolvedAt || null
        };
    }

    // === Notify Users ===

    _notifyUser(userId, session) {
        if (!this.wsService) return;
        const state = this.getStateForUser(userId);
        this.wsService.emitToUser(userId, 'court:state', state);
    }

    _notifyBoth(session) {
        this._notifyUser(session.creatorId, session);
        this._notifyUser(session.partnerId, session);
    }

    // === Actions ===

    /**
     * Creator serves partner (creates pending session)
     */
    async serve(creatorId, partnerId, coupleId, judgeType = 'logical') {
        // Check for existing session
        if (this.userToCouple.has(creatorId) || this.userToCouple.has(partnerId)) {
            throw new Error('One or both users already in a session');
        }

        const effectiveCoupleId = coupleId || `${creatorId}-${partnerId}`;
        const sessionId = uuidv4();

        const session = {
            id: sessionId,
            coupleId: effectiveCoupleId,
            creatorId,
            partnerId,
            phase: PHASE.PENDING,
            caseId: null,
            judgeType, // Selected judge type for verdict generation
            creator: this._emptyUserState(),
            partner: this._emptyUserState(),
            verdict: null,
            addendum: null,
            settlementRequested: null,
            settlementTimeoutId: null,
            timeoutId: null,
            createdAt: Date.now()
        };

        // Set pending timeout
        session.timeoutId = setTimeout(() => {
            this._handlePendingTimeout(effectiveCoupleId);
        }, TIMEOUT.PENDING);

        this.sessions.set(effectiveCoupleId, session);
        this.userToCouple.set(creatorId, effectiveCoupleId);
        this.userToCouple.set(partnerId, effectiveCoupleId);

        console.log(`[Court] Session ${sessionId} created (PENDING)`);

        // Create DB row immediately so a crash during PENDING can recover.
        await this._dbCheckpoint(session, 'create');

        this._notifyBoth(session);
        return session;
    }

    /**
     * Partner accepts summons
     */
    async accept(partnerId) {
        const session = this.getSessionForUser(partnerId);
        if (!session) throw new Error('No pending session found');
        if (session.phase !== PHASE.PENDING) throw new Error('Session not in PENDING phase');
        if (session.partnerId !== partnerId) throw new Error('Not the intended partner');

        // Clear pending timeout
        if (session.timeoutId) {
            clearTimeout(session.timeoutId);
            session.timeoutId = null;
        }

        // Transition to EVIDENCE
        session.phase = PHASE.EVIDENCE;

        // Set evidence timeout (1 hour)
        session.timeoutId = setTimeout(() => {
            this._handleEvidenceTimeout(session.coupleId);
        }, TIMEOUT.EVIDENCE);

        // Checkpoint to database (update existing row created at serve)
        await this._dbCheckpoint(session, 'accept');

        console.log(`[Court] Session ${session.id} accepted (EVIDENCE)`);

        this._notifyBoth(session);
        return session;
    }

    /**
     * Cancel pending session (creator only)
     */
    async cancel(userId) {
        const session = this.getSessionForUser(userId);
        if (!session) throw new Error('No session found');
        if (session.phase !== PHASE.PENDING) throw new Error('Can only cancel pending sessions');
        if (session.creatorId !== userId) throw new Error('Only creator can cancel');

        // Best-effort delete of persisted pending session
        await this._deleteSession(session);
        this._cleanup(session.coupleId);
        console.log(`[Court] Session ${session.id} cancelled`);
    }

    /**
     * Submit evidence
     */
    async submitEvidence(userId, evidence, feelings) {
        const session = this.getSessionForUser(userId);
        if (!session) throw new Error('No active session');
        if (session.phase !== PHASE.EVIDENCE) throw new Error('Not in EVIDENCE phase');

        const isCreator = session.creatorId === userId;
        const userState = isCreator ? session.creator : session.partner;

        if (userState.evidenceSubmitted) throw new Error('Evidence already submitted');

        userState.evidenceSubmitted = true;
        userState.evidence = evidence;
        userState.feelings = feelings;

        const bothSubmitted = session.creator.evidenceSubmitted && session.partner.evidenceSubmitted;

        if (bothSubmitted) {
            // Clear evidence timeout
            if (session.timeoutId) {
                clearTimeout(session.timeoutId);
                session.timeoutId = null;
            }

            // Transition to DELIBERATING
            session.phase = PHASE.DELIBERATING;
            console.log(`[Court] Session ${session.id} → DELIBERATING`);

            // Notify both immediately
            this._notifyBoth(session);

            // Generate verdict (async, doesn't block)
            this._generateVerdict(session);
        } else {
            this._notifyBoth(session);
        }

        // Checkpoint
        await this._dbCheckpoint(session, 'evidence');

        return { session, bothSubmitted };
    }

    /**
     * Accept verdict
     */
    async acceptVerdict(userId) {
        const session = this.getSessionForUser(userId);
        if (!session) throw new Error('No active session');
        if (session.phase !== PHASE.VERDICT) throw new Error('Not in VERDICT phase');

        const isCreator = session.creatorId === userId;
        const userState = isCreator ? session.creator : session.partner;

        userState.verdictAccepted = true;

        // Persist acceptance state so a crash doesn't lose who accepted.
        await this._dbCheckpoint(session, 'verdict_accept');

        const bothAccepted = session.creator.verdictAccepted && session.partner.verdictAccepted;

        if (bothAccepted) {
            await this._closeSession(session, 'accepted');
        } else {
            this._notifyBoth(session);
        }

        return { session, bothAccepted };
    }

    /**
     * Request settlement
     */
    requestSettlement(userId) {
        const session = this.getSessionForUser(userId);
        if (!session) throw new Error('No active session');
        if (![PHASE.EVIDENCE, PHASE.DELIBERATING].includes(session.phase)) {
            throw new Error('Settlement only allowed during EVIDENCE or DELIBERATING');
        }

        session.settlementRequested = userId;

        // Expire the request if partner ignores it
        if (session.settlementTimeoutId) {
            clearTimeout(session.settlementTimeoutId);
            session.settlementTimeoutId = null;
        }
        session.settlementTimeoutId = setTimeout(() => {
            const current = this.sessions.get(session.coupleId);
            if (!current) return;
            if (current.settlementRequested === userId) {
                current.settlementRequested = null;
                current.settlementTimeoutId = null;
                this._notifyBoth(current);
                this._dbCheckpoint(current, 'settlement_expired');
            }
        }, TIMEOUT.SETTLE_REQUEST);

        // Notify partner
        const partnerId = session.creatorId === userId ? session.partnerId : session.creatorId;
        if (this.wsService) {
            this.wsService.emitToUser(partnerId, 'court:settlement_requested', { byUserId: userId });
        }

        console.log(`[Court] Settlement requested by ${userId}`);
        this._dbCheckpoint(session, 'settlement_request');
        return session;
    }

    /**
     * Accept settlement
     */
    async acceptSettlement(userId) {
        const session = this.getSessionForUser(userId);
        if (!session) throw new Error('No active session');
        if (!session.settlementRequested) throw new Error('No settlement request pending');
        if (session.settlementRequested === userId) throw new Error('Cannot accept your own settlement');

        if (session.settlementTimeoutId) {
            clearTimeout(session.settlementTimeoutId);
            session.settlementTimeoutId = null;
        }

        // Delete from database and cleanup
        await this._deleteSession(session);
        this._cleanup(session.coupleId);

        console.log(`[Court] Session ${session.id} settled`);
    }

    /**
     * Decline settlement (case continues)
     */
    declineSettlement(userId) {
        const session = this.getSessionForUser(userId);
        if (!session) throw new Error('No active session');
        if (!session.settlementRequested) throw new Error('No settlement request pending');
        if (session.settlementRequested === userId) throw new Error('Cannot decline your own settlement');

        const requesterId = session.settlementRequested;

        if (session.settlementTimeoutId) {
            clearTimeout(session.settlementTimeoutId);
            session.settlementTimeoutId = null;
        }

        session.settlementRequested = null;

        // Notify both with updated state (request cleared)
        this._notifyBoth(session);
        this._dbCheckpoint(session, 'settlement_declined');

        // Notify requester specifically so they can show an indicator
        if (this.wsService) {
            this.wsService.emitToUser(requesterId, 'court:settlement_declined', { byUserId: userId });
        }

        console.log(`[Court] Settlement declined by ${userId}`);
        return session;
    }

    /**
     * Submit addendum (re-run LLM)
     */
    async submitAddendum(userId, text) {
        const session = this.getSessionForUser(userId);
        if (!session) throw new Error('No active session');
        if (session.phase !== PHASE.VERDICT) throw new Error('Addendum only allowed in VERDICT phase');

        // Cancel any existing verdict auto-close timer before re-deliberation
        if (session.timeoutId) {
            clearTimeout(session.timeoutId);
            session.timeoutId = null;
        }

        const isCreator = session.creatorId === userId;

        // Store addendum
        session.addendum = {
            userId,
            text,
            fromCreator: isCreator,
            submittedAt: Date.now()
        };

        // Reset acceptances
        session.creator.verdictAccepted = false;
        session.partner.verdictAccepted = false;

        // Transition back to deliberating for re-generation
        session.phase = PHASE.DELIBERATING;
        console.log(`[Court] Addendum submitted, re-generating verdict`);

        this._notifyBoth(session);

        // Re-generate verdict with addendum
        await this._generateVerdict(session);

        return session;
    }

    // === Private Helpers ===

    _emptyUserState() {
        return {
            evidenceSubmitted: false,
            evidence: null,
            feelings: null,
            verdictAccepted: false
        };
    }

    _cleanup(coupleId) {
        const session = this.sessions.get(coupleId);
        if (!session) return;

        if (session.timeoutId) {
            clearTimeout(session.timeoutId);
        }

        if (session.settlementTimeoutId) {
            clearTimeout(session.settlementTimeoutId);
        }

        this.userToCouple.delete(session.creatorId);
        this.userToCouple.delete(session.partnerId);
        this.sessions.delete(coupleId);

        // Notify both users they're back to IDLE
        if (this.wsService) {
            const idleState = { phase: PHASE.IDLE, myViewPhase: VIEW_PHASE.IDLE, session: null };
            this.wsService.emitToUser(session.creatorId, 'court:state', idleState);
            this.wsService.emitToUser(session.partnerId, 'court:state', idleState);
        }
    }

    async _generateVerdict(session) {
        if (!this.judgeEngine) {
            console.error('[Court] No judge engine configured');
            return;
        }

        try {
            console.log(`[Court] Generating verdict for session ${session.id}`);

            // Ensure we don't have stale timers (e.g., addendum re-generation)
            if (session.timeoutId) {
                clearTimeout(session.timeoutId);
                session.timeoutId = null;
            }

            // Build case data for judge engine
            const caseData = {
                participants: {
                    userA: { id: session.creatorId, name: 'Partner A' },
                    userB: { id: session.partnerId, name: 'Partner B' }
                },
                submissions: {
                    userA: {
                        cameraFacts: session.creator.evidence,
                        theStoryIamTellingMyself: session.creator.feelings
                    },
                    userB: {
                        cameraFacts: session.partner.evidence,
                        theStoryIamTellingMyself: session.partner.feelings
                    }
                }
            };

            // Add addendum if present
            if (session.addendum) {
                const key = session.addendum.fromCreator ? 'userA' : 'userB';
                caseData.submissions[key].addendum = session.addendum.text;
            }

            // Enforce subscription limits before spending LLM tokens.
            try {
                const judgeType = session.judgeType || 'logical';
                const usageType = judgeType === 'fast'
                    ? 'lightning'
                    : judgeType === 'best'
                        ? 'whiskers'
                        : 'mittens';

                const usage = await canUseFeature({ userId: session.creatorId, type: usageType });
                if (!usage.allowed) {
                    session.verdict = { status: 'error', error: 'Usage limit reached', usage };
                    session.resolvedAt = Date.now();
                    session.phase = PHASE.VERDICT;
                    await this._dbCheckpoint(session, 'verdict');
                    this._notifyBoth(session);
                    return;
                }
            } catch (e) {
                // Best-effort: if we can't verify limits, don't block the session.
                console.warn('[Court] Failed to verify usage limits:', e?.message || e);
            }

            // Call judge engine with selected judge type
            const result = await this.judgeEngine.deliberate(caseData, {
                judgeType: session.judgeType || 'logical'
            });

            // Store verdict
            session.verdict = result;
            session.resolvedAt = Date.now();
            session.phase = PHASE.VERDICT;

            // Record usage for the creator (best-effort; do not block verdict delivery).
            try {
                const judgeType = session.judgeType || 'logical';
                const usageType = judgeType === 'fast'
                    ? 'lightning'
                    : judgeType === 'best'
                        ? 'whiskers'
                        : 'mittens';
                await incrementUsage({ userId: session.creatorId, type: usageType });
            } catch (e) {
                console.warn('[Court] Failed to increment usage:', e?.message || e);
            }

            // Set verdict timeout (1 hour auto-accept)
            session.timeoutId = setTimeout(() => {
                this._handleVerdictTimeout(session.coupleId);
            }, TIMEOUT.VERDICT);

            // Checkpoint and notify
            await this._dbCheckpoint(session, 'verdict');
            this._notifyBoth(session);

            console.log(`[Court] Verdict generated for session ${session.id}`);
        } catch (error) {
            console.error('[Court] Verdict generation failed:', error);
            if (this.wsService) {
                this.wsService.emitToUser(session.creatorId, 'court:error', { message: 'Verdict generation failed' });
                this.wsService.emitToUser(session.partnerId, 'court:error', { message: 'Verdict generation failed' });
            }
        }
    }

    async _closeSession(session, reason) {
        if (session.timeoutId) {
            clearTimeout(session.timeoutId);
            session.timeoutId = null;
        }

        if (session.settlementTimeoutId) {
            clearTimeout(session.settlementTimeoutId);
            session.settlementTimeoutId = null;
        }

        session.phase = PHASE.CLOSED;

        // Persist to case history (best-effort)
        try {
            if (this.dbService?.saveCaseFromSession && !session.caseId) {
                session.caseId = await this.dbService.saveCaseFromSession(session);
            }
        } catch (error) {
            console.error('[Court] Failed to persist case history:', error);
        }

        // Final checkpoint
        await this._dbCheckpoint(session, 'close');

        // Trigger background memory extraction
        if (this.judgeEngine?.triggerBackgroundExtraction) {
            this.judgeEngine.triggerBackgroundExtraction(session);
        }

        console.log(`[Court] Session ${session.id} closed (${reason})`);

        this._notifyBoth(session);

        // Cleanup after a short delay (allow celebration to show)
        setTimeout(() => {
            this._cleanup(session.coupleId);
        }, 30000); // 30 seconds for celebration
    }

    // === Timeout Handlers ===

    _handlePendingTimeout(coupleId) {
        const session = this.sessions.get(coupleId);
        if (!session || session.phase !== PHASE.PENDING) return;

        console.log(`[Court] Pending timeout for session ${session.id}`);
        this._deleteSession(session);
        this._cleanup(coupleId);
    }

    async _handleEvidenceTimeout(coupleId) {
        const session = this.sessions.get(coupleId);
        if (!session || session.phase !== PHASE.EVIDENCE) return;

        console.log(`[Court] Evidence timeout for session ${session.id} - case tossed`);

        // Delete from database
        await this._deleteSession(session);
        this._cleanup(coupleId);
    }

    async _handleVerdictTimeout(coupleId) {
        const session = this.sessions.get(coupleId);
        if (!session || session.phase !== PHASE.VERDICT) return;

        console.log(`[Court] Verdict timeout for session ${session.id} - auto-accepting`);

        // Auto-accept for both
        session.creator.verdictAccepted = true;
        session.partner.verdictAccepted = true;

        await this._closeSession(session, 'auto-accepted');
    }

    // === Database Operations ===

    async _dbCheckpoint(session, action) {
        if (!this.dbService) return;
        try {
            await this.dbService.checkpoint(session, action);
        } catch (error) {
            console.error('[Court] DB checkpoint failed:', error);
        }
    }

    async _deleteSession(session) {
        if (!this.dbService) return;
        try {
            await this.dbService.deleteSession(session.id);
        } catch (error) {
            console.error('[Court] DB delete failed:', error);
        }
    }

    // === Recovery ===

    async recoverFromDatabase(sessions) {
        for (const dbSession of sessions) {
            try {
                const session = this._reconstructFromDB(dbSession);
                this.sessions.set(session.coupleId, session);
                this.userToCouple.set(session.creatorId, session.coupleId);
                this.userToCouple.set(session.partnerId, session.coupleId);
                console.log(`[Court] Recovered session ${session.id}`);
            } catch (error) {
                console.error('[Court] Failed to recover session:', error);
            }
        }
    }

    _reconstructFromDB(db) {
        const evidence = db.evidence_submissions || {};
        const acceptances = db.verdict_acceptances || {};

        const status = String(db.status || '').toUpperCase();
        const phaseFromStatus = (() => {
            if (status === 'CLOSED') return PHASE.CLOSED;
            if (status === 'PENDING' || status === 'WAITING') return PHASE.PENDING;
            if (status === 'DELIBERATING') return PHASE.DELIBERATING;
            if (status === 'VERDICT') return PHASE.VERDICT;
            if (status === 'EVIDENCE' || status === 'IN_SESSION') return PHASE.EVIDENCE;
            // Fallback heuristics
            if (db.verdict) return PHASE.VERDICT;
            return PHASE.EVIDENCE;
        })();

        const settle = db.settle_requests || {};
        const settlementRequested = settle.creator && !settle.partner
            ? db.created_by
            : (settle.partner && !settle.creator ? db.partner_id : null);

        return {
            id: db.id,
            coupleId: db.couple_id || `${db.created_by}-${db.partner_id}`,
            creatorId: db.created_by,
            partnerId: db.partner_id,
            phase: phaseFromStatus,
            caseId: db.case_id || null,
            creator: {
                evidenceSubmitted: evidence.creator?.submitted || false,
                evidence: evidence.creator?.evidence || null,
                feelings: evidence.creator?.feelings || null,
                verdictAccepted: acceptances.creator || false
            },
            partner: {
                evidenceSubmitted: evidence.partner?.submitted || false,
                evidence: evidence.partner?.evidence || null,
                feelings: evidence.partner?.feelings || null,
                verdictAccepted: acceptances.partner || false
            },
            verdict: db.verdict,
            addendum: null,
            settlementRequested,
            timeoutId: null,
            settlementTimeoutId: null,
            createdAt: new Date(db.created_at).getTime()
        };
    }

    // === Debug ===

    getStats() {
        return {
            activeSessions: this.sessions.size,
            userMappings: this.userToCouple.size
        };
    }
}

// Singleton export
const courtSessionManager = new CourtSessionManager();

module.exports = {
    courtSessionManager,
    PHASE,
    VIEW_PHASE,
    TIMEOUT
};
