/**
 * Usage API Routes
 * 
 * Endpoints for tracking and checking feature usage limits.
 */

const express = require('express');
const router = express.Router();
const { getSupabase, isSupabaseConfigured } = require('../lib/supabase');
const { getCurrentPeriodStartUTC, incrementUsage } = require('../lib/usageTracking');

const requireSupabase = () => {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
    return getSupabase();
};

/**
 * Get couple usage record for current period
 * Uses the get_couple_usage RPC to sum usage across both partners
 */
async function getCoupleUsageRecord(userId) {
    const supabase = requireSupabase();
    const periodStart = getCurrentPeriodStartUTC();

    // Try using the couple-aware RPC function first
    try {
        const { data, error } = await supabase.rpc('get_couple_usage', {
            p_user_id: userId,
            p_period_start: periodStart,
        });

        if (!error && data && data.length > 0) {
            return {
                lightning_count: data[0].lightning_count || 0,
                mittens_count: data[0].mittens_count || 0,
                whiskers_count: data[0].whiskers_count || 0,
                plan_count: data[0].plan_count || 0,
                period_start: periodStart,
            };
        }
    } catch (_e) {
        // Fall through to legacy per-user query
    }

    // Fallback: legacy per-user query (for backwards compatibility)
    let { data: record, error: fetchError } = await supabase
        .from('usage_tracking')
        .select('*')
        .eq('user_id', userId)
        .eq('period_start', periodStart)
        .single();

    // If no record exists, return zeros
    if (fetchError && fetchError.code === 'PGRST116') {
        return {
            lightning_count: 0,
            mittens_count: 0,
            whiskers_count: 0,
            plan_count: 0,
            period_start: periodStart,
        };
    } else if (fetchError && fetchError.code === '42P01') {
        // migration not applied yet
        return {
            lightning_count: 0,
            mittens_count: 0,
            whiskers_count: 0,
            plan_count: 0,
            period_start: periodStart,
        };
    } else if (fetchError) {
        throw fetchError;
    }

    return record;
}

/**
 * Get user's subscription tier
 */
async function getUserSubscriptionTier(userId) {
    if (!isSupabaseConfigured()) return 'free';
    const supabase = getSupabase();

    const { data: profile, error } = await supabase
        .from('profiles')
        .select('subscription_tier, subscription_expires_at')
        .eq('id', userId)
        .single();

    if (error || !profile) return 'free';

    // Check if subscription is expired
    if (profile.subscription_tier === 'pause_gold' && profile.subscription_expires_at) {
        if (new Date(profile.subscription_expires_at) < new Date()) {
            return 'free';
        }
    }

    return profile.subscription_tier || 'free';
}

/**
 * Get limits based on subscription tier
 */
function getLimits(tier) {
    if (tier === 'pause_gold') {
        return {
            lightning: Infinity,
            mittens: 100,
            whiskers: 10,
            plan: Infinity,
        };
    }
    return {
        lightning: 3,
        mittens: 1,
        whiskers: 0,
        plan: 0,
    };
}

/**
 * Extract user ID from Authorization header
 */
async function getUserIdFromAuth(req) {
    if (!isSupabaseConfigured()) return null;
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.split(' ')[1];

    try {
        const supabase = getSupabase();
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) return null;
        return user.id;
    } catch (e) {
        return null;
    }
}

/**
 * GET /api/usage
 * Get current month's usage for authenticated user
 */
router.get('/', async (req, res) => {
    try {
        const userId = await getUserIdFromAuth(req);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const record = await getCoupleUsageRecord(userId);

        res.json({
            lightningUsed: record.lightning_count || 0,
            mittensUsed: record.mittens_count || 0,
            whiskersUsed: record.whiskers_count || 0,
            planUsed: record.plan_count || 0,
            periodStart: record.period_start,
        });
    } catch (error) {
        console.error('[Usage API] GET error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/usage/increment
 * Increment usage count after feature use
 * Body: { type: 'lightning' | 'mittens' | 'whiskers' | 'plan' }
 */
router.post('/increment', async (req, res) => {
    try {
        const userId = await getUserIdFromAuth(req);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { type } = req.body;
        if (!['lightning', 'mittens', 'whiskers', 'plan'].includes(type)) {
            return res.status(400).json({ error: 'Invalid type. Must be lightning, mittens, whiskers, or plan' });
        }

        try {
            const newCount = await incrementUsage({ userId, type });
            res.json({ success: true, newCount: newCount ?? 0 });
        } catch (e) {
            if (e?.code === '42P01') {
                return res.status(409).json({ error: 'usage_tracking table missing (run migration 016/017)' });
            }
            throw e;
        }
    } catch (error) {
        console.error('[Usage API] POST increment error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/usage/can-use?type=whiskers
 * Check if user can use a specific feature
 */
router.get('/can-use', async (req, res) => {
    try {
        const userId = await getUserIdFromAuth(req);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { type } = req.query;
        if (!['lightning', 'mittens', 'whiskers', 'plan'].includes(type)) {
            return res.status(400).json({ error: 'Invalid type' });
        }

        const [record, tier] = await Promise.all([
            getCoupleUsageRecord(userId),
            getUserSubscriptionTier(userId),
        ]);

        const limits = getLimits(tier);

        // Map type to column and limit
        const columnMap = {
            lightning: 'lightning_count',
            mittens: 'mittens_count',
            whiskers: 'whiskers_count',
            plan: 'plan_count',
        };

        const used = record[columnMap[type]] || 0;
        const limit = limits[type];
        const allowed = limit === Infinity || used < limit;
        const remaining = limit === Infinity ? Infinity : Math.max(0, limit - used);

        res.json({
            allowed,
            remaining: remaining === Infinity ? 'unlimited' : remaining,
            limit: limit === Infinity ? 'unlimited' : limit,
            used,
            tier,
        });
    } catch (error) {
        console.error('[Usage API] GET can-use error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
