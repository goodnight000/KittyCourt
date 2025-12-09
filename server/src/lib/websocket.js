/**
 * WebSocket Service for Court Session Real-Time Sync
 * 
 * Handles real-time communication between partners during court sessions.
 * Events:
 *   - court:joined - Partner joined the session
 *   - court:evidence_submitted - Partner submitted their evidence
 *   - court:verdict_ready - Verdict has been generated
 *   - court:verdict_accepted - Partner accepted the verdict
 *   - court:settlement_requested - Partner requested settlement
 *   - court:settled - Both agreed to settle
 *   - court:session_closed - Session was closed
 */

const { Server } = require('socket.io');

class WebSocketService {
    constructor() {
        this.io = null;
        // Map coupleId -> Set of socket IDs
        this.sessionRooms = new Map();
    }

    /**
     * Initialize WebSocket server
     * @param {http.Server} httpServer - The HTTP server to attach to
     */
    initialize(httpServer) {
        this.io = new Server(httpServer, {
            cors: {
                origin: ['http://localhost:5173', 'http://localhost:3000', 'https://pauseapp.co'],
                methods: ['GET', 'POST'],
                credentials: true
            },
            transports: ['websocket', 'polling']
        });

        this.io.on('connection', (socket) => {
            console.log(`[WS] Client connected: ${socket.id}`);

            // Join a court session room
            socket.on('court:join_room', ({ sessionId, coupleId, userId }) => {
                const room = `court:${coupleId || sessionId}`;
                socket.join(room);
                socket.courtRoom = room;
                socket.userId = userId;
                console.log(`[WS] User ${userId} joined room ${room}`);
            });

            // Leave court session room
            socket.on('court:leave_room', () => {
                if (socket.courtRoom) {
                    socket.leave(socket.courtRoom);
                    console.log(`[WS] User ${socket.userId} left room ${socket.courtRoom}`);
                    socket.courtRoom = null;
                }
            });

            // Handle disconnection
            socket.on('disconnect', () => {
                console.log(`[WS] Client disconnected: ${socket.id}`);
            });
        });

        console.log('[WS] WebSocket service initialized');
    }

    /**
     * Get the Socket.IO instance
     */
    getIO() {
        return this.io;
    }

    /**
     * Emit event to a court session room
     * @param {string} coupleId - The couple/session identifier
     * @param {string} event - Event name
     * @param {object} data - Event payload
     */
    emitToSession(coupleId, event, data) {
        if (!this.io) {
            console.warn('[WS] WebSocket not initialized');
            return;
        }

        const room = `court:${coupleId}`;
        this.io.to(room).emit(event, {
            ...data,
            timestamp: new Date().toISOString()
        });
        console.log(`[WS] Emitted ${event} to room ${room}`);
    }

    // === Court Session Events ===

    /**
     * Notify when partner joins the session
     */
    notifyPartnerJoined(coupleId, session) {
        this.emitToSession(coupleId, 'court:partner_joined', { session });
    }

    /**
     * Notify when evidence is submitted
     */
    notifyEvidenceSubmitted(coupleId, session, submittedBy) {
        this.emitToSession(coupleId, 'court:evidence_submitted', {
            session,
            submittedBy,
            bothSubmitted: session.evidence_submissions?.creator?.submitted &&
                session.evidence_submissions?.partner?.submitted
        });
    }

    /**
     * Notify when verdict is ready
     */
    notifyVerdictReady(coupleId, session, verdict) {
        this.emitToSession(coupleId, 'court:verdict_ready', { session, verdict });
    }

    /**
     * Notify when verdict is accepted
     */
    notifyVerdictAccepted(coupleId, session, acceptedBy, bothAccepted) {
        this.emitToSession(coupleId, 'court:verdict_accepted', {
            session,
            acceptedBy,
            bothAccepted
        });
    }

    /**
     * Notify when settlement is requested
     */
    notifySettlementRequested(coupleId, session, requestedBy) {
        this.emitToSession(coupleId, 'court:settlement_requested', {
            session,
            requestedBy
        });
    }

    /**
     * Notify when both agree to settle
     */
    notifySettled(coupleId, session) {
        this.emitToSession(coupleId, 'court:settled', { session });
    }

    /**
     * Notify when session is closed
     */
    notifySessionClosed(coupleId, sessionId, reason = 'completed') {
        this.emitToSession(coupleId, 'court:session_closed', {
            sessionId,
            reason
        });
    }
}

// Singleton instance
const wsService = new WebSocketService();

module.exports = wsService;
