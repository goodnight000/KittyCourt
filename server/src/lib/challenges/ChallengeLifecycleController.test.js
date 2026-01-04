import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChallengeLifecycleController from './ChallengeLifecycleController.js';

describe('ChallengeLifecycleController', () => {
    let controller;
    let mockAssignmentManager;
    let mockRepository;
    let mockProgressCalculator;
    let mockTranslationService;
    let mockSupabase;
    const coupleIds = { user_a_id: 'userA', user_b_id: 'userB' };

    beforeEach(() => {
        mockAssignmentManager = {
            isAssignedForPeriod: vi.fn(),
            ensureActiveForAssignments: vi.fn(),
        };

        mockRepository = {
            getChallengeDefinition: vi.fn(),
            getCoupleChallengeByIdAndStatus: vi.fn(),
            createCoupleChallenge: vi.fn(),
            createCoupleChallengeNoReturn: vi.fn(),
            updateChallengeStatusWithExpiration: vi.fn(),
            getActiveCoupleChallengesWithDefinitions: vi.fn(),
            markChallengeStatus: vi.fn(),
            updateChallengeProgress: vi.fn(),
            updateChallengeConfirmation: vi.fn(),
        };

        mockProgressCalculator = {
            parseLog: vi.fn((log) => log || []),
            computeCountProgress: vi.fn(),
            computeStreakProgress: vi.fn(),
            getConfirmRequest: vi.fn(),
        };

        mockTranslationService = {
            loadChallengeTranslations: vi.fn(),
            applyChallengeTranslation: vi.fn((def) => def),
            toChallengeDto: vi.fn((def, row) => ({ id: def.id, status: row?.status || 'available' })),
        };

        mockSupabase = {
            from: vi.fn(),
        };

        controller = new ChallengeLifecycleController(
            mockAssignmentManager,
            mockRepository,
            mockProgressCalculator,
            mockTranslationService
        );
    });

    describe('startChallenge', () => {
        it('should start a new challenge', async () => {
            const definition = { id: 'ch1', name: 'Test', cadence: 'daily' };
            const assignment = { period_end: '2025-01-10' };
            const created = { id: 'cc1', challenge_id: 'ch1', status: 'active' };

            mockRepository.getChallengeDefinition.mockResolvedValue({ data: definition, error: null });
            mockAssignmentManager.isAssignedForPeriod.mockResolvedValue(assignment);
            mockRepository.getCoupleChallengeByIdAndStatus.mockResolvedValue({ data: null, error: null });
            mockRepository.createCoupleChallenge.mockResolvedValue({ data: created, error: null });
            mockTranslationService.loadChallengeTranslations.mockResolvedValue(new Map());

            const result = await controller.startChallenge({
                supabase: mockSupabase,
                coupleIds,
                challengeId: 'ch1',
                language: 'en',
            });

            expect(result.challenge).toBeDefined();
            expect(mockRepository.createCoupleChallenge).toHaveBeenCalled();
        });

        it('should return existing challenge if already started', async () => {
            const definition = { id: 'ch1', name: 'Test', cadence: 'daily' };
            const assignment = { period_end: '2025-01-10' };
            const existing = { id: 'cc1', challenge_id: 'ch1', status: 'active' };

            mockRepository.getChallengeDefinition.mockResolvedValue({ data: definition, error: null });
            mockAssignmentManager.isAssignedForPeriod.mockResolvedValue(assignment);
            mockRepository.getCoupleChallengeByIdAndStatus.mockResolvedValue({ data: existing, error: null });
            mockTranslationService.loadChallengeTranslations.mockResolvedValue(new Map());

            const result = await controller.startChallenge({
                supabase: mockSupabase,
                coupleIds,
                challengeId: 'ch1',
                language: 'en',
            });

            expect(result.challenge).toBeDefined();
            expect(mockRepository.createCoupleChallenge).not.toHaveBeenCalled();
        });

        it('should return error when challenge not found', async () => {
            mockRepository.getChallengeDefinition.mockResolvedValue({ data: null, error: { message: 'Not found' } });

            const result = await controller.startChallenge({
                supabase: mockSupabase,
                coupleIds,
                challengeId: 'ch1',
                language: 'en',
            });

            expect(result.error).toBe('challenge_not_found');
        });

        it('should return error when challenge not assigned', async () => {
            const definition = { id: 'ch1', name: 'Test', cadence: 'daily' };

            mockRepository.getChallengeDefinition.mockResolvedValue({ data: definition, error: null });
            mockAssignmentManager.isAssignedForPeriod.mockResolvedValue(null);

            const result = await controller.startChallenge({
                supabase: mockSupabase,
                coupleIds,
                challengeId: 'ch1',
                language: 'en',
            });

            expect(result.error).toBe('challenge_not_assigned');
        });
    });

    describe('skipChallenge', () => {
        it('should skip an active challenge', async () => {
            const definition = { id: 'ch1', name: 'Test', cadence: 'daily' };
            const assignment = { period_end: '2025-01-10' };
            const activeRow = { id: 'cc1', challenge_id: 'ch1', status: 'active' };

            mockRepository.getChallengeDefinition.mockResolvedValue({ data: definition, error: null });
            mockAssignmentManager.isAssignedForPeriod.mockResolvedValue(assignment);
            mockRepository.getCoupleChallengeByIdAndStatus.mockResolvedValue({ data: activeRow, error: null });
            mockRepository.updateChallengeStatusWithExpiration.mockResolvedValue({ error: null });

            const result = await controller.skipChallenge({
                supabase: mockSupabase,
                coupleIds,
                challengeId: 'ch1',
            });

            expect(result.success).toBe(true);
            expect(mockRepository.updateChallengeStatusWithExpiration).toHaveBeenCalled();
        });

        it('should create skipped row when challenge not active', async () => {
            const definition = { id: 'ch1', name: 'Test', cadence: 'daily' };
            const assignment = { period_end: '2025-01-10' };

            mockRepository.getChallengeDefinition.mockResolvedValue({ data: definition, error: null });
            mockAssignmentManager.isAssignedForPeriod.mockResolvedValue(assignment);
            mockRepository.getCoupleChallengeByIdAndStatus.mockResolvedValue({ data: null, error: null });
            mockRepository.createCoupleChallengeNoReturn.mockResolvedValue({ error: null });

            const result = await controller.skipChallenge({
                supabase: mockSupabase,
                coupleIds,
                challengeId: 'ch1',
            });

            expect(result.success).toBe(true);
            expect(mockRepository.createCoupleChallengeNoReturn).toHaveBeenCalled();
        });

        it('should return error when challenge not found', async () => {
            mockRepository.getChallengeDefinition.mockResolvedValue({ data: null, error: { message: 'Not found' } });

            const result = await controller.skipChallenge({
                supabase: mockSupabase,
                coupleIds,
                challengeId: 'ch1',
            });

            expect(result.error).toBe('challenge_not_found');
        });
    });

    describe('recordChallengeAction', () => {
        it('should record action and update progress', async () => {
            const rows = [
                {
                    id: 'cc1',
                    challenge_id: 'ch1',
                    status: 'active',
                    current_progress: 0,
                    verification_log: [],
                    expires_at: new Date(Date.now() + 86400000).toISOString(),
                    challenges: {
                        id: 'ch1',
                        target_value: 5,
                        reward_xp: 100,
                        verification_config: { action: 'daily_question', type: 'count' },
                    },
                },
            ];

            mockRepository.getActiveCoupleChallengesWithDefinitions.mockResolvedValue({ data: rows, error: null });
            mockProgressCalculator.parseLog.mockReturnValue([]);
            mockProgressCalculator.computeCountProgress.mockReturnValue(1);
            mockRepository.updateChallengeProgress.mockResolvedValue({ data: { id: 'cc1', status: 'active' }, error: null });

            const result = await controller.recordChallengeAction({
                supabase: mockSupabase,
                coupleIds,
                userId: 'userA',
                action: 'daily_question',
                sourceId: 'src1',
            });

            expect(result.success).toBe(true);
            expect(mockRepository.updateChallengeProgress).toHaveBeenCalled();
        });

        it('should skip behavioral challenges', async () => {
            const rows = [
                {
                    id: 'cc1',
                    challenges: {
                        verification_config: { action: 'test_action', type: 'behavioral' },
                    },
                },
            ];

            mockRepository.getActiveCoupleChallengesWithDefinitions.mockResolvedValue({ data: rows, error: null });

            const result = await controller.recordChallengeAction({
                supabase: mockSupabase,
                coupleIds,
                userId: 'userA',
                action: 'test_action',
            });

            expect(result.success).toBe(true);
            expect(mockRepository.updateChallengeProgress).not.toHaveBeenCalled();
        });

        it('should mark expired challenges', async () => {
            const rows = [
                {
                    id: 'cc1',
                    expires_at: new Date(Date.now() - 86400000).toISOString(),
                    challenges: {
                        verification_config: { action: 'test_action', type: 'count' },
                    },
                },
            ];

            mockRepository.getActiveCoupleChallengesWithDefinitions.mockResolvedValue({ data: rows, error: null });
            mockRepository.markChallengeStatus.mockResolvedValue({ error: null });

            const result = await controller.recordChallengeAction({
                supabase: mockSupabase,
                coupleIds,
                userId: 'userA',
                action: 'test_action',
            });

            expect(result.success).toBe(true);
            expect(mockRepository.markChallengeStatus).toHaveBeenCalledWith(mockSupabase, 'cc1', 'expired');
        });

        it('should request confirmation for challenges requiring it', async () => {
            const rows = [
                {
                    id: 'cc1',
                    challenge_id: 'ch1',
                    status: 'active',
                    current_progress: 0,
                    verification_log: [],
                    expires_at: new Date(Date.now() + 86400000).toISOString(),
                    partner_confirm_requested_at: null,
                    challenges: {
                        id: 'ch1',
                        target_value: 1,
                        requires_partner_confirm: true,
                        verification_config: { action: 'test_action', type: 'count' },
                    },
                },
            ];

            mockRepository.getActiveCoupleChallengesWithDefinitions.mockResolvedValue({ data: rows, error: null });
            mockProgressCalculator.parseLog.mockReturnValue([]);
            mockProgressCalculator.computeCountProgress.mockReturnValue(1);
            mockRepository.updateChallengeProgress.mockResolvedValue({ data: { id: 'cc1', status: 'active' }, error: null });

            const result = await controller.recordChallengeAction({
                supabase: mockSupabase,
                coupleIds,
                userId: 'userA',
                action: 'test_action',
            });

            expect(result.success).toBe(true);
        });

        it('should handle empty rows', async () => {
            mockRepository.getActiveCoupleChallengesWithDefinitions.mockResolvedValue({ data: [], error: null });

            const result = await controller.recordChallengeAction({
                supabase: mockSupabase,
                coupleIds,
                userId: 'userA',
                action: 'test_action',
            });

            expect(result.success).toBe(true);
        });
    });

    describe('requestChallengeCompletion', () => {
        it('should request completion confirmation', async () => {
            const row = {
                id: 'cc1',
                partner_confirm_requested_at: null,
                verification_log: [],
                challenges: { requires_partner_confirm: true },
            };

            mockRepository.getCoupleChallengeByIdAndStatus.mockResolvedValue({ data: row, error: null });
            mockProgressCalculator.parseLog.mockReturnValue([]);
            mockRepository.updateChallengeConfirmation.mockResolvedValue({ error: null });

            const result = await controller.requestChallengeCompletion({
                supabase: mockSupabase,
                coupleIds,
                userId: 'userA',
                challengeId: 'ch1',
            });

            expect(result.success).toBe(true);
            expect(result.pending).toBe(true);
        });

        it('should return pending if already requested', async () => {
            const row = {
                id: 'cc1',
                partner_confirm_requested_at: '2025-01-01T00:00:00Z',
                challenges: { requires_partner_confirm: true },
            };

            mockRepository.getCoupleChallengeByIdAndStatus.mockResolvedValue({ data: row, error: null });

            const result = await controller.requestChallengeCompletion({
                supabase: mockSupabase,
                coupleIds,
                userId: 'userA',
                challengeId: 'ch1',
            });

            expect(result.success).toBe(true);
            expect(result.pending).toBe(true);
        });

        it('should return error when challenge not active', async () => {
            mockRepository.getCoupleChallengeByIdAndStatus.mockResolvedValue({ data: null, error: null });

            const result = await controller.requestChallengeCompletion({
                supabase: mockSupabase,
                coupleIds,
                userId: 'userA',
                challengeId: 'ch1',
            });

            expect(result.error).toBe('challenge_not_active');
        });

        it('should return error when confirmation not required', async () => {
            const row = {
                challenges: { requires_partner_confirm: false },
            };

            mockRepository.getCoupleChallengeByIdAndStatus.mockResolvedValue({ data: row, error: null });

            const result = await controller.requestChallengeCompletion({
                supabase: mockSupabase,
                coupleIds,
                userId: 'userA',
                challengeId: 'ch1',
            });

            expect(result.error).toBe('confirmation_not_required');
        });
    });

    describe('confirmChallengeCompletion', () => {
        it('should confirm completion from partner', async () => {
            const row = {
                id: 'cc1',
                partner_confirm_requested_at: '2025-01-01T00:00:00Z',
                verification_log: [
                    { type: 'confirm_request', user_id: 'userB', at: '2025-01-01T00:00:00Z' },
                ],
                challenges: { id: 'ch1', target_value: 5, reward_xp: 100 },
            };

            mockRepository.getCoupleChallengeByIdAndStatus.mockResolvedValue({ data: row, error: null });
            mockProgressCalculator.parseLog.mockReturnValue(row.verification_log);
            mockProgressCalculator.getConfirmRequest.mockReturnValue({ user_id: 'userB' });
            mockRepository.updateChallengeConfirmation.mockResolvedValue({ error: null });

            // Mock XP check
            mockSupabase.from.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnThis(),
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
            });

            const result = await controller.confirmChallengeCompletion({
                supabase: mockSupabase,
                coupleIds,
                userId: 'userA',
                challengeId: 'ch1',
            });

            expect(result.success).toBe(true);
            expect(mockRepository.updateChallengeConfirmation).toHaveBeenCalled();
        });

        it('should prevent self-confirmation', async () => {
            const row = {
                partner_confirm_requested_at: '2025-01-01T00:00:00Z',
                verification_log: [
                    { type: 'confirm_request', user_id: 'userA', at: '2025-01-01T00:00:00Z' },
                ],
                challenges: {},
            };

            mockRepository.getCoupleChallengeByIdAndStatus.mockResolvedValue({ data: row, error: null });
            mockProgressCalculator.parseLog.mockReturnValue(row.verification_log);
            mockProgressCalculator.getConfirmRequest.mockReturnValue({ user_id: 'userA' });

            const result = await controller.confirmChallengeCompletion({
                supabase: mockSupabase,
                coupleIds,
                userId: 'userA',
                challengeId: 'ch1',
            });

            expect(result.error).toBe('cannot_confirm_own_request');
        });

        it('should return error when no pending confirmation', async () => {
            const row = {
                partner_confirm_requested_at: null,
                challenges: {},
            };

            mockRepository.getCoupleChallengeByIdAndStatus.mockResolvedValue({ data: row, error: null });

            const result = await controller.confirmChallengeCompletion({
                supabase: mockSupabase,
                coupleIds,
                userId: 'userA',
                challengeId: 'ch1',
            });

            expect(result.error).toBe('no_pending_confirmation');
        });
    });

    describe('handleChallengeCompletion', () => {
        it('should skip when no reward XP', async () => {
            const result = await controller.handleChallengeCompletion({
                supabase: mockSupabase,
                coupleIds,
                challengeId: 'ch1',
                coupleChallengeId: 'cc1',
                rewardXP: 0,
                difficulty: 'easy',
                userId: 'userA',
            });

            expect(result.skipped).toBe(true);
        });

        it('should skip when XP already awarded (idempotency)', async () => {
            mockSupabase.from.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnThis(),
                    maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'xp1' }, error: null }),
                }),
            });

            const result = await controller.handleChallengeCompletion({
                supabase: mockSupabase,
                coupleIds,
                challengeId: 'ch1',
                coupleChallengeId: 'cc1',
                rewardXP: 100,
                difficulty: 'medium',
                userId: 'userA',
            });

            expect(result.skipped).toBe(true);
        });
    });
});
