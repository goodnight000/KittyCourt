/**
 * Memory System Tests
 * 
 * Tests for the Hybrid Memory Matrix components:
 * - Stenographer (extraction agent)
 * - Memory Retrieval (RAG pipeline)
 * - Embeddings service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const supabase = require('./supabase');
const embeddings = require('./embeddings');
const {
    buildExtractionPrompt,
    buildAppreciationPrompt,
    buildMemoryCaptionPrompt,
    processUserInsights,
    triggerBackgroundExtraction,
    triggerDailyQuestionExtraction,
    triggerAppreciationExtraction,
    triggerMemoryCaptionExtraction,
    STENOGRAPHER_SYSTEM_PROMPT,
} = require('./stenographer');
const { formatContextForPrompt, hasHistoricalContext } = require('./memoryRetrieval');

let searchSimilarMemories;
let insertMemory;
let reinforceMemory;
let generateEmbeddings;
let isSupabaseConfigured;
const MEMORY_RUNTIME_ENV_KEYS = [
    'MEMORY_QUEUE_ONLY',
    'MEMORY_EMBEDDED_WORKER_ENABLED',
    'MEMORY_EXTERNAL_WORKER_EXPECTED',
];

function createMemoryJobsClientMock({ data = { id: 'job-1' }, error = null } = {}) {
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

function getInsertedMemoryJob(insertSpy) {
    const [insertArg] = insertSpy.mock.calls[0] || [];
    return Array.isArray(insertArg) ? insertArg[0] : insertArg;
}

async function withMemoryRuntimeDefaults(testFn) {
    const previousValues = new Map(
        MEMORY_RUNTIME_ENV_KEYS.map((key) => [key, process.env[key]])
    );

    for (const key of MEMORY_RUNTIME_ENV_KEYS) {
        delete process.env[key];
    }

    try {
        await testFn();
    } finally {
        for (const [key, value] of previousValues.entries()) {
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        }
    }
}

beforeEach(() => {
    vi.restoreAllMocks();
    searchSimilarMemories = vi.spyOn(supabase, 'searchSimilarMemories');
    insertMemory = vi.spyOn(supabase, 'insertMemory');
    reinforceMemory = vi.spyOn(supabase, 'reinforceMemory');
    isSupabaseConfigured = vi.spyOn(supabase, 'isSupabaseConfigured').mockReturnValue(true);
    generateEmbeddings = vi.spyOn(embeddings, 'generateEmbeddings');
});

describe('Stenographer Agent', () => {
    describe('buildExtractionPrompt', () => {
        it('should format case data into extraction prompt', () => {
            const caseData = {
                participants: {
                    userA: { name: 'Alex', id: 'user-a' },
                    userB: { name: 'Sam', id: 'user-b' },
                },
                submissions: {
                    userA: {
                        cameraFacts: 'They forgot our anniversary',
                        selectedPrimaryEmotion: 'Hurt',
                        theStoryIamTellingMyself: 'I am not important to them',
                        coreNeed: 'To feel valued',
                    },
                    userB: {
                        cameraFacts: 'Work has been overwhelming',
                        selectedPrimaryEmotion: 'Overwhelmed',
                        theStoryIamTellingMyself: 'I cannot do anything right',
                        coreNeed: 'Understanding',
                    },
                },
            };

            const prompt = buildExtractionPrompt(caseData);

            expect(prompt).toContain('Alex');
            expect(prompt).toContain('Sam');
            expect(prompt).toContain('forgot our anniversary');
            expect(prompt).toContain('Work has been overwhelming');
            expect(prompt).toContain('Hurt');
            expect(prompt).toContain('Overwhelmed');
        });
    });

    describe('buildAppreciationPrompt', () => {
        it('should format appreciation data into extraction prompt', () => {
            const payload = {
                userAName: 'Alex',
                userBName: 'Sam',
                message: 'Thanks for making me laugh when I am stressed.',
                category: 'support',
                userALanguage: 'en',
                userBLanguage: 'en',
            };

            const prompt = buildAppreciationPrompt(payload);

            expect(prompt).toContain('Alex');
            expect(prompt).toContain('Sam');
            expect(prompt).toContain(payload.message);
            expect(prompt).toContain('support');
        });
    });

    describe('buildMemoryCaptionPrompt', () => {
        it('should format memory caption data into extraction prompt', () => {
            const payload = {
                caption: 'Sunset hike at Yosemite',
                memoryDate: '2024-05-01',
                userAName: 'Alex',
                userBName: 'Sam',
                userALanguage: 'en',
                userBLanguage: 'en',
            };

            const prompt = buildMemoryCaptionPrompt(payload);

            expect(prompt).toContain('Sunset hike at Yosemite');
            expect(prompt).toContain('Alex');
            expect(prompt).toContain('Sam');
            expect(prompt).toContain('2024-05-01');
        });
    });

    describe('processUserInsights', () => {
        it('should store new insights when no duplicates exist', async () => {
            const mockEmbedding = new Array(1536).fill(0.1);
            generateEmbeddings.mockResolvedValue([mockEmbedding, mockEmbedding]);
            searchSimilarMemories.mockResolvedValue([]);
            insertMemory.mockResolvedValue({ id: 'mem-1' });

            const insights = [
                { text: 'Feels abandoned when ignored', type: 'trigger', confidence: 0.9 },
                { text: 'Values quality time highly', type: 'core_value', confidence: 0.85 },
            ];

            const stats = await processUserInsights('user-123', insights, 'case-456');

            expect(stats.stored).toBe(2);
            expect(stats.reinforced).toBe(0);
            expect(stats.discarded).toBe(0);
            expect(insertMemory).toHaveBeenCalledTimes(2);
        });

        it('should reinforce existing memories when duplicates are found', async () => {
            const mockEmbedding = new Array(1536).fill(0.1);
            generateEmbeddings.mockResolvedValue([mockEmbedding]);
            searchSimilarMemories.mockResolvedValue([
                { id: 'existing-mem', memory_text: 'Similar insight', memory_type: 'trigger', similarity: 0.95 },
            ]);
            reinforceMemory.mockResolvedValue({ id: 'existing-mem' });

            const insights = [
                { text: 'Feels abandoned when ignored', type: 'trigger', confidence: 0.9 },
            ];

            const stats = await processUserInsights('user-123', insights, 'case-456');

            expect(stats.stored).toBe(0);
            expect(stats.reinforced).toBe(1);
            expect(reinforceMemory).toHaveBeenCalledWith('existing-mem');
            expect(insertMemory).not.toHaveBeenCalled();
        });

        it('should reinforce when similar memory uses legacy plural triggers and incoming insight type is trigger', async () => {
            const mockEmbedding = new Array(1536).fill(0.11);
            generateEmbeddings.mockResolvedValue([mockEmbedding]);
            searchSimilarMemories.mockResolvedValue([
                { id: 'legacy-trigger-mem', memory_text: 'Legacy plural trigger memory', memory_type: 'triggers', similarity: 0.96 },
            ]);
            reinforceMemory.mockResolvedValue({ id: 'legacy-trigger-mem' });
            insertMemory.mockResolvedValue({ id: 'new-mem-unexpected' });

            const insights = [
                { text: 'Feels dismissed when concerns are joked away', type: 'trigger', confidence: 0.91 },
            ];

            const stats = await processUserInsights('user-123', insights, 'case-legacy');

            expect(stats.stored).toBe(0);
            expect(stats.reinforced).toBe(1);
            expect(stats.discarded).toBe(0);
            expect(reinforceMemory).toHaveBeenCalledWith('legacy-trigger-mem');
            expect(insertMemory).not.toHaveBeenCalled();
        });

        it('should return empty stats for empty insights', async () => {
            const stats = await processUserInsights('user-123', [], 'case-456');

            expect(stats.stored).toBe(0);
            expect(stats.reinforced).toBe(0);
            expect(stats.discarded).toBe(0);
        });

        it('should normalize legacy trigger insights to conflict_trigger before insert', async () => {
            const mockEmbedding = new Array(1536).fill(0.1);
            generateEmbeddings.mockResolvedValue([mockEmbedding]);
            searchSimilarMemories.mockResolvedValue([]);
            insertMemory.mockResolvedValue({ id: 'mem-1' });

            const insights = [
                { text: 'Feels abandoned when plans change abruptly', type: 'trigger', confidence: 0.9 },
            ];

            const stats = await processUserInsights('user-123', insights, 'case-456');

            expect(stats.stored).toBe(1);
            expect(insertMemory).toHaveBeenCalledTimes(1);
            expect(insertMemory).toHaveBeenCalledWith(expect.objectContaining({
                memoryType: 'conflict_trigger',
            }));
        });

        it('should normalize emotional_trigger insights to conflict_trigger before insert', async () => {
            const mockEmbedding = new Array(1536).fill(0.12);
            generateEmbeddings.mockResolvedValue([mockEmbedding]);
            searchSimilarMemories.mockResolvedValue([]);
            insertMemory.mockResolvedValue({ id: 'mem-emotional-trigger' });

            const insights = [
                { text: 'Feels panic when conversations become abrupt', type: 'emotional_trigger', confidence: 0.9 },
            ];

            const stats = await processUserInsights('user-123', insights, 'case-456');

            expect(stats.stored).toBe(1);
            expect(insertMemory).toHaveBeenCalledTimes(1);
            expect(insertMemory).toHaveBeenCalledWith(expect.objectContaining({
                memoryType: 'conflict_trigger',
            }));
        });

        it('should normalize legacy preference insights to long_term_preference before insert', async () => {
            const mockEmbedding = new Array(1536).fill(0.2);
            generateEmbeddings.mockResolvedValue([mockEmbedding]);
            searchSimilarMemories.mockResolvedValue([]);
            insertMemory.mockResolvedValue({ id: 'mem-2' });

            const insights = [
                { text: 'Prefers direct communication after conflicts', type: 'preference', confidence: 0.84 },
            ];

            const stats = await processUserInsights('user-123', insights, 'case-456');

            expect(stats.stored).toBe(1);
            expect(insertMemory).toHaveBeenCalledTimes(1);
            expect(insertMemory).toHaveBeenCalledWith(expect.objectContaining({
                memoryType: 'long_term_preference',
            }));
        });

        it('should normalize behavioral_pattern insights to pattern before insert', async () => {
            const mockEmbedding = new Array(1536).fill(0.25);
            generateEmbeddings.mockResolvedValue([mockEmbedding]);
            searchSimilarMemories.mockResolvedValue([]);
            insertMemory.mockResolvedValue({ id: 'mem-behavioral-pattern' });

            const insights = [
                { text: 'Tends to go silent when feeling criticized', type: 'behavioral_pattern', confidence: 0.82 },
            ];

            const stats = await processUserInsights('user-123', insights, 'case-456');

            expect(stats.stored).toBe(1);
            expect(insertMemory).toHaveBeenCalledTimes(1);
            expect(insertMemory).toHaveBeenCalledWith(expect.objectContaining({
                memoryType: 'pattern',
            }));
        });

        it('should reinforce existing repair_strategy memory when incoming behavioral_pattern normalizes to pattern', async () => {
            const mockEmbedding = new Array(1536).fill(0.27);
            generateEmbeddings.mockResolvedValue([mockEmbedding]);
            searchSimilarMemories.mockResolvedValue([
                {
                    id: 'existing-repair-strategy',
                    memory_text: 'Take a 20-minute timeout and return calmly',
                    memory_type: 'repair_strategy',
                    similarity: 0.97,
                },
            ]);
            reinforceMemory.mockResolvedValue({ id: 'existing-repair-strategy' });
            insertMemory.mockResolvedValue({ id: 'unexpected-pattern-duplicate' });

            const insights = [
                {
                    text: 'Tends to regulate first, then re-engage in conflict',
                    type: 'behavioral_pattern',
                    confidence: 0.86,
                },
            ];

            const stats = await processUserInsights('user-123', insights, 'case-456');

            expect(stats.stored).toBe(0);
            expect(stats.reinforced).toBe(1);
            expect(stats.discarded).toBe(0);
            expect(reinforceMemory).toHaveBeenCalledWith('existing-repair-strategy');
            expect(insertMemory).not.toHaveBeenCalled();
        });

        it('should reject unknown insight types without write calls', async () => {
            const mockEmbedding = new Array(1536).fill(0.3);
            generateEmbeddings.mockResolvedValue([mockEmbedding]);
            searchSimilarMemories.mockResolvedValue([]);
            insertMemory.mockResolvedValue({ id: 'mem-3' });

            const insights = [
                { text: 'Invented taxonomy that should be ignored', type: 'mystery_bucket', confidence: 0.7 },
            ];

            const stats = await processUserInsights('user-123', insights, 'case-456');

            expect(stats.stored).toBe(0);
            expect(stats.reinforced).toBe(0);
            expect(stats.discarded).toBe(1);
            expect(insertMemory).not.toHaveBeenCalled();
            expect(reinforceMemory).not.toHaveBeenCalled();
        });

        it('should accept tier-native repair_strategy insights as-is', async () => {
            const mockEmbedding = new Array(1536).fill(0.4);
            generateEmbeddings.mockResolvedValue([mockEmbedding]);
            searchSimilarMemories.mockResolvedValue([]);
            insertMemory.mockResolvedValue({ id: 'mem-4' });

            const insights = [
                { text: 'Needs a short timeout before re-engaging', type: 'repair_strategy', confidence: 0.88 },
            ];

            const stats = await processUserInsights('user-123', insights, 'case-456');

            expect(stats.stored).toBe(1);
            expect(insertMemory).toHaveBeenCalledTimes(1);
            expect(insertMemory).toHaveBeenCalledWith(expect.objectContaining({
                memoryType: 'repair_strategy',
            }));
        });
    });

    describe('STENOGRAPHER_SYSTEM_PROMPT', () => {
        it('should define all three insight types', () => {
            expect(STENOGRAPHER_SYSTEM_PROMPT).toContain('TRIGGERS');
            expect(STENOGRAPHER_SYSTEM_PROMPT).toContain('CORE VALUES');
            expect(STENOGRAPHER_SYSTEM_PROMPT).toContain('PATTERNS');
        });

        it('should specify JSON output format', () => {
            expect(STENOGRAPHER_SYSTEM_PROMPT).toContain('userA');
            expect(STENOGRAPHER_SYSTEM_PROMPT).toContain('userB');
            expect(STENOGRAPHER_SYSTEM_PROMPT).toContain('insights');
        });
    });
});

describe('Trigger queueing behavior', () => {
    it('triggerDailyQuestionExtraction skips enqueue when supabase is unconfigured and does not call setImmediate', async () => {
        const payload = {
            questionId: 'dq-unconfigured',
            userAId: 'user-a',
            userBId: 'user-b',
            userAAnswer: 'I need more reassurance.',
            userBAnswer: 'I need clearer plans.',
        };

        isSupabaseConfigured.mockReturnValue(false);
        const getSupabaseSpy = vi.spyOn(supabase, 'getSupabase');
        const setImmediateSpy = vi.spyOn(global, 'setImmediate').mockImplementation(() => 0);
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        triggerDailyQuestionExtraction(payload);
        await Promise.resolve();

        expect(getSupabaseSpy).not.toHaveBeenCalled();
        expect(setImmediateSpy).not.toHaveBeenCalled();

        consoleErrorSpy.mockRestore();
    });

    it('triggerDailyQuestionExtraction enqueues daily_question_extraction without calling setImmediate under default mode', async () => {
        const payload = {
            questionId: 'dq-1',
            userAId: 'user-a',
            userBId: 'user-b',
            userAAnswer: 'I need more reassurance.',
            userBAnswer: 'I need clearer plans.',
        };

        await withMemoryRuntimeDefaults(async () => {
            const setImmediateSpy = vi.spyOn(global, 'setImmediate').mockImplementation(() => 0);
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const { client, from, insert } = createMemoryJobsClientMock();

            vi.spyOn(supabase, 'getSupabase').mockReturnValue(client);

            triggerDailyQuestionExtraction(payload);
            await Promise.resolve();

            expect(from).toHaveBeenCalledWith('memory_jobs');
            expect(insert).toHaveBeenCalledTimes(1);

            const queuedJob = getInsertedMemoryJob(insert);
            expect(queuedJob).toEqual(expect.objectContaining({
                job_type: 'daily_question_extraction',
                payload,
            }));
            expect(setImmediateSpy).not.toHaveBeenCalled();

            consoleErrorSpy.mockRestore();
        });
    });

    it('triggerDailyQuestionExtraction queue-only mode enqueues daily_question_extraction without calling setImmediate', async () => {
        const payload = {
            questionId: 'dq-queue-only',
            userAId: 'user-a',
            userBId: 'user-b',
            userAAnswer: 'I need more reassurance.',
            userBAnswer: 'I need clearer plans.',
        };

        const previousQueueOnly = process.env.MEMORY_QUEUE_ONLY;
        process.env.MEMORY_QUEUE_ONLY = 'true';

        const setImmediateSpy = vi.spyOn(global, 'setImmediate').mockImplementation(() => 0);
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { client, from, insert } = createMemoryJobsClientMock();

        vi.spyOn(supabase, 'getSupabase').mockReturnValue(client);

        try {
            triggerDailyQuestionExtraction(payload);
            await Promise.resolve();

            expect(from).toHaveBeenCalledWith('memory_jobs');
            expect(insert).toHaveBeenCalledTimes(1);

            const queuedJob = getInsertedMemoryJob(insert);
            expect(queuedJob).toEqual(expect.objectContaining({
                job_type: 'daily_question_extraction',
                payload,
            }));
            expect(setImmediateSpy).not.toHaveBeenCalled();
        } finally {
            if (previousQueueOnly === undefined) {
                delete process.env.MEMORY_QUEUE_ONLY;
            } else {
                process.env.MEMORY_QUEUE_ONLY = previousQueueOnly;
            }
            consoleErrorSpy.mockRestore();
        }
    });

    it('triggerBackgroundExtraction enqueues case_extraction without calling setImmediate under default mode when supabase is configured', async () => {
        const caseData = {
            participants: {
                userA: { id: 'user-a', name: 'Alex' },
                userB: { id: 'user-b', name: 'Sam' },
            },
            submissions: {
                userA: { cameraFacts: 'A felt unheard.' },
                userB: { cameraFacts: 'B felt criticized.' },
            },
        };
        const caseId = 'case-default-queue-only';

        await withMemoryRuntimeDefaults(async () => {
            const setImmediateSpy = vi.spyOn(global, 'setImmediate').mockImplementation(() => 0);
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const { client, from, insert } = createMemoryJobsClientMock();

            vi.spyOn(supabase, 'getSupabase').mockReturnValue(client);

            triggerBackgroundExtraction(caseData, caseId);
            await Promise.resolve();

            expect(from).toHaveBeenCalledWith('memory_jobs');
            expect(insert).toHaveBeenCalledTimes(1);
            expect(getInsertedMemoryJob(insert)).toEqual(expect.objectContaining({
                job_type: 'case_extraction',
            }));
            expect(setImmediateSpy).not.toHaveBeenCalled();
            consoleErrorSpy.mockRestore();
        });
    });

    it('triggerDailyQuestionExtraction logs enqueue failures without setImmediate fallback', async () => {
        const payload = {
            questionId: 'dq-queue-only-fallback',
            userAId: 'user-a',
            userBId: 'user-b',
            userAAnswer: 'I need us to slow down and listen.',
            userBAnswer: 'I need us to avoid jumping to conclusions.',
        };

        const previousQueueOnly = process.env.MEMORY_QUEUE_ONLY;
        process.env.MEMORY_QUEUE_ONLY = 'true';

        const queueError = new Error('queue failed');
        const setImmediateSpy = vi.spyOn(global, 'setImmediate').mockImplementation(() => 0);
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { client, from, insert } = createMemoryJobsClientMock({ data: null, error: queueError });

        vi.spyOn(supabase, 'getSupabase').mockReturnValue(client);

        try {
            triggerDailyQuestionExtraction(payload);
            await Promise.resolve();
            await Promise.resolve();

            expect(from).toHaveBeenCalledWith('memory_jobs');
            expect(insert).toHaveBeenCalledTimes(1);
            expect(getInsertedMemoryJob(insert)).toEqual(expect.objectContaining({
                job_type: 'daily_question_extraction',
                payload,
            }));
            expect(setImmediateSpy).not.toHaveBeenCalled();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                '[Stenographer] Failed to enqueue daily question extraction job:',
                queueError
            );
        } finally {
            if (previousQueueOnly === undefined) {
                delete process.env.MEMORY_QUEUE_ONLY;
            } else {
                process.env.MEMORY_QUEUE_ONLY = previousQueueOnly;
            }
            consoleErrorSpy.mockRestore();
        }
    });

    it('triggerAppreciationExtraction enqueues appreciation_extraction without calling setImmediate under default mode', async () => {
        const payload = {
            appreciationId: 'appr-queue-only',
            userAId: 'user-a',
            userBId: 'user-b',
            message: 'Thanks for helping me reset after a hard day.',
            coupleId: 'couple-1',
        };

        await withMemoryRuntimeDefaults(async () => {
            const setImmediateSpy = vi.spyOn(global, 'setImmediate').mockImplementation(() => 0);
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const { client, from, insert } = createMemoryJobsClientMock();

            vi.spyOn(supabase, 'getSupabase').mockReturnValue(client);

            triggerAppreciationExtraction(payload);
            await Promise.resolve();

            expect(from).toHaveBeenCalledWith('memory_jobs');
            expect(insert).toHaveBeenCalledTimes(1);
            expect(getInsertedMemoryJob(insert)).toEqual(expect.objectContaining({
                job_type: 'appreciation_extraction',
                payload,
            }));
            expect(setImmediateSpy).not.toHaveBeenCalled();
            consoleErrorSpy.mockRestore();
        });
    });

    it('triggerAppreciationExtraction logs enqueue failures without setImmediate fallback', async () => {
        const payload = {
            appreciationId: 'appr-queue-only-fallback',
            userAId: 'user-a',
            userBId: 'user-b',
            message: 'Thanks for grounding me after that conflict.',
            coupleId: 'couple-1',
        };

        const previousQueueOnly = process.env.MEMORY_QUEUE_ONLY;
        process.env.MEMORY_QUEUE_ONLY = 'true';

        const queueError = new Error('queue failed');
        const setImmediateSpy = vi.spyOn(global, 'setImmediate').mockImplementation(() => 0);
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { client, from, insert } = createMemoryJobsClientMock({ data: null, error: queueError });

        vi.spyOn(supabase, 'getSupabase').mockReturnValue(client);

        try {
            triggerAppreciationExtraction(payload);
            await Promise.resolve();
            await Promise.resolve();

            expect(from).toHaveBeenCalledWith('memory_jobs');
            expect(insert).toHaveBeenCalledTimes(1);
            expect(getInsertedMemoryJob(insert)).toEqual(expect.objectContaining({
                job_type: 'appreciation_extraction',
                payload,
            }));
            expect(setImmediateSpy).not.toHaveBeenCalled();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                '[Stenographer] Failed to enqueue appreciation extraction job:',
                queueError
            );
        } finally {
            if (previousQueueOnly === undefined) {
                delete process.env.MEMORY_QUEUE_ONLY;
            } else {
                process.env.MEMORY_QUEUE_ONLY = previousQueueOnly;
            }
            consoleErrorSpy.mockRestore();
        }
    });

    it('triggerMemoryCaptionExtraction enqueues memory_caption_extraction without calling setImmediate under default mode', async () => {
        const payload = {
            memoryId: 'memory-queue-only',
            userAId: 'user-a',
            userBId: 'user-b',
            caption: 'Late-night ramen and long talks',
            coupleId: 'couple-1',
        };

        await withMemoryRuntimeDefaults(async () => {
            const setImmediateSpy = vi.spyOn(global, 'setImmediate').mockImplementation(() => 0);
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const { client, from, insert } = createMemoryJobsClientMock();

            vi.spyOn(supabase, 'getSupabase').mockReturnValue(client);

            triggerMemoryCaptionExtraction(payload);
            await Promise.resolve();

            expect(from).toHaveBeenCalledWith('memory_jobs');
            expect(insert).toHaveBeenCalledTimes(1);
            expect(getInsertedMemoryJob(insert)).toEqual(expect.objectContaining({
                job_type: 'memory_caption_extraction',
                payload,
            }));
            expect(setImmediateSpy).not.toHaveBeenCalled();
            consoleErrorSpy.mockRestore();
        });
    });

    it('triggerMemoryCaptionExtraction logs enqueue failures without setImmediate fallback', async () => {
        const payload = {
            memoryId: 'memory-queue-only-fallback',
            userAId: 'user-a',
            userBId: 'user-b',
            caption: 'We laughed through the rain on our night walk',
            coupleId: 'couple-1',
        };

        const previousQueueOnly = process.env.MEMORY_QUEUE_ONLY;
        process.env.MEMORY_QUEUE_ONLY = 'true';

        const queueError = new Error('queue failed');
        const setImmediateSpy = vi.spyOn(global, 'setImmediate').mockImplementation(() => 0);
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { client, from, insert } = createMemoryJobsClientMock({ data: null, error: queueError });

        vi.spyOn(supabase, 'getSupabase').mockReturnValue(client);

        try {
            triggerMemoryCaptionExtraction(payload);
            await Promise.resolve();
            await Promise.resolve();

            expect(from).toHaveBeenCalledWith('memory_jobs');
            expect(insert).toHaveBeenCalledTimes(1);
            expect(getInsertedMemoryJob(insert)).toEqual(expect.objectContaining({
                job_type: 'memory_caption_extraction',
                payload,
            }));
            expect(setImmediateSpy).not.toHaveBeenCalled();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                '[Stenographer] Failed to enqueue memory caption extraction job:',
                queueError
            );
        } finally {
            if (previousQueueOnly === undefined) {
                delete process.env.MEMORY_QUEUE_ONLY;
            } else {
                process.env.MEMORY_QUEUE_ONLY = previousQueueOnly;
            }
            consoleErrorSpy.mockRestore();
        }
    });

    it('triggerAppreciationExtraction skips enqueue when supabase is unconfigured and does not call setImmediate', async () => {
        const payload = {
            appreciationId: 'appr-unconfigured',
            userAId: 'user-a',
            userBId: 'user-b',
            message: 'Thanks for checking in with me.',
            coupleId: 'couple-1',
        };

        const previousQueueOnly = process.env.MEMORY_QUEUE_ONLY;
        process.env.MEMORY_QUEUE_ONLY = 'true';

        isSupabaseConfigured.mockReturnValue(false);
        const getSupabaseSpy = vi.spyOn(supabase, 'getSupabase');
        const setImmediateSpy = vi.spyOn(global, 'setImmediate').mockImplementation(() => 0);
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        try {
            triggerAppreciationExtraction(payload);
            await Promise.resolve();

            expect(getSupabaseSpy).not.toHaveBeenCalled();
            expect(setImmediateSpy).not.toHaveBeenCalled();
        } finally {
            if (previousQueueOnly === undefined) {
                delete process.env.MEMORY_QUEUE_ONLY;
            } else {
                process.env.MEMORY_QUEUE_ONLY = previousQueueOnly;
            }
            consoleErrorSpy.mockRestore();
        }
    });

    it('triggerMemoryCaptionExtraction skips enqueue when supabase is unconfigured and does not call setImmediate', async () => {
        const payload = {
            memoryId: 'memory-unconfigured',
            userAId: 'user-a',
            userBId: 'user-b',
            caption: 'Weekend farmers market and coffee',
            coupleId: 'couple-1',
        };

        const previousQueueOnly = process.env.MEMORY_QUEUE_ONLY;
        process.env.MEMORY_QUEUE_ONLY = 'true';

        isSupabaseConfigured.mockReturnValue(false);
        const getSupabaseSpy = vi.spyOn(supabase, 'getSupabase');
        const setImmediateSpy = vi.spyOn(global, 'setImmediate').mockImplementation(() => 0);
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        try {
            triggerMemoryCaptionExtraction(payload);
            await Promise.resolve();

            expect(getSupabaseSpy).not.toHaveBeenCalled();
            expect(setImmediateSpy).not.toHaveBeenCalled();
        } finally {
            if (previousQueueOnly === undefined) {
                delete process.env.MEMORY_QUEUE_ONLY;
            } else {
                process.env.MEMORY_QUEUE_ONLY = previousQueueOnly;
            }
            consoleErrorSpy.mockRestore();
        }
    });

    it('triggerAppreciationExtraction enqueues appreciation_extraction and logs when enqueue rejects without setImmediate fallback', async () => {
        const payload = {
            appreciationId: 'appr-1',
            userAId: 'user-a',
            userBId: 'user-b',
            message: 'Thanks for supporting me this week.',
        };

        const setImmediateSpy = vi.spyOn(global, 'setImmediate').mockImplementation(() => 0);
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const queueError = new Error('queue failed');
        const { client, from, insert } = createMemoryJobsClientMock({ data: null, error: queueError });

        vi.spyOn(supabase, 'getSupabase').mockReturnValue(client);

        triggerAppreciationExtraction(payload);
        await Promise.resolve();
        await Promise.resolve();

        expect(from).toHaveBeenCalledWith('memory_jobs');
        expect(insert).toHaveBeenCalledTimes(1);

        const queuedJob = getInsertedMemoryJob(insert);
        expect(queuedJob).toEqual(expect.objectContaining({
            job_type: 'appreciation_extraction',
            payload,
        }));
        expect(setImmediateSpy).not.toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            '[Stenographer] Failed to enqueue appreciation extraction job:',
            queueError
        );

        consoleErrorSpy.mockRestore();
    });
});

describe('Memory Retrieval', () => {
    describe('hasHistoricalContext', () => {
        it('should return false when disabled', () => {
            const context = { enabled: false, profiles: {}, memories: [] };
            expect(hasHistoricalContext(context)).toBe(false);
        });

        it('should return true when profiles exist', () => {
            const context = {
                enabled: true,
                profiles: {
                    userA: { attachmentStyle: 'anxious' },
                    userB: {},
                },
                memories: [],
            };
            expect(hasHistoricalContext(context)).toBe(true);
        });

        it('should return true when memories exist', () => {
            const context = {
                enabled: true,
                profiles: { userA: {}, userB: {} },
                memories: [{ text: 'some insight', type: 'trigger' }],
            };
            expect(hasHistoricalContext(context)).toBe(true);
        });

        it('should return false when no useful data', () => {
            const context = {
                enabled: true,
                profiles: { userA: {}, userB: {} },
                memories: [],
            };
            expect(hasHistoricalContext(context)).toBe(false);
        });
    });

    describe('formatContextForPrompt', () => {
        const participants = {
            userA: { name: 'Alex', id: 'user-a' },
            userB: { name: 'Sam', id: 'user-b' },
        };

        it('should return empty string when disabled', () => {
            const context = { enabled: false, profiles: {}, memories: [] };
            const result = formatContextForPrompt(context, participants);
            expect(result).toBe('');
        });

        it('should format profile data correctly', () => {
            const context = {
                enabled: true,
                profiles: {
                    userA: {
                        attachmentStyle: 'anxious',
                        loveLanguages: ['words of affirmation', 'quality time'],
                    },
                    userB: {
                        conflictStyle: 'avoidant',
                    },
                },
                memories: [],
            };

            const result = formatContextForPrompt(context, participants);

            expect(result).toContain('HISTORICAL PROFILE DATA');
            expect(result).toContain("Alex's Profile");
            expect(result).toContain('anxious');
            expect(result).toContain('words of affirmation');
            expect(result).toContain("Sam's Profile");
            expect(result).toContain('avoidant');
        });

        it('should format memories with correct emojis', () => {
            const context = {
                enabled: true,
                profiles: { userA: {}, userB: {} },
                memories: [
                    { userName: 'Alex', text: 'Gets triggered by dismissiveness', type: 'trigger', relevance: 85 },
                    { userName: 'Sam', text: 'Values independence highly', type: 'core_value', relevance: 78 },
                    { userName: 'Alex', text: 'Tends to pursue when feeling disconnected', type: 'pattern', relevance: 72 },
                ],
            };

            const result = formatContextForPrompt(context, participants);

            expect(result).toContain('RELEVANT PAST INSIGHTS');
            expect(result).toContain('⚡'); // trigger emoji
            expect(result).toContain('💎'); // core_value emoji
            expect(result).toContain('🔄'); // pattern emoji
            expect(result).toContain('Gets triggered by dismissiveness');
            expect(result).toContain('Values independence highly');
        });

        it('should include usage instruction', () => {
            const context = {
                enabled: true,
                profiles: { userA: { attachmentStyle: 'secure' }, userB: {} },
                memories: [],
            };

            const result = formatContextForPrompt(context, participants);

            expect(result).toContain('Use this historical context');
        });
    });
});
