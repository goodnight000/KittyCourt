/**
 * Insight Service - Generates relationship insights.
 */

const { getSupabase, isSupabaseConfigured } = require('./supabase');
const { getOrderedCoupleIds } = require('./xpService');

const getSinceIso = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

const buildRelationshipStats = async (supabase, coupleIds) => {
    const since14 = getSinceIso(14);
    const since30 = getSinceIso(30);

    const { data: dailyAnswers } = await supabase
        .from('daily_answers')
        .select('assignment_id, created_at, user_id')
        .in('user_id', [coupleIds.user_a_id, coupleIds.user_b_id])
        .gte('created_at', since14);

    const { data: appreciations } = await supabase
        .from('appreciations')
        .select('id, created_at')
        .or(`from_user_id.eq.${coupleIds.user_a_id},from_user_id.eq.${coupleIds.user_b_id}`)
        .gte('created_at', since14);

    const { data: memories } = await supabase
        .from('memories')
        .select('id, created_at')
        .eq('user_a_id', coupleIds.user_a_id)
        .eq('user_b_id', coupleIds.user_b_id)
        .eq('is_deleted', false)
        .gte('created_at', since30);

    const dailyAnswerCount = dailyAnswers?.length || 0;
    const appreciationCount = appreciations?.length || 0;
    const memoryCount = memories?.length || 0;

    return {
        dailyAnswerCount,
        appreciationCount,
        memoryCount,
        since14,
        since30,
    };
};

const buildInsightsFromStats = (stats) => {
    const insights = [];

    if (stats.dailyAnswerCount >= 8) {
        insights.push({
            category: 'connection',
            insightText: 'You two have been keeping up with Daily Meow lately. That consistency is building momentum.',
            evidenceSummary: `Answered ${stats.dailyAnswerCount} daily questions in the last 14 days.`,
            confidenceScore: 0.6,
        });
    }

    if (stats.appreciationCount >= 5) {
        insights.push({
            category: 'gratitude',
            insightText: 'There has been a steady stream of appreciations lately. Little moments of gratitude add up.',
            evidenceSummary: `${stats.appreciationCount} appreciations shared in the last 14 days.`,
            confidenceScore: 0.6,
        });
    }

    if (stats.memoryCount >= 2) {
        insights.push({
            category: 'memories',
            insightText: 'You are capturing memories together. Revisiting them can bring back the good feelings.',
            evidenceSummary: `${stats.memoryCount} memories added in the last 30 days.`,
            confidenceScore: 0.55,
        });
    }

    return insights;
};

const generateInsightsForCouple = async ({ userId, partnerId }) => {
    if (!isSupabaseConfigured()) {
        return { error: 'supabase_not_configured' };
    }

    const coupleIds = getOrderedCoupleIds(userId, partnerId);
    if (!coupleIds) return { error: 'invalid_couple' };

    const supabase = getSupabase();
    const stats = await buildRelationshipStats(supabase, coupleIds);
    const insights = buildInsightsFromStats(stats);

    if (insights.length === 0) {
        return { success: true, insights: [] };
    }

    const generatedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const rows = insights.map((insight) => ({
        user_a_id: coupleIds.user_a_id,
        user_b_id: coupleIds.user_b_id,
        category: insight.category,
        insight_text: insight.insightText,
        evidence_summary: insight.evidenceSummary,
        confidence_score: insight.confidenceScore,
        generated_at: generatedAt,
        expires_at: expiresAt,
        is_active: true,
    }));

    const { data: inserted, error } = await supabase
        .from('insights')
        .insert(rows)
        .select('*');

    if (error) {
        return { error: error.message };
    }

    await supabase
        .from('relationship_stats')
        .upsert({
            user_a_id: coupleIds.user_a_id,
            user_b_id: coupleIds.user_b_id,
            stats,
            last_calculated: generatedAt,
        });

    return { success: true, insights: inserted || [] };
};

module.exports = {
    generateInsightsForCouple,
};
