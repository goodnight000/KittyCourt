import { createClient } from '@supabase/supabase-js';

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

/**
 * Generate a unique 12-character partner code
 * Uses uppercase, lowercase letters and numbers
 */
export const generatePartnerCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 12; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
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
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
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
    const redirectTo = `${window.location.origin}/auth/callback`;
    console.log('[Auth] Google Sign-In Redirect URL:', redirectTo);

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo,
        },
    });
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
    console.log('[supabase] upsertProfile called with:', profileData);
    try {
        // First, try the upsert
        const { data: upsertData, error: upsertError } = await supabase
            .from('profiles')
            .upsert(profileData, { onConflict: 'id' })
            .select()
            .single();

        console.log('[supabase] upsertProfile result:', { data: upsertData, error: upsertError });

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
 * Check if partner code exists and get that user's profile
 */
export const findByPartnerCode = async (code) => {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('partner_code', code)
        .single();
    return { data, error };
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

    const { data, error } = await supabase
        .from('partner_requests')
        .select(`
            *,
            sender:profiles!partner_requests_sender_id_fkey (
                id, display_name, avatar_url, partner_code
            )
        `)
        .eq('receiver_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

    return { data: data || [], error };
};

/**
 * Get the partner request sent by the current user (if any)
 */
export const getSentRequest = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: 'Not authenticated' };

    const { data, error } = await supabase
        .from('partner_requests')
        .select(`
            *,
            receiver:profiles!partner_requests_receiver_id_fkey (
                id, display_name, avatar_url, partner_code
            )
        `)
        .eq('sender_id', user.id)
        .eq('status', 'pending')
        .single();

    return { data, error };
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
 */
export const rejectPartnerRequest = async (requestId) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };

    const { data, error } = await supabase
        .from('partner_requests')
        .update({
            status: 'rejected',
            responded_at: new Date().toISOString()
        })
        .eq('id', requestId)
        .eq('receiver_id', user.id)
        .select()
        .single();

    return { data, error };
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

export default supabase;
