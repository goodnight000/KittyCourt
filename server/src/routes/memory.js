/**
 * Memory API Routes
 * 
 * Endpoints for managing user profiles and viewing memories
 * These are utility endpoints for the Hybrid Memory Matrix system
 */

const express = require('express');
const { isSupabaseConfigured, getUserProfile, updateUserProfile, getUserMemories } = require('../lib/supabase');

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
        const profile = await getUserProfile(req.params.userId);
        res.json({
            userId: req.params.userId,
            profile,
        });
    } catch (error) {
        console.error('[Memory API] Error getting profile:', error);
        res.status(500).json({ error: error.message });
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
        const updatedProfile = await updateUserProfile(req.params.userId, req.body);
        res.json({
            userId: req.params.userId,
            profile: updatedProfile,
            message: 'Profile updated successfully',
        });
    } catch (error) {
        console.error('[Memory API] Error updating profile:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/memory/memories/:userId
 * 
 * Get all memories for a user
 * 
 * @query {string} type - Optional filter: 'trigger', 'core_value', or 'pattern'
 */
router.get('/memories/:userId', async (req, res) => {
    if (!isSupabaseConfigured()) {
        return res.status(503).json({
            error: 'Memory system not configured',
        });
    }
    
    try {
        const memories = await getUserMemories(req.params.userId, req.query.type);
        res.json({
            userId: req.params.userId,
            count: memories.length,
            memories,
        });
    } catch (error) {
        console.error('[Memory API] Error getting memories:', error);
        res.status(500).json({ error: error.message });
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
        const [triggers, coreValues, patterns] = await Promise.all([
            getUserMemories(req.params.userId, 'trigger'),
            getUserMemories(req.params.userId, 'core_value'),
            getUserMemories(req.params.userId, 'pattern'),
        ]);
        
        res.json({
            userId: req.params.userId,
            summary: {
                triggers: triggers.length,
                coreValues: coreValues.length,
                patterns: patterns.length,
                total: triggers.length + coreValues.length + patterns.length,
            },
            insights: {
                triggers: triggers.slice(0, 5), // Top 5 by reinforcement
                coreValues: coreValues.slice(0, 5),
                patterns: patterns.slice(0, 5),
            },
        });
    } catch (error) {
        console.error('[Memory API] Error getting insights:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
