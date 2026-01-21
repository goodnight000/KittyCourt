/**
 * Insight Event Service - Tracks weighted activity for AI insights scheduling.
 */

const { getSupabase, isSupabaseConfigured } = require('./supabase');

const INSIGHT_EVENT_TYPES = {
    CASE_RESOLUTION: 'case_resolution',
    DAILY_QUESTION: 'daily_question',
    APPRECIATION: 'appreciation',
    MEMORY_UPLOAD: 'memory_upload',
};

const INSIGHT_EVENT_WEIGHTS = {
    [INSIGHT_EVENT_TYPES.CASE_RESOLUTION]: 5,
    [INSIGHT_EVENT_TYPES.DAILY_QUESTION]: 2.5,
    [INSIGHT_EVENT_TYPES.APPRECIATION]: 1,
    [INSIGHT_EVENT_TYPES.MEMORY_UPLOAD]: 1.5,
};

const INSIGHT_SCORE_THRESHOLD = 10;

const toNumber = (value, fallback = 0) => {
    if (typeof value === 'number') return value;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const getEventWeight = (eventType, override) => {
    if (typeof override === 'number' && Number.isFinite(override)) {
        return override;
    }
    return INSIGHT_EVENT_WEIGHTS[eventType] || 1;
};

const recordInsightEvent = async ({ userId, eventType, sourceId, weightOverride }) => {
    if (!isSupabaseConfigured()) {
        return { success: false, error: 'supabase_not_configured' };
    }
    if (!userId || !eventType || !sourceId) {
        return { success: false, error: 'missing_fields' };
    }

    const supabase = getSupabase();
    const nowIso = new Date().toISOString();
    const weight = getEventWeight(eventType, weightOverride);

    const { data: inserted, error: insertError } = await supabase
        .from('insight_events')
        .insert({
            user_id: userId,
            event_type: eventType,
            source_id: String(sourceId),
            weight,
        })
        .select('id')
        .single();

    if (insertError) {
        if (insertError.code === '23505') {
            return { success: true, skipped: true, reason: 'duplicate' };
        }
        return { success: false, error: insertError.message };
    }

    const { data: counter } = await supabase
        .from('insight_event_counters')
        .select('score')
        .eq('user_id', userId)
        .maybeSingle();

    const currentScore = toNumber(counter?.score, 0);
    const nextScore = currentScore + weight;

    if (counter) {
        const { error: updateError } = await supabase
            .from('insight_event_counters')
            .update({
                score: nextScore,
                last_event_at: nowIso,
                updated_at: nowIso,
            })
            .eq('user_id', userId);

        if (updateError) {
            return { success: false, error: updateError.message };
        }
    } else {
        const { error: upsertError } = await supabase
            .from('insight_event_counters')
            .insert({
                user_id: userId,
                score: nextScore,
                last_event_at: nowIso,
                last_run_at: null,
                last_run_date: null,
                last_insight_generated_at: null,
                updated_at: nowIso,
            });

        if (upsertError) {
            return { success: false, error: upsertError.message };
        }
    }

    return { success: true, eventId: inserted?.id || null, score: nextScore };
};

const getInsightCounter = async (userId) => {
    if (!isSupabaseConfigured()) {
        return { success: false, error: 'supabase_not_configured' };
    }
    if (!userId) {
        return { success: false, error: 'missing_user_id' };
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('insight_event_counters')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

    if (error) {
        return { success: false, error: error.message };
    }

    return { success: true, data: data || null };
};

const updateInsightCounter = async (userId, updates) => {
    if (!isSupabaseConfigured()) {
        return { success: false, error: 'supabase_not_configured' };
    }
    if (!userId) {
        return { success: false, error: 'missing_user_id' };
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('insight_event_counters')
        .upsert(
            { user_id: userId, ...updates },
            { onConflict: 'user_id' }
        )
        .select('*')
        .single();

    if (error) {
        return { success: false, error: error.message };
    }

    return { success: true, data };
};

const resetInsightCounter = async ({
    userId,
    lastRunAt,
    lastRunDate,
    lastInsightGeneratedAt,
}) => {
    const nowIso = new Date().toISOString();
    const updates = {
        score: 0,
        last_run_at: lastRunAt || nowIso,
        last_run_date: lastRunDate || null,
        updated_at: nowIso,
    };

    if (lastInsightGeneratedAt) {
        updates.last_insight_generated_at = lastInsightGeneratedAt;
    }

    return updateInsightCounter(userId, updates);
};

module.exports = {
    INSIGHT_EVENT_TYPES,
    INSIGHT_EVENT_WEIGHTS,
    INSIGHT_SCORE_THRESHOLD,
    recordInsightEvent,
    getInsightCounter,
    updateInsightCounter,
    resetInsightCounter,
};
