/**
 * Push Notifications Service
 *
 * Handles push notification initialization, registration, and navigation
 * for the Pause app using Capacitor Push Notifications plugin and Firebase Cloud Messaging.
 *
 * Only functional on native iOS/Android via Capacitor.
 */

import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from './supabase';

// Track listener registration to prevent duplicates
let listenersRegistered = false;

// UUID validation regex for safe navigation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Check if we're running on a native platform (iOS/Android)
 */
export const isNativePlatform = () => Capacitor.isNativePlatform();

/**
 * Initialize push notifications for the app.
 * Should be called after user authentication.
 *
 * @returns {Promise<boolean>} true if initialization was successful
 */
export const initializePushNotifications = async () => {
    if (!isNativePlatform()) {
        console.log('[Push] Not a native platform, skipping initialization');
        return false;
    }

    try {
        // Check current permission status
        const permStatus = await PushNotifications.checkPermissions();

        if (permStatus.receive === 'prompt') {
            // Request permission
            const result = await PushNotifications.requestPermissions();
            if (result.receive !== 'granted') {
                console.log('[Push] Permission denied');
                return false;
            }
        } else if (permStatus.receive !== 'granted') {
            console.log('[Push] Permission not granted:', permStatus.receive);
            return false;
        }

        // Register for push notifications
        await PushNotifications.register();

        // Set up listeners (only once)
        setupPushListeners();

        console.log('[Push] Initialization successful');
        return true;
    } catch (error) {
        console.error('[Push] Initialization failed:', error);
        return false;
    }
};

/**
 * Set up all push notification event listeners.
 * Only registers listeners once to prevent duplicate handlers.
 */
const setupPushListeners = () => {
    if (listenersRegistered) {
        console.log('[Push] Listeners already registered, skipping');
        return;
    }

    // Token received - save to database
    PushNotifications.addListener('registration', async (token) => {
        console.log('[Push] Registration token received');
        await saveDeviceToken(token.value);
    });

    // Registration error
    PushNotifications.addListener('registrationError', (error) => {
        console.error('[Push] Registration error:', error);
    });

    // Notification received while app is in foreground
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('[Push] Foreground notification received');
        handleForegroundNotification(notification);
    });

    // Notification tapped (app opened from notification)
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('[Push] Notification action performed');
        handleNotificationNavigation(action.notification.data);
    });

    listenersRegistered = true;
    console.log('[Push] Listeners registered');
};

/**
 * Save device token to Supabase device_tokens table.
 * Uses upsert with onConflict to handle token updates gracefully.
 *
 * @param {string} token - The FCM/APNs device token
 * @returns {Promise<boolean>} true if token was saved successfully
 */
export const saveDeviceToken = async (token) => {
    if (!token) {
        console.error('[Push] Cannot save empty token');
        return false;
    }

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.log('[Push] No user logged in, cannot save token');
            return false;
        }

        const platform = Capacitor.getPlatform(); // 'ios' or 'android'

        const { error } = await supabase.from('device_tokens').upsert(
            {
                user_id: user.id,
                token: token,
                platform: platform,
                active: true,
                last_used_at: new Date().toISOString(),
            },
            {
                onConflict: 'token',
                ignoreDuplicates: false,
            }
        );

        if (error) {
            console.error('[Push] Error saving token:', error);
            return false;
        }

        console.log('[Push] Token saved successfully');
        return true;
    } catch (error) {
        console.error('[Push] Exception saving token:', error);
        return false;
    }
};

/**
 * Handle foreground notification display.
 * Called when a notification is received while the app is in the foreground.
 *
 * @param {object} notification - The push notification object
 * @param {string} notification.title - Notification title
 * @param {string} notification.body - Notification body
 * @param {object} notification.data - Custom data payload
 */
export const handleForegroundNotification = (notification) => {
    // Log notification details for debugging
    console.log('[Push] Foreground notification:', {
        title: notification.title,
        body: notification.body,
        data: notification.data,
    });

    // The app can show an in-app toast/banner here if desired.
    // For now, we just log - the UI layer can subscribe to events
    // or implement a notification center component.

    // Dispatch a custom event that UI components can listen to
    if (typeof window !== 'undefined') {
        const event = new CustomEvent('pushNotificationReceived', {
            detail: {
                title: notification.title,
                body: notification.body,
                data: notification.data,
            },
        });
        window.dispatchEvent(event);
    }
};

