const { getSupabase, isSupabaseConfigured } = require('./supabase');
const { getCurrentPeriodStartUTC } = require('./usageTracking');

const VALID_TYPES = new Set(['lightning', 'mittens', 'whiskers', 'plan']);

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
            lightning: Infinity,
            mittens: 100,
            whiskers: 10,
            plan: Infinity,
        };
    }

    return {
        lightning: 3,
        mittens: 1,
        whiskers: 0,
        plan: 0,
    };
}

async function getUsageRecord(userId, periodStart) {
    const effectivePeriodStart = periodStart || getCurrentPeriodStartUTC();
    if (!isSupabaseConfigured()) {
        return {
            period_start: effectivePeriodStart,
            lightning_count: 0,
            mittens_count: 0,
            whiskers_count: 0,
            plan_count: 0,
        };
    }

    const supabase = getSupabase();
    const { data: record, error } = await supabase
        .from('usage_tracking')
        .select('*')
        .eq('user_id', userId)
        .eq('period_start', effectivePeriodStart)
        .maybeSingle();

    if (error) {
        // Missing migration/table.
        if (error.code === '42P01') {
            return {
                period_start: effectivePeriodStart,
                lightning_count: 0,
                mittens_count: 0,
                whiskers_count: 0,
                plan_count: 0,
            };
        }
        throw error;
    }

    return record || {
        period_start: effectivePeriodStart,
        lightning_count: 0,
        mittens_count: 0,
        whiskers_count: 0,
        plan_count: 0,
    };
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
        lightning: 'lightning_count',
        mittens: 'mittens_count',
        whiskers: 'whiskers_count',
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
