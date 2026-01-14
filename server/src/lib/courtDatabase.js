/**
 * Court Database Service - Clean Architecture
 * 
 * Handles database checkpoints and recovery.
 * Database is NOT the source of truth - only for persistence.
 */

const { getSupabase, isSupabaseConfigured } = require('./supabase');

let warnedMissingConfig = false;
const MISSING_COLUMN_CODE = '42703';
const MISSING_TABLE_CODE = '42P01';
const MISSING_COLUMN_REGEX = /column "([^"]+)"/i;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FK_VIOLATION_CODE = '23503';
const INVALID_TEXT_CODE = '22P02';

const warnIfMissingConfig = () => {
    if (warnedMissingConfig) return;
    warnedMissingConfig = true;
    console.warn('[DB] Supabase not configured. Court sessions will not persist.');
};

const normalizeUuid = (value) => {
    if (!value || typeof value !== 'string') return null;
    return UUID_REGEX.test(value) ? value : null;
};

const buildMinimalPayload = (session) => ({
    id: session.id,
    created_by: session.creatorId,
    partner_id: normalizeUuid(session.partnerId),
    couple_id: normalizeUuid(session.coupleId),
    status: session.phase || 'EVIDENCE',
    phase: session.phase || 'EVIDENCE',
    creator_language: session.creatorLanguage || 'en',
    partner_language: session.partnerLanguage || 'en',
    case_language: session.caseLanguage || session.creatorLanguage || 'en',
    created_at: new Date(session.createdAt).toISOString(),
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
});

const stripMissingColumn = (payload, error) => {
    const message = error?.message || '';
    const match = message.match(MISSING_COLUMN_REGEX);
    if (!match) return null;
    const column = match[1];
    if (!(column in payload)) return null;
    const next = { ...payload };
    delete next[column];
    return { next, column };
};

const writeWithFallback = async (label, writeFn, payload) => {
    let current = { ...payload };
    const removed = new Set();

    while (true) {
        const { error } = await writeFn(current);
        if (!error) return true;

        if (error.code === MISSING_TABLE_CODE) {
            console.error(`[DB] ${label} failed: court_sessions table missing (apply migrations).`);
            return false;
        }

        if (error.code !== MISSING_COLUMN_CODE) {
            throw error;
        }

        const stripped = stripMissingColumn(current, error);
        if (!stripped || removed.has(stripped.column)) {
            throw error;
        }

        removed.add(stripped.column);
        console.warn(`[DB] ${label} missing column "${stripped.column}". Retrying without it.`);
        current = stripped.next;
    }
};

/**
 * Checkpoint session to database
 */
