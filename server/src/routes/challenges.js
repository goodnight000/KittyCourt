/**
 * Challenges Routes
 */

const express = require('express');
const router = express.Router();
const { requireSupabase, requireAuthUserId, getPartnerIdForUser } = require('../lib/auth');
const {
    fetchChallenges,
    startChallenge,
    skipChallenge,
    requestChallengeCompletion,
    confirmChallengeCompletion,
} = require('../lib/challengeService');
const { isXPSystemEnabled } = require('../lib/xpService');

const isProd = process.env.NODE_ENV === 'production';
const safeErrorMessage = (error) => (isProd ? 'Internal server error' : (error?.message || String(error)));

router.get('/', async (req, res) => {
    try {
        if (!isXPSystemEnabled()) {
            return res.json({ active: [], available: [], completed: [], enabled: false });
        }

        const supabase = requireSupabase();
        const userId = await requireAuthUserId(req);
        const partnerId = await getPartnerIdForUser(supabase, userId);

        if (!partnerId) {
            return res.status(400).json({ error: 'No partner connected' });
        }

        const result = await fetchChallenges({ userId, partnerId });
        if (result?.error) {
            return res.status(500).json({ error: result.error });
        }

        return res.json(result);
    } catch (error) {
        console.error('[Challenges] Failed to fetch challenges:', error);
        return res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

router.post('/:id/start', async (req, res) => {
    try {
        if (!isXPSystemEnabled()) {
            return res.status(400).json({ error: 'XP system disabled' });
        }

        const supabase = requireSupabase();
        const userId = await requireAuthUserId(req);
        const partnerId = await getPartnerIdForUser(supabase, userId);

        if (!partnerId) {
            return res.status(400).json({ error: 'No partner connected' });
        }

        const challengeId = req.params.id;
        const result = await startChallenge({ userId, partnerId, challengeId });
        if (result?.error) {
            return res.status(400).json({ error: result.error });
        }

        return res.json({ success: true, challenge: result.challenge });
    } catch (error) {
        console.error('[Challenges] Failed to start challenge:', error);
        return res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

router.post('/:id/skip', async (req, res) => {
    try {
        if (!isXPSystemEnabled()) {
            return res.status(400).json({ error: 'XP system disabled' });
        }

        const supabase = requireSupabase();
        const userId = await requireAuthUserId(req);
        const partnerId = await getPartnerIdForUser(supabase, userId);

        if (!partnerId) {
            return res.status(400).json({ error: 'No partner connected' });
        }

        const challengeId = req.params.id;
        const result = await skipChallenge({ userId, partnerId, challengeId });
        if (result?.error) {
            return res.status(400).json({ error: result.error });
        }

        return res.json({ success: true });
    } catch (error) {
        console.error('[Challenges] Failed to skip challenge:', error);
        return res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

router.post('/:id/complete', async (req, res) => {
    try {
        if (!isXPSystemEnabled()) {
            return res.status(400).json({ error: 'XP system disabled' });
        }

        const supabase = requireSupabase();
        const userId = await requireAuthUserId(req);
        const partnerId = await getPartnerIdForUser(supabase, userId);

        if (!partnerId) {
            return res.status(400).json({ error: 'No partner connected' });
        }

        const challengeId = req.params.id;
        const result = await requestChallengeCompletion({ userId, partnerId, challengeId });
        if (result?.error) {
            return res.status(400).json({ error: result.error });
        }

        return res.json({ success: true, pending: !!result?.pending });
    } catch (error) {
        console.error('[Challenges] Failed to request completion:', error);
        return res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

router.post('/:id/confirm', async (req, res) => {
    try {
        if (!isXPSystemEnabled()) {
            return res.status(400).json({ error: 'XP system disabled' });
        }

        const supabase = requireSupabase();
        const userId = await requireAuthUserId(req);
        const partnerId = await getPartnerIdForUser(supabase, userId);

        if (!partnerId) {
            return res.status(400).json({ error: 'No partner connected' });
        }

        const challengeId = req.params.id;
        const result = await confirmChallengeCompletion({ userId, partnerId, challengeId });
        if (result?.error) {
            return res.status(400).json({ error: result.error });
        }

        return res.json({ success: true });
    } catch (error) {
        console.error('[Challenges] Failed to confirm completion:', error);
        return res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

module.exports = router;
