const { getSupabase, isSupabaseConfigured } = require('../supabase');

function normalizeUuid(value) {
    if (!value || typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed;
}

async function recordUsageEvent(event = {}) {
    if (!isSupabaseConfigured()) return null;

    const supabase = getSupabase();
    const payload = {
        source: event.source || 'unknown',
        provider: event.provider || 'unknown',
        model: event.model || 'unknown',
        user_id: normalizeUuid(event.userId || event.metadata?.userId),
        input_tokens: Number(event.inputTokens || 0),
        output_tokens: Number(event.outputTokens || 0),
        total_tokens: Number(event.totalTokens || 0),
        estimated_cost_usd: Number(event.estimatedCostUsd || 0),
        raw_usage: event.rawUsage || {},
        metadata: event.metadata || {},
    };

    const { data, error } = await supabase
        .from('ai_usage_events')
        .insert(payload)
        .select('id')
        .single();

    if (error) {
        console.warn('[AbuseRepository] Failed to record usage event:', error?.message || error);
        return null;
    }

    return data?.id || null;
}

async function recordAbuseAction(action = {}) {
    if (!isSupabaseConfigured()) return null;

    const supabase = getSupabase();
    const payload = {
        ai_usage_event_id: action.aiUsageEventId || null,
        user_id: normalizeUuid(action.userId),
        action: action.action || 'unknown',
        reason: action.reason || null,
        metadata: action.metadata || {},
    };

    const { data, error } = await supabase
        .from('abuse_actions')
        .insert(payload)
        .select('id')
        .single();

    if (error) {
        console.warn('[AbuseRepository] Failed to record abuse action:', error?.message || error);
        return null;
    }

    return data?.id || null;
}

function createUsageTelemetryRecorder(baseMetadata = {}) {
    return async function usageTelemetryRecorder(event) {
        const merged = {
            ...(event || {}),
            metadata: {
                ...(event?.metadata || {}),
                ...(baseMetadata || {}),
            },
        };
        return recordUsageEvent(merged);
    };
}

module.exports = {
    recordUsageEvent,
    recordAbuseAction,
    createUsageTelemetryRecorder,
};
