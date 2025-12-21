/**
 * Court WebSocket Service - Clean Architecture
 * 
 * Handles all court-related WebSocket events.
 * Single responsibility: translate WebSocket events to SessionManager calls.
 */

const { Server } = require('socket.io');
const { courtSessionManager, VIEW_PHASE } = require('./courtSessionManager');
const { createSocketCorsOptions } = require('./security');
const { isSupabaseConfigured } = require('./supabase');
const { requireSupabase, getPartnerIdForUser } = require('./auth');

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
        this.io.use(async (socket, next) => {
            if (!isSupabaseConfigured()) {
                if (process.env.NODE_ENV === 'production') {
                    return next(new Error('Auth not configured'));
                }
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
                    if (process.env.NODE_ENV === 'production') {
                        socket.emit('court:error', { message: 'Unauthorized' });
                        return;
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
                    if (!partnerId) throw new Error('partnerId required');
                    if (isSupabaseConfigured()) {
                        const supabase = requireSupabase();
                        const resolvedPartnerId = await getPartnerIdForUser(supabase, socket.userId);
                        if (!resolvedPartnerId || String(resolvedPartnerId) !== String(partnerId)) {
                            throw new Error('Invalid partnerId for current user');
                        }
                    }
                    await courtSessionManager.serve(socket.userId, partnerId, coupleId, judgeType);
                    const state = courtSessionManager.getStateForUser(socket.userId);
                    if (typeof ack === 'function') ack({ ok: true, state });
                } catch (error) {
                    console.error('[WS] serve error:', error.message);
                    socket.emit('court:error', { message: error.message });
                    if (typeof ack === 'function') ack({ ok: false, error: error.message });
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
                    socket.emit('court:error', { message: error.message });
                    if (typeof ack === 'function') ack({ ok: false, error: error.message });
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
                    socket.emit('court:error', { message: error.message });
                    if (typeof ack === 'function') ack({ ok: false, error: error.message });
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
                    socket.emit('court:error', { message: error.message });
                    if (typeof ack === 'function') ack({ ok: false, error: error.message });
                }
            });

            // Submit evidence
            socket.on('court:submit_evidence', async ({ evidence, feelings }, ack) => {
                try {
                    if (!socket.userId) throw new Error('Not registered');
                    await courtSessionManager.submitEvidence(socket.userId, evidence, feelings);
                    const state = courtSessionManager.getStateForUser(socket.userId);
                    if (typeof ack === 'function') ack({ ok: true, state });
                } catch (error) {
                    console.error('[WS] submit_evidence error:', error.message);
                    socket.emit('court:error', { message: error.message });
                    if (typeof ack === 'function') ack({ ok: false, error: error.message });
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
                    socket.emit('court:error', { message: error.message });
                    if (typeof ack === 'function') ack({ ok: false, error: error.message });
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
                    socket.emit('court:error', { message: error.message });
                    if (typeof ack === 'function') ack({ ok: false, error: error.message });
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
                    socket.emit('court:error', { message: error.message });
                    if (typeof ack === 'function') ack({ ok: false, error: error.message });
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
                    socket.emit('court:error', { message: error.message });
                    if (typeof ack === 'function') ack({ ok: false, error: error.message });
                }
            });

            // Submit addendum
            socket.on('court:submit_addendum', async ({ text }, ack) => {
                try {
                    if (!socket.userId) throw new Error('Not registered');
                    await courtSessionManager.submitAddendum(socket.userId, text);
                    const state = courtSessionManager.getStateForUser(socket.userId);
                    if (typeof ack === 'function') ack({ ok: true, state });
                } catch (error) {
                    console.error('[WS] submit_addendum error:', error.message);
                    socket.emit('court:error', { message: error.message });
                    if (typeof ack === 'function') ack({ ok: false, error: error.message });
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
                    socket.emit('court:error', { message: error.message });
                    if (typeof ack === 'function') ack({ ok: false, error: error.message });
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
                    socket.emit('court:error', { message: error.message });
                    if (typeof ack === 'function') ack({ ok: false, error: error.message });
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
                    socket.emit('court:error', { message: error.message });
                    if (typeof ack === 'function') ack({ ok: false, error: error.message });
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
                    socket.emit('court:error', { message: error.message });
                    if (typeof ack === 'function') ack({ ok: false, error: error.message });
                }
            });

            // Request hybrid resolution
            socket.on('court:resolution_hybrid', async (ack) => {
                try {
                    if (!socket.userId) throw new Error('Not registered');
                    await courtSessionManager.requestHybridResolution(socket.userId);
                    const state = courtSessionManager.getStateForUser(socket.userId);
                    if (typeof ack === 'function') ack({ ok: true, state });
                } catch (error) {
                    console.error('[WS] resolution_hybrid error:', error.message);
                    socket.emit('court:error', { message: error.message });
                    if (typeof ack === 'function') ack({ ok: false, error: error.message });
                }
            });

            // === Disconnect ===
            socket.on('disconnect', () => {
                if (socket.userId && this.userSockets.has(socket.userId)) {
                    this.userSockets.get(socket.userId).delete(socket.id);
                    if (this.userSockets.get(socket.userId).size === 0) {
                        this.userSockets.delete(socket.userId);
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
