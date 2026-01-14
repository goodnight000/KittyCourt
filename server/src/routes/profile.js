/**
 * Profile Routes
 *
 * Handles profile preference updates.
 */

const express = require('express');
const { requireAuthUserId, requireSupabase } = require('../lib/auth');
const { safeErrorMessage } = require('../lib/shared/errorUtils');

const router = express.Router();

const normalizeString = (value, maxLength = 200) => {
    if (value === null) return null;
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.slice(0, maxLength);
};

const normalizeArray = (value, maxItems = 20) => {
    if (value === null) return null;
    if (!Array.isArray(value)) return undefined;
    const cleaned = value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean);
    const unique = Array.from(new Set(cleaned));
    return unique.slice(0, maxItems);
};

const serializePreferences = (profile) => ({
    loveLanguage: profile?.love_language || '',
    communicationStyle: profile?.communication_style || '',
    conflictStyle: profile?.conflict_style || '',
    favoriteDateActivities: profile?.favorite_date_activities || [],
    petPeeves: profile?.pet_peeves || [],
    appreciationStyle: profile?.appreciation_style || '',
    bio: profile?.bio || '',
});

router.get('/preferences', async (req, res) => {
    try {
        const userId = await requireAuthUserId(req);
        const supabase = requireSupabase();

        const { data, error } = await supabase
            .from('profiles')
            .select('love_language, communication_style, conflict_style, favorite_date_activities, pet_peeves, appreciation_style, bio')
            .eq('id', userId)
            .single();

        if (error) throw error;

        return res.json({ preferences: serializePreferences(data) });
    } catch (error) {
        console.error('[Profile] Failed to load preferences:', error);
        return res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

router.patch('/preferences', async (req, res) => {
    try {
        const userId = await requireAuthUserId(req);
        const supabase = requireSupabase();
        const body = req.body || {};
        const updates = {};

        if ('loveLanguage' in body) {
            const value = normalizeString(body.loveLanguage);
            if (value === undefined) {
                return res.status(400).json({ error: 'loveLanguage must be a string' });
            }
            updates.love_language = value;
        }

        if ('communicationStyle' in body) {
            const value = normalizeString(body.communicationStyle);
            if (value === undefined) {
                return res.status(400).json({ error: 'communicationStyle must be a string' });
            }
            updates.communication_style = value;
        }

        if ('conflictStyle' in body) {
            const value = normalizeString(body.conflictStyle);
            if (value === undefined) {
                return res.status(400).json({ error: 'conflictStyle must be a string' });
            }
            updates.conflict_style = value;
        }

        if ('favoriteDateActivities' in body) {
            const value = normalizeArray(body.favoriteDateActivities);
            if (value === undefined) {
                return res.status(400).json({ error: 'favoriteDateActivities must be an array of strings' });
            }
            updates.favorite_date_activities = value;
        }

        if ('petPeeves' in body) {
            const value = normalizeArray(body.petPeeves);
            if (value === undefined) {
                return res.status(400).json({ error: 'petPeeves must be an array of strings' });
            }
            updates.pet_peeves = value;
        }

        if ('appreciationStyle' in body) {
            const value = normalizeString(body.appreciationStyle);
            if (value === undefined) {
                return res.status(400).json({ error: 'appreciationStyle must be a string' });
            }
            updates.appreciation_style = value;
        }

        if ('bio' in body) {
            const value = normalizeString(body.bio, 500);
            if (value === undefined) {
                return res.status(400).json({ error: 'bio must be a string' });
            }
            updates.bio = value;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No valid preference fields provided' });
        }

        const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', userId)
            .select('love_language, communication_style, conflict_style, favorite_date_activities, pet_peeves, appreciation_style, bio')
            .single();

        if (error) throw error;

        return res.json({ preferences: serializePreferences(data) });
    } catch (error) {
        console.error('[Profile] Failed to update preferences:', error);
        return res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

module.exports = router;
