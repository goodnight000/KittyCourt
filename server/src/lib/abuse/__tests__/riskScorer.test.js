import { describe, it, expect } from 'vitest';
import { scoreRisk } from '../riskScorer.js';

describe('riskScorer', () => {
    it('scores deterministically with default weights and thresholds', () => {
        const result = scoreRisk({
            velocity: 1,
            failures: 0.5,
            networkSpread: 0.2,
            ipReputation: 0.8,
            accountAge: 0.3,
            payloadAnomaly: 0,
            deviceRisk: 1,
            geoVelocity: 0.4,
            disposableEmail: 1,
            priorAbuse: 0.6,
        });

        expect(result.score).toBe(59.5);
        expect(result.level).toBe('high');
        expect(result.contributors.slice(0, 3).map((c) => c.key)).toEqual([
            'velocity',
            'ipReputation',
            'deviceRisk',
        ]);
    });

    it('clamps out-of-range values and ignores unknown keys', () => {
        const result = scoreRisk({
            velocity: 2,
            failures: -4,
            networkSpread: 'not-a-number',
            unknownSignal: 1,
        });

        expect(result.normalizedSignals.velocity).toBe(1);
        expect(result.normalizedSignals.failures).toBe(0);
        expect(result.normalizedSignals.networkSpread).toBe(0);
        expect(result.normalizedSignals.unknownSignal).toBeUndefined();
        expect(result.score).toBe(15);
        expect(result.level).toBe('low');
    });

    it('supports custom weights and thresholds', () => {
        const result = scoreRisk(
            {
                velocity: 1,
                failures: 1,
            },
            {
                weights: {
                    velocity: 50,
                    failures: 50,
                },
                levelThresholds: {
                    medium: 10,
                    high: 30,
                    critical: 70,
                },
            }
        );

        expect(result.score).toBe(100);
        expect(result.level).toBe('critical');
    });
});
