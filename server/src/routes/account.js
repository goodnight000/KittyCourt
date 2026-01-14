/**
 * Account API Routes
 *
 * Endpoints for account management including deletion.
 * Account deletion is required for Apple App Store compliance.
 */

const express = require('express');
const { getSupabase, isSupabaseConfigured } = require('../lib/supabase');
const { requireAuthUserId } = require('../lib/auth');
const { safeErrorMessage } = require('../lib/shared/errorUtils');

const router = express.Router();

/**
 * DELETE /api/account
 *
 * Delete the authenticated user's account.
 * This performs a soft-delete: removes PII, cleans up user data, and then deletes the auth user.
 * If the user is currently connected to a partner, they must disconnect first.
 *
 * Required for Apple App Store compliance.
 */
router.delete('/', async (req, res) => {
    if (!isSupabaseConfigured()) {
        return res.status(503).json({ error: 'Service not configured' });
    }

    try {
        // Get authenticated user
        const userId = await requireAuthUserId(req);
        const supabase = getSupabase();

        // Enforce disconnect-first requirement
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('partner_id')
            .eq('id', userId)
            .single();

        if (profileError) {
            console.error('[Account] Failed to fetch profile:', profileError);
            throw profileError;
        }

        if (profile?.partner_id) {
            return res.status(400).json({ error: 'You must disconnect from your partner before deleting your account.' });
        }

        const nowIso = new Date().toISOString();

        // Deactivate push tokens
        const { error: tokensError } = await supabase
            .from('device_tokens')
            .update({ active: false, deactivated_at: nowIso })
            .eq('user_id', userId);

        if (tokensError) {
            console.error('[Account] Failed to deactivate device tokens:', tokensError);
            throw tokensError;
        }

        // Delete user's memories
        const { error: memoriesError } = await supabase
            .from('user_memories')
            .delete()
            .eq('user_id', userId);

        if (memoriesError) {
            console.error('[Account] Failed to delete user memories:', memoriesError);
            throw memoriesError;
        }

        // Delete partner requests involving this user (sent or received)
        const { error: partnerRequestsError } = await supabase
            .from('partner_requests')
            .delete()
            .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

        if (partnerRequestsError) {
            console.error('[Account] Failed to delete partner requests:', partnerRequestsError);
            throw partnerRequestsError;
        }

        // Remove notification preferences (optional user data)
        const { error: prefsError } = await supabase
            .from('notification_preferences')
            .delete()
            .eq('user_id', userId);

        if (prefsError) {
            console.error('[Account] Failed to delete notification preferences:', prefsError);
            throw prefsError;
        }

        // Soft-delete profile (keep for audit, remove PII)
        const deletedProfile = {
            email: `deleted_${userId}@deleted.local`,
            display_name: 'Deleted User',
            avatar_url: null,
            partner_code: null,
            partner_id: null,
            partner_connected_at: null,
            deleted_at: nowIso,
        };

        const { error: profileUpdateError } = await supabase
            .from('profiles')
            .update(deletedProfile)
            .eq('id', userId);

        if (profileUpdateError) {
            console.error('[Account] Failed to soft-delete profile:', profileUpdateError);
            throw profileUpdateError;
        }

        // Delete from Supabase Auth
        const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

        if (deleteError) {
            console.error('[Account] Failed to delete auth user:', deleteError);
            // Data is already cleaned up, but auth deletion failed
            // The account is effectively deleted from a data perspective
            // Log this for manual cleanup if needed
        }

        console.log(`[Account] User ${userId} account deleted successfully`);
        res.json({ success: true, message: 'Account deleted' });
    } catch (error) {
        console.error('[Account] Delete failed:', error);
        res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

module.exports = router;
