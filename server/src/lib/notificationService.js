/**
 * Notification Service
 *
 * High-level notification service for sending push notifications to users.
 * Handles user preferences, quiet hours, device token management, and logging.
 *
 * @module notificationService
 */

const { getSupabase } = require('./supabase');
const { sendPushNotification } = require('./firebaseService');

/**
 * @typedef {Object} NotificationPayload
 * @property {string} type - Notification type for preference checking (e.g., 'court_session', 'appreciation')
 * @property {string} title - Notification title
 * @property {string} body - Notification body text
 * @property {Object} [data] - Custom data payload for deep linking
 * @property {string} [data.screen] - Screen to navigate to on tap
 * @property {string} [data.sessionId] - Court session ID if applicable
 * @property {string} [data.caseId] - Case ID if applicable
 */

/**
 * @typedef {Object} NotificationResult
 * @property {boolean} success - Whether the notification was sent successfully
 * @property {string} [reason] - Reason for failure if not successful
 * @property {string} [error] - Error message if an exception occurred
 * @property {string} [messageId] - Firebase message ID if successful (single token)
 * @property {number} [successCount] - Number of successful sends (multiple tokens)
 * @property {number} [failureCount] - Number of failed sends (multiple tokens)
 */

/**
 * Send notification to a specific user
 *
 * Checks user preferences (including quiet hours), retrieves active device tokens,
 * sends via Firebase, logs the attempt, and cleans up invalid tokens.
 *
 * @param {string} userId - Target user ID
 * @param {NotificationPayload} notification - Notification details
 * @returns {Promise<NotificationResult>} Result with success status
 *
 * @example
 * await sendNotificationToUser('user-uuid', {
 *   type: 'court_session',
 *   title: 'Court Session Request',
 *   body: 'Partner wants to settle a dispute',
 *   data: { screen: 'courtroom', sessionId: 'session-uuid' }
 * });
 */
async function sendNotificationToUser(userId, notification) {
    try {
        const supabase = getSupabase();

        // Check user preferences and quiet hours using RPC function
        const { data: shouldSend, error: prefError } = await supabase.rpc(
            'should_send_notification',
            {
                target_user_id: userId,
                notification_type: notification.type
            }
        );

        if (prefError) {
            console.error('[Notification] Preference check error:', prefError);
            // Continue anyway - don't block notifications due to preference check failure
        }

        // If preferences explicitly say no, respect that
        if (shouldSend === false) {
            console.log(`[Notification] Skipped for user ${userId}: user preferences`);
            return { success: false, reason: 'user_preferences' };
        }

        // Get active device tokens for user
        const { data: tokenRecords, error: tokenError } = await supabase
            .from('device_tokens')
            .select('id, token')
            .eq('user_id', userId)
            .eq('active', true);

        if (tokenError) {
            console.error('[Notification] Token fetch error:', tokenError);
            return { success: false, reason: 'token_error', error: tokenError.message };
        }

        if (!tokenRecords || tokenRecords.length === 0) {
            console.log(`[Notification] No active tokens for user ${userId}`);
            return { success: false, reason: 'no_tokens' };
        }

        const tokens = tokenRecords.map(t => t.token);

        // Send via Firebase
        const result = await sendPushNotification({
            tokens,
            title: notification.title,
            body: notification.body,
            data: {
                type: notification.type,
                ...notification.data,
            },
        });

        // Log notification attempt
        await logNotification(supabase, userId, notification, result);

        // Handle invalid tokens (clean up)
        if (result.responses) {
            await cleanupInvalidTokens(supabase, tokens, result.responses);
        }

        return result;
    } catch (error) {
        console.error('[Notification] Send error:', error);
        return { success: false, reason: 'error', error: error.message };
    }
}

