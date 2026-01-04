/**
 * Challenge Service - Handles challenge retrieval and lifecycle
 *
 * Refactored in Phase 2.2 to use service classes:
 * - TranslationService: i18n logic
 * - ProgressCalculator: pure progress computation
 * - AssignmentManager: assignment and period management
 * - ChallengeRepository: database CRUD
 * - ChallengeLifecycleController: orchestrate lifecycle
 */

const { getSupabase, isSupabaseConfigured } = require('./supabase');
const { getOrderedCoupleIds, isXPSystemEnabled, getLevelStatus } = require('./xpService');

// Import service classes
const TranslationService = require('./challenges/TranslationService');
const ProgressCalculator = require('./challenges/ProgressCalculator');
const AssignmentManager = require('./challenges/AssignmentManager');
const ChallengeRepository = require('./challenges/ChallengeRepository');
const ChallengeLifecycleController = require('./challenges/ChallengeLifecycleController');

// Re-export constants
const CHALLENGE_ACTIONS = {
    DAILY_QUESTION: 'daily_question_answer',
    APPRECIATION: 'appreciation_given',
    MOOD_CHECKIN: 'mood_checkin',
    MEMORY_UPLOAD: 'memory_upload',
    CASE_RESOLVED: 'case_resolved',
    CALENDAR_EVENT: 'calendar_event',
};

const { CADENCE } = AssignmentManager;

// Initialize services
const translationService = new TranslationService();
const progressCalculator = new ProgressCalculator();
const assignmentManager = new AssignmentManager();
const challengeRepository = new ChallengeRepository();
const lifecycleController = new ChallengeLifecycleController(
    assignmentManager,
    challengeRepository,
    progressCalculator,
    translationService
);

/**
 * Fetch challenges for a couple
 *
 * @param {Object} params
 * @param {string} params.userId - User ID
 * @param {string} params.partnerId - Partner ID
 * @param {string} params.language - Language code (default: 'en')
 * @returns {Promise<Object>} - { active, available, completed, enabled } or { error }
 */
const fetchChallenges = async ({ userId, partnerId, language = 'en' }) => {
    if (!isXPSystemEnabled()) {
        return { active: [], available: [], completed: [], enabled: false };
    }

    if (!isSupabaseConfigured()) {
        return { error: 'supabase_not_configured' };
    }

    const coupleIds = getOrderedCoupleIds(userId, partnerId);
    if (!coupleIds) {
        return { error: 'invalid_couple' };
    }

    // Check level requirement (challenges unlock at level 5)
    const levelResult = await getLevelStatus(userId, partnerId);
    const currentLevel = levelResult?.data?.level || 1;
    if (currentLevel < 5) {
        return { active: [], available: [], completed: [], enabled: true };
    }

    const supabase = getSupabase();

    // Ensure assignments for current period
    const dailyAssignments = await assignmentManager.ensureAssignments({
        supabase,
        coupleIds,
        cadence: CADENCE.DAILY,
        count: 1,
    });

    const weeklyAssignments = await assignmentManager.ensureAssignments({
        supabase,
        coupleIds,
        cadence: CADENCE.WEEKLY,
        count: 2,
    });

    const assignments = [
        ...(dailyAssignments.assignments || []),
        ...(weeklyAssignments.assignments || []),
    ];

    const assignedIds = assignments.map((row) => row.challenge_id);
    if (assignedIds.length === 0) {
        return { active: [], available: [], completed: [], enabled: true };
    }

    // Auto-start challenges for assignments
    await assignmentManager.ensureActiveForAssignments({
        supabase,
        coupleIds,
        assignments,
    });

    // Fetch challenge definitions
    const { data: definitions, error: definitionsError } = await challengeRepository.getChallengeDefinitions(
        supabase,
        assignedIds
    );

    if (definitionsError) {
        return { error: definitionsError.message };
    }

    // Fetch couple progress rows
    const { data: coupleRows, error: coupleError } = await challengeRepository.getCoupleChallenges(
        supabase,
        coupleIds,
        assignedIds
    );

    if (coupleError) {
        return { error: coupleError.message };
    }

    // Load translations and build definition map
    const translationMap = await translationService.loadChallengeTranslations(supabase, assignedIds, language);
    const definitionMap = new Map();
    (definitions || []).forEach(def => {
        definitionMap.set(def.id, translationService.applyChallengeTranslation(def, translationMap, language));
    });

    // Categorize challenges
    const active = [];
    const completed = [];
    const blockedIds = new Set();
    const now = new Date();

    (coupleRows || []).forEach(row => {
        const def = definitionMap.get(row.challenge_id);
        if (!def) return;

        if (row.status === 'active') {
            // Check expiration
            if (row.expires_at && new Date(row.expires_at) <= now) {
                supabase
                    .from('couple_challenges')
                    .update({ status: 'expired' })
                    .eq('id', row.id)
                    .then(() => {})
                    .catch(() => {});
                return;
            }
            active.push(translationService.toChallengeDto(def, row));
            blockedIds.add(row.challenge_id);
            return;
        }

        if (row.status === 'completed') {
            completed.push(translationService.toChallengeDto(def, row));
            blockedIds.add(row.challenge_id);
            return;
        }

        if (row.status === 'skipped') {
            if (row.expires_at && new Date(row.expires_at) > new Date()) {
                blockedIds.add(row.challenge_id);
            }
            return;
        }
    });

    return { active, available: [], completed, enabled: true };
};

