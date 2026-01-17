import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';

const NATIVE_OAUTH_SCHEME = 'com.midnightstudio.pause';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables. Check your .env file.');
    console.error('Required: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY');
}

// Create client even if vars are missing (will fail on API calls but won't crash app)
export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-key',
    {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
        },
    }
);

let oauthListenerCleanup = null

export const startNativeOAuthListener = async () => {
    if (!Capacitor.isNativePlatform()) return null
    if (oauthListenerCleanup) return oauthListenerCleanup

    try {
        const { App } = await import('@capacitor/app')
        const { Browser } = await import('@capacitor/browser')

        const isPauseSchemeUrl = (value) => {
            if (!value) return false
            const lower = String(value).toLowerCase()
            return lower.startsWith('com.midnightstudio.pause://')
        }

        const exchangeSupabaseSessionFromUrl = async (url) => {
            // Prefer PKCE code exchange.
            if (typeof supabase.auth.exchangeCodeForSession === 'function') {
                await supabase.auth.exchangeCodeForSession(url)
                return
            }

            // Fallback for older SDKs.
            if (typeof supabase.auth.getSessionFromUrl === 'function') {
                const result = await supabase.auth.getSessionFromUrl({ storeSession: true })
                if (result?.error) throw result.error
                return
            }

            throw new Error('No supported Supabase OAuth exchange method found')
        }

        const handler = async ({ url }) => {
            if (!url) return

            // Handle Supabase OAuth PKCE callback (code exchange).
            if (isPauseSchemeUrl(url) && url.includes('/auth/callback')) {
                try {
                    await exchangeSupabaseSessionFromUrl(url)
                } catch (err) {
                    console.error('[Auth] Failed to exchange OAuth code:', err)
                } finally {
                    try { await Browser.close() } catch (_err) {}
                }
                // Kick the SPA to the callback route so it can render a loading state while auth hydrates.
                try { window.location.assign('/auth/callback') } catch (_err) {}
                return
            }

            // Handle password reset deep link.
            if (isPauseSchemeUrl(url) && url.includes('/reset-password')) {
                try { await Browser.close() } catch (_err) {}
                // Navigate within the SPA.
                window.location.assign('/reset-password')
            }
        }

        const sub = await App.addListener('appUrlOpen', handler)
        oauthListenerCleanup = () => {
            try { sub.remove() } catch (_err) {}
            oauthListenerCleanup = null
        }
        return oauthListenerCleanup
    } catch (err) {
        console.warn('[Auth] Native OAuth listener unavailable:', err?.message || err)
        return null
    }
}

/**
 * Generate a unique 12-character partner code
 * Uses uppercase, lowercase letters and numbers
 * Uses crypto.getRandomValues() for cryptographically secure random generation
 */
export const generatePartnerCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const array = new Uint32Array(12);
    crypto.getRandomValues(array);
    let code = '';
    for (let i = 0; i < 12; i++) {
        code += chars.charAt(array[i] % chars.length);
    }
    return code;
};

/**
 * Sign up with email and password
 */
export const signUpWithEmail = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
    });
    return { data, error };
};

/**
 * Sign in with email and password
 */
export const signInWithEmail = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });
    return { data, error };
};

/**
 * Request a password reset email
 */
export const resetPassword = async (email) => {
    const redirectTo = Capacitor.isNativePlatform()
        ? `${NATIVE_OAUTH_SCHEME}://reset-password`
        : `${window.location.origin}/reset-password`
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
    });
    return { data, error };
};

/**
 * Update password (used after clicking reset link)
 */
export const updatePassword = async (newPassword) => {
    const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
    });
    return { data, error };
};

/**
 * Sign in with Google OAuth
 */
export const signInWithGoogle = async () => {
    const redirectTo = Capacitor.isNativePlatform()
        ? `${NATIVE_OAUTH_SCHEME}://auth/callback`
        : `${window.location.origin}/auth/callback`
    if (import.meta.env.DEV) console.log('[Auth] Google Sign-In Redirect URL:', redirectTo);

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo,
            skipBrowserRedirect: Capacitor.isNativePlatform(),
        },
    });

    if (!error && Capacitor.isNativePlatform() && data?.url) {
        try {
            const { Browser } = await import('@capacitor/browser')
            await Browser.open({ url: data.url })
        } catch (err) {
            console.error('[Auth] Failed to open OAuth URL:', err)
        }
    }
    return { data, error };
};

