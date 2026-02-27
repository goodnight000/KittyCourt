/**
 * Calendar Routes
 * 
 * Handles calendar events, event plans, and AI-powered event planning.
 */

const express = require('express');
const router = express.Router();
const { requireAuthUserId, requireSupabase } = require('../lib/auth');
const { requirePartner } = require('../middleware/requirePartner');
const { canUseFeature } = require('../lib/usageLimits');
const { awardXP, ACTION_TYPES } = require('../lib/xpService');
const { recordChallengeAction, CHALLENGE_ACTIONS } = require('../lib/challengeService');
const { resolveRequestLanguage } = require('../lib/language');
const { safeErrorMessage } = require('../lib/shared/errorUtils');
const { processSecureInput, securityConfig, llmSecurityMiddleware } = require('../lib/security/index');
const { evaluateAbuseRisk, applyAbuseDelay } = require('../lib/abuse/abuseGuardrails');
const { sendError } = require('../lib/http');

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ISO date string validation (YYYY-MM-DD or full ISO 8601)
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;

// Get calendar events
router.get('/events', requirePartner, async (req, res) => {
    try {
        const { userId: viewerId, partnerId, supabase } = req;

        // Pagination params
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const offset = parseInt(req.query.offset) || 0;

        let query = supabase
            .from('calendar_events')
            .select('*')
            .order('event_date', { ascending: true });

        // Viewer can see:
        // - their own events (including secret)
        // - partner events only if not secret
        if (partnerId) {
            query = query.or(`and(created_by.eq.${viewerId}),and(created_by.eq.${partnerId},is_secret.eq.false)`);
        } else {
            query = query.eq('created_by', viewerId);
        }

        // Apply pagination
        query = query.range(offset, offset + limit - 1);

        const { data: events, error } = await query;

        if (error) throw error;

        // Transform to camelCase
        const transformed = (events || []).map(e => ({
            id: e.id,
            createdBy: e.created_by,
            title: e.title,
            emoji: e.emoji,
            date: e.event_date,
            type: e.event_type,
            notes: e.notes,
            isRecurring: e.is_recurring,
            isSecret: e.is_secret,
            recurrencePattern: e.recurrence_pattern,
            createdAt: e.created_at
        }));

        res.json({
            data: transformed,
            pagination: {
                limit,
                offset,
                hasMore: transformed.length === limit
            }
        });
    } catch (error) {
        console.error('Error fetching events:', error);
        return sendError(res, error.statusCode || 500, 'SERVER_ERROR', safeErrorMessage(error));
    }
});

