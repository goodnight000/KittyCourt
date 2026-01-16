/**
 * Court REST API Routes - Clean Architecture
 * 
 * Fallback endpoints for when WebSocket is unavailable.
 * All routes delegate to SessionManager.
 */

const express = require('express');
const router = express.Router();
const { courtSessionManager, VIEW_PHASE, PHASE } = require('../lib/courtSessionManager');
const { requireAuthUserId, requireSupabase, getPartnerIdForUser } = require('../lib/auth');
const { isSupabaseConfigured } = require('../lib/supabase');
const { awardXP, ACTION_TYPES } = require('../lib/xpService');
const { recordChallengeAction, CHALLENGE_ACTIONS } = require('../lib/challengeService');
const { resolveRequestLanguage, getUserPreferredLanguage } = require('../lib/language');
const { sendError } = require('../lib/http');
const { asyncHandler } = require('../middleware/asyncHandler');
const { processSecureInput, securityConfig, llmSecurityMiddleware } = require('../lib/security/index');
const { safeErrorMessage } = require('../lib/shared/errorUtils');

const isProd = process.env.NODE_ENV === 'production';

const requireUserId = async (req, fallbackUserId) => {
    // CRITICAL: In production, ALWAYS require proper authentication
    // Never allow fallback userId bypass in production
    if (isProd) {
        if (!isSupabaseConfigured()) {
            const error = new Error('Authentication service not configured');
            error.statusCode = 503;
            throw error;
        }
        return requireAuthUserId(req);
    }

    // Development mode: require authentication when Supabase is configured
    if (isSupabaseConfigured()) {
        return requireAuthUserId(req);
    }

    // Development-only fallback for local testing without Supabase
    // This path is blocked in production by the check above
    if (process.env.REQUIRE_AUTH_IN_DEV === 'true') {
        const error = new Error('Authentication required');
        error.statusCode = 401;
        throw error;
    }

    // Log warning when using development fallback
    if (fallbackUserId) {
        console.warn('[Security] DEV ONLY: Using auth bypass - blocked in production');
    }

    if (!fallbackUserId) {
        const error = new Error('userId required');
        error.statusCode = 400;
        throw error;
    }
    return fallbackUserId;
};

// === State ===

/**
 * GET /api/court/state
 * Get current court state for user
 */
router.get('/state', asyncHandler(async (req, res) => {
    const fallbackUserId = req.query?.userId;
    let userId = null;
    try {
        userId = await requireUserId(req, fallbackUserId);
    } catch (e) {
        // Unauthenticated state requests are treated as idle.
        if (e?.statusCode === 400 || e?.statusCode === 401) {
            return res.json({ phase: PHASE.IDLE, myViewPhase: VIEW_PHASE.IDLE, session: null });
        }
        throw e;
    }

    const state = courtSessionManager.getStateForUser(userId);
    return res.json(state);
}));

// === Actions ===

/**
 * POST /api/court/serve
 * Create pending session (serve partner)
 */
router.post('/serve', asyncHandler(async (req, res) => {
    try {
        const { userId: fallbackUserId, partnerId, coupleId, judgeType } = req.body;
        const userId = await requireUserId(req, fallbackUserId);

        if (!partnerId) {
            return sendError(res, 400, 'PARTNER_REQUIRED', 'partnerId required');
        }

        const supabase = isSupabaseConfigured() ? requireSupabase() : null;
        if (supabase) {
            const resolvedPartnerId = await getPartnerIdForUser(supabase, userId);
            if (!resolvedPartnerId || String(resolvedPartnerId) !== String(partnerId)) {
                return sendError(res, 400, 'INVALID_PARTNER', 'Invalid partnerId for current user');
            }
        }

        const creatorLanguage = await resolveRequestLanguage(req, supabase, userId);
        const partnerLanguage = supabase
            ? await getUserPreferredLanguage(supabase, partnerId)
            : null;
        await courtSessionManager.serve(userId, partnerId, coupleId, judgeType, {
            creatorLanguage,
            partnerLanguage,
            caseLanguage: creatorLanguage || 'en',
        });
        const state = courtSessionManager.getStateForUser(userId);
        res.json(state);
    } catch (error) {
        console.error('[API] /serve error:', error);
        res.status(error.statusCode || 400).json({ error: safeErrorMessage(error) });
    }
}));

/**
 * POST /api/court/accept
 * Partner accepts pending session
 */
router.post('/accept', asyncHandler(async (req, res) => {
    try {
        const { userId: fallbackUserId } = req.body;
        const userId = await requireUserId(req, fallbackUserId);

        await courtSessionManager.accept(userId);
        const state = courtSessionManager.getStateForUser(userId);
        res.json(state);
    } catch (error) {
        console.error('[API] /accept error:', error);
        res.status(error.statusCode || 400).json({ error: safeErrorMessage(error) });
    }
}));

