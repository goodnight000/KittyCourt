const { getSupabase, isSupabaseConfigured } = require('./supabase');
const { getCurrentPeriodStartUTC } = require('./usageTracking');

const VALID_TYPES = new Set(['classic', 'swift', 'wise', 'plan']);

async function getUserSubscriptionTier(userId) {
    if (!isSupabaseConfigured()) {
        return process.env.NODE_ENV === 'production' ? 'free' : 'pause_gold';
    }
    const supabase = getSupabase();

    const { data: profile, error } = await supabase
        .from('profiles')
        .select('subscription_tier, subscription_expires_at')
        .eq('id', userId)
        .maybeSingle();

    if (error || !profile) return 'free';

    if (profile.subscription_tier === 'pause_gold' && profile.subscription_expires_at) {
        if (new Date(profile.subscription_expires_at) < new Date()) {
            return 'free';
        }
    }

    return profile.subscription_tier || 'free';
}

function getLimits(tier) {
    if (tier === 'pause_gold') {
        return {
            classic: Infinity,
            swift: 100,
            wise: 10,
            plan: Infinity,
        };
    }

    return {
        classic: 3,
        swift: 1,
        wise: 0,
        plan: 0,
    };
}

async function getUsageRecord(userId, periodStart) {
    const effectivePeriodStart = periodStart || getCurrentPeriodStartUTC();
    const emptyRecord = {
        period_start: effectivePeriodStart,
        classic_count: 0,
        swift_count: 0,
        wise_count: 0,
        plan_count: 0,
    };

    if (!isSupabaseConfigured()) {
        return emptyRecord;
    }

    const supabase = getSupabase();

    // Prefer couple-wide usage (shared limits).
    try {
        const { data, error } = await supabase.rpc('get_couple_usage', {
            p_user_id: userId,
            p_period_start: effectivePeriodStart,
        });

        if (!error && data && data.length > 0) {
            return {
                classic_count: data[0].classic_count || 0,
                swift_count: data[0].swift_count || 0,
                wise_count: data[0].wise_count || 0,
                plan_count: data[0].plan_count || 0,
                period_start: effectivePeriodStart,
            };
        }
    } catch (_e) {
        // Fall through to couple_id query.
    }

    try {
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('partner_id')
            .eq('id', userId)
            .maybeSingle();

        if (profileError) throw profileError;

        const partnerId = profile?.partner_id || null;
        const coupleId = partnerId
            ? [String(userId), String(partnerId)].sort().join('-')
            : String(userId);

        const { data: rows, error: coupleError } = await supabase
            .from('usage_tracking')
            .select('classic_count, swift_count, wise_count, plan_count')
            .eq('couple_id', coupleId)
            .eq('period_start', effectivePeriodStart);

        if (coupleError) throw coupleError;

        return (rows || []).reduce((acc, row) => ({
            period_start: effectivePeriodStart,
            classic_count: acc.classic_count + (row.classic_count || 0),
            swift_count: acc.swift_count + (row.swift_count || 0),
            wise_count: acc.wise_count + (row.wise_count || 0),
            plan_count: acc.plan_count + (row.plan_count || 0),
        }), {
            period_start: effectivePeriodStart,
            classic_count: 0,
            swift_count: 0,
            wise_count: 0,
            plan_count: 0,
        });
    } catch (error) {
        if (error.code === '42P01' || error.code === '42703') {
            return emptyRecord;
        }
        throw error;
    }
}

async function canUseFeature({ userId, type }) {
    if (!userId) throw new Error('userId is required');
    if (!VALID_TYPES.has(type)) throw new Error('Invalid feature type');

    const [tier, record] = await Promise.all([
        getUserSubscriptionTier(userId),
        getUsageRecord(userId),
    ]);

    const limits = getLimits(tier);
    const columnMap = {
        classic: 'classic_count',
        swift: 'swift_count',
        wise: 'wise_count',
        plan: 'plan_count',
    };

    const used = record[columnMap[type]] || 0;
    const limit = limits[type];
    const allowed = limit === Infinity || used < limit;
    const remaining = limit === Infinity ? Infinity : Math.max(0, limit - used);

    return {
        allowed,
        remaining,
        limit,
        used,
        tier,
        periodStart: record.period_start,
    };
}

module.exports = {
    canUseFeature,
    getUserSubscriptionTier,
    getLimits,
    getUsageRecord,
};