// Create calendar event
router.post('/events', requirePartner, async (req, res) => {
    try {
        const { userId: viewerId, partnerId, supabase } = req;
        const { title, date, type, emoji, isRecurring, notes, isSecret } = req.body;

        // Input validation
        if (!title || typeof title !== 'string' || title.trim().length === 0) {
            return sendError(res, 400, 'INVALID_TITLE', 'title is required and must be a non-empty string');
        }
        if (title.length > 200) {
            return sendError(res, 400, 'INVALID_TITLE', 'title must be 200 characters or less');
        }
        if (!date || typeof date !== 'string') {
            return sendError(res, 400, 'INVALID_DATE', 'date is required and must be a string');
        }
        if (!ISO_DATE_REGEX.test(date)) {
            return sendError(res, 400, 'INVALID_DATE', 'date must be a valid ISO date string (YYYY-MM-DD or ISO 8601)');
        }
        if (type !== undefined && typeof type !== 'string') {
            return sendError(res, 400, 'INVALID_TYPE', 'type must be a string');
        }
        if (emoji !== undefined && typeof emoji !== 'string') {
            return sendError(res, 400, 'INVALID_EMOJI', 'emoji must be a string');
        }
        if (isRecurring !== undefined && typeof isRecurring !== 'boolean') {
            return sendError(res, 400, 'INVALID_RECURRING', 'isRecurring must be a boolean');
        }
        if (notes !== undefined && notes !== null && typeof notes !== 'string') {
            return sendError(res, 400, 'INVALID_NOTES', 'notes must be a string');
        }
        if (isSecret !== undefined && typeof isSecret !== 'boolean') {
            return sendError(res, 400, 'INVALID_SECRET', 'isSecret must be a boolean');
        }

        const { data: event, error } = await supabase
            .from('calendar_events')
            .insert({
                title,
                event_date: date,
                event_type: type || 'custom',
                emoji: emoji || '📅',
                is_recurring: isRecurring || false,
                created_by: viewerId,
                is_secret: !!isSecret,
                notes
            })
            .select()
            .single();

        if (error) throw error;

        if (partnerId) {
            try {
                await awardXP({
                    userId: viewerId,
                    partnerId,
                    actionType: ACTION_TYPES.CALENDAR_EVENT,
                    sourceId: event.id,
                });
            } catch (xpError) {
                console.warn('[Calendar] XP award failed:', xpError?.message || xpError);
            }

            try {
                await recordChallengeAction({
                    userId: viewerId,
                    partnerId,
                    action: CHALLENGE_ACTIONS.CALENDAR_EVENT,
                    sourceId: event.id,
                });
            } catch (challengeError) {
                console.warn('[Calendar] Challenge progress failed:', challengeError?.message || challengeError);
            }
        }

        res.json({
            id: event.id,
            createdBy: event.created_by,
            title: event.title,
            emoji: event.emoji,
            date: event.event_date,
            type: event.event_type,
            notes: event.notes,
            isRecurring: event.is_recurring,
            isSecret: event.is_secret,
            createdAt: event.created_at
        });
    } catch (error) {
        console.error('Error creating event:', error);
        return sendError(res, error.statusCode || 500, 'SERVER_ERROR', safeErrorMessage(error));
    }
});

// Update calendar event
router.put('/events/:id', requirePartner, async (req, res) => {
    try {
        const { id } = req.params;
        const { userId: viewerId, partnerId, supabase } = req;
        const { title, date, type, emoji, isRecurring, notes, isSecret } = req.body;

        // Input validation
        if (!UUID_REGEX.test(id)) {
            return sendError(res, 400, 'INVALID_ID', 'Invalid event ID format');
        }
        if (title !== undefined && (typeof title !== 'string' || title.trim().length === 0)) {
            return sendError(res, 400, 'INVALID_TITLE', 'title must be a non-empty string');
        }
        if (title !== undefined && title.length > 200) {
            return sendError(res, 400, 'INVALID_TITLE', 'title must be 200 characters or less');
        }
        if (date !== undefined && typeof date !== 'string') {
            return sendError(res, 400, 'INVALID_DATE', 'date must be a string');
        }
        if (date !== undefined && !ISO_DATE_REGEX.test(date)) {
            return sendError(res, 400, 'INVALID_DATE', 'date must be a valid ISO date string (YYYY-MM-DD or ISO 8601)');
        }
        if (type !== undefined && typeof type !== 'string') {
            return sendError(res, 400, 'INVALID_TYPE', 'type must be a string');
        }
        if (emoji !== undefined && typeof emoji !== 'string') {
            return sendError(res, 400, 'INVALID_EMOJI', 'emoji must be a string');
        }
        if (isRecurring !== undefined && typeof isRecurring !== 'boolean') {
            return sendError(res, 400, 'INVALID_RECURRING', 'isRecurring must be a boolean');
        }
        if (notes !== undefined && notes !== null && typeof notes !== 'string') {
            return sendError(res, 400, 'INVALID_NOTES', 'notes must be a string');
        }
        if (isSecret !== undefined && typeof isSecret !== 'boolean') {
            return sendError(res, 400, 'INVALID_SECRET', 'isSecret must be a boolean');
        }

        const { data: existing, error: existingError } = await supabase
            .from('calendar_events')
            .select('created_by,is_secret')
            .eq('id', id)
            .single();

        if (existingError) throw existingError;

        const canEdit = existing.created_by === viewerId || (partnerId && existing.created_by === partnerId && existing.is_secret === false);
        if (!canEdit) return sendError(res, 403, 'FORBIDDEN', 'Not allowed to update this event');

        const updates = {};
        if (title !== undefined) updates.title = title;
        if (date !== undefined) updates.event_date = date;
        if (type !== undefined) updates.event_type = type;
        if (emoji !== undefined) updates.emoji = emoji;
        if (isRecurring !== undefined) updates.is_recurring = isRecurring;
        if (notes !== undefined) updates.notes = notes;
        if (isSecret !== undefined && existing.created_by === viewerId) updates.is_secret = !!isSecret;

        const { data: event, error } = await supabase
            .from('calendar_events')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json({
            id: event.id,
            createdBy: event.created_by,
            title: event.title,
            emoji: event.emoji,
            date: event.event_date,
            type: event.event_type,
            notes: event.notes,
            isRecurring: event.is_recurring,
            isSecret: event.is_secret
        });
    } catch (error) {
        console.error('Error updating event:', error);
        return sendError(res, error.statusCode || 500, 'SERVER_ERROR', safeErrorMessage(error));
    }
});

