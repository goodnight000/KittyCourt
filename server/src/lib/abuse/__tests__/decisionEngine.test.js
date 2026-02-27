import { describe, it, expect } from 'vitest';
import { decideAbuseAction } from '../decisionEngine.js';

describe('decisionEngine', () => {
    it('allows low-risk scores', () => {
        const result = decideAbuseAction({ score: 20, level: 'low', signals: {} });

        expect(result.action).toBe('allow');
        expect(result.reason).toBe('score_below_review');
        expect(result.expiresInSeconds).toBe(0);
    });

    it('challenges medium-risk scores', () => {
        const result = decideAbuseAction({ score: 60, level: 'high', signals: {} });

        expect(result.action).toBe('challenge');
        expect(result.reason).toBe('score_gte_challenge');
        expect(result.expiresInSeconds).toBeGreaterThan(0);
    });

    it('blocks high-risk scores', () => {
        const result = decideAbuseAction({ score: 92, level: 'critical', signals: {} });

        expect(result.action).toBe('block');
        expect(result.reason).toBe('score_gte_block');
        expect(result.shouldLog).toBe(true);
    });

    it('hard-blocks when configured signal threshold is crossed', () => {
        const result = decideAbuseAction(
            {
                score: 10,
                level: 'low',
                signals: {
                    priorAbuse: 0.95,
                },
            },
            {
                hardBlockSignals: {
                    priorAbuse: 0.9,
                },
            }
        );

        expect(result.action).toBe('block');
        expect(result.reason).toBe('hard_block:priorAbuse');
    });
});
