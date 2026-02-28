const { getSupabase, isSupabaseConfigured } = require('./supabase');

const VALID_TYPES = new Set(['classic', 'swift', 'wise', 'plan']);

// Once-only flag to avoid log spam when the atomic RPC is not installed.
let warnedAboutMissingRpc = false;

function getCurrentPeriodStartUTC() {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const first = new Date(Date.UTC(year, month, 1));
    return first.toISOString().slice(0, 10); // YYYY-MM-DD
}

async function incrementUsage({ userId, type, periodStart = null }) {
    if (!userId) throw new Error('userId is required');
    if (!VALID_TYPES.has(type)) throw new Error('Invalid usage type');
    if (!isSupabaseConfigured()) return null;

    const supabase = getSupabase();
    const effectivePeriodStart = periodStart || getCurrentPeriodStartUTC();

    // Prefer atomic RPC if migration installed.
    try {
        const { data, error } = await supabase.rpc('increment_usage', {
            p_user_id: userId,
            p_period_start: effectivePeriodStart,
            p_type: type,
        });

        if (!error) return data ?? null;
    } catch (_e) {
        // Fall through to non-atomic fallback.
    }

    // Fallback: non-atomic update (still better than nothing if RPC isn't installed yet).
    // WARNING: This read-then-upsert has a race condition under concurrent requests.
    // Install the increment_usage RPC (see supabase/migrations) for atomic, production-safe behavior.
    if (!warnedAboutMissingRpc) {
        console.warn('[UsageTracking] increment_usage RPC not installed - using non-atomic fallback. Install the RPC for production use.');
        warnedAboutMissingRpc = true;
    }
    const { data: record, error: fetchError } = await supabase
        .from('usage_tracking')
        .select('*')
        .eq('user_id', userId)
        .eq('period_start', effectivePeriodStart)
        .maybeSingle();

    if (fetchError) throw fetchError;

    const base = record || {
        user_id: userId,
        period_start: effectivePeriodStart,
        classic_count: 0,
        swift_count: 0,
        wise_count: 0,
        plan_count: 0,
    };

    const columnMap = {
        classic: 'classic_count',
        swift: 'swift_count',
        wise: 'wise_count',
        plan: 'plan_count',
    };

    const column = columnMap[type];
    const nextCount = (base[column] || 0) + 1;

    const { data: upserted, error: upsertError } = await supabase
        .from('usage_tracking')
        .upsert(
            {
                ...base,
                [column]: nextCount,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,period_start' }
        )
        .select(column)
        .single();

    if (upsertError) throw upsertError;
    return upserted?.[column] ?? null;
}

module.exports = {
    getCurrentPeriodStartUTC,
    incrementUsage,
};

