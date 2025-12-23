/**
 * Calendar Routes
 * 
 * Handles calendar events, event plans, and AI-powered event planning.
 */

const express = require('express');
const router = express.Router();
const { requireSupabase, requireAuthUserId, getPartnerIdForUser } = require('../lib/auth');
const { canUseFeature } = require('../lib/usageLimits');

const isProd = process.env.NODE_ENV === 'production';
const safeErrorMessage = (error) => (isProd ? 'Internal server error' : (error?.message || String(error)));

// Get calendar events
router.get('/events', async (req, res) => {
    try {
        const viewerId = await requireAuthUserId(req);

        const supabase = requireSupabase();
        const partnerId = await getPartnerIdForUser(supabase, viewerId);

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
router.post('/events', async (req, res) => {
    try {
        const viewerId = await requireAuthUserId(req);
        const { title, date, type, emoji, isRecurring, notes, isSecret } = req.body;

        const supabase = requireSupabase();

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
router.put('/events/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const viewerId = await requireAuthUserId(req);
        const { title, date, type, emoji, isRecurring, notes, isSecret } = req.body;

        const supabase = requireSupabase();

        const { data: existing, error: existingError } = await supabase
            .from('calendar_events')
            .select('created_by,is_secret')
            .eq('id', id)
            .single();

        if (existingError) throw existingError;

        const partnerId = await getPartnerIdForUser(supabase, viewerId);
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
router.delete('/events/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const viewerId = await requireAuthUserId(req);

        const supabase = requireSupabase();

        const { data: existing, error: existingError } = await supabase
            .from('calendar_events')
            .select('created_by,is_secret')
            .eq('id', id)
            .single();

        if (existingError) throw existingError;

        const partnerId = await getPartnerIdForUser(supabase, viewerId);
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
            .select('id,event_key,style,plan,checklist_state,updated_at')
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
            updatedAt: p.updated_at,
        }));

        return res.json({ plans });
    } catch (error) {
        console.error('Error fetching event plans:', error);
        res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

// Update event plan checklist state
router.patch('/event-plans/:id', async (req, res) => {
    try {
        const viewerId = await requireAuthUserId(req);
        const { id } = req.params;
        const { checklistState } = req.body || {};

        if (!checklistState || typeof checklistState !== 'object') {
            return res.status(400).json({ error: 'checklistState must be an object' });
        }

        const supabase = requireSupabase();
        const { data, error } = await supabase
            .from('event_plans')
            .update({ checklist_state: checklistState })
            .eq('id', id)
            .eq('user_id', viewerId)
            .select('id,event_key,style,checklist_state,updated_at')
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
            updatedAt: data.updated_at,
        });
    } catch (error) {
        console.error('Error updating plan checklist:', error);
        res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

// AI-powered event planning suggestions
router.post('/plan-event', async (req, res) => {
    try {
        const {
            event,
            partnerId,
            partnerDisplayName,
            currentUserName,
            style,
            // Back-compat (old client payload)
            eventTitle,
            eventType,
            eventDate,
            eventKey,
        } = req.body || {};

        const viewerId = await requireAuthUserId(req);
        const supabase = requireSupabase();
        const resolvedPartnerId = await getPartnerIdForUser(supabase, viewerId);

        const normalizedEvent = event || {
            title: eventTitle,
            type: eventType,
            date: eventDate,
        };

        if (!resolvedPartnerId) {
            return res.status(400).json({ error: 'No partner connected' });
        }
        if (!partnerId || String(partnerId) !== String(resolvedPartnerId)) {
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
            partnerId: resolvedPartnerId,
            partnerDisplayName,
            currentUserName,
            style,
        });

        // Persist plan (best effort) when we have a non-fallback plan and an eventKey
        if (eventKey && result?.meta?.fallback === false && result?.plan) {
            try {
                const { data: upserted } = await supabase
                    .from('event_plans')
                    .upsert({
                        user_id: viewerId,
                        partner_id: resolvedPartnerId,
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