/**
 * POST /api/court/cancel
 * Cancel pending session (creator only)
 */
router.post('/cancel', asyncHandler(async (req, res) => {
    try {
        const { userId: fallbackUserId } = req.body;
        const userId = await requireUserId(req, fallbackUserId);

        await courtSessionManager.cancel(userId);
        res.json({ phase: PHASE.IDLE, myViewPhase: VIEW_PHASE.IDLE, session: null });
    } catch (error) {
        console.error('[API] /cancel error:', error);
        res.status(error.statusCode || 400).json({ error: safeErrorMessage(error) });
    }
}));

/**
 * POST /api/court/evidence
 * Submit evidence
 *
 * Security: llmSecurityMiddleware validates input before handler runs.
 * The middleware attaches req.sanitizedBody and req.securityContext.
 */
router.post('/evidence', llmSecurityMiddleware('court'), asyncHandler(async (req, res) => {
    try {
        // Use sanitizedBody from middleware, fallback to req.body for backwards compatibility
        const body = req.sanitizedBody || req.body;
        const { userId: fallbackUserId, evidence, feelings, needs } = body;
        const userId = await requireUserId(req, fallbackUserId);

        // Security context from middleware (for logging/debugging)
        const securityContext = req.securityContext;
        if (securityContext?.flaggedFields?.length > 0) {
            console.warn('[Court] Flagged fields in evidence submission:', securityContext.flaggedFields);
        }

        // Middleware already sanitized the input via 'court' field mappings
        const safeEvidence = (evidence || '').trim();
        const safeFeelings = (feelings || '').trim();
        const safeNeeds = (needs || '').trim();
        if (!safeEvidence) return sendError(res, 400, 'EVIDENCE_REQUIRED', 'evidence is required');

        await courtSessionManager.submitEvidence(userId, safeEvidence, safeFeelings, safeNeeds);
        const state = courtSessionManager.getStateForUser(userId);
        res.json(state);
    } catch (error) {
        console.error('[API] /evidence error:', error);
        res.status(error.statusCode || 400).json({ error: safeErrorMessage(error) });
    }
}));

/**
 * POST /api/court/verdict/accept
 * Accept verdict
 */
router.post('/verdict/accept', asyncHandler(async (req, res) => {
    try {
        const { userId: fallbackUserId } = req.body;
        const userId = await requireUserId(req, fallbackUserId);

        await courtSessionManager.acceptVerdict(userId);
        const state = courtSessionManager.getStateForUser(userId);

        try {
            if (isSupabaseConfigured() && state?.phase === PHASE.CLOSED) {
                const bothEvidenceSubmitted = !!(state.session?.creator?.evidenceSubmitted && state.session?.partner?.evidenceSubmitted);
                if (bothEvidenceSubmitted) {
                    const supabase = requireSupabase();
                    const partnerId = await getPartnerIdForUser(supabase, userId);
                    if (partnerId) {
                        const sourceId = state.session?.caseId || state.session?.id || state.session?.coupleId || 'court_case';
                        await awardXP({
                            userId,
                            partnerId,
                            actionType: ACTION_TYPES.CASE_RESOLUTION,
                            sourceId,
                        });
                        await recordChallengeAction({
                            userId,
                            partnerId,
                            action: CHALLENGE_ACTIONS.CASE_RESOLVED,
                            sourceId,
                        });
                    }
                }
            }
        } catch (xpError) {
            console.warn('[Court] XP award failed:', xpError?.message || xpError);
        }

        res.json(state);
    } catch (error) {
        console.error('[API] /verdict/accept error:', error);
        res.status(error.statusCode || 400).json({ error: safeErrorMessage(error) });
    }
}));

/**
 * POST /api/court/settle/request
 * Request settlement
 */
router.post('/settle/request', asyncHandler(async (req, res) => {
    const { userId: fallbackUserId } = req.body;
    const userId = await requireUserId(req, fallbackUserId);

    courtSessionManager.requestSettlement(userId);
    const state = courtSessionManager.getStateForUser(userId);
    return res.json(state);
}));

/**
 * POST /api/court/settle/accept
 * Accept settlement
 */
router.post('/settle/accept', asyncHandler(async (req, res) => {
    try {
        const { userId: fallbackUserId } = req.body;
        const userId = await requireUserId(req, fallbackUserId);

        await courtSessionManager.acceptSettlement(userId);
        res.json({ phase: PHASE.IDLE, myViewPhase: VIEW_PHASE.IDLE, session: null });
    } catch (error) {
        console.error('[API] /settle/accept error:', error);
        res.status(error.statusCode || 400).json({ error: safeErrorMessage(error) });
    }
}));

/**
 * POST /api/court/settle/decline
 * Decline settlement (case continues)
 */
router.post('/settle/decline', asyncHandler(async (req, res) => {
    const { userId: fallbackUserId } = req.body;
    const userId = await requireUserId(req, fallbackUserId);

    courtSessionManager.declineSettlement(userId);
    const state = courtSessionManager.getStateForUser(userId);
    return res.json(state);
}));

