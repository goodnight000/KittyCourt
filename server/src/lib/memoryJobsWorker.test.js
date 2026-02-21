import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const supabase = require('./supabase')
const stenographer = require('./stenographer')

const FIXED_NOW = new Date('2026-02-20T10:00:00.000Z')
let getSupabaseSpy
let extractAndStoreDailyQuestionInsightsSpy
let extractAndStoreAppreciationInsightsSpy
let extractAndStoreMemoryCaptionInsightsSpy

function loadSubject() {
    const modulePath = require.resolve('./memoryJobsWorker')
    delete require.cache[modulePath]
    return require('./memoryJobsWorker')
}

function createMemoryJobsClient({
    selectResults = [],
    updateResults = [],
    rpcResults = [],
    selectResolver,
} = {}) {
    const pendingSelect = [...selectResults]
    const pendingUpdate = [...updateResults]
    const pendingRpc = [...rpcResults]
    let inMutation = false
    const createQueryState = () => ({
        status: null,
        retryAllowsNull: false,
        retryIsNull: false,
        retryLte: null,
        claimedAtFilter: null,
        orderColumns: [],
    })
    let queryState = createQueryState()

    const resetQueryState = () => {
        queryState = createQueryState()
    }

    const nextResult = () => {
        const queue = inMutation ? pendingUpdate : pendingSelect
        let result

        if (!inMutation && typeof selectResolver === 'function') {
            const resolved = selectResolver({ queryState: { ...queryState } })
            if (resolved !== undefined) {
                result = resolved
            }
        }

        if (result === undefined) {
            result = queue.shift() || { data: null, error: null }
        }

        inMutation = false
        resetQueryState()
        return result
    }

    const builder = {
        select: vi.fn(() => builder),
        update: vi.fn((values) => {
            inMutation = true
            return builder
        }),
        eq: vi.fn((column, value) => {
            if (!inMutation && column === 'status') {
                queryState.status = value
            }
            return builder
        }),
        lte: vi.fn((column, value) => {
            if (!inMutation && column === 'retry_at') {
                queryState.retryLte = value
            }
            if (!inMutation && column === 'claimed_at') {
                queryState.claimedAtFilter = { operator: 'lte', value }
            }
            return builder
        }),
        lt: vi.fn((column, value) => {
            if (!inMutation && column === 'claimed_at') {
                queryState.claimedAtFilter = { operator: 'lt', value }
            }
            return builder
        }),
        gte: vi.fn(() => builder),
        gt: vi.fn(() => builder),
        is: vi.fn((column, value) => {
            if (!inMutation && column === 'retry_at' && value === null) {
                queryState.retryAllowsNull = true
                queryState.retryIsNull = true
            }
            return builder
        }),
        not: vi.fn(() => builder),
        or: vi.fn((filterExpr) => {
            if (!inMutation && typeof filterExpr === 'string') {
                if (filterExpr.includes('retry_at.is.null')) {
                    queryState.retryAllowsNull = true
                }
                if (filterExpr.includes('retry_at.lte')) {
                    queryState.retryLte = 'or-clause'
                }
            }
            return builder
        }),
        order: vi.fn((column) => {
            if (!inMutation) {
                queryState.orderColumns.push(column)
            }
            return builder
        }),
        limit: vi.fn(() => builder),
        single: vi.fn(async () => nextResult()),
        maybeSingle: vi.fn(async () => nextResult()),
    }

    const from = vi.fn(() => {
        inMutation = false
        resetQueryState()
        return builder
    })

    const rpc = vi.fn(async () => (
        pendingRpc.shift() || { data: null, error: null }
    ))

    return {
        client: { from, rpc },
        from,
        rpc,
        builder,
    }
}

