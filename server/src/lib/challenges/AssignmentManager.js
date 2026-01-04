/**
 * Assignment Manager
 *
 * Handles challenge assignment and period management.
 *
 * Responsibilities:
 * - Track recent assignments to avoid repetition
 * - Create new challenge assignments for periods
 * - Check if challenges are assigned for current period
 * - Auto-start challenges when assignments are created
 */

const { getPeriodRange, getEtMidnightIso } = require('../shared/dateTimeUtils.js');

const CADENCE = {
    DAILY: 'daily',
    WEEKLY: 'weekly',
};

const RECENT_REPEAT_LIMITS = {
    [CADENCE.DAILY]: 10,
    [CADENCE.WEEKLY]: 2,
};

class AssignmentManager {
    /**
     * Get recent assignment IDs to avoid repetition
     *
     * @param {Object} params
     * @param {Object} params.supabase - Supabase client
     * @param {Object} params.coupleIds - { user_a_id, user_b_id }
     * @param {string} params.cadence - 'daily' or 'weekly'
     * @param {number} params.cycleCount - Number of recent cycles to track
     * @returns {Promise<Set>} - Set of recently assigned challenge IDs
     */
    async getRecentAssignmentIds({ supabase, coupleIds, cadence, cycleCount }) {
        const { data, error } = await supabase
            .from('challenge_assignments')
            .select('challenge_id, period_start')
            .eq('user_a_id', coupleIds.user_a_id)
            .eq('user_b_id', coupleIds.user_b_id)
            .eq('cadence', cadence)
            .order('period_start', { ascending: false })
            .limit(cycleCount * 5); // Fetch more to ensure we get enough periods

        if (error) {
            console.warn('[Challenges] Failed to load recent assignments:', error);
            return new Set();
        }

        const recentIds = new Set();
        const seenPeriods = new Set();

        for (const row of data || []) {
            if (!seenPeriods.has(row.period_start)) {
                if (seenPeriods.size >= cycleCount) break;
                seenPeriods.add(row.period_start);
            }
            if (seenPeriods.has(row.period_start)) {
                recentIds.add(row.challenge_id);
            }
        }

        return recentIds;
    }

    /**
     * Ensure challenge assignments exist for current period
     *
     * Creates new assignments if needed, avoiding recent repeats.
     *
     * @param {Object} params
     * @param {Object} params.supabase - Supabase client
     * @param {Object} params.coupleIds - { user_a_id, user_b_id }
     * @param {string} params.cadence - 'daily' or 'weekly'
     * @param {number} params.count - Number of assignments to ensure
     * @returns {Promise<Object>} - { assignments: Array, error?: string }
     */
    async ensureAssignments({ supabase, coupleIds, cadence, count }) {
        const { startDate, endDate } = getPeriodRange(cadence);

        // Check existing assignments for this period
        const { data: existing, error: existingError } = await supabase
            .from('challenge_assignments')
            .select('challenge_id, period_start, period_end')
            .eq('user_a_id', coupleIds.user_a_id)
            .eq('user_b_id', coupleIds.user_b_id)
            .eq('cadence', cadence)
            .eq('period_start', startDate);

        if (existingError) {
            return { assignments: existing || [], error: existingError.message };
        }

        const existingIds = new Set((existing || []).map((row) => row.challenge_id));
        if (existingIds.size >= count) {
            return { assignments: existing || [] };
        }

        // Get recent assignments to avoid repetition
        const recentLimit = RECENT_REPEAT_LIMITS[cadence] || 0;
        const recentIds = recentLimit > 0
            ? await this.getRecentAssignmentIds({ supabase, coupleIds, cadence, cycleCount: recentLimit })
            : new Set();

        // Fetch all active challenges for this cadence
        const { data: candidates, error: candidatesError } = await supabase
            .from('challenges')
            .select('*')
            .eq('is_active', true)
            .eq('cadence', cadence);

        if (candidatesError) {
            return { assignments: existing || [], error: candidatesError.message };
        }

        // Filter out already assigned and recently used challenges
        const needed = count - existingIds.size;
        const filtered = (candidates || []).filter((challenge) => (
            !existingIds.has(challenge.id) && !recentIds.has(challenge.id)
        ));

        // Fallback: if not enough non-recent challenges, use any not-assigned
        let pool = filtered;
        if (pool.length < needed) {
            pool = (candidates || []).filter((challenge) => !existingIds.has(challenge.id));
        }

        // Randomly select challenges
        const shuffled = pool.sort(() => Math.random() - 0.5);
        const picks = shuffled.slice(0, needed);

        if (picks.length === 0) {
            return { assignments: existing || [] };
        }

        // Insert new assignments
        const payload = picks.map((challenge) => ({
            user_a_id: coupleIds.user_a_id,
            user_b_id: coupleIds.user_b_id,
            challenge_id: challenge.id,
            cadence,
            period_start: startDate,
            period_end: endDate,
        }));

        const { data: inserted, error: insertError } = await supabase
            .from('challenge_assignments')
            .insert(payload)
            .select('challenge_id, period_start, period_end');

        if (insertError) {
            console.warn('[Challenges] Failed to insert assignments:', insertError);
            return { assignments: existing || [] };
        }

        return { assignments: [...(existing || []), ...(inserted || [])] };
    }