/**
 * POST /api/court/addendum
 * Submit addendum (re-run LLM)
 *
 * Security: llmSecurityMiddleware validates input before handler runs.
 * The middleware attaches req.sanitizedBody and req.securityContext.
 */
router.post('/addendum', llmSecurityMiddleware('court'), asyncHandler(async (req, res) => {
    try {
        // Use sanitizedBody from middleware, fallback to req.body for backwards compatibility
        const body = req.sanitizedBody || req.body;
        const { userId: fallbackUserId, text } = body;
        const userId = await requireUserId(req, fallbackUserId);

        // Security context from middleware (for logging/debugging)
        const securityContext = req.securityContext;
        if (securityContext?.flaggedFields?.length > 0) {
            console.warn('[Court] Flagged fields in addendum submission:', securityContext.flaggedFields);
        }

        // Middleware already sanitized the input via 'court' field mappings
        const safeText = (text || '').trim();
        if (!safeText) return res.status(400).json({ error: 'text required' });

        await courtSessionManager.submitAddendum(userId, safeText);
        const state = courtSessionManager.getStateForUser(userId);
        res.json(state);
    } catch (error) {
        console.error('[API] /addendum error:', error);
        res.status(error.statusCode || 400).json({ error: safeErrorMessage(error) });
    }
}));

// === V2.0 Pipeline Endpoints ===

/**
 * POST /api/court/priming/complete
 * Mark priming page as read (v2.0 pipeline)
 */
router.post('/priming/complete', asyncHandler(async (req, res) => {
    try {
        const { userId: fallbackUserId } = req.body;
        const userId = await requireUserId(req, fallbackUserId);

        await courtSessionManager.markPrimingComplete(userId);
        const state = courtSessionManager.getStateForUser(userId);
        res.json(state);
    } catch (error) {
        console.error('[API] /priming/complete error:', error);
        res.status(error.statusCode || 400).json({ error: safeErrorMessage(error) });
    }
}));

/**
 * POST /api/court/joint/ready
 * Mark ready to proceed from joint menu (v2.0 pipeline)
 */
router.post('/joint/ready', asyncHandler(async (req, res) => {
    try {
        const { userId: fallbackUserId } = req.body;
        const userId = await requireUserId(req, fallbackUserId);

        await courtSessionManager.markJointReady(userId);
        const state = courtSessionManager.getStateForUser(userId);
        res.json(state);
    } catch (error) {
        console.error('[API] /joint/ready error:', error);
        res.status(error.statusCode || 400).json({ error: safeErrorMessage(error) });
    }
}));

/**
 * POST /api/court/resolution/pick
 * Submit resolution choice (v2.0 pipeline)
 */
router.post('/resolution/pick', asyncHandler(async (req, res) => {
    try {
        const { userId: fallbackUserId, resolutionId } = req.body;
        const userId = await requireUserId(req, fallbackUserId);

        if (!resolutionId) {
            return res.status(400).json({ error: 'resolutionId required' });
        }

        await courtSessionManager.submitResolutionPick(userId, resolutionId);
        const state = courtSessionManager.getStateForUser(userId);
        res.json(state);
    } catch (error) {
        console.error('[API] /resolution/pick error:', error);
        res.status(error.statusCode || 400).json({ error: safeErrorMessage(error) });
    }
}));

/**
 * POST /api/court/resolution/accept-partner
 * Accept partner's resolution choice (v2.0 pipeline)
 */
router.post('/resolution/accept-partner', asyncHandler(async (req, res) => {
    try {
        const { userId: fallbackUserId } = req.body;
        const userId = await requireUserId(req, fallbackUserId);

        await courtSessionManager.acceptPartnerResolution(userId);
        const state = courtSessionManager.getStateForUser(userId);
        res.json(state);
    } catch (error) {
        console.error('[API] /resolution/accept-partner error:', error);
        res.status(error.statusCode || 400).json({ error: safeErrorMessage(error) });
    }
}));

/**
 * POST /api/court/resolution/hybrid
 * Request hybrid resolution generation (v2.0 pipeline)
 */
router.post('/resolution/hybrid', asyncHandler(async (req, res) => {
    try {
        const { userId: fallbackUserId } = req.body;
        const userId = await requireUserId(req, fallbackUserId);

        await courtSessionManager.requestHybridResolution(userId);
        const state = courtSessionManager.getStateForUser(userId);
        res.json(state);
    } catch (error) {
        console.error('[API] /resolution/hybrid error:', error);
        res.status(error.statusCode || 400).json({ error: safeErrorMessage(error) });
    }
}));

// === Debug ===

router.get('/stats', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ error: 'Not found' });
    }
    res.json(courtSessionManager.getStats());
});

module.exports = router;
