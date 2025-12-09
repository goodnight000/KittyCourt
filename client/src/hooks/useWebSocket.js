import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import useAuthStore from '../store/useAuthStore';
import useCourtStore, { COURT_PHASES } from '../store/useCourtStore';

/**
 * WebSocket hook for real-time court session synchronization
 * 
 * Automatically connects to the server and joins the court session room.
 * Handles all court-related events and updates the court store.
 */

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';

export default function useWebSocket() {
    const socketRef = useRef(null);
    const { user, profile, partner } = useAuthStore();
    const {
        courtSession,
        phase,
        checkActiveSession,
        syncPhaseWithSession
    } = useCourtStore();

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

            // Join court room if we have an active session
            if (courtSession?.id) {
                joinRoom();
            }
        });

        socketRef.current.on('disconnect', (reason) => {
            console.log('[WS] Disconnected:', reason);
        });

        socketRef.current.on('connect_error', (error) => {
            console.error('[WS] Connection error:', error.message);
        });

        // === Court Event Handlers ===

        // Partner joined the session
        socketRef.current.on('court:partner_joined', ({ session }) => {
            console.log('[WS] Partner joined session');
            useCourtStore.setState({
                courtSession: session,
                phase: COURT_PHASES.IN_SESSION,
                isAnimationPlaying: true
            });
        });

        // Evidence submitted
        socketRef.current.on('court:evidence_submitted', ({ session, submittedBy, bothSubmitted }) => {
            console.log('[WS] Evidence submitted by', submittedBy, 'bothSubmitted:', bothSubmitted);
            useCourtStore.setState({ courtSession: session });

            if (bothSubmitted) {
                const { activeCase } = useCourtStore.getState();
                // Update activeCase with partner's evidence
                useCourtStore.setState({
                    activeCase: {
                        ...activeCase,
                        userAInput: session.evidence_submissions?.creator?.evidence || activeCase.userAInput,
                        userAFeelings: session.evidence_submissions?.creator?.feelings || activeCase.userAFeelings,
                        userASubmitted: true,
                        userBInput: session.evidence_submissions?.partner?.evidence || activeCase.userBInput,
                        userBFeelings: session.evidence_submissions?.partner?.feelings || activeCase.userBFeelings,
                        userBSubmitted: true
                    },
                    phase: COURT_PHASES.DELIBERATING
                });
                // Trigger verdict generation
                useCourtStore.getState().generateVerdict();
            }
        });

        // Verdict ready
        socketRef.current.on('court:verdict_ready', ({ session, verdict }) => {
            console.log('[WS] Verdict ready');
            const { activeCase } = useCourtStore.getState();
            useCourtStore.setState({
                courtSession: session,
                activeCase: {
                    ...activeCase,
                    verdict,
                    allVerdicts: [...(activeCase.allVerdicts || []), {
                        version: (activeCase.allVerdicts?.length || 0) + 1,
                        content: verdict,
                        timestamp: new Date().toISOString()
                    }]
                },
                phase: COURT_PHASES.VERDICT,
                verdictDeadline: Date.now() + (60 * 60 * 1000)
            });
        });

        // Verdict accepted
        socketRef.current.on('court:verdict_accepted', ({ session, acceptedBy, bothAccepted }) => {
            console.log('[WS] Verdict accepted by', acceptedBy, 'bothAccepted:', bothAccepted);
            useCourtStore.setState({ courtSession: session });

            const { activeCase } = useCourtStore.getState();
            const isCreator = session.created_by === user?.id;
            const acceptedByCreator = acceptedBy === session.created_by;

            useCourtStore.setState({
                activeCase: {
                    ...activeCase,
                    userAAccepted: acceptedByCreator || activeCase.userAAccepted,
                    userBAccepted: !acceptedByCreator || activeCase.userBAccepted
                }
            });

            if (bothAccepted) {
                useCourtStore.setState({
                    phase: COURT_PHASES.RATING,
                    showRatingPopup: true,
                    verdictDeadline: null
                });
            }
        });

        // Settlement requested
        socketRef.current.on('court:settlement_requested', ({ session, requestedBy }) => {
            console.log('[WS] Settlement requested by', requestedBy);
            useCourtStore.setState({ courtSession: session });
        });

        // Settled
        socketRef.current.on('court:settled', ({ session }) => {
            console.log('[WS] Case settled');
            useCourtStore.setState({
                courtSession: session,
                phase: COURT_PHASES.SETTLED
            });
        });

        // Session closed
        socketRef.current.on('court:session_closed', ({ sessionId, reason }) => {
            console.log('[WS] Session closed:', reason);
            if (reason === 'completed') {
                useCourtStore.setState({
                    showCelebration: true,
                    courtSession: null,
                    phase: COURT_PHASES.CLOSED
                });
            } else {
                useCourtStore.getState().reset();
            }
        });

    }, [courtSession?.id, user?.id]);

    // Join the court room
    const joinRoom = useCallback(() => {
        if (!socketRef.current?.connected || !courtSession?.id) return;

        const coupleId = profile?.couple_id || courtSession.id;
        socketRef.current.emit('court:join_room', {
            sessionId: courtSession.id,
            coupleId,
            userId: user?.id
        });
        console.log('[WS] Joined room for session:', courtSession.id);
    }, [courtSession?.id, profile?.couple_id, user?.id]);

    // Leave the court room
    const leaveRoom = useCallback(() => {
        if (!socketRef.current?.connected) return;
        socketRef.current.emit('court:leave_room');
        console.log('[WS] Left court room');
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

    // Auto-join room when court session starts
    useEffect(() => {
        if (courtSession?.id && socketRef.current?.connected) {
            joinRoom();
        }
    }, [courtSession?.id, joinRoom]);

    // Leave room when session ends
    useEffect(() => {
        if (!courtSession && socketRef.current?.connected) {
            leaveRoom();
        }
    }, [courtSession, leaveRoom]);

    return {
        isConnected: socketRef.current?.connected || false,
        connect,
        disconnect,
        joinRoom,
        leaveRoom
    };
}
