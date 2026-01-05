import { describe, it, expect, vi, beforeEach } from 'vitest';
import TranslationService from './TranslationService.js';
import { parseLog, getConfirmRequest } from './verificationLogUtils.js';

describe('TranslationService', () => {
    let service;
    let mockSupabase;

    beforeEach(() => {
        service = new TranslationService();
        mockSupabase = {
            from: vi.fn(),
        };
    });

    describe('loadChallengeTranslations', () => {
        it('should load translations for challenge IDs', async () => {
            const mockData = [
                { challenge_id: 'ch1', language: 'en', name: 'Challenge 1', description: 'Description 1' },
                { challenge_id: 'ch1', language: 'zh-Hans', name: '挑战1', description: '描述1' },
                { challenge_id: 'ch2', language: 'en', name: 'Challenge 2', description: 'Description 2' },
            ];

            mockSupabase.from.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    in: vi.fn().mockReturnValue({
                        in: vi.fn().mockResolvedValue({ data: mockData, error: null }),
                    }),
                }),
            });

            const result = await service.loadChallengeTranslations(mockSupabase, ['ch1', 'ch2'], 'zh-Hans');

            expect(result.size).toBe(2);
            expect(result.get('ch1')).toHaveProperty('en');
            expect(result.get('ch1')).toHaveProperty('zh-Hans');
            expect(result.get('ch1')['zh-Hans'].name).toBe('挑战1');
        });

        it('should return empty map when no challenge IDs provided', async () => {
            const result = await service.loadChallengeTranslations(mockSupabase, [], 'en');
            expect(result.size).toBe(0);
        });

        it('should handle null challenge IDs', async () => {
            const result = await service.loadChallengeTranslations(mockSupabase, null, 'en');
            expect(result.size).toBe(0);
        });

        it('should handle database errors gracefully', async () => {
            mockSupabase.from.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    in: vi.fn().mockReturnValue({
                        in: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
                    }),
                }),
            });

            const result = await service.loadChallengeTranslations(mockSupabase, ['ch1'], 'en');
            expect(result.size).toBe(0);
        });

        it('should filter null IDs from array', async () => {
            mockSupabase.from.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    in: vi.fn().mockReturnValue({
                        in: vi.fn().mockResolvedValue({ data: [], error: null }),
                    }),
                }),
            });

            const result = await service.loadChallengeTranslations(mockSupabase, ['ch1', null, 'ch2'], 'en');
            expect(mockSupabase.from).toHaveBeenCalled();
        });
    });

    describe('applyChallengeTranslation', () => {
        it('should apply translation to challenge definition', () => {
            const definition = { id: 'ch1', name: 'Challenge 1', description: 'Desc 1' };
            const translationMap = new Map([
                ['ch1', {
                    en: { name: 'Challenge 1', description: 'Desc 1' },
                    'zh-Hans': { name: '挑战1', description: '描述1' },
                }],
            ]);

            const result = service.applyChallengeTranslation(definition, translationMap, 'zh-Hans');

            expect(result.name).toBe('挑战1');
            expect(result.description).toBe('描述1');
        });

        it('should fallback to English when target language not available', () => {
            const definition = { id: 'ch1', name: 'Challenge 1', description: 'Desc 1' };
            const translationMap = new Map([
                ['ch1', {
                    en: { name: 'English Name', description: 'English Desc' },
                }],
            ]);

            const result = service.applyChallengeTranslation(definition, translationMap, 'fr');

            expect(result.name).toBe('English Name');
            expect(result.description).toBe('English Desc');
        });

        it('should return original definition when no translation found', () => {
            const definition = { id: 'ch1', name: 'Original', description: 'Original Desc' };
            const translationMap = new Map();

            const result = service.applyChallengeTranslation(definition, translationMap, 'en');

            expect(result.name).toBe('Original');
            expect(result.description).toBe('Original Desc');
        });

        it('should handle null definition', () => {
            const result = service.applyChallengeTranslation(null, new Map(), 'en');
            expect(result).toBeNull();
        });
    });

    describe('toChallengeDto', () => {
        it('should transform definition and row to DTO', () => {
            const definition = {
                id: 'ch1',
                name: 'Test Challenge',
                description: 'Test Description',
                emoji: '🎯',
                target_value: 5,
                difficulty: 'medium',
                reward_xp: 100,
                cadence: 'weekly',
                requires_partner_confirm: false,
            };
            const row = {
                challenge_id: 'ch1',
                status: 'active',
                current_progress: 3,
                expires_at: new Date(Date.now() + 86400000 * 3).toISOString(),
                verification_log: [],
            };

            const result = service.toChallengeDto(definition, row);

            expect(result.id).toBe('ch1');
            expect(result.title).toBe('Test Challenge');
            expect(result.currentProgress).toBe(3);
            expect(result.targetProgress).toBe(5);
            expect(result.status).toBe('active');
            expect(result.rewardXP).toBe(100);
        });

        it('should return targetProgress for completed challenges', () => {
            const definition = { id: 'ch1', name: 'Test', target_value: 10 };
            const row = { status: 'completed', current_progress: 10 };

            const result = service.toChallengeDto(definition, row);

            expect(result.currentProgress).toBe(10);
        });

        it('should handle confirmation status correctly', () => {
            const definition = { id: 'ch1', requires_partner_confirm: true };
            const row = {
                partner_confirm_requested_at: '2025-01-01T00:00:00Z',
                partner_confirmed_at: null,
                verification_log: JSON.stringify([
                    { type: 'confirm_request', user_id: 'user1', at: '2025-01-01T00:00:00Z' },
                ]),
            };

            const result = service.toChallengeDto(definition, row);

            expect(result.confirmationStatus).toBe('pending');
            expect(result.confirmRequestedBy).toBe('user1');
        });

        it('should handle confirmed status', () => {
            const definition = { id: 'ch1' };
            const row = {
                partner_confirm_requested_at: '2025-01-01T00:00:00Z',
                partner_confirmed_at: '2025-01-02T00:00:00Z',
                verification_log: [],
            };

            const result = service.toChallengeDto(definition, row);

            expect(result.confirmationStatus).toBe('confirmed');
        });

        it('should use default values when row is null', () => {
            const definition = { id: 'ch1', name: 'Test' };

            const result = service.toChallengeDto(definition, null);

            expect(result.status).toBe('available');
            expect(result.currentProgress).toBe(0);
        });
    });

    describe('_computeDaysLeft', () => {
        it('should compute days left correctly', () => {
            const threeDaysFromNow = new Date(Date.now() + 86400000 * 3).toISOString();
            const daysLeft = service._computeDaysLeft(threeDaysFromNow);

            expect(daysLeft).toBeGreaterThanOrEqual(2);
            expect(daysLeft).toBeLessThanOrEqual(3);
        });

        it('should return 0 for expired challenges', () => {
            const yesterday = new Date(Date.now() - 86400000).toISOString();
            const daysLeft = service._computeDaysLeft(yesterday);

            expect(daysLeft).toBe(0);
        });

        it('should return default when no expiration provided', () => {
            const daysLeft = service._computeDaysLeft(null);

            expect(daysLeft).toBe(7);
        });
    });

});

