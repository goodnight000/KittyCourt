/**
 * Court REST API Routes - Clean Architecture
 * 
 * Fallback endpoints for when WebSocket is unavailable.
 * All routes delegate to SessionManager.
 */

const express = require('express');
const router = express.Router();
const { courtSessionManager, VIEW_PHASE, PHASE } = require('../lib/courtSessionManager');

// === State ===

/**
 * GET /api/court/state
 * Get current court state for user
 */
router.get('/state', (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) {
            return res.json({ phase: PHASE.IDLE, myViewPhase: VIEW_PHASE.IDLE, session: null });
        }

        const state = courtSessionManager.getStateForUser(userId);
        res.json(state);
    } catch (error) {
        console.error('[API] /state error:', error);
        res.status(500).json({ error: error.message });
    }
});

// === Actions ===

/**
 * POST /api/court/serve
 * Create pending session (serve partner)
 */
router.post('/serve', async (req, res) => {
    try {
        const { userId, partnerId, coupleId, judgeType } = req.body;
        if (!userId || !partnerId) {
            return res.status(400).json({ error: 'userId and partnerId required' });
        }

        await courtSessionManager.serve(userId, partnerId, coupleId, judgeType);
        const state = courtSessionManager.getStateForUser(userId);
        res.json(state);
    } catch (error) {
        console.error('[API] /serve error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /api/court/accept
 * Partner accepts pending session
 */
router.post('/accept', async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        await courtSessionManager.accept(userId);
        const state = courtSessionManager.getStateForUser(userId);
        res.json(state);
    } catch (error) {
        console.error('[API] /accept error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /api/court/cancel
 * Cancel pending session (creator only)
 */
router.post('/cancel', async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        await courtSessionManager.cancel(userId);
        res.json({ phase: PHASE.IDLE, myViewPhase: VIEW_PHASE.IDLE, session: null });
    } catch (error) {
        console.error('[API] /cancel error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /api/court/evidence
 * Submit evidence
 */
router.post('/evidence', async (req, res) => {
    try {
        const { userId, evidence, feelings } = req.body;
        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        await courtSessionManager.submitEvidence(userId, evidence, feelings);
        const state = courtSessionManager.getStateForUser(userId);
        res.json(state);
    } catch (error) {
        console.error('[API] /evidence error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /api/court/verdict/accept
 * Accept verdict
 */
router.post('/verdict/accept', async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        await courtSessionManager.acceptVerdict(userId);
        const state = courtSessionManager.getStateForUser(userId);
        res.json(state);
    } catch (error) {
        console.error('[API] /verdict/accept error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /api/court/settle/request
 * Request settlement
 */
router.post('/settle/request', (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        courtSessionManager.requestSettlement(userId);
        const state = courtSessionManager.getStateForUser(userId);
        res.json(state);
    } catch (error) {
        console.error('[API] /settle/request error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /api/court/settle/accept
 * Accept settlement
 */
router.post('/settle/accept', async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        await courtSessionManager.acceptSettlement(userId);
        res.json({ phase: PHASE.IDLE, myViewPhase: VIEW_PHASE.IDLE, session: null });
    } catch (error) {
        console.error('[API] /settle/accept error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /api/court/settle/decline
 * Decline settlement (case continues)
 */
router.post('/settle/decline', (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        courtSessionManager.declineSettlement(userId);
        const state = courtSessionManager.getStateForUser(userId);
        res.json(state);
    } catch (error) {
        console.error('[API] /settle/decline error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /api/court/addendum
 * Submit addendum (re-run LLM)
 */
router.post('/addendum', async (req, res) => {
    try {
        const { userId, text } = req.body;
        if (!userId || !text) {
            return res.status(400).json({ error: 'userId and text required' });
        }

        await courtSessionManager.submitAddendum(userId, text);
        const state = courtSessionManager.getStateForUser(userId);
        res.json(state);
    } catch (error) {
        console.error('[API] /addendum error:', error);
        res.status(400).json({ error: error.message });
    }
});

// === Debug ===

router.get('/stats', (req, res) => {
    res.json(courtSessionManager.getStats());
});

module.exports = router;