/**
 * Start a challenge
 *
 * @param {Object} params
 * @param {string} params.userId - User ID
 * @param {string} params.partnerId - Partner ID
 * @param {string} params.challengeId - Challenge ID
 * @param {string} params.language - Language code (default: 'en')
 * @returns {Promise<Object>} - { challenge } or { error }
 */
const startChallenge = async ({ userId, partnerId, challengeId, language = 'en' }) => {
    if (!isXPSystemEnabled()) {
        return { error: 'feature_disabled' };
    }

    if (!isSupabaseConfigured()) {
        return { error: 'supabase_not_configured' };
    }

    const coupleIds = getOrderedCoupleIds(userId, partnerId);
    if (!coupleIds) {
        return { error: 'invalid_couple' };
    }

    const supabase = getSupabase();

    return lifecycleController.startChallenge({
        supabase,
        coupleIds,
        challengeId,
        language,
    });
};

/**
 * Skip a challenge
 *
 * @param {Object} params
 * @param {string} params.userId - User ID
 * @param {string} params.partnerId - Partner ID
 * @param {string} params.challengeId - Challenge ID
 * @param {string} params.language - Language code (unused but kept for API compatibility)
 * @returns {Promise<Object>} - { success } or { error }
 */
const skipChallenge = async ({ userId, partnerId, challengeId, language = 'en' }) => {
    if (!isXPSystemEnabled()) {
        return { error: 'feature_disabled' };
    }

    if (!isSupabaseConfigured()) {
        return { error: 'supabase_not_configured' };
    }

    const coupleIds = getOrderedCoupleIds(userId, partnerId);
    if (!coupleIds) {
        return { error: 'invalid_couple' };
    }

    const supabase = getSupabase();

    return lifecycleController.skipChallenge({
        supabase,
        coupleIds,
        challengeId,
    });
};

/**
 * Record a challenge action
 *
 * @param {Object} params
 * @param {string} params.userId - User ID performing action
 * @param {string} params.partnerId - Partner ID
 * @param {string} params.action - Action type (from CHALLENGE_ACTIONS)
 * @param {string} params.sourceId - Source ID (optional)
 * @returns {Promise<Object>} - { success } or { error }
 */
const recordChallengeAction = async ({ userId, partnerId, action, sourceId }) => {
    if (!isXPSystemEnabled() || !action) {
        return { success: false, skipped: true };
    }

    if (!isSupabaseConfigured()) {
        return { error: 'supabase_not_configured' };
    }

    const coupleIds = getOrderedCoupleIds(userId, partnerId);
    if (!coupleIds) {
        return { error: 'invalid_couple' };
    }

    // Check level requirement
    const levelResult = await getLevelStatus(userId, partnerId);
    const currentLevel = levelResult?.data?.level || 1;
    if (currentLevel < 5) {
        return { success: false, skipped: true, reason: 'level_locked' };
    }

    const supabase = getSupabase();

    // Ensure assignments exist
    const dailyAssignments = await assignmentManager.ensureAssignments({
        supabase,
        coupleIds,
        cadence: CADENCE.DAILY,
        count: 1,
    });

    const weeklyAssignments = await assignmentManager.ensureAssignments({
        supabase,
        coupleIds,
        cadence: CADENCE.WEEKLY,
        count: 2,
    });

    await assignmentManager.ensureActiveForAssignments({
        supabase,
        coupleIds,
        assignments: [
            ...(dailyAssignments.assignments || []),
            ...(weeklyAssignments.assignments || []),
        ],
    });

    // Record action
    return lifecycleController.recordChallengeAction({
        supabase,
        coupleIds,
        userId,
        action,
        sourceId,
    });
};

/**
 * Request challenge completion confirmation
 *
 * @param {Object} params
 * @param {string} params.userId - User requesting confirmation
 * @param {string} params.partnerId - Partner ID
 * @param {string} params.challengeId - Challenge ID
 * @returns {Promise<Object>} - { success, pending } or { error }
 */
const requestChallengeCompletion = async ({ userId, partnerId, challengeId }) => {
    if (!isXPSystemEnabled()) {
        return { error: 'feature_disabled' };
    }

    if (!isSupabaseConfigured()) {
        return { error: 'supabase_not_configured' };
    }

    const coupleIds = getOrderedCoupleIds(userId, partnerId);
    if (!coupleIds) {
        return { error: 'invalid_couple' };
    }

    const supabase = getSupabase();

    return lifecycleController.requestChallengeCompletion({
        supabase,
        coupleIds,
        userId,
        challengeId,
    });
};

/**
 * Confirm challenge completion
 *
 * @param {Object} params
 * @param {string} params.userId - User confirming (must be partner)
 * @param {string} params.partnerId - Partner ID
 * @param {string} params.challengeId - Challenge ID
 * @returns {Promise<Object>} - { success } or { error }
 */
const confirmChallengeCompletion = async ({ userId, partnerId, challengeId }) => {
    if (!isXPSystemEnabled()) {
        return { error: 'feature_disabled' };
    }

    if (!isSupabaseConfigured()) {
        return { error: 'supabase_not_configured' };
    }

    const coupleIds = getOrderedCoupleIds(userId, partnerId);
    if (!coupleIds) {
        return { error: 'invalid_couple' };
    }

    const supabase = getSupabase();

    return lifecycleController.confirmChallengeCompletion({
        supabase,
        coupleIds,
        userId,
        challengeId,
    });
};

module.exports = {
    CHALLENGE_ACTIONS,
    fetchChallenges,
    startChallenge,
    skipChallenge,
    recordChallengeAction,
    requestChallengeCompletion,
    confirmChallengeCompletion,
};
