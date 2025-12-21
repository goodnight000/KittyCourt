/**
 * Pause Server
 * 
 * Express API server that uses Supabase for all data storage.
 * No more Prisma/SQLite - everything goes to Supabase!
 */

const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');

// Load environment variables (prefer repo root .env, allow server/.env to override)
const dotenv = require('dotenv');
const repoEnvPath = path.resolve(__dirname, '../../.env');
const serverEnvPath = path.resolve(__dirname, '../.env');

if (fs.existsSync(repoEnvPath)) {
    dotenv.config({ path: repoEnvPath });
}
if (fs.existsSync(serverEnvPath)) {
    dotenv.config({ path: serverEnvPath, override: true });
}

// Import Supabase client
const { isSupabaseConfigured } = require('./lib/supabase');
const { isOpenRouterConfigured } = require('./lib/openrouter');
const { requireSupabase, requireAuthUserId, getPartnerIdForUser } = require('./lib/auth');
const { corsMiddleware, securityHeaders } = require('./lib/security');
const { canUseFeature } = require('./lib/usageLimits');

// Import routes
const judgeRoutes = require('./routes/judge');
const memoryRoutes = require('./routes/memory');
const dailyQuestionsRoutes = require('./routes/dailyQuestions');
const usageRoutes = require('./routes/usage');
const webhookRoutes = require('./routes/webhooks');

// NEW: Clean court architecture
const courtRoutes = require('./routes/court');
const { initializeCourtServices } = require('./lib/courtInit');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(securityHeaders);

// Initialize court services (WebSocket, SessionManager, DB recovery)
initializeCourtServices(server).catch(err => {
    console.error('[App] Court services initialization failed:', err);
});

app.use(corsMiddleware());
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '256kb' }));
app.use(express.urlencoded({ extended: false, limit: process.env.JSON_BODY_LIMIT || '256kb' }));

const isProd = process.env.NODE_ENV === 'production';
const safeErrorMessage = (error) => (isProd ? 'Internal server error' : (error?.message || String(error)));

// --- Routes ---

// --- Judge Engine Routes ---
app.use('/api/judge', judgeRoutes);

// --- Memory System Routes ---
app.use('/api/memory', memoryRoutes);

// --- Daily Questions Routes ---
app.use('/api/daily-questions', dailyQuestionsRoutes);

// --- Court Session Routes (NEW Clean Architecture) ---
app.use('/api/court', courtRoutes);

// --- Usage Tracking Routes (Subscription limits) ---
app.use('/api/usage', usageRoutes);

// --- Webhook Routes (RevenueCat, etc.) ---
app.use('/api/webhooks', webhookRoutes);

// --- Cases with Verdicts ---

