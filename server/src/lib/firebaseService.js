/**
 * Firebase Admin SDK Service
 *
 * Provides Firebase Cloud Messaging (FCM) functionality for push notifications.
 * Supports both iOS (via APNs) and Android platforms.
 *
 * Configuration options:
 * - FIREBASE_SERVICE_ACCOUNT_PATH: Path to service account JSON file
 * - OR inline credentials: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 */

const admin = require('firebase-admin');

let _firebaseApp = null;

/**
 * Initialize Firebase Admin SDK
 * Uses singleton pattern - only initializes once
 *
 * @returns {import('firebase-admin').app.App} The Firebase app instance
 * @throws {Error} If Firebase is not configured
 */
function initializeFirebase() {
    if (_firebaseApp) {
        return _firebaseApp;
    }

    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

    if (serviceAccountPath) {
        // Use service account file
        try {
            const serviceAccount = require(serviceAccountPath);
            _firebaseApp = admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
            console.log('[Firebase] Admin SDK initialized from service account file');
        } catch (error) {
            console.error('[Firebase] Error loading service account file:', error.message);
            throw new Error(`Failed to load Firebase service account from ${serviceAccountPath}: ${error.message}`);
        }
    } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
        // Use inline environment variables
        _firebaseApp = admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                // Handle escaped newlines in private key (common in env vars)
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            }),
        });
        console.log('[Firebase] Admin SDK initialized from environment variables');
    } else {
        throw new Error(
            'Firebase is not configured. Set FIREBASE_SERVICE_ACCOUNT_PATH or provide FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.'
        );
    }

    return _firebaseApp;
}

/**
 * Check if Firebase is configured
 *
 * @returns {boolean} True if Firebase credentials are available
 */
function isFirebaseConfigured() {
    return !!(
        process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
        (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY)
    );
}

/**
 * Send push notification to device tokens
 * Handles single token (send) and multiple tokens (sendEachForMulticast)
 *
 * @param {Object} options - Notification options
 * @param {string|string[]} options.tokens - FCM device token(s)
 * @param {string} options.title - Notification title
 * @param {string} options.body - Notification body
 * @param {Object} [options.data={}] - Custom data payload (all values must be strings)
 * @returns {Promise<Object>} Result object with success status and details
 */
async function sendPushNotification({ tokens, title, body, data = {} }) {
    // Normalize tokens to array
    const tokenArray = Array.isArray(tokens) ? tokens : [tokens];

    if (!tokenArray || tokenArray.length === 0) {
        return { success: false, reason: 'no_tokens' };
    }

    // Filter out empty/null tokens
    const validTokens = tokenArray.filter(token => token && typeof token === 'string');
    if (validTokens.length === 0) {
        return { success: false, reason: 'no_valid_tokens' };
    }

    try {
        initializeFirebase();
    } catch (error) {
        console.error('[Firebase] Initialization error:', error.message);
        return { success: false, reason: 'firebase_not_configured', error: error.message };
    }

    // Ensure all data values are strings (FCM requirement)
    const stringifiedData = Object.fromEntries(
        Object.entries(data).map(([key, value]) => [key, String(value)])
    );

    // Build the message payload
    const baseMessage = {
        notification: {
            title,
            body,
        },
        data: stringifiedData,
        // iOS-specific settings (APNs)
        apns: {
            payload: {
                aps: {
                    badge: 1,
                    sound: 'default',
                },
            },
        },
        // Android-specific settings
        android: {
            priority: 'high',
            notification: {
                sound: 'default',
                channelId: 'pause_notifications',
            },
        },
    };

    try {
        if (validTokens.length === 1) {
            // Single token - use send()
            const response = await admin.messaging().send({
                ...baseMessage,
                token: validTokens[0],
            });

            return {
                success: true,
                messageId: response,
                successCount: 1,
                failureCount: 0,
            };
        } else {
            // Multiple tokens - use sendEachForMulticast()
            const response = await admin.messaging().sendEachForMulticast({
                ...baseMessage,
                tokens: validTokens,
            });

            return {
                success: response.successCount > 0,
                successCount: response.successCount,
                failureCount: response.failureCount,
                responses: response.responses,
            };
        }
    } catch (error) {
        console.error('[Firebase] Send notification error:', error);
        return {
            success: false,
            reason: 'send_error',
            error: error.message,
        };
    }
}

/**
 * Validate tokens and return invalid ones for cleanup
 * Uses dry run to check token validity without sending actual notifications
 *
 * @param {string[]} tokens - Array of FCM tokens to validate
 * @returns {Promise<string[]>} Array of invalid tokens that should be removed
 */
async function getInvalidTokens(tokens) {
    if (!tokens || tokens.length === 0) {
        return [];
    }

    // Filter out empty/null tokens
    const validTokens = tokens.filter(token => token && typeof token === 'string');
    if (validTokens.length === 0) {
        return [];
    }

    try {
        initializeFirebase();
    } catch (error) {
        console.error('[Firebase] Initialization error:', error.message);
        return [];
    }

    const invalidTokens = [];

    try {
        // Send a dry run to check validity (doesn't actually send notifications)
        const response = await admin.messaging().sendEachForMulticast(
            {
                tokens: validTokens,
                notification: {
                    title: 'Token validation',
                    body: 'This is a dry run',
                },
            },
            true // dryRun flag
        );

        response.responses.forEach((resp, idx) => {
            if (!resp.success && resp.error) {
                const errorCode = resp.error.code;
                // These error codes indicate the token is no longer valid
                if (
                    errorCode === 'messaging/invalid-registration-token' ||
                    errorCode === 'messaging/registration-token-not-registered'
                ) {
                    invalidTokens.push(validTokens[idx]);
                }
            }
        });
    } catch (error) {
        console.error('[Firebase] Token validation error:', error);
        // Return empty array on error - don't mark tokens as invalid on network issues
    }

    return invalidTokens;
}

module.exports = {
    initializeFirebase,
    isFirebaseConfigured,
    sendPushNotification,
    getInvalidTokens,
};
