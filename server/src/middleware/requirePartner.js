/**
 * Partner Validation Middleware
 *
 * Validates that the authenticated user has a connected partner.
 * Attaches userId, partnerId, supabase, and coupleIds to the request object.
 *
 * This middleware consolidates duplicate partner validation logic that was
 * previously repeated across 11+ API routes.
 *
 * PERFORMANCE NOTE: This middleware makes a database query on every request
 * to fetch the partner_id. For high-traffic applications, consider:
 * - Caching partner relationships in Redis (60s TTL recommended)
 * - Including partner_id in JWT claims to avoid DB lookup
 * - Using database query connection pooling
 *
 * Current impact: Minimal for typical couple-app usage patterns (<100 req/sec)
 */

const { requireAuthUserId, getPartnerIdForUser, requireSupabase } = require('../lib/auth');

/**
 * Middleware to require authenticated user with connected partner.
 *
 * @throws {401} If authentication fails
 * @throws {400} If user has no connected partner
 *
 * Attaches to request object:
 * - req.userId: The authenticated user's ID
 * - req.partnerId: The partner's ID
 * - req.supabase: The Supabase client instance
 * - req.coupleIds: Array of [userId, partnerId] sorted (for RLS queries)
 */
async function requirePartner(req, res, next) {
    try {
        // Get authenticated user ID
        const userId = await requireAuthUserId(req);

        // Get Supabase client
        const supabase = requireSupabase();

        // Fetch partner ID from database
        const partnerId = await getPartnerIdForUser(supabase, userId);

        // Validate partner exists
        if (!partnerId) {
            return res.status(400).json({
                errorCode: 'NO_PARTNER',
                error: 'No partner connected. Please connect with a partner first.'
            });
        }

        // Attach to request for downstream handlers
        req.userId = userId;
        req.partnerId = partnerId;
        req.supabase = supabase;
        req.coupleIds = [userId, partnerId].sort(); // For RLS queries

        next();
    } catch (error) {
        const statusCode = error.statusCode || 500;
        const response = { error: error.message };

        // Preserve errorCode if present (from requireAuthUserId, etc.)
        if (error.errorCode) {
            response.errorCode = error.errorCode;
        }

        res.status(statusCode).json(response);
    }
}

module.exports = { requirePartner };
