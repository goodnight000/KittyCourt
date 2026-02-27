const express = require('express');

const router = express.Router();
const { requireAuthUserId } = require('../lib/auth');
const { verifyAbuseChallenge } = require('../lib/abuse/challengeStore');
const { sendError } = require('../lib/http');
const { safeErrorMessage } = require('../lib/shared/errorUtils');

router.post('/challenge/verify', async (req, res) => {
    try {
        const userId = await requireAuthUserId(req);
        const { challengeId, answer } = req.body || {};

        if (!challengeId || typeof challengeId !== 'string') {
            return sendError(res, 400, 'INVALID_INPUT', 'challengeId is required');
        }
        if (answer === undefined || answer === null || String(answer).trim().length === 0) {
            return sendError(res, 400, 'INVALID_INPUT', 'answer is required');
        }

        const result = await verifyAbuseChallenge({
            userId,
            challengeId: challengeId.trim(),
            answer: String(answer),
        });

        if (!result.ok) {
            if (result.code === 'ABUSE_CHALLENGE_NOT_FOUND' || result.code === 'ABUSE_CHALLENGE_EXPIRED') {
                return sendError(res, 410, result.code, result.message || 'Challenge expired. Please retry request.');
            }
            if (result.code === 'ABUSE_CHALLENGE_FORBIDDEN') {
                return sendError(res, 403, result.code, result.message || 'Challenge does not belong to user.');
            }
            if (result.code === 'ABUSE_CHALLENGE_INCORRECT') {
                return sendError(res, 400, result.code, result.message || 'Incorrect challenge answer.');
            }
            return sendError(res, 400, result.code || 'ABUSE_CHALLENGE_INVALID', result.message || 'Challenge verification failed.');
        }

        return res.json({
            success: true,
            challengeToken: result.challengeToken,
            endpointKey: result.endpointKey || null,
            expiresAt: result.expiresAt ? new Date(result.expiresAt).toISOString() : null,
        });
    } catch (error) {
        return sendError(res, error.statusCode || 500, 'SERVER_ERROR', safeErrorMessage(error));
    }
});

module.exports = router;
