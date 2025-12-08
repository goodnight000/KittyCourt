/**
 * Pause Server
 * 
 * Express API server that uses Supabase for all data storage.
 * No more Prisma/SQLite - everything goes to Supabase!
 */

const path = require('path');
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

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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

// --- Court Session Management ---

// Create a new court session (User serves their partner)
app.post('/api/court-sessions', async (req, res) => {
    try {
        const { createdBy, partnerId } = req.body;

        if (!createdBy) {
            return res.status(400).json({ error: 'createdBy (user ID) is required' });
        }

        const supabase = requireSupabase();

        // Expire old sessions
        await supabase
            .from('court_sessions')
            .update({ status: 'CLOSED' })
            .eq('status', 'WAITING')
            .lt('expires_at', new Date().toISOString());

        // Check for existing active session for this couple
        let query = supabase
            .from('court_sessions')
            .select('*')
            .in('status', ['WAITING', 'IN_SESSION']);

        if (partnerId) {
            query = query.or(`created_by.eq.${createdBy},partner_id.eq.${createdBy},created_by.eq.${partnerId},partner_id.eq.${partnerId}`);
        } else {
            query = query.or(`created_by.eq.${createdBy},partner_id.eq.${createdBy}`);
        }

        const { data: existingSessions } = await query;

        if (existingSessions && existingSessions.length > 0) {
            return res.status(400).json({
                error: 'A court session is already active for this couple',
                session: existingSessions[0]
            });
        }

        // Create new session that expires in 24 hours
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        const { data: session, error } = await supabase
            .from('court_sessions')
            .insert({
                created_by: createdBy,
                partner_id: partnerId || null,
                creator_joined: true,
                partner_joined: false,
                user_a_joined: true,
                user_b_joined: false,
                status: 'WAITING',
                expires_at: expiresAt
            })
            .select()
            .single();

        if (error) throw error;

        res.json(session);
    } catch (error) {
        console.error('Error creating court session:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get active court session for the current user/couple
app.get('/api/court-sessions/active', async (req, res) => {
    try {
        const { userId, partnerId } = req.query;

        const supabase = requireSupabase();

        // Expire old sessions first
        await supabase
            .from('court_sessions')
            .update({ status: 'CLOSED' })
            .eq('status', 'WAITING')
            .lt('expires_at', new Date().toISOString());

        // Build query to find sessions relevant to this couple
        let query = supabase
            .from('court_sessions')
            .select('*')
            .in('status', ['WAITING', 'IN_SESSION'])
            .order('created_at', { ascending: false })
            .limit(1);

        if (userId && partnerId) {
            query = query.or(`and(created_by.eq.${userId},partner_id.eq.${partnerId}),and(created_by.eq.${partnerId},partner_id.eq.${userId}),and(created_by.eq.${userId},partner_id.is.null),and(created_by.eq.${partnerId},partner_id.is.null)`);
        } else if (userId) {
            query = query.or(`created_by.eq.${userId},partner_id.eq.${userId}`);
        }

        const { data: sessions, error } = await query;

        if (error) throw error;

        res.json(sessions?.[0] || null);
    } catch (error) {
        console.error('Error getting active session:', error);
        res.status(500).json({ error: error.message });
    }
});

// Join a court session
app.post('/api/court-sessions/:id/join', async (req, res) => {
    try {
        const { userId } = req.body;
        const sessionId = req.params.id;

        const supabase = requireSupabase();

        const { data: session, error: fetchError } = await supabase
            .from('court_sessions')
            .select('*')
            .eq('id', sessionId)
            .single();

        if (fetchError || !session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        if (session.status === 'CLOSED') {
            return res.status(400).json({ error: 'Session has expired' });
        }

        // Determine if this user is the creator or the partner
        const isCreator = session.created_by === userId;
        const isPartner = session.partner_id === userId || (!session.partner_id && session.created_by !== userId);

        if (!isCreator && !isPartner) {
            return res.status(403).json({ error: 'You are not part of this court session' });
        }

        // Update the appropriate joined field
        const updateData = isCreator
            ? { creator_joined: true, user_a_joined: true }
            : { partner_joined: true, user_b_joined: true, partner_id: userId };

        const { data: updatedSession, error: updateError } = await supabase
            .from('court_sessions')
            .update(updateData)
            .eq('id', sessionId)
            .select()
            .single();

        if (updateError) throw updateError;

        // If both have joined, start the session
        if (updatedSession.creator_joined && updatedSession.partner_joined) {
            const { data: startedSession, error: startError } = await supabase
                .from('court_sessions')
                .update({ status: 'IN_SESSION' })
                .eq('id', sessionId)
                .select()
                .single();

            if (startError) throw startError;
            return res.json(startedSession);
        }

        res.json(updatedSession);
    } catch (error) {
        console.error('Error joining session:', error);
        res.status(500).json({ error: error.message });
    }
});

// Request to settle out of court
app.post('/api/court-sessions/:id/settle', async (req, res) => {
    try {
        const { userId } = req.body;
        const sessionId = req.params.id;

        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }

        const supabase = requireSupabase();

        // Get current session
        const { data: session, error: getError } = await supabase
            .from('court_sessions')
            .select('*')
            .eq('id', sessionId)
            .single();

        if (getError) throw getError;

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        if (session.status !== 'IN_SESSION') {
            return res.status(400).json({ error: 'Can only settle during an active session' });
        }

        // Determine if user is creator or partner
        const isCreator = session.created_by === userId;
        const isPartner = session.partner_id === userId;

        if (!isCreator && !isPartner) {
            return res.status(403).json({ error: 'User is not part of this session' });
        }

        // Track settle requests (we'll use a simple approach with session metadata)
        const currentSettleRequests = session.settle_requests || { creator: false, partner: false };

        if (isCreator) {
            currentSettleRequests.creator = true;
        } else {
            currentSettleRequests.partner = true;
        }

        // Check if both have requested to settle
        const bothSettled = currentSettleRequests.creator && currentSettleRequests.partner;

        // Update session with settle request
        const { data: updatedSession, error: updateError } = await supabase
            .from('court_sessions')
            .update({
                settle_requests: currentSettleRequests,
                status: bothSettled ? 'SETTLED' : session.status
            })
            .eq('id', sessionId)
            .select()
            .single();

        if (updateError) throw updateError;

        res.json({
            ...updatedSession,
            settled: bothSettled,
            message: bothSettled
                ? 'Both parties agreed to settle. Case dismissed.'
                : 'Settlement requested. Waiting for partner to agree.'
        });
    } catch (error) {
        console.error('Error settling session:', error);
        res.status(500).json({ error: error.message });
    }
});

// Close a court session
app.post('/api/court-sessions/:id/close', async (req, res) => {
    try {
        const { caseId } = req.body;
        const sessionId = req.params.id;

        const supabase = requireSupabase();

        const { data: session, error } = await supabase
            .from('court_sessions')
            .update({ status: 'CLOSED', case_id: caseId })
            .eq('id', sessionId)
            .select()
            .single();

        if (error) throw error;

        res.json(session);
    } catch (error) {
        console.error('Error closing session:', error);
        res.status(500).json({ error: error.message });
    }
});

// Submit evidence for a court session
app.post('/api/court-sessions/:id/submit-evidence', async (req, res) => {
    try {
        const { userId, evidence, feelings } = req.body;
        const sessionId = req.params.id;

        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }

        const supabase = requireSupabase();

        // Get current session
        const { data: session, error: getError } = await supabase
            .from('court_sessions')
            .select('*')
            .eq('id', sessionId)
            .single();

        if (getError) throw getError;

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        if (session.status !== 'IN_SESSION') {
            return res.status(400).json({ error: 'Can only submit evidence during an active session' });
        }

        // Determine if user is creator or partner
        const isCreator = session.created_by === userId;
        const isPartner = session.partner_id === userId;

        if (!isCreator && !isPartner) {
            return res.status(403).json({ error: 'User is not part of this session' });
        }

        // Get current evidence submissions (or initialize)
        const currentEvidence = session.evidence_submissions || {
            creator: { submitted: false, evidence: '', feelings: '' },
            partner: { submitted: false, evidence: '', feelings: '' }
        };

        // Update the appropriate user's evidence
        if (isCreator) {
            currentEvidence.creator = {
                submitted: true,
                evidence: evidence || '',
                feelings: feelings || '',
                submittedAt: new Date().toISOString()
            };
        } else {
            currentEvidence.partner = {
                submitted: true,
                evidence: evidence || '',
                feelings: feelings || '',
                submittedAt: new Date().toISOString()
            };
        }

        // Check if both have submitted
        const bothSubmitted = currentEvidence.creator.submitted && currentEvidence.partner.submitted;

        // Determine new status
        let newStatus = session.status;
        if (bothSubmitted) {
            newStatus = 'DELIBERATING';
        } else if (currentEvidence.creator.submitted && !currentEvidence.partner.submitted) {
            newStatus = 'WAITING_FOR_PARTNER';
        } else if (currentEvidence.partner.submitted && !currentEvidence.creator.submitted) {
            newStatus = 'WAITING_FOR_CREATOR';
        }

        // Update session with evidence
        const { data: updatedSession, error: updateError } = await supabase
            .from('court_sessions')
            .update({
                evidence_submissions: currentEvidence,
                status: newStatus
            })
            .eq('id', sessionId)
            .select()
            .single();

        if (updateError) throw updateError;

        res.json({
            ...updatedSession,
            bothSubmitted,
            readyForJudging: bothSubmitted
        });
    } catch (error) {
        console.error('Error submitting evidence:', error);
        res.status(500).json({ error: error.message });
    }
});

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
        const { userId, partnerId } = req.query;

        const supabase = requireSupabase();

        let query = supabase
            .from('calendar_events')
            .select('*')
            .order('event_date', { ascending: true });

        // Filter by couple if IDs provided
        if (userId && partnerId) {
            query = query.or(`created_by.eq.${userId},created_by.eq.${partnerId}`);
        } else if (userId) {
            query = query.eq('created_by', userId);
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
            recurrencePattern: e.recurrence_pattern,
            createdAt: e.created_at
        }));

        res.json(transformed);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/calendar/events', async (req, res) => {
    try {
        const { title, date, type, emoji, isRecurring, createdBy, notes } = req.body;

        const supabase = requireSupabase();

        const { data: event, error } = await supabase
            .from('calendar_events')
            .insert({
                title,
                event_date: date,
                event_type: type || 'custom',
                emoji: emoji || '📅',
                is_recurring: isRecurring || false,
                created_by: createdBy,
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
            createdAt: event.created_at
        });
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/calendar/events/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, date, type, emoji, isRecurring, notes } = req.body;

        const supabase = requireSupabase();

        const { data: event, error } = await supabase
            .from('calendar_events')
            .update({
                title,
                event_date: date,
                event_type: type,
                emoji,
                is_recurring: isRecurring,
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
            isRecurring: event.is_recurring
        });
    } catch (error) {
        console.error('Error updating event:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/calendar/events/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const supabase = requireSupabase();

        const { error } = await supabase
            .from('calendar_events')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({ error: error.message });
    }
});

