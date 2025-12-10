/**
 * Court Session Routes
 * 
 * Handles all court session management endpoints:
 * - Creating sessions (serving partner)
 * - Joining sessions
 * - Submitting evidence
 * - Settlement requests
 * - Accepting verdicts
 * - Closing sessions
 */

const express = require('express');
const router = express.Router();
const { getSupabase, isSupabaseConfigured } = require('../lib/supabase');
const wsService = require('../lib/websocket');

// Helper to get Supabase client
const requireSupabase = () => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase is not configured');
    }
    return getSupabase();
};

// Helper to get couple ID from session
const getCoupleId = (session) => {
    // Use partner_id + created_by as couple identifier, or just session id
    return session.couple_id || session.id;
};

// ===============================
// CREATE SESSION (Serve Partner)
// ===============================
router.post('/', async (req, res) => {
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

// ===============================
// GET ACTIVE SESSION
// ===============================
router.get('/active', async (req, res) => {
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
        const activeStatuses = ['WAITING', 'IN_SESSION', 'WAITING_FOR_PARTNER', 'WAITING_FOR_CREATOR', 'DELIBERATING', 'VERDICT', 'RATING', 'RESOLVED'];
        let query = supabase
            .from('court_sessions')
            .select('*')
            .in('status', activeStatuses)
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

// ===============================
// JOIN SESSION
// ===============================
router.post('/:id/join', async (req, res) => {
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

            // Emit WebSocket event
            wsService.notifyPartnerJoined(getCoupleId(startedSession), startedSession);

            return res.json(startedSession);
        }

        res.json(updatedSession);
    } catch (error) {
        console.error('Error joining session:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===============================
// SETTLE OUT OF COURT
// ===============================
router.post('/:id/settle', async (req, res) => {
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

        // Allow settling during any active session state
        const activeStates = ['IN_SESSION', 'WAITING_FOR_PARTNER', 'WAITING_FOR_CREATOR', 'DELIBERATING'];
        if (!activeStates.includes(session.status)) {
            return res.status(400).json({ error: `Can only settle during an active session. Current status: ${session.status}` });
        }

        // Determine if user is creator or partner
        const isCreator = session.created_by === userId;
        const isPartner = session.partner_id === userId;

        if (!isCreator && !isPartner) {
            return res.status(403).json({ error: 'User is not part of this session' });
        }

        // Track settle requests
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

        // Emit WebSocket events
        if (bothSettled) {
            wsService.notifySettled(getCoupleId(updatedSession), updatedSession);
        } else {
            wsService.notifySettlementRequested(getCoupleId(updatedSession), updatedSession, userId);
        }

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

// ===============================
// CLOSE SESSION
// ===============================
router.post('/:id/close', async (req, res) => {
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

        // Emit WebSocket event
        wsService.notifySessionClosed(getCoupleId(session), sessionId, 'completed');

        res.json(session);
    } catch (error) {
        console.error('Error closing session:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===============================
// SUBMIT EVIDENCE
// ===============================
router.post('/:id/submit-evidence', async (req, res) => {
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

        // Allow submission during active session states
        const validStates = ['IN_SESSION', 'WAITING_FOR_PARTNER', 'WAITING_FOR_CREATOR'];
        if (!validStates.includes(session.status)) {
            return res.status(400).json({ error: `Can only submit evidence during an active session. Current status: ${session.status}` });
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

        // Emit WebSocket event
        wsService.notifyEvidenceSubmitted(getCoupleId(updatedSession), updatedSession, userId);

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

// ===============================
// ACCEPT VERDICT
// ===============================
router.post('/:id/accept-verdict', async (req, res) => {
    try {
        const { userId, caseId } = req.body;
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

        // Only allow accepting during VERDICT, RESOLVED, or DELIBERATING status
        const validStates = ['VERDICT', 'RESOLVED', 'DELIBERATING'];
        if (!validStates.includes(session.status)) {
            return res.status(400).json({ error: `Can only accept verdict when case is resolved. Current status: ${session.status}` });
        }

        // Determine if user is creator or partner
        const isCreator = session.created_by === userId;
        const isPartner = session.partner_id === userId;

        if (!isCreator && !isPartner) {
            return res.status(403).json({ error: 'User is not part of this session' });
        }

        // Track verdict acceptances
        const currentAcceptances = session.verdict_acceptances || { creator: false, partner: false };

        if (isCreator) {
            currentAcceptances.creator = true;
        } else {
            currentAcceptances.partner = true;
        }

        // Check if both have accepted
        const bothAccepted = currentAcceptances.creator && currentAcceptances.partner;

        // Update session
        const updateData = {
            verdict_acceptances: currentAcceptances,
            status: bothAccepted ? 'CLOSED' : 'RESOLVED'
        };

        if (caseId) {
            updateData.case_id = caseId;
        }

        const { data: updatedSession, error: updateError } = await supabase
            .from('court_sessions')
            .update(updateData)
            .eq('id', sessionId)
            .select()
            .single();

        if (updateError) throw updateError;

        // Emit WebSocket event
        wsService.notifyVerdictAccepted(getCoupleId(updatedSession), updatedSession, userId, bothAccepted);

        res.json({
            ...updatedSession,
            bothAccepted,
            message: bothAccepted
                ? 'Both parties accepted the verdict. Case closed!'
                : 'Verdict accepted. Waiting for partner to accept.'
        });
    } catch (error) {
        console.error('Error accepting verdict:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===============================
// RATE VERDICT (New endpoint)
// ===============================
router.post('/:id/rate', async (req, res) => {
    try {
        const { rating, userId } = req.body;
        const sessionId = req.params.id;

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5' });
        }

        const supabase = requireSupabase();

        // Update session with rating
        const { data: session, error } = await supabase
            .from('court_sessions')
            .update({ verdict_rating: rating })
            .eq('id', sessionId)
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, session });
    } catch (error) {
        console.error('Error rating verdict:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
