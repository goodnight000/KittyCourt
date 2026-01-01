/**
 * Memory API Routes
 * 
 * Endpoints for managing user profiles and viewing memories
 * These are utility endpoints for the Hybrid Memory Matrix system
 */

const express = require('express');
const { isSupabaseConfigured, getUserProfile, updateUserProfile, getUserMemories } = require('../lib/supabase');
const { requireAuthUserId } = require('../lib/auth');

const router = express.Router();

/**
 * GET /api/memory/health
 * 
 * Health check for the memory system
 */
router.get('/health', (req, res) => {
    const configured = isSupabaseConfigured();
    
    res.json({
        status: configured ? 'ready' : 'unconfigured',
        service: 'Hybrid Memory Matrix',
        message: configured
            ? 'Memory system is operational'
            : 'Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.',
        timestamp: new Date().toISOString(),
    });
});

/**
 * GET /api/memory/profile/:userId
 * 
 * Get a user's static profile data
 */
router.get('/profile/:userId', async (req, res) => {
    if (!isSupabaseConfigured()) {
        return res.status(503).json({
            error: 'Memory system not configured',
        });
    }
    
    try {
        const viewerId = await requireAuthUserId(req);
        if (String(req.params.userId) !== String(viewerId)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const profile = await getUserProfile(viewerId);
        res.json({
            userId: viewerId,
            profile,
        });
    } catch (error) {
        console.error('[Memory API] Error getting profile:', error);
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

/**
 * PATCH /api/memory/profile/:userId
 * 
 * Update a user's static profile data (merge with existing)
 * 
 * @body {object} profile - Profile fields to update
 * 
 * Valid profile fields:
 * - attachmentStyle: string (e.g., "secure", "anxious", "avoidant", "disorganized")
 * - loveLanguages: string[] (e.g., ["words of affirmation", "quality time"])
 * - conflictStyle: string (e.g., "collaborative", "competitive", "avoidant")
 * - stressResponse: string (e.g., "fight", "flight", "freeze", "fawn")
 * - coreNeeds: string[] (e.g., ["autonomy", "connection", "security"])
 * - customFields: object (any additional data)
 */
router.patch('/profile/:userId', async (req, res) => {
    if (!isSupabaseConfigured()) {
        return res.status(503).json({
            error: 'Memory system not configured',
        });
    }
    
    try {
        const viewerId = await requireAuthUserId(req);
        if (String(req.params.userId) !== String(viewerId)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const updatedProfile = await updateUserProfile(viewerId, req.body);
        res.json({
            userId: viewerId,
            profile: updatedProfile,
            message: 'Profile updated successfully',
        });
    } catch (error) {
        console.error('[Memory API] Error updating profile:', error);
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

/**
 * GET /api/memory/memories/:userId
 * 
 * Get all memories for a user
 * 
 * @query {string} type - Optional filter: 'trigger', 'core_value', 'pattern', or 'preference'
 */
router.get('/memories/:userId', async (req, res) => {
    if (!isSupabaseConfigured()) {
        return res.status(503).json({
            error: 'Memory system not configured',
        });
    }
    
    try {
        const viewerId = await requireAuthUserId(req);
        if (String(req.params.userId) !== String(viewerId)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const allowedTypes = new Set(['trigger', 'core_value', 'pattern', 'preference']);
        const type = typeof req.query.type === 'string' ? req.query.type : null;
        if (type && !allowedTypes.has(type)) {
            return res.status(400).json({ error: 'Invalid type' });
        }

        const memories = await getUserMemories(viewerId, type);
        res.json({
            userId: viewerId,
            count: memories.length,
            memories,
        });
    } catch (error) {
        console.error('[Memory API] Error getting memories:', error);
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

/**
 * GET /api/memory/insights/:userId
 * 
 * Get a summary of insights for a user (grouped by type)
 */
router.get('/insights/:userId', async (req, res) => {
    if (!isSupabaseConfigured()) {
        return res.status(503).json({
            error: 'Memory system not configured',
        });
    }
    
    try {
        const viewerId = await requireAuthUserId(req);
        if (String(req.params.userId) !== String(viewerId)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const [triggers, coreValues, patterns, preferences] = await Promise.all([
            getUserMemories(viewerId, 'trigger'),
            getUserMemories(viewerId, 'core_value'),
            getUserMemories(viewerId, 'pattern'),
            getUserMemories(viewerId, 'preference'),
        ]);
        
        res.json({
            userId: viewerId,
            summary: {
                triggers: triggers.length,
                coreValues: coreValues.length,
                patterns: patterns.length,
                preferences: preferences.length,
                total: triggers.length + coreValues.length + patterns.length + preferences.length,
            },
            insights: {
                triggers: triggers.slice(0, 5), // Top 5 by reinforcement
                coreValues: coreValues.slice(0, 5),
                patterns: patterns.slice(0, 5),
                preferences: preferences.slice(0, 5),
            },
        });
    } catch (error) {
        console.error('[Memory API] Error getting insights:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
