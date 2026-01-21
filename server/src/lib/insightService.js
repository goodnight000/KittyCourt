/**
 * Insight Service - Generates relationship insights.
 */

const { z } = require('zod');
const { getSupabase, isSupabaseConfigured } = require('./supabase');
const { getOrderedCoupleIds } = require('./xpService');
const { getEtDayRange } = require('./shared/dateTimeUtils');
const { createChatCompletion, isOpenRouterConfigured } = require('./openrouter');
const { callLLMWithRetry } = require('./shared/llmRetryHandler');

const INSIGHTS_MODEL = 'deepseek/deepseek-v3.2';
const INSIGHTS_MAX = 3;
const MIN_MEMORY_CANDIDATES = 4;
const MAX_MEMORY_CANDIDATES = 30;
const INSIGHTS_TTL_DAYS = 30;

const INSIGHTS_JSON_SCHEMA = {
    name: 'relationship_insights',
    strict: true,
    schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
            insights: {
                type: 'array',
                minItems: 1,
                maxItems: INSIGHTS_MAX,
                items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        category: { type: 'string' },
                        text: { type: 'string' },
                        evidenceSummary: { type: 'string' },
                        confidenceScore: { type: 'number' }
                    },
                    required: ['category', 'text', 'evidenceSummary', 'confidenceScore']
                }
            }
        },
        required: ['insights']
    }
};

const InsightsOutputSchema = z.object({
    insights: z.array(z.object({
        category: z.string(),
        text: z.string(),
        evidenceSummary: z.string(),
        confidenceScore: z.number().min(0).max(1),
    })).min(1).max(INSIGHTS_MAX),
});

const getSinceIso = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

const buildRelationshipStats = async (supabase, coupleIds, userId) => {
    const since14 = getSinceIso(14);
    const since30 = getSinceIso(30);

    const { data: dailyAnswers } = await supabase
        .from('daily_answers')
        .select('assignment_id, created_at, user_id')
        .eq('user_id', userId)
        .gte('created_at', since14);

    const { data: appreciations } = await supabase
        .from('appreciations')
        .select('id, created_at')
        .eq('from_user_id', userId)
        .gte('created_at', since14);

    const { data: memories } = await supabase
        .from('memories')
        .select('id, created_at')
        .eq('user_a_id', coupleIds.user_a_id)
        .eq('user_b_id', coupleIds.user_b_id)
        .eq('uploaded_by', userId)
        .eq('is_deleted', false)
        .gte('created_at', since30);

    return {
        dailyAnswerCount: dailyAnswers?.length || 0,
        appreciationCount: appreciations?.length || 0,
        memoryCount: memories?.length || 0,
        since14,
        since30,
    };
};

