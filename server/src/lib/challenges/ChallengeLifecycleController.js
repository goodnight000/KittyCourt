/**
 * Challenge Lifecycle Controller
 *
 * Orchestrates challenge lifecycle operations.
 *
 * Responsibilities:
 * - Start challenges
 * - Skip challenges
 * - Record challenge actions
 * - Request and confirm challenge completion
 * - Award XP for completions
 */

const { getPeriodRange, getEtMidnightIso, getStreakDayEt } = require('../shared/dateTimeUtils');
const { awardXP, ACTION_TYPES } = require('../xpService');
const { CADENCE } = require('./AssignmentManager');

class ChallengeLifecycleController {
    /**
     * Create a new lifecycle controller
     *
     * @param {AssignmentManager} assignmentManager
     * @param {ChallengeRepository} repository
     * @param {ProgressCalculator} progressCalculator
     * @param {TranslationService} translationService
     */
    constructor(assignmentManager, repository, progressCalculator, translationService) {
        this.assignmentManager = assignmentManager;
        this.repository = repository;
        this.progressCalculator = progressCalculator;
        this.translationService = translationService;
    }

    /**
     * Start a challenge
     *
     * @param {Object} params
     * @param {Object} params.supabase - Supabase client
     * @param {Object} params.coupleIds - { user_a_id, user_b_id }
     * @param {string} params.challengeId - Challenge ID to start
     * @param {string} params.language - Language code
     * @returns {Promise<Object>} - { challenge: Object } or { error: string }
     */
    async startChallenge({ supabase, coupleIds, challengeId, language }) {
        // Fetch challenge definition
        const { data: definition, error: definitionError } = await this.repository.getChallengeDefinition(
            supabase,
            challengeId
        );

        if (definitionError || !definition) {
            return { error: 'challenge_not_found' };
        }

        // Verify assignment for current period
        const cadence = definition?.cadence || CADENCE.WEEKLY;
        const assignment = await this.assignmentManager.isAssignedForPeriod({
            supabase,
            coupleIds,
            challengeId,
            cadence,
        });

        if (!assignment) {
            return { error: 'challenge_not_assigned' };
        }

        // Check if already active
        const { data: existing, error: existingError } = await this.repository.getCoupleChallengeByIdAndStatus(
            supabase,
            coupleIds,
            challengeId,
            'active'
        );

        if (existingError) {
            return { error: existingError.message };
        }

        if (existing) {
            // Already started - return existing
            const translationMap = await this.translationService.loadChallengeTranslations(
                supabase,
                [definition?.id],
                language
            );
            const translated = this.translationService.applyChallengeTranslation(
                definition,
                translationMap,
                language
            );
            return { challenge: this.translationService.toChallengeDto(translated, existing) };
        }

        // Create new active challenge
        const periodEnd = assignment.period_end || getPeriodRange(cadence).endDate;
        const expiresAt = getEtMidnightIso(periodEnd);

        const { data: created, error: insertError } = await this.repository.createCoupleChallenge(supabase, {
            user_a_id: coupleIds.user_a_id,
            user_b_id: coupleIds.user_b_id,
            challenge_id: challengeId,
            status: 'active',
            current_progress: 0,
            expires_at: expiresAt,
        });

        if (insertError) {
            return { error: insertError.message };
        }

        // Return translated DTO
        const translationMap = await this.translationService.loadChallengeTranslations(
            supabase,
            [definition?.id],
            language
        );
        const translated = this.translationService.applyChallengeTranslation(
            definition,
            translationMap,
            language
        );
        return { challenge: this.translationService.toChallengeDto(translated, created) };
    }

    /**
     * Skip a challenge
     *
     * @param {Object} params
     * @param {Object} params.supabase - Supabase client
     * @param {Object} params.coupleIds - { user_a_id, user_b_id }
     * @param {string} params.challengeId - Challenge ID to skip
     * @returns {Promise<Object>} - { success: boolean } or { error: string }
     */
    async skipChallenge({ supabase, coupleIds, challengeId }) {
        // Fetch challenge definition
        const { data: definition, error: definitionError } = await this.repository.getChallengeDefinition(
            supabase,
            challengeId
        );

        if (definitionError || !definition) {
            return { error: 'challenge_not_found' };
        }

        // Verify assignment for current period
        const cadence = definition?.cadence || CADENCE.WEEKLY;
        const assignment = await this.assignmentManager.isAssignedForPeriod({
            supabase,
            coupleIds,
            challengeId,
            cadence,
        });

        if (!assignment) {
            return { error: 'challenge_not_assigned' };
        }

        // Check if active
        const { data: activeRow, error: activeError } = await this.repository.getCoupleChallengeByIdAndStatus(
            supabase,
            coupleIds,
            challengeId,
            'active'
        );

        if (activeError) {
            return { error: activeError.message };
        }

        const periodEnd = assignment.period_end || getPeriodRange(cadence).endDate;
        const expiresAt = getEtMidnightIso(periodEnd);

        if (activeRow) {
            // Update active to skipped
            const { error: updateError } = await this.repository.updateChallengeStatusWithExpiration(
                supabase,
                activeRow.id,
                'skipped',
                expiresAt
            );

            if (updateError) {
                return { error: updateError.message };
            }

            return { success: true };
        }

        // Create skipped row
        const { error: insertError } = await this.repository.createCoupleChallengeNoReturn(supabase, {
            user_a_id: coupleIds.user_a_id,
            user_b_id: coupleIds.user_b_id,
            challenge_id: challengeId,
            status: 'skipped',
            current_progress: 0,
            expires_at: expiresAt,
        });

        if (insertError) {
            return { error: insertError.message };
        }

        return { success: true };
    }

