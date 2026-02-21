const DEFAULT_RETRY_DELAY_MS = 60 * 1000;
const DEFAULT_PROCESSING_LOCK_TIMEOUT_MS = 5 * 60 * 1000;
const supabaseModuleId = require.resolve('./supabase');
const stenographerModuleId = require.resolve('./stenographer');
const supabase = require(supabaseModuleId);
const stenographer = require(stenographerModuleId);

function getBoundModule(moduleId, fallback) {
    const cached = require.cache[moduleId]?.exports;
    if (cached && typeof cached === 'object') {
        return cached;
    }

    return fallback;
}

function toNowDate(now) {
    if (now instanceof Date) {
        return now;
    }

    if (typeof now === 'string' || typeof now === 'number') {
        const parsed = new Date(now);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed;
        }
    }

    return new Date();
}

function getNowIso(now) {
    return toNowDate(now).toISOString();
}

function getClient(clientOverride) {
    if (clientOverride) {
        return clientOverride;
    }

    return getBoundModule(supabaseModuleId, supabase).getSupabase();
}

function normalizeRows(data) {
    if (Array.isArray(data)) {
        return data;
    }

    if (data && typeof data === 'object') {
        return [data];
    }

    return [];
}

function pickSingleRow(data) {
    if (Array.isArray(data)) {
        return data[0] || null;
    }

    if (data && typeof data === 'object') {
        return data;
    }

    return null;
}

function getLastErrorMessage(error) {
    if (!error) {
        return 'Unknown memory job error';
    }

    if (typeof error === 'string') {
        return error;
    }

    if (error instanceof Error && error.message) {
        return error.message;
    }

    if (typeof error.message === 'string' && error.message.length > 0) {
        return error.message;
    }

    try {
        return JSON.stringify(error);
    } catch (_serializationError) {
        return String(error);
    }
}

function isRetryDue(job, nowDate) {
    if (!job || !job.retry_at) {
        return false;
    }

    const retryAt = new Date(job.retry_at);
    if (Number.isNaN(retryAt.getTime())) {
        return false;
    }

    return retryAt.getTime() <= nowDate.getTime();
}

function canAttempt(job) {
    const attempts = Number(job?.attempts || 0);
    const maxAttempts = Number(job?.max_attempts || 0);
    return attempts < maxAttempts;
}

function isDue(job, nowDate) {
    if (!job || !canAttempt(job)) {
        return false;
    }

    if (job.status === 'pending') {
        return !job.retry_at || isRetryDue(job, nowDate);
    }

    if (job.status === 'failed') {
        return isRetryDue(job, nowDate);
    }

    return false;
}

