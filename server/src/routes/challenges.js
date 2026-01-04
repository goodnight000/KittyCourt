/**
 * Challenges Routes
 */

const express = require('express');
const router = express.Router();
const { requirePartner } = require('../middleware/requirePartner.cjs');
const {
    fetchChallenges,
    startChallenge,
    skipChallenge,
    requestChallengeCompletion,
    confirmChallengeCompletion,
} = require('../lib/challengeService');
const { isXPSystemEnabled } = require('../lib/xpService');
const { resolveRequestLanguage } = require('../lib/language');
const { sendError } = require('../lib/http');
const { safeErrorMessage } = require('../lib/shared/errorUtils');

router.get('/', requirePartner, async (req, res) => {
    try {
        if (!isXPSystemEnabled()) {
            return res.json({ active: [], available: [], completed: [], enabled: false });
        }

        const { userId, partnerId, supabase } = req;

        const language = await resolveRequestLanguage(req, supabase, userId);
        const result = await fetchChallenges({ userId, partnerId, language });
        if (result?.error) {
            return sendError(res, 500, 'CHALLENGES_FETCH_FAILED', result.error);
        }

        return res.json(result);
    } catch (error) {
        console.error('[Challenges] Failed to fetch challenges:', error);
        return res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

router.post('/:id/start', requirePartner, async (req, res) => {
    try {
        if (!isXPSystemEnabled()) {
            return sendError(res, 400, 'XP_DISABLED', 'XP system disabled');
        }

        const { userId, partnerId, supabase } = req;

        const challengeId = req.params.id;
        const language = await resolveRequestLanguage(req, supabase, userId);
        const result = await startChallenge({ userId, partnerId, challengeId, language });
        if (result?.error) {
            return sendError(res, 400, 'CHALLENGE_START_FAILED', result.error);
        }

        return res.json({ success: true, challenge: result.challenge });
    } catch (error) {
        console.error('[Challenges] Failed to start challenge:', error);
        return res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

router.post('/:id/skip', requirePartner, async (req, res) => {
    try {
        if (!isXPSystemEnabled()) {
            return sendError(res, 400, 'XP_DISABLED', 'XP system disabled');
        }

        const { userId, partnerId, supabase } = req;

        const challengeId = req.params.id;
        const language = await resolveRequestLanguage(req, supabase, userId);
        const result = await skipChallenge({ userId, partnerId, challengeId, language });
        if (result?.error) {
            return sendError(res, 400, 'CHALLENGE_SKIP_FAILED', result.error);
        }

        return res.json({ success: true });
    } catch (error) {
        console.error('[Challenges] Failed to skip challenge:', error);
        return res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

router.post('/:id/complete', requirePartner, async (req, res) => {
    try {
        if (!isXPSystemEnabled()) {
            return sendError(res, 400, 'XP_DISABLED', 'XP system disabled');
        }

        const { userId, partnerId } = req;

        const challengeId = req.params.id;
        const result = await requestChallengeCompletion({ userId, partnerId, challengeId });
        if (result?.error) {
            return sendError(res, 400, 'CHALLENGE_COMPLETE_FAILED', result.error);
        }

        return res.json({ success: true, pending: !!result?.pending });
    } catch (error) {
        console.error('[Challenges] Failed to request completion:', error);
        return res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

router.post('/:id/confirm', requirePartner, async (req, res) => {
    try {
        if (!isXPSystemEnabled()) {
            return sendError(res, 400, 'XP_DISABLED', 'XP system disabled');
        }

        const { userId, partnerId } = req;

        const challengeId = req.params.id;
        const result = await confirmChallengeCompletion({ userId, partnerId, challengeId });
        if (result?.error) {
            return sendError(res, 400, 'CHALLENGE_CONFIRM_FAILED', result.error);
        }

        return res.json({ success: true });
    } catch (error) {
        console.error('[Challenges] Failed to confirm completion:', error);
        return res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

module.exports = router;
