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

// Get calendar events
router.get('/events', requirePartner, async (req, res) => {
    try {
        const { userId: viewerId, partnerId, supabase } = req;

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

        const { data: events, error } = await query;

        if (error) throw error;

        // Transform to camelCase
        const transformed = events.map(e => ({
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

        res.json(transformed);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

// Create calendar event
router.post('/events', requirePartner, async (req, res) => {
    try {
        const { userId: viewerId, partnerId, supabase } = req;
        const { title, date, type, emoji, isRecurring, notes, isSecret } = req.body;

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
        res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

// Update calendar event
router.put('/events/:id', requirePartner, async (req, res) => {
    try {
        const { id } = req.params;
        const { userId: viewerId, partnerId, supabase } = req;
        const { title, date, type, emoji, isRecurring, notes, isSecret } = req.body;

        const { data: existing, error: existingError } = await supabase
            .from('calendar_events')
            .select('created_by,is_secret')
            .eq('id', id)
            .single();

        if (existingError) throw existingError;

        const canEdit = existing.created_by === viewerId || (partnerId && existing.created_by === partnerId && existing.is_secret === false);
        if (!canEdit) return res.status(403).json({ error: 'Not allowed to update this event' });

        const { data: event, error } = await supabase
            .from('calendar_events')
            .update({
                title,
                event_date: date,
                event_type: type,
                emoji,
                is_recurring: isRecurring,
                ...(existing.created_by === viewerId ? { is_secret: !!isSecret } : {}),
                notes
            })
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
        res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

// Delete calendar event
router.delete('/events/:id', requirePartner, async (req, res) => {
    try {
        const { id } = req.params;
        const { userId: viewerId, partnerId, supabase } = req;

        const { data: existing, error: existingError } = await supabase
            .from('calendar_events')
            .select('created_by,is_secret')
            .eq('id', id)
            .single();

        if (existingError) throw existingError;

        const canDelete = existing.created_by === viewerId || (partnerId && existing.created_by === partnerId && existing.is_secret === false);
        if (!canDelete) return res.status(403).json({ error: 'Not allowed to delete this event' });

        const { error } = await supabase
            .from('calendar_events')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
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
        res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

// Get event plans for a specific event key
router.get('/event-plans', async (req, res) => {
    try {
        const viewerId = await requireAuthUserId(req);
        const { eventKey } = req.query || {};

        if (!eventKey) return res.status(400).json({ error: 'eventKey is required' });

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
        res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
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
            return res.status(400).json({ error: 'checklistState or notes is required' });
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
            if (error.code === '42P01') return res.status(409).json({ error: 'event_plans table missing (run migration 015)' });
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
        res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
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
            return res.status(404).json({ error: 'Plan not found' });
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
        res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
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
            return res.status(400).json({ error: 'Invalid partnerId for current user' });
        }

        const usage = await canUseFeature({ userId: viewerId, type: 'plan' });
        if (!usage.allowed) {
            return res.status(403).json({ error: 'Usage limit reached', usage });
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

        // Record usage for a successful plan generation (best-effort).
        if (result?.meta?.fallback === false) {
            incrementUsage({ userId: viewerId, type: 'plan' }).catch((e) => {
                console.warn('[Planner] Failed to increment plan usage:', e?.message || e);
            });
        }

        return res.json(result);

    } catch (error) {
        console.error('Planning error:', error);
        res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

module.exports = router;
