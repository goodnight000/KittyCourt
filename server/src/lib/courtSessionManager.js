/**
 * Court Session Manager - Refactored Architecture
 *
 * Orchestrates court session lifecycle using specialized services.
 * This is a thin orchestration layer that delegates to focused services.
 *
 * Phases: IDLE → PENDING → EVIDENCE → ANALYZING → PRIMING → JOINT_READY → RESOLUTION → VERDICT → CLOSED
 */

const { incrementUsage } = require('./usageTracking');
const { canUseFeature } = require('./usageLimits');
const { sendNotificationToUser } = require('./notificationService');

// Import specialized services
const SessionStateRepository = require('./court/SessionStateRepository');
const PhaseTransitionController = require('./court/PhaseTransitionController');
const EvidenceService = require('./court/EvidenceService');
const ResolutionService = require('./court/ResolutionService');
const SettlementService = require('./court/SettlementService');

// Import helper modules
const { PHASE, VIEW_PHASE, ADDENDUM_LIMIT, computeViewPhase, sanitizeSession } = require('./court/StateSerializer');
const { TIMEOUT, getRemainingTimeout } = require('./court/timeoutHandlers');
const { reconstructFromDB } = require('./court/databaseService');
const { runVerdictPipeline, mapJudgeTypeToUsage } = require('./court/verdictGenerator');
const { buildCaseData } = require('./court/caseDataBuilder');

class CourtSessionManager {
    constructor() {
        // Initialize repository and services
        this.repository = new SessionStateRepository();

        // Services will be initialized after dependencies are injected
        this.phaseController = null;
        this.evidenceService = null;
        this.resolutionService = null;
        this.settlementService = null;

        // External services (set after init)
        this.wsService = null;
        this.dbService = null;
        this.judgeEngine = null;
    }

    // === Service Injection ===

    setWebSocketService(ws) {
        this.wsService = ws;
    }

    setDatabaseService(db) {
        this.dbService = db;
        this._initializeServices();
    }

    setJudgeEngine(engine) {
        this.judgeEngine = engine;
        this._initializeServices();
    }

    _initializeServices() {
        const deps = {
            dbService: this.dbService,
            wsService: this.wsService,
            judgeEngine: this.judgeEngine
        };

        this.phaseController = new PhaseTransitionController(deps);
        this.evidenceService = new EvidenceService();
        this.resolutionService = new ResolutionService(deps);
        this.settlementService = new SettlementService();

        // Restore timeouts for any sessions already hydrated from Redis
        this._restoreAllSessionTimeouts();
    }

    /**
     * Restore timeouts for all currently active sessions
     * Called after services are initialized to handle Redis-hydrated sessions
     */
    _restoreAllSessionTimeouts() {
        const sessions = this.repository.getAllSessions();
        for (const session of sessions) {
            // Only restore if no timeout is already set
            if (!session.timeoutId) {
                this._restorePhaseTimeout(session);
            }
            // Restore settlement timeout if pending
            if (!session.settlementTimeoutId) {
                this._restoreSettlementTimeout(session);
            }
        }
    }

    /**
     * Restore settlement timeout for a session if there was a pending settlement request
     */
    _restoreSettlementTimeout(session) {
        if (!session.settlementRequested || !session.settlementRequestedAt) {
            return;
        }

        const elapsed = Date.now() - session.settlementRequestedAt;
        const remaining = TIMEOUT.SETTLE_REQUEST - elapsed;

        if (remaining <= 0) {
            // Settlement request expired during downtime
            console.log(`[Court] Settlement request expired for ${session.coupleId}, handling timeout`);
            this._handleSettlementTimeout(session.coupleId, session.settlementRequested);
            return;
        }

        console.log(`[Court] Restoring settlement timeout for ${session.coupleId}, ${remaining}ms remaining`);
        session.settlementTimeoutId = setTimeout(() => {
            this._handleSettlementTimeout(session.coupleId, session.settlementRequested);
        }, remaining);
    }

    // === Session Lookup ===

    getSession(coupleId) {
        return this.repository.getSession(coupleId);
    }

    getSessionForUser(userId) {
        return this.repository.getSessionForUser(userId);
    }

    // === State Sync ===

