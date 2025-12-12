/**
 * Court WebSocket Hook - Clean Architecture
 * 
 * Manages WebSocket connection for court session.
 * Auto-connects, reconnects with backoff, handles all court events.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { io } from 'socket.io-client';
import useCourtStore, { setSocketRef } from '../store/courtStore';
import useAuthStore from '../store/useAuthStore';

// Get socket server URL
const getSocketUrl = () => {
    // VITE_API_URL is typically an API base like "http://localhost:3000/api".
    // Socket.IO must connect to the server origin, not the REST base path.
    if (import.meta.env.VITE_API_URL) {
        return String(import.meta.env.VITE_API_URL).replace(/\/api\/?$/, '');
    }
    if (import.meta.env.DEV) {
        return 'http://localhost:3000';
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

    // Get store handlers
    const onStateSync = useCourtStore(state => state.onStateSync);
    const onError = useCourtStore(state => state.onError);
    const onSettlementRequested = useCourtStore(state => state.onSettlementRequested);
    const onSettlementDeclined = useCourtStore(state => state.onSettlementDeclined);
    const storeSetConnected = useCourtStore(state => state.setIsConnected);

    // Initialize socket connection
    const connect = useCallback(() => {
        if (socketRef.current?.connected) {
            return socketRef.current;
        }

        if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
            console.log('[WS] Max reconnection attempts reached');
            return null;
        }

        const url = getSocketUrl();
        console.log('[WS] Connecting to:', url);

        const socket = io(url, {
            transports: ['websocket', 'polling'],
            timeout: 10000,
            reconnection: false // We handle reconnection manually
        });

        // === Connection Events ===

        socket.on('connect', () => {
            console.log('[WS] Connected:', socket.id);
            reconnectAttempts.current = 0;
            setIsConnected(true);
            storeSetConnected(true);

            // Register user
            if (user?.id) {
                socket.emit('court:register', { userId: user.id });
            }
        });

        socket.on('disconnect', (reason) => {
            console.log('[WS] Disconnected:', reason);
            setIsConnected(false);
            storeSetConnected(false);

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
            console.log('[WS] State sync:', data.myViewPhase);
            onStateSync(data);
        });

        socket.on('court:error', ({ message }) => {
            console.warn('[WS] Error:', message);
            onError(message);
        });

        socket.on('court:settlement_requested', () => {
            console.log('[WS] Settlement requested');
            onSettlementRequested();
        });

        socket.on('court:settlement_declined', (payload) => {
            console.log('[WS] Settlement declined');
            onSettlementDeclined(payload);
        });

        socketRef.current = socket;
        setSocketRef(socket);

        return socket;
    }, [user?.id, onStateSync, onError, onSettlementRequested, onSettlementDeclined, storeSetConnected]);

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
            socketRef.current.emit('court:register', { userId: user.id });
        }
    }, [user?.id]);

    return {
        isConnected,
        connect,
        disconnect
    };
}