// Test the shared utilities (parseLog and getConfirmRequest)
// These were previously private methods on TranslationService but are now shared
describe('verificationLogUtils', () => {
    describe('parseLog', () => {
        it('should parse JSON string log', () => {
            const log = JSON.stringify([{ type: 'action', user_id: 'user1' }]);
            const result = parseLog(log);

            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(1);
        });

        it('should return array as-is', () => {
            const log = [{ type: 'action' }];
            const result = parseLog(log);

            expect(result).toBe(log);
        });

        it('should handle null log', () => {
            const result = parseLog(null);

            expect(result).toEqual([]);
        });

        it('should handle invalid JSON gracefully', () => {
            const result = parseLog('invalid json');

            expect(result).toEqual([]);
        });
    });

    describe('getConfirmRequest', () => {
        it('should return latest confirm request', () => {
            const log = [
                { type: 'action', user_id: 'user1' },
                { type: 'confirm_request', user_id: 'user1', at: '2025-01-01T00:00:00Z' },
                { type: 'action', user_id: 'user2' },
            ];

            const result = getConfirmRequest(log);

            expect(result.type).toBe('confirm_request');
            expect(result.user_id).toBe('user1');
        });

        it('should return null when no confirm request exists', () => {
            const log = [
                { type: 'action', user_id: 'user1' },
            ];

            const result = getConfirmRequest(log);

            expect(result).toBeNull();
        });

        it('should handle empty log', () => {
            const result = getConfirmRequest([]);

            expect(result).toBeNull();
        });
    });
});
