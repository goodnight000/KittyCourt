/**
 * Pause Server
 * 
 * Express API server that uses Supabase for all data storage.
 * No more Prisma/SQLite - everything goes to Supabase!
 */

const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');

// Load environment variables from server/.env explicitly
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Import Supabase client
const { getSupabase, isSupabaseConfigured } = require('./lib/supabase');

// Import routes
const judgeRoutes = require('./routes/judge');
const memoryRoutes = require('./routes/memory');
const dailyQuestionsRoutes = require('./routes/dailyQuestions');

// NEW: Clean court architecture
const courtRoutes = require('./routes/court');
const { initializeCourtServices } = require('./lib/courtInit');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Initialize court services (WebSocket, SessionManager, DB recovery)
if (isSupabaseConfigured()) {
    initializeCourtServices(server).catch(err => {
        console.error('[App] Court services initialization failed:', err);
    });
} else {
    // Still init WebSocket without DB
    const courtWebSocket = require('./lib/courtWebSocket');
    courtWebSocket.initialize(server);
}

app.use(cors());
app.use(express.json());

// Auth helper (Supabase JWT via Authorization: Bearer <token>)
const requireAuthUserId = async (req) => {
    const header = req.headers.authorization || req.headers.Authorization || '';
    const match = typeof header === 'string' ? header.match(/^Bearer\s+(.+)$/i) : null;
    const token = match?.[1];

    if (!token) {
        const error = new Error('Missing Authorization bearer token');
        error.statusCode = 401;
        throw error;
    }

    const supabase = requireSupabase();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user?.id) {
        const err = new Error('Invalid or expired session');
        err.statusCode = 401;
        throw err;
    }

    return data.user.id;
};

const getPartnerIdForUser = async (supabase, userId) => {
    const { data, error } = await supabase
        .from('profiles')
        .select('partner_id')
        .eq('id', userId)
        .single();

    if (error) throw error;
    return data?.partner_id || null;
};

// Helper to check Supabase and get client
const requireSupabase = () => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.');
    }
    return getSupabase();
};

// --- Routes ---

// --- Judge Engine Routes ---
app.use('/api/judge', judgeRoutes);

// --- Memory System Routes ---
app.use('/api/memory', memoryRoutes);

// --- Daily Questions Routes ---
app.use('/api/daily-questions', dailyQuestionsRoutes);

// --- Court Session Routes (NEW Clean Architecture) ---
app.use('/api/court', courtRoutes);

// --- Cases with Verdicts ---