/**
 * Handle navigation when a notification is tapped.
 * Routes user to the appropriate screen based on notification data.
 *
 * @param {object} data - The notification data payload
 * @param {string} data.screen - Target screen identifier
 * @param {string} data.type - Notification type (fallback for screen)
 * @param {string} data.case_id - Case ID for case_detail navigation
 * @param {string} data.sessionId - Session ID for courtroom navigation
 * @param {string} data.challengeId - Challenge ID for challenges navigation
 */
export const handleNotificationNavigation = (data) => {
    if (!data) {
        console.log('[Push] No navigation data provided');
        return;
    }

    const screen = data.screen || data.type;
    console.log('[Push] Navigating to screen:', screen);

    switch (screen) {
        case 'courtroom':
        case 'court_session':
        case 'evidence_submitted':
        case 'settlement_request':
            // Navigate to courtroom for all court-related notifications
            window.location.href = '/courtroom';
            break;

        case 'case_detail':
        case 'verdict':
            // Navigate to specific case or history list
            // Validate case_id as UUID to prevent path traversal
            if (data.case_id && UUID_REGEX.test(data.case_id)) {
                window.location.href = `/history/${data.case_id}`;
            } else {
                window.location.href = '/history';
            }
            break;

        case 'appreciations':
        case 'appreciation':
            // Navigate to appreciations page
            window.location.href = '/appreciations';
            break;

        case 'daily_meow':
        case 'daily_question':
            // Navigate to daily question page
            window.location.href = '/daily-meow';
            break;

        case 'challenges':
        case 'challenge':
        case 'challenge_completion':
        case 'challenge_confirmed':
            // Navigate to challenges page
            window.location.href = '/challenges';
            break;

        case 'partner_connected':
        case 'home':
            // Navigate to home screen
            window.location.href = '/';
            break;

        default:
            // Default to home for unknown notification types
            console.log('[Push] Unknown screen type, navigating to home');
            window.location.href = '/';
    }
};

/**
 * Deactivate device token on logout.
 * Marks all tokens for the current user as inactive so they
 * won't receive notifications until they log in again.
 *
 * @returns {Promise<boolean>} true if deactivation was successful
 */
export const deactivateDeviceToken = async () => {
    if (!isNativePlatform()) {
        return true;
    }

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.log('[Push] No user to deactivate tokens for');
            return true;
        }

        const { error } = await supabase
            .from('device_tokens')
            .update({ active: false })
            .eq('user_id', user.id);

        if (error) {
            console.error('[Push] Error deactivating tokens:', error);
            return false;
        }

        console.log('[Push] Tokens deactivated for user');
        return true;
    } catch (error) {
        console.error('[Push] Exception deactivating tokens:', error);
        return false;
    }
};

/**
 * Remove all push notification listeners.
 * Call this on app cleanup or when reinitializing.
 *
 * @returns {Promise<void>}
 */
export const removePushListeners = async () => {
    if (!isNativePlatform()) {
        return;
    }

    try {
        await PushNotifications.removeAllListeners();
        listenersRegistered = false;
        console.log('[Push] All listeners removed');
    } catch (error) {
        console.error('[Push] Error removing listeners:', error);
    }
};

/**
 * Get current permission status.
 * Useful for displaying permission prompts in settings.
 *
 * @returns {Promise<string>} Permission status: 'granted', 'denied', or 'prompt'
 */
export const getPermissionStatus = async () => {
    if (!isNativePlatform()) {
        return 'denied';
    }

    try {
        const status = await PushNotifications.checkPermissions();
        return status.receive;
    } catch (error) {
        console.error('[Push] Error checking permissions:', error);
        return 'denied';
    }
};

/**
 * Request push notification permissions.
 * Use this to explicitly prompt the user for permissions.
 *
 * @returns {Promise<boolean>} true if permission was granted
 */
export const requestPermissions = async () => {
    if (!isNativePlatform()) {
        return false;
    }

    try {
        const result = await PushNotifications.requestPermissions();
        return result.receive === 'granted';
    } catch (error) {
        console.error('[Push] Error requesting permissions:', error);
        return false;
    }
};

export default {
    isNativePlatform,
    initializePushNotifications,
    saveDeviceToken,
    handleForegroundNotification,
    handleNotificationNavigation,
    deactivateDeviceToken,
    removePushListeners,
    getPermissionStatus,
    requestPermissions,
};
