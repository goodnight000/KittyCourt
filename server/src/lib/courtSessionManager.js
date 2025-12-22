/**
 * Court Session Manager - Clean Architecture
 * 
 * Single source of truth for court session state.
 * In-memory management with database checkpoints only.
 * 
 * Phases: IDLE → PENDING → EVIDENCE → ANALYZING → PRIMING → JOINT_READY → RESOLUTION → VERDICT → CLOSED
 */

const { v4: uuidv4 } = require('uuid');
const { incrementUsage } = require('./usageTracking');
const { canUseFeature } = require('./usageLimits');

// Session phases (internal state machine)
// V2.0 adds: ANALYZING, PRIMING, JOINT_READY, RESOLUTION
const PHASE = {
    IDLE: 'IDLE',
    PENDING: 'PENDING',
    EVIDENCE: 'EVIDENCE',
    // V2.0 new phases
    ANALYZING: 'ANALYZING',       // LLM Call 1 in progress
    PRIMING: 'PRIMING',           // Users viewing individual priming pages
    JOINT_READY: 'JOINT_READY',   // Both ready for joint menu
    RESOLUTION: 'RESOLUTION',     // Users selecting resolution
    // Final phases
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
    // V2.0 new view phases
    ANALYZING: 'ANALYZING',                   // LLM Call 1 running
    PRIMING: 'PRIMING',                       // Viewing individual priming
    WAITING_PRIMING: 'WAITING_PRIMING',       // Partner still on priming
    JOINT_MENU: 'JOINT_MENU',                 // Viewing joint menu
    WAITING_JOINT: 'WAITING_JOINT',           // Partner not ready for joint
    RESOLUTION_SELECT: 'RESOLUTION_SELECT',   // Selecting resolution
    RESOLUTION_MISMATCH: 'RESOLUTION_MISMATCH', // Different picks
    WAITING_RESOLUTION: 'WAITING_RESOLUTION', // Partner hasn't picked
    // Final phases
    VERDICT: 'VERDICT',
    WAITING_ACCEPT: 'WAITING_ACCEPT',
    RATING: 'RATING',
    CLOSED: 'CLOSED'
};

// Timeouts (all new phases get 1 hour per user requirements)
const TIMEOUT = {
    PENDING: 10 * 60 * 1000,        // 10 minutes
    EVIDENCE: 60 * 60 * 1000,       // 1 hour
    ANALYZING: 5 * 60 * 1000,       // 5 minutes (LLM should complete faster)
    PRIMING: 60 * 60 * 1000,        // 1 hour
    JOINT_READY: 60 * 60 * 1000,    // 1 hour
    RESOLUTION: 60 * 60 * 1000,     // 1 hour
    VERDICT: 60 * 60 * 1000,        // 1 hour (auto-accept)
    SETTLE_REQUEST: 5 * 60 * 1000   // 5 minutes for settlement response
};