/**
 * Sign out the current user
 */
export const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
};

/**
 * Get the current session
 */
export const getSession = async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    return { session, error };
};

/**
 * Get the current user
 */
export const getCurrentUser = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    return { user, error };
};

/**
 * Create or update user profile
 */
export const upsertProfile = async (profileData) => {
    if (import.meta.env.DEV) console.log('[supabase] upsertProfile called with:', profileData);
    try {
        // First, try the upsert
        const { data: upsertData, error: upsertError } = await supabase
            .from('profiles')
            .upsert(profileData, { onConflict: 'id' })
            .select()
            .single();

        if (import.meta.env.DEV) console.log('[supabase] upsertProfile result:', { data: upsertData, error: upsertError });

        if (upsertError) {
            console.error('[supabase] upsertProfile error:', upsertError);
            return { data: null, error: upsertError };
        }

        return { data: upsertData, error: null };
    } catch (e) {
        console.error('[supabase] upsertProfile exception:', e);
        return { data: null, error: e };
    }
};

/**
 * Get user profile by ID
 */
export const getProfile = async (userId) => {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
    return { data, error };
};

/**
 * Look up a user by their partner code (secure - only returns ID)
 * Uses an RPC function to prevent exposing profile data to other users
 */
export const findByPartnerCode = async (code) => {
    // Use the secure RPC function that only returns the user ID
    const { data, error } = await supabase.rpc('lookup_user_by_partner_code', {
        code: code
    });

    if (error) {
        return { data: null, error };
    }

    // RPC returns an array of {id} objects, get the first one
    if (!data || data.length === 0) {
        return { data: null, error: { message: 'Partner code not found' } };
    }

    // Return just the ID in a format compatible with existing code
    return { data: { id: data[0].id }, error: null };
};

// ============================================
// PARTNER CONNECTION FUNCTIONS
// ============================================

/**
 * Send a partner connection request
 * @param {string} receiverId - The ID of the user to send the request to
 * @param {string} message - Optional message to include with the request
 */
