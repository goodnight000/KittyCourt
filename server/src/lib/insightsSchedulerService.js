/**
 * Insights Scheduler Service - Runs daily eligibility checks and generation.
 */

const { getSupabase, isSupabaseConfigured } = require('./supabase');
const { getOrderedCoupleIds, getLevelStatus } = require('./xpService');
const { getEtDateString } = require('./shared/dateTimeUtils');
const { generateInsightsForCouple } = require('./insightService');
const {
    INSIGHT_SCORE_THRESHOLD,
    getInsightCounter,
    resetInsightCounter,
    updateInsightCounter,
} = require('./insightEventService');

const INSIGHTS_MIN_LEVEL = 10;

const isGoldActive = (profile) => {
    if (!profile || profile.subscription_tier !== 'pause_gold') return false;
    if (!profile.subscription_expires_at) return true;
    const expiresAt = new Date(profile.subscription_expires_at);
    return !Number.isNaN(expiresAt.valueOf()) && expiresAt >= new Date();
};

const fetchLatestInsights = async (supabase, coupleIds, userId) => {
    const { data, error } = await supabase
        .from('insights')
        .select('id, insight_text, category, generated_at')
        .eq('user_a_id', coupleIds.user_a_id)
        .eq('user_b_id', coupleIds.user_b_id)
        .eq('recipient_user_id', userId)
        .eq('is_active', true)
        .order('generated_at', { ascending: false })
        .limit(12);

    if (error) throw error;
    return data || [];
};

const maybeGenerateInitialInsights = async ({ userId }) => {
    if (!isSupabaseConfigured()) {
        return { success: false, error: 'supabase_not_configured' };
    }

    const supabase = getSupabase();
    const nowIso = new Date().toISOString();
    const todayEt = getEtDateString();

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, partner_id, subscription_tier, subscription_expires_at')
        .eq('id', userId)
        .single();

    if (profileError || !profile) {
        return { success: false, error: profileError?.message || 'profile_not_found' };
    }

    if (!profile.partner_id || !isGoldActive(profile)) {
        return { success: true, skipped: true, reason: 'not_eligible' };
    }

    const levelStatus = await getLevelStatus(userId, profile.partner_id);
    if (!levelStatus?.success || !levelStatus?.data || levelStatus.data.level < INSIGHTS_MIN_LEVEL) {
        return { success: true, skipped: true, reason: 'level_locked' };
    }

    const coupleIds = getOrderedCoupleIds(userId, profile.partner_id);
    if (!coupleIds) {
        return { success: false, error: 'invalid_couple' };
    }

    const existingInsights = await fetchLatestInsights(supabase, coupleIds, userId);
    if (existingInsights.length > 0) {
        const latestAt = existingInsights[0]?.generated_at;
        if (latestAt) {
            await updateInsightCounter(userId, { last_insight_generated_at: latestAt, updated_at: nowIso });
        }
        return { success: true, skipped: true, reason: 'already_generated' };
    }

    const generated = await generateInsightsForCouple({
        userId,
        partnerId: profile.partner_id,
        existingInsights: [],
    });

    if (generated?.error) {
        return { success: false, error: generated.error };
    }

    const generatedAt = generated?.insights?.[0]?.generated_at || nowIso;
    await resetInsightCounter({
        userId,
        lastRunAt: nowIso,
        lastRunDate: todayEt,
        lastInsightGeneratedAt: generatedAt,
    });

    return { success: true, generated: generated?.insights?.length || 0 };
};

const processDailyInsights = async () => {
    if (!isSupabaseConfigured()) {
        return { success: false, error: 'supabase_not_configured' };
    }

    const supabase = getSupabase();
    const nowIso = new Date().toISOString();
    const todayEt = getEtDateString();

    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, partner_id, subscription_tier, subscription_expires_at')
        .not('partner_id', 'is', null)
        .eq('subscription_tier', 'pause_gold');

    if (error) {
        return { success: false, error: error.message };
    }

    const results = {
        success: true,
        processed: 0,
        generated: 0,
        skipped: 0,
        errors: 0,
    };

    for (const profile of profiles || []) {
        results.processed += 1;

        if (!isGoldActive(profile)) {
            results.skipped += 1;
            continue;
        }

        const levelStatus = await getLevelStatus(profile.id, profile.partner_id);
        if (!levelStatus?.success || !levelStatus?.data || levelStatus.data.level < INSIGHTS_MIN_LEVEL) {
            results.skipped += 1;
            continue;
        }

        const counterResult = await getInsightCounter(profile.id);
        const counter = counterResult?.data || null;

        if (counter?.last_run_date === todayEt) {
            results.skipped += 1;
            continue;
        }

        const coupleIds = getOrderedCoupleIds(profile.id, profile.partner_id);
        if (!coupleIds) {
            results.errors += 1;
            continue;
        }

        let latestInsights = [];
        let lastInsightAt = counter?.last_insight_generated_at || null;

        if (!lastInsightAt) {
            try {
                latestInsights = await fetchLatestInsights(supabase, coupleIds, profile.id);
                lastInsightAt = latestInsights[0]?.generated_at || null;
                if (lastInsightAt) {
                    await updateInsightCounter(profile.id, { last_insight_generated_at: lastInsightAt, updated_at: nowIso });
                }
            } catch (fetchError) {
                console.warn('[InsightsScheduler] Failed to fetch existing insights:', fetchError?.message || fetchError);
            }
        }

        const score = Number(counter?.score || 0);
        const shouldGenerate = score >= INSIGHT_SCORE_THRESHOLD || !lastInsightAt;

        if (!shouldGenerate) {
            results.skipped += 1;
            continue;
        }

        if (latestInsights.length === 0 && lastInsightAt) {
            try {
                latestInsights = await fetchLatestInsights(supabase, coupleIds, profile.id);
            } catch (fetchError) {
                console.warn('[InsightsScheduler] Failed to fetch insights for prompt:', fetchError?.message || fetchError);
            }
        }

        const generated = await generateInsightsForCouple({
            userId: profile.id,
            partnerId: profile.partner_id,
            existingInsights: (latestInsights || []).map((insight) => ({
                text: insight.insight_text,
                category: insight.category,
            })),
        });

        if (generated?.error) {
            results.errors += 1;
            continue;
        }

        const generatedAt = generated?.insights?.[0]?.generated_at || nowIso;
        await resetInsightCounter({
            userId: profile.id,
            lastRunAt: nowIso,
            lastRunDate: todayEt,
            lastInsightGeneratedAt: generatedAt,
        });

        results.generated += 1;
    }

    return results;
};

module.exports = {
    processDailyInsights,
    maybeGenerateInitialInsights,
};