    /**
     * Check if a challenge is assigned for current period
     *
     * @param {Object} params
     * @param {Object} params.supabase - Supabase client
     * @param {Object} params.coupleIds - { user_a_id, user_b_id }
     * @param {string} params.challengeId - Challenge ID to check
     * @param {string} params.cadence - 'daily' or 'weekly'
     * @returns {Promise<Object|null>} - Assignment row or null
     */
    async isAssignedForPeriod({ supabase, coupleIds, challengeId, cadence }) {
        const { startDate } = getPeriodRange(cadence);

        const { data, error } = await supabase
            .from('challenge_assignments')
            .select('challenge_id, period_end')
            .eq('user_a_id', coupleIds.user_a_id)
            .eq('user_b_id', coupleIds.user_b_id)
            .eq('cadence', cadence)
            .eq('period_start', startDate)
            .eq('challenge_id', challengeId)
            .maybeSingle();

        if (error) {
            console.warn('[Challenges] Failed to verify assignment:', error);
            return null;
        }

        return data;
    }

    /**
     * Auto-start challenges for assignments
     *
     * Creates active couple_challenges rows for assigned challenges that don't have them yet.
     *
     * @param {Object} params
     * @param {Object} params.supabase - Supabase client
     * @param {Object} params.coupleIds - { user_a_id, user_b_id }
     * @param {Array} params.assignments - Assignment rows
     * @returns {Promise<void>}
     */
    async ensureActiveForAssignments({ supabase, coupleIds, assignments }) {
        // Group assignments by period to batch process
        const grouped = new Map();

        for (const assignment of assignments || []) {
            const key = `${assignment.cadence}:${assignment.period_start}:${assignment.period_end}`;
            if (!grouped.has(key)) {
                grouped.set(key, {
                    cadence: assignment.cadence,
                    periodStart: assignment.period_start,
                    periodEnd: assignment.period_end,
                    challengeIds: [],
                });
            }
            grouped.get(key).challengeIds.push(assignment.challenge_id);
        }

        for (const group of grouped.values()) {
            const { challengeIds, periodStart, periodEnd } = group;
            if (!challengeIds.length) continue;

            const periodStartIso = getEtMidnightIso(periodStart);
            const periodEndIso = getEtMidnightIso(periodEnd);

            // Check which challenges already have active rows
            const { data: existing, error } = await supabase
                .from('couple_challenges')
                .select('challenge_id, expires_at')
                .eq('user_a_id', coupleIds.user_a_id)
                .eq('user_b_id', coupleIds.user_b_id)
                .in('challenge_id', challengeIds)
                .gt('expires_at', periodStartIso)
                .lte('expires_at', periodEndIso);

            if (error) {
                console.warn('[Challenges] Failed to check active challenges:', error);
                continue;
            }

            const existingIds = new Set((existing || []).map(row => row.challenge_id));
            const missing = challengeIds.filter(id => !existingIds.has(id));
            if (!missing.length) continue;

            // Create active rows for missing challenges
            const payload = missing.map((challengeId) => ({
                user_a_id: coupleIds.user_a_id,
                user_b_id: coupleIds.user_b_id,
                challenge_id: challengeId,
                status: 'active',
                current_progress: 0,
                expires_at: periodEndIso,
            }));

            const { error: insertError } = await supabase
                .from('couple_challenges')
                .insert(payload);

            if (insertError) {
                console.warn('[Challenges] Failed to auto-start challenges:', insertError);
            }
        }
    }
}

module.exports = AssignmentManager;
module.exports.CADENCE = CADENCE;
module.exports.RECENT_REPEAT_LIMITS = RECENT_REPEAT_LIMITS;