// Submit a Case (or update it)
app.post('/api/cases', async (req, res) => {
    try {
        const {
            id,
            userAId,
            userBId,
            userAInput,
            userAFeelings,
            userBInput,
            userBFeelings,
            status,
            verdict,
            caseTitle,
            severityLevel,
            primaryHissTag,
            shortResolution
        } = req.body;

        const supabase = requireSupabase();

        if (id) {
            // Update existing case
            const { data: updated, error: updateError } = await supabase
                .from('cases')
                .update({
                    user_a_input: userAInput,
                    user_a_feelings: userAFeelings,
                    user_b_input: userBInput,
                    user_b_feelings: userBFeelings,
                    status,
                    case_title: caseTitle,
                    severity_level: severityLevel,
                    primary_hiss_tag: primaryHissTag,
                    short_resolution: shortResolution
                })
                .eq('id', id)
                .select()
                .single();

            if (updateError) throw updateError;

            // If verdict provided, create a new verdict record
            if (verdict) {
                const { count } = await supabase
                    .from('verdicts')
                    .select('*', { count: 'exact', head: true })
                    .eq('case_id', id);

                await supabase.from('verdicts').insert({
                    case_id: id,
                    version: (count || 0) + 1,
                    content: typeof verdict === 'string' ? JSON.parse(verdict) : verdict
                });
            }

            // Fetch with verdicts
            const { data: result } = await supabase
                .from('cases')
                .select(`*, verdicts(*)`)
                .eq('id', id)
                .order('version', { foreignTable: 'verdicts', ascending: false })
                .single();

            return res.json(transformCase(result));
        } else {
            // Create new case
            const { data: newCase, error: insertError } = await supabase
                .from('cases')
                .insert({
                    user_a_id: userAId || null,
                    user_b_id: userBId || null,
                    user_a_input: userAInput || '',
                    user_a_feelings: userAFeelings || '',
                    user_b_input: userBInput || '',
                    user_b_feelings: userBFeelings || '',
                    status: status || 'PENDING',
                    case_title: caseTitle || null,
                    severity_level: severityLevel || null,
                    primary_hiss_tag: primaryHissTag || null,
                    short_resolution: shortResolution || null
                })
                .select()
                .single();

            if (insertError) throw insertError;

            // If verdict provided, create the first verdict record
            if (verdict) {
                await supabase.from('verdicts').insert({
                    case_id: newCase.id,
                    version: 1,
                    content: typeof verdict === 'string' ? JSON.parse(verdict) : verdict
                });
            }

            // Fetch with verdicts
            const { data: result } = await supabase
                .from('cases')
                .select(`*, verdicts(*)`)
                .eq('id', newCase.id)
                .order('version', { foreignTable: 'verdicts', ascending: false })
                .single();

            return res.json(transformCase(result));
        }
    } catch (error) {
        console.error('Error saving case:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add an addendum verdict to a case
app.post('/api/cases/:id/addendum', async (req, res) => {
    try {
        const { addendumBy, addendumText, verdict, caseTitle, severityLevel, primaryHissTag, shortResolution } = req.body;
        const caseId = req.params.id;

        const supabase = requireSupabase();

        const { count } = await supabase
            .from('verdicts')
            .select('*', { count: 'exact', head: true })
            .eq('case_id', caseId);

        // Create new verdict with addendum info
        await supabase.from('verdicts').insert({
            case_id: caseId,
            version: (count || 0) + 1,
            content: typeof verdict === 'string' ? JSON.parse(verdict) : verdict,
            addendum_by: addendumBy,
            addendum_text: addendumText
        });

        // Update case metadata with latest
        if (caseTitle || severityLevel || primaryHissTag || shortResolution) {
            await supabase.from('cases').update({
                case_title: caseTitle || undefined,
                severity_level: severityLevel || undefined,
                primary_hiss_tag: primaryHissTag || undefined,
                short_resolution: shortResolution || undefined
            }).eq('id', caseId);
        }

        // Fetch updated case
        const { data: result } = await supabase
            .from('cases')
            .select(`*, verdicts(*)`)
            .eq('id', caseId)
            .order('version', { foreignTable: 'verdicts', ascending: false })
            .single();

        res.json(transformCase(result));
    } catch (error) {
        console.error('Error adding addendum:', error);
        res.status(500).json({ error: error.message });
    }
});

// Rate the latest verdict for a case (per-user)
app.post('/api/cases/:id/rate', async (req, res) => {
    try {
        const caseId = req.params.id;
        const { userId, rating } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }
        const numericRating = Number(rating);
        if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
            return res.status(400).json({ error: 'rating must be an integer from 1 to 5' });
        }

        const supabase = requireSupabase();

        // Determine whether this user is user_a or user_b for the case
        const { data: caseRow, error: caseError } = await supabase
            .from('cases')
            .select('id, user_a_id, user_b_id')
            .eq('id', caseId)
            .single();

        if (caseError) throw caseError;

        let ratingColumn = null;
        if (String(caseRow.user_a_id) === String(userId)) {
            ratingColumn = 'rating_user_a';
        } else if (String(caseRow.user_b_id) === String(userId)) {
            ratingColumn = 'rating_user_b';
        } else {
            return res.status(403).json({ error: 'User is not part of this case' });
        }

        // Update the latest verdict by version
        const { data: latestVerdict, error: verdictFetchError } = await supabase
            .from('verdicts')
            .select('id, version')
            .eq('case_id', caseId)
            .order('version', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (verdictFetchError) throw verdictFetchError;
        if (!latestVerdict?.id) {
            return res.status(404).json({ error: 'No verdict found for this case' });
        }

        const { data: updatedVerdict, error: verdictUpdateError } = await supabase
            .from('verdicts')
            .update({ [ratingColumn]: numericRating })
            .eq('id', latestVerdict.id)
            .select('id, case_id, version, rating_user_a, rating_user_b')
            .single();

        if (verdictUpdateError) throw verdictUpdateError;

        return res.json({ ok: true, verdict: updatedVerdict });
    } catch (error) {
        console.error('Error rating verdict:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get Case History
app.get('/api/cases', async (req, res) => {
    try {
        const { userAId, userBId } = req.query;

        const supabase = requireSupabase();

        let query = supabase
            .from('cases')
            .select(`*, verdicts(*)`)
            .order('created_at', { ascending: false });

        if (userAId && userBId) {
            query = query.or(`and(user_a_id.eq.${userAId},user_b_id.eq.${userBId}),and(user_a_id.eq.${userBId},user_b_id.eq.${userAId})`);
        } else if (userAId || userBId) {
            const userId = userAId || userBId;
            query = query.or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`);
        }

        const { data: cases, error } = await query;

        if (error) throw error;

        res.json(cases.map(transformCase));
    } catch (error) {
        console.error('Error fetching cases:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get single case with all verdicts
app.get('/api/cases/:id', async (req, res) => {
    try {
        const supabase = requireSupabase();

        const { data: caseItem, error } = await supabase
            .from('cases')
            .select(`*, verdicts(*)`)
            .eq('id', req.params.id)
            .order('version', { foreignTable: 'verdicts', ascending: false })
            .single();

        if (error || !caseItem) {
            return res.status(404).json({ error: 'Case not found' });
        }

        res.json(transformCase(caseItem));
    } catch (error) {
        console.error('Error fetching case:', error);
        res.status(500).json({ error: error.message });
    }
});

// Helper to transform case data for client
function transformCase(c) {
    if (!c) return null;

    const verdicts = c.verdicts || [];
    verdicts.sort((a, b) => b.version - a.version);

    return {
        id: c.id,
        userAId: c.user_a_id,
        userBId: c.user_b_id,
        userAInput: c.user_a_input,
        userAFeelings: c.user_a_feelings,
        userBInput: c.user_b_input,
        userBFeelings: c.user_b_feelings,
        status: c.status,
        caseTitle: c.case_title,
        severityLevel: c.severity_level,
        primaryHissTag: c.primary_hiss_tag,
        shortResolution: c.short_resolution,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        verdict: verdicts[0]?.content ? JSON.stringify(verdicts[0].content) : null,
        allVerdicts: verdicts.map(v => ({
            id: v.id,
            version: v.version,
            content: v.content ? JSON.stringify(v.content) : null,
            addendumBy: v.addendum_by,
            addendumText: v.addendum_text,
            createdAt: v.created_at
        }))
    };
}

// --- Economy/Transactions ---

app.post('/api/economy/transaction', async (req, res) => {
    try {
        const { userId, amount, type, description } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }

        const supabase = requireSupabase();

        // Create Transaction
        const { data: transaction, error: insertError } = await supabase
            .from('transactions')
            .insert({ user_id: userId, amount, type, description })
            .select()
            .single();

        if (insertError) throw insertError;

        // Calculate new balance from all transactions
        const { data: allTransactions } = await supabase
            .from('transactions')
            .select('amount')
            .eq('user_id', userId);

        const newBalance = (allTransactions || []).reduce((sum, t) => sum + t.amount, 0);

        res.json({ transaction, newBalance });
    } catch (error) {
        console.error('Error creating transaction:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get user's kibble balance from transactions
app.get('/api/economy/balance/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const supabase = requireSupabase();

        const { data: transactions } = await supabase
            .from('transactions')
            .select('amount')
            .eq('user_id', userId);

        const balance = (transactions || []).reduce((sum, t) => sum + t.amount, 0);

        res.json({ userId, balance });
    } catch (error) {
        console.error('Error fetching balance:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- Appreciations ---

app.post('/api/appreciations', async (req, res) => {
    try {
        const { fromUserId, toUserId, message, category, kibbleAmount = 10 } = req.body;

        if (!fromUserId || !toUserId) {
            return res.status(400).json({ error: 'fromUserId and toUserId are required' });
        }

        const supabase = requireSupabase();

        // Create the appreciation
        const { data: appreciation, error: insertError } = await supabase
            .from('appreciations')
            .insert({
                from_user_id: fromUserId,
                to_user_id: toUserId,
                message,
                category,
                kibble_amount: kibbleAmount
            })
            .select()
            .single();

        if (insertError) throw insertError;

        // Award kibble via transaction
        const { data: transaction } = await supabase
            .from('transactions')
            .insert({
                user_id: toUserId,
                amount: kibbleAmount,
                type: 'EARN',
                description: `Appreciated: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`
            })
            .select()
            .single();

        // Calculate new balance
        const { data: allTransactions } = await supabase
            .from('transactions')
            .select('amount')
            .eq('user_id', toUserId);

        const newBalance = (allTransactions || []).reduce((sum, t) => sum + t.amount, 0);

        res.json({
            appreciation: {
                ...appreciation,
                fromUserId: appreciation.from_user_id,
                toUserId: appreciation.to_user_id,
                kibbleAmount: appreciation.kibble_amount
            },
            transaction,
            newBalance
        });
    } catch (error) {
        console.error('Error creating appreciation:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get appreciations FOR a user
app.get('/api/appreciations/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const supabase = requireSupabase();

        const { data: appreciations, error } = await supabase
            .from('appreciations')
            .select('*')
            .eq('to_user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Transform to camelCase
        const transformed = appreciations.map(a => ({
            id: a.id,
            fromUserId: a.from_user_id,
            toUserId: a.to_user_id,
            message: a.message,
            category: a.category,
            kibbleAmount: a.kibble_amount,
            createdAt: a.created_at
        }));

        res.json(transformed);
    } catch (error) {
        console.error('Error fetching appreciations:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- Calendar Events ---

app.get('/api/calendar/events', async (req, res) => {
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
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

app.post('/api/calendar/events', async (req, res) => {
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
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

app.put('/api/calendar/events/:id', async (req, res) => {
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
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

app.delete('/api/calendar/events/:id', async (req, res) => {
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
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

// --- Event Plans (saved per user) ---

app.post('/api/calendar/event-plans/exists', async (req, res) => {
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
            if (error.code === '42P01') return res.json({ exists: {} }); // table missing (migration not applied yet)
            throw error;
        }

        const exists = {};
        for (const row of data || []) exists[row.event_key] = true;

        return res.json({ exists });
    } catch (error) {
        console.error('Error checking event plan existence:', error);
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

app.get('/api/calendar/event-plans', async (req, res) => {
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
            if (error.code === '42P01') return res.json({ plans: [] }); // table missing (migration not applied yet)
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
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

app.patch('/api/calendar/event-plans/:id', async (req, res) => {
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
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

// AI-powered event planning suggestions
app.post('/api/calendar/plan-event', async (req, res) => {
    try {
        const {
            event,
            userId,
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

        const normalizedEvent = event || {
            title: eventTitle,
            type: eventType,
            date: eventDate,
        };

        if (!partnerId) {
            return res.status(400).json({ error: 'partnerId is required' });
        }

        const { generateEventPlan } = require('./lib/eventPlanner');

        const result = await generateEventPlan({
            event: normalizedEvent,
            userId: viewerId,
            partnerId,
            partnerDisplayName,
            currentUserName,
            style,
        });

        // Persist plan (best effort) when we have a non-fallback plan and an eventKey
        if (eventKey && result?.meta?.fallback === false && result?.plan) {
            try {
                const supabase = requireSupabase();
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

        return res.json(result);

    } catch (error) {
        console.error('Planning error:', error);
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

// Root endpoint - for easy verification
app.get('/', (req, res) => {
    res.json({
        name: 'Pause API',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            health: '/api/health',
            judge: '/api/judge/health'
        }
    });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        supabase: isSupabaseConfigured(),
        timestamp: new Date().toISOString()
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Supabase configured: ${isSupabaseConfigured()}`);
    console.log(`WebSocket server initialized`);
});
