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

const requireUserId = async (req, fallbackUserId) => {
    if (isSupabaseConfigured()) {
        return requireAuthUserId(req);
    }
    if (process.env.NODE_ENV === 'production') {
        const error = new Error('Supabase is not configured');
        error.statusCode = 503;
        throw error;
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
router.get('/state', (req, res) => {
    (async () => {
        try {
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
        } catch (error) {
            console.error('[API] /state error:', error);
            return res.status(error.statusCode || 500).json({ error: error.message });
        }
    })();
});

// === Actions ===

/**
 * POST /api/court/serve
 * Create pending session (serve partner)
 */
router.post('/serve', async (req, res) => {
    try {
        const { userId: fallbackUserId, partnerId, coupleId, judgeType } = req.body;
        const userId = await requireUserId(req, fallbackUserId);

        if (!partnerId) {
            return res.status(400).json({ error: 'partnerId required' });
        }

        if (isSupabaseConfigured()) {
            const supabase = requireSupabase();
            const resolvedPartnerId = await getPartnerIdForUser(supabase, userId);
            if (!resolvedPartnerId || String(resolvedPartnerId) !== String(partnerId)) {
                return res.status(400).json({ error: 'Invalid partnerId for current user' });
            }
        }

        await courtSessionManager.serve(userId, partnerId, coupleId, judgeType);
        const state = courtSessionManager.getStateForUser(userId);
        res.json(state);
    } catch (error) {
        console.error('[API] /serve error:', error);
        res.status(error.statusCode || 400).json({ error: error.message });
    }
});

/**
 * POST /api/court/accept
 * Partner accepts pending session
 */
router.post('/accept', async (req, res) => {
    try {
        const { userId: fallbackUserId } = req.body;
        const userId = await requireUserId(req, fallbackUserId);

        await courtSessionManager.accept(userId);
        const state = courtSessionManager.getStateForUser(userId);
        res.json(state);
    } catch (error) {
        console.error('[API] /accept error:', error);
        res.status(error.statusCode || 400).json({ error: error.message });
    }
});

/**
 * POST /api/court/cancel
 * Cancel pending session (creator only)
 */
router.post('/cancel', async (req, res) => {
    try {
        const { userId: fallbackUserId } = req.body;
        const userId = await requireUserId(req, fallbackUserId);

        await courtSessionManager.cancel(userId);
        res.json({ phase: PHASE.IDLE, myViewPhase: VIEW_PHASE.IDLE, session: null });
    } catch (error) {
        console.error('[API] /cancel error:', error);
        res.status(error.statusCode || 400).json({ error: error.message });
    }
});

/**
 * POST /api/court/evidence
 * Submit evidence
 */
router.post('/evidence', async (req, res) => {
    try {
        const { userId: fallbackUserId, evidence, feelings } = req.body;
        const userId = await requireUserId(req, fallbackUserId);

        const safeEvidence = typeof evidence === 'string' ? evidence.trim().slice(0, 5000) : '';
        const safeFeelings = typeof feelings === 'string' ? feelings.trim().slice(0, 2000) : '';
        if (!safeEvidence) return res.status(400).json({ error: 'evidence is required' });

        await courtSessionManager.submitEvidence(userId, safeEvidence, safeFeelings);
        const state = courtSessionManager.getStateForUser(userId);
        res.json(state);
    } catch (error) {
        console.error('[API] /evidence error:', error);
        res.status(error.statusCode || 400).json({ error: error.message });
    }
});

/**
 * POST /api/court/verdict/accept
 * Accept verdict
 */
router.post('/verdict/accept', async (req, res) => {
    try {
        const { userId: fallbackUserId } = req.body;
        const userId = await requireUserId(req, fallbackUserId);

        await courtSessionManager.acceptVerdict(userId);
        const state = courtSessionManager.getStateForUser(userId);
        res.json(state);
    } catch (error) {
        console.error('[API] /verdict/accept error:', error);
        res.status(error.statusCode || 400).json({ error: error.message });
    }
});

/**
 * POST /api/court/settle/request
 * Request settlement
 */
router.post('/settle/request', (req, res) => {
    (async () => {
        try {
            const { userId: fallbackUserId } = req.body;
            const userId = await requireUserId(req, fallbackUserId);

            courtSessionManager.requestSettlement(userId);
            const state = courtSessionManager.getStateForUser(userId);
            return res.json(state);
        } catch (error) {
            console.error('[API] /settle/request error:', error);
            return res.status(error.statusCode || 400).json({ error: error.message });
        }
    })();
});

/**
 * POST /api/court/settle/accept
 * Accept settlement
 */
router.post('/settle/accept', async (req, res) => {
    try {
        const { userId: fallbackUserId } = req.body;
        const userId = await requireUserId(req, fallbackUserId);

        await courtSessionManager.acceptSettlement(userId);
        res.json({ phase: PHASE.IDLE, myViewPhase: VIEW_PHASE.IDLE, session: null });
    } catch (error) {
        console.error('[API] /settle/accept error:', error);
        res.status(error.statusCode || 400).json({ error: error.message });
    }
});

/**
 * POST /api/court/settle/decline
 * Decline settlement (case continues)
 */
router.post('/settle/decline', (req, res) => {
    (async () => {
        try {
            const { userId: fallbackUserId } = req.body;
            const userId = await requireUserId(req, fallbackUserId);

            courtSessionManager.declineSettlement(userId);
            const state = courtSessionManager.getStateForUser(userId);
            return res.json(state);
        } catch (error) {
            console.error('[API] /settle/decline error:', error);
            return res.status(error.statusCode || 400).json({ error: error.message });
        }
    })();
});

/**
 * POST /api/court/addendum
 * Submit addendum (re-run LLM)
 */
router.post('/addendum', async (req, res) => {
    try {
        const { userId: fallbackUserId, text } = req.body;
        const userId = await requireUserId(req, fallbackUserId);

        const safeText = typeof text === 'string' ? text.trim().slice(0, 2000) : '';
        if (!safeText) return res.status(400).json({ error: 'text required' });

        await courtSessionManager.submitAddendum(userId, safeText);
        const state = courtSessionManager.getStateForUser(userId);
        res.json(state);
    } catch (error) {
        console.error('[API] /addendum error:', error);
        res.status(error.statusCode || 400).json({ error: error.message });
    }
});

// === V2.0 Pipeline Endpoints ===

/**
 * POST /api/court/priming/complete
 * Mark priming page as read (v2.0 pipeline)
 */
router.post('/priming/complete', async (req, res) => {
    try {
        const { userId: fallbackUserId } = req.body;
        const userId = await requireUserId(req, fallbackUserId);

        await courtSessionManager.markPrimingComplete(userId);
        const state = courtSessionManager.getStateForUser(userId);
        res.json(state);
    } catch (error) {
        console.error('[API] /priming/complete error:', error);
        res.status(error.statusCode || 400).json({ error: error.message });
    }
});

/**
 * POST /api/court/joint/ready
 * Mark ready to proceed from joint menu (v2.0 pipeline)
 */
router.post('/joint/ready', async (req, res) => {
    try {
        const { userId: fallbackUserId } = req.body;
        const userId = await requireUserId(req, fallbackUserId);

        await courtSessionManager.markJointReady(userId);
        const state = courtSessionManager.getStateForUser(userId);
        res.json(state);
    } catch (error) {
        console.error('[API] /joint/ready error:', error);
        res.status(error.statusCode || 400).json({ error: error.message });
    }
});

/**
 * POST /api/court/resolution/pick
 * Submit resolution choice (v2.0 pipeline)
 */
router.post('/resolution/pick', async (req, res) => {
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
        res.status(error.statusCode || 400).json({ error: error.message });
    }
});

/**
 * POST /api/court/resolution/accept-partner
 * Accept partner's resolution choice (v2.0 pipeline)
 */
router.post('/resolution/accept-partner', async (req, res) => {
    try {
        const { userId: fallbackUserId } = req.body;
        const userId = await requireUserId(req, fallbackUserId);

        await courtSessionManager.acceptPartnerResolution(userId);
        const state = courtSessionManager.getStateForUser(userId);
        res.json(state);
    } catch (error) {
        console.error('[API] /resolution/accept-partner error:', error);
        res.status(error.statusCode || 400).json({ error: error.message });
    }
});

/**
 * POST /api/court/resolution/hybrid
 * Request hybrid resolution generation (v2.0 pipeline)
 */
router.post('/resolution/hybrid', async (req, res) => {
    try {
        const { userId: fallbackUserId } = req.body;
        const userId = await requireUserId(req, fallbackUserId);

        await courtSessionManager.requestHybridResolution(userId);
        const state = courtSessionManager.getStateForUser(userId);
        res.json(state);
    } catch (error) {
        console.error('[API] /resolution/hybrid error:', error);
        res.status(error.statusCode || 400).json({ error: error.message });
    }
});

// === Debug ===

router.get('/stats', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ error: 'Not found' });
    }
    res.json(courtSessionManager.getStats());
});

module.exports = router;
