/**
 * XP Service - Experience point management
 * 
 * Phase 1B: Feature-flagged implementation
 *
 * Uses server-side Supabase (service role) for idempotent awards.
 * 
 * Feature Flag: process.env.XP_SYSTEM_ENABLED === 'true' (default: false)
 */

const { getSupabase, isSupabaseConfigured } = require('./supabase');

// ============================================
// CONSTANTS (Junior owns)
// ============================================

const ACTION_TYPES = {
    DAILY_QUESTION: 'daily_question',
    APPRECIATION: 'appreciation',
    CASE_RESOLUTION: 'case_resolution',
    MEMORY_UPLOAD: 'memory_upload',
    MOOD_CHECKIN: 'mood_checkin',
    CALENDAR_EVENT: 'calendar_event',
    CHALLENGE_COMPLETION: 'challenge_completion',
};

const XP_VALUES = {
    [ACTION_TYPES.DAILY_QUESTION]: 50,
    [ACTION_TYPES.APPRECIATION]: 30,
    [ACTION_TYPES.CASE_RESOLUTION]: 100,
    [ACTION_TYPES.MEMORY_UPLOAD]: 25,
    [ACTION_TYPES.MOOD_CHECKIN]: 20,
    [ACTION_TYPES.CALENDAR_EVENT]: 15,
    [ACTION_TYPES.CHALLENGE_COMPLETION]: { easy: 50, medium: 100, hard: 200 },
};

const DAILY_CAPS = {
    [ACTION_TYPES.DAILY_QUESTION]: 50,
    [ACTION_TYPES.APPRECIATION]: 90,
    [ACTION_TYPES.CASE_RESOLUTION]: 100,
    [ACTION_TYPES.MEMORY_UPLOAD]: 50,
    [ACTION_TYPES.MOOD_CHECKIN]: 20,
    [ACTION_TYPES.CALENDAR_EVENT]: 30,
};

const QUALITY_REQUIREMENTS = {
    [ACTION_TYPES.DAILY_QUESTION]: { minLength: 20 },
    [ACTION_TYPES.APPRECIATION]: { minLength: 10, maxPerDay: 3 },
};

// Level titles and XP thresholds (must match client config)
const LEVEL_CONFIG = [
    { level: 1, xpRequired: 0, title: 'Curious Kittens' },
    { level: 2, xpRequired: 100, title: 'Playful Paws' },
    { level: 3, xpRequired: 250, title: 'Snuggle Buddies' },
    { level: 5, xpRequired: 700, title: 'Cozy Companions' },
    { level: 7, xpRequired: 1200, title: 'Cuddle Champions' },
    { level: 10, xpRequired: 3000, title: 'Purr-fect Partners' },
    { level: 15, xpRequired: 7500, title: 'Soulmates' },
    { level: 20, xpRequired: 15000, title: 'Legendary Bond' },
    { level: 30, xpRequired: 35000, title: 'Eternal Flame' },
    { level: 50, xpRequired: 100000, title: 'Cat Royalty 👑' },
];

// ============================================
// HELPER FUNCTIONS (Junior owns)
// ============================================

/**
 * Check if feature flag is enabled
 */
function isXPSystemEnabled() {
    return process.env.XP_SYSTEM_ENABLED === 'true';
}

/**
 * Normalize action type input to canonical value
 */
function normalizeActionType(actionType) {
    if (!actionType) return null;

    if (Object.values(ACTION_TYPES).includes(actionType)) {
        return actionType;
    }

    const upper = String(actionType).toUpperCase();
    return ACTION_TYPES[upper] || null;
}

/**
 * Validate content quality requirements
 */
function meetsQualityRequirements(actionType, content) {
    const requirements = QUALITY_REQUIREMENTS[actionType];
    if (!requirements) return true;

    if (requirements.minLength && (!content || content.length < requirements.minLength)) {
        return false;
    }

    return true;
}

/**
 * Get the ET date parts for a given date
 */
