/**
 * Insights Routes
 */

const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const { requirePartner } = require('../middleware/requirePartner');
const { getOrderedCoupleIds, getLevelStatus } = require('../lib/xpService');
const { processDailyInsights } = require('../lib/insightsSchedulerService');
const { getUserSubscriptionTier } = require('../lib/usageLimits');
const { safeErrorMessage } = require('../lib/shared/errorUtils');
const { rateLimitMiddleware } = require('../lib/security/index');
const { sendError } = require('../lib/http');

const INSIGHTS_MIN_LEVEL = 10;

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

        const coupleIds = getOrderedCoupleIds(userId, partnerId);
        if (!coupleIds) {
            return sendError(res, 400, 'INVALID_INPUT', 'Invalid couple');
        }
        const { data: latestRow, error: latestError } = await supabase
            .from('insights')
            .select('generated_at')
            .eq('user_a_id', coupleIds.user_a_id)
            .eq('user_b_id', coupleIds.user_b_id)
            .eq('recipient_user_id', userId)
            .eq('is_active', true)
            .order('generated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (latestError) throw latestError;

        let insights = [];
        if (latestRow?.generated_at) {
            const { data: latestInsights, error: insightsError } = await supabase
                .from('insights')
                .select('*')
                .eq('user_a_id', coupleIds.user_a_id)
                .eq('user_b_id', coupleIds.user_b_id)
                .eq('recipient_user_id', userId)
                .eq('is_active', true)
                .eq('generated_at', latestRow.generated_at)
                .order('generated_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (insightsError) throw insightsError;
            insights = latestInsights || [];
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
            meta: null,
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

router.post('/process-daily', async (req, res) => {
    try {
        const secret = process.env.INSIGHTS_CRON_SECRET;
        const isProd = process.env.NODE_ENV === 'production';

        if (secret) {
            const provided = req.headers['x-cron-secret'];
            if (!provided || Buffer.byteLength(provided) !== Buffer.byteLength(secret) ||
                !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(secret))) {
                return sendError(res, 403, 'FORBIDDEN', 'Invalid cron secret');
            }
        } else if (isProd) {
            return sendError(res, 403, 'FORBIDDEN', 'Cron secret required');
        }

        const result = await processDailyInsights();
        return res.json({ success: true, result });
    } catch (error) {
        console.error('[Insights] Failed to process daily insights:', error);
        return sendError(res, error.statusCode || 500, 'SERVER_ERROR', safeErrorMessage(error));
    }
});

module.exports = router;
