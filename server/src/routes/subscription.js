/**
 * Subscription API Routes
 * 
 * Endpoints for subscription status and sync.
 */

const express = require('express');
const router = express.Router();
const { getSupabase, isSupabaseConfigured } = require('../lib/supabase');
const { createRateLimiter } = require('../lib/rateLimit');

const REVENUECAT_SECRET_KEY = process.env.REVENUECAT_SECRET_KEY || '';
const REVENUECAT_API_BASE = 'https://api.revenuecat.com/v1/subscribers/';
const PAUSE_GOLD_ENTITLEMENTS = new Set(['pause_gold', 'pause gold']);
const PAUSE_GOLD_PRODUCTS = new Set([
    'pause_gold_monthly',
    'pause_gold_yearly',
    'monthly',
    'yearly',
    'prodaa5384f89b',
]);
const PRODUCT_PERIOD_DAYS = new Map([
    ['pause_gold_monthly', 30],
    ['monthly', 30],
    ['pause_gold_yearly', 365],
    ['yearly', 365],
    ['prodaa5384f89b', 365],
]);
const isProd = process.env.NODE_ENV === 'production';

const syncRateLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 10,
    keyGenerator: (req) => req.headers.authorization || req.ip || 'unknown',
});

/**
 * Extract user ID from Authorization header
 */
async function getUserIdFromAuth(req) {
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

async function fetchRevenueCatSubscriber(appUserId) {
    if (!REVENUECAT_SECRET_KEY) {
        return { error: 'RevenueCat secret not configured' };
    }
    if (typeof fetch !== 'function') {
        return { error: 'fetch is not available in this runtime' };
    }

    const response = await fetch(`${REVENUECAT_API_BASE}${encodeURIComponent(appUserId)}`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${REVENUECAT_SECRET_KEY}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        const text = await response.text();
        return { error: `RevenueCat API error: ${response.status} ${text}` };
    }

    return response.json();
}

function resolvePauseGoldStatus(subscriber) {
    if (!subscriber) return { tier: 'free', expiresAt: null };

    const entitlements = subscriber.entitlements || {};
    let entitlement = null;

    for (const [entitlementId, entitlementInfo] of Object.entries(entitlements)) {
        if (PAUSE_GOLD_ENTITLEMENTS.has(String(entitlementId).toLowerCase())) {
            entitlement = entitlementInfo;
            break;
        }
    }

    if (!entitlement) {
        const subscriptions = subscriber.subscriptions || {};
        for (const [productId, subscriptionInfo] of Object.entries(subscriptions)) {
            if (PAUSE_GOLD_PRODUCTS.has(String(productId).toLowerCase())) {
                entitlement = subscriptionInfo;
                break;
            }
        }
    }

    if (!entitlement) {
        return { tier: 'free', expiresAt: null };
    }

    if (entitlement.is_active === false) {
        return { tier: 'free', expiresAt: null };
    }

    const expiresAtRaw = entitlement.expires_date || entitlement.expires_date_ms;
    let expiresAt = null;
    if (expiresAtRaw) {
        const parsed = typeof expiresAtRaw === 'string'
            ? new Date(expiresAtRaw)
            : new Date(Number(expiresAtRaw));
        if (!Number.isNaN(parsed.valueOf())) {
            expiresAt = parsed.toISOString();
        }
    }

    if (expiresAt && new Date(expiresAt) < new Date()) {
        return { tier: 'free', expiresAt: null };
    }

    return { tier: 'pause_gold', expiresAt };
}

/**
 * GET /api/subscription/status
 * Get user's subscription status from database
 */
router.get('/status', async (req, res) => {
    try {
        if (!isSupabaseConfigured()) {
            return res.status(503).json({ error: 'Supabase not configured' });
        }

        const userId = await getUserIdFromAuth(req);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const supabase = getSupabase();
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('subscription_tier, subscription_expires_at')
            .eq('id', userId)
            .single();

        if (error || !profile) {
            return res.json({ tier: 'free', expiresAt: null });
        }

        // Check if subscription is expired
        let tier = profile.subscription_tier || 'free';
        if (tier === 'pause_gold' && profile.subscription_expires_at) {
            if (new Date(profile.subscription_expires_at) < new Date()) {
                tier = 'free';
            }
        }

        res.json({
            tier,
            expiresAt: tier === 'pause_gold' ? profile.subscription_expires_at : null,
        });
    } catch (error) {
        console.error('[Subscription API] GET status error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/subscription/sync
 * Called by client after successful purchase to trigger immediate sync
 * This is useful in sandbox testing where webhooks may be delayed
 * 
 * In production, the RevenueCat webhook is the authoritative source,
 * but this provides a fallback for immediate UI updates.
 */
router.post('/sync', syncRateLimiter, async (req, res) => {
    try {
        if (!isSupabaseConfigured()) {
            return res.status(503).json({ error: 'Supabase not configured' });
        }

        const userId = await getUserIdFromAuth(req);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        let tier = 'free';
        let expiresAt = null;

        if (REVENUECAT_SECRET_KEY) {
            const response = await fetchRevenueCatSubscriber(userId);
            if (response?.error) {
                console.error('[Subscription API] RevenueCat fetch failed:', response.error);
                return res.status(502).json({ error: 'RevenueCat verification failed' });
            }
            if (!response?.subscriber) {
                console.error('[Subscription API] RevenueCat response missing subscriber');
                return res.status(502).json({ error: 'RevenueCat verification failed' });
            }

            const status = resolvePauseGoldStatus(response.subscriber);
            tier = status.tier;
            expiresAt = status.expiresAt;
        } else if (!isProd) {
            const { tier: requestedTier, productId } = req.body || {};
            if (!requestedTier || !['pause_gold', 'free'].includes(requestedTier)) {
                return res.status(400).json({ error: 'Invalid tier' });
            }

            if (requestedTier === 'pause_gold') {
                const productKey = typeof productId === 'string' ? productId.toLowerCase() : '';
                const periodDays = PRODUCT_PERIOD_DAYS.get(productKey);
                if (!periodDays) {
                    return res.status(400).json({ error: 'Invalid productId' });
                }

                const now = new Date();
                expiresAt = new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000).toISOString();
            }

            tier = requestedTier;
        } else {
            return res.status(503).json({ error: 'RevenueCat not configured' });
        }

        const supabase = getSupabase();

        const { error } = await supabase
            .from('profiles')
            .update({
                subscription_tier: tier,
                subscription_expires_at: expiresAt,
            })
            .eq('id', userId);

        if (error) {
            console.error('[Subscription API] Sync error:', error);
            return res.status(500).json({ error: 'Database update failed' });
        }

        console.log(`[Subscription API] Synced ${userId} to ${tier}`);
        res.json({ success: true, synced: true });
    } catch (error) {
        console.error('[Subscription API] POST sync error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
