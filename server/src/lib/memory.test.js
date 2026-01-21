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
    STENOGRAPHER_SYSTEM_PROMPT,
} = require('./stenographer');
const { formatContextForPrompt, hasHistoricalContext } = require('./memoryRetrieval');

let searchSimilarMemories;
let insertMemory;
let reinforceMemory;
let generateEmbeddings;
let isSupabaseConfigured;

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
            expect(prompt).toContain('make me laugh');
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

        it('should return empty stats for empty insights', async () => {
            const stats = await processUserInsights('user-123', [], 'case-456');

            expect(stats.stored).toBe(0);
            expect(stats.reinforced).toBe(0);
            expect(stats.discarded).toBe(0);
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
