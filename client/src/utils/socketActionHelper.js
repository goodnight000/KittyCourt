/**
 * Socket Action Helper
 *
 * Utility for wrapping WebSocket action patterns with timeout handling and fallback logic.
 * This module provides a clean abstraction for the repetitive Promise-based socket emit
 * patterns found throughout the courtStore.
 *
 * @module socketActionHelper
 */

/**
 * Creates a wrapped WebSocket action with timeout and fallback logic.
 *
 * This function wraps the common pattern of:
 * 1. Emitting a socket event with a callback
 * 2. Setting up a timeout to handle non-responsive sockets
 * 3. Preventing duplicate responses (race condition between timeout and callback)
 * 4. Optional fallback execution on timeout
 *
 * @param {string} eventName - The WebSocket event name to emit (e.g., 'court:serve')
 * @param {Object} [options={}] - Configuration options
 * @param {number} [options.timeoutMs=2500] - Milliseconds to wait before timing out
 * @param {Function|null} [options.fallbackFn=null] - Optional async function to call on timeout.
 *                                                     Should return a Promise. If null, returns
 *                                                     an error object on timeout.
 *
 * @returns {Function} An async function that takes (socketRef, payload) and returns a Promise
 *                     that resolves with the socket response or timeout result.
 *
 * @example
 * // Basic usage without fallback
 * const acceptAction = createSocketAction('court:accept');
 * const response = await acceptAction(socketRef, {});
 *
 * @example
 * // With custom timeout
 * const serveAction = createSocketAction('court:serve', { timeoutMs: 5000 });
 * const response = await serveAction(socketRef, { partnerId, coupleId });
 *
 * @example
 * // With fallback function (e.g., force state refetch)
 * const submitAction = createSocketAction('court:submit_evidence', {
 *   timeoutMs: 3000,
 *   fallbackFn: async () => {
 *     await fetchState({ force: true });
 *   }
 * });
 * const response = await submitAction(socketRef, { evidence, feelings });
 *
 * @example
 * // In a Zustand store action
 * const useStore = create((set, get) => ({
 *   accept: async () => {
 *     set({ isSubmitting: true, error: null });
 *
 *     const acceptAction = createSocketAction('court:accept', {
 *       fallbackFn: () => get().fetchState({ force: true })
 *     });
 *
 *     const response = await acceptAction(socketRef, {});
 *
 *     if (response?.state) get().onStateSync(response.state);
 *     if (response?.error) get().onError(response.error);
 *
 *     set({ isSubmitting: false });
 *   }
 * }));
 */
export function createSocketAction(eventName, options = {}) {
  const { timeoutMs = 2500, fallbackFn = null } = options;

  return async (socketRef, payload) => {
    return new Promise((resolve) => {
      let done = false;

      // Set up timeout handler
      const timeout = setTimeout(() => {
        if (done) return;
        done = true;

        // Execute fallback if provided, otherwise return error
        if (fallbackFn) {
          fallbackFn().finally(resolve);
        } else {
          resolve({ error: 'Timeout' });
        }
      }, timeoutMs);

      // Emit socket event with callback
      socketRef.emit(eventName, payload, (response) => {
        if (done) return; // Ignore if timeout already fired
        done = true;
        clearTimeout(timeout);
        resolve(response);
      });
    });
  };
}

/**
 * Creates a socket action wrapper factory bound to a specific store context.
 *
 * This higher-order function creates a factory that automatically binds common
 * store methods (onStateSync, onError, fetchState) to the socket actions,
 * further reducing boilerplate.
 *
 * @param {Function} getStore - Function that returns the store state/methods (e.g., Zustand's get())
 *
 * @returns {Function} A factory function that creates socket actions with store context
 *
 * @example
 * // In a Zustand store
 * const useCourtStore = create((set, get) => {
 *   const createAction = createSocketActionFactory(get);
 *
 *   return {
 *     accept: async () => {
 *       set({ isSubmitting: true, error: null });
 *
 *       const acceptAction = createAction('court:accept', {
 *         onSuccess: (resp) => {
 *           if (resp?.state) get().onStateSync(resp.state);
 *         },
 *         onTimeout: () => get().fetchState({ force: true })
 *       });
 *
 *       await acceptAction(socketRef, {});
 *       set({ isSubmitting: false });
 *     }
 *   };
 * });
 */
export function createSocketActionFactory(getStore) {
  return function createBoundAction(eventName, options = {}) {
    const {
      timeoutMs = 2500,
      onSuccess = null,
      onTimeout = null,
      onError = null
    } = options;

    return async (socketRef, payload) => {
      const store = getStore();

      return new Promise((resolve) => {
        let done = false;

        const timeout = setTimeout(() => {
          if (done) return;
          done = true;

          // Execute custom timeout handler or default to fetchState
          const timeoutHandler = onTimeout || (() => store.fetchState?.({ force: true }));
          Promise.resolve(timeoutHandler()).finally(resolve);
        }, timeoutMs);

        socketRef.emit(eventName, payload, (response) => {
          if (done) return;
          done = true;
          clearTimeout(timeout);

          // Handle response
          if (response?.state && onSuccess) {
            onSuccess(response);
          } else if (response?.state) {
            store.onStateSync?.(response.state);
          }

          if (response?.error) {
            if (onError) {
              onError(response.error);
            } else {
              store.onError?.(response.error);
            }
          }

          resolve(response);
        });
      });
    };
  };
}

/**
 * Pre-configured socket actions for common court events.
 * These are ready-to-use action creators with standard timeout values.
 *
 * @type {Object<string, Function>}
 *
 * @example
 * import { COURT_ACTIONS } from './socketActionHelper';
 *
 * // In store action
 * const response = await COURT_ACTIONS.accept(socketRef, {});
 */
export const COURT_ACTIONS = {
  serve: createSocketAction('court:serve', { timeoutMs: 2500 }),
  accept: createSocketAction('court:accept', { timeoutMs: 2500 }),
  cancel: createSocketAction('court:cancel', { timeoutMs: 2500 }),
  dismiss: createSocketAction('court:dismiss', { timeoutMs: 2500 }),
  submitEvidence: createSocketAction('court:submit_evidence', { timeoutMs: 2500 }),
  acceptVerdict: createSocketAction('court:accept_verdict', { timeoutMs: 2500 }),
  requestSettle: createSocketAction('court:request_settle', { timeoutMs: 2500 }),
  acceptSettle: createSocketAction('court:accept_settle', { timeoutMs: 2500 }),
  declineSettle: createSocketAction('court:decline_settle', { timeoutMs: 2500 }),
  submitAddendum: createSocketAction('court:submit_addendum', { timeoutMs: 4000 }),
  primingComplete: createSocketAction('court:priming_complete', { timeoutMs: 2500 }),
  jointReady: createSocketAction('court:joint_ready', { timeoutMs: 2500 }),
  resolutionPick: createSocketAction('court:resolution_pick', { timeoutMs: 2500 }),
  resolutionAcceptPartner: createSocketAction('court:resolution_accept_partner', { timeoutMs: 2500 }),
  resolutionHybrid: createSocketAction('court:resolution_hybrid', { timeoutMs: 5000 })
};
