/**
 * Data export service
 *
 * Builds a user export payload, stores it in Supabase Storage, and triggers email delivery.
 */

const { getSupabase } = require('./supabase');
const { getOrderedCoupleIds } = require('./xpService');
const { sendDataExportEmail } = require('./emailService');

const EXPORT_BUCKET = process.env.EXPORT_BUCKET || 'user-exports';
const EXPORT_URL_TTL_SECONDS = Number(process.env.EXPORT_URL_TTL_SECONDS || 60 * 60 * 24 * 7);

const ensureResult = (label, result) => {
    if (result.error) {
        const error = new Error(`[Export] ${label} failed: ${result.error.message}`);
        error.cause = result.error;
        throw error;
    }
    return result.data || [];
};

const buildExportPayload = async (userId) => {
    const supabase = getSupabase();
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (profileError) {
        throw profileError;
    }

    const partnerId = profile?.partner_id || null;
    const coupleIds = partnerId ? getOrderedCoupleIds(userId, partnerId) : null;

    const [
        partnerRequestsResult,
        casesResult,
        dailyAnswersResult,
        appreciationsResult,
        calendarEventsResult,
        transactionsResult,
        rewardRedemptionsResult,
        courtSessionsResult,
        userMemoriesResult,
    ] = await Promise.all([
        supabase
            .from('partner_requests')
            .select('*')
            .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`),
        supabase
            .from('cases')
            .select('*')
            .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`),
        supabase
            .from('daily_answers')
            .select('*')
            .eq('user_id', userId),
        supabase
            .from('appreciations')
            .select('*')
            .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`),
        supabase
            .from('calendar_events')
            .select('*')
            .eq('created_by', userId),
        supabase
            .from('transactions')
            .select('*')
            .eq('user_id', userId),
        supabase
            .from('reward_redemptions')
            .select('*')
            .or(`user_id.eq.${userId},partner_id.eq.${userId}`),
        supabase
            .from('court_sessions')
            .select('*')
            .eq('created_by', userId),
        supabase
            .from('user_memories')
            .select('*')
            .eq('user_id', userId),
    ]);

    const partnerRequests = ensureResult('partner_requests', partnerRequestsResult);
    const cases = ensureResult('cases', casesResult);
    const dailyAnswers = ensureResult('daily_answers', dailyAnswersResult);
    const appreciations = ensureResult('appreciations', appreciationsResult);
    const calendarEvents = ensureResult('calendar_events', calendarEventsResult);
    const transactions = ensureResult('transactions', transactionsResult);
    const rewardRedemptions = ensureResult('reward_redemptions', rewardRedemptionsResult);
    const courtSessions = ensureResult('court_sessions', courtSessionsResult);
    const userMemories = ensureResult('user_memories', userMemoriesResult);

    const caseIds = cases.map((entry) => entry.id);
    const verdicts = caseIds.length
        ? ensureResult(
            'verdicts',
            await supabase
                .from('verdicts')
                .select('*')
                .in('case_id', caseIds)
        )
        : [];

    let memories = [];
    let memoryReactions = [];
    let memoryComments = [];
    let insights = [];

    if (coupleIds) {
        const memoriesResult = await supabase
            .from('memories')
            .select('*')
            .eq('user_a_id', coupleIds.user_a_id)
            .eq('user_b_id', coupleIds.user_b_id);
        memories = ensureResult('memories', memoriesResult);

        const memoryIds = memories.map((memory) => memory.id);

        if (memoryIds.length > 0) {
            const reactionsResult = await supabase
                .from('memory_reactions')
                .select('*')
                .in('memory_id', memoryIds);
            memoryReactions = ensureResult('memory_reactions', reactionsResult);

            const commentsResult = await supabase
                .from('memory_comments')
                .select('*')
                .in('memory_id', memoryIds);
            memoryComments = ensureResult('memory_comments', commentsResult);
        }

        const insightsResult = await supabase
            .from('insights')
            .select('*')
            .eq('user_a_id', coupleIds.user_a_id)
            .eq('user_b_id', coupleIds.user_b_id)
            .eq('recipient_user_id', userId);
        insights = ensureResult('insights', insightsResult);
    }

    return {
        meta: {
            exportedAt: new Date().toISOString(),
            userId,
            partnerId,
        },
        data: {
            profile,
            partnerRequests,
            cases,
            verdicts,
            courtSessions,
            dailyAnswers,
            appreciations,
            calendarEvents,
            transactions,
            rewardRedemptions,
            userMemories,
            memories,
            memoryReactions,
            memoryComments,
            insights,
        },
    };
};

const buildExportSummary = (payload) => {
    const data = payload?.data || {};
    return {
        partnerRequests: data.partnerRequests?.length || 0,
        cases: data.cases?.length || 0,
        verdicts: data.verdicts?.length || 0,
        courtSessions: data.courtSessions?.length || 0,
        dailyAnswers: data.dailyAnswers?.length || 0,
        appreciations: data.appreciations?.length || 0,
        calendarEvents: data.calendarEvents?.length || 0,
        transactions: data.transactions?.length || 0,
        rewardRedemptions: data.rewardRedemptions?.length || 0,
        userMemories: data.userMemories?.length || 0,
        memories: data.memories?.length || 0,
        memoryReactions: data.memoryReactions?.length || 0,
        memoryComments: data.memoryComments?.length || 0,
        insights: data.insights?.length || 0,
    };
};

const processExportRequest = async (requestId) => {
    const supabase = getSupabase();

    const { data: request, error: requestError } = await supabase
        .from('data_export_requests')
        .select('*')
        .eq('id', requestId)
        .single();

    if (requestError) {
        throw requestError;
    }

    if (!request) {
        throw new Error('Export request not found');
    }

    if (request.status !== 'queued') {
        return request;
    }

    try {
        await supabase
            .from('data_export_requests')
            .update({ status: 'processing', error: null })
            .eq('id', requestId);

        const payload = await buildExportPayload(request.user_id);
        const summary = buildExportSummary(payload);
        const body = Buffer.from(JSON.stringify(payload, null, 2));
        const storagePath = `${request.user_id}/${requestId}.json`;

        const { error: uploadError } = await supabase
            .storage
            .from(EXPORT_BUCKET)
            .upload(storagePath, body, {
                contentType: 'application/json',
                upsert: true,
            });

        if (uploadError) {
            throw uploadError;
        }

        await supabase
            .from('data_export_requests')
            .update({
                status: 'ready',
                file_bucket: EXPORT_BUCKET,
                file_path: storagePath,
                processed_at: new Date().toISOString(),
                summary,
            })
            .eq('id', requestId);

        const { data: signedData, error: signedError } = await supabase
            .storage
            .from(EXPORT_BUCKET)
            .createSignedUrl(storagePath, EXPORT_URL_TTL_SECONDS);

        if (signedError) {
            throw signedError;
        }

        const downloadUrl = signedData?.signedUrl || null;
        const expiresAt = new Date(Date.now() + EXPORT_URL_TTL_SECONDS * 1000).toISOString();

        let emailStatus = 'pending';
        let emailedAt = null;

        try {
            const emailResult = await sendDataExportEmail({
                to: request.requested_email,
                downloadUrl,
                expiresAt,
                requestId,
            });
            emailStatus = emailResult?.status || 'stubbed';
            emailedAt = emailResult?.sentAt || null;
        } catch (emailError) {
            emailStatus = 'failed';
            console.error('[Export] Email send failed:', emailError);
        }

        await supabase
            .from('data_export_requests')
            .update({
                email_status: emailStatus,
                emailed_at: emailedAt,
            })
            .eq('id', requestId);

        return request;
    } catch (error) {
        const message = String(error?.message || 'Export failed').slice(0, 500);
        await supabase
            .from('data_export_requests')
            .update({ status: 'failed', error: message })
            .eq('id', requestId);
        throw error;
    }
};

module.exports = {
    processExportRequest,
    buildExportPayload,
    buildExportSummary,
    EXPORT_BUCKET,
    EXPORT_URL_TTL_SECONDS,
};