function getEtDateParts(date = new Date()) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    const parts = formatter.formatToParts(date);
    const values = {};
    for (const part of parts) {
        if (part.type !== 'literal') {
            values[part.type] = part.value;
        }
    }

    return {
        year: Number(values.year),
        month: Number(values.month),
        day: Number(values.day),
    };
}

/**
 * Get timezone offset (in minutes) for a specific date
 */
function getTimeZoneOffsetMinutes(date, timeZone) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
    const parts = formatter.formatToParts(date);
    const values = {};
    for (const part of parts) {
        if (part.type !== 'literal') {
            values[part.type] = part.value;
        }
    }
    const asUtc = Date.UTC(
        Number(values.year),
        Number(values.month) - 1,
        Number(values.day),
        Number(values.hour),
        Number(values.minute),
        Number(values.second)
    );

    return (asUtc - date.getTime()) / 60000;
}

/**
 * Get ET day range for queries
 */
function getEtDayRange(date = new Date()) {
    const { year, month, day } = getEtDateParts(date);
    const utcMidnight = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    const offsetMinutes = getTimeZoneOffsetMinutes(utcMidnight, 'America/New_York');
    const start = new Date(utcMidnight.getTime() - offsetMinutes * 60000);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    const dateString = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    return {
        startIso: start.toISOString(),
        endIso: end.toISOString(),
        dateString,
    };
}

/**
 * Generate idempotency key
 * Format: {action_type}:{source_id}:{user_id}:{date_et}
 * 
 * Uses ET date to align with daily caps and streak logic
 */
function generateIdempotencyKey(actionType, sourceId, userId, dateString) {
    return `${actionType}:${sourceId}:${userId}:${dateString}`;
}

/**
 * Get ordered couple IDs (matches get_couple_ids SQL function)
 */
function getOrderedCoupleIds(userId, partnerId) {
    if (!userId || !partnerId) return null;

    if (userId < partnerId) {
        return { user_a_id: userId, user_b_id: partnerId };
    }
    return { user_a_id: partnerId, user_b_id: userId };
}

/**
 * Get level info from total XP
 */
function getLevelInfo(totalXP) {
    let currentLevel = LEVEL_CONFIG[0];
    let nextLevel = LEVEL_CONFIG[1];

    for (let i = 0; i < LEVEL_CONFIG.length; i++) {
        if (totalXP >= LEVEL_CONFIG[i].xpRequired) {
            currentLevel = LEVEL_CONFIG[i];
            nextLevel = LEVEL_CONFIG[i + 1] || null;
        }
    }

    return {
        level: currentLevel.level,
        title: currentLevel.title,
        currentXP: totalXP - currentLevel.xpRequired,
        xpForNextLevel: nextLevel
            ? nextLevel.xpRequired - currentLevel.xpRequired
            : 0,
        totalXP,
    };
}

/**
 * Ensure couple_levels row exists (best-effort)
 */
async function ensureCoupleLevel(supabase, coupleIds) {
    const { user_a_id, user_b_id } = coupleIds;
    const { data: existing, error: fetchError } = await supabase
        .from('couple_levels')
        .select('total_xp, current_level')
        .eq('user_a_id', user_a_id)
        .eq('user_b_id', user_b_id)
        .maybeSingle();

    if (fetchError) {
        console.warn('[XPService] Failed to fetch couple_levels:', fetchError);
        return null;
    }

    if (existing) {
        return existing;
    }

    const { data: created, error: insertError } = await supabase
        .from('couple_levels')
        .insert({
            user_a_id,
            user_b_id,
            total_xp: 0,
            current_level: 1,
        })
        .select('total_xp, current_level')
        .single();

    if (insertError) {
        console.warn('[XPService] Failed to create couple_levels row:', insertError);
        return null;
    }

    return created;
}

// ============================================
// MAIN SERVICE FUNCTIONS
// ============================================