async function checkpoint(session, action) {
    if (!isSupabaseConfigured()) {
        warnIfMissingConfig();
        return;
    }

    const supabase = getSupabase();

    const evidence = {
        creator: {
            submitted: session.creator.evidenceSubmitted,
            evidence: session.creator.evidence || '',
            feelings: session.creator.feelings || '',
            needs: session.creator.needs || ''
        },
        partner: {
            submitted: session.partner.evidenceSubmitted,
            evidence: session.partner.evidence || '',
            feelings: session.partner.feelings || '',
            needs: session.partner.needs || ''
        }
    };

    const acceptances = {
        creator: session.creator.verdictAccepted,
        partner: session.partner.verdictAccepted
    };

    const settleRequests = {
        creator: session.settlementRequested === session.creatorId,
        partner: session.settlementRequested === session.partnerId,
        requestedAt: session.settlementRequestedAt || null
    };

    // Map phase to database status (compatible with existing table)
    const statusMap = {
        'PENDING': 'PENDING',
        'EVIDENCE': 'EVIDENCE',
        'VERDICT': 'VERDICT',
        'CLOSED': 'CLOSED'
    };

    const data = {
        id: session.id,
        created_by: session.creatorId,
        partner_id: session.partnerId,
        couple_id: normalizeUuid(session.coupleId),
        status: statusMap[session.phase] || session.phase || 'EVIDENCE',
        phase: session.phase,
        creator_joined: true,
        partner_joined: session.phase !== 'PENDING',
        case_id: session.caseId || null,
        judge_type: session.judgeType || 'logical',
        creator_language: session.creatorLanguage || 'en',
        partner_language: session.partnerLanguage || 'en',
        case_language: session.caseLanguage || session.creatorLanguage || 'en',
        evidence_submissions: evidence,
        user_a_evidence: session.creator.evidence || '',
        user_a_feelings: session.creator.feelings || '',
        user_a_needs: session.creator.needs || '',
        user_b_evidence: session.partner.evidence || '',
        user_b_feelings: session.partner.feelings || '',
        user_b_needs: session.partner.needs || '',
        settle_requests: settleRequests,
        verdict_acceptances: acceptances,
        verdict: session.verdict,
        resolved_at: session.resolvedAt ? new Date(session.resolvedAt).toISOString() : null,
        addendum_history: session.addendumHistory || [],
        addendum_count: session.addendumCount || 0,
        verdict_history: session.verdictHistory || [],
        analysis: session.analysis || null,
        resolutions: session.resolutions || null,
        assessed_intensity: session.assessedIntensity || null,
        priming_content: session.primingContent || null,
        joint_menu: session.jointMenu || null,
        user_a_priming_ready: session.creator.primingReady || false,
        user_b_priming_ready: session.partner.primingReady || false,
        user_a_joint_ready: session.creator.jointReady || false,
        user_b_joint_ready: session.partner.jointReady || false,
        user_a_resolution_pick: session.userAResolutionPick || null,
        user_b_resolution_pick: session.userBResolutionPick || null,
        hybrid_resolution: session.hybridResolution || null,
        final_resolution: session.finalResolution || null
    };

    try {
        if (action === 'create') {
            // Insert new session
            const payload = {
                ...data,
                created_at: new Date(session.createdAt).toISOString(),
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            };
            try {
                const wrote = await writeWithFallback('create session', (next) => (
                    supabase.from('court_sessions').insert(next)
                ), payload);
                if (wrote) {
                    console.log(`[DB] Created session ${session.id}`);
                }
            } catch (error) {
                console.error('[DB] Create session failed, attempting minimal insert:', error);
                const minimal = buildMinimalPayload(session);
                if (error?.code === FK_VIOLATION_CODE && /partner_id/i.test(error?.message || '')) {
                    minimal.partner_id = null;
                }
                if (error?.code === INVALID_TEXT_CODE) {
                    minimal.partner_id = normalizeUuid(minimal.partner_id);
                    minimal.couple_id = normalizeUuid(minimal.couple_id);
                }
                const wrote = await writeWithFallback('create session (minimal)', (next) => (
                    supabase.from('court_sessions').insert(next)
                ), minimal);
                if (wrote) {
                    console.warn(`[DB] Created minimal session ${session.id}`);
                }
            }
        } else {
            // Update existing session (upsert ensures row exists)
            const payload = {
                ...data,
                created_at: new Date(session.createdAt).toISOString(),
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            };
            const wrote = await writeWithFallback('upsert session', (next) => (
                supabase.from('court_sessions').upsert(next, { onConflict: 'id' })
            ), payload);
            if (wrote) {
                console.log(`[DB] Upserted session ${session.id} (${action})`);
            }
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
    if (!isSupabaseConfigured()) {
        warnIfMissingConfig();
        return null;
    }
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
    const aNeeds = creatorIsUserA ? session.creator?.needs : session.partner?.needs;
    const bEvidence = creatorIsUserA ? session.partner?.evidence : session.creator?.evidence;
    const bFeelings = creatorIsUserA ? session.partner?.feelings : session.creator?.feelings;
    const bNeeds = creatorIsUserA ? session.partner?.needs : session.creator?.needs;

    // Judge engine returns an envelope { status, judgeContent, _meta, ... }
    const verdictHistory = Array.isArray(session.verdictHistory) && session.verdictHistory.length > 0
        ? session.verdictHistory
        : [{
            version: 1,
            content: session.verdict,
            addendumBy: null,
            addendumText: null,
            createdAt: new Date(session.resolvedAt || Date.now()).toISOString()
        }];

    const latestEntry = verdictHistory[verdictHistory.length - 1];
    const verdictEnvelope = latestEntry?.content || session.verdict;
    const verdictContent = verdictEnvelope?.judgeContent || verdictEnvelope;
    const analysisMeta = session.analysis?.caseMetadata
        || verdictEnvelope?._meta?.analysis?.caseMetadata
        || verdictEnvelope?._meta?.analysis
        || {};
    const finalResolution = session.finalResolution || verdictEnvelope?._meta?.finalResolution || null;
    const normalizeVerdictPayload = (envelope) => {
        if (!envelope) return null;
        const content = envelope?.judgeContent || envelope;
        const entryIsHybrid = typeof envelope?._meta?.isHybrid === 'boolean'
            ? envelope._meta.isHybrid
            : false;
        const mergedMeta = {
            ...(envelope?._meta || {}),
            analysis: envelope?._meta?.analysis || null,
            assessedIntensity: envelope?._meta?.assessedIntensity || null,
            resolutions: envelope?._meta?.resolutions || null,
            primingContent: envelope?._meta?.primingContent || null,
            jointMenu: envelope?._meta?.jointMenu || null,
            finalResolution: envelope?._meta?.finalResolution || finalResolution || null,
            isHybrid: entryIsHybrid
        };
        return envelope?.judgeContent ? { ...content, _meta: mergedMeta } : content;
    };

    // Create the case
    const { data: createdCase, error: caseError } = await supabase
        .from('cases')
        .insert({
            user_a_id: userAId,
            user_b_id: userBId,
            user_a_input: aEvidence || '',
            user_a_feelings: aFeelings || '',
            user_a_needs: aNeeds || '',
            user_b_input: bEvidence || '',
            user_b_feelings: bFeelings || '',
            user_b_needs: bNeeds || '',
            status: 'RESOLVED',
            case_language: session.caseLanguage || session.creatorLanguage || 'en',
            case_title: analysisMeta.caseTitle || analysisMeta.case_title || null,
            severity_level: analysisMeta.severityLevel || analysisMeta.severity_level || null,
            primary_hiss_tag: analysisMeta.primaryHissTag || null,
            short_resolution: analysisMeta.shortResolution || finalResolution?.title || null,
        })
        .select()
        .single();

    if (caseError) {
        console.error('[DB] Failed to create case from session:', caseError);
        throw caseError;
    }

    const verdictRows = verdictHistory
        .slice()
        .sort((a, b) => (a.version || 0) - (b.version || 0))
        .map((entry, index) => ({
            case_id: createdCase.id,
            version: entry.version || index + 1,
            content: normalizeVerdictPayload(entry.content),
            addendum_by: entry.addendumBy || null,
            addendum_text: entry.addendumText || null
        }));

    const { error: verdictError } = await supabase
        .from('verdicts')
        .insert(verdictRows);

    if (verdictError) {
        console.error('[DB] Failed to insert verdicts for case:', verdictError);
        throw verdictError;
    }

    console.log(`[DB] Saved case history for session ${session.id} -> case ${createdCase.id}`);
    return createdCase.id;
}

/**
 * Delete session from database
 */
async function deleteSession(sessionId) {
    if (!isSupabaseConfigured()) {
        warnIfMissingConfig();
        return;
    }

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
    if (!isSupabaseConfigured()) {
        warnIfMissingConfig();
        return [];
    }

    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('court_sessions')
        .select('*')
        .in('status', [
            'PENDING',
            'WAITING',
            'EVIDENCE',
            'ANALYZING',
            'PRIMING',
            'JOINT_READY',
            'RESOLUTION',
            'VERDICT'
        ]);

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
    if (!isSupabaseConfigured()) {
        warnIfMissingConfig();
        return;
    }

    const supabase = getSupabase();

    // Close sessions older than 24 hours
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase
        .from('court_sessions')
        .update({ status: 'CLOSED' })
        .in('status', [
            'PENDING',
            'EVIDENCE',
            'ANALYZING',
            'PRIMING',
            'JOINT_READY',
            'RESOLUTION',
            'VERDICT'
        ])
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
