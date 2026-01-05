/**
 * Stats API Routes
 *
 * Provides unified user statistics from the user_stats table:
 * - Current streak (with grace period support)
 * - Questions completed (both partners answered)
 * - Cases resolved
 * - Streak revival for Gold users
 */

const express = require('express');
const router = express.Router();
const { requireSupabase, requireAuthUserId, getPartnerIdForUser } = require('../lib/auth');
const { sendError } = require('../lib/http');
const { getStats, reviveStreak, getStatsForCouple, isGoldUser } = require('../lib/statsService');

/**
 * GET /api/stats
 * Get unified stats for the authenticated user
 *
 * Response:
 * {
 *   current_streak: number,
 *   longest_streak: number,
 *   last_streak_date: string | null,
 *   is_grace_period: boolean,
 *   grace_days_remaining: number,
 *   streak_expired: boolean,
 *   can_revive: boolean,
 *   revival_available_at: string | null,
 *   questions_completed: number,
 *   cases_resolved: number
 * }
 */
router.get('/', async (req, res) => {
    try {
        requireSupabase();
        const authUserId = await requireAuthUserId(req);

        const stats = await getStats(authUserId);

        res.json(stats);
    } catch (error) {
        console.error('[Stats API] GET / error:', error);
        res.status(error.statusCode || 500).json({
            errorCode: error.errorCode || 'STATS_FETCH_FAILED',
            error: error.message
        });
    }
});

/**
 * GET /api/stats/couple
 * Get stats for both partners in a couple
 *
 * Response:
 * {
 *   userA: { userId, ...stats },
 *   userB: { userId, ...stats }
 * }
 */
router.get('/couple', async (req, res) => {
    try {
        const supabase = requireSupabase();
        const authUserId = await requireAuthUserId(req);

        // Get partner ID
        const partnerId = await getPartnerIdForUser(supabase, authUserId);
        if (!partnerId) {
            return sendError(res, 400, 'NO_PARTNER', 'No partner connected');
        }

        const coupleStats = await getStatsForCouple(authUserId, partnerId);

        res.json(coupleStats);
    } catch (error) {
        console.error('[Stats API] GET /couple error:', error);
        res.status(error.statusCode || 500).json({
            errorCode: error.errorCode || 'STATS_COUPLE_FETCH_FAILED',
            error: error.message
        });
    }
});

/**
 * POST /api/stats/revive
 * Revive a broken streak (Gold users only)
 *
 * Requirements:
 * - User must have Pause Gold subscription
 * - Streak must be broken (> 2 days since last completion)
 * - Revival must be available (once per 90 days)
 *
 * Response:
 * {
 *   success: boolean,
 *   new_streak: number,
 *   message: string
 * }
 */
router.post('/revive', async (req, res) => {
    try {
        requireSupabase();
        const authUserId = await requireAuthUserId(req);

        // Check if user has Gold subscription
        const isGold = await isGoldUser(authUserId);

        if (!isGold) {
            return sendError(
                res,
                403,
                'GOLD_REQUIRED',
                'Streak revival is only available for Pause Gold subscribers'
            );
        }

        // Attempt to revive the streak
        const result = await reviveStreak(authUserId, isGold);

        if (!result.success) {
            // Revival failed (not due to subscription, but other reasons)
            return res.status(400).json({
                success: false,
                new_streak: result.new_streak,
                message: result.message
            });
        }

        res.json({
            success: true,
            new_streak: result.new_streak,
            message: result.message
        });
    } catch (error) {
        console.error('[Stats API] POST /revive error:', error);
        res.status(error.statusCode || 500).json({
            errorCode: error.errorCode || 'STREAK_REVIVE_FAILED',
            error: error.message
        });
    }
});

module.exports = router;