// AI-powered event planning suggestions
app.post('/api/calendar/plan-event', async (req, res) => {
    try {
        const { eventTitle, eventType, eventDate, partnerContext, currentUserName } = req.body;

        // Build context from partner info
        const loveLanguageMap = {
            'words': 'Words of Affirmation - they love compliments and verbal appreciation',
            'acts': 'Acts of Service - they appreciate when you do helpful things',
            'gifts': 'Receiving Gifts - thoughtful presents mean a lot to them',
            'time': 'Quality Time - they value undivided attention together',
            'touch': 'Physical Touch - hugs, hand-holding, and closeness matter most',
        };

        const loveLanguageContext = partnerContext.loveLanguage && loveLanguageMap[partnerContext.loveLanguage]
            ? `Their love language is ${loveLanguageMap[partnerContext.loveLanguage]}.`
            : '';

        const appreciationsContext = partnerContext.recentAppreciations?.length > 0
            ? `Recently, ${partnerContext.name} has appreciated these things: ${partnerContext.recentAppreciations.join(', ')}.`
            : '';

        // Use OpenRouter to generate personalized suggestions
        const { callOpenRouter } = require('./lib/openrouter');

        const prompt = `You are a romantic relationship advisor helping someone plan a special ${eventTitle} for their partner.

Partner Info:
- Name: ${partnerContext.name || 'their partner'}
${loveLanguageContext}
${appreciationsContext}

Generate 3 creative and thoughtful ideas for ${eventTitle} that would be meaningful based on what we know about the partner. Each idea should:
1. Be practical and achievable
2. Show thoughtfulness about the partner's preferences
3. Include a personal touch

Return ONLY a JSON array with exactly 3 objects, each with:
- "emoji": a single emoji representing the idea
- "title": a short catchy title (3-5 words)
- "description": a brief explanation (1-2 sentences) personalized for ${partnerContext.name || 'them'}

Example format:
[{"emoji":"🌹","title":"Surprise Breakfast in Bed","description":"Wake them up with their favorite breakfast and a love note."}]`;

        try {
            const response = await callOpenRouter([
                { role: 'user', content: prompt }
            ], {
                model: 'google/gemini-flash-1.5',
                maxTokens: 500,
                temperature: 0.8,
            });

            // Parse the response
            const content = response.choices[0]?.message?.content || '[]';

            // Try to extract JSON from the response
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const suggestions = JSON.parse(jsonMatch[0]);
                return res.json({ suggestions });
            }
        } catch (aiError) {
            console.error('AI planning error:', aiError);
        }

        // Fallback suggestions if AI fails
        const fallbackSuggestions = getFallbackSuggestions(eventType, partnerContext.name);
        res.json({ suggestions: fallbackSuggestions });

    } catch (error) {
        console.error('Planning error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Fallback suggestions
function getFallbackSuggestions(eventType, partnerName) {
    const name = partnerName || 'your partner';
    const suggestions = {
        birthday: [
            { emoji: '🎂', title: 'Homemade Cake Surprise', description: `Bake ${name}'s favorite cake from scratch with love` },
            { emoji: '📝', title: 'Memory Scrapbook', description: `Create a book of your favorite moments together` },
            { emoji: '🎁', title: 'Experience Over Things', description: `Plan a surprise activity they've always wanted to try` },
        ],
        anniversary: [
            { emoji: '💕', title: 'First Date Redux', description: `Recreate your first date with a romantic twist` },
            { emoji: '✉️', title: 'Love Letter Jar', description: `Write 12 love notes, one for each month until next year` },
            { emoji: '📷', title: 'Year in Photos', description: `Make a photo book of your favorite memories this year` },
        ],
        holiday: [
            { emoji: '🏠', title: 'Cozy Movie Night', description: `Set up a comfy fort with ${name}'s favorite movies and snacks` },
            { emoji: '🍳', title: 'Cook Together', description: `Make a special holiday meal together as a team` },
            { emoji: '🎄', title: 'DIY Gift Exchange', description: `Exchange handmade gifts with a heartfelt touch` },
        ],
        date_night: [
            { emoji: '🌙', title: 'Stargazing Picnic', description: `Pack a basket and find a spot to watch the stars together` },
            { emoji: '💆', title: 'Home Spa Night', description: `Create a relaxing spa experience at home for ${name}` },
            { emoji: '🎮', title: 'Game Night Date', description: `Play games together with their favorite snacks` },
        ],
        custom: [
            { emoji: '💐', title: 'Surprise Flowers', description: `Get ${name}'s favorite flowers delivered unexpectedly` },
            { emoji: '🎵', title: 'Playlist of Love', description: `Create a playlist of songs that remind you of ${name}` },
            { emoji: '🍽️', title: 'Fancy Home Dinner', description: `Cook an elaborate candlelit dinner at home` },
        ],
    };

    return suggestions[eventType] || suggestions.custom;
}

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

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Supabase configured: ${isSupabaseConfigured()}`);
});
