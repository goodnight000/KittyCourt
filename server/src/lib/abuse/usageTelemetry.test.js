import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
    parseUsage,
    estimateCost,
    buildUsageTelemetryEvent,
} = require('./usageTelemetry');

describe('usageTelemetry', () => {
    describe('parseUsage', () => {
        it('parses OpenRouter usage shape', () => {
            const parsed = parseUsage({
                prompt_tokens: 250,
                completion_tokens: 125,
                total_tokens: 375,
            });

            expect(parsed).toEqual({
                inputTokens: 250,
                outputTokens: 125,
                totalTokens: 375,
            });
        });

        it('parses embeddings usage shape', () => {
            const parsed = parseUsage({
                prompt_tokens: 512,
                total_tokens: 512,
            });

            expect(parsed).toEqual({
                inputTokens: 512,
                outputTokens: 0,
                totalTokens: 512,
            });
        });

        it('sums total tokens when total token field is missing', () => {
            const parsed = parseUsage({
                input_tokens: 300,
                output_tokens: 200,
            });

            expect(parsed).toEqual({
                inputTokens: 300,
                outputTokens: 200,
                totalTokens: 500,
            });
        });
    });

    describe('estimateCost', () => {
        it('estimates cost from configured model pricing', () => {
            const cost = estimateCost({
                model: 'deepseek/deepseek-v3.2',
                usage: {
                    prompt_tokens: 1000,
                    completion_tokens: 1000,
                },
            });

            expect(cost).toBeCloseTo(0.00035, 8);
        });

        it('returns zero for unknown model', () => {
            const cost = estimateCost({
                model: 'unknown/model',
                usage: {
                    prompt_tokens: 500,
                    completion_tokens: 500,
                },
            });

            expect(cost).toBe(0);
        });
    });

    it('builds normalized telemetry event payload', () => {
        const event = buildUsageTelemetryEvent({
            source: 'openrouter.chat.completions',
            provider: 'openrouter',
            model: 'deepseek/deepseek-v3.2',
            usage: {
                prompt_tokens: 200,
                completion_tokens: 100,
            },
            metadata: { route: '/judge' },
        });

        expect(event).toMatchObject({
            source: 'openrouter.chat.completions',
            provider: 'openrouter',
            model: 'deepseek/deepseek-v3.2',
            inputTokens: 200,
            outputTokens: 100,
            totalTokens: 300,
            metadata: { route: '/judge' },
        });
        expect(event.estimatedCostUsd).toBeGreaterThan(0);
    });
});
