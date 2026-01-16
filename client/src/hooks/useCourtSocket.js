/**
 * Court WebSocket Hook - Clean Architecture
 * 
 * Manages WebSocket connection for court session.
 * Auto-connects, reconnects with backoff, handles all court events.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { io } from 'socket.io-client';
import useCourtStore, { setSocketRef } from '../store/useCourtStore';
import useAuthStore from '../store/useAuthStore';

// Get socket server URL
const getSocketUrl = () => {
    // VITE_API_URL is typically an API base like "http://localhost:3001/api".
    // Socket.IO must connect to the server origin, not the REST base path.
    if (import.meta.env.VITE_API_URL) {
        const trimmed = String(import.meta.env.VITE_API_URL).trim();
        if (!trimmed) return window.location.origin;
        if (trimmed.startsWith('/')) return window.location.origin;
        const base = trimmed.replace(/\/api\/?$/, '');
        return base || window.location.origin;
    }
    if (import.meta.env.DEV) {
        return 'http://localhost:3001';
    }
    return window.location.origin;
};

// Connection config
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 1000;

export default function useCourtSocket() {
    const socketRef = useRef(null);
    const reconnectAttempts = useRef(0);
    const [isConnected, setIsConnected] = useState(false);

    // Get user from auth store
    const user = useAuthStore(state => state.user);
    const session = useAuthStore(state => state.session);

    // Get store handlers
    const onStateSync = useCourtStore(state => state.onStateSync);
    const onError = useCourtStore(state => state.onError);
    const onSettlementRequested = useCourtStore(state => state.onSettlementRequested);
    const onSettlementDeclined = useCourtStore(state => state.onSettlementDeclined);
    const storeSetConnected = useCourtStore(state => state.setIsConnected);

    // Use refs to avoid stale closures in socket event handlers
    const handlersRef = useRef({ onStateSync, onError, onSettlementRequested, onSettlementDeclined, storeSetConnected });
    handlersRef.current = { onStateSync, onError, onSettlementRequested, onSettlementDeclined, storeSetConnected };

    // Initialize socket connection
    const connect = useCallback(() => {
        if (socketRef.current?.connected) {
            return socketRef.current;
        }

        if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
            if (import.meta.env.DEV) console.log('[WS] Max reconnection attempts reached');
            return null;
        }

        const url = getSocketUrl();
        if (import.meta.env.DEV) console.log('[WS] Connecting to:', url);

        const socket = io(url, {
            transports: ['websocket', 'polling'],
            timeout: 10000,
            reconnection: false, // We handle reconnection manually
            auth: {
                token: session?.access_token || null
            }
        });

        // === Connection Events ===

        socket.on('connect', () => {
            if (import.meta.env.DEV) console.log('[WS] Connected:', socket.id);
            reconnectAttempts.current = 0;
            setIsConnected(true);
            handlersRef.current.storeSetConnected(true);

            // Register user
            if (user?.id) {
                socket.emit('court:register', { userId: user.id }, (resp) => {
                    if (resp?.state) {
                        handlersRef.current.onStateSync(resp.state);
                    }
                });
            }
        });

        socket.on('disconnect', (reason) => {
            if (import.meta.env.DEV) console.log('[WS] Disconnected:', reason);
            setIsConnected(false);
            handlersRef.current.storeSetConnected(false);

            // Attempt reconnection
            if (reason !== 'io client disconnect') {
                setTimeout(() => {
                    reconnectAttempts.current++;
                    connect();
                }, RECONNECT_DELAY * Math.pow(2, reconnectAttempts.current));
            }
        });

        socket.on('connect_error', (error) => {
            console.warn('[WS] Connection error:', error.message);
            reconnectAttempts.current++;

            if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
                setTimeout(connect, RECONNECT_DELAY * Math.pow(2, reconnectAttempts.current));
            }
        });

        // === Court Events ===

        socket.on('court:state', (data) => {
            if (import.meta.env.DEV) console.log('[WS] State sync:', data.myViewPhase);
            handlersRef.current.onStateSync(data);
        });

        socket.on('court:error', ({ message }) => {
            console.warn('[WS] Error:', message);
            handlersRef.current.onError(message);
        });

        socket.on('court:settlement_requested', () => {
            if (import.meta.env.DEV) console.log('[WS] Settlement requested');
            handlersRef.current.onSettlementRequested();
        });

        socket.on('court:settlement_declined', (payload) => {
            if (import.meta.env.DEV) console.log('[WS] Settlement declined');
            handlersRef.current.onSettlementDeclined(payload);
        });

        socketRef.current = socket;
        setSocketRef(socket);

        return socket;
    }, [user?.id, session?.access_token]);

    // Disconnect
    const disconnect = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
            setSocketRef(null);
            setIsConnected(false);
            storeSetConnected(false);
        }
    }, [storeSetConnected]);

    // Connect on mount, disconnect on unmount
    useEffect(() => {
        if (!user?.id) return;

        connect();

        return () => {
            disconnect();
        };
    }, [user?.id, connect, disconnect]);

    // Re-register when user changes
    useEffect(() => {
        if (user?.id && socketRef.current?.connected) {
            socketRef.current.emit('court:register', { userId: user.id }, (resp) => {
                if (resp?.state) {
                    onStateSync(resp.state);
                }
            });
        }
    }, [user?.id, onStateSync]);

    return {
        isConnected,
        connect,
        disconnect
    };
}