// Delete calendar event
router.delete('/events/:id', requirePartner, async (req, res) => {
    try {
        const { id } = req.params;
        const { userId: viewerId, partnerId, supabase } = req;

        if (!UUID_REGEX.test(id)) {
            return sendError(res, 400, 'INVALID_ID', 'Invalid event ID format');
        }

        const { data: existing, error: existingError } = await supabase
            .from('calendar_events')
            .select('created_by,is_secret')
            .eq('id', id)
            .single();

        if (existingError) throw existingError;

        const canDelete = existing.created_by === viewerId || (partnerId && existing.created_by === partnerId && existing.is_secret === false);
        if (!canDelete) return sendError(res, 403, 'FORBIDDEN', 'Not allowed to delete this event');

        const { error } = await supabase
            .from('calendar_events')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting event:', error);
        return sendError(res, error.statusCode || 500, 'SERVER_ERROR', safeErrorMessage(error));
    }
});

// --- Event Plans ---

// Check if event plans exist for given keys
router.post('/event-plans/exists', async (req, res) => {
    try {
        const viewerId = await requireAuthUserId(req);
        const { eventKeys } = req.body || {};

        if (!Array.isArray(eventKeys) || eventKeys.length === 0) {
            return res.json({ exists: {} });
        }

        const supabase = requireSupabase();
        const { data, error } = await supabase
            .from('event_plans')
            .select('event_key')
            .eq('user_id', viewerId)
            .in('event_key', eventKeys);

        if (error) {
            if (error.code === '42P01') return res.json({ exists: {} }); // table missing
            throw error;
        }

        const exists = {};
        for (const row of data || []) exists[row.event_key] = true;

        return res.json({ exists });
    } catch (error) {
        console.error('Error checking event plan existence:', error);
        return sendError(res, error.statusCode || 500, 'SERVER_ERROR', safeErrorMessage(error));
    }
});

// Get event plans for a specific event key
router.get('/event-plans', async (req, res) => {
    try {
        const viewerId = await requireAuthUserId(req);
        const { eventKey } = req.query || {};

        if (!eventKey) return sendError(res, 400, 'MISSING_FIELD', 'eventKey is required');

        const supabase = requireSupabase();
        const { data, error } = await supabase
            .from('event_plans')
            .select('id,event_key,style,plan,checklist_state,notes,updated_at')
            .eq('user_id', viewerId)
            .eq('event_key', eventKey)
            .order('updated_at', { ascending: false });

        if (error) {
            if (error.code === '42P01') return res.json({ plans: [] }); // table missing
            throw error;
        }

        const plans = (data || []).map((p) => ({
            id: p.id,
            eventKey: p.event_key,
            style: p.style,
            plan: p.plan,
            checklistState: p.checklist_state || {},
            notes: p.notes || '',
            updatedAt: p.updated_at,
        }));

        return res.json({ plans });
    } catch (error) {
        console.error('Error fetching event plans:', error);
        return sendError(res, error.statusCode || 500, 'SERVER_ERROR', safeErrorMessage(error));
    }
});

