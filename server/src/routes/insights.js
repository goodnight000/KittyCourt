/**
 * Insights Routes
 */

const express = require('express');
const router = express.Router();
const { requireAuthUserId, requireSupabase } = require('../lib/auth');
const { requirePartner } = require('../middleware/requirePartner');
const { getOrderedCoupleIds, getLevelStatus } = require('../lib/xpService');
const { generateInsightsForCouple } = require('../lib/insightService');
const { getUserSubscriptionTier } = require('../lib/usageLimits');
const { safeErrorMessage } = require('../lib/shared/errorUtils');
const { rateLimitMiddleware } = require('../lib/security/index');
const { sendError } = require('../lib/http');

const INSIGHTS_MIN_LEVEL = 10;

const buildConsentState = (profile) => {
    const now = new Date();
    const selfPaused = profile?.ai_insights_paused_until
        ? new Date(profile.ai_insights_paused_until) > now
        : false;

    return {
        selfConsent: !!profile?.ai_insights_consent,
        partnerConsent: true,
        selfPausedUntil: profile?.ai_insights_paused_until || null,
        partnerPausedUntil: null,
        selfPaused,
        partnerPaused: false,
    };
};

router.get('/', requirePartner, rateLimitMiddleware('insights'), async (req, res) => {
    try {
        const { userId, partnerId, supabase } = req;

        // Pagination params
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const offset = parseInt(req.query.offset) || 0;

        const tier = await getUserSubscriptionTier(userId);
        if (tier !== 'pause_gold') {
            return sendError(res, 403, 'SUBSCRIPTION_REQUIRED', 'Pause Gold required');
        }

        const levelStatus = await getLevelStatus(userId, partnerId);
        if (!levelStatus?.success) {
            return sendError(res, 500, 'SERVER_ERROR', safeErrorMessage(levelStatus?.error || 'Level check failed'));
        }
        if (!levelStatus?.data || levelStatus.data.level < INSIGHTS_MIN_LEVEL) {
            return sendError(res, 403, 'LEVEL_REQUIRED', `Level ${INSIGHTS_MIN_LEVEL} required`);
        }

        let { data: profile, error } = await supabase
            .from('profiles')
            .select('id, ai_insights_consent, ai_insights_consent_at, ai_insights_paused_until')
            .eq('id', userId)
            .single();

        if (error) throw error;

        // Check consent status without auto-consenting
        const consent = buildConsentState(profile || null);

        // If either user hasn't explicitly consented, return requiresConsent flag
        if (!consent.selfConsent) {
            return res.json({
                insights: [],
                data: [],
                consent,
                requiresConsent: true,
                message: 'AI insights require your consent',
                pagination: { limit, offset, hasMore: false }
            });
        }

        // Check for paused state
        if (consent.selfPaused) {
            return res.json({
                insights: [],
                data: [],
                consent,
                pagination: { limit, offset, hasMore: false }
            });
        }

        const coupleIds = getOrderedCoupleIds(userId, partnerId);
        if (!coupleIds) {
            return sendError(res, 400, 'INVALID_INPUT', 'Invalid couple');
        }
        let { data: insights, error: insightsError } = await supabase
            .from('insights')
            .select('*')
            .eq('user_a_id', coupleIds.user_a_id)
            .eq('user_b_id', coupleIds.user_b_id)
            .eq('recipient_user_id', userId)
            .eq('is_active', true)
            .order('generated_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (insightsError) throw insightsError;

        let meta = null;
        const generated = await generateInsightsForCouple({
            userId,
            partnerId,
            existingInsights: (insights || []).map((insight) => ({
                text: insight.insight_text,
                category: insight.category
            }))
        });

        if (generated?.error) {
            meta = { reason: generated.error };
        } else if (generated?.reason) {
            meta = { reason: generated.reason };
        }

        if (!generated?.error && generated?.insights?.length) {
            const refreshed = await supabase
                .from('insights')
                .select('*')
                .eq('user_a_id', coupleIds.user_a_id)
                .eq('user_b_id', coupleIds.user_b_id)
                .eq('recipient_user_id', userId)
                .eq('is_active', true)
                .order('generated_at', { ascending: false })
                .range(offset, offset + limit - 1);
            if (!refreshed.error) {
                insights = refreshed.data || insights;
            }
        }

        const response = (insights || []).map((insight) => ({
            id: insight.id,
            category: insight.category,
            text: insight.insight_text,
            evidenceSummary: insight.evidence_summary,
            confidenceScore: insight.confidence_score,
            generatedAt: insight.generated_at,
        }));

        return res.json({
            insights: response,
            data: response,
            consent,
            meta,
            pagination: {
                limit,
                offset,
                hasMore: response.length === limit
            }
        });
    } catch (error) {
        console.error('[Insights] Failed to fetch insights:', error);
        return sendError(res, error.statusCode || 500, 'SERVER_ERROR', safeErrorMessage(error));
    }
});

router.post('/consent', async (req, res) => {
    try {
        const { consent } = req.body || {};
        const supabase = requireSupabase();
        const userId = await requireAuthUserId(req);

        const nextConsent = !!consent;
        const nowIso = new Date().toISOString();
        const updates = {
            ai_insights_consent: nextConsent,
            ai_insights_consent_at: nowIso,
            ai_insights_paused_until: null,
        };

        const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', userId)
            .select('ai_insights_consent, ai_insights_consent_at, ai_insights_paused_until')
            .single();

        if (error) throw error;

        return res.json({ success: true, profile: data });
    } catch (error) {
        console.error('[Insights] Failed to update consent:', error);
        return sendError(res, error.statusCode || 500, 'SERVER_ERROR', safeErrorMessage(error));
    }
});

router.post('/pause', async (req, res) => {
    try {
        const { days } = req.body || {};
        const pauseDays = Number.isFinite(Number(days)) ? Math.max(Number(days), 1) : 7;

        const supabase = requireSupabase();
        const userId = await requireAuthUserId(req);
        const pausedUntil = new Date(Date.now() + pauseDays * 24 * 60 * 60 * 1000).toISOString();

        const { data, error } = await supabase
            .from('profiles')
            .update({ ai_insights_paused_until: pausedUntil })
            .eq('id', userId)
            .select('ai_insights_paused_until')
            .single();

        if (error) throw error;

        return res.json({ success: true, pausedUntil: data?.ai_insights_paused_until || pausedUntil });
    } catch (error) {
        console.error('[Insights] Failed to pause insights:', error);
        return sendError(res, error.statusCode || 500, 'SERVER_ERROR', safeErrorMessage(error));
    }
});

router.post('/:id/feedback', requirePartner, async (req, res) => {
    try {
        const { id } = req.params;
        const { helpful } = req.body || {};
        const isHelpful = !!helpful;

        const { userId, partnerId, supabase } = req;

        const { data: insight, error } = await supabase
            .from('insights')
            .select('id, helpful_count, not_helpful_count, user_a_id, user_b_id, recipient_user_id')
            .eq('id', id)
            .single();

        if (error || !insight) {
            return sendError(res, 404, 'NOT_FOUND', 'Insight not found');
        }

        const matchesCouple = (insight.user_a_id === userId && insight.user_b_id === partnerId)
            || (insight.user_a_id === partnerId && insight.user_b_id === userId);

        if (!matchesCouple) {
            return sendError(res, 403, 'FORBIDDEN', 'Access denied');
        }

        if (insight.recipient_user_id && insight.recipient_user_id !== userId) {
            return sendError(res, 403, 'FORBIDDEN', 'Access denied');
        }

        const updates = isHelpful
            ? { helpful_count: (insight.helpful_count || 0) + 1 }
            : { not_helpful_count: (insight.not_helpful_count || 0) + 1 };

        const { data: updated, error: updateError } = await supabase
            .from('insights')
            .update(updates)
            .eq('id', id)
            .select('id, helpful_count, not_helpful_count')
            .single();

        if (updateError) throw updateError;

        return res.json({ success: true, insight: updated });
    } catch (error) {
        console.error('[Insights] Failed to record feedback:', error);
        return sendError(res, error.statusCode || 500, 'SERVER_ERROR', safeErrorMessage(error));
    }
});

module.exports = router;