const ADDENDUM_LIMIT = 2;
const HYBRID_RESOLUTION_ID = 'resolution_hybrid';

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

            case PHASE.ANALYZING:
                return VIEW_PHASE.ANALYZING;

            case PHASE.PRIMING:
                // Check if I'm ready but partner isn't
                if (myState.primingReady && !partnerState.primingReady) {
                    return VIEW_PHASE.WAITING_PRIMING;
                }
                return VIEW_PHASE.PRIMING;

            case PHASE.JOINT_READY:
                // Check if I'm ready but partner isn't
                if (myState.jointReady && !partnerState.jointReady) {
                    return VIEW_PHASE.WAITING_JOINT;
                }
                return VIEW_PHASE.JOINT_MENU;

            case PHASE.RESOLUTION:
                if (this._isMismatchActive(session)) {
                    return VIEW_PHASE.RESOLUTION_MISMATCH;
                }

                // Check resolution picks
                const myPick = isCreator ? session.userAResolutionPick : session.userBResolutionPick;
                const partnerPick = isCreator ? session.userBResolutionPick : session.userAResolutionPick;

                if (!myPick) {
                    return VIEW_PHASE.RESOLUTION_SELECT;
                }
                if (myPick && !partnerPick) {
                    return VIEW_PHASE.WAITING_RESOLUTION;
                }
                // Both picked - should transition to VERDICT soon
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
     * Dismiss session from any phase (for error recovery)
     * Either user can dismiss - this is for abandoning broken/errored sessions
     */
    async dismiss(userId) {
        const session = this.getSessionForUser(userId);
        if (!session) throw new Error('No session found');

        // Verify the user is part of this session
        if (session.creatorId !== userId && session.partnerId !== userId) {
            throw new Error('User not part of this session');
        }

        console.log(`[Court] Session ${session.id} dismissed by ${userId} from phase ${session.phase}`);

        // Delete from database and cleanup
        await this._deleteSession(session);
        this._cleanup(session.coupleId);
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

            // Transition to analysis phase (v2)
            session.phase = PHASE.ANALYZING;
            console.log(`[Court] Session ${session.id} → ANALYZING`);

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
        if (![PHASE.EVIDENCE, PHASE.ANALYZING].includes(session.phase)) {
            throw new Error('Settlement only allowed during EVIDENCE or ANALYZING');
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

        if ((session.addendumCount || 0) >= ADDENDUM_LIMIT) {
            throw new Error('Addendum limit reached for this case.');
        }

        // Cancel any existing verdict auto-close timer before re-deliberation
        if (session.timeoutId) {
            clearTimeout(session.timeoutId);
            session.timeoutId = null;
        }

        const isCreator = session.creatorId === userId;
        const fromUser = isCreator ? 'userA' : 'userB';
        const entry = {
            userId,
            fromUser,
            text,
            submittedAt: Date.now()
        };
        session.addendumHistory = [...(session.addendumHistory || []), entry];
        session.addendumCount = (session.addendumCount || 0) + 1;

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

        console.log(`[Court] Addendum submitted, re-running v2 pipeline`);

        await this._dbCheckpoint(session, 'addendum_submitted');
        this._notifyBoth(session);

        // Re-generate verdict with addendum
        await this._generateVerdict(session);

        return session;
    }

    // === V2.0 Actions ===

    /**
     * Mark priming as complete (user finished reading priming page)
     */
    async markPrimingComplete(userId) {
        const session = this.getSessionForUser(userId);
        if (!session) throw new Error('No active session');
        if (session.phase !== PHASE.PRIMING) throw new Error('Not in PRIMING phase');

        const isCreator = session.creatorId === userId;
        const userState = isCreator ? session.creator : session.partner;

        userState.primingReady = true;

        const bothReady = session.creator.primingReady && session.partner.primingReady;

        if (bothReady) {
            // Clear priming timeout
            if (session.timeoutId) {
                clearTimeout(session.timeoutId);
                session.timeoutId = null;
            }

            // Transition to JOINT_READY
            session.phase = PHASE.JOINT_READY;
            console.log(`[Court] Session ${session.id} → JOINT_READY`);

            // Set joint timeout
            session.timeoutId = setTimeout(() => {
                this._handleJointTimeout(session.coupleId);
            }, TIMEOUT.JOINT_READY);
        }

        await this._dbCheckpoint(session, 'priming_complete');
        this._notifyBoth(session);

        return { session, bothReady };
    }

    /**
     * Mark joint menu as ready (user ready to proceed from joint menu)
     */
    async markJointReady(userId) {
        const session = this.getSessionForUser(userId);
        if (!session) throw new Error('No active session');
        if (session.phase !== PHASE.JOINT_READY) throw new Error('Not in JOINT_READY phase');

        const isCreator = session.creatorId === userId;
        const userState = isCreator ? session.creator : session.partner;

        userState.jointReady = true;

        const bothReady = session.creator.jointReady && session.partner.jointReady;

        if (bothReady) {
            // Clear joint timeout
            if (session.timeoutId) {
                clearTimeout(session.timeoutId);
                session.timeoutId = null;
            }

            // Transition to RESOLUTION
            session.phase = PHASE.RESOLUTION;
            console.log(`[Court] Session ${session.id} → RESOLUTION`);

            // Set resolution timeout
            session.timeoutId = setTimeout(() => {
                this._handleResolutionTimeout(session.coupleId);
            }, TIMEOUT.RESOLUTION);
        }

        await this._dbCheckpoint(session, 'joint_ready');
        this._notifyBoth(session);

        return { session, bothReady };
    }

    /**
     * Submit resolution pick
     */
    async submitResolutionPick(userId, resolutionId) {
        const session = this.getSessionForUser(userId);
        if (!session) throw new Error('No active session');
        if (session.phase !== PHASE.RESOLUTION) throw new Error('Not in RESOLUTION phase');

        const isCreator = session.creatorId === userId;
        const myKey = isCreator ? 'userA' : 'userB';
        const partnerKey = isCreator ? 'userB' : 'userA';

        if (this._isMismatchActive(session)) {
            this._ensureMismatchState(session);
            const mismatchPicks = session.mismatchPicks || { userA: null, userB: null };
            const lockId = session.mismatchLock;
            const lockOwner = session.mismatchLockBy;

            if (lockId && lockOwner && lockOwner !== userId) {
                if (lockId !== resolutionId) {
                    throw new Error('You both need to pick the same resolution to continue.');
                }
                mismatchPicks[myKey] = resolutionId;
            } else {
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
                const chosenResolution = this._findResolutionById(session, mismatchPicks.userA);
                if (!chosenResolution) throw new Error('Selected resolution not found');
                session.finalResolution = chosenResolution;
                await this._finalizeResolution(session);
            }

            await this._dbCheckpoint(session, 'resolution_mismatch_pick');
            this._notifyBoth(session);

            return { session, bothPicked, sameChoice };
        }

        if (isCreator) {
            session.userAResolutionPick = resolutionId;
        } else {
            session.userBResolutionPick = resolutionId;
        }

        const bothPicked = session.userAResolutionPick && session.userBResolutionPick;

        if (bothPicked) {
            const sameChoice = session.userAResolutionPick === session.userBResolutionPick;

            if (sameChoice) {
                // Both picked same - finalize resolution
                const chosenResolution = this._findResolutionById(session, session.userAResolutionPick);
                if (!chosenResolution) throw new Error('Selected resolution not found');
                session.finalResolution = chosenResolution;
                await this._finalizeResolution(session);
            } else {
                await this._startMismatch(session);
                return { session, bothPicked, sameChoice: false, mismatch: true };
            }
        }

        await this._dbCheckpoint(session, 'resolution_pick');
        this._notifyBoth(session);

        return {
            session,
            bothPicked,
            sameChoice: bothPicked ? session.userAResolutionPick === session.userBResolutionPick : null
        };
    }

    /**
     * Accept partner's resolution choice
     */
    async acceptPartnerResolution(userId) {
        const session = this.getSessionForUser(userId);
        if (!session) throw new Error('No active session');
        if (session.phase !== PHASE.RESOLUTION) throw new Error('Not in RESOLUTION phase');

        const isCreator = session.creatorId === userId;
        const partnerPick = isCreator ? session.userBResolutionPick : session.userAResolutionPick;

        if (!partnerPick) throw new Error('Partner has not picked yet');

        const chosenResolution = this._findResolutionById(session, partnerPick);
        session.finalResolution = chosenResolution;

        await this._finalizeResolution(session);
        await this._dbCheckpoint(session, 'accept_partner_resolution');
        this._notifyBoth(session);

        return { session };
    }

    /**
     * Request hybrid resolution generation
     */
    async requestHybridResolution(userId) {
        const session = this.getSessionForUser(userId);
        if (!session) throw new Error('No active session');
        if (session.phase !== PHASE.RESOLUTION) throw new Error('Not in RESOLUTION phase');
        if (!this._isMismatchActive(session)) {
            throw new Error('Hybrid resolution is only available after different picks.');
        }

        this._ensureMismatchState(session);

        if (session.hybridResolution || session.hybridResolutionPending) {
            return { session };
        }

        session.hybridResolutionPending = true;
        await this._dbCheckpoint(session, 'hybrid_requested');
        this._notifyBoth(session);

        this._generateHybridResolution(session).catch((error) => {
            console.error('[Court] Hybrid generation failed:', error.message);
            session.hybridResolutionPending = false;
            this._notifyBoth(session);
        });

        return { session };
    }

    /**
     * Finalize resolution and transition to VERDICT
     */
    async _finalizeResolution(session) {
        if (session.timeoutId) {
            clearTimeout(session.timeoutId);
            session.timeoutId = null;
        }

        // Build verdict from final resolution
        const isHybrid = session.finalResolution?.id
            ? session.finalResolution.id === session.hybridResolution?.id
            : false;

        session.verdict = {
            status: 'success',
            judgeContent: {
                theSummary: session.jointMenu?.theSummary || 'Resolution found.',
                theSentence: {
                    title: session.finalResolution?.title || 'Resolution',
                    description: session.finalResolution?.description || session.finalResolution?.combinedDescription,
                    rationale: session.finalResolution?.rationale
                },
                closingStatement: session.jointMenu?.closingWisdom || 'May this resolution bring you closer together.'
            },
            _meta: {
                analysis: session.analysis || null,
                assessedIntensity: session.assessedIntensity,
                resolutions: session.resolutions,
                primingContent: session.primingContent || null,
                jointMenu: session.jointMenu || null,
                finalResolution: session.finalResolution,
                isHybrid
            }
        };

        this._recordVerdictVersion(session);

        session.resolvedAt = Date.now();
        session.phase = PHASE.VERDICT;

        // Set verdict timeout
        session.timeoutId = setTimeout(() => {
            this._handleVerdictTimeout(session.coupleId);
        }, TIMEOUT.VERDICT);

        console.log(`[Court] Session ${session.id} → VERDICT`);
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

    _buildCaseData(session) {
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
            },
            addendumHistory: session.addendumHistory || []
        };

        return caseData;
    }

    _isMismatchActive(session) {
        if (session.mismatchOriginal) return true;
        if (!session.userAResolutionPick || !session.userBResolutionPick) return false;
        if (session.finalResolution) return false;
        return session.userAResolutionPick !== session.userBResolutionPick;
    }

    _ensureMismatchState(session) {
        if (session.mismatchOriginal) return;
        if (!this._isMismatchActive(session)) return;

        session.mismatchOriginal = {
            userA: session.userAResolutionPick,
            userB: session.userBResolutionPick
        };
        session.mismatchPicks = { userA: null, userB: null };
        session.mismatchLock = null;
        session.mismatchLockBy = null;
    }

    _findResolutionById(session, resolutionId) {
        if (!resolutionId) return null;
        if (session.hybridResolution?.id === resolutionId) return session.hybridResolution;
        return (session.resolutions || []).find((resolution) => resolution.id === resolutionId) || null;
    }

    async _startMismatch(session) {
        this._ensureMismatchState(session);
        session.hybridResolution = null;
        session.hybridResolutionPending = true;

        await this._dbCheckpoint(session, 'resolution_mismatch');
        this._notifyBoth(session);

        this._generateHybridResolution(session).catch((error) => {
            console.error('[Court] Hybrid generation failed:', error.message);
            session.hybridResolutionPending = false;
            this._notifyBoth(session);
        });
    }

    async _generateHybridResolution(session) {
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

        const userAChoice = this._findResolutionById(session, session.mismatchOriginal.userA);
        const userBChoice = this._findResolutionById(session, session.mismatchOriginal.userB);

        if (!userAChoice || !userBChoice) {
            session.hybridResolutionPending = false;
            throw new Error('Hybrid resolution requested with missing choices');
        }

        const caseData = this._buildCaseData(session);
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

        await this._dbCheckpoint(session, 'hybrid_generated');
        this._notifyBoth(session);
    }

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
            session.verdict = { status: 'error', error: 'Judge engine unavailable. Please restart the server.' };
            session.resolvedAt = Date.now();
            session.phase = PHASE.VERDICT;
            await this._dbCheckpoint(session, 'engine_unavailable');
            this._notifyBoth(session);
            return;
        }

        try {
            console.log(`[Court] Starting v2.0 pipeline for session ${session.id}`);

            // Ensure we don't have stale timers
            if (session.timeoutId) {
                clearTimeout(session.timeoutId);
                session.timeoutId = null;
            }

            const caseData = this._buildCaseData(session);

            // Enforce subscription limits
            try {
                const judgeType = session.judgeType || 'logical';
                const usageType = judgeType === 'fast'
                    ? 'lightning'
                    : judgeType === 'best'
                        ? 'whiskers'
                        : 'mittens';

                const usage = await canUseFeature({ userId: session.creatorId, type: usageType });
                if (!usage.allowed) {
                    console.warn(`[Court] Usage limit reached for session ${session.id}`);
                    session.verdict = { status: 'error', error: 'Usage limit reached. Please upgrade to continue.', usage };
                    session.resolvedAt = Date.now();
                    session.phase = PHASE.VERDICT;
                    await this._dbCheckpoint(session, 'usage_blocked');
                    this._notifyBoth(session);
                    return;
                }
            } catch (e) {
                console.warn('[Court] Failed to verify usage limits:', e?.message || e);
            }

            const canUseV2 = typeof this.judgeEngine?.deliberatePhase1 === 'function'
                && typeof this.judgeEngine?.deliberatePhase2 === 'function';

            if (!canUseV2) {
                console.error('[Court] V2.0 pipeline unavailable');
                session.verdict = { status: 'error', error: 'V2 pipeline unavailable. Please restart the server.' };
                session.resolvedAt = Date.now();
                session.phase = PHASE.VERDICT;
                await this._dbCheckpoint(session, 'pipeline_unavailable');
                this._notifyBoth(session);
                return;
            }

            // V2.0 Pipeline: Phase 1 - Analyst + Repair Selection
            session.phase = PHASE.ANALYZING;
            this._notifyBoth(session);

            // Safety timeout for long-running analysis
            session.timeoutId = setTimeout(() => {
                this._handleAnalyzingTimeout(session.coupleId);
            }, TIMEOUT.ANALYZING);

            console.log(`[Court] V2.0 Phase 1: Analyst + Repair for session ${session.id}`);
            const phase1Result = await this.judgeEngine.deliberatePhase1(caseData, {
                judgeType: session.judgeType || 'logical'
            });

            // Store analysis and resolutions
            session.analysis = phase1Result.analysis;
            session.resolutions = phase1Result.resolutions;
            session.assessedIntensity = phase1Result.assessedIntensity;
            session.historicalContext = phase1Result.historicalContext || null;

            // V2.0 Pipeline: Phase 2 - Priming + Joint Menu
            console.log(`[Court] V2.0 Phase 2: Priming + Joint Menu for session ${session.id}`);
            const phase2Result = await this.judgeEngine.deliberatePhase2(phase1Result, {
                judgeType: session.judgeType || 'logical'
            });

            // Store priming and joint content
            session.primingContent = phase2Result.primingContent;
            session.jointMenu = phase2Result.jointMenu;

            // Clear analysis timeout before moving on
            if (session.timeoutId) {
                clearTimeout(session.timeoutId);
                session.timeoutId = null;
            }

            // Record usage
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

            // Transition to PRIMING phase
            session.phase = PHASE.PRIMING;

            // Set priming timeout
            session.timeoutId = setTimeout(() => {
                this._handlePrimingTimeout(session.coupleId);
            }, TIMEOUT.PRIMING);

            await this._dbCheckpoint(session, 'priming_generated');
            this._notifyBoth(session);

            console.log(`[Court] V2.0 pipeline complete for session ${session.id} → PRIMING`);
        } catch (error) {
            console.error('[Court] Verdict generation failed:', error);
            session.verdict = { status: 'error', error: error?.message || 'Verdict generation failed' };
            session.resolvedAt = Date.now();
            session.phase = PHASE.VERDICT;
            await this._dbCheckpoint(session, 'verdict_failed');
            this._notifyBoth(session);
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
            const caseData = this._buildCaseData(session);
            caseData.submissions.userA.selectedPrimaryEmotion ||= '';
            caseData.submissions.userA.coreNeed ||= '';
            caseData.submissions.userB.selectedPrimaryEmotion ||= '';
            caseData.submissions.userB.coreNeed ||= '';
            this.judgeEngine.triggerBackgroundExtraction(caseData, session.caseId || null);
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

    // V2.0 Timeout Handlers

    async _handleAnalyzingTimeout(coupleId) {
        const session = this.sessions.get(coupleId);
        if (!session || session.phase !== PHASE.ANALYZING) return;

        console.log(`[Court] Analyzing timeout for session ${session.id} - case tossed`);
        await this._deleteSession(session);
        this._cleanup(coupleId);
    }

    async _handlePrimingTimeout(coupleId) {
        const session = this.sessions.get(coupleId);
        if (!session || session.phase !== PHASE.PRIMING) return;

        console.log(`[Court] Priming timeout for session ${session.id} - case tossed`);
        await this._deleteSession(session);
        this._cleanup(coupleId);
    }

    async _handleJointTimeout(coupleId) {
        const session = this.sessions.get(coupleId);
        if (!session || session.phase !== PHASE.JOINT_READY) return;

        console.log(`[Court] Joint timeout for session ${session.id} - case tossed`);
        await this._deleteSession(session);
        this._cleanup(coupleId);
    }

    async _handleResolutionTimeout(coupleId) {
        const session = this.sessions.get(coupleId);
        if (!session || session.phase !== PHASE.RESOLUTION) return;

        console.log(`[Court] Resolution timeout for session ${session.id} - case tossed`);
        await this._deleteSession(session);
        this._cleanup(coupleId);
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
                verdictAccepted: acceptances.creator || false,
                primingReady: db.user_a_priming_ready || false,
                jointReady: db.user_a_joint_ready || false
            },
            partner: {
                evidenceSubmitted: evidence.partner?.submitted || !!db.user_b_evidence,
                evidence: evidence.partner?.evidence || db.user_b_evidence || null,
                feelings: evidence.partner?.feelings || db.user_b_feelings || null,
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