/**
 * Send notification to both users in a couple
 *
 * @param {string} userAId - First user ID
 * @param {string} userBId - Second user ID
 * @param {NotificationPayload} notification - Notification details
 * @returns {Promise<{userA: NotificationResult, userB: NotificationResult}>} Results for both users
 *
 * @example
 * await sendNotificationToCouple('user-a-uuid', 'user-b-uuid', {
 *   type: 'verdict',
 *   title: 'Verdict Ready',
 *   body: 'Judge Whiskers has delivered a verdict',
 *   data: { screen: 'case_detail', caseId: 'case-uuid' }
 * });
 */
async function sendNotificationToCouple(userAId, userBId, notification) {
    const results = await Promise.all([
        sendNotificationToUser(userAId, notification),
        sendNotificationToUser(userBId, notification),
    ]);

    return {
        userA: results[0],
        userB: results[1],
    };
}

/**
 * Send notification to a user's partner
 *
 * Looks up the partner_id from the profiles table and sends notification to them.
 *
 * @param {string} userId - The user whose partner should be notified
 * @param {NotificationPayload} notification - Notification details
 * @returns {Promise<NotificationResult>} Result with success status
 *
 * @example
 * await sendNotificationToPartner('user-uuid', {
 *   type: 'appreciation',
 *   title: 'New Appreciation',
 *   body: 'Your partner sent you an appreciation',
 *   data: { screen: 'appreciations' }
 * });
 */
async function sendNotificationToPartner(userId, notification) {
    try {
        const supabase = getSupabase();

        // Get partner ID from profiles table
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('partner_id')
            .eq('id', userId)
            .single();

        if (error) {
            console.error('[Notification] Error fetching partner:', error);
            return { success: false, reason: 'partner_lookup_error', error: error.message };
        }

        if (!profile?.partner_id) {
            console.log(`[Notification] No partner found for user ${userId}`);
            return { success: false, reason: 'no_partner' };
        }

        return sendNotificationToUser(profile.partner_id, notification);
    } catch (error) {
        console.error('[Notification] Partner notification error:', error);
        return { success: false, reason: 'error', error: error.message };
    }
}

/**
 * Log notification attempt to the notification_log table
 *
 * @private
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase - Supabase client
 * @param {string} userId - Target user ID
 * @param {NotificationPayload} notification - Notification details
 * @param {NotificationResult} result - Send result
 */
async function logNotification(supabase, userId, notification, result) {
    try {
        await supabase.from('notification_log').insert({
            user_id: userId,
            type: notification.type,
            title: notification.title,
            body: notification.body,
            data: notification.data || null,
            status: result.success ? 'sent' : 'failed',
            error_message: result.error || result.reason || null,
        });
    } catch (logError) {
        // Log errors should not fail the notification
        console.error('[Notification] Failed to log notification:', logError);
    }
}

/**
 * Clean up invalid device tokens by marking them as inactive
 *
 * @private
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase - Supabase client
 * @param {string[]} tokens - Original tokens that were sent to
 * @param {Array<{success: boolean, error?: {code: string}}>} responses - Firebase responses
 */
async function cleanupInvalidTokens(supabase, tokens, responses) {
    const invalidTokens = [];

    responses.forEach((resp, idx) => {
        if (!resp.success) {
            const errorCode = resp.error?.code;
            if (
                errorCode === 'messaging/invalid-registration-token' ||
                errorCode === 'messaging/registration-token-not-registered'
            ) {
                invalidTokens.push(tokens[idx]);
            }
        }
    });

    // Deactivate invalid tokens
    if (invalidTokens.length > 0) {
        try {
            await supabase
                .from('device_tokens')
                .update({ active: false })
                .in('token', invalidTokens);
            console.log(`[Notification] Deactivated ${invalidTokens.length} invalid tokens`);
        } catch (cleanupError) {
            console.error('[Notification] Failed to cleanup invalid tokens:', cleanupError);
        }
    }
}

module.exports = {
    sendNotificationToUser,
    sendNotificationToCouple,
    sendNotificationToPartner,
};
