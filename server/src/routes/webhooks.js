/**
 * Webhook Routes
 *
 * Handles webhooks from external services like RevenueCat.
 * Security: Uses timing-safe comparison and optional HMAC signature verification.
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { getSupabase, isSupabaseConfigured } = require('../lib/supabase');
const { getPartnerIdForUser } = require('../lib/auth');
const { safeErrorMessage } = require('../lib/shared/errorUtils');
const { sendError } = require('../lib/http');

const REVENUECAT_WEBHOOK_TOKEN = process.env.REVENUECAT_WEBHOOK_TOKEN || '';
const REVENUECAT_WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET || ''; // For HMAC verification
// Support both formats: 'Pause Gold' (with space) or 'pause_gold' (snake_case).
const PAUSE_GOLD_ENTITLEMENTS = new Set(['pause_gold', 'pause gold']);

// Replay attack prevention configuration
const WEBHOOK_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes tolerance for timestamp validation
const processedEventIds = new Map(); // In-memory store for event deduplication
const EVENT_ID_TTL_MS = 24 * 60 * 60 * 1000; // Keep event IDs for 24 hours

// Clean up old event IDs periodically (every hour)
setInterval(() => {
    const now = Date.now();
    for (const [eventId, timestamp] of processedEventIds.entries()) {
        if (now - timestamp > EVENT_ID_TTL_MS) {
            processedEventIds.delete(eventId);
        }
    }
}, 60 * 60 * 1000);

/**
 * Check if an event has already been processed (replay attack prevention)
 * @param {string} eventId - Unique event identifier
 * @returns {boolean} - True if event was already processed
 */
function isEventAlreadyProcessed(eventId) {
    if (!eventId) return false;
    return processedEventIds.has(eventId);
}

/**
 * Mark an event as processed
 * @param {string} eventId - Unique event identifier
 */
function markEventProcessed(eventId) {
    if (eventId) {
        processedEventIds.set(eventId, Date.now());
    }
}

/**
 * Validate webhook timestamp to prevent replay attacks
 * @param {number|string} timestamp - Event timestamp (ms or ISO string)
 * @returns {boolean} - True if timestamp is within acceptable range
 */
function isTimestampValid(timestamp) {
    if (!timestamp) return false;

    const eventTime = typeof timestamp === 'string'
        ? new Date(timestamp).getTime()
        : Number(timestamp);

    if (!Number.isFinite(eventTime)) return false;

    const now = Date.now();
    const diff = Math.abs(now - eventTime);

    return diff <= WEBHOOK_TIMESTAMP_TOLERANCE_MS;
}
const PAUSE_GOLD_PRODUCTS = new Set([
    'pause_gold_monthly',
    'pause_gold_yearly',
    'monthly',
    'yearly',
    'prod88802f6b24',
    'prode16533934c',
    'prodaa5384f89b',
]);
const isProd = process.env.NODE_ENV === 'production';

const isActiveGoldOwner = (profile) => {
    if (!profile || profile.subscription_tier !== 'pause_gold') return false;
    if (profile.subscription_shared_by) return false;
    if (!profile.subscription_expires_at) return true;
    const expiresAt = new Date(profile.subscription_expires_at);
    return !Number.isNaN(expiresAt.valueOf()) && expiresAt >= new Date();
};