async function claimPendingMemoryJob({ supabaseClient, now, processingLockTimeoutMs } = {}) {
    const client = getClient(supabaseClient);
    const nowDate = toNowDate(now);
    const nowIso = nowDate.toISOString();
    const lockTimeoutMs = typeof processingLockTimeoutMs === 'number' && processingLockTimeoutMs >= 0
        ? processingLockTimeoutMs
        : DEFAULT_PROCESSING_LOCK_TIMEOUT_MS;
    const staleClaimedBeforeIso = new Date(nowDate.getTime() - lockTimeoutMs).toISOString();

    const fetchCandidateByStatus = async (status, excludeIds = []) => {
        let query = client
            .from('memory_jobs')
            .select('*')
            .eq('status', status)
            .limit(1);

        if (status === 'failed') {
            query = query
                .order('retry_at', { ascending: true, nullsFirst: true })
                .order('created_at', { ascending: true });
        } else {
            query = query.order('created_at', { ascending: true });
        }

        if (status === 'pending') {
            query = query.or(`retry_at.is.null,retry_at.lte.${nowIso}`);
        } else if (status === 'failed') {
            query = query.or(`retry_at.is.null,retry_at.lte.${nowIso}`);
        } else if (status === 'processing') {
            query = query.lte('claimed_at', staleClaimedBeforeIso);
        }

        if (excludeIds.length > 0) {
            const escapedIds = excludeIds
                .map((id) => String(id).replace(/"/g, '\\"'))
                .map((id) => `"${id}"`)
                .join(',');
            query = query.not('id', 'in', `(${escapedIds})`);
        }

        const { data, error } = await query.maybeSingle();
        if (error) {
            throw error;
        }

        return pickSingleRow(data);
    };

    let pendingFallbackCandidate = null;

    const tryClaimStatus = async (status, seedCandidates = []) => {
        const skippedIds = new Set();
        const queuedCandidates = Array.isArray(seedCandidates)
            ? seedCandidates.filter(Boolean)
            : [];

        for (let attempt = 0; attempt < 100; attempt += 1) {
            const queuedCandidate = queuedCandidates.shift();
            const candidate = queuedCandidate || await fetchCandidateByStatus(status, Array.from(skippedIds));
            if (!candidate) {
                return null;
            }

            if (status === 'failed' && candidate.status && candidate.status !== status) {
                if (!pendingFallbackCandidate && candidate.status === 'pending') {
                    pendingFallbackCandidate = candidate;
                }

                if (candidate.id) {
                    skippedIds.add(candidate.id);
                }
                continue;
            }

            if (!canAttempt(candidate)) {
                if (status === 'processing') {
                    const { error: deadLetterError } = await client
                        .from('memory_jobs')
                        .update({
                            status: 'dead_letter',
                            retry_at: null,
                        })
                        .eq('id', candidate.id)
                        .eq('status', status)
                        .eq('attempts', candidate.attempts)
                        .select()
                        .maybeSingle();

                    if (deadLetterError) {
                        throw deadLetterError;
                    }
                }

                if (candidate.id) {
                    skippedIds.add(candidate.id);
                }
                continue;
            }

            const nextAttempts = Number(candidate.attempts || 0) + 1;

            const { data: claimedData, error: claimError } = await client
                .from('memory_jobs')
                .update({
                    status: 'processing',
                    attempts: nextAttempts,
                    claimed_at: nowIso,
                })
                .eq('id', candidate.id)
                .eq('status', status)
                .eq('attempts', candidate.attempts)
                .select()
                .maybeSingle();

            if (claimError) {
                throw claimError;
            }

            const claimedJob = pickSingleRow(claimedData);
            if (status === 'failed' && claimedJob && candidate.id && claimedJob.id !== candidate.id) {
                continue;
            }

            if (claimedJob) {
                return claimedJob;
            }
        }

        return null;
    };

    const failedJob = await tryClaimStatus('failed');
    if (failedJob) {
        return failedJob;
    }

    const pendingJob = await tryClaimStatus(
        'pending',
        pendingFallbackCandidate ? [pendingFallbackCandidate] : []
    );
    if (pendingJob) {
        return pendingJob;
    }

    const staleProcessingJob = await tryClaimStatus('processing');
    if (staleProcessingJob) {
        return staleProcessingJob;
    }

    return null;
}

async function dispatchMemoryJob(job) {
    const stenographerBindings = getBoundModule(stenographerModuleId, stenographer);
    const payload = job?.payload || {};

    switch (job?.job_type) {
        case 'daily_question_extraction':
            return stenographerBindings.extractAndStoreDailyQuestionInsights(payload);
        case 'appreciation_extraction':
            return stenographerBindings.extractAndStoreAppreciationInsights(payload);
        case 'memory_caption_extraction':
            return stenographerBindings.extractAndStoreMemoryCaptionInsights(payload);
        case 'case_extraction':
            return stenographerBindings.extractAndStoreInsights(payload.caseData, payload.caseId);
        default:
            throw new Error(`Unknown memory job type: ${job?.job_type}`);
    }
}

async function completeMemoryJob(jobId, { supabaseClient, now } = {}) {
    const client = getClient(supabaseClient);
    const nowIso = getNowIso(now);

    const { data, error } = await client
        .from('memory_jobs')
        .update({
            status: 'completed',
            completed_at: nowIso,
            last_error: null,
        })
        .eq('id', jobId)
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
}

async function failMemoryJob(job, error, { supabaseClient, now, retryDelayMs } = {}) {
    const client = getClient(supabaseClient);
    const nowDate = toNowDate(now);
    const nowIso = nowDate.toISOString();
    const lastError = getLastErrorMessage(error);
    const attempts = Number(job?.attempts || 0);
    const maxAttempts = Number(job?.max_attempts || 0);
    const shouldDeadLetter = attempts >= maxAttempts;

    const updates = {
        failed_at: nowIso,
        last_error: lastError,
    };

    if (shouldDeadLetter) {
        updates.status = 'dead_letter';
        updates.retry_at = null;
    } else {
        const retryMs = typeof retryDelayMs === 'number' ? retryDelayMs : DEFAULT_RETRY_DELAY_MS;
        updates.status = 'failed';
        updates.retry_at = new Date(nowDate.getTime() + retryMs).toISOString();
    }

    const { data, error: updateError } = await client
        .from('memory_jobs')
        .update(updates)
        .eq('id', job.id)
        .select()
        .single();

    if (updateError) {
        throw updateError;
    }

    return data;
}

async function defaultSleep(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

async function runMemoryJobsWorker({
    supabaseClient,
    pollIntervalMs = 1000,
    maxIterations = 1,
    once = false,
    nowProvider,
    sleep,
} = {}) {
    const getNow = typeof nowProvider === 'function' ? nowProvider : () => new Date();
    const sleepFn = typeof sleep === 'function' ? sleep : defaultSleep;
    const totalIterations = once ? 1 : maxIterations;

    const summary = {
        processed: 0,
        completed: 0,
        failed: 0,
        emptyPolls: 0,
    };

    for (let iteration = 0; iteration < totalIterations; iteration += 1) {
        const job = await claimPendingMemoryJob({
            supabaseClient,
            now: getNow(),
        });

        if (!job) {
            summary.emptyPolls += 1;
            if (!(once || totalIterations === 1)) {
                await sleepFn(pollIntervalMs);
            }
            continue;
        }

        summary.processed += 1;

        try {
            await dispatchMemoryJob(job);
            await completeMemoryJob(job.id, {
                supabaseClient,
                now: getNow(),
            });
            summary.completed += 1;
        } catch (error) {
            await failMemoryJob(job, error, {
                supabaseClient,
                now: getNow(),
            });
            summary.failed += 1;
        }
    }

    return summary;
}

module.exports = {
    claimPendingMemoryJob,
    dispatchMemoryJob,
    completeMemoryJob,
    failMemoryJob,
    runMemoryJobsWorker,
};
