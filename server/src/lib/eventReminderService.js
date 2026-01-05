/**
 * Event Reminder Service
 *
 * Sends push notifications for upcoming calendar events.
 * Checks for events happening in 1 day and 3 days and sends reminders
 * at 12PM in the user's timezone.
 *
 * @module eventReminderService
 */

const { getSupabase } = require('./supabase');
const { sendNotificationToUser } = require('./notificationService');

/**
 * Default timezone if user hasn't set one
 */
const DEFAULT_TIMEZONE = 'America/New_York';

/**
 * Reminder intervals in days
 */
const REMINDER_DAYS = [1, 3];

/**
 * Hour to send reminders (24-hour format)
 */
const REMINDER_HOUR = 12;

/**
 * Window in minutes to consider "around" the reminder hour
 * This accounts for cron jobs that may not run exactly at :00
 */
const REMINDER_WINDOW_MINUTES = 30;

/**
 * Check if the current time is within the reminder window for a given timezone
 *
 * @param {string} timezone - IANA timezone string (e.g., 'America/New_York')
 * @returns {boolean} True if current time is within the reminder window
 */
function isWithinReminderWindow(timezone) {
    try {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            hour: 'numeric',
            minute: 'numeric',
            hour12: false,
        });

        const parts = formatter.formatToParts(now);
        const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
        const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);

        const totalMinutes = hour * 60 + minute;
        const targetMinutes = REMINDER_HOUR * 60;
        const windowStart = targetMinutes - REMINDER_WINDOW_MINUTES;
        const windowEnd = targetMinutes + REMINDER_WINDOW_MINUTES;

        return totalMinutes >= windowStart && totalMinutes <= windowEnd;
    } catch (error) {
        console.error('[EventReminder] Error checking reminder window:', error);
        return false;
    }
}

/**
 * Get the date string in a specific timezone (YYYY-MM-DD format)
 *
 * @param {Date} date - The date to format
 * @param {string} timezone - IANA timezone string
 * @returns {string} Date string in YYYY-MM-DD format
 */
function getDateInTimezone(date, timezone) {
    try {
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
        return formatter.format(date);
    } catch (error) {
        console.error('[EventReminder] Error formatting date:', error);
        // Fall back to UTC date
        return date.toISOString().split('T')[0];
    }
}

/**
 * Add days to a date
 *
 * @param {Date} date - The base date
 * @param {number} days - Number of days to add
 * @returns {Date} New date with days added
 */
function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

/**
 * Check if a reminder has already been sent for an event+date combination
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase - Supabase client
 * @param {string} userId - User ID
 * @param {string} eventId - Calendar event ID
 * @param {number} daysUntil - Days until the event (1 or 3)
 * @returns {Promise<boolean>} True if reminder was already sent
 */
async function wasReminderAlreadySent(supabase, userId, eventId, daysUntil) {
    try {
        // Check notification_log for existing reminder
        // We include the days info in the data payload to distinguish 1-day vs 3-day reminders
        const today = new Date().toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('notification_log')
            .select('id')
            .eq('user_id', userId)
            .eq('type', 'event_reminders')
            .gte('sent_at', `${today}T00:00:00Z`)
            .lte('sent_at', `${today}T23:59:59Z`)
            .contains('data', { eventId, daysUntil })
            .limit(1);

        if (error) {
            console.error('[EventReminder] Error checking existing reminder:', error);
            // Return false to allow sending (fail-open approach)
            return false;
        }

        return data && data.length > 0;
    } catch (error) {
        console.error('[EventReminder] Error in wasReminderAlreadySent:', error);
        return false;
    }
}

/**
 * Get upcoming events for a user within the reminder days window
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase - Supabase client
 * @param {string} userId - User ID
 * @param {string} timezone - User's timezone
 * @returns {Promise<Array<{event: Object, daysUntil: number}>>} Events with days until
 */
async function getUpcomingEventsForUser(supabase, userId, timezone) {
    const results = [];
    const now = new Date();

    for (const days of REMINDER_DAYS) {
        const targetDate = addDays(now, days);
        const targetDateStr = getDateInTimezone(targetDate, timezone);

        // Get events on the target date
        // User can see events they created, or partner's non-secret events
        const { data: events, error } = await supabase
            .from('calendar_events')
            .select('id, title, event_date, event_type, emoji, created_by, is_secret')
            .eq('event_date', targetDateStr);

        if (error) {
            console.error('[EventReminder] Error fetching events:', error);
            continue;
        }

        // Filter events that this user should be notified about
        for (const event of events || []) {
            // User can see their own events
            if (event.created_by === userId) {
                results.push({ event, daysUntil: days });
                continue;
            }

            // User can see partner's non-secret events
            if (!event.is_secret) {
                // Check if this user is the partner of the event creator
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('partner_id')
                    .eq('id', userId)
                    .single();

                if (profile?.partner_id === event.created_by) {
                    results.push({ event, daysUntil: days });
                }
            }
        }
    }

    return results;
}

