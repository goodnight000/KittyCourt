/**
 * Event Bus for decoupling Zustand stores
 *
 * Provides a simple publish-subscribe pattern to enable stores to communicate
 * without direct dependencies. This is particularly useful for cross-cutting
 * concerns like auth state changes that affect multiple stores.
 *
 * @example
 * // Subscribe to an event
 * const unsubscribe = eventBus.on(EVENTS.AUTH_LOGIN, (data) => {
 *   console.log('User logged in:', data.userId);
 * });
 *
 * // Emit an event
 * eventBus.emit(EVENTS.AUTH_LOGIN, { userId: '123', profile: {...} });
 *
 * // Unsubscribe when done
 * unsubscribe();
 */
class EventBus {
  constructor() {
    /**
     * Map of event names to arrays of callback functions
     * @type {Object.<string, Function[]>}
     */
    this.listeners = {};
  }

  /**
   * Subscribe to an event
   *
   * @param {string} event - The event name to listen for
   * @param {Function} callback - Function to call when event is emitted
   * @returns {Function} Unsubscribe function to remove the listener
   *
   * @example
   * const unsubscribe = eventBus.on(EVENTS.AUTH_LOGIN, (data) => {
   *   console.log('Logged in:', data);
   * });
   */
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);

    // Return unsubscribe function
    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  }

  /**
   * Emit an event to all subscribers
   *
   * @param {string} event - The event name to emit
   * @param {*} data - Data to pass to all listeners
   *
   * @example
   * eventBus.emit(EVENTS.PROFILE_UPDATED, {
   *   userId: '123',
   *   changes: { display_name: 'New Name' }
   * });
   */
  emit(event, data) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`[EventBus] Listener error for event '${event}':`, error);
      }
    });
  }

  /**
   * Remove all listeners for a specific event or all events
   *
   * @param {string} [event] - Optional event name. If not provided, clears all listeners.
   *
   * @example
   * // Clear all listeners for a specific event
   * eventBus.clear(EVENTS.AUTH_LOGIN);
   *
   * // Clear all listeners for all events
   * eventBus.clear();
   */
  clear(event) {
    if (event) {
      delete this.listeners[event];
    } else {
      this.listeners = {};
    }
  }

  /**
   * Get the number of listeners for a specific event
   *
   * @param {string} event - The event name
   * @returns {number} Number of listeners subscribed to the event
   *
   * @example
   * const count = eventBus.listenerCount(EVENTS.AUTH_LOGIN);
   * console.log(`${count} listeners for auth login`);
   */
  listenerCount(event) {
    return this.listeners[event]?.length || 0;
  }

  /**
   * Subscribe to an event only once
   *
   * @param {string} event - The event name to listen for
   * @param {Function} callback - Function to call when event is emitted
   * @returns {Function} Unsubscribe function to remove the listener
   *
   * @example
   * eventBus.once(EVENTS.AUTH_LOGIN, (data) => {
   *   console.log('First login only:', data);
   * });
   */
  once(event, callback) {
    const unsubscribe = this.on(event, (data) => {
      callback(data);
      unsubscribe();
    });
    return unsubscribe;
  }
}

/**
 * Singleton event bus instance
 * @type {EventBus}
 */
export const eventBus = new EventBus();

/**
 * Standard event types used across the application
 *
 * Naming convention: <domain>:<action>
 * - auth: Authentication and session events
 * - profile: User profile changes
 * - partner: Partner connection events
 * - language: Localization changes
 *
 * @enum {string}
 */
export const EVENTS = {
  /**
   * Fired when a user successfully logs in
   * @payload {{ userId: string, profile: Object }}
   */
  AUTH_LOGIN: 'auth:login',

  /**
   * Fired when a user logs out
   * @payload {{ userId: string }}
   */
  AUTH_LOGOUT: 'auth:logout',

  /**
   * Fired when the auth session is refreshed
   * @payload {{ userId: string, session: Object }}
   */
  AUTH_SESSION_REFRESHED: 'auth:session-refreshed',

  /**
   * Fired when user profile is updated
   * @payload {{ userId: string, changes: Object }}
   */
  PROFILE_UPDATED: 'profile:updated',

  /**
   * Fired when a partner connection is established
   * @payload {{ userId: string, partnerId: string, partnerProfile: Object, anniversary_date: string }}
   */
  PARTNER_CONNECTED: 'partner:connected',

  /**
   * Fired when the application language is changed
   * @payload {{ language: string, previousLanguage: string }}
   */
  LANGUAGE_CHANGED: 'language:changed'
};
