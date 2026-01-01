/**
 * Levels Routes
 *
 * Read-only endpoints for couple level status.
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { requireSupabase, requireAuthUserId, getPartnerIdForUser } = require('../lib/auth');
const { isSupabaseConfigured } = require('../lib/supabase');
const { getLevelStatus, isXPSystemEnabled, getOrderedCoupleIds, awardXP, ACTION_TYPES } = require('../lib/xpService');

const router = express.Router();

const isProd = process.env.NODE_ENV === 'production';
const safeErrorMessage = (error) => (isProd ? 'Internal server error' : (error?.message || String(error)));

/**
 * GET /api/levels/status
 *
 * Returns the couple's level status and a questions-answered count.
 */
router.get('/status', async (req, res) => {
    try {
        if (!isXPSystemEnabled()) {
            return res.json({ enabled: false });
        }

        if (!isSupabaseConfigured()) {
            return res.status(503).json({ error: 'Supabase not configured' });
        }

        const supabase = requireSupabase();
        const userId = await requireAuthUserId(req);
        const partnerId = await getPartnerIdForUser(supabase, userId);

        if (!partnerId) {
            return res.status(400).json({ error: 'No partner connected' });
        }

        const coupleIds = getOrderedCoupleIds(userId, partnerId);
        if (!coupleIds) {
            return res.status(400).json({ error: 'Invalid couple' });
        }

        const levelResult = await getLevelStatus(userId, partnerId);
        if (!levelResult?.success || !levelResult?.data) {
            return res.status(500).json({ error: levelResult?.error || 'Failed to fetch level status' });
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
        return res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

/**
 * POST /api/levels/dev/award-xp
 *
 * Development-only endpoint to grant arbitrary XP for testing.
 */
router.post('/dev/award-xp', async (req, res) => {
    try {
        if (process.env.NODE_ENV === 'production') {
            return res.status(404).json({ error: 'Not found' });
        }

        if (!isXPSystemEnabled()) {
            return res.status(400).json({ error: 'XP system disabled' });
        }

        if (!isSupabaseConfigured()) {
            return res.status(503).json({ error: 'Supabase not configured' });
        }

        const amount = Number(req.body?.amount);
        if (!Number.isFinite(amount) || amount <= 0 || amount > 10000) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        const supabase = requireSupabase();
        const userId = await requireAuthUserId(req);
        const partnerId = await getPartnerIdForUser(supabase, userId);

        if (!partnerId) {
            return res.status(400).json({ error: 'No partner connected' });
        }

        const result = await awardXP({
            userId,
            partnerId,
            actionType: ACTION_TYPES.DEBUG_GRANT,
            sourceId: `dev:${uuidv4()}`,
            xpOverride: amount,
            idempotencyKeyOverride: `debug_grant:${uuidv4()}`,
        });

        if (!result?.success) {
            return res.status(500).json({ error: result?.error || 'Failed to award XP' });
        }

        return res.json(result);
    } catch (error) {
        console.error('[Levels] Error awarding debug XP:', error);
        return res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

/**
 * POST /api/levels/seen
 *
 * Update last seen level for the current user.
 */
router.post('/seen', async (req, res) => {
    try {
        if (!isXPSystemEnabled()) {
            return res.status(400).json({ error: 'XP system disabled' });
        }

        if (!isSupabaseConfigured()) {
            return res.status(503).json({ error: 'Supabase not configured' });
        }

        const supabase = requireSupabase();
        const userId = await requireAuthUserId(req);
        const partnerId = await getPartnerIdForUser(supabase, userId);

        if (!partnerId) {
            return res.status(400).json({ error: 'No partner connected' });
        }

        const levelResult = await getLevelStatus(userId, partnerId);
        if (!levelResult?.success || !levelResult?.data) {
            return res.status(500).json({ error: levelResult?.error || 'Failed to fetch level status' });
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
            return res.status(500).json({ error: updateError.message });
        }

        return res.json({ success: true, lastSeenLevel: safeLevel });
    } catch (error) {
        console.error('[Levels] Error updating seen level:', error);
        return res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

module.exports = router;
