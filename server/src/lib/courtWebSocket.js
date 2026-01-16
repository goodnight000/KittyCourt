/**
 * Court WebSocket Service - Clean Architecture
 *
 * Handles all court-related WebSocket events.
 * Single responsibility: translate WebSocket events to SessionManager calls.
 */

const { Server } = require('socket.io');
const { courtSessionManager, VIEW_PHASE } = require('./courtSessionManager');
const { createSocketCorsOptions } = require('./security');
const { processSecureInput, securityConfig, logSecurityEvent } = require('./security/index');
const { isSupabaseConfigured } = require('./supabase');
const { requireSupabase, getPartnerIdForUser } = require('./auth');
const { resolveLanguageFromHeader, getUserPreferredLanguage } = require('./language');
const { safeErrorMessage } = require('./shared/errorUtils');

/**
 * WebSocket Rate Limiter
 * Tracks rate limits per userId:event combination
 */
const wsRateLimits = new Map(); // key: `${userId}:${event}` -> { count, resetAt }

// Periodic cleanup of expired rate limit entries (CRITICAL-007 fix)
// Runs every 5 minutes to prevent memory growth
setInterval(() => {
    const now = Date.now();
    let cleanedCount = 0;
    for (const [key, value] of wsRateLimits.entries()) {
        if (now > value.resetAt) {
            wsRateLimits.delete(key);
            cleanedCount++;
        }
    }
    if (cleanedCount > 0) {
        console.log(`[WS] Rate limit cleanup: removed ${cleanedCount} expired entries`);
    }
}, 5 * 60 * 1000); // Every 5 minutes

/**
 * Rate limit configuration for WebSocket events
 * Format: { limit: max requests, windowMs: time window in milliseconds }
 */
const WS_RATE_LIMIT_CONFIG = {
    'court:serve': { limit: 5, windowMs: 5 * 60 * 1000 },           // 5 per 5 minutes
    'court:submit_evidence': { limit: 20, windowMs: 5 * 60 * 1000 }, // 20 per 5 minutes
    'court:submit_addendum': { limit: 10, windowMs: 5 * 60 * 1000 }, // 10 per 5 minutes
    'court:resolution_hybrid': { limit: 5, windowMs: 5 * 60 * 1000 }, // 5 per 5 minutes (triggers AI)
};

/**
 * Check if a WebSocket event is within rate limits
 * @param {string} userId - User ID
 * @param {string} event - Event name
 * @returns {{ allowed: boolean, retryAfterMs?: number }} - Rate limit check result
 */
function checkWsRateLimit(userId, event) {
    const config = WS_RATE_LIMIT_CONFIG[event];
    if (!config) return { allowed: true }; // No rate limit configured for this event

    const key = `${userId}:${event}`;
    const now = Date.now();
    const record = wsRateLimits.get(key);

    // Clean up expired entries periodically
    if (wsRateLimits.size > 10000) {
        for (const [k, v] of wsRateLimits.entries()) {
            if (now > v.resetAt) wsRateLimits.delete(k);
        }
    }

    if (!record || now > record.resetAt) {
        wsRateLimits.set(key, { count: 1, resetAt: now + config.windowMs });
        return { allowed: true };
    }

    if (record.count >= config.limit) {
        const retryAfterMs = record.resetAt - now;
        return { allowed: false, retryAfterMs };
    }

    record.count++;
    return { allowed: true };
}

/**
 * Handle rate limit exceeded for WebSocket events
 * @param {Socket} socket - Socket.io socket
 * @param {string} event - Event name
 * @param {Function} ack - Acknowledgment callback
 * @param {number} retryAfterMs - Milliseconds until rate limit resets
 */
function handleRateLimitExceeded(socket, event, ack, retryAfterMs) {
    const retryAfterSec = Math.ceil(retryAfterMs / 1000);
    logSecurityEvent('ws_rate_limit_exceeded', {
        userId: socket.userId,
        event,
        retryAfterMs,
    });
    socket.emit('court:error', {
        message: `Rate limit exceeded. Please try again in ${retryAfterSec} seconds.`,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfterMs,
    });
    if (typeof ack === 'function') {
        ack({ ok: false, error: 'RATE_LIMIT_EXCEEDED', retryAfterMs });
    }
}

class CourtWebSocketService {
    constructor() {
        this.io = null;
        this.userSockets = new Map(); // userId → Set<socketId>
    }

