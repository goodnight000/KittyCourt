/**
 * Judge API Routes
 * Handles all endpoints related to the Cat Judge deliberation process
 */

const express = require('express');
const { deliberate } = require('../lib/judgeEngine');
const { isOpenRouterConfigured } = require('../lib/openrouter');

const router = express.Router();

/**
 * POST /api/judge/deliberate
 * 
 * Main endpoint for submitting a dispute for Judge Whiskers' verdict.
 * Expects a structured intake payload with both users' submissions.
 * 
 * @body {object} participants - { userA: {name, id}, userB: {name, id} }
 * @body {object} submissions - { userA: {...submission}, userB: {...submission} }
 * 
 * @returns {object} Complete verdict response with Judge Whiskers' ruling
 */
router.post('/deliberate', async (req, res) => {
    try {
        console.log('[Judge API] Received deliberation request');

        // Check if API key is configured
        if (!isOpenRouterConfigured()) {
            return res.status(503).json({
                verdictId: null,
                timestamp: new Date().toISOString(),
                status: 'error',
                error: 'Judge Whiskers is sleeping. OpenRouter API key not configured.',
            });
        }

        const result = await deliberate(req.body);

        // Set appropriate status code based on result
        if (result.status === 'error') {
            return res.status(400).json(result);
        }

        if (result.status === 'unsafe_counseling_recommended') {
            return res.status(200).json(result); // Still 200, but with warning status
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error('[Judge API] Unexpected error:', error);
        return res.status(500).json({
            verdictId: null,
            timestamp: new Date().toISOString(),
            status: 'error',
            error: 'An unexpected error occurred. Judge Whiskers has encountered a hairball.',
        });
    }
});

/**
 * POST /api/judge/addendum
 * 
 * Submit an addendum to an existing case for reconsideration.
 * This triggers a new verdict that considers the additional context.
 * 
 * @body {object} originalCase - The original case data
 * @body {object} participants - { userA: {name, id}, userB: {name, id} }
 * @body {object} submissions - Original submissions
 * @body {string} addendumText - The new information to consider
 * @body {string} addendumFrom - Who submitted: 'userA' or 'userB'
 * @body {object} previousVerdict - The previous verdict for context
 * 
 * @returns {object} New verdict response with updated ruling
 */
router.post('/addendum', async (req, res) => {
    try {
        console.log('[Judge API] Received addendum request');

        if (!isOpenRouterConfigured()) {
            return res.status(503).json({
                verdictId: null,
                timestamp: new Date().toISOString(),
                status: 'error',
                error: 'Judge Whiskers is sleeping. OpenRouter API key not configured.',
            });
        }

        const { addendumText, addendumFrom, previousVerdict, ...caseData } = req.body;

        if (!addendumText || !addendumFrom) {
            return res.status(400).json({
                status: 'error',
                error: 'Addendum requires addendumText and addendumFrom fields.',
            });
        }

        const result = await deliberate(caseData, {
            addendumText,
            addendumFrom,
            previousVerdict,
        });

        if (result.status === 'error') {
            return res.status(400).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error('[Judge API] Addendum error:', error);
        return res.status(500).json({
            status: 'error',
            error: 'An unexpected error occurred during addendum processing.',
        });
    }
});

/**
 * GET /api/judge/health
 * 
 * Health check endpoint for the Judge Engine
 */
router.get('/health', (req, res) => {
    const hasApiKey = isOpenRouterConfigured();

    res.json({
        status: hasApiKey ? 'ready' : 'unconfigured',
        service: 'Judge Whiskers Court',
        model: 'x-ai/grok-4.1-fast:free',
        message: hasApiKey
            ? 'Judge Whiskers is awake and ready to preside (via OpenRouter).'
            : 'Judge Whiskers requires an OpenRouter API key to function.',
        timestamp: new Date().toISOString(),
    });
});

/**
 * POST /api/judge/test
 * 
 * Test endpoint with a sample dispute for development purposes
 * Only available in non-production environments
 */
router.post('/test', async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ error: 'Not found' });
    }

    const sampleInput = {
        participants: {
            userA: { name: 'Alex', id: 'u123' },
            userB: { name: 'Sam', id: 'u456' },
        },
        submissions: {
            userA: {
                cameraFacts: 'I came home and the dishes were in the sink. I asked Sam about them, and Sam left the room.',
                selectedPrimaryEmotion: 'Overwhelmed',
                theStoryIamTellingMyself: 'That I am not a priority and I am expected to do everything.',
                coreNeed: 'Support & Partnership',
            },
            userB: {
                cameraFacts: 'Alex came home and immediately commented on the dishes. I had a long day and needed a minute before starting chores.',
                selectedPrimaryEmotion: 'Defensive',
                theStoryIamTellingMyself: 'That I am being attacked the second Alex walks in the door.',
                coreNeed: 'Appreciation & Peace',
            },
        },
    };

    try {
        const result = await deliberate(sampleInput);
        return res.json(result);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

module.exports = router;