// Update event plan checklist state and/or notes
router.patch('/event-plans/:id', async (req, res) => {
    try {
        const viewerId = await requireAuthUserId(req);
        const { id } = req.params;
        const { checklistState, notes } = req.body || {};

        // Build update payload
        const updatePayload = {};
        if (checklistState && typeof checklistState === 'object') {
            updatePayload.checklist_state = checklistState;
        }
        if (typeof notes === 'string') {
            updatePayload.notes = notes.slice(0, 500); // Limit notes length
        }

        if (Object.keys(updatePayload).length === 0) {
            return sendError(res, 400, 'MISSING_FIELD', 'checklistState or notes is required');
        }

        const supabase = requireSupabase();
        const { data, error } = await supabase
            .from('event_plans')
            .update(updatePayload)
            .eq('id', id)
            .eq('user_id', viewerId)
            .select('id,event_key,style,checklist_state,notes,updated_at')
            .single();

        if (error) {
            if (error.code === '42P01') return sendError(res, 409, 'TABLE_MISSING', 'event_plans table missing (run migration 015)');
            throw error;
        }

        return res.json({
            id: data.id,
            eventKey: data.event_key,
            style: data.style,
            checklistState: data.checklist_state || {},
            notes: data.notes || '',
            updatedAt: data.updated_at,
        });
    } catch (error) {
        console.error('Error updating plan:', error);
        return sendError(res, error.statusCode || 500, 'SERVER_ERROR', safeErrorMessage(error));
    }
});

// Share event plan with partner
router.post('/event-plans/:id/share', requirePartner, async (req, res) => {
    try {
        const { id } = req.params;
        const { userId: viewerId, partnerId, supabase } = req;

        // Get plan and verify ownership
        const { data: plan, error: planError } = await supabase
            .from('event_plans')
            .select('event_snapshot, style, partner_id')
            .eq('id', id)
            .eq('user_id', viewerId)
            .single();

        if (planError || !plan) {
            return sendError(res, 404, 'NOT_FOUND', 'Plan not found');
        }

        // Get user's display name for notification
        const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', viewerId)
            .single();

        // Send push notification to partner
        try {
            const { sendNotificationToUser } = require('../lib/notificationService');
            await sendNotificationToUser(partnerId, {
                title: 'Plan Shared',
                body: `${profile?.display_name || 'Your partner'} shared a plan for ${plan.event_snapshot?.title || 'an event'}`,
                data: { screen: 'calendar' }
            });
        } catch (notifError) {
            console.warn('[Calendar] Failed to send share notification:', notifError?.message || notifError);
            // Continue even if notification fails
        }

        return res.json({ success: true });
    } catch (error) {
        console.error('Error sharing plan:', error);
        return sendError(res, error.statusCode || 500, 'SERVER_ERROR', safeErrorMessage(error));
    }
});

