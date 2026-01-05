/**
 * Verification Log Utilities
 *
 * Shared utilities for parsing and querying verification logs.
 * Used by ProgressCalculator and TranslationService.
 */

/**
 * Parse verification log
 *
 * @param {Array|string|null} log - Verification log
 * @returns {Array} - Parsed log array
 */
function parseLog(log) {
    if (Array.isArray(log)) return log;
    if (!log) return [];

    try {
        const parsed = typeof log === 'string' ? JSON.parse(log) : log;
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

/**
 * Get latest confirm request from log
 *
 * @param {Array} log - Verification log
 * @returns {Object|null} - Confirm request entry or null
 */
function getConfirmRequest(log) {
    for (let i = log.length - 1; i >= 0; i -= 1) {
        if (log[i]?.type === 'confirm_request') return log[i];
    }
    return null;
}

module.exports = { parseLog, getConfirmRequest };
