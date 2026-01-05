/**
 * Stats Service
 *
 * Service layer for user statistics including:
 * - Streak tracking (with grace period support)
 * - Questions completed count
 * - Cases resolved count
 * - Streak revival for Gold users
 */

const { getSupabase, isSupabaseConfigured } = require('./supabase');

/**
 * Get stats for a single user by counting directly from source tables
 * @param {string} userId - The user's UUID
 * @returns {Promise<Object>} Formatted stats object
 */
async function getStats(userId) {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const supabase = getSupabase();

    // Fetch data in parallel directly from source tables
    const [
        casesResult,
        appreciationsResult,
        questionsResult
    ] = await Promise.all([
        // All resolved cases where user is involved
        supabase
            .from('cases')
            .select('id, user_a_id, user_b_id')
            .eq('status', 'RESOLVED')
            .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`),

        // Appreciations received by user
        supabase
            .from('appreciations')
            .select('id')
            .eq('to_user_id', userId),

        // Completed questions where user is involved
        supabase
            .from('couple_question_assignments')
            .select('id, user_a_id, user_b_id')
            .eq('status', 'completed')
            .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    ]);

    // Count results
    const casesResolved = casesResult.data?.length || 0;
    const appreciationsReceived = appreciationsResult.data?.length || 0;
    const questionsCompleted = questionsResult.data?.length || 0;

    return {
        current_streak: 0,
        longest_streak: 0,
        last_streak_date: null,
        is_grace_period: false,
        grace_days_remaining: 0,
        streak_expired: false,
        can_revive: false,
        revival_available_at: null,
        questions_completed: questionsCompleted,
        cases_resolved: casesResolved,
        appreciations_received: appreciationsReceived
    };
}

/**
 * Revive a user's streak (Gold users only)
 * @param {string} userId - The user's UUID
 * @param {boolean} isGold - Whether the user has Gold subscription
 * @returns {Promise<Object>} Result with success, new_streak, and message
 */
async function reviveStreak(userId, isGold) {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    // Validate Gold subscription before allowing revival
    if (!isGold) {
        return {
            success: false,
            new_streak: 0,
            message: 'Streak revival is only available for Pause Gold subscribers'
        };
    }

    const supabase = getSupabase();

    // Call the revive_streak RPC function
    const { data, error } = await supabase.rpc('revive_streak', {
        p_user_id: userId
    });

    if (error) {
        console.error('[StatsService] revive_streak error:', error);
        throw error;
    }

    // RPC returns an array, take first row
    const result = data?.[0] || {};

    return {
        success: result.success ?? false,
        new_streak: result.new_streak ?? 0,
        message: result.message || 'Unknown error'
    };
}

/**
 * Get stats for both partners in a couple
 * @param {string} userAId - First user's UUID
 * @param {string} userBId - Second user's UUID
 * @returns {Promise<Object>} Object with stats for both users
 */
async function getStatsForCouple(userAId, userBId) {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    // Fetch stats for both users in parallel
    const [userAStats, userBStats] = await Promise.all([
        getStats(userAId),
        getStats(userBId)
    ]);

    return {
        userA: {
            userId: userAId,
            ...userAStats
        },
        userB: {
            userId: userBId,
            ...userBStats
        }
    };
}

/**
 * Get subscription tier for a user
 * @param {string} userId - The user's UUID
 * @returns {Promise<string>} 'pause_gold' or 'free'
 */
async function getUserSubscriptionTier(userId) {
    if (!isSupabaseConfigured()) {
        return 'free';
    }

    const supabase = getSupabase();

    const { data: profile, error } = await supabase
        .from('profiles')
        .select('subscription_tier, subscription_expires_at')
        .eq('id', userId)
        .single();

    if (error || !profile) {
        return 'free';
    }

    // Check if subscription is expired
    if (profile.subscription_tier === 'pause_gold' && profile.subscription_expires_at) {
        if (new Date(profile.subscription_expires_at) < new Date()) {
            return 'free';
        }
    }

    return profile.subscription_tier || 'free';
}

/**
 * Check if user has Gold subscription
 * @param {string} userId - The user's UUID
 * @returns {Promise<boolean>}
 */
async function isGoldUser(userId) {
    const tier = await getUserSubscriptionTier(userId);
    return tier === 'pause_gold';
}

module.exports = {
    getStats,
    reviveStreak,
    getStatsForCouple,
    getUserSubscriptionTier,
    isGoldUser
};