/**
 * Award XP for an action
 * 
 * Phase 1B: Returns safe no-op result when feature flagged off.
 * 
 * @param {Object} params
 * @param {string} params.userId - User who performed action
 * @param {string} params.partnerId - User's partner
 * @param {string} params.actionType - Type of action (from ACTION_TYPES)
 * @param {string} params.sourceId - Unique ID of source (e.g., answer ID)
 * @param {string} [params.content] - Content for quality checks
 * @param {string} [params.difficulty] - For challenge type actions
 * @param {number} [params.xpOverride] - Override XP amount (server-authoritative)
 * @param {string} [params.idempotencyKeyOverride] - Override idempotency key (for couple-scoped awards)
 * 
 * @returns {Object} { success: boolean, xpAwarded: number, error?: string }
 */
async function awardXP({ userId, partnerId, actionType, sourceId, content, difficulty, xpOverride, idempotencyKeyOverride }) {
    // Feature flag check - hard off by default
    if (!isXPSystemEnabled()) {
        console.log('[XPService] Feature disabled, returning no-op');
        return { success: true, xpAwarded: 0, skipped: true, reason: 'feature_disabled' };
    }

    if (!isSupabaseConfigured()) {
        return { success: false, xpAwarded: 0, error: 'supabase_not_configured' };
    }

    // Validate inputs
    if (!userId || !partnerId) {
        return { success: false, xpAwarded: 0, error: 'missing_user_ids' };
    }

    const normalizedActionType = normalizeActionType(actionType);
    if (!normalizedActionType) {
        return { success: false, xpAwarded: 0, error: 'invalid_action_type' };
    }

    if (!sourceId) {
        return { success: false, xpAwarded: 0, error: 'missing_source_id' };
    }

    // Quality check
    if (!meetsQualityRequirements(normalizedActionType, content)) {
        console.log('[XPService] Content does not meet quality requirements');
        return { success: false, xpAwarded: 0, error: 'quality_requirements_not_met' };
    }

    // Get couple IDs
    const coupleIds = getOrderedCoupleIds(userId, partnerId);
    if (!coupleIds) {
        return { success: false, xpAwarded: 0, error: 'invalid_couple' };
    }

    // Calculate XP amount
    let xpAmount = XP_VALUES[normalizedActionType];
    if (typeof xpAmount === 'object' && difficulty) {
        xpAmount = xpAmount[difficulty] || 0;
    }
    if (Number.isFinite(xpOverride) && xpOverride > 0) {
        xpAmount = xpOverride;
    }
    if (!xpAmount) {
        return { success: false, xpAwarded: 0, error: 'invalid_xp_amount' };
    }

    const supabase = getSupabase();
    const { startIso, endIso, dateString } = getEtDayRange();
    const idempotencyKey = idempotencyKeyOverride
        || generateIdempotencyKey(normalizedActionType, sourceId, userId, dateString);

    // Ensure couple_levels exists
    const existingLevel = await ensureCoupleLevel(supabase, coupleIds);

    // Idempotency check
    const { data: existingTxn, error: idempotencyError } = await supabase
        .from('xp_transactions')
        .select('id')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

    if (idempotencyError) {
        console.warn('[XPService] Idempotency check failed:', idempotencyError);
        return { success: false, xpAwarded: 0, error: 'idempotency_check_failed' };
    }

    if (existingTxn) {
        return { success: true, xpAwarded: 0, skipped: true, reason: 'duplicate' };
    }

    // Daily totals for caps and max-per-day checks
    const { data: dailyRows, error: dailyError } = await supabase
        .from('xp_transactions')
        .select('xp_amount')
        .eq('user_id', userId)
        .eq('action_type', normalizedActionType)
        .gte('created_at', startIso)
        .lt('created_at', endIso);

    if (dailyError) {
        console.warn('[XPService] Daily cap check failed:', dailyError);
        return { success: false, xpAwarded: 0, error: 'daily_cap_check_failed' };
    }

    const totalToday = (dailyRows || []).reduce((sum, row) => sum + (row.xp_amount || 0), 0);
    const countToday = (dailyRows || []).length;
    const requirements = QUALITY_REQUIREMENTS[normalizedActionType];

    if (requirements?.maxPerDay && countToday >= requirements.maxPerDay) {
        return { success: true, xpAwarded: 0, skipped: true, reason: 'daily_limit_reached' };
    }

    const dailyCap = DAILY_CAPS[normalizedActionType];
    const remaining = dailyCap ? Math.max(dailyCap - totalToday, 0) : xpAmount;
    const xpAwarded = dailyCap ? Math.min(xpAmount, remaining) : xpAmount;

    if (xpAwarded <= 0) {
        return { success: true, xpAwarded: 0, skipped: true, reason: 'daily_cap_reached' };
    }

    const { data: inserted, error: insertError } = await supabase
        .from('xp_transactions')
        .insert({
            idempotency_key: idempotencyKey,
            user_a_id: coupleIds.user_a_id,
            user_b_id: coupleIds.user_b_id,
            user_id: userId,
            action_type: normalizedActionType,
            source_id: sourceId,
            xp_amount: xpAwarded,
            metadata: {
                base_xp: xpAmount,
                capped: xpAwarded !== xpAmount,
                date_et: dateString,
            },
        })
        .select('id, xp_amount')
        .single();

    if (insertError) {
        if (insertError.code === '23505') {
            return { success: true, xpAwarded: 0, skipped: true, reason: 'duplicate' };
        }
        console.warn('[XPService] Insert failed:', insertError);
        return { success: false, xpAwarded: 0, error: 'insert_failed' };
    }

    // Recalculate total XP for couple
    const { data: coupleRows, error: sumError } = await supabase
        .from('xp_transactions')
        .select('xp_amount')
        .eq('user_a_id', coupleIds.user_a_id)
        .eq('user_b_id', coupleIds.user_b_id);

    if (sumError) {
        console.warn('[XPService] Failed to sum XP:', sumError);
        return { success: false, xpAwarded, error: 'sum_failed' };
    }

    const totalXP = (coupleRows || []).reduce((sum, row) => sum + (row.xp_amount || 0), 0);
    const levelInfo = getLevelInfo(totalXP);
    const previousLevel = existingLevel?.current_level || 1;
    const levelUp = levelInfo.level > previousLevel;

    const { error: updateError } = await supabase
        .from('couple_levels')
        .update({
            total_xp: totalXP,
            current_level: levelInfo.level,
            updated_at: new Date().toISOString(),
        })
        .eq('user_a_id', coupleIds.user_a_id)
        .eq('user_b_id', coupleIds.user_b_id);

    if (updateError) {
        console.warn('[XPService] Failed to update couple_levels:', updateError);
        return { success: false, xpAwarded, error: 'level_update_failed' };
    }

    return {
        success: true,
        xpAwarded,
        totalXP,
        level: levelInfo.level,
        title: levelInfo.title,
        currentXP: levelInfo.currentXP,
        xpForNextLevel: levelInfo.xpForNextLevel,
        levelUp,
        transactionId: inserted?.id || null,
    };
}

