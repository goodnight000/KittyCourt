/**
 * Court Database Service - Clean Architecture
 * 
 * Handles database checkpoints and recovery.
 * Database is NOT the source of truth - only for persistence.
 */

const { getSupabase, isSupabaseConfigured } = require('./supabase');

/**
 * Checkpoint session to database
 */
async function checkpoint(session, action) {
    if (!isSupabaseConfigured()) return;

    const supabase = getSupabase();

    const evidence = {
        creator: {
            submitted: session.creator.evidenceSubmitted,
            evidence: session.creator.evidence || '',
            feelings: session.creator.feelings || ''
        },
        partner: {
            submitted: session.partner.evidenceSubmitted,
            evidence: session.partner.evidence || '',
            feelings: session.partner.feelings || ''
        }
    };

    const acceptances = {
        creator: session.creator.verdictAccepted,
        partner: session.partner.verdictAccepted
    };

    const settleRequests = {
        creator: session.settlementRequested === session.creatorId,
        partner: session.settlementRequested === session.partnerId
    };

    // Map phase to database status (compatible with existing table)
    const statusMap = {
        'PENDING': 'PENDING',
        'EVIDENCE': 'EVIDENCE',
        'DELIBERATING': 'DELIBERATING',
        'VERDICT': 'VERDICT',
        'CLOSED': 'CLOSED'
    };

    const data = {
        id: session.id,
        created_by: session.creatorId,
        partner_id: session.partnerId,
        status: statusMap[session.phase] || session.phase || 'EVIDENCE',
        creator_joined: true,
        partner_joined: session.phase !== 'PENDING',
        case_id: session.caseId || null,
        evidence_submissions: evidence,
        settle_requests: settleRequests,
        verdict_acceptances: acceptances,
        verdict: session.verdict,
        resolved_at: session.resolvedAt ? new Date(session.resolvedAt).toISOString() : null
    };

    try {
        if (action === 'create') {
            // Insert new session
            const { error } = await supabase
                .from('court_sessions')
                .insert({
                    ...data,
                    created_at: new Date(session.createdAt).toISOString(),
                    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                });

            if (error) throw error;
            console.log(`[DB] Created session ${session.id}`);
        } else {
            // Update existing session
            const { error } = await supabase
                .from('court_sessions')
                .update(data)
                .eq('id', session.id);

            if (error) throw error;
            console.log(`[DB] Updated session ${session.id} (${action})`);
        }
    } catch (error) {
        console.error('[DB] Checkpoint failed:', error);
        throw error;
    }
}

/**
 * Persist a closed session to the couple's case history.
 * Creates a row in `cases` and inserts the final verdict into `verdicts`.
 *
 * Returns the created case id.
 */
async function saveCaseFromSession(session) {
    if (!isSupabaseConfigured()) return null;
    if (!session?.verdict) return null;

    const supabase = getSupabase();

    // Cases store user_a_id/user_b_id; keep consistent ordering.
    const creatorId = session.creatorId;
    const partnerId = session.partnerId;
    const [userAId, userBId] = String(creatorId) < String(partnerId)
        ? [creatorId, partnerId]
        : [partnerId, creatorId];

    // Map evidence into the A/B fields based on ordering.
    const creatorIsUserA = userAId === creatorId;
    const aEvidence = creatorIsUserA ? session.creator?.evidence : session.partner?.evidence;
    const aFeelings = creatorIsUserA ? session.creator?.feelings : session.partner?.feelings;
    const bEvidence = creatorIsUserA ? session.partner?.evidence : session.creator?.evidence;
    const bFeelings = creatorIsUserA ? session.partner?.feelings : session.creator?.feelings;

    // Judge engine returns an envelope { status, judgeContent, _meta, ... }
    const verdictEnvelope = session.verdict;
    const verdictContent = verdictEnvelope?.judgeContent || verdictEnvelope;

    const analysisMeta = verdictEnvelope?._meta?.analysis || {};

    // Create the case
    const { data: createdCase, error: caseError } = await supabase
        .from('cases')
        .insert({
            user_a_id: userAId,
            user_b_id: userBId,
            user_a_input: aEvidence || '',
            user_a_feelings: aFeelings || '',
            user_b_input: bEvidence || '',
            user_b_feelings: bFeelings || '',
            status: 'RESOLVED',
            case_title: analysisMeta.caseTitle || null,
            severity_level: analysisMeta.severityLevel || null,
            primary_hiss_tag: analysisMeta.primaryHissTag || null,
            short_resolution: analysisMeta.shortResolution || null,
        })
        .select()
        .single();

    if (caseError) {
        console.error('[DB] Failed to create case from session:', caseError);
        throw caseError;
    }

    // Insert verdict version 1
    const addendumBy = session.addendum?.userId
        ? (String(session.addendum.userId) === String(userAId) ? 'user_a' : 'user_b')
        : null;

    const { error: verdictError } = await supabase
        .from('verdicts')
        .insert({
            case_id: createdCase.id,
            version: 1,
            content: verdictContent,
            addendum_by: addendumBy,
            addendum_text: session.addendum?.text || null,
        });

    if (verdictError) {
        console.error('[DB] Failed to insert verdict for case:', verdictError);
        throw verdictError;
    }

    console.log(`[DB] Saved case history for session ${session.id} -> case ${createdCase.id}`);
    return createdCase.id;
}

/**
 * Delete session from database
 */
async function deleteSession(sessionId) {
    if (!isSupabaseConfigured()) return;

    const supabase = getSupabase();

    try {
        const { error } = await supabase
            .from('court_sessions')
            .delete()
            .eq('id', sessionId);

        if (error) throw error;
        console.log(`[DB] Deleted session ${sessionId}`);
    } catch (error) {
        console.error('[DB] Delete failed:', error);
        throw error;
    }
}

/**
 * Fetch active sessions for recovery
 */
async function getActiveSessions() {
    if (!isSupabaseConfigured()) return [];

    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('court_sessions')
        .select('*')
        .in('status', ['PENDING', 'WAITING', 'IN_SESSION', 'EVIDENCE', 'DELIBERATING', 'VERDICT']);

    if (error) {
        console.error('[DB] Fetch active sessions failed:', error);
        return [];
    }

    return data || [];
}

/**
 * Clean up old sessions
 */
async function cleanupOldSessions() {
    if (!isSupabaseConfigured()) return;

    const supabase = getSupabase();

    // Close sessions older than 24 hours
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase
        .from('court_sessions')
        .update({ status: 'CLOSED' })
        .in('status', ['PENDING', 'EVIDENCE', 'DELIBERATING', 'VERDICT'])
        .lt('created_at', cutoff);

    if (error) {
        console.error('[DB] Cleanup failed:', error);
    } else {
        console.log('[DB] Cleaned up old sessions');
    }
}

module.exports = {
    checkpoint,
    deleteSession,
    getActiveSessions,
    cleanupOldSessions,
    saveCaseFromSession
};
