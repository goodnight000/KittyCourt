import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function loadSubject() {
    const modulePath = require.resolve('./supabaseMemoryJobs');
    delete require.cache[modulePath];
    return require('./supabaseMemoryJobs');
}

function createClientMock({ data = { id: 'job-1' }, error = null } = {}) {
    const single = vi.fn().mockResolvedValue({ data, error });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const from = vi.fn(() => ({ insert }));

    return {
        client: { from },
        from,
        insert,
        select,
        single,
    };
}

function getInsertedRow(insertSpy) {
    const [insertArg] = insertSpy.mock.calls[0] || [];
    return Array.isArray(insertArg) ? insertArg[0] : insertArg;
}

async function expectThrows(invocation, messagePattern) {
    try {
        await invocation();
    } catch (error) {
        expect(error).toBeTruthy();
        expect(String(error.message || error)).toMatch(messagePattern);
        return;
    }

    throw new Error('Expected invocation to throw');
}

describe('enqueueMemoryJob', () => {
    it('inserts into memory_jobs with defaults and required fields', async () => {
        const { enqueueMemoryJob } = loadSubject();
        const { client, from, insert } = createClientMock();

        await enqueueMemoryJob({
            jobType: 'daily_question_extraction',
            payload: { answerId: 'answer-1' },
            source: 'daily_question',
        }, client);

        expect(from).toHaveBeenCalledWith('memory_jobs');
        expect(insert).toHaveBeenCalledTimes(1);

        const inserted = getInsertedRow(insert);
        expect(inserted).toEqual(expect.objectContaining({
            status: 'pending',
            attempts: 0,
            max_attempts: 5,
            job_type: 'daily_question_extraction',
            payload: { answerId: 'answer-1' },
            source: 'daily_question',
        }));
    });

    it('returns inserted row on success', async () => {
        const insertedRow = {
            id: 'job-123',
            job_type: 'appreciation_extraction',
            status: 'pending',
            attempts: 0,
            max_attempts: 5,
        };

        const { enqueueMemoryJob } = loadSubject();
        const { client } = createClientMock({ data: insertedRow, error: null });

        const result = await enqueueMemoryJob({
            jobType: 'appreciation_extraction',
            payload: { appreciationId: 'appr-1' },
            source: 'appreciation',
        }, client);

        expect(result).toEqual(insertedRow);
    });

    it.each([undefined, null, '', '   '])('throws on missing or blank jobType: %p', async (jobType) => {
        const { enqueueMemoryJob } = loadSubject();
        const { client } = createClientMock();

        await expectThrows(
            () => enqueueMemoryJob({
                jobType,
                payload: { any: 'value' },
                source: 'unit_test',
            }, client),
            /jobType/i
        );
    });

    it.each([null, [], 'text', 42, true, new Date()])('throws when payload is not a plain object: %p', async (payload) => {
        const { enqueueMemoryJob } = loadSubject();
        const { client } = createClientMock();

        await expectThrows(
            () => enqueueMemoryJob({
                jobType: 'daily_question_extraction',
                payload,
                source: 'unit_test',
            }, client),
            /payload/i
        );
    });

    it('throws when DB returns error', async () => {
        const dbError = new Error('db insert failed');
        const { enqueueMemoryJob } = loadSubject();
        const { client } = createClientMock({ data: null, error: dbError });

        await expectThrows(
            () => enqueueMemoryJob({
                jobType: 'daily_question_extraction',
                payload: { answerId: 'answer-2' },
                source: 'daily_question',
            }, client),
            /db insert failed/i
        );
    });
});
