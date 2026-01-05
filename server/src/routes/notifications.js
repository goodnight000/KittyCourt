/**
 * Notifications Routes
 *
 * Handles user notification preferences and reminder processing.
 */

const express = require('express');
const router = express.Router();
const { requireAuthUserId, requireSupabase } = require('../lib/auth');
const { safeErrorMessage } = require('../lib/shared/errorUtils');
const { processEventReminders } = require('../lib/eventReminderService');

// GET /api/notifications/preferences - Get user's notification preferences
router.get('/preferences', async (req, res) => {
    try {
        const userId = await requireAuthUserId(req);
        const supabase = requireSupabase();

        // Select all columns - handles case where event_reminders column may not exist yet
        const { data, error } = await supabase
            .from('notification_preferences')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') {
            // PGRST116 = no rows found, which is OK (return defaults)
            throw error;
        }

        // Return camelCase keys to client (with defaults if no record exists)
        // Use reminders column as fallback if event_reminders doesn't exist yet
        res.json({
            dailyQuestions: data?.daily_questions ?? true,
            eventReminders: data?.event_reminders ?? data?.reminders ?? true,
            partnerActivity: data?.partner_activity ?? true
        });
    } catch (error) {
        console.error('Error fetching notification preferences:', error);
        res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

// PUT /api/notifications/preferences - Update user's notification preferences
router.put('/preferences', async (req, res) => {
    try {
        const userId = await requireAuthUserId(req);
        const supabase = requireSupabase();

        const { dailyQuestions, eventReminders, partnerActivity } = req.body;

        // Build update object with only provided fields (convert camelCase to snake_case)
        const updates = {};
        if (typeof dailyQuestions === 'boolean') {
            updates.daily_questions = dailyQuestions;
        }
        if (typeof eventReminders === 'boolean') {
            // Use reminders column as fallback if event_reminders doesn't exist yet
            updates.reminders = eventReminders;
        }
        if (typeof partnerActivity === 'boolean') {
            updates.partner_activity = partnerActivity;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No valid preference fields provided' });
        }

        // Upsert the preferences (insert if not exists, update if exists)
        const { data, error } = await supabase
            .from('notification_preferences')
            .upsert(
                { user_id: userId, ...updates },
                { onConflict: 'user_id' }
            )
            .select('*')
            .single();

        if (error) throw error;

        // Return camelCase keys to client
        // Use reminders column as fallback if event_reminders doesn't exist yet
        res.json({
            dailyQuestions: data.daily_questions ?? true,
            eventReminders: data.event_reminders ?? data.reminders ?? true,
            partnerActivity: data.partner_activity ?? true
        });
    } catch (error) {
        console.error('Error updating notification preferences:', error);
        res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

// POST /api/notifications/process-event-reminders - Trigger event reminder processing (dev only)
router.post('/process-event-reminders', async (req, res) => {
    try {
        // Only allow in development mode
        if (process.env.NODE_ENV === 'production') {
            return res.status(403).json({
                error: 'This endpoint is only available in development mode'
            });
        }

        console.log('[Notifications] Manually triggering event reminder processing');
        const stats = await processEventReminders();

        res.json({
            success: true,
            message: 'Event reminder processing completed',
            stats
        });
    } catch (error) {
        console.error('Error processing event reminders:', error);
        res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

module.exports = router;