    /**
     * Record a challenge action
     *
     * Updates progress for all active challenges that match the action.
     *
     * @param {Object} params
     * @param {Object} params.supabase - Supabase client
     * @param {Object} params.coupleIds - { user_a_id, user_b_id }
     * @param {string} params.userId - User performing action
     * @param {string} params.action - Action type
     * @param {string} params.sourceId - Source ID (optional)
     * @returns {Promise<Object>} - { success: boolean } or { error: string }
     */
    async recordChallengeAction({ supabase, coupleIds, userId, action, sourceId }) {
        const now = new Date();

        // Fetch all active challenges with definitions
        const { data: rows, error } = await this.repository.getActiveCoupleChallengesWithDefinitions(
            supabase,
            coupleIds
        );

        if (error) {
            return { error: error.message };
        }

        if (!rows || rows.length === 0) {
            return { success: true };
        }

        // Process each matching challenge
        for (const row of rows) {
            const definition = row?.challenges;
            const config = definition?.verification_config || {};

            // Skip if action doesn't match
            if (config.action !== action) continue;

            // Skip behavioral challenges (not auto-tracked)
            if (config.type === 'behavioral') continue;

            // Check expiration
            if (row.expires_at && new Date(row.expires_at) <= now) {
                await this.repository.markChallengeStatus(supabase, row.id, 'expired');
                continue;
            }

            // Parse log and check for duplicate entry
            const log = this.progressCalculator.parseLog(row.verification_log);
            const dayEt = getStreakDayEt(now);
            const hasEntry = log.some(
                entry =>
                    entry?.type === 'action' &&
                    entry?.action === action &&
                    entry?.user_id === userId &&
                    (sourceId ? entry?.source_id === sourceId : entry?.day_et === dayEt)
            );

            if (!hasEntry) {
                log.push({
                    type: 'action',
                    action,
                    user_id: userId,
                    source_id: sourceId || null,
                    at: now.toISOString(),
                    day_et: dayEt,
                });
            }

            // Compute progress
            let progress = row.current_progress || 0;
            const target = definition?.target_value || config.min_count || config.days || 0;

            if (config.type === 'count' || config.type === 'milestone') {
                progress = this.progressCalculator.computeCountProgress(
                    log,
                    action,
                    coupleIds,
                    !!config.per_partner
                );
            } else if (config.type === 'streak') {
                progress = this.progressCalculator.computeStreakProgress(
                    log,
                    action,
                    coupleIds,
                    !!config.require_both
                );
            }

            // Prepare update payload
            const updatePayload = {
                current_progress: Math.min(progress, target || progress),
                verification_log: log,
            };

            // Check for completion
            if (target > 0 && progress >= target) {
                if (definition?.requires_partner_confirm) {
                    // Request confirmation if not already requested
                    if (!row.partner_confirm_requested_at) {
                        updatePayload.partner_confirm_requested_at = now.toISOString();
                        log.push({
                            type: 'confirm_request',
                            user_id: userId,
                            at: now.toISOString(),
                        });
                        updatePayload.verification_log = log;
                    }
                } else if (row.status !== 'completed') {
                    // Auto-complete
                    updatePayload.status = 'completed';
                    updatePayload.completed_at = now.toISOString();
                }
            }

            // Update challenge
            const { data: updated, error: updateError } = await this.repository.updateChallengeProgress(
                supabase,
                row.id,
                updatePayload
            );

            // Award XP if completed
            if (!updateError && updatePayload.status === 'completed' && updated) {
                await this.handleChallengeCompletion({
                    supabase,
                    coupleIds,
                    challengeId: definition?.id,
                    coupleChallengeId: row.id,
                    rewardXP: definition?.reward_xp || 0,
                    difficulty: definition?.difficulty || 'medium',
                    userId,
                });
            }
        }

        return { success: true };
    }