describe('memoryJobsWorker (RED)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
        vi.setSystemTime(FIXED_NOW)

        getSupabaseSpy = vi.spyOn(supabase, 'getSupabase')
        extractAndStoreDailyQuestionInsightsSpy = vi
            .spyOn(stenographer, 'extractAndStoreDailyQuestionInsights')
            .mockResolvedValue({ ok: true })
        extractAndStoreAppreciationInsightsSpy = vi
            .spyOn(stenographer, 'extractAndStoreAppreciationInsights')
            .mockResolvedValue({ ok: true })
        extractAndStoreMemoryCaptionInsightsSpy = vi
            .spyOn(stenographer, 'extractAndStoreMemoryCaptionInsights')
            .mockResolvedValue({ ok: true })
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
    })

    it('claimPendingMemoryJob claims the oldest due job and atomically updates to processing with attempts+1 and claimed_at', async () => {
        const dueJob = {
            id: 'job-oldest',
            job_type: 'daily_question_extraction',
            status: 'pending',
            attempts: 1,
            max_attempts: 5,
            retry_at: null,
            created_at: '2026-02-20T09:00:00.000Z',
            payload: { answerId: 'a-1' },
        }
        const claimedJob = {
            ...dueJob,
            status: 'processing',
            attempts: 2,
            claimed_at: FIXED_NOW.toISOString(),
        }

        const { client, builder, rpc } = createMemoryJobsClient({
            selectResults: [{ data: dueJob, error: null }],
            updateResults: [{ data: claimedJob, error: null }],
            rpcResults: [{ data: claimedJob, error: null }],
        })
        getSupabaseSpy.mockReturnValue(client)
        const { claimPendingMemoryJob } = loadSubject()

        const result = await claimPendingMemoryJob()

        expect(result).toEqual(claimedJob)
        if (rpc.mock.calls.length === 0) {
            expect(builder.eq.mock.calls).toContainEqual(['status', 'pending'])
            expect(builder.order.mock.calls.some(([column]) => column === 'created_at')).toBe(true)
            expect(builder.update).toHaveBeenCalledTimes(1)

            const [updatePayload] = builder.update.mock.calls[0]
            expect(updatePayload).toEqual(expect.objectContaining({
                status: 'processing',
                attempts: dueJob.attempts + 1,
            }))
            expect(updatePayload.claimed_at).toBeTruthy()
        } else {
            expect(rpc).toHaveBeenCalledTimes(1)
        }
    })

    it('claimPendingMemoryJob reclaims stale processing jobs based on claimed_at age', async () => {
        const staleProcessingJob = {
            id: 'job-stale-processing',
            job_type: 'daily_question_extraction',
            status: 'processing',
            attempts: 2,
            max_attempts: 5,
            claimed_at: '2026-02-20T00:00:00.000Z',
            created_at: '2026-02-20T00:00:00.000Z',
            payload: { answerId: 'a-stale' },
        }
        const reclaimedJob = {
            ...staleProcessingJob,
            attempts: 3,
            claimed_at: FIXED_NOW.toISOString(),
        }

        const { client, builder } = createMemoryJobsClient({
            selectResolver: ({ queryState }) => {
                if (queryState.status === 'pending') {
                    return { data: null, error: null }
                }
                if (queryState.status === 'failed') {
                    return { data: null, error: null }
                }
                if (queryState.status === 'processing') {
                    if (!queryState.claimedAtFilter) {
                        return { data: null, error: null }
                    }
                    return { data: staleProcessingJob, error: null }
                }
                return undefined
            },
            updateResults: [{ data: reclaimedJob, error: null }],
        })
        getSupabaseSpy.mockReturnValue(client)
        const { claimPendingMemoryJob } = loadSubject()

        const result = await claimPendingMemoryJob()

        expect(result).toEqual(reclaimedJob)
        expect(builder.eq.mock.calls).toContainEqual(['status', 'processing'])
        expect(builder.update).toHaveBeenCalledTimes(1)

        const [updatePayload] = builder.update.mock.calls[0]
        expect(updatePayload).toEqual(expect.objectContaining({
            status: 'processing',
            attempts: staleProcessingJob.attempts + 1,
            claimed_at: FIXED_NOW.toISOString(),
        }))
    })

    it('claimPendingMemoryJob dead-letters stale exhausted processing jobs and continues reclaiming', async () => {
        const staleExhaustedProcessingJob = {
            id: 'job-stale-exhausted-processing',
            job_type: 'daily_question_extraction',
            status: 'processing',
            attempts: 3,
            max_attempts: 3,
            claimed_at: '2026-02-20T00:00:00.000Z',
            created_at: '2026-02-20T00:00:00.000Z',
            payload: { answerId: 'a-stale-exhausted' },
        }
        const deadLetteredJob = {
            ...staleExhaustedProcessingJob,
            status: 'dead_letter',
            retry_at: null,
        }
        const nextStaleProcessingJob = {
            id: 'job-stale-next-processing',
            job_type: 'daily_question_extraction',
            status: 'processing',
            attempts: 1,
            max_attempts: 3,
            claimed_at: '2026-02-20T00:01:00.000Z',
            created_at: '2026-02-20T00:01:00.000Z',
            payload: { answerId: 'a-stale-next' },
        }
        const reclaimedJob = {
            ...nextStaleProcessingJob,
            attempts: 2,
            claimed_at: FIXED_NOW.toISOString(),
        }

        let processingCandidateCallCount = 0
        const { client, builder } = createMemoryJobsClient({
            selectResolver: ({ queryState }) => {
                if (queryState.status === 'pending') {
                    return { data: null, error: null }
                }
                if (queryState.status === 'failed') {
                    return { data: null, error: null }
                }
                if (queryState.status === 'processing') {
                    if (!queryState.claimedAtFilter) {
                        return { data: null, error: null }
                    }

                    processingCandidateCallCount += 1
                    if (processingCandidateCallCount === 1) {
                        return { data: staleExhaustedProcessingJob, error: null }
                    }
                    if (processingCandidateCallCount === 2) {
                        return { data: nextStaleProcessingJob, error: null }
                    }
                    return { data: null, error: null }
                }
                return undefined
            },
            updateResults: [
                { data: deadLetteredJob, error: null },
                { data: reclaimedJob, error: null },
            ],
        })
        getSupabaseSpy.mockReturnValue(client)
        const { claimPendingMemoryJob } = loadSubject()

        const result = await claimPendingMemoryJob()

        expect(result).toEqual(reclaimedJob)
        expect(builder.update).toHaveBeenCalledTimes(2)

        const [deadLetterPayload] = builder.update.mock.calls[0]
        expect(deadLetterPayload).toEqual(expect.objectContaining({
            status: 'dead_letter',
        }))
        expect(deadLetterPayload.retry_at == null).toBe(true)

        const [claimPayload] = builder.update.mock.calls[1]
        expect(claimPayload).toEqual(expect.objectContaining({
            status: 'processing',
            attempts: nextStaleProcessingJob.attempts + 1,
            claimed_at: FIXED_NOW.toISOString(),
        }))
    })

    it('claimPendingMemoryJob treats failed jobs with null retry_at as due', async () => {
        const failedJob = {
            id: 'job-failed-null-retry',
            job_type: 'daily_question_extraction',
            status: 'failed',
            attempts: 1,
            max_attempts: 5,
            retry_at: null,
            created_at: '2026-02-20T08:00:00.000Z',
            payload: { answerId: 'a-null-retry' },
        }
        const claimedJob = {
            ...failedJob,
            status: 'processing',
            attempts: failedJob.attempts + 1,
            claimed_at: FIXED_NOW.toISOString(),
        }

        const { client, builder } = createMemoryJobsClient({
            selectResolver: ({ queryState }) => {
                if (queryState.status === 'pending') {
                    return { data: null, error: null }
                }
                if (queryState.status === 'failed') {
                    if (!queryState.retryAllowsNull) {
                        return { data: null, error: null }
                    }
                    return { data: failedJob, error: null }
                }
                return undefined
            },
            updateResults: [{ data: claimedJob, error: null }],
        })
        getSupabaseSpy.mockReturnValue(client)
        const { claimPendingMemoryJob } = loadSubject()

        const result = await claimPendingMemoryJob()

        expect(result).toEqual(claimedJob)
        expect(builder.eq.mock.calls).toContainEqual(['status', 'failed'])
        expect(builder.update).toHaveBeenCalledTimes(1)

        const [updatePayload] = builder.update.mock.calls[0]
        expect(updatePayload).toEqual(expect.objectContaining({
            status: 'processing',
            attempts: failedJob.attempts + 1,
            claimed_at: FIXED_NOW.toISOString(),
        }))
    })

    it('claimPendingMemoryJob prioritizes failed jobs by retry_at before created_at', async () => {
        const failedDueJob = {
            id: 'job-failed-by-retry-at',
            job_type: 'daily_question_extraction',
            status: 'failed',
            attempts: 1,
            max_attempts: 5,
            retry_at: '2026-02-20T09:30:00.000Z',
            created_at: '2026-02-20T07:00:00.000Z',
            payload: { answerId: 'a-failed-retry-order' },
        }
        const claimedJob = {
            ...failedDueJob,
            status: 'processing',
            attempts: failedDueJob.attempts + 1,
            claimed_at: FIXED_NOW.toISOString(),
        }

        const { client, builder } = createMemoryJobsClient({
            selectResolver: ({ queryState }) => {
                if (queryState.status === 'pending') {
                    return { data: null, error: null }
                }

                if (queryState.status === 'failed') {
                    const [primaryOrder, secondaryOrder] = queryState.orderColumns
                    if (primaryOrder === 'retry_at' && secondaryOrder === 'created_at') {
                        return { data: failedDueJob, error: null }
                    }
                    return { data: null, error: null }
                }

                return { data: null, error: null }
            },
            updateResults: [{ data: claimedJob, error: null }],
        })
        getSupabaseSpy.mockReturnValue(client)
        const { claimPendingMemoryJob } = loadSubject()

        const result = await claimPendingMemoryJob()

        expect(result).toEqual(claimedJob)
        expect(builder.eq.mock.calls).toContainEqual(['status', 'failed'])
    })

    it('claimPendingMemoryJob skips non-retryable oldest candidate and claims next due candidate', async () => {
        const exhaustedOldestJob = {
            id: 'job-oldest-exhausted',
            job_type: 'daily_question_extraction',
            status: 'pending',
            attempts: 3,
            max_attempts: 3,
            retry_at: null,
            created_at: '2026-02-20T08:00:00.000Z',
            payload: { answerId: 'a-oldest-exhausted' },
        }
        const nextDueJob = {
            id: 'job-next-due',
            job_type: 'daily_question_extraction',
            status: 'pending',
            attempts: 1,
            max_attempts: 3,
            retry_at: null,
            created_at: '2026-02-20T08:05:00.000Z',
            payload: { answerId: 'a-next-due' },
        }
        const claimedNextDueJob = {
            ...nextDueJob,
            status: 'processing',
            attempts: nextDueJob.attempts + 1,
            claimed_at: FIXED_NOW.toISOString(),
        }

        let pendingCandidateCallCount = 0
        const { client, builder } = createMemoryJobsClient({
            selectResolver: ({ queryState }) => {
                if (queryState.status !== 'pending') {
                    return { data: null, error: null }
                }

                pendingCandidateCallCount += 1
                if (pendingCandidateCallCount === 1) {
                    return { data: exhaustedOldestJob, error: null }
                }
                if (pendingCandidateCallCount === 2) {
                    return { data: nextDueJob, error: null }
                }
                return { data: null, error: null }
            },
            updateResults: [{ data: claimedNextDueJob, error: null }],
        })
        getSupabaseSpy.mockReturnValue(client)
        const { claimPendingMemoryJob } = loadSubject()

        const result = await claimPendingMemoryJob()

        expect(result).toEqual(claimedNextDueJob)
        expect(pendingCandidateCallCount).toBeGreaterThanOrEqual(2)
        expect(builder.update).toHaveBeenCalledTimes(1)

        const [updatePayload] = builder.update.mock.calls[0]
        expect(updatePayload).toEqual(expect.objectContaining({
            status: 'processing',
            attempts: nextDueJob.attempts + 1,
            claimed_at: FIXED_NOW.toISOString(),
        }))
    })

    it('claimPendingMemoryJob claims due failed retries before due pending jobs to prevent mixed-queue starvation', async () => {
        const duePendingJob = {
            id: 'job-due-pending',
            job_type: 'daily_question_extraction',
            status: 'pending',
            attempts: 0,
            max_attempts: 5,
            retry_at: null,
            created_at: '2026-02-20T07:00:00.000Z',
            payload: { answerId: 'a-due-pending' },
        }
        const dueFailedJob = {
            id: 'job-due-failed',
            job_type: 'daily_question_extraction',
            status: 'failed',
            attempts: 1,
            max_attempts: 5,
            retry_at: '2026-02-20T09:30:00.000Z',
            created_at: '2026-02-20T06:00:00.000Z',
            payload: { answerId: 'a-due-failed' },
        }
        const claimedPendingJob = {
            ...duePendingJob,
            status: 'processing',
            attempts: duePendingJob.attempts + 1,
            claimed_at: FIXED_NOW.toISOString(),
        }
        const claimedFailedJob = {
            ...dueFailedJob,
            status: 'processing',
            attempts: dueFailedJob.attempts + 1,
            claimed_at: FIXED_NOW.toISOString(),
        }

        const { client } = createMemoryJobsClient({
            selectResolver: ({ queryState }) => {
                if (queryState.status === 'pending') {
                    return { data: duePendingJob, error: null }
                }
                if (queryState.status === 'failed') {
                    return { data: dueFailedJob, error: null }
                }
                return { data: null, error: null }
            },
            updateResults: [
                { data: claimedPendingJob, error: null },
                { data: claimedFailedJob, error: null },
            ],
        })
        getSupabaseSpy.mockReturnValue(client)
        const { claimPendingMemoryJob } = loadSubject()

        const result = await claimPendingMemoryJob()

        expect(result).toEqual(claimedFailedJob)
    })

    it('claimPendingMemoryJob returns null when no due jobs', async () => {
        const { client, builder, rpc } = createMemoryJobsClient({
            selectResults: [{ data: null, error: null }],
            rpcResults: [{ data: null, error: null }],
        })
        getSupabaseSpy.mockReturnValue(client)
        const { claimPendingMemoryJob } = loadSubject()

        const result = await claimPendingMemoryJob()

        expect(result).toBeNull()
        if (rpc.mock.calls.length === 0) {
            expect(builder.update).not.toHaveBeenCalled()
        }
    })

    it('dispatchMemoryJob routes job types to stenographer extractors', async () => {
        const { dispatchMemoryJob } = loadSubject()

        const dailyPayload = { sourceId: 'source-daily' }
        const appreciationPayload = { sourceId: 'source-appreciation' }
        const captionPayload = { sourceId: 'source-caption' }

        await dispatchMemoryJob({
            id: 'job-daily',
            job_type: 'daily_question_extraction',
            payload: dailyPayload,
        })
        await dispatchMemoryJob({
            id: 'job-appreciation',
            job_type: 'appreciation_extraction',
            payload: appreciationPayload,
        })
        await dispatchMemoryJob({
            id: 'job-caption',
            job_type: 'memory_caption_extraction',
            payload: captionPayload,
        })

        expect(extractAndStoreDailyQuestionInsightsSpy).toHaveBeenCalledTimes(1)
        expect(extractAndStoreDailyQuestionInsightsSpy).toHaveBeenCalledWith(dailyPayload)
        expect(extractAndStoreAppreciationInsightsSpy).toHaveBeenCalledTimes(1)
        expect(extractAndStoreAppreciationInsightsSpy).toHaveBeenCalledWith(appreciationPayload)
        expect(extractAndStoreMemoryCaptionInsightsSpy).toHaveBeenCalledTimes(1)
        expect(extractAndStoreMemoryCaptionInsightsSpy).toHaveBeenCalledWith(captionPayload)
    })

    it('dispatchMemoryJob throws on unknown job_type', async () => {
        const { dispatchMemoryJob } = loadSubject()

        await expect(dispatchMemoryJob({
            id: 'job-unknown',
            job_type: 'not_a_real_job_type',
            payload: {},
        })).rejects.toThrow(/unknown|unsupported/i)
    })

    it('completeMemoryJob writes completed status + completed_at and clears last_error', async () => {
        const completedJob = {
            id: 'job-complete',
            status: 'completed',
            completed_at: FIXED_NOW.toISOString(),
            last_error: null,
        }

        const { client, builder } = createMemoryJobsClient({
            updateResults: [{ data: completedJob, error: null }],
        })
        getSupabaseSpy.mockReturnValue(client)
        const { completeMemoryJob } = loadSubject()

        const result = await completeMemoryJob('job-complete')

        expect(result).toEqual(completedJob)
        expect(builder.update).toHaveBeenCalledTimes(1)

        const [updatePayload] = builder.update.mock.calls[0]
        expect(updatePayload).toEqual(expect.objectContaining({
            status: 'completed',
            last_error: null,
        }))
        expect(updatePayload.completed_at).toBeTruthy()
    })

    it('failMemoryJob writes failed status + retry_at when attempts < max_attempts', async () => {
        const job = {
            id: 'job-retry',
            attempts: 1,
            max_attempts: 5,
            job_type: 'daily_question_extraction',
            payload: { answerId: 'a-retry' },
        }
        const failedJob = {
            ...job,
            status: 'failed',
            retry_at: '2026-02-20T10:01:00.000Z',
            last_error: 'extract failed',
        }

        const { client, builder } = createMemoryJobsClient({
            updateResults: [{ data: failedJob, error: null }],
        })
        getSupabaseSpy.mockReturnValue(client)
        const { failMemoryJob } = loadSubject()

        const result = await failMemoryJob(job, new Error('extract failed'))

        expect(result).toEqual(failedJob)
        expect(builder.update).toHaveBeenCalledTimes(1)

        const [updatePayload] = builder.update.mock.calls[0]
        expect(updatePayload).toEqual(expect.objectContaining({
            status: 'failed',
        }))
        expect(updatePayload.retry_at).toBeTruthy()
        expect(String(updatePayload.last_error || '')).toMatch(/extract failed/i)
    })

    it('failMemoryJob writes dead_letter when attempts >= max_attempts', async () => {
        const job = {
            id: 'job-dead-letter',
            attempts: 5,
            max_attempts: 5,
            job_type: 'appreciation_extraction',
            payload: { appreciationId: 'ap-1' },
        }
        const deadLetterJob = {
            ...job,
            status: 'dead_letter',
            retry_at: null,
            last_error: 'permanent failure',
        }

        const { client, builder } = createMemoryJobsClient({
            updateResults: [{ data: deadLetterJob, error: null }],
        })
        getSupabaseSpy.mockReturnValue(client)
        const { failMemoryJob } = loadSubject()

        const result = await failMemoryJob(job, new Error('permanent failure'))

        expect(result).toEqual(deadLetterJob)
        expect(builder.update).toHaveBeenCalledTimes(1)

        const [updatePayload] = builder.update.mock.calls[0]
        expect(updatePayload).toEqual(expect.objectContaining({
            status: 'dead_letter',
        }))
        expect(updatePayload.retry_at == null).toBe(true)
    })

    it('runMemoryJobsWorker runs one loop iteration: claim -> dispatch -> complete', async () => {
        const dueJob = {
            id: 'job-loop-ok',
            job_type: 'daily_question_extraction',
            attempts: 0,
            max_attempts: 5,
            payload: { answerId: 'answer-loop-ok' },
        }
        const processingJob = {
            ...dueJob,
            status: 'processing',
            attempts: 1,
            claimed_at: FIXED_NOW.toISOString(),
        }
        const completedJob = {
            ...processingJob,
            status: 'completed',
            completed_at: FIXED_NOW.toISOString(),
            last_error: null,
        }

        const { client, builder } = createMemoryJobsClient({
            selectResults: [{ data: dueJob, error: null }],
            updateResults: [
                { data: processingJob, error: null },
                { data: completedJob, error: null },
            ],
        })
        getSupabaseSpy.mockReturnValue(client)
        const { runMemoryJobsWorker } = loadSubject()

        await runMemoryJobsWorker({ once: true })

        expect(extractAndStoreDailyQuestionInsightsSpy).toHaveBeenCalledTimes(1)
        const writtenStatuses = builder.update.mock.calls.map(([payload]) => payload.status).filter(Boolean)
        expect(writtenStatuses).toContain('completed')
    })

    it('runMemoryJobsWorker marks failed on dispatch error', async () => {
        extractAndStoreDailyQuestionInsightsSpy.mockRejectedValueOnce(new Error('dispatch exploded'))

        const dueJob = {
            id: 'job-loop-fail',
            job_type: 'daily_question_extraction',
            attempts: 0,
            max_attempts: 5,
            payload: { answerId: 'answer-loop-fail' },
        }
        const processingJob = {
            ...dueJob,
            status: 'processing',
            attempts: 1,
            claimed_at: FIXED_NOW.toISOString(),
        }
        const failedJob = {
            ...processingJob,
            status: 'failed',
            retry_at: '2026-02-20T10:01:00.000Z',
            last_error: 'dispatch exploded',
        }

        const { client, builder } = createMemoryJobsClient({
            selectResults: [{ data: dueJob, error: null }],
            updateResults: [
                { data: processingJob, error: null },
                { data: failedJob, error: null },
            ],
        })
        getSupabaseSpy.mockReturnValue(client)
        const { runMemoryJobsWorker } = loadSubject()

        await runMemoryJobsWorker({ once: true })

        const writtenStatuses = builder.update.mock.calls.map(([payload]) => payload.status).filter(Boolean)
        expect(writtenStatuses).toContain('failed')
    })
})