/**
 * Get couple's current level status
 * 
 * Returns live data when enabled (null when disabled)
 */
async function getLevelStatus(userId, partnerId) {
    if (!isXPSystemEnabled()) {
        return { success: true, data: null, reason: 'feature_disabled' };
    }

    if (!isSupabaseConfigured()) {
        return { success: false, error: 'supabase_not_configured' };
    }

    if (!userId || !partnerId) {
        return { success: false, error: 'missing_user_ids' };
    }

    const coupleIds = getOrderedCoupleIds(userId, partnerId);
    if (!coupleIds) {
        return { success: false, error: 'invalid_couple' };
    }

    const supabase = getSupabase();
    const existingLevel = await ensureCoupleLevel(supabase, coupleIds);
    const totalXP = existingLevel?.total_xp || 0;
    const levelInfo = getLevelInfo(totalXP);

    return { success: true, data: levelInfo };
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
    ACTION_TYPES,
    XP_VALUES,
    DAILY_CAPS,
    QUALITY_REQUIREMENTS,
    awardXP,
    getLevelStatus,
    // Helpers exported for testing
    isXPSystemEnabled,
    meetsQualityRequirements,
    generateIdempotencyKey,
    getOrderedCoupleIds,
    normalizeActionType,
    getEtDayRange,
    getLevelInfo,
};
