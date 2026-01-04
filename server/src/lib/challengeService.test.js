import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const mockState = {
    coupleChallengeRow: null,
    xpTransactionRow: null,
};

const createQuery = (table) => {
    const query = {
        _table: table,
        _op: null,
        select: vi.fn(() => {
            query._op = 'select';
            return query;
        }),
        update: vi.fn(() => {
            query._op = 'update';
            return query;
        }),
        insert: vi.fn(() => {
            query._op = 'insert';
            return query;
        }),
        eq: vi.fn(() => query),
        maybeSingle: vi.fn(async () => {
            if (table === 'couple_challenges') {
                return { data: mockState.coupleChallengeRow, error: null };
            }
            if (table === 'xp_transactions') {
                return { data: mockState.xpTransactionRow, error: null };
            }
            return { data: null, error: null };
        }),
        single: vi.fn(async () => ({ data: null, error: null })),
        then: (resolve, reject) => Promise.resolve({ data: null, error: null }).then(resolve, reject),
    };

    return query;
};

const mockSupabase = {
    from: vi.fn((table) => createQuery(table)),
};

const mockAwardXP = vi.fn();

describe('challengeService confirmation guard', () => {
    let confirmChallengeCompletion;

    beforeEach(() => {
        vi.clearAllMocks();
        mockState.coupleChallengeRow = null;
        mockState.xpTransactionRow = null;

        const supabase = require('./supabase');
        const xpService = require('./xpService');

        vi.spyOn(supabase, 'getSupabase').mockReturnValue(mockSupabase);
        vi.spyOn(supabase, 'isSupabaseConfigured').mockReturnValue(true);
        vi.spyOn(xpService, 'isXPSystemEnabled').mockReturnValue(true);
        vi.spyOn(xpService, 'getOrderedCoupleIds').mockReturnValue({ user_a_id: 'user-a', user_b_id: 'user-b' });
        vi.spyOn(xpService, 'awardXP').mockImplementation(mockAwardXP);

        mockAwardXP.mockResolvedValue({ success: true });

        // Load challenge service after mocks are set up
        // Note: We only clear challengeService cache, not lifecycle controller,
        // to avoid ES module import issues with dateTimeUtils
        delete require.cache[require.resolve('./challengeService')];
        const challengeService = require('./challengeService');
        confirmChallengeCompletion = challengeService.confirmChallengeCompletion;
    });

    it('rejects confirmation from the requester', async () => {
        mockState.coupleChallengeRow = {
            id: 'cc-1',
            partner_confirm_requested_at: new Date().toISOString(),
            verification_log: [
                { type: 'confirm_request', user_id: 'user-a', at: new Date().toISOString() },
            ],
            challenges: {
                requires_partner_confirm: true,
                reward_xp: 50,
                difficulty: 'medium',
                target_value: 3,
            },
        };

        const result = await confirmChallengeCompletion({
            userId: 'user-a',
            partnerId: 'user-b',
            challengeId: 'challenge-1',
        });

        expect(result).toEqual({ error: 'cannot_confirm_own_request' });
        expect(mockAwardXP).not.toHaveBeenCalled();
    });

    it('uses a couple-scoped idempotency key for completion awards', async () => {
        mockState.coupleChallengeRow = {
            id: 'cc-2',
            partner_confirm_requested_at: new Date().toISOString(),
            verification_log: [
                { type: 'confirm_request', user_id: 'user-b', at: new Date().toISOString() },
            ],
            challenges: {
                requires_partner_confirm: true,
                reward_xp: 50,
                difficulty: 'medium',
                target_value: 3,
            },
        };

        const result = await confirmChallengeCompletion({
            userId: 'user-a',
            partnerId: 'user-b',
            challengeId: 'challenge-1',
        });

        expect(result).toEqual({ success: true });
        expect(mockAwardXP).toHaveBeenCalledTimes(1);
        const call = mockAwardXP.mock.calls[0][0];
        expect(call.sourceId).toBe('cc-2');
        expect(call.idempotencyKeyOverride).toBe('challenge_completion:user-a:user-b:cc-2');
    });
});