/**
 * Send event reminder notification to a user
 *
 * @param {string} userId - User ID
 * @param {Object} event - Calendar event object
 * @param {number} daysUntil - Days until the event
 * @returns {Promise<Object>} Notification result
 */
async function sendEventReminder(userId, event, daysUntil) {
    const title = daysUntil === 1 ? 'Event Tomorrow' : 'Upcoming Event';
    const body = daysUntil === 1
        ? `${event.title} is tomorrow!`
        : `${event.title} is in ${daysUntil} days`;

    return sendNotificationToUser(userId, {
        type: 'event_reminders',
        title,
        body,
        data: {
            screen: 'calendar',
            eventId: event.id,
            daysUntil,
        },
    });
}

/**
 * Process event reminders for all users
 *
 * This function should be called by a cron job at regular intervals (e.g., every hour).
 * It checks all users with event_reminders enabled, and for each user:
 * 1. Checks if current time is around 12PM in their timezone
 * 2. Finds calendar events 1 or 3 days away
 * 3. Sends notifications using sendNotificationToUser
 *
 * @returns {Promise<{processed: number, sent: number, skipped: number, errors: number}>} Processing results
 */
async function processEventReminders() {
    const stats = {
        processed: 0,
        sent: 0,
        skipped: 0,
        errors: 0,
    };

    try {
        const supabase = getSupabase();

        // Get all users with event_reminders enabled
        const { data: preferences, error: prefError } = await supabase
            .from('notification_preferences')
            .select('user_id, timezone')
            .eq('notifications_enabled', true)
            .eq('event_reminders', true);

        if (prefError) {
            console.error('[EventReminder] Error fetching preferences:', prefError);
            return stats;
        }

        if (!preferences || preferences.length === 0) {
            console.log('[EventReminder] No users with event_reminders enabled');
            return stats;
        }

        console.log(`[EventReminder] Processing ${preferences.length} users with event reminders enabled`);

        for (const pref of preferences) {
            stats.processed++;
            const userId = pref.user_id;
            const timezone = pref.timezone || DEFAULT_TIMEZONE;

            try {
                // Check if current time is within the reminder window for this user's timezone
                if (!isWithinReminderWindow(timezone)) {
                    stats.skipped++;
                    continue;
                }

                // Get upcoming events for this user
                const upcomingEvents = await getUpcomingEventsForUser(supabase, userId, timezone);

                if (upcomingEvents.length === 0) {
                    continue;
                }

                // Send reminders for each event
                for (const { event, daysUntil } of upcomingEvents) {
                    // Check if reminder was already sent today for this event+days combination
                    const alreadySent = await wasReminderAlreadySent(supabase, userId, event.id, daysUntil);
                    if (alreadySent) {
                        console.log(`[EventReminder] Skipping duplicate reminder for user ${userId}, event ${event.id}, ${daysUntil} days`);
                        stats.skipped++;
                        continue;
                    }

                    // Send the reminder
                    const result = await sendEventReminder(userId, event, daysUntil);

                    if (result.success) {
                        stats.sent++;
                        console.log(`[EventReminder] Sent reminder to ${userId} for event "${event.title}" (${daysUntil} days)`);
                    } else {
                        console.log(`[EventReminder] Failed to send to ${userId}: ${result.reason || result.error}`);
                        if (result.reason === 'no_tokens' || result.reason === 'user_preferences') {
                            stats.skipped++;
                        } else {
                            stats.errors++;
                        }
                    }
                }
            } catch (userError) {
                console.error(`[EventReminder] Error processing user ${userId}:`, userError);
                stats.errors++;
            }
        }

        console.log(`[EventReminder] Processing complete: processed=${stats.processed}, sent=${stats.sent}, skipped=${stats.skipped}, errors=${stats.errors}`);
        return stats;
    } catch (error) {
        console.error('[EventReminder] Fatal error in processEventReminders:', error);
        stats.errors++;
        return stats;
    }
}

module.exports = {
    processEventReminders,
    // Export for testing
    isWithinReminderWindow,
    getDateInTimezone,
    wasReminderAlreadySent,
    getUpcomingEventsForUser,
    sendEventReminder,
    REMINDER_DAYS,
    REMINDER_HOUR,
    DEFAULT_TIMEZONE,
};
