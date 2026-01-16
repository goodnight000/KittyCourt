/**
 * Levels Routes
 *
 * Read-only endpoints for couple level status.
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { requireAuthUserId } = require('../lib/auth');
const { requirePartner } = require('../middleware/requirePartner');
const { isSupabaseConfigured } = require('../lib/supabase');
const { getLevelStatus, isXPSystemEnabled, getOrderedCoupleIds, awardXP, ACTION_TYPES } = require('../lib/xpService');
const { safeErrorMessage } = require('../lib/shared/errorUtils');
const { sendError } = require('../lib/http');

const router = express.Router();

/**
 * GET /api/levels/status
 *
 * Returns the couple's level status and a questions-answered count.
 */
router.get('/status', requirePartner, async (req, res) => {
    try {
        if (!isXPSystemEnabled()) {
            return res.json({ enabled: false });
        }

        if (!isSupabaseConfigured()) {
            return sendError(res, 503, 'SERVICE_UNAVAILABLE', 'Supabase not configured');
        }

        const { userId, partnerId, supabase } = req;

        const coupleIds = getOrderedCoupleIds(userId, partnerId);
        if (!coupleIds) {
            return sendError(res, 400, 'INVALID_INPUT', 'Invalid couple');
        }

        const levelResult = await getLevelStatus(userId, partnerId);
        if (!levelResult?.success || !levelResult?.data) {
            return sendError(res, 500, 'SERVER_ERROR', levelResult?.error || 'Failed to fetch level status');
        }

        let lastSeenLevel = levelResult.data.level;
        let shouldUpdateSeen = false;

        const { data: profileRow, error: profileError } = await supabase
            .from('profiles')
            .select('last_seen_level, last_seen_level_partner_id')
            .eq('id', userId)
            .maybeSingle();

        if (profileError) {
            console.warn('[Levels] Failed to load last seen level:', profileError);
        } else if (profileRow) {
            const storedLevel = Number(profileRow.last_seen_level);
            const storedPartner = profileRow.last_seen_level_partner_id;
            const isPartnerMatch = storedPartner && String(storedPartner) === String(partnerId);

            if (!isPartnerMatch || !Number.isFinite(storedLevel)) {
                lastSeenLevel = levelResult.data.level;
                shouldUpdateSeen = true;
            } else if (storedLevel > levelResult.data.level) {
                lastSeenLevel = levelResult.data.level;
                shouldUpdateSeen = true;
            } else {
                lastSeenLevel = storedLevel;
            }
        }

        const { count: questionsCount, error: countError } = await supabase
            .from('daily_answers')
            .select('id, couple_question_assignments!inner(user_a_id,user_b_id)', { count: 'exact', head: true })
            .eq('couple_question_assignments.user_a_id', coupleIds.user_a_id)
            .eq('couple_question_assignments.user_b_id', coupleIds.user_b_id);

        if (countError) {
            console.warn('[Levels] Failed to count daily answers:', countError);
        }

        if (shouldUpdateSeen) {
            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    last_seen_level: lastSeenLevel,
                    last_seen_level_partner_id: partnerId,
                })
                .eq('id', userId);

            if (updateError) {
                console.warn('[Levels] Failed to update last seen level:', updateError);
            }
        }

        return res.json({
            ...levelResult.data,
            questionsAnswered: countError ? 0 : (questionsCount || 0),
            lastSeenLevel,
        });
    } catch (error) {
        console.error('[Levels] Error fetching status:', error);
        return sendError(res, error.statusCode || 500, 'SERVER_ERROR', safeErrorMessage(error));
    }
});

/**
 * POST /api/levels/dev/award-xp
 *
 * Development-only endpoint to grant arbitrary XP for testing.
 */
router.post('/dev/award-xp', requirePartner, async (req, res) => {
    try {
        if (process.env.NODE_ENV === 'production') {
            return sendError(res, 404, 'NOT_FOUND', 'Not found');
        }

        if (!isXPSystemEnabled()) {
            return sendError(res, 400, 'XP_DISABLED', 'XP system disabled');
        }

        if (!isSupabaseConfigured()) {
            return sendError(res, 503, 'SERVICE_UNAVAILABLE', 'Supabase not configured');
        }

        // Input validation
        const amount = Number(req.body?.amount);
        if (req.body?.amount === undefined || req.body?.amount === null) {
            return sendError(res, 400, 'MISSING_AMOUNT', 'amount is required');
        }
        if (!Number.isFinite(amount) || !Number.isInteger(amount)) {
            return sendError(res, 400, 'INVALID_AMOUNT', 'amount must be a valid integer');
        }
        if (amount <= 0) {
            return sendError(res, 400, 'INVALID_AMOUNT', 'amount must be a positive integer');
        }
        if (amount > 10000) {
            return sendError(res, 400, 'INVALID_AMOUNT', 'amount must not exceed 10000');
        }

        const { userId, partnerId } = req;

        const result = await awardXP({
            userId,
            partnerId,
            actionType: ACTION_TYPES.DEBUG_GRANT,
            sourceId: `dev:${uuidv4()}`,
            xpOverride: amount,
            idempotencyKeyOverride: `debug_grant:${uuidv4()}`,
        });

        if (!result?.success) {
            return sendError(res, 500, 'SERVER_ERROR', result?.error || 'Failed to award XP');
        }

        return res.json(result);
    } catch (error) {
        console.error('[Levels] Error awarding debug XP:', error);
        return sendError(res, error.statusCode || 500, 'SERVER_ERROR', safeErrorMessage(error));
    }
});

/**
 * POST /api/levels/seen
 *
 * Update last seen level for the current user.
 */
router.post('/seen', requirePartner, async (req, res) => {
    try {
        if (!isXPSystemEnabled()) {
            return sendError(res, 400, 'XP_DISABLED', 'XP system disabled');
        }

        if (!isSupabaseConfigured()) {
            return sendError(res, 503, 'SERVICE_UNAVAILABLE', 'Supabase not configured');
        }

        const { userId, partnerId, supabase } = req;

        const levelResult = await getLevelStatus(userId, partnerId);
        if (!levelResult?.success || !levelResult?.data) {
            return sendError(res, 500, 'SERVER_ERROR', levelResult?.error || 'Failed to fetch level status');
        }

        const requested = Number(req.body?.level);
        const safeLevel = Number.isFinite(requested)
            ? Math.min(requested, levelResult.data.level)
            : levelResult.data.level;

        const { error: updateError } = await supabase
            .from('profiles')
            .update({
                last_seen_level: safeLevel,
                last_seen_level_partner_id: partnerId,
            })
            .eq('id', userId);

        if (updateError) {
            return sendError(res, 500, 'SERVER_ERROR', updateError.message);
        }

        return res.json({ success: true, lastSeenLevel: safeLevel });
    } catch (error) {
        console.error('[Levels] Error updating seen level:', error);
        return sendError(res, error.statusCode || 500, 'SERVER_ERROR', safeErrorMessage(error));
    }
});

module.exports = router;
