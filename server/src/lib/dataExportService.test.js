import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildExportSummary } = require('./dataExportService');

describe('dataExportService', () => {
    it('builds summary counts with empty payload', () => {
        const summary = buildExportSummary({});
        expect(summary).toEqual({
            partnerRequests: 0,
            cases: 0,
            verdicts: 0,
            courtSessions: 0,
            dailyAnswers: 0,
            appreciations: 0,
            calendarEvents: 0,
            transactions: 0,
            rewardRedemptions: 0,
            userMemories: 0,
            memories: 0,
            memoryReactions: 0,
            memoryComments: 0,
            insights: 0,
        });
    });

    it('counts populated arrays', () => {
        const summary = buildExportSummary({
            data: {
                partnerRequests: [1, 2],
                cases: [1],
                verdicts: [1, 2, 3],
                courtSessions: [],
                dailyAnswers: [1, 2, 3, 4],
                appreciations: [1],
                calendarEvents: [1, 2],
                transactions: [1],
                rewardRedemptions: [1, 2, 3],
                userMemories: [1],
                memories: [1, 2, 3, 4, 5],
                memoryReactions: [1],
                memoryComments: [1, 2],
                insights: [1],
            },
        });

        expect(summary).toEqual({
            partnerRequests: 2,
            cases: 1,
            verdicts: 3,
            courtSessions: 0,
            dailyAnswers: 4,
            appreciations: 1,
            calendarEvents: 2,
            transactions: 1,
            rewardRedemptions: 3,
            userMemories: 1,
            memories: 5,
            memoryReactions: 1,
            memoryComments: 2,
            insights: 1,
        });
    });
});