// AI-powered event planning suggestions
//
// Security: llmSecurityMiddleware validates input before handler runs.
// The middleware attaches req.sanitizedBody and req.securityContext.
// Note: requirePartner runs first to ensure authentication.
router.post('/plan-event', requirePartner, llmSecurityMiddleware('eventPlanner'), async (req, res) => {
    try {
        // Use sanitizedBody from middleware, fallback to req.body for backwards compatibility
        const body = req.sanitizedBody || req.body || {};
        const {
            event,
            partnerId: partnerIdFromClient,
            partnerDisplayName,
            currentUserName,
            style,
            // Back-compat (old client payload)
            eventTitle,
            eventType,
            eventDate,
            eventKey,
            challengeToken: challengeTokenFromBody,
        } = body;

        const { userId: viewerId, partnerId, supabase } = req;
        const language = await resolveRequestLanguage(req, supabase, viewerId);

        // Security context from middleware (for logging/debugging)
        const securityContext = req.securityContext;
        if (securityContext?.flaggedFields?.length > 0) {
            console.warn('[Calendar] Flagged fields in event planning:', securityContext.flaggedFields);
        }

        // Middleware already sanitized nested event fields via eventPlanner field mappings
        const normalizedEvent = event || {
            title: eventTitle,
            type: eventType,
            date: eventDate,
        };

        if (partnerIdFromClient && String(partnerIdFromClient) !== String(partnerId)) {
            return sendError(res, 400, 'INVALID_INPUT', 'Invalid partnerId for current user');
        }
        const challengeToken =
            req.headers['x-abuse-challenge-token']
            || challengeTokenFromBody
            || req.body?.challengeToken
            || null;

        const abuseCheck = await evaluateAbuseRisk({
            userId: viewerId,
            endpointKey: 'plan_event',
            payload: {
                event: normalizedEvent,
                style: style || 'cozy',
                eventKey: eventKey || null,
                securityFlags: securityContext?.flaggedFields?.length || 0,
            },
            context: {
                challengeToken,
            },
        });

        if (!abuseCheck.allowed) {
            if (abuseCheck.code === 'ABUSE_CHALLENGE_REQUIRED') {
                return res.status(429).json({
                    errorCode: abuseCheck.code,
                    error: abuseCheck.message || 'Challenge required.',
                    retryAfterMs: abuseCheck.retryAfterMs || 0,
                    challenge: abuseCheck.challenge || null,
                });
            }
            return sendError(
                res,
                429,
                abuseCheck.code || 'ABUSE_GUARDRAIL_BLOCKED',
                abuseCheck.message || 'Request temporarily blocked for safety.'
            );
        }

        await applyAbuseDelay(abuseCheck.delayMs);

        const usage = await canUseFeature({ userId: viewerId, type: 'plan' });
        if (!usage.allowed) {
            return sendError(res, 403, 'USAGE_LIMIT_REACHED', 'Usage limit reached');
        }

        const { generateEventPlan } = require('../lib/eventPlanner');
        const { incrementUsage } = require('../lib/usageTracking');

        const result = await generateEventPlan({
            event: normalizedEvent,
            userId: viewerId,
            partnerId,
            partnerDisplayName,
            currentUserName,
            style,
            language,
        });

        // Persist plan (best effort) when we have a non-fallback plan and an eventKey
        if (eventKey && result?.meta?.fallback === false && result?.plan) {
            try {
                const { data: upserted } = await supabase
                    .from('event_plans')
                    .upsert({
                        user_id: viewerId,
                        partner_id: partnerId,
                        event_key: eventKey,
                        event_snapshot: normalizedEvent,
                        style: style || 'cozy',
                        plan: result.plan,
                    }, { onConflict: 'user_id,event_key,style' })
                    .select('id')
                    .single();

                result.meta = { ...(result.meta || {}), planId: upserted?.id || null, eventKey };
            } catch (e) {
                console.warn('[Planner] Failed to persist plan:', e?.message || e);
                result.meta = { ...(result.meta || {}), planId: null, eventKey };
            }
        } else {
            result.meta = { ...(result.meta || {}), planId: null, eventKey: eventKey || null };
        }

        // Record usage for a successful plan generation (fail closed).
        // If metering is unavailable, do not return the generated plan.
        if (result?.meta?.fallback === false) {
            try {
                await incrementUsage({ userId: viewerId, type: 'plan' });
            } catch (e) {
                console.error('[Planner] Failed to increment plan usage:', e?.message || e);
                return sendError(res, 503, 'USAGE_METERING_FAILED', 'Unable to record usage right now. Please retry.');
            }
        }

        return res.json(result);

    } catch (error) {
        console.error('Planning error:', error);
        return sendError(res, error.statusCode || 500, 'SERVER_ERROR', safeErrorMessage(error));
    }
});

module.exports = router;