async function syncPartnerSubscription(supabase, userId, tier, expiresAt) {
    try {
        const partnerId = await getPartnerIdForUser(supabase, userId);
        if (!partnerId) return false;

        const { data: partnerProfile, error: partnerError } = await supabase
            .from('profiles')
            .select('subscription_tier, subscription_expires_at, subscription_shared_by')
            .eq('id', partnerId)
            .single();

        if (partnerError) {
            console.error('[Webhook] Partner subscription lookup failed:', partnerError);
            return false;
        }

        const partnerOwnsGold = isActiveGoldOwner(partnerProfile);
        const updates = tier === 'pause_gold'
            ? (partnerOwnsGold ? null : {
                subscription_tier: 'pause_gold',
                subscription_expires_at: expiresAt,
                subscription_shared_by: userId,
            })
            : {
                subscription_tier: 'free',
                subscription_expires_at: null,
                subscription_shared_by: null,
            };

        if (!updates) return false;

        let query = supabase
            .from('profiles')
            .update(updates)
            .eq('id', partnerId);

        if (tier !== 'pause_gold') {
            query = query.eq('subscription_shared_by', userId);
        }

        const { error } = await query;

        if (error) {
            console.error('[Webhook] Failed to update partner subscription:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('[Webhook] Failed to resolve partner for subscription sync:', error);
        return false;
    }
}

/**
 * Verify HMAC signature for webhook body
 * @param {string} signature - The signature from headers
 * @param {string|Buffer} body - The raw request body
 * @param {string} secret - The shared secret
 * @returns {boolean} - Whether signature is valid
 */
function verifyHmacSignature(signature, body, secret) {
    if (!signature || !secret) return false;
    try {
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(body)
            .digest('hex');
        const sig = Buffer.from(signature);
        const expected = Buffer.from(expectedSignature);
        if (sig.length !== expected.length) return false;
        return crypto.timingSafeEqual(sig, expected);
    } catch {
        return false;
    }
}

/**
 * POST /api/webhooks/revenuecat
 * Handle RevenueCat subscription events
 * 
 * Events handled:
 * - INITIAL_PURCHASE: New subscription
 * - RENEWAL: Subscription renewed
 * - EXPIRATION: Subscription expired
 * - CANCELLATION: Subscription cancelled
 * - BILLING_ISSUE: Payment failed
 */
router.get('/revenuecat', (_req, res) => {
    // Some providers validate webhook URLs with a GET/HEAD request.
    return res.json({ status: 'ok' });
});

router.head('/revenuecat', (_req, res) => {
    return res.status(200).end();
});

router.post('/revenuecat', async (req, res) => {
    try {
        if (!isSupabaseConfigured()) {
            console.error('[Webhook] Supabase not configured');
            return sendError(res, 500, 'SERVER_ERROR', 'Server not configured');
        }

        // Security: Require webhook auth in production
        if (isProd && !REVENUECAT_WEBHOOK_TOKEN && !REVENUECAT_WEBHOOK_SECRET) {
            console.error('[Webhook] CRITICAL: No webhook authentication configured in production');
            return sendError(res, 503, 'SERVICE_UNAVAILABLE', 'Webhook auth not configured');
        }

        // Method 1: HMAC signature verification (preferred if configured)
        // Note: express.raw() middleware provides req.body as a Buffer
        if (REVENUECAT_WEBHOOK_SECRET) {
            const signature = req.headers['x-revenuecat-signature'] || req.headers['x-signature'];
            // req.body is a Buffer when using express.raw() middleware
            const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
            if (!verifyHmacSignature(signature, rawBody, REVENUECAT_WEBHOOK_SECRET)) {
                console.warn('[Webhook] HMAC signature verification failed');
                return sendError(res, 401, 'UNAUTHORIZED', 'Invalid signature');
            }
        }
        // Method 2: Bearer token auth (fallback)
        else if (REVENUECAT_WEBHOOK_TOKEN) {
            const authHeader = req.headers.authorization || '';
            const headerValue = typeof authHeader === 'string' ? authHeader.trim() : '';
            const match = headerValue ? headerValue.match(/^Bearer\s+(.+)$/i) : null;
            // RevenueCat lets you configure the entire Authorization header value.
            // Accept either:
            // - "Bearer <token>" (recommended)
            // - "<token>" (legacy/simple)
            const token = match?.[1] || headerValue;
            const ok = (() => {
                if (!token) return false;
                try {
                    const a = Buffer.from(token);
                    const b = Buffer.from(REVENUECAT_WEBHOOK_TOKEN);
                    if (a.length !== b.length) return false;
                    return crypto.timingSafeEqual(a, b);
                } catch {
                    return false;
                }
            })();
            if (!ok) {
                console.warn('[Webhook] Bearer token verification failed');
                return sendError(res, 401, 'UNAUTHORIZED', 'Unauthorized');
            }
        }
        // In development without auth configured, log a warning
        else if (!isProd) {
            console.warn('[Webhook] WARNING: Processing webhook without authentication (dev mode)');
        }

        // Parse body for business logic after authentication
        // When using express.raw(), req.body is a Buffer that needs to be parsed
        // When using express.json() (Bearer token path), req.body is already an object
        let event;
        if (Buffer.isBuffer(req.body)) {
            try {
                event = JSON.parse(req.body.toString('utf8'));
            } catch (parseError) {
                console.error('[Webhook] Failed to parse request body:', parseError);
                return sendError(res, 400, 'INVALID_INPUT', 'Invalid JSON body');
            }
        } else {
            event = req.body;
        }

        const supabase = getSupabase();
        console.log('[Webhook] RevenueCat event received:', event.event?.type || 'unknown');

        // RevenueCat webhook payload structure
        const eventType = event.event?.type;
        const eventId = event.event?.id; // Unique event identifier
        const eventTimestamp = event.event?.event_timestamp_ms || event.event?.purchased_at_ms;
        const appUserId = event.event?.app_user_id;
        const productId = event.event?.product_id;
        const expiresAt = event.event?.expiration_at_ms;
        const entitlementIds = event.event?.entitlement_ids || [];

        // Replay attack prevention: Check event ID deduplication
        if (eventId && isEventAlreadyProcessed(eventId)) {
            console.warn('[Webhook] Replay attack prevented: duplicate event ID', eventId);
            return res.status(200).json({ received: true, processed: false, reason: 'duplicate_event' });
        }

        // Replay attack prevention: Validate timestamp (only in production for stricter security)
        if (isProd && eventTimestamp && !isTimestampValid(eventTimestamp)) {
            console.warn('[Webhook] Replay attack prevented: stale timestamp', {
                eventId,
                eventTimestamp,
                now: Date.now(),
            });
            return sendError(res, 400, 'INVALID_INPUT', 'Event timestamp out of range');
        }

        // Check if this event affects Pause Gold subscription
        // Support multiple entitlement formats and product names
        const hasPauseGoldEntitlement = entitlementIds.some(id => {
            if (!id) return false;
            return PAUSE_GOLD_ENTITLEMENTS.has(String(id).toLowerCase());
        });
        const productIdKey = typeof productId === 'string' ? productId.toLowerCase() : '';
        const affectsGold = hasPauseGoldEntitlement || PAUSE_GOLD_PRODUCTS.has(productIdKey);

        if (!appUserId) {
            console.warn('[Webhook] No app_user_id in event');
            return res.status(200).json({ received: true, processed: false });
        }

        if (!affectsGold) {
            // Ignore unrelated products/entitlements.
            return res.status(200).json({ received: true, processed: false, reason: 'unrelated_product' });
        }

        // Calculate expiration date
        const expirationDate = expiresAt
            ? new Date(expiresAt).toISOString()
            : null;

        switch (eventType) {
            case 'INITIAL_PURCHASE':
            case 'RENEWAL':
            case 'PRODUCT_CHANGE':
                // User subscribed or renewed
                console.log(`[Webhook] Setting ${appUserId} to pause_gold`);

                const { error: subscribeError } = await supabase
                    .from('profiles')
                    .update({
                        subscription_tier: 'pause_gold',
                        subscription_expires_at: expirationDate,
                        store_customer_id: event.event?.original_app_user_id || appUserId,
                        subscription_shared_by: null,
                    })
                    .eq('id', appUserId);

                if (subscribeError) {
                    console.error('[Webhook] Failed to update subscription:', subscribeError);
                    return sendError(res, 500, 'SERVER_ERROR', 'Database update failed');
                }

                await syncPartnerSubscription(supabase, appUserId, 'pause_gold', expirationDate);
                break;

            case 'EXPIRATION':
                // Subscription ended
                console.log(`[Webhook] Setting ${appUserId} to free (${eventType})`);

                const { error: cancelError } = await supabase
                    .from('profiles')
                    .update({
                        subscription_tier: 'free',
                        subscription_expires_at: null,
                        subscription_shared_by: null,
                    })
                    .eq('id', appUserId);

                if (cancelError) {
                    console.error('[Webhook] Failed to cancel subscription:', cancelError);
                    return sendError(res, 500, 'SERVER_ERROR', 'Database update failed');
                }

                await syncPartnerSubscription(supabase, appUserId, 'free', null);
                break;

            case 'CANCELLATION':
                // Auto-renew turned off, but entitlement usually remains active until expiration.
                console.log(`[Webhook] Cancellation for ${appUserId} (keeping pause_gold until expiration)`);
                await supabase
                    .from('profiles')
                    .update({
                        subscription_tier: 'pause_gold',
                        subscription_expires_at: expirationDate,
                        subscription_shared_by: null,
                    })
                    .eq('id', appUserId);

                await syncPartnerSubscription(supabase, appUserId, 'pause_gold', expirationDate);
                break;

            case 'BILLING_ISSUE':
                // Payment problem - could add grace period logic
                console.warn(`[Webhook] Billing issue for ${appUserId}`);
                // For now, we'll keep the subscription active
                // RevenueCat will send EXPIRATION if it's not resolved
                break;

            case 'SUBSCRIBER_ALIAS':
                // User ID aliasing - update customer ID reference
                console.log(`[Webhook] Alias event for ${appUserId}`);
                break;

            default:
                console.log(`[Webhook] Unhandled event type: ${eventType}`);
        }

        // Mark event as processed to prevent replay attacks
        markEventProcessed(eventId);

        res.status(200).json({ received: true, processed: true });
    } catch (error) {
        console.error('[Webhook] Error processing RevenueCat event:', error);
        return sendError(res, 500, 'SERVER_ERROR', safeErrorMessage(error));
    }
});

/**
 * GET /api/webhooks/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'webhooks' });
});

module.exports = router;