    /**
     * Request challenge completion confirmation
     *
     * @param {Object} params
     * @param {Object} params.supabase - Supabase client
     * @param {Object} params.coupleIds - { user_a_id, user_b_id }
     * @param {string} params.userId - User requesting confirmation
     * @param {string} params.challengeId - Challenge ID
     * @returns {Promise<Object>} - { success: boolean, pending: boolean } or { error: string }
     */
    async requestChallengeCompletion({ supabase, coupleIds, userId, challengeId }) {
        const { data: row, error } = await this.repository.getCoupleChallengeByIdAndStatus(
            supabase,
            coupleIds,
            challengeId,
            'active'
        );

        if (error || !row) {
            return { error: 'challenge_not_active' };
        }

        const definition = row?.challenges;
        if (!definition?.requires_partner_confirm) {
            return { error: 'confirmation_not_required' };
        }

        if (row.partner_confirm_requested_at) {
            return { success: true, pending: true };
        }

        // Add confirm request to log
        const log = this.progressCalculator.parseLog(row.verification_log);
        log.push({
            type: 'confirm_request',
            user_id: userId,
            at: new Date().toISOString(),
        });

        const { error: updateError } = await this.repository.updateChallengeConfirmation(supabase, row.id, {
            partner_confirm_requested_at: new Date().toISOString(),
            verification_log: log,
        });

        if (updateError) {
            return { error: updateError.message };
        }

        return { success: true, pending: true };
    }

    /**
     * Confirm challenge completion
     *
     * @param {Object} params
     * @param {Object} params.supabase - Supabase client
     * @param {Object} params.coupleIds - { user_a_id, user_b_id }
     * @param {string} params.userId - User confirming (must be partner)
     * @param {string} params.challengeId - Challenge ID
     * @returns {Promise<Object>} - { success: boolean } or { error: string }
     */
    async confirmChallengeCompletion({ supabase, coupleIds, userId, challengeId }) {
        const { data: row, error } = await this.repository.getCoupleChallengeByIdAndStatus(
            supabase,
            coupleIds,
            challengeId,
            'active'
        );

        if (error || !row) {
            return { error: 'challenge_not_active' };
        }

        if (!row.partner_confirm_requested_at) {
            return { error: 'no_pending_confirmation' };
        }

        const definition = row?.challenges;
        const log = this.progressCalculator.parseLog(row.verification_log);
        const confirmRequest = this.progressCalculator.getConfirmRequest(log);

        // Prevent self-confirmation
        if (confirmRequest?.user_id === userId) {
            return { error: 'cannot_confirm_own_request' };
        }

        // Mark as completed
        const { error: updateError } = await this.repository.updateChallengeConfirmation(supabase, row.id, {
            status: 'completed',
            completed_at: new Date().toISOString(),
            partner_confirmed_at: new Date().toISOString(),
            current_progress: definition?.target_value || row.current_progress,
            verification_log: log,
        });

        if (updateError) {
            return { error: updateError.message };
        }

        // Award XP
        await this.handleChallengeCompletion({
            supabase,
            coupleIds,
            challengeId: definition?.id,
            coupleChallengeId: row.id,
            rewardXP: definition?.reward_xp || 0,
            difficulty: definition?.difficulty || 'medium',
            userId,
        });

        return { success: true };
    }

    /**
     * Handle challenge completion - award XP
     *
     * @param {Object} params
     * @returns {Promise<Object>}
     * @private
     */
    async handleChallengeCompletion({
        supabase,
        coupleIds,
        challengeId,
        coupleChallengeId,
        rewardXP,
        difficulty,
        userId,
    }) {
        if (!rewardXP) return { success: true, skipped: true };

        const completionSourceId = coupleChallengeId || challengeId;
        const idempotencyKeyOverride = `challenge_completion:${coupleIds.user_a_id}:${coupleIds.user_b_id}:${completionSourceId}`;

        // Check for existing XP transaction
        const { data: existing, error } = await supabase
            .from('xp_transactions')
            .select('id')
            .eq('action_type', ACTION_TYPES.CHALLENGE_COMPLETION)
            .eq('source_id', completionSourceId)
            .maybeSingle();

        if (error) {
            console.warn('[Challenges] XP lookup failed:', error);
        }

        if (existing) return { success: true, skipped: true };

        // Award XP
        return awardXP({
            userId,
            partnerId: userId === coupleIds.user_a_id ? coupleIds.user_b_id : coupleIds.user_a_id,
            actionType: ACTION_TYPES.CHALLENGE_COMPLETION,
            sourceId: completionSourceId,
            difficulty,
            xpOverride: rewardXP,
            idempotencyKeyOverride,
        });
    }
}

module.exports = ChallengeLifecycleController;
