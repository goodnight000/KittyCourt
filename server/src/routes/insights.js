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

const INSIGHTS_MIN_LEVEL = 10;

const buildConsentState = (profiles, userId, partnerId) => {
    const self = profiles.find(p => p.id === userId);
    const partner = profiles.find(p => p.id === partnerId);

    const now = new Date();
    const selfPaused = self?.ai_insights_paused_until ? new Date(self.ai_insights_paused_until) > now : false;
    const partnerPaused = partner?.ai_insights_paused_until ? new Date(partner.ai_insights_paused_until) > now : false;

    return {
        selfConsent: !!self?.ai_insights_consent,
        partnerConsent: !!partner?.ai_insights_consent,
        selfPausedUntil: self?.ai_insights_paused_until || null,
        partnerPausedUntil: partner?.ai_insights_paused_until || null,
        selfPaused,
        partnerPaused,
    };
};

router.get('/', requirePartner, async (req, res) => {
    try {
        const { userId, partnerId, supabase } = req;

        const tier = await getUserSubscriptionTier(userId);
        if (tier !== 'pause_gold') {
            return res.status(403).json({ error: 'Pause Gold required' });
        }

        const levelStatus = await getLevelStatus(userId, partnerId);
        if (!levelStatus?.success) {
            return res.status(500).json({ error: safeErrorMessage(levelStatus?.error || 'Level check failed') });
        }
        if (!levelStatus?.data || levelStatus.data.level < INSIGHTS_MIN_LEVEL) {
            return res.status(403).json({ error: `Level ${INSIGHTS_MIN_LEVEL} required` });
        }

        let { data: profiles, error } = await supabase
            .from('profiles')
            .select('id, ai_insights_consent, ai_insights_consent_at, ai_insights_paused_until')
            .in('id', [userId, partnerId]);

        if (error) throw error;

        const autoConsentIds = (profiles || [])
            .filter(profile => profile.ai_insights_consent_at == null)
            .map(profile => profile.id);

        if (autoConsentIds.length > 0) {
            const nowIso = new Date().toISOString();
            const { error: autoConsentError } = await supabase
                .from('profiles')
                .update({
                    ai_insights_consent: true,
                    ai_insights_consent_at: nowIso,
                })
                .in('id', autoConsentIds);

            if (autoConsentError) throw autoConsentError;

            profiles = (profiles || []).map((profile) => (
                autoConsentIds.includes(profile.id)
                    ? {
                        ...profile,
                        ai_insights_consent: true,
                        ai_insights_consent_at: nowIso,
                    }
                    : profile
            ));
        }

        const consent = buildConsentState(profiles || [], userId, partnerId);
        if (!consent.selfConsent || !consent.partnerConsent || consent.selfPaused || consent.partnerPaused) {
            return res.json({ insights: [], consent });
        }

        const coupleIds = getOrderedCoupleIds(userId, partnerId);
        if (!coupleIds) {
            return res.status(400).json({ error: 'Invalid couple' });
        }
        const { data: insights, error: insightsError } = await supabase
            .from('insights')
            .select('*')
            .eq('user_a_id', coupleIds.user_a_id)
            .eq('user_b_id', coupleIds.user_b_id)
            .eq('is_active', true)
            .order('generated_at', { ascending: false })
            .limit(10);

        if (insightsError) throw insightsError;

        if (!insights || insights.length === 0) {
            const generated = await generateInsightsForCouple({ userId, partnerId });
            if (generated?.insights?.length) {
                return res.json({
                    insights: generated.insights.map((insight) => ({
                        id: insight.id,
                        category: insight.category,
                        text: insight.insight_text,
                        evidenceSummary: insight.evidence_summary,
                        confidenceScore: insight.confidence_score,
                        generatedAt: insight.generated_at,
                    })),
                    consent,
                });
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

        return res.json({ insights: response, consent });
    } catch (error) {
        console.error('[Insights] Failed to fetch insights:', error);
        return res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
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
        return res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
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
        return res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
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
            .select('id, helpful_count, not_helpful_count, user_a_id, user_b_id')
            .eq('id', id)
            .single();

        if (error || !insight) {
            return res.status(404).json({ error: 'Insight not found' });
        }

        const matchesCouple = (insight.user_a_id === userId && insight.user_b_id === partnerId)
            || (insight.user_a_id === partnerId && insight.user_b_id === userId);

        if (!matchesCouple) {
            return res.status(403).json({ error: 'Access denied' });
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
        return res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

module.exports = router;
