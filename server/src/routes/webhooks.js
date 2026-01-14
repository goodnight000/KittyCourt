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
const { safeErrorMessage } = require('../lib/shared/errorUtils');

const REVENUECAT_WEBHOOK_TOKEN = process.env.REVENUECAT_WEBHOOK_TOKEN || '';
const REVENUECAT_WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET || ''; // For HMAC verification
// Support both formats: 'Pause Gold' (with space) or 'pause_gold' (snake_case).
const PAUSE_GOLD_ENTITLEMENTS = new Set(['pause_gold', 'pause gold']);
const PAUSE_GOLD_PRODUCTS = new Set([
    'pause_gold_monthly',
    'pause_gold_yearly',
    'monthly',
    'yearly',
    'prodaa5384f89b',
]);
const isProd = process.env.NODE_ENV === 'production';

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
router.post('/revenuecat', async (req, res) => {
    try {
        if (!isSupabaseConfigured()) {
            console.error('[Webhook] Supabase not configured');
            return res.status(500).json({ error: 'Server not configured' });
        }

        // Security: Require webhook auth in production
        if (isProd && !REVENUECAT_WEBHOOK_TOKEN && !REVENUECAT_WEBHOOK_SECRET) {
            console.error('[Webhook] CRITICAL: No webhook authentication configured in production');
            return res.status(503).json({ error: 'Webhook auth not configured' });
        }

        // Method 1: HMAC signature verification (preferred if configured)
        // Note: express.raw() middleware provides req.body as a Buffer
        if (REVENUECAT_WEBHOOK_SECRET) {
            const signature = req.headers['x-revenuecat-signature'] || req.headers['x-signature'];
            // req.body is a Buffer when using express.raw() middleware
            const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
            if (!verifyHmacSignature(signature, rawBody, REVENUECAT_WEBHOOK_SECRET)) {
                console.warn('[Webhook] HMAC signature verification failed');
                return res.status(401).json({ error: 'Invalid signature' });
            }
        }
        // Method 2: Bearer token auth (fallback)
        else if (REVENUECAT_WEBHOOK_TOKEN) {
            const authHeader = req.headers.authorization || '';
            const match = typeof authHeader === 'string' ? authHeader.match(/^Bearer\s+(.+)$/i) : null;
            const token = match?.[1];
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
                return res.status(401).json({ error: 'Unauthorized' });
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
                return res.status(400).json({ error: 'Invalid JSON body' });
            }
        } else {
            event = req.body;
        }

        const supabase = getSupabase();
        console.log('[Webhook] RevenueCat event received:', event.event?.type || 'unknown');

        // RevenueCat webhook payload structure
        const eventType = event.event?.type;
        const appUserId = event.event?.app_user_id;
        const productId = event.event?.product_id;
        const expiresAt = event.event?.expiration_at_ms;
        const entitlementIds = event.event?.entitlement_ids || [];

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
                    })
                    .eq('id', appUserId);

                if (subscribeError) {
                    console.error('[Webhook] Failed to update subscription:', subscribeError);
                    return res.status(500).json({ error: 'Database update failed' });
                }
                break;

            case 'EXPIRATION':
                // Subscription ended
                console.log(`[Webhook] Setting ${appUserId} to free (${eventType})`);

                const { error: cancelError } = await supabase
                    .from('profiles')
                    .update({
                        subscription_tier: 'free',
                        subscription_expires_at: null,
                    })
                    .eq('id', appUserId);

                if (cancelError) {
                    console.error('[Webhook] Failed to cancel subscription:', cancelError);
                    return res.status(500).json({ error: 'Database update failed' });
                }
                break;

            case 'CANCELLATION':
                // Auto-renew turned off, but entitlement usually remains active until expiration.
                console.log(`[Webhook] Cancellation for ${appUserId} (keeping pause_gold until expiration)`);
                await supabase
                    .from('profiles')
                    .update({
                        subscription_tier: 'pause_gold',
                        subscription_expires_at: expirationDate,
                    })
                    .eq('id', appUserId);
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

        res.status(200).json({ received: true, processed: true });
    } catch (error) {
        console.error('[Webhook] Error processing RevenueCat event:', error);
        res.status(500).json({ error: safeErrorMessage(error) });
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
