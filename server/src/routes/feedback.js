/**
 * Feedback Routes
 * 
 * Handles user feedback submissions (contact, bug reports, feature requests).
 */

const express = require('express');
const router = express.Router();
const { requireAuthUserId, requireSupabase } = require('../lib/auth');
const { safeErrorMessage } = require('../lib/shared/errorUtils');

// Valid feedback types
const VALID_FEEDBACK_TYPES = ['contact', 'bug', 'feature'];

// Submit feedback
router.post('/', async (req, res) => {
    try {
        const userId = await requireAuthUserId(req);
        const supabase = requireSupabase();
        const { type, message, deviceInfo } = req.body;

        // Validate type
        if (!type || !VALID_FEEDBACK_TYPES.includes(type)) {
            return res.status(400).json({
                error: `Invalid feedback type. Must be one of: ${VALID_FEEDBACK_TYPES.join(', ')}`
            });
        }

        // Validate message
        const safeMessage = typeof message === 'string' ? message.trim() : '';
        if (!safeMessage) {
            return res.status(400).json({ error: 'Message is required' });
        }
        if (safeMessage.length > 5000) {
            return res.status(400).json({ error: 'Message is too long (max 5000 characters)' });
        }

        // Insert feedback
        const { data: feedback, error: insertError } = await supabase
            .from('user_feedback')
            .insert({
                user_id: userId,
                feedback_type: type,
                message: safeMessage,
                device_info: deviceInfo || null
            })
            .select()
            .single();

        if (insertError) throw insertError;

        res.json({
            success: true,
            feedbackId: feedback.id
        });
    } catch (error) {
        console.error('[Feedback] Error submitting feedback:', error);
        res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

module.exports = router;
