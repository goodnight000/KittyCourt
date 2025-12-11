import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import useAuthStore from '../store/useAuthStore';
import useCourtStore from '../store/useCourtStore';

/**
 * WebSocket hook for Court Session Real-Time Sync
 * 
 * Handles real-time events during active court sessions:
 * - court:partner_joined - Partner accepted summons
 * - court:evidence_submitted - Evidence was submitted
 * - court:verdict_ready - Verdict was generated
 * - court:verdict_accepted - Verdict was accepted
 * - court:session_closed - Session was closed
 */

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';

export default function useWebSocket() {
    const socketRef = useRef(null);
    const { user, profile } = useAuthStore();

    // Connect to WebSocket server
    const connect = useCallback(() => {
        if (socketRef.current?.connected) return;

        socketRef.current = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        socketRef.current.on('connect', () => {
            console.log('[WS] Connected:', socketRef.current.id);

            // Auto-join court room if there's an active session
            const { courtSession } = useCourtStore.getState();
            if (courtSession && profile?.couple_id) {
                socketRef.current.emit('court:join_room', {
                    sessionId: courtSession.id,
                    coupleId: profile.couple_id,
                    userId: user?.id
                });
            }
        });

        socketRef.current.on('disconnect', (reason) => {
            console.log('[WS] Disconnected:', reason);
        });

        socketRef.current.on('connect_error', (error) => {
            console.error('[WS] Connection error:', error.message);
        });

        // === Court Session Event Handlers ===

        // Partner joined the session
        socketRef.current.on('court:partner_joined', ({ session }) => {
            console.log('[WS] Partner joined:', session.status);
            useCourtStore.getState().syncPhaseWithSession(session);
        });

        // Evidence was submitted
        socketRef.current.on('court:evidence_submitted', ({ session, submittedBy, bothSubmitted }) => {
            console.log('[WS] Evidence submitted by:', submittedBy, 'bothSubmitted:', bothSubmitted);
            useCourtStore.getState().syncPhaseWithSession(session);
        });

        // Verdict is ready
        socketRef.current.on('court:verdict_ready', ({ session, verdict }) => {
            console.log('[WS] Verdict ready');
            const { activeCase } = useCourtStore.getState();
            useCourtStore.setState({
                courtSession: session,
                activeCase: {
                    ...activeCase,
                    verdict: verdict,
                    status: 'VERDICT'
                }
            });
            useCourtStore.getState().syncPhaseWithSession(session);
        });

        // Verdict was accepted
        socketRef.current.on('court:verdict_accepted', ({ session, acceptedBy, bothAccepted }) => {
            console.log('[WS] Verdict accepted by:', acceptedBy, 'bothAccepted:', bothAccepted);
            useCourtStore.setState({ courtSession: session });

            if (bothAccepted) {
                // Both accepted - show celebration and auto-show rating popup!
                console.log('[WS] Both accepted! Showing celebration');
                useCourtStore.setState({ showCelebration: true });

                // Auto-show rating popup 1 second after celebration starts
                setTimeout(() => {
                    useCourtStore.setState({ showRatingPopup: true });
                    console.log('[WS] Auto-showing rating popup after 1s');
                }, 1000);
            }
        });

        // Session was closed
        socketRef.current.on('court:session_closed', ({ sessionId, reason }) => {
            console.log('[WS] Session closed:', reason);
            // Don't reset if celebrating
            const { showCelebration } = useCourtStore.getState();
            if (!showCelebration) {
                useCourtStore.getState().reset();
            }
        });

    }, [user?.id, profile?.couple_id]);

    // Join court room when session becomes active
    const joinCourtRoom = useCallback((session) => {
        if (socketRef.current?.connected && session && profile?.couple_id) {
            socketRef.current.emit('court:join_room', {
                sessionId: session.id,
                coupleId: profile.couple_id,
                userId: user?.id
            });
            console.log('[WS] Joined court room:', profile.couple_id);
        }
    }, [user?.id, profile?.couple_id]);

    // Leave court room
    const leaveCourtRoom = useCallback(() => {
        if (socketRef.current?.connected) {
            socketRef.current.emit('court:leave_room');
            console.log('[WS] Left court room');
        }
    }, []);

    // Disconnect
    const disconnect = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
        }
    }, []);

    // Auto-connect when user is logged in
    useEffect(() => {
        if (user?.id && !socketRef.current?.connected) {
            connect();
        }

        return () => {
            disconnect();
        };
    }, [user?.id, connect, disconnect]);

    return {
        isConnected: socketRef.current?.connected || false,
        connect,
        disconnect,
        joinCourtRoom,
        leaveCourtRoom
    };
}