    /**
     * Initialize WebSocket server
     */
    initialize(httpServer) {
        this.io = new Server(httpServer, {
            cors: {
                ...createSocketCorsOptions(),
            },
            transports: ['websocket', 'polling']
        });

        // Authenticate the socket using Supabase JWT when configured.
        // CRITICAL-006 fix: Require auth in production OR when Supabase is configured
        this.io.use(async (socket, next) => {
            const isProduction = process.env.NODE_ENV === 'production';
            const supabaseConfigured = isSupabaseConfigured();

            // In production, always require Supabase to be configured
            if (isProduction && !supabaseConfigured) {
                console.error('[WS] CRITICAL: Supabase not configured in production');
                return next(new Error('Auth not configured'));
            }

            // In development without Supabase, allow (with warning)
            if (!supabaseConfigured) {
                console.warn('[WS] Running without Supabase auth - development mode only');
                return next();
            }

            try {
                const authToken = socket.handshake.auth?.token;
                const header = socket.handshake.headers?.authorization || '';
                const match = typeof header === 'string' ? header.match(/^Bearer\s+(.+)$/i) : null;
                const headerToken = match?.[1];
                const token = authToken || headerToken;
                if (!token) return next(new Error('Unauthorized'));

                const supabase = requireSupabase();
                const { data, error } = await supabase.auth.getUser(token);
                if (error || !data?.user?.id) return next(new Error('Unauthorized'));

                socket.userId = data.user.id;
                return next();
            } catch (e) {
                return next(new Error('Unauthorized'));
            }
        });

        // Connect session manager to this service
        courtSessionManager.setWebSocketService(this);

        this.io.on('connection', (socket) => {
            console.log(`[WS] Client connected: ${socket.id}`);

            // === Registration ===
            socket.on('court:register', async ({ userId } = {}, ack) => {
                // In production (or whenever Supabase is configured), userId is derived from auth.
                if (!socket.userId) {
                    // Always require auth in production
                    if (process.env.NODE_ENV === 'production') {
                        socket.emit('court:error', { message: 'Unauthorized' });
                        return;
                    }

                    // Development mode: check if strict auth is required
                    if (process.env.REQUIRE_AUTH_IN_DEV === 'true') {
                        socket.emit('court:error', { message: 'Authentication required' });
                        return;
                    }

                    // Log warning when using development fallback
                    if (userId) {
                        console.warn('[Security] WebSocket using development auth bypass - NOT FOR PRODUCTION');
                    }

                    if (!userId) {
                        socket.emit('court:error', { message: 'userId required' });
                        return;
                    }
                    socket.userId = userId;
                }

                // Track socket
                if (!this.userSockets.has(socket.userId)) {
                    this.userSockets.set(socket.userId, new Set());
                }
                this.userSockets.get(socket.userId).add(socket.id);

                console.log(`[WS] User ${socket.userId} registered`);

                // Send current state
                const state = courtSessionManager.getStateForUser(socket.userId);
                socket.emit('court:state', state);
                if (typeof ack === 'function') ack({ ok: true, state });
            });

            // === Court Actions ===

            // Serve partner
            socket.on('court:serve', async ({ partnerId, coupleId, judgeType }, ack) => {
                try {
                    if (!socket.userId) throw new Error('Not registered');

                    // Rate limit check
                    const rateCheck = checkWsRateLimit(socket.userId, 'court:serve');
                    if (!rateCheck.allowed) {
                        return handleRateLimitExceeded(socket, 'court:serve', ack, rateCheck.retryAfterMs);
                    }

                    if (!partnerId) throw new Error('partnerId required');
                    const supabase = isSupabaseConfigured() ? requireSupabase() : null;
                    if (supabase) {
                        const resolvedPartnerId = await getPartnerIdForUser(supabase, socket.userId);
                        if (!resolvedPartnerId || String(resolvedPartnerId) !== String(partnerId)) {
                            throw new Error('Invalid partnerId for current user');
                        }
                    }
                    const creatorLanguage = await resolveLanguageFromHeader(
                        socket.handshake?.headers?.['accept-language'],
                        supabase,
                        socket.userId
                    );
                    const partnerLanguage = supabase
                        ? await getUserPreferredLanguage(supabase, partnerId)
                        : null;
                    await courtSessionManager.serve(socket.userId, partnerId, coupleId, judgeType, {
                        creatorLanguage,
                        partnerLanguage,
                        caseLanguage: creatorLanguage || 'en',
                    });
                    const state = courtSessionManager.getStateForUser(socket.userId);
                    if (typeof ack === 'function') ack({ ok: true, state });
                } catch (error) {
                    console.error('[WS] serve error:', error.message);
                    socket.emit('court:error', { message: safeErrorMessage(error) });
                    if (typeof ack === 'function') ack({ ok: false, error: safeErrorMessage(error) });
                }
            });

            // Accept summons
            socket.on('court:accept', async (ack) => {
                try {
                    if (!socket.userId) throw new Error('Not registered');
                    await courtSessionManager.accept(socket.userId);
                    const state = courtSessionManager.getStateForUser(socket.userId);
                    if (typeof ack === 'function') ack({ ok: true, state });
                } catch (error) {
                    console.error('[WS] accept error:', error.message);
                    socket.emit('court:error', { message: safeErrorMessage(error) });
                    if (typeof ack === 'function') ack({ ok: false, error: safeErrorMessage(error) });
                }
            });

            // Cancel pending
            socket.on('court:cancel', async (ack) => {
                try {
                    if (!socket.userId) throw new Error('Not registered');
                    await courtSessionManager.cancel(socket.userId);
                    const state = courtSessionManager.getStateForUser(socket.userId);
                    if (typeof ack === 'function') ack({ ok: true, state });
                } catch (error) {
                    console.error('[WS] cancel error:', error.message);
                    socket.emit('court:error', { message: safeErrorMessage(error) });
                    if (typeof ack === 'function') ack({ ok: false, error: safeErrorMessage(error) });
                }
            });

            // Dismiss session (from any phase - for error recovery)
            socket.on('court:dismiss', async (ack) => {
                try {
                    if (!socket.userId) throw new Error('Not registered');
                    await courtSessionManager.dismiss(socket.userId);
                    if (typeof ack === 'function') ack({ ok: true });
                } catch (error) {
                    console.error('[WS] dismiss error:', error.message);
                    socket.emit('court:error', { message: safeErrorMessage(error) });
                    if (typeof ack === 'function') ack({ ok: false, error: safeErrorMessage(error) });
                }
            });

            // Submit evidence
            socket.on('court:submit_evidence', async ({ evidence, feelings, needs }, ack) => {
                try {
                    if (!socket.userId) throw new Error('Not registered');

                    // Rate limit check
                    const rateCheck = checkWsRateLimit(socket.userId, 'court:submit_evidence');
                    if (!rateCheck.allowed) {
                        return handleRateLimitExceeded(socket, 'court:submit_evidence', ack, rateCheck.retryAfterMs);
                    }

                    // Validate and sanitize all input fields
                    const evidenceCheck = processSecureInput(evidence, {
                        userId: socket.userId,
                        fieldName: 'cameraFacts',
                        maxLength: securityConfig.fieldLimits.cameraFacts,
                        endpoint: 'court',
                    });
                    const feelingsCheck = processSecureInput(feelings, {
                        userId: socket.userId,
                        fieldName: 'theStoryIamTellingMyself',
                        maxLength: securityConfig.fieldLimits.theStoryIamTellingMyself,
                        endpoint: 'court',
                    });
                    const needsCheck = processSecureInput(needs || '', {
                        userId: socket.userId,
                        fieldName: 'unmetNeeds',
                        maxLength: securityConfig.fieldLimits.unmetNeeds,
                        endpoint: 'court',
                    });

                    if (!evidenceCheck.safe || !feelingsCheck.safe || !needsCheck.safe) {
                        throw new Error('Input contains content that cannot be processed. Please rephrase.');
                    }

                    await courtSessionManager.submitEvidence(socket.userId, evidenceCheck.input, feelingsCheck.input, needsCheck.input);
                    const state = courtSessionManager.getStateForUser(socket.userId);
                    if (typeof ack === 'function') ack({ ok: true, state });
                } catch (error) {
                    console.error('[WS] submit_evidence error:', error.message);
                    socket.emit('court:error', { message: safeErrorMessage(error) });
                    if (typeof ack === 'function') ack({ ok: false, error: safeErrorMessage(error) });
                }
            });

            // Accept verdict
            socket.on('court:accept_verdict', async (ack) => {
                try {
                    if (!socket.userId) throw new Error('Not registered');
                    await courtSessionManager.acceptVerdict(socket.userId);
                    const state = courtSessionManager.getStateForUser(socket.userId);
                    if (typeof ack === 'function') ack({ ok: true, state });
                } catch (error) {
                    console.error('[WS] accept_verdict error:', error.message);
                    socket.emit('court:error', { message: safeErrorMessage(error) });
                    if (typeof ack === 'function') ack({ ok: false, error: safeErrorMessage(error) });
                }
            });

            // Request settlement
            socket.on('court:request_settle', (ack) => {
                try {
                    if (!socket.userId) throw new Error('Not registered');
                    courtSessionManager.requestSettlement(socket.userId);
                    const state = courtSessionManager.getStateForUser(socket.userId);
                    if (typeof ack === 'function') ack({ ok: true, state });
                } catch (error) {
                    console.error('[WS] request_settle error:', error.message);
                    socket.emit('court:error', { message: safeErrorMessage(error) });
                    if (typeof ack === 'function') ack({ ok: false, error: safeErrorMessage(error) });
                }
            });

            // Accept settlement
            socket.on('court:accept_settle', async (ack) => {
                try {
                    if (!socket.userId) throw new Error('Not registered');
                    await courtSessionManager.acceptSettlement(socket.userId);
                    const state = courtSessionManager.getStateForUser(socket.userId);
                    if (typeof ack === 'function') ack({ ok: true, state });
                } catch (error) {
                    console.error('[WS] accept_settle error:', error.message);
                    socket.emit('court:error', { message: safeErrorMessage(error) });
                    if (typeof ack === 'function') ack({ ok: false, error: safeErrorMessage(error) });
                }
            });

            // Decline settlement (case continues)
            socket.on('court:decline_settle', (ack) => {
                try {
                    if (!socket.userId) throw new Error('Not registered');
                    courtSessionManager.declineSettlement(socket.userId);
                    const state = courtSessionManager.getStateForUser(socket.userId);
                    if (typeof ack === 'function') ack({ ok: true, state });
                } catch (error) {
                    console.error('[WS] decline_settle error:', error.message);
                    socket.emit('court:error', { message: safeErrorMessage(error) });
                    if (typeof ack === 'function') ack({ ok: false, error: safeErrorMessage(error) });
                }
            });

            // Submit addendum
            socket.on('court:submit_addendum', async ({ text }, ack) => {
                try {
                    if (!socket.userId) throw new Error('Not registered');

                    // Rate limit check
                    const rateCheck = checkWsRateLimit(socket.userId, 'court:submit_addendum');
                    if (!rateCheck.allowed) {
                        return handleRateLimitExceeded(socket, 'court:submit_addendum', ack, rateCheck.retryAfterMs);
                    }

                    // Security validation for addendum text (CRITICAL-001 fix)
                    const addendumCheck = processSecureInput(text || '', {
                        userId: socket.userId,
                        fieldName: 'addendum',
                        maxLength: securityConfig.fieldLimits.addendum || 2000,
                        endpoint: 'court',
                    });

                    if (!addendumCheck.safe) {
                        logSecurityEvent('ws_addendum_blocked', {
                            userId: socket.userId,
                            reason: 'Security validation failed',
                        });
                        throw new Error('Content not allowed. Please rephrase.');
                    }

                    await courtSessionManager.submitAddendum(socket.userId, addendumCheck.input);
                    const state = courtSessionManager.getStateForUser(socket.userId);
                    if (typeof ack === 'function') ack({ ok: true, state });
                } catch (error) {
                    console.error('[WS] submit_addendum error:', error.message);
                    socket.emit('court:error', { message: safeErrorMessage(error) });
                    if (typeof ack === 'function') ack({ ok: false, error: safeErrorMessage(error) });
                }
            });

            // === V2.0 Actions ===

            // Mark priming complete
            socket.on('court:priming_complete', async (ack) => {
                try {
                    if (!socket.userId) throw new Error('Not registered');
                    await courtSessionManager.markPrimingComplete(socket.userId);
                    const state = courtSessionManager.getStateForUser(socket.userId);
                    if (typeof ack === 'function') ack({ ok: true, state });
                } catch (error) {
                    console.error('[WS] priming_complete error:', error.message);
                    socket.emit('court:error', { message: safeErrorMessage(error) });
                    if (typeof ack === 'function') ack({ ok: false, error: safeErrorMessage(error) });
                }
            });

            // Mark joint menu ready
            socket.on('court:joint_ready', async (ack) => {
                try {
                    if (!socket.userId) throw new Error('Not registered');
                    await courtSessionManager.markJointReady(socket.userId);
                    const state = courtSessionManager.getStateForUser(socket.userId);
                    if (typeof ack === 'function') ack({ ok: true, state });
                } catch (error) {
                    console.error('[WS] joint_ready error:', error.message);
                    socket.emit('court:error', { message: safeErrorMessage(error) });
                    if (typeof ack === 'function') ack({ ok: false, error: safeErrorMessage(error) });
                }
            });

            // Submit resolution pick
            socket.on('court:resolution_pick', async ({ resolutionId }, ack) => {
                try {
                    if (!socket.userId) throw new Error('Not registered');
                    if (!resolutionId) throw new Error('resolutionId required');
                    await courtSessionManager.submitResolutionPick(socket.userId, resolutionId);
                    const state = courtSessionManager.getStateForUser(socket.userId);
                    if (typeof ack === 'function') ack({ ok: true, state });
                } catch (error) {
                    console.error('[WS] resolution_pick error:', error.message);
                    socket.emit('court:error', { message: safeErrorMessage(error) });
                    if (typeof ack === 'function') ack({ ok: false, error: safeErrorMessage(error) });
                }
            });

            // Accept partner resolution
            socket.on('court:resolution_accept_partner', async (ack) => {
                try {
                    if (!socket.userId) throw new Error('Not registered');
                    await courtSessionManager.acceptPartnerResolution(socket.userId);
                    const state = courtSessionManager.getStateForUser(socket.userId);
                    if (typeof ack === 'function') ack({ ok: true, state });
                } catch (error) {
                    console.error('[WS] resolution_accept_partner error:', error.message);
                    socket.emit('court:error', { message: safeErrorMessage(error) });
                    if (typeof ack === 'function') ack({ ok: false, error: safeErrorMessage(error) });
                }
            });

            // Request hybrid resolution
            socket.on('court:resolution_hybrid', async (ack) => {
                try {
                    if (!socket.userId) throw new Error('Not registered');

                    // Rate limit check (triggers AI)
                    const rateCheck = checkWsRateLimit(socket.userId, 'court:resolution_hybrid');
                    if (!rateCheck.allowed) {
                        return handleRateLimitExceeded(socket, 'court:resolution_hybrid', ack, rateCheck.retryAfterMs);
                    }

                    await courtSessionManager.requestHybridResolution(socket.userId);
                    const state = courtSessionManager.getStateForUser(socket.userId);
                    if (typeof ack === 'function') ack({ ok: true, state });
                } catch (error) {
                    console.error('[WS] resolution_hybrid error:', error.message);
                    socket.emit('court:error', { message: safeErrorMessage(error) });
                    if (typeof ack === 'function') ack({ ok: false, error: safeErrorMessage(error) });
                }
            });

            // === Disconnect ===
            socket.on('disconnect', () => {
                const userId = socket.userId;
                if (userId && this.userSockets.has(userId)) {
                    this.userSockets.get(userId).delete(socket.id);
                    if (this.userSockets.get(userId).size === 0) {
                        this.userSockets.delete(userId);

                        // WS-H-002: Notify partner when user disconnects from active session
                        // Only notify if this was the last socket for this user
                        try {
                            const session = courtSessionManager.getSessionForUser(userId);
                            if (session) {
                                const partnerId = session.creatorId === userId
                                    ? session.partnerId
                                    : session.creatorId;
                                if (partnerId && this.isUserConnected(partnerId)) {
                                    this.emitToUser(partnerId, 'court:partner_disconnected', {
                                        userId,
                                        timestamp: Date.now()
                                    });
                                    console.log(`[WS] Notified partner ${partnerId} of disconnect`);
                                }
                            }
                        } catch (err) {
                            // Don't fail disconnect handling if notification fails
                            console.error('[WS] Failed to notify partner of disconnect:', err.message);
                        }
                    }
                }
                console.log(`[WS] Client disconnected: ${socket.id}`);
            });
        });

        console.log('[WS] Court WebSocket service initialized');
        return this;
    }

    /**
     * Emit to a specific user (all their connected sockets)
     */
    emitToUser(userId, event, data) {
        const socketIds = this.userSockets.get(userId);
        if (!socketIds || socketIds.size === 0) {
            return false;
        }

        for (const socketId of socketIds) {
            const socket = this.io.sockets.sockets.get(socketId);
            if (socket) {
                socket.emit(event, data);
            }
        }
        return true;
    }

    /**
     * Check if user is connected
     */
    isUserConnected(userId) {
        return this.userSockets.has(userId) && this.userSockets.get(userId).size > 0;
    }
}

// Singleton
const courtWebSocket = new CourtWebSocketService();

module.exports = courtWebSocket;
module.exports.CourtWebSocketService = CourtWebSocketService;
module.exports.createCourtWebSocketService = () => new CourtWebSocketService();
