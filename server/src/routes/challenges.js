/**
 * Challenges Routes
 */

const express = require('express');
const router = express.Router();
const { requirePartner } = require('../middleware/requirePartner');
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
const { sendNotificationToPartner } = require('../lib/notificationService');

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get('/', requirePartner, async (req, res) => {
    try {
        if (!isXPSystemEnabled()) {
            return res.json({ active: [], available: [], completed: [], enabled: false });
        }

        const { userId, partnerId, supabase } = req;

        // Pagination params
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const offset = parseInt(req.query.offset) || 0;

        const language = await resolveRequestLanguage(req, supabase, userId);
        const result = await fetchChallenges({ userId, partnerId, language, limit, offset });
        if (result?.error) {
            return sendError(res, 500, 'CHALLENGES_FETCH_FAILED', result.error);
        }

        // Calculate total items for pagination
        const totalItems = (result.active?.length || 0) + (result.available?.length || 0) + (result.completed?.length || 0);

        return res.json({
            ...result,
            pagination: {
                limit,
                offset,
                hasMore: totalItems === limit
            }
        });
    } catch (error) {
        console.error('[Challenges] Failed to fetch challenges:', error);
        return sendError(res, error.statusCode || 500, 'SERVER_ERROR', safeErrorMessage(error));
    }
});

router.post('/:id/start', requirePartner, async (req, res) => {
    try {
        const challengeId = req.params.id;

        // Input validation
        if (!UUID_REGEX.test(challengeId)) {
            return sendError(res, 400, 'INVALID_ID', 'Invalid challenge ID format');
        }

        if (!isXPSystemEnabled()) {
            return sendError(res, 400, 'XP_DISABLED', 'XP system disabled');
        }

        const { userId, partnerId, supabase } = req;
        const language = await resolveRequestLanguage(req, supabase, userId);
        const result = await startChallenge({ userId, partnerId, challengeId, language });
        if (result?.error) {
            return sendError(res, 400, 'CHALLENGE_START_FAILED', result.error);
        }

        return res.json({ success: true, challenge: result.challenge });
    } catch (error) {
        console.error('[Challenges] Failed to start challenge:', error);
        return sendError(res, error.statusCode || 500, 'SERVER_ERROR', safeErrorMessage(error));
    }
});

router.post('/:id/skip', requirePartner, async (req, res) => {
    try {
        const challengeId = req.params.id;

        // Input validation
        if (!UUID_REGEX.test(challengeId)) {
            return sendError(res, 400, 'INVALID_ID', 'Invalid challenge ID format');
        }

        if (!isXPSystemEnabled()) {
            return sendError(res, 400, 'XP_DISABLED', 'XP system disabled');
        }

        const { userId, partnerId, supabase } = req;
        const language = await resolveRequestLanguage(req, supabase, userId);
        const result = await skipChallenge({ userId, partnerId, challengeId, language });
        if (result?.error) {
            return sendError(res, 400, 'CHALLENGE_SKIP_FAILED', result.error);
        }

        return res.json({ success: true });
    } catch (error) {
        console.error('[Challenges] Failed to skip challenge:', error);
        return sendError(res, error.statusCode || 500, 'SERVER_ERROR', safeErrorMessage(error));
    }
});

router.post('/:id/complete', requirePartner, async (req, res) => {
    try {
        const challengeId = req.params.id;

        // Input validation
        if (!UUID_REGEX.test(challengeId)) {
            return sendError(res, 400, 'INVALID_ID', 'Invalid challenge ID format');
        }

        if (!isXPSystemEnabled()) {
            return sendError(res, 400, 'XP_DISABLED', 'XP system disabled');
        }

        const { userId, partnerId } = req;
        const result = await requestChallengeCompletion({ userId, partnerId, challengeId });
        if (result?.error) {
            return sendError(res, 400, 'CHALLENGE_COMPLETE_FAILED', result.error);
        }

        // Notify partner of completion request
        sendNotificationToPartner(userId, {
            type: 'challenge_completion',
            title: 'Challenge Completion',
            body: 'Your partner marked a challenge as complete - please confirm!',
            data: { screen: 'challenges', challengeId }
        }).catch(err => console.warn('[Challenges] Push notification failed:', err?.message));

        return res.json({ success: true, pending: !!result?.pending });
    } catch (error) {
        console.error('[Challenges] Failed to request completion:', error);
        return sendError(res, error.statusCode || 500, 'SERVER_ERROR', safeErrorMessage(error));
    }
});

router.post('/:id/confirm', requirePartner, async (req, res) => {
    try {
        const challengeId = req.params.id;

        // Input validation
        if (!UUID_REGEX.test(challengeId)) {
            return sendError(res, 400, 'INVALID_ID', 'Invalid challenge ID format');
        }

        if (!isXPSystemEnabled()) {
            return sendError(res, 400, 'XP_DISABLED', 'XP system disabled');
        }

        const { userId, partnerId } = req;
        const result = await confirmChallengeCompletion({ userId, partnerId, challengeId });
        if (result?.error) {
            return sendError(res, 400, 'CHALLENGE_CONFIRM_FAILED', result.error);
        }

        // Notify partner that challenge was confirmed
        sendNotificationToPartner(userId, {
            type: 'challenge_confirmed',
            title: 'Challenge Confirmed!',
            body: 'Your partner confirmed the challenge completion',
            data: { screen: 'challenges', challengeId }
        }).catch(err => console.warn('[Challenges] Push notification failed:', err?.message));

        return res.json({ success: true });
    } catch (error) {
        console.error('[Challenges] Failed to confirm completion:', error);
        return sendError(res, error.statusCode || 500, 'SERVER_ERROR', safeErrorMessage(error));
    }
});

module.exports = router;
