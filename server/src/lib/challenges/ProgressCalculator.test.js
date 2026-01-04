import { describe, it, expect, beforeEach } from 'vitest';
import ProgressCalculator from './ProgressCalculator.js';

describe('ProgressCalculator', () => {
    let calculator;

    beforeEach(() => {
        calculator = new ProgressCalculator();
    });

    describe('parseLog', () => {
        it('should return array as-is', () => {
            const log = [{ type: 'action' }];
            const result = calculator.parseLog(log);
            expect(result).toBe(log);
        });

        it('should parse JSON string', () => {
            const log = JSON.stringify([{ type: 'action' }]);
            const result = calculator.parseLog(log);
            expect(Array.isArray(result)).toBe(true);
            expect(result[0].type).toBe('action');
        });

        it('should handle null log', () => {
            const result = calculator.parseLog(null);
            expect(result).toEqual([]);
        });

        it('should handle invalid JSON', () => {
            const result = calculator.parseLog('invalid json');
            expect(result).toEqual([]);
        });

        it('should handle non-array JSON', () => {
            const result = calculator.parseLog('{"type": "action"}');
            expect(result).toEqual([]);
        });
    });

    describe('getUniqueActions', () => {
        it('should filter by action type', () => {
            const log = [
                { type: 'action', action: 'daily_question', user_id: 'user1', at: '2025-01-01T00:00:00Z' },
                { type: 'action', action: 'appreciation', user_id: 'user1', at: '2025-01-01T01:00:00Z' },
                { type: 'confirm_request', user_id: 'user1' },
            ];

            const result = calculator.getUniqueActions(log, 'daily_question');

            expect(result.length).toBe(1);
            expect(result[0].action).toBe('daily_question');
        });

        it('should deduplicate by user_id and source_id', () => {
            const log = [
                { type: 'action', action: 'test', user_id: 'user1', source_id: 'src1', at: '2025-01-01T00:00:00Z' },
                { type: 'action', action: 'test', user_id: 'user1', source_id: 'src1', at: '2025-01-01T01:00:00Z' },
                { type: 'action', action: 'test', user_id: 'user1', source_id: 'src2', at: '2025-01-01T02:00:00Z' },
            ];

            const result = calculator.getUniqueActions(log, 'test');

            expect(result.length).toBe(2);
        });

        it('should deduplicate by user_id and timestamp when no source_id', () => {
            const log = [
                { type: 'action', action: 'test', user_id: 'user1', at: '2025-01-01T00:00:00Z' },
                { type: 'action', action: 'test', user_id: 'user1', at: '2025-01-01T00:00:00Z' },
                { type: 'action', action: 'test', user_id: 'user1', at: '2025-01-01T01:00:00Z' },
            ];

            const result = calculator.getUniqueActions(log, 'test');

            expect(result.length).toBe(2);
        });

        it('should handle empty log', () => {
            const result = calculator.getUniqueActions([], 'test');
            expect(result).toEqual([]);
        });
    });

    describe('computeCountProgress', () => {
        const coupleIds = { user_a_id: 'userA', user_b_id: 'userB' };

        it('should sum counts when perPartner is false', () => {
            const log = [
                { type: 'action', action: 'test', user_id: 'userA', source_id: 's1' },
                { type: 'action', action: 'test', user_id: 'userA', source_id: 's2' },
                { type: 'action', action: 'test', user_id: 'userB', source_id: 's3' },
            ];

            const result = calculator.computeCountProgress(log, 'test', coupleIds, false);

            expect(result).toBe(3);
        });

        it('should return minimum when perPartner is true', () => {
            const log = [
                { type: 'action', action: 'test', user_id: 'userA', source_id: 's1' },
                { type: 'action', action: 'test', user_id: 'userA', source_id: 's2' },
                { type: 'action', action: 'test', user_id: 'userA', source_id: 's3' },
                { type: 'action', action: 'test', user_id: 'userB', source_id: 's4' },
            ];

            const result = calculator.computeCountProgress(log, 'test', coupleIds, true);

            expect(result).toBe(1); // Min of 3 and 1
        });

        it('should return 0 when both partners have 0 (perPartner mode)', () => {
            const log = [];

            const result = calculator.computeCountProgress(log, 'test', coupleIds, true);

            expect(result).toBe(0);
        });

        it('should ignore actions from other users', () => {
            const log = [
                { type: 'action', action: 'test', user_id: 'userA', source_id: 's1' },
                { type: 'action', action: 'test', user_id: 'otherUser', source_id: 's2' },
            ];

            const result = calculator.computeCountProgress(log, 'test', coupleIds, false);

            expect(result).toBe(1);
        });

        it('should handle empty log', () => {
            const result = calculator.computeCountProgress([], 'test', coupleIds, false);

            expect(result).toBe(0);
        });
    });

    describe('computeStreakProgress', () => {
        const coupleIds = { user_a_id: 'userA', user_b_id: 'userB' };

        it('should compute streak when requireBoth is false', () => {
            const log = [
                { type: 'action', action: 'test', user_id: 'userA', day_et: '2025-01-03', source_id: 's1' },
                { type: 'action', action: 'test', user_id: 'userB', day_et: '2025-01-02', source_id: 's2' },
                { type: 'action', action: 'test', user_id: 'userA', day_et: '2025-01-01', source_id: 's3' },
            ];

            const result = calculator.computeStreakProgress(log, 'test', coupleIds, false);

            expect(result).toBe(3); // 3 consecutive days
        });

        it('should compute streak when requireBoth is true (only days where both acted)', () => {
            const log = [
                { type: 'action', action: 'test', user_id: 'userA', day_et: '2025-01-03', source_id: 's1' },
                { type: 'action', action: 'test', user_id: 'userB', day_et: '2025-01-03', source_id: 's2' },
                { type: 'action', action: 'test', user_id: 'userA', day_et: '2025-01-02', source_id: 's3' },
                { type: 'action', action: 'test', user_id: 'userB', day_et: '2025-01-02', source_id: 's4' },
                { type: 'action', action: 'test', user_id: 'userA', day_et: '2025-01-01', source_id: 's5' },
            ];

            const result = calculator.computeStreakProgress(log, 'test', coupleIds, true);

            expect(result).toBe(2); // Only 01-03 and 01-02 have both
        });

        it('should break streak on non-consecutive days', () => {
            const log = [
                { type: 'action', action: 'test', user_id: 'userA', day_et: '2025-01-05', source_id: 's1' },
                { type: 'action', action: 'test', user_id: 'userA', day_et: '2025-01-04', source_id: 's2' },
                { type: 'action', action: 'test', user_id: 'userA', day_et: '2025-01-01', source_id: 's3' }, // Gap
            ];

            const result = calculator.computeStreakProgress(log, 'test', coupleIds, false);

            expect(result).toBe(2); // Stops at the gap
        });

        it('should return 0 for empty log', () => {
            const result = calculator.computeStreakProgress([], 'test', coupleIds, false);

            expect(result).toBe(0);
        });

        it('should return 1 for single day', () => {
            const log = [
                { type: 'action', action: 'test', user_id: 'userA', day_et: '2025-01-01', source_id: 's1' },
            ];

            const result = calculator.computeStreakProgress(log, 'test', coupleIds, false);

            expect(result).toBe(1);
        });

        it('should ignore actions without day_et', () => {
            const log = [
                { type: 'action', action: 'test', user_id: 'userA', source_id: 's1' },
                { type: 'action', action: 'test', user_id: 'userB', day_et: '2025-01-01', source_id: 's2' },
            ];

            const result = calculator.computeStreakProgress(log, 'test', coupleIds, false);

            expect(result).toBe(1);
        });

        it('should handle requireBoth with no overlapping days', () => {
            const log = [
                { type: 'action', action: 'test', user_id: 'userA', day_et: '2025-01-01', source_id: 's1' },
                { type: 'action', action: 'test', user_id: 'userB', day_et: '2025-01-02', source_id: 's2' },
            ];

            const result = calculator.computeStreakProgress(log, 'test', coupleIds, true);

            expect(result).toBe(0);
        });
    });

    describe('getConfirmRequest', () => {
        it('should return latest confirm request', () => {
            const log = [
                { type: 'action', user_id: 'user1' },
                { type: 'confirm_request', user_id: 'user1', at: '2025-01-01T00:00:00Z' },
                { type: 'confirm_request', user_id: 'user2', at: '2025-01-02T00:00:00Z' },
            ];

            const result = calculator.getConfirmRequest(log);

            expect(result.user_id).toBe('user2');
        });

        it('should return null when no confirm request exists', () => {
            const log = [
                { type: 'action', user_id: 'user1' },
            ];

            const result = calculator.getConfirmRequest(log);

            expect(result).toBeNull();
        });

        it('should handle empty log', () => {
            const result = calculator.getConfirmRequest([]);

            expect(result).toBeNull();
        });
    });
});
