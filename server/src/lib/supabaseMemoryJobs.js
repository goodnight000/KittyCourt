const supabase = require('./supabase');

function isPlainObject(value) {
    if (!value || typeof value !== 'object') {
        return false;
    }

    if (Array.isArray(value) || value instanceof Date) {
        return false;
    }

    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

async function enqueueMemoryJob(job, clientOverride = null) {
    if (!job || typeof job !== 'object') {
        throw new TypeError('job must be an object');
    }

    const { jobType, payload } = job;

    if (typeof jobType !== 'string' || jobType.trim().length === 0) {
        throw new TypeError('jobType must be a non-empty string');
    }

    if (!isPlainObject(payload)) {
        throw new TypeError('payload must be a plain object');
    }

    const supabaseClient = clientOverride || supabase.getSupabase();
    const row = {
        job_type: jobType.trim(),
        payload,
        status: 'pending',
        attempts: 0,
        max_attempts: 5,
    };

    const sourceType = job.source_type ?? job.sourceType;
    const sourceId = job.source_id ?? job.sourceId;
    const coupleId = job.couple_id ?? job.coupleId;
    const retryAt = job.retry_at ?? job.retryAt;
    const source = job.source;

    if (sourceType !== undefined) {
        row.source_type = sourceType;
    } else if (source !== undefined) {
        row.source_type = source;
    }

    if (source !== undefined) {
        row.source = source;
    }

    if (sourceId !== undefined) {
        row.source_id = sourceId;
    }

    if (coupleId !== undefined) {
        row.couple_id = coupleId;
    }

    if (retryAt !== undefined) {
        row.retry_at = retryAt;
    }

    const { data, error } = await supabaseClient
        .from('memory_jobs')
        .insert(row)
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
}

module.exports = {
    enqueueMemoryJob,
};
