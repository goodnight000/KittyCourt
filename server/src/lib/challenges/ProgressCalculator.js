/**
 * Progress Calculator
 *
 * Pure computation service for challenge progress tracking.
 * NO database access - only math and logic.
 *
 * Responsibilities:
 * - Parse verification logs
 * - Compute count-based progress
 * - Compute streak-based progress
 * - Extract confirmation requests
 */

const { parseLog, getConfirmRequest } = require('./verificationLogUtils');

class ProgressCalculator {
    /**
     * Parse verification log
     *
     * @param {Array|string|null} log - Verification log
     * @returns {Array} - Parsed log array
     */
    parseLog(log) {
        return parseLog(log);
    }

    /**
     * Get unique action entries from log
     *
     * Deduplicates entries by user_id and source_id (or timestamp if no source_id)
     *
     * @param {Array} log - Verification log
     * @param {string} action - Action type to filter
     * @returns {Array} - Unique action entries
     */
    getUniqueActions(log, action) {
        const seen = new Set();
        const entries = [];

        for (const entry of log) {
            if (entry?.type !== 'action' || entry?.action !== action) continue;

            const key = `${entry.user_id || 'unknown'}:${entry.source_id || entry.at || ''}`;
            if (seen.has(key)) continue;

            seen.add(key);
            entries.push(entry);
        }

        return entries;
    }

    /**
     * Compute count-based progress
     *
     * @param {Array} log - Verification log
     * @param {string} action - Action type to count
     * @param {Object} coupleIds - { user_a_id, user_b_id }
     * @param {boolean} perPartner - If true, return min of both partners; otherwise sum
     * @returns {number} - Progress count
     */
    computeCountProgress(log, action, coupleIds, perPartner) {
        const entries = this.getUniqueActions(log, action);
        const counts = {
            [coupleIds.user_a_id]: 0,
            [coupleIds.user_b_id]: 0,
        };

        for (const entry of entries) {
            if (entry.user_id && counts[entry.user_id] !== undefined) {
                counts[entry.user_id] += 1;
            }
        }

        if (perPartner) {
            // Return minimum - both partners must meet target
            return Math.min(counts[coupleIds.user_a_id], counts[coupleIds.user_b_id]);
        }

        // Return sum - combined progress
        return counts[coupleIds.user_a_id] + counts[coupleIds.user_b_id];
    }

    /**
     * Compute streak-based progress
     *
     * Calculates consecutive days of actions by the couple.
     *
     * @param {Array} log - Verification log
     * @param {string} action - Action type to count
     * @param {Object} coupleIds - { user_a_id, user_b_id }
     * @param {boolean} requireBoth - If true, both partners must act on same day; otherwise either
     * @returns {number} - Streak count (consecutive days)
     */
    computeStreakProgress(log, action, coupleIds, requireBoth) {
        const entries = this.getUniqueActions(log, action);
        const daysByUser = {
            [coupleIds.user_a_id]: new Set(),
            [coupleIds.user_b_id]: new Set(),
        };

        // Group actions by user and day
        for (const entry of entries) {
            if (!entry.user_id || !entry.day_et || !daysByUser[entry.user_id]) continue;
            daysByUser[entry.user_id].add(entry.day_et);
        }

        // Determine eligible days based on requireBoth
        let eligibleDays = new Set();
        if (requireBoth) {
            // Only days where BOTH partners acted
            for (const day of daysByUser[coupleIds.user_a_id]) {
                if (daysByUser[coupleIds.user_b_id].has(day)) {
                    eligibleDays.add(day);
                }
            }
        } else {
            // Any day where EITHER partner acted
            eligibleDays = new Set([
                ...daysByUser[coupleIds.user_a_id],
                ...daysByUser[coupleIds.user_b_id],
            ]);
        }

        // Calculate streak from most recent day backwards
        const orderedDays = Array.from(eligibleDays).sort((a, b) => b.localeCompare(a));
        if (orderedDays.length === 0) return 0;

        let streak = 1;
        for (let i = 1; i < orderedDays.length; i += 1) {
            const prev = new Date(`${orderedDays[i - 1]}T00:00:00Z`);
            const curr = new Date(`${orderedDays[i]}T00:00:00Z`);
            const diffDays = Math.round((prev - curr) / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                streak += 1;
            } else {
                break; // Streak broken
            }
        }

        return streak;
    }

    /**
     * Get latest confirm request from log
     *
     * @param {Array} log - Verification log
     * @returns {Object|null} - Confirm request entry or null
     */
    getConfirmRequest(log) {
        return getConfirmRequest(log);
    }
}

module.exports = ProgressCalculator;
