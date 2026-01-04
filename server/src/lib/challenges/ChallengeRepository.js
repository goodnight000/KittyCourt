/**
 * Challenge Repository
 *
 * Thin database storage layer for challenges.
 * Pure CRUD operations - no business logic.
 *
 * Responsibilities:
 * - Fetch challenge definitions
 * - Fetch couple challenge progress
 * - Update challenge progress
 * - Create couple challenges
 * - Update challenge status
 */

class ChallengeRepository {
    /**
     * Get challenge definitions by IDs
     *
     * @param {Object} supabase - Supabase client
     * @param {string[]} challengeIds - Challenge IDs to fetch
     * @returns {Promise<Object>} - { data: Array, error: Object|null }
     */
    async getChallengeDefinitions(supabase, challengeIds) {
        return await supabase
            .from('challenges')
            .select('*')
            .in('id', challengeIds);
    }

    /**
     * Get single challenge definition by ID
     *
     * @param {Object} supabase - Supabase client
     * @param {string} challengeId - Challenge ID
     * @returns {Promise<Object>} - { data: Object|null, error: Object|null }
     */
    async getChallengeDefinition(supabase, challengeId) {
        return await supabase
            .from('challenges')
            .select('*')
            .eq('id', challengeId)
            .eq('is_active', true)
            .single();
    }

    /**
     * Get couple challenges (progress rows)
     *
     * @param {Object} supabase - Supabase client
     * @param {Object} coupleIds - { user_a_id, user_b_id }
     * @param {string[]} challengeIds - Challenge IDs to fetch
     * @returns {Promise<Object>} - { data: Array, error: Object|null }
     */
    async getCoupleChallenges(supabase, coupleIds, challengeIds) {
        return await supabase
            .from('couple_challenges')
            .select('*')
            .eq('user_a_id', coupleIds.user_a_id)
            .eq('user_b_id', coupleIds.user_b_id)
            .in('challenge_id', challengeIds);
    }

    /**
     * Get active couple challenges with definitions
     *
     * @param {Object} supabase - Supabase client
     * @param {Object} coupleIds - { user_a_id, user_b_id }
     * @returns {Promise<Object>} - { data: Array, error: Object|null }
     */
    async getActiveCoupleChallengesWithDefinitions(supabase, coupleIds) {
        return await supabase
            .from('couple_challenges')
            .select('*, challenges (*)')
            .eq('user_a_id', coupleIds.user_a_id)
            .eq('user_b_id', coupleIds.user_b_id)
            .eq('status', 'active');
    }

    /**
     * Get couple challenge by challenge ID
     *
     * @param {Object} supabase - Supabase client
     * @param {Object} coupleIds - { user_a_id, user_b_id }
     * @param {string} challengeId - Challenge ID
     * @param {string} status - Status filter (e.g., 'active')
     * @returns {Promise<Object>} - { data: Object|null, error: Object|null }
     */
    async getCoupleChallengeByIdAndStatus(supabase, coupleIds, challengeId, status) {
        return await supabase
            .from('couple_challenges')
            .select('*, challenges (*)')
            .eq('user_a_id', coupleIds.user_a_id)
            .eq('user_b_id', coupleIds.user_b_id)
            .eq('challenge_id', challengeId)
            .eq('status', status)
            .maybeSingle();
    }

    /**
     * Update challenge progress
     *
     * @param {Object} supabase - Supabase client
     * @param {string} coupleChallengeId - Couple challenge row ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} - { data: Object|null, error: Object|null }
     */
    async updateChallengeProgress(supabase, coupleChallengeId, updates) {
        return await supabase
            .from('couple_challenges')
            .update(updates)
            .eq('id', coupleChallengeId)
            .select('id, status')
            .single();
    }

    /**
     * Create couple challenge
     *
     * @param {Object} supabase - Supabase client
     * @param {Object} payload - Challenge data
     * @returns {Promise<Object>} - { data: Object|null, error: Object|null }
     */
    async createCoupleChallenge(supabase, payload) {
        return await supabase
            .from('couple_challenges')
            .insert(payload)
            .select('*')
            .single();
    }

    /**
     * Create couple challenge (no return)
     *
     * @param {Object} supabase - Supabase client
     * @param {Object} payload - Challenge data
     * @returns {Promise<Object>} - { error: Object|null }
     */
    async createCoupleChallengeNoReturn(supabase, payload) {
        return await supabase
            .from('couple_challenges')
            .insert(payload);
    }

    /**
     * Mark challenge status
     *
     * @param {Object} supabase - Supabase client
     * @param {string} coupleChallengeId - Couple challenge row ID
     * @param {string} status - New status
     * @returns {Promise<Object>} - { error: Object|null }
     */
    async markChallengeStatus(supabase, coupleChallengeId, status) {
        return await supabase
            .from('couple_challenges')
            .update({ status })
            .eq('id', coupleChallengeId);
    }

    /**
     * Update challenge status with expiration
     *
     * @param {Object} supabase - Supabase client
     * @param {string} coupleChallengeId - Couple challenge row ID
     * @param {string} status - New status
     * @param {string} expiresAt - Expiration timestamp
     * @returns {Promise<Object>} - { error: Object|null }
     */
    async updateChallengeStatusWithExpiration(supabase, coupleChallengeId, status, expiresAt) {
        return await supabase
            .from('couple_challenges')
            .update({ status, expires_at: expiresAt })
            .eq('id', coupleChallengeId);
    }

    /**
     * Update challenge with confirmation
     *
     * @param {Object} supabase - Supabase client
     * @param {string} coupleChallengeId - Couple challenge row ID
     * @param {Object} updates - Confirmation fields to update
     * @returns {Promise<Object>} - { error: Object|null }
     */
    async updateChallengeConfirmation(supabase, coupleChallengeId, updates) {
        return await supabase
            .from('couple_challenges')
            .update(updates)
            .eq('id', coupleChallengeId);
    }
}

module.exports = ChallengeRepository;