export const sendPartnerRequest = async (receiverId, message = '') => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };

    // Check if there's already ANY request between these two users (in either direction)
    const { data: existingRequests } = await supabase
        .from('partner_requests')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${user.id})`);

    if (existingRequests && existingRequests.length > 0) {
        const request = existingRequests[0];

        if (request.status === 'pending') {
            if (request.sender_id === user.id) {
                return { error: 'You already sent a request to this person. Waiting for their response!' };
            } else {
                return { error: 'This person already sent you a request! Check your pending requests.' };
            }
        } else if (request.status === 'accepted') {
            return { error: 'You are already connected with this person!' };
        } else if (request.status === 'rejected') {
            // Delete the old rejected request and allow a new one
            await supabase
                .from('partner_requests')
                .delete()
                .eq('id', request.id);
        }
    }

    const { data, error } = await supabase
        .from('partner_requests')
        .insert({
            sender_id: user.id,
            receiver_id: receiverId,
            message: message || null,
            status: 'pending'
        })
        .select()
        .single();

    return { data, error };
};

/**
 * Get pending partner requests received by the current user
 */
export const getPendingRequests = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: [], error: 'Not authenticated' };

    const { data, error } = await supabase.rpc('get_pending_partner_requests');
    if (error) return { data: [], error };

    const mapped = (data || []).map((row) => ({
        id: row.id,
        sender_id: row.sender_id,
        receiver_id: row.receiver_id,
        status: row.status,
        message: row.message,
        created_at: row.created_at,
        responded_at: row.responded_at,
        sender: {
            id: row.sender_id,
            display_name: row.sender_display_name,
            avatar_url: row.sender_avatar_url,
            partner_code: row.sender_partner_code
        }
    }));

    return { data: mapped, error: null };
};

/**
 * Get the partner request sent by the current user (if any)
 */
export const getSentRequest = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: 'Not authenticated' };

    const { data, error } = await supabase.rpc('get_sent_partner_requests');
    if (error) return { data: null, error };

    const row = data?.[0];
    if (!row) return { data: null, error: null };

    const mapped = {
        id: row.id,
        sender_id: row.sender_id,
        receiver_id: row.receiver_id,
        status: row.status,
        message: row.message,
        created_at: row.created_at,
        responded_at: row.responded_at,
        receiver: {
            id: row.receiver_id,
            display_name: row.receiver_display_name,
            avatar_url: row.receiver_avatar_url,
            partner_code: row.receiver_partner_code
        }
    };

    return { data: mapped, error: null };
};

/**
 * Accept a partner connection request
 * This will update both users' profiles to link them as partners
 * and set the anniversary date for both users
 * @param {string} requestId - The ID of the partner request to accept
 * @param {string} anniversaryDate - The couple's anniversary date (YYYY-MM-DD format)
 */
export const acceptPartnerRequest = async (requestId, anniversaryDate = null) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };

    // Call the database function that handles both-way connection
    // This function uses SECURITY DEFINER to bypass RLS
    const { data, error } = await supabase.rpc('accept_partner_connection', {
        p_request_id: requestId,
        p_anniversary_date: anniversaryDate
    });

    if (error) {
        console.error('[acceptPartnerRequest] RPC error:', error);
        return { error: error.message || 'Failed to accept partner request' };
    }

    // Check if the function returned an error
    if (data?.error) {
        return { error: data.error };
    }

    // Get updated profile
    const { data: profile } = await getProfile(user.id);

    return { data: profile, error: null };
};

/**
 * Reject a partner connection request
 * Deletes the request row to allow future requests between the same users
 */
export const rejectPartnerRequest = async (requestId) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };

    // Delete the request instead of marking as rejected
    // This allows the sender to send a new request in the future
    const { error } = await supabase
        .from('partner_requests')
        .delete()
        .eq('id', requestId)
        .eq('receiver_id', user.id);

    return { data: { id: requestId, status: 'rejected' }, error };
};

/**
 * Cancel a sent partner request
 */
export const cancelPartnerRequest = async (requestId) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };

    const { error } = await supabase
        .from('partner_requests')
        .delete()
        .eq('id', requestId)
        .eq('sender_id', user.id);

    return { error };
};

/**
 * Get partner's profile (if connected)
 */
export const getPartnerProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: 'Not authenticated' };

    // Get current user's profile to find partner_id
    const { data: myProfile } = await getProfile(user.id);
    if (!myProfile?.partner_id) {
        return { data: null, error: 'No partner connected' };
    }

    const { data, error } = await getProfile(myProfile.partner_id);
    return { data, error };
};

/**
 * Subscribe to partner requests for real-time updates
 */
export const subscribeToPartnerRequests = (userId, callback) => {
    const subscription = supabase
        .channel('partner_requests_channel')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'partner_requests',
                filter: `receiver_id=eq.${userId}`
            },
            callback
        )
        .subscribe();

    return subscription;
};

/**
 * Subscribe to profile changes for real-time updates
 * This is used to detect when a partner connection is accepted
 */
export const subscribeToProfileChanges = (userId, callback) => {
    const subscription = supabase
        .channel(`profile_changes_${userId}`)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'profiles',
                filter: `id=eq.${userId}`
            },
            callback
        )
        .subscribe();

    return subscription;
};

/**
 * Disconnect from partner
 * Clears partner references on both profiles and removes any pending requests
 */
export const disconnectPartner = async () => {
    const { data, error } = await supabase.rpc('disconnect_partner');
    if (error) {
        console.error('[Supabase] Disconnect partner error:', error);
        return { error: error.message };
    }
    if (data?.error) {
        return { error: data.error };
    }
    return { data };
};

/**
 * Get current user's most recent disconnect status (30-day grace window)
 */
export const getDisconnectStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: 'Not authenticated' };

    const { data, error } = await supabase.rpc('get_my_disconnect_status');
    if (error) {
        console.error('[Supabase] get_my_disconnect_status error:', error);
        return { data: null, error: error.message || 'Failed to load disconnect status' };
    }
    if (data?.error) {
        return { data: null, error: data.error };
    }
    return { data, error: null };
};

/**
 * Subscribe to daily answer changes for real-time updates
 * Used to notify User 1 when User 2 submits their answer
 */
export const subscribeToDailyAnswers = (assignmentId, callback) => {
    const subscription = supabase
        .channel(`daily_answers_${assignmentId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'daily_answers',
                filter: `assignment_id=eq.${assignmentId}`
            },
            callback
        )
        .subscribe();

    return subscription;
};

export default supabase;