// Submit a Case (or update it)
app.post('/api/cases', async (req, res) => {
    try {
        const viewerId = await requireAuthUserId(req);
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
        const partnerId = await getPartnerIdForUser(supabase, viewerId);

        if (isProd && verdict) {
            return res.status(400).json({ error: 'Client-supplied verdicts are not allowed' });
        }

        if (id) {
            const { data: existingCase, error: existingError } = await supabase
                .from('cases')
                .select('id,user_a_id,user_b_id,status')
                .eq('id', id)
                .single();

            if (existingError || !existingCase) {
                return res.status(404).json({ error: 'Case not found' });
            }

            const isUserA = String(existingCase.user_a_id) === String(viewerId);
            const isUserB = String(existingCase.user_b_id) === String(viewerId);
            if (!isUserA && !isUserB) {
                return res.status(403).json({ error: 'Forbidden' });
            }

            // Update existing case
            const { data: updated, error: updateError } = await supabase
                .from('cases')
                .update({
                    user_a_input: isUserA ? (userAInput || '') : undefined,
                    user_a_feelings: isUserA ? (userAFeelings || '') : undefined,
                    user_b_input: isUserB ? (userBInput || '') : undefined,
                    user_b_feelings: isUserB ? (userBFeelings || '') : undefined,
                    ...(isProd ? {} : { status: status || undefined }),
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
            if (!isProd && verdict) {
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
            if (userAId && String(userAId) !== String(viewerId)) {
                return res.status(403).json({ error: 'userAId does not match authenticated user' });
            }
            if (userBId && partnerId && String(userBId) !== String(partnerId)) {
                return res.status(400).json({ error: 'Invalid partner' });
            }

            // Create new case
            const { data: newCase, error: insertError } = await supabase
                .from('cases')
                .insert({
                    user_a_id: viewerId,
                    user_b_id: partnerId || null,
                    user_a_input: userAInput || '',
                    user_a_feelings: userAFeelings || '',
                    user_b_input: '',
                    user_b_feelings: '',
                    status: isProd ? 'PENDING' : (status || 'PENDING'),
                    case_title: caseTitle || null,
                    severity_level: severityLevel || null,
                    primary_hiss_tag: primaryHissTag || null,
                    short_resolution: shortResolution || null
                })
                .select()
                .single();

            if (insertError) throw insertError;

            // If verdict provided, create the first verdict record
            if (!isProd && verdict) {
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
        res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

// Add an addendum verdict to a case
app.post('/api/cases/:id/addendum', async (req, res) => {
    try {
        if (isProd) {
            return res.status(404).json({ error: 'Not found' });
        }

        const viewerId = await requireAuthUserId(req);
        const { addendumText, verdict, caseTitle, severityLevel, primaryHissTag, shortResolution } = req.body;
        const caseId = req.params.id;

        const supabase = requireSupabase();
        const { data: caseRow, error: caseError } = await supabase
            .from('cases')
            .select('id,user_a_id,user_b_id')
            .eq('id', caseId)
            .single();

        if (caseError || !caseRow) {
            return res.status(404).json({ error: 'Case not found' });
        }

        const isUserA = String(caseRow.user_a_id) === String(viewerId);
        const isUserB = String(caseRow.user_b_id) === String(viewerId);
        if (!isUserA && !isUserB) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const { count } = await supabase
            .from('verdicts')
            .select('*', { count: 'exact', head: true })
            .eq('case_id', caseId);

        // Create new verdict with addendum info
        await supabase.from('verdicts').insert({
            case_id: caseId,
            version: (count || 0) + 1,
            content: typeof verdict === 'string' ? JSON.parse(verdict) : verdict,
            addendum_by: isUserA ? 'userA' : 'userB',
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
        res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

// Rate the latest verdict for a case (per-user)
app.post('/api/cases/:id/rate', async (req, res) => {
    try {
        const caseId = req.params.id;
        const viewerId = await requireAuthUserId(req);
        const { rating } = req.body;
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
        if (String(caseRow.user_a_id) === String(viewerId)) {
            ratingColumn = 'rating_user_a';
        } else if (String(caseRow.user_b_id) === String(viewerId)) {
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
        res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

// Get Case History
app.get('/api/cases', async (req, res) => {
    try {
        const viewerId = await requireAuthUserId(req);

        const supabase = requireSupabase();
        const partnerId = await getPartnerIdForUser(supabase, viewerId);

        let query = supabase
            .from('cases')
            .select(`*, verdicts(*)`)
            .order('created_at', { ascending: false });

        if (partnerId) {
            query = query.or(
                `and(user_a_id.eq.${viewerId},user_b_id.eq.${partnerId}),and(user_a_id.eq.${partnerId},user_b_id.eq.${viewerId})`
            );
        } else {
            query = query.or(`user_a_id.eq.${viewerId},user_b_id.eq.${viewerId}`);
        }

        const { data: cases, error } = await query;

        if (error) throw error;

        res.json((cases || []).map(transformCase));
    } catch (error) {
        console.error('Error fetching cases:', error);
        res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

// Get single case with all verdicts
app.get('/api/cases/:id', async (req, res) => {
    try {
        const viewerId = await requireAuthUserId(req);
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

        const isUserA = String(caseItem.user_a_id) === String(viewerId);
        const isUserB = String(caseItem.user_b_id) === String(viewerId);
        if (!isUserA && !isUserB) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        res.json(transformCase(caseItem));
    } catch (error) {
        console.error('Error fetching case:', error);
        res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
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
        const viewerId = await requireAuthUserId(req);
        const { amount, type, description } = req.body;

        const numericAmount = Number(amount);
        if (!Number.isFinite(numericAmount) || !Number.isInteger(numericAmount) || Math.abs(numericAmount) > 1000) {
            return res.status(400).json({ error: 'amount must be an integer with abs(amount) <= 1000' });
        }
        if (!['EARN', 'SPEND', 'ADJUST'].includes(type)) {
            return res.status(400).json({ error: 'type must be EARN, SPEND, or ADJUST' });
        }
        if (isProd && type === 'ADJUST') {
            return res.status(403).json({ error: 'ADJUST is not allowed in production' });
        }
        const safeDescription = typeof description === 'string' ? description.trim().slice(0, 200) : null;

        const supabase = requireSupabase();

        // Create Transaction
        const { data: transaction, error: insertError } = await supabase
            .from('transactions')
            .insert({ user_id: viewerId, amount: numericAmount, type, description: safeDescription })
            .select()
            .single();

        if (insertError) throw insertError;

        // Calculate new balance from all transactions
        const { data: allTransactions } = await supabase
            .from('transactions')
            .select('amount')
            .eq('user_id', viewerId);

        const newBalance = (allTransactions || []).reduce((sum, t) => sum + t.amount, 0);

        res.json({ transaction, newBalance, userId: viewerId });
    } catch (error) {
        console.error('Error creating transaction:', error);
        res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

// Get user's kibble balance from transactions
app.get('/api/economy/balance/:userId', async (req, res) => {
    try {
        const viewerId = await requireAuthUserId(req);
        const { userId } = req.params;
        if (userId && String(userId) !== String(viewerId)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const supabase = requireSupabase();

        const { data: transactions } = await supabase
            .from('transactions')
            .select('amount')
            .eq('user_id', viewerId);

        const balance = (transactions || []).reduce((sum, t) => sum + t.amount, 0);

        res.json({ userId: viewerId, balance });
    } catch (error) {
        console.error('Error fetching balance:', error);
        res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

// --- Appreciations ---

app.post('/api/appreciations', async (req, res) => {
    try {
        const viewerId = await requireAuthUserId(req);
        const { toUserId, message, category, kibbleAmount = 10 } = req.body;

        if (!toUserId) {
            return res.status(400).json({ error: 'toUserId is required' });
        }
        const numericKibble = Number(kibbleAmount);
        if (!Number.isFinite(numericKibble) || !Number.isInteger(numericKibble) || numericKibble <= 0 || numericKibble > 100) {
            return res.status(400).json({ error: 'kibbleAmount must be an integer from 1 to 100' });
        }
        const safeMessage = typeof message === 'string' ? message.trim().slice(0, 500) : '';
        if (!safeMessage) return res.status(400).json({ error: 'message is required' });
        const safeCategory = typeof category === 'string' ? category.trim().slice(0, 50) : null;

        const supabase = requireSupabase();
        const partnerId = await getPartnerIdForUser(supabase, viewerId);
        if (!partnerId || String(toUserId) !== String(partnerId)) {
            return res.status(403).json({ error: 'Can only send appreciation to your connected partner' });
        }

        // Create the appreciation
        const { data: appreciation, error: insertError } = await supabase
            .from('appreciations')
            .insert({
                from_user_id: viewerId,
                to_user_id: toUserId,
                message: safeMessage,
                category: safeCategory,
                kibble_amount: numericKibble
            })
            .select()
            .single();

        if (insertError) throw insertError;

        // Award kibble via transaction
        const { data: transaction } = await supabase
            .from('transactions')
            .insert({
                user_id: toUserId,
                amount: numericKibble,
                type: 'EARN',
                description: `Appreciated: ${safeMessage.substring(0, 50)}${safeMessage.length > 50 ? '...' : ''}`
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
        res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

// Get appreciations FOR a user
app.get('/api/appreciations/:userId', async (req, res) => {
    try {
        const viewerId = await requireAuthUserId(req);
        const { userId } = req.params;
        if (userId && String(userId) !== String(viewerId)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const supabase = requireSupabase();

        const { data: appreciations, error } = await supabase
            .from('appreciations')
            .select('*')
            .eq('to_user_id', viewerId)
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
        res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
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
        res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
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
        res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
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
        res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
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
        res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
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
        res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
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
        res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
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
        res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

// AI-powered event planning suggestions
app.post('/api/calendar/plan-event', async (req, res) => {
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

        const { generateEventPlan } = require('./lib/eventPlanner');
        const { incrementUsage } = require('./lib/usageTracking');

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
                const supabase = requireSupabase();
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
        openrouter: isOpenRouterConfigured(),
        timestamp: new Date().toISOString()
    });
});

// Centralized error handling (CORS + unexpected errors)
app.use((err, req, res, _next) => {
    if (err?.message === 'CORS blocked') {
        return res.status(403).json({ error: 'CORS blocked' });
    }
    console.error('[App] Unhandled error:', err);
    return res.status(500).json({ error: safeErrorMessage(err) });
});

server.on('error', (error) => {
    if (error?.code === 'EADDRINUSE' || error?.code === 'EPERM') {
        console.error(`[App] Failed to bind ${HOST}:${PORT} (${error.code}).`);
        console.error('[App] Try freeing the port or running with PORT=<free_port> npm run dev');
    } else {
        console.error('[App] Server error:', error);
    }
    process.exit(1);
});

server.listen(PORT, HOST, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Supabase configured: ${isSupabaseConfigured()}`);
    console.log(`WebSocket server initialized`);
});
