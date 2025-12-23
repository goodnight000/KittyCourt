/**
 * Socket/API Helper
 * 
 * Utility for handling WebSocket-first communication with HTTP API fallback.
 * Reduces boilerplate in store actions that need both socket and API support.
 */

import api from '../services/api';

/**
 * Emit a socket event with automatic API fallback.
 * 
 * @param {Object} options
 * @param {Object|null} options.socket - Socket.IO socket reference (or null if disconnected)
 * @param {string} options.eventName - Socket event name (e.g., 'court:serve')
 * @param {Object} options.payload - Data to send with socket event
 * @param {string} options.apiPath - API endpoint path (e.g., '/court/serve')
 * @param {string} options.apiMethod - HTTP method: 'post', 'get', 'put', 'delete' (default: 'post')
 * @param {number} options.timeoutMs - Socket response timeout in ms (default: 2500)
 * @param {Function} options.onStateSync - Callback when state update received
 * @param {Function} options.onError - Callback when error received
 * @param {Function} options.fetchState - Fallback function to force a state refetch
 * @param {Function} options.setSubmitting - Function to set isSubmitting state
 * @returns {Promise<void>}
 */
export async function emitWithFallback({
    socket,
    eventName,
    payload = {},
    apiPath,
    apiMethod = 'post',
    timeoutMs = 2500,
    onStateSync,
    onError,
    fetchState,
    setSubmitting
}) {
    setSubmitting?.(true);

    if (socket?.connected) {
        await new Promise((resolve) => {
            let done = false;

            const timeout = setTimeout(() => {
                if (done) return;
                done = true;
                setSubmitting?.(false);
                // Force resync in case WS state didn't arrive
                fetchState?.({ force: true }).finally(resolve);
            }, timeoutMs);

            socket.emit(eventName, payload, (resp) => {
                if (done) return;
                done = true;
                clearTimeout(timeout);
                if (resp?.state) onStateSync?.(resp.state);
                if (resp?.error) onError?.(resp.error);
                setSubmitting?.(false);
                resolve();
            });
        });
    } else {
        // API fallback
        try {
            const response = await api[apiMethod](apiPath, payload);
            onStateSync?.(response.data);
        } catch (error) {
            onError?.(error.response?.data?.error || error.message);
        } finally {
            setSubmitting?.(false);
        }
    }
}

/**
 * Create a bound version of emitWithFallback for a specific store.
 * This reduces boilerplate even further for stores with many actions.
 * 
 * @param {Function} getSocketRef - Function to get current socket reference
 * @param {Function} getStore - Function to get store state/actions (e.g., zustand's get())
 * @returns {Function} Bound emitWithFallback function
 */
export function createSocketApiHelper(getSocketRef, getStore) {
    return async function boundEmit({
        eventName,
        payload = {},
        apiPath,
        apiMethod = 'post',
        timeoutMs = 2500
    }) {
        const store = getStore();
        const socket = getSocketRef();

        await emitWithFallback({
            socket,
            eventName,
            payload,
            apiPath,
            apiMethod,
            timeoutMs,
            onStateSync: store.onStateSync,
            onError: store.onError,
            fetchState: store.fetchState,
            setSubmitting: (val) => store.isSubmitting = val // Note: direct mutation for simplicity
        });
    };
}
