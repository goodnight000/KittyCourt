/**
 * Translation Service
 *
 * Handles all i18n logic for challenges.
 *
 * Responsibilities:
 * - Load translations from database
 * - Apply translations to challenge definitions
 * - Transform challenge data to DTOs
 */

const { normalizeLanguage } = require('../language');

const DEFAULT_DURATION_DAYS = 7;

class TranslationService {
    /**
     * Load challenge translations from database
     *
     * @param {Object} supabase - Supabase client
     * @param {string[]} challengeIds - Challenge IDs to load translations for
     * @param {string} language - Target language code
     * @returns {Promise<Map>} - Map of challengeId → { language: translation }
     */
    async loadChallengeTranslations(supabase, challengeIds, language) {
        const ids = Array.isArray(challengeIds) ? challengeIds.filter(Boolean) : [];
        if (!ids.length) return new Map();

        const targetLanguage = normalizeLanguage(language) || 'en';

        const { data, error } = await supabase
            .from('challenges_translations')
            .select('challenge_id, language, name, description')
            .in('challenge_id', ids)
            .in('language', [targetLanguage, 'en']);

        if (error) {
            console.warn('[Challenges] Failed to load translations:', error);
            return new Map();
        }

        const map = new Map();
        for (const row of data || []) {
            if (!map.has(row.challenge_id)) {
                map.set(row.challenge_id, {});
            }
            map.get(row.challenge_id)[row.language] = row;
        }

        return map;
    }

    /**
     * Apply translation to a challenge definition
     *
     * @param {Object} definition - Challenge definition
     * @param {Map} translationMap - Translation map from loadChallengeTranslations
     * @param {string} language - Target language code
     * @returns {Object} - Translated challenge definition
     */
    applyChallengeTranslation(definition, translationMap, language) {
        if (!definition) return definition;

        const targetLanguage = normalizeLanguage(language) || 'en';
        const translations = translationMap.get(definition.id) || {};
        const translation = translations[targetLanguage] || translations.en;

        if (!translation) return definition;

        return {
            ...definition,
            name: translation.name || definition.name,
            description: translation.description || definition.description,
        };
    }

    /**
     * Transform challenge definition and row data to DTO
     *
     * @param {Object} definition - Challenge definition
     * @param {Object} row - Couple challenge row (optional)
     * @param {string} fallbackExpiresAt - Fallback expiration date (optional)
     * @returns {Object} - Challenge DTO
     */
    toChallengeDto(definition, row, fallbackExpiresAt) {
        const targetProgress = definition?.target_value || 0;
        const currentProgress = row?.current_progress || 0;
        const log = this._parseLog(row?.verification_log);
        const confirmRequest = this._getConfirmRequest(log);
        const confirmationStatus = row?.partner_confirmed_at
            ? 'confirmed'
            : row?.partner_confirm_requested_at
                ? 'pending'
                : 'none';

        return {
            id: definition?.id || row?.challenge_id,
            title: definition?.name || 'Challenge',
            description: definition?.description || '',
            emoji: definition?.emoji || '🎯',
            currentProgress: row?.status === 'completed' ? targetProgress : currentProgress,
            targetProgress,
            daysLeft: this._computeDaysLeft(row?.expires_at || fallbackExpiresAt),
            difficulty: definition?.difficulty || 'medium',
            rewardXP: definition?.reward_xp || 0,
            status: row?.status || 'available',
            requiresConfirmation: definition?.requires_partner_confirm || false,
            cadence: definition?.cadence || 'weekly',
            confirmationStatus,
            confirmRequestedBy: confirmRequest?.user_id || null,
            confirmRequestedAt: confirmRequest?.at || row?.partner_confirm_requested_at || null,
        };
    }

    /**
     * Compute days left until expiration
     *
     * @param {string} expiresAt - Expiration date
     * @returns {number} - Days left (minimum 0)
     * @private
     */
    _computeDaysLeft(expiresAt) {
        if (!expiresAt) return DEFAULT_DURATION_DAYS;

        const now = Date.now();
        const end = new Date(expiresAt).getTime();
        const diffDays = Math.ceil((end - now) / (1000 * 60 * 60 * 24));

        return Math.max(diffDays, 0);
    }

    /**
     * Parse verification log
     *
     * @param {Array|string|null} log - Verification log
     * @returns {Array} - Parsed log array
     * @private
     */
    _parseLog(log) {
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
     * @private
     */
    _getConfirmRequest(log) {
        for (let i = log.length - 1; i >= 0; i -= 1) {
            if (log[i]?.type === 'confirm_request') return log[i];
        }
        return null;
    }
}

module.exports = TranslationService;
