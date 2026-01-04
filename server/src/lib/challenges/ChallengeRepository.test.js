import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChallengeRepository from './ChallengeRepository.js';

describe('ChallengeRepository', () => {
    let repository;
    let mockSupabase;
    const coupleIds = { user_a_id: 'userA', user_b_id: 'userB' };

    beforeEach(() => {
        repository = new ChallengeRepository();
        mockSupabase = {
            from: vi.fn(),
        };
    });

    describe('getChallengeDefinitions', () => {
        it('should fetch challenge definitions by IDs', async () => {
            const mockData = [
                { id: 'ch1', name: 'Challenge 1' },
                { id: 'ch2', name: 'Challenge 2' },
            ];

            mockSupabase.from.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    in: vi.fn().mockResolvedValue({ data: mockData, error: null }),
                }),
            });

            const result = await repository.getChallengeDefinitions(mockSupabase, ['ch1', 'ch2']);

            expect(result.data).toEqual(mockData);
            expect(result.error).toBeNull();
            expect(mockSupabase.from).toHaveBeenCalledWith('challenges');
        });
    });

    describe('getChallengeDefinition', () => {
        it('should fetch single challenge definition', async () => {
            const mockData = { id: 'ch1', name: 'Challenge 1', is_active: true };

            mockSupabase.from.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnThis(),
                    single: vi.fn().mockResolvedValue({ data: mockData, error: null }),
                }),
            });

            const result = await repository.getChallengeDefinition(mockSupabase, 'ch1');

            expect(result.data).toEqual(mockData);
            expect(result.error).toBeNull();
        });
    });

    describe('getCoupleChallenges', () => {
        it('should fetch couple challenges for couple IDs', async () => {
            const mockData = [
                { id: 'cc1', challenge_id: 'ch1', current_progress: 5 },
                { id: 'cc2', challenge_id: 'ch2', current_progress: 3 },
            ];

            mockSupabase.from.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnThis(),
                    in: vi.fn().mockResolvedValue({ data: mockData, error: null }),
                }),
            });

            const result = await repository.getCoupleChallenges(mockSupabase, coupleIds, ['ch1', 'ch2']);

            expect(result.data).toEqual(mockData);
            expect(mockSupabase.from).toHaveBeenCalledWith('couple_challenges');
        });
    });

    describe('getActiveCoupleChallengesWithDefinitions', () => {
        it('should fetch active challenges with joined definitions', async () => {
            const mockData = [
                { id: 'cc1', challenge_id: 'ch1', status: 'active', challenges: { id: 'ch1', name: 'Test' } },
            ];

            // Create a properly chainable mock for .eq().eq().eq() pattern (3 chained eq calls)
            // The query is: .select().eq('user_a_id').eq('user_b_id').eq('status')
            const chainableMock = {
                eq: vi.fn(),
            };
            // First .eq() returns object with .eq(), second .eq() returns object with .eq(), third .eq() resolves
            chainableMock.eq.mockImplementation(() => ({
                eq: vi.fn().mockImplementation(() => ({
                    eq: vi.fn().mockResolvedValue({ data: mockData, error: null }),
                })),
            }));

            mockSupabase.from.mockReturnValue({
                select: vi.fn().mockReturnValue(chainableMock),
            });

            const result = await repository.getActiveCoupleChallengesWithDefinitions(mockSupabase, coupleIds);

            expect(result.data).toEqual(mockData);
        });
    });

    describe('getCoupleChallengeByIdAndStatus', () => {
        it('should fetch couple challenge by ID and status', async () => {
            const mockData = { id: 'cc1', challenge_id: 'ch1', status: 'active' };

            mockSupabase.from.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnThis(),
                    maybeSingle: vi.fn().mockResolvedValue({ data: mockData, error: null }),
                }),
            });

            const result = await repository.getCoupleChallengeByIdAndStatus(
                mockSupabase,
                coupleIds,
                'ch1',
                'active'
            );

            expect(result.data).toEqual(mockData);
        });
    });

    describe('updateChallengeProgress', () => {
        it('should update challenge progress', async () => {
            const mockData = { id: 'cc1', status: 'active' };
            const updates = { current_progress: 10, verification_log: [] };

            mockSupabase.from.mockReturnValue({
                update: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        select: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({ data: mockData, error: null }),
                        }),
                    }),
                }),
            });

            const result = await repository.updateChallengeProgress(mockSupabase, 'cc1', updates);

            expect(result.data).toEqual(mockData);
            expect(mockSupabase.from).toHaveBeenCalledWith('couple_challenges');
        });
    });

    describe('createCoupleChallenge', () => {
        it('should create couple challenge and return data', async () => {
            const mockData = { id: 'cc1', challenge_id: 'ch1', status: 'active' };
            const payload = {
                user_a_id: 'userA',
                user_b_id: 'userB',
                challenge_id: 'ch1',
                status: 'active',
            };

            mockSupabase.from.mockReturnValue({
                insert: vi.fn().mockReturnValue({
                    select: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({ data: mockData, error: null }),
                    }),
                }),
            });

            const result = await repository.createCoupleChallenge(mockSupabase, payload);

            expect(result.data).toEqual(mockData);
        });
    });

    describe('createCoupleChallengeNoReturn', () => {
        it('should create couple challenge without returning data', async () => {
            const payload = {
                user_a_id: 'userA',
                user_b_id: 'userB',
                challenge_id: 'ch1',
                status: 'skipped',
            };

            mockSupabase.from.mockReturnValue({
                insert: vi.fn().mockResolvedValue({ error: null }),
            });

            const result = await repository.createCoupleChallengeNoReturn(mockSupabase, payload);

            expect(result.error).toBeNull();
        });
    });

    describe('markChallengeStatus', () => {
        it('should update challenge status', async () => {
            mockSupabase.from.mockReturnValue({
                update: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({ error: null }),
                }),
            });

            const result = await repository.markChallengeStatus(mockSupabase, 'cc1', 'expired');

            expect(result.error).toBeNull();
        });
    });

    describe('updateChallengeStatusWithExpiration', () => {
        it('should update status and expiration', async () => {
            mockSupabase.from.mockReturnValue({
                update: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({ error: null }),
                }),
            });

            const result = await repository.updateChallengeStatusWithExpiration(
                mockSupabase,
                'cc1',
                'skipped',
                '2025-01-10T00:00:00Z'
            );

            expect(result.error).toBeNull();
        });
    });

    describe('updateChallengeConfirmation', () => {
        it('should update confirmation fields', async () => {
            const updates = {
                partner_confirm_requested_at: '2025-01-01T00:00:00Z',
                verification_log: [],
            };

            mockSupabase.from.mockReturnValue({
                update: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({ error: null }),
                }),
            });

            const result = await repository.updateChallengeConfirmation(mockSupabase, 'cc1', updates);

            expect(result.error).toBeNull();
        });
    });
});