const clampText = (value, maxLength) => {
    const text = String(value || '').trim();
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 1).trim()}…`;
};

const toDaysAgo = (dateValue) => {
    if (!dateValue) return 365;
    const timestamp = new Date(dateValue).getTime();
    if (Number.isNaN(timestamp)) return 365;
    return Math.max(0, (Date.now() - timestamp) / (1000 * 60 * 60 * 24));
};

const scoreMemory = (memory) => {
    const recencyDays = toDaysAgo(memory.last_reinforced_at || memory.last_observed_at || memory.observed_at);
    const recencyScore = Math.max(0, 1 - Math.min(recencyDays, 180) / 180);
    const reinforcementScore = Math.min((memory.reinforcement_count || 0) / 5, 1);
    const confidenceScore = Math.min(Math.max(memory.confidence_score || 0.6, 0), 1);
    return {
        recencyDays,
        score: (recencyScore * 0.45) + (reinforcementScore * 0.25) + (confidenceScore * 0.3),
        confidenceScore,
    };
};

const fetchMemoryCandidates = async (supabase, userId) => {
    const { data, error } = await supabase
        .from('user_memories')
        .select('id, user_id, memory_text, memory_type, memory_subtype, confidence_score, reinforcement_count, last_reinforced_at, last_observed_at, observed_at, language')
        .eq('user_id', userId)
        .order('last_observed_at', { ascending: false })
        .limit(200);

    if (error) throw error;

    return (data || []).map((memory) => {
        const scoreData = scoreMemory(memory);
        return {
            id: memory.id,
            userId: memory.user_id,
            text: clampText(memory.memory_text, 220),
            type: memory.memory_type,
            subtype: memory.memory_subtype,
            confidenceScore: scoreData.confidenceScore,
            recencyDays: scoreData.recencyDays,
            reinforcementCount: memory.reinforcement_count || 0,
            score: scoreData.score,
        };
    }).sort((a, b) => b.score - a.score).slice(0, MAX_MEMORY_CANDIDATES);
};

const getLatestInsightGeneratedAt = async (supabase, coupleIds, userId) => {
    const { data, error } = await supabase
        .from('insights')
        .select('generated_at')
        .eq('user_a_id', coupleIds.user_a_id)
        .eq('user_b_id', coupleIds.user_b_id)
        .eq('recipient_user_id', userId)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) throw error;
    return data?.generated_at || null;
};

const shouldGenerateToday = (latestGeneratedAt) => {
    if (!latestGeneratedAt) return true;
    const { startIso } = getEtDayRange(new Date());
    return new Date(latestGeneratedAt) < new Date(startIso);
};

const buildInsightPrompt = ({ candidates, stats, existingInsights }) => {
    const recentInsights = (existingInsights || [])
        .map((insight) => insight?.text)
        .filter(Boolean)
        .slice(0, 12);

    const candidateLines = candidates.map((candidate, index) => (
        `${index + 1}. "${candidate.text}" | type=${candidate.type || 'pattern'} | subtype=${candidate.subtype || 'none'} | recencyDays=${Math.round(candidate.recencyDays)} | reinforcement=${candidate.reinforcementCount} | confidence=${candidate.confidenceScore.toFixed(2)}`
    ));

    return [
        'Generate 1-3 concise, supportive insights for this person.',
        'Use only the signals below. Avoid blame, diagnosis, or absolute claims.',
        'Write in second person singular ("you").',
        'Each insight should be 10-24 words. Include a micro-action in evidenceSummary.',
        'Avoid repeating existing insights.',
        '',
        `Your recent activity (last 14/30 days): dailyAnswers=${stats.dailyAnswerCount}, appreciationsSent=${stats.appreciationCount}, memoriesAdded=${stats.memoryCount}.`,
        'Candidate memories (ranked):',
        candidateLines.join('\n'),
        '',
        'Existing insight texts to avoid:',
        recentInsights.length ? recentInsights.map((text) => `- ${text}`).join('\n') : '- none',
        '',
        'Return JSON only.',
    ].join('\n');
};

const generateInsightsForCouple = async ({ userId, partnerId, existingInsights = [], force = false }) => {
    try {
        if (!isSupabaseConfigured()) {
            return { error: 'supabase_not_configured' };
        }
        if (!isOpenRouterConfigured()) {
            return { error: 'openrouter_not_configured' };
        }

        const coupleIds = getOrderedCoupleIds(userId, partnerId);
        if (!coupleIds) return { error: 'invalid_couple' };

        const supabase = getSupabase();
        const latestGeneratedAt = await getLatestInsightGeneratedAt(supabase, coupleIds, userId);
        if (!force && !shouldGenerateToday(latestGeneratedAt)) {
            return { success: true, insights: [], reason: 'already_generated_today', skipped: true };
        }

        const stats = await buildRelationshipStats(supabase, coupleIds, userId);
        const candidates = await fetchMemoryCandidates(supabase, userId);

        if (candidates.length < MIN_MEMORY_CANDIDATES) {
            return { success: true, insights: [], reason: 'insufficient_memory' };
        }

        const prompt = buildInsightPrompt({ candidates, stats, existingInsights });
        const messages = [
            {
                role: 'system',
                content: [
                    'You are a relationship insights analyst.',
                    'Generate helpful, specific, and kind insights based on provided signals.',
                    'Focus on patterns, values, triggers, or preferences that help this person grow.',
                    'Provide an actionable micro-step in evidenceSummary.',
                    'Keep language concise and non-judgmental.',
                ].join(' ')
            },
            { role: 'user', content: prompt }
        ];

        const llmResult = await callLLMWithRetry(
            {
                llmFunction: (modelOverride) => createChatCompletion({
                    model: modelOverride || INSIGHTS_MODEL,
                    messages,
                    temperature: 0.4,
                    maxTokens: 1400,
                    jsonSchema: INSIGHTS_JSON_SCHEMA,
                    reasoningEffort: 'high',
                }),
                schema: InsightsOutputSchema,
                primaryModel: INSIGHTS_MODEL,
            },
            {
                maxRetries: 2,
                baseDelayMs: 900,
                operationName: 'Insights generation',
                enableModelFallback: false,
            }
        );

        const sanitizedInsights = (llmResult.insights || []).map((insight) => ({
            category: clampText(insight.category, 32) || 'general',
            insightText: clampText(insight.text, 160),
            evidenceSummary: clampText(insight.evidenceSummary, 180),
            confidenceScore: Math.min(Math.max(insight.confidenceScore || 0.6, 0.3), 0.95),
        })).filter((insight) => insight.insightText);

        if (sanitizedInsights.length === 0) {
            return { success: true, insights: [], reason: 'empty_generation' };
        }

        const generatedAt = new Date().toISOString();
        const expiresAt = new Date(Date.now() + INSIGHTS_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

        const rows = sanitizedInsights.slice(0, INSIGHTS_MAX).map((insight) => ({
            user_a_id: coupleIds.user_a_id,
            user_b_id: coupleIds.user_b_id,
            recipient_user_id: userId,
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

        const { error: purgeError } = await supabase
            .from('insights')
            .delete()
            .eq('user_a_id', coupleIds.user_a_id)
            .eq('user_b_id', coupleIds.user_b_id)
            .eq('recipient_user_id', userId)
            .lt('generated_at', generatedAt);

        if (purgeError) {
            console.warn('[Insights] Failed to purge old insights:', purgeError);
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
    } catch (error) {
        return { error: error?.message || 'insights_generation_failed' };
    }
};

module.exports = {
    generateInsightsForCouple,
};