    getStateForUser(userId) {
        const session = this.repository.getSessionForUser(userId);
        if (!session) {
            return { phase: PHASE.IDLE, myViewPhase: VIEW_PHASE.IDLE, session: null };
        }

        const isCreator = session.creatorId === userId;
        const isMismatchActive = this.resolutionService
            ? this.resolutionService.isMismatchActive(session)
            : false;
        const myViewPhase = computeViewPhase(session, isCreator, isMismatchActive);

        return {
            phase: session.phase,
            myViewPhase,
            session: sanitizeSession(session)
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
    async serve(creatorId, partnerId, coupleId, judgeType = 'logical', languageOptions = {}) {
        // Check for existing session
        if (this.repository.hasActiveSession(creatorId, partnerId)) {
            throw new Error('One or both users already in a session');
        }

        // Check usage limits
        const usageType = mapJudgeTypeToUsage(judgeType || 'logical');
        const usage = await canUseFeature({ userId: creatorId, type: usageType });
        if (!usage.allowed) {
            throw new Error('Usage limit reached. Please upgrade to continue.');
        }

        // Create session
        const session = this.repository.createSession({
            creatorId,
            partnerId,
            coupleId,
            judgeType,
            creatorLanguage: languageOptions.creatorLanguage || 'en',
            partnerLanguage: languageOptions.partnerLanguage || 'en',
            caseLanguage: languageOptions.caseLanguage || languageOptions.creatorLanguage || 'en'
        });

        // Set pending timeout
        session.timeoutId = setTimeout(() => {
            this._handlePendingTimeout(session.coupleId);
        }, TIMEOUT.PENDING);

        console.log(`[Court] Session ${session.id} created (PENDING)`);

        // Create DB row immediately for crash recovery
        await this._dbCheckpoint(session, 'create');

        this._notifyBoth(session);

        // Send push notification to partner
        sendNotificationToUser(partnerId, {
            type: 'court_session',
            title: 'Court Session Request',
            body: 'Your partner wants to settle a dispute in Cat Court',
            data: { screen: 'courtroom', sessionId: session.id }
        }).catch(err => console.warn('[Court] Push notification failed:', err?.message));

        return session;
    }

    /**
     * Partner accepts summons
     */
    async accept(partnerId) {
        const session = this.repository.getSessionForUser(partnerId);
        if (!session) throw new Error('No pending session found');
        if (session.partnerId !== partnerId) throw new Error('Not the intended partner');

        await this.phaseController.acceptSession(session);

        // Set evidence timeout
        session.timeoutId = setTimeout(() => {
            this._handleEvidenceTimeout(session.coupleId);
        }, TIMEOUT.EVIDENCE);

        await this._dbCheckpoint(session, 'accept');

        this._notifyBoth(session);
        return session;
    }

    /**
     * Cancel pending session (creator only)
     */
    async cancel(userId) {
        const session = this.repository.getSessionForUser(userId);
        if (!session) throw new Error('No session found');
        if (session.phase !== PHASE.PENDING) throw new Error('Can only cancel pending sessions');
        if (session.creatorId !== userId) throw new Error('Only creator can cancel');

        await this._deleteSession(session);
        this._cleanup(session.coupleId);
        console.log(`[Court] Session ${session.id} cancelled`);
    }

    /**
     * Dismiss session from any phase (for error recovery)
     */
    async dismiss(userId) {
        const session = this.repository.getSessionForUser(userId);
        if (!session) throw new Error('No session found');

        if (session.creatorId !== userId && session.partnerId !== userId) {
            throw new Error('User not part of this session');
        }

        console.log(`[Court] Session ${session.id} dismissed by ${userId} from phase ${session.phase}`);

        this._triggerBackgroundExtraction(session);
        await this._deleteSession(session);
        this._cleanup(session.coupleId);
    }

    /**
     * Submit evidence
     */
    async submitEvidence(userId, evidence, feelings, needs = '') {
        const session = this.repository.getSessionForUser(userId);
        if (!session) throw new Error('No active session');

        const { bothSubmitted } = this.evidenceService.submitEvidence(session, userId, evidence, feelings, needs);

        if (bothSubmitted) {
            await this.phaseController.transitionToAnalyzing(session);
            this._notifyBoth(session);

            // Notify both users evidence phase complete
            sendNotificationToUser(session.creatorId, {
                type: 'evidence_submitted',
                title: 'Evidence Complete',
                body: 'Both partners have submitted evidence. Judge Whiskers is analyzing...',
                data: { screen: 'courtroom', sessionId: session.id }
            }).catch(err => console.warn('[Court] Push notification failed:', err?.message));

            sendNotificationToUser(session.partnerId, {
                type: 'evidence_submitted',
                title: 'Evidence Complete',
                body: 'Both partners have submitted evidence. Judge Whiskers is analyzing...',
                data: { screen: 'courtroom', sessionId: session.id }
            }).catch(err => console.warn('[Court] Push notification failed:', err?.message));

            // Generate verdict (async, doesn't block)
            this._generateVerdict(session);
        } else {
            this._notifyBoth(session);
        }

        await this._dbCheckpoint(session, 'evidence');

        return { session, bothSubmitted };
    }

    /**
     * Accept verdict
     */
    async acceptVerdict(userId) {
        const session = this.repository.getSessionForUser(userId);
        if (!session) throw new Error('No active session');
        if (session.phase !== PHASE.VERDICT) throw new Error('Not in VERDICT phase');

        const isCreator = session.creatorId === userId;
        const userState = isCreator ? session.creator : session.partner;

        userState.verdictAccepted = true;

        await this._dbCheckpoint(session, 'verdict_accept');

        const bothAccepted = this.phaseController.bothUsersAcceptedVerdict(session);

        if (bothAccepted) {
            await this.phaseController.closeSession(session, 'accepted');
            await this._dbCheckpoint(session, 'close');
            this._notifyBoth(session);

            // Cleanup after celebration delay
            setTimeout(() => {
                this._cleanup(session.coupleId);
            }, 30000);
        } else {
            this._notifyBoth(session);
        }

        return { session, bothAccepted };
    }

    /**
     * Request settlement
     */
    requestSettlement(userId) {
        const session = this.repository.getSessionForUser(userId);
        if (!session) throw new Error('No active session');

        const { partnerId } = this.settlementService.requestSettlement(
            session,
            userId,
            (coupleId, requesterId) => this._handleSettlementTimeout(coupleId, requesterId)
        );

        // Notify partner
        if (this.wsService) {
            this.wsService.emitToUser(partnerId, 'court:settlement_requested', { byUserId: userId });
        }

        // Push notification for settlement request
        sendNotificationToUser(partnerId, {
            type: 'settlement_request',
            title: 'Settlement Request',
            body: 'Your partner is requesting to settle this dispute peacefully',
            data: { screen: 'courtroom', sessionId: session.id }
        }).catch(err => console.warn('[Court] Push notification failed:', err?.message));

        this._notifyBoth(session);
        this._dbCheckpoint(session, 'settlement_request');
        return session;
    }

    /**
     * Accept settlement
     */
    async acceptSettlement(userId) {
        const session = this.repository.getSessionForUser(userId);
        if (!session) throw new Error('No active session');

        this.settlementService.acceptSettlement(session, userId);

        this._triggerBackgroundExtraction(session);
        await this._deleteSession(session);
        this._cleanup(session.coupleId);
    }

    /**
     * Decline settlement
     */
    declineSettlement(userId) {
        const session = this.repository.getSessionForUser(userId);
        if (!session) throw new Error('No active session');

        const { requesterId } = this.settlementService.declineSettlement(session, userId);

        this._notifyBoth(session);
        this._dbCheckpoint(session, 'settlement_declined');

        // Notify requester specifically
        if (this.wsService) {
            this.wsService.emitToUser(requesterId, 'court:settlement_declined', { byUserId: userId });
        }

        return session;
    }

    /**
     * Submit addendum (re-run LLM)
     */
    async submitAddendum(userId, text) {
        const session = this.repository.getSessionForUser(userId);
        if (!session) throw new Error('No active session');
        if (session.phase !== PHASE.VERDICT) throw new Error('Addendum only allowed in VERDICT phase');

        if ((session.addendumCount || 0) >= ADDENDUM_LIMIT) {
            throw new Error('Addendum limit reached for this case.');
        }

        // Cancel auto-close timer
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

        this.phaseController.resetForAddendum(session);

        console.log(`[Court] Addendum submitted, re-running v2 pipeline`);

        await this._dbCheckpoint(session, 'addendum_submitted');
        this._notifyBoth(session);

        // Re-generate verdict with addendum
        await this._generateVerdict(session);

        return session;
    }

    // === V2.0 Actions ===

    /**
     * Mark priming as complete
     */
    async markPrimingComplete(userId) {
        const session = this.repository.getSessionForUser(userId);
        if (!session) throw new Error('No active session');
        if (session.phase !== PHASE.PRIMING) throw new Error('Not in PRIMING phase');

        const isCreator = session.creatorId === userId;
        const userState = isCreator ? session.creator : session.partner;

        userState.primingReady = true;

        const bothReady = this.phaseController.bothUsersCompletedPriming(session);

        if (bothReady) {
            await this.phaseController.transitionToJointReady(session);

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
     * Mark joint menu as ready
     */
    async markJointReady(userId) {
        const session = this.repository.getSessionForUser(userId);
        if (!session) throw new Error('No active session');
        if (session.phase !== PHASE.JOINT_READY) throw new Error('Not in JOINT_READY phase');

        const isCreator = session.creatorId === userId;
        const userState = isCreator ? session.creator : session.partner;

        userState.jointReady = true;

        const bothReady = this.phaseController.bothUsersJointReady(session);

        if (bothReady) {
            await this.phaseController.transitionToResolution(session);

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
        const session = this.repository.getSessionForUser(userId);
        if (!session) throw new Error('No active session');

        const result = await this.resolutionService.submitResolutionPick(session, userId, resolutionId);

        if (result.bothPicked && result.sameChoice) {
            // Both picked same - finalize
            await this.phaseController.transitionToVerdict(session);

            // Set verdict timeout
            session.timeoutId = setTimeout(() => {
                this._handleVerdictTimeout(session.coupleId);
            }, TIMEOUT.VERDICT);

            await this._dbCheckpoint(session, 'verdict_generated');
        } else if (result.mismatch) {
            // Different picks - start mismatch flow
            this.resolutionService.initializeMismatch(session);
            await this._dbCheckpoint(session, 'resolution_mismatch');
            this._notifyBoth(session);

            // Generate hybrid in background
            this._generateHybridResolution(session);
            return result;
        } else if (result.bothPicked && !result.sameChoice && result.mismatch) {
            // Mismatch resolved - finalize
            if (session.finalResolution) {
                await this.phaseController.transitionToVerdict(session);

                // Set verdict timeout
                session.timeoutId = setTimeout(() => {
                    this._handleVerdictTimeout(session.coupleId);
                }, TIMEOUT.VERDICT);

                await this._dbCheckpoint(session, 'verdict_generated');
            } else {
                await this._dbCheckpoint(session, 'resolution_mismatch_pick');
            }
        } else {
            await this._dbCheckpoint(session, 'resolution_pick');
        }

        this._notifyBoth(session);

        return result;
    }

    /**
     * Accept partner's resolution choice
     */
    async acceptPartnerResolution(userId) {
        const session = this.repository.getSessionForUser(userId);
        if (!session) throw new Error('No active session');

        this.resolutionService.acceptPartnerResolution(session, userId);

        await this.phaseController.transitionToVerdict(session);

        // Set verdict timeout
        session.timeoutId = setTimeout(() => {
            this._handleVerdictTimeout(session.coupleId);
        }, TIMEOUT.VERDICT);

        await this._dbCheckpoint(session, 'accept_partner_resolution');
        this._notifyBoth(session);

        return { session };
    }

    /**
     * Request hybrid resolution generation
     */
    async requestHybridResolution(userId) {
        const session = this.repository.getSessionForUser(userId);
        if (!session) throw new Error('No active session');
        if (session.phase !== PHASE.RESOLUTION) throw new Error('Not in RESOLUTION phase');
        if (!this.resolutionService.isMismatchActive(session)) {
            throw new Error('Hybrid resolution is only available after different picks.');
        }

        if (session.hybridResolution || session.hybridResolutionPending) {
            return { session };
        }

        session.hybridResolutionPending = true;
        await this._dbCheckpoint(session, 'hybrid_requested');
        this._notifyBoth(session);

        this._generateHybridResolution(session);

        return { session };
    }

    // === Private Helpers ===

    async _generateVerdict(session) {
        await runVerdictPipeline(session, {
            judgeEngine: this.judgeEngine,
            canUseFeature,
            incrementUsage,
            buildCaseData,
            dbCheckpoint: (s, action) => this._dbCheckpoint(s, action),
            notifyBoth: (s) => this._notifyBoth(s),
            setAnalyzingTimeout: (coupleId) => {
                return setTimeout(() => this._handleAnalyzingTimeout(coupleId), TIMEOUT.ANALYZING);
            },
            setPrimingTimeout: (coupleId) => {
                return setTimeout(() => this._handlePrimingTimeout(coupleId), TIMEOUT.PRIMING);
            },
            clearTimeout: (id) => clearTimeout(id)
        });
    }

    async _generateHybridResolution(session) {
        try {
            await this.resolutionService.generateHybridResolution(
                session,
                buildCaseData
            );

            await this._dbCheckpoint(session, 'hybrid_generated');
            this._notifyBoth(session);
        } catch (error) {
            console.error('[Court] Hybrid generation failed:', error.message);
            session.hybridResolutionPending = false;
            this._notifyBoth(session);
        }
    }

    _cleanup(coupleId) {
        const session = this.repository.deleteSession(coupleId);
        if (!session) return;

        // Notify both users they're back to IDLE
        if (this.wsService) {
            const idleState = { phase: PHASE.IDLE, myViewPhase: VIEW_PHASE.IDLE, session: null };
            this.wsService.emitToUser(session.creatorId, 'court:state', idleState);
            this.wsService.emitToUser(session.partnerId, 'court:state', idleState);
        }
    }

    _triggerBackgroundExtraction(session) {
        if (!this.judgeEngine?.triggerBackgroundExtraction || !session) return;

        try {
            const caseData = buildCaseData(session);
            caseData.submissions.userA.selectedPrimaryEmotion ||= '';
            caseData.submissions.userA.coreNeed ||= '';
            caseData.submissions.userB.selectedPrimaryEmotion ||= '';
            caseData.submissions.userB.coreNeed ||= '';
            this.judgeEngine.triggerBackgroundExtraction(caseData, session.caseId || null);
        } catch (error) {
            console.error('[Court] Failed to trigger background extraction:', error);
        }
    }

    // === Timeout Handlers ===

    _handlePendingTimeout(coupleId) {
        const session = this.repository.getSession(coupleId);
        if (!session || session.phase !== PHASE.PENDING) return;

        console.log(`[Court] Pending timeout for session ${session.id}`);
        this._triggerBackgroundExtraction(session);
        this._deleteSession(session);
        this._cleanup(coupleId);
    }

    async _handleEvidenceTimeout(coupleId) {
        const session = this.repository.getSession(coupleId);
        if (!session || session.phase !== PHASE.EVIDENCE) return;

        console.log(`[Court] Evidence timeout for session ${session.id} - case tossed`);
        this._triggerBackgroundExtraction(session);
        await this._deleteSession(session);
        this._cleanup(coupleId);
    }

    async _handleVerdictTimeout(coupleId) {
        const session = this.repository.getSession(coupleId);
        if (!session || session.phase !== PHASE.VERDICT) return;

        console.log(`[Court] Verdict timeout for session ${session.id} - auto-accepting`);

        session.creator.verdictAccepted = true;
        session.partner.verdictAccepted = true;

        await this.phaseController.closeSession(session, 'auto-accepted');
        await this._dbCheckpoint(session, 'close');
        this._notifyBoth(session);

        setTimeout(() => {
            this._cleanup(coupleId);
        }, 30000);
    }

    async _handleAnalyzingTimeout(coupleId) {
        const session = this.repository.getSession(coupleId);
        if (!session || session.phase !== PHASE.ANALYZING) return;

        console.log(`[Court] Analyzing timeout for session ${session.id} - case tossed`);
        this._triggerBackgroundExtraction(session);
        await this._deleteSession(session);
        this._cleanup(coupleId);
    }

    async _handlePrimingTimeout(coupleId) {
        const session = this.repository.getSession(coupleId);
        if (!session || session.phase !== PHASE.PRIMING) return;

        console.log(`[Court] Priming timeout for session ${session.id} - case tossed`);
        this._triggerBackgroundExtraction(session);
        await this._deleteSession(session);
        this._cleanup(coupleId);
    }

    async _handleJointTimeout(coupleId) {
        const session = this.repository.getSession(coupleId);
        if (!session || session.phase !== PHASE.JOINT_READY) return;

        console.log(`[Court] Joint timeout for session ${session.id} - case tossed`);
        this._triggerBackgroundExtraction(session);
        await this._deleteSession(session);
        this._cleanup(coupleId);
    }

    async _handleResolutionTimeout(coupleId) {
        const session = this.repository.getSession(coupleId);
        if (!session || session.phase !== PHASE.RESOLUTION) return;

        console.log(`[Court] Resolution timeout for session ${session.id} - case tossed`);
        this._triggerBackgroundExtraction(session);
        await this._deleteSession(session);
        this._cleanup(coupleId);
    }

    _handleSettlementTimeout(coupleId, requesterId) {
        const session = this.repository.getSession(coupleId);
        if (!session) return;

        const expired = this.settlementService.handleSettlementTimeout(session, requesterId);
        if (expired) {
            this._notifyBoth(session);
            this._dbCheckpoint(session, 'settlement_expired');
        }
    }

    // === Database Operations ===

    async _dbCheckpoint(session, action) {
        if (this.dbService) {
            try {
                await this.dbService.checkpoint(session, action);
            } catch (error) {
                console.error('[Court] DB checkpoint failed:', error);
            }
        }

        if (this.repository?.saveSession) {
            await this.repository.saveSession(session);
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

    /**
     * Restore appropriate timeout for a session based on its current phase
     * Called after session hydration from Redis or database
     */
    _restorePhaseTimeout(session) {
        // Get the timeout duration for current phase
        const timeoutDuration = TIMEOUT[session.phase];
        if (!timeoutDuration) {
            // Phase has no timeout (e.g., IDLE, CLOSED)
            return;
        }

        const remaining = getRemainingTimeout(session, timeoutDuration);

        if (remaining <= 0) {
            // Timeout already expired during downtime - handle immediately
            console.log(`[Court] Session ${session.coupleId} timeout expired during downtime, handling ${session.phase}`);
            this._handleExpiredTimeout(session);
            return;
        }

        // Set timeout for remaining time
        console.log(`[Court] Restoring ${session.phase} timeout for ${session.coupleId}, ${remaining}ms remaining`);

        switch (session.phase) {
            case PHASE.PENDING:
                session.timeoutId = setTimeout(() => this._handlePendingTimeout(session.coupleId), remaining);
                break;
            case PHASE.EVIDENCE:
                session.timeoutId = setTimeout(() => this._handleEvidenceTimeout(session.coupleId), remaining);
                break;
            case PHASE.ANALYZING:
                session.timeoutId = setTimeout(() => this._handleAnalyzingTimeout(session.coupleId), remaining);
                break;
            case PHASE.PRIMING:
                session.timeoutId = setTimeout(() => this._handlePrimingTimeout(session.coupleId), remaining);
                break;
            case PHASE.JOINT_READY:
                session.timeoutId = setTimeout(() => this._handleJointTimeout(session.coupleId), remaining);
                break;
            case PHASE.RESOLUTION:
                session.timeoutId = setTimeout(() => this._handleResolutionTimeout(session.coupleId), remaining);
                break;
            case PHASE.VERDICT:
                session.timeoutId = setTimeout(() => this._handleVerdictTimeout(session.coupleId), remaining);
                break;
        }
    }

    /**
     * Handle timeout that expired during server downtime
     */
    _handleExpiredTimeout(session) {
        switch (session.phase) {
            case PHASE.PENDING:
                this._handlePendingTimeout(session.coupleId);
                break;
            case PHASE.EVIDENCE:
                this._handleEvidenceTimeout(session.coupleId);
                break;
            case PHASE.ANALYZING:
                this._handleAnalyzingTimeout(session.coupleId);
                break;
            case PHASE.PRIMING:
                this._handlePrimingTimeout(session.coupleId);
                break;
            case PHASE.JOINT_READY:
                this._handleJointTimeout(session.coupleId);
                break;
            case PHASE.RESOLUTION:
                this._handleResolutionTimeout(session.coupleId);
                break;
            case PHASE.VERDICT:
                this._handleVerdictTimeout(session.coupleId);
                break;
            default:
                // For phases without specific handlers (e.g., CLOSED), clean up the session
                console.log(`[Court] Closing expired session ${session.coupleId} in phase ${session.phase}`);
                this._deleteSession(session);
                this._cleanup(session.coupleId);
        }
    }

    async recoverFromDatabase(sessions) {
        for (const dbSession of sessions) {
            try {
                const session = reconstructFromDB(dbSession);
                this.repository.restoreSession(session);
                // Restore appropriate timeout for this phase
                this._restorePhaseTimeout(session);
                // Restore settlement timeout if pending
                this._restoreSettlementTimeout(session);
                console.log(`[Court] Recovered session ${session.id}`);
            } catch (error) {
                console.error('[Court] Failed to recover session:', error);
            }
        }
    }

    // === Debug ===

    getStats() {
        return this.repository.getStats();
    }
}

// Singleton export
const courtSessionManager = new CourtSessionManager();

module.exports = {
    courtSessionManager,
    CourtSessionManager,
    createCourtSessionManager: () => new CourtSessionManager(),
    PHASE,
    VIEW_PHASE,
    TIMEOUT
};
