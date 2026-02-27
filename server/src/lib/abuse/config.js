const TOKENS_PER_MILLION = 1000000;

const MODEL_PRICING_USD_PER_1M_TOKENS = Object.freeze({
    // Current default judge models
    'deepseek/deepseek-v3.2': Object.freeze({ input: 0.10, output: 0.25 }),
    'deepseek/deepseek-reasoner': Object.freeze({ input: 0.55, output: 2.19 }),
    'google/gemini-3-flash-preview': Object.freeze({ input: 0.30, output: 2.50 }),
    'google/gemini-3.1-pro-preview': Object.freeze({ input: 2.00, output: 12.00 }),
    'x-ai/grok-4.1-fast': Object.freeze({ input: 0.20, output: 0.50 }),

    // Embeddings
    'text-embedding-3-small': Object.freeze({ input: 0.02, output: 0 }),
    'openai/text-embedding-3-small': Object.freeze({ input: 0.02, output: 0 }),
});

const DEFAULT_MODEL_PRICING = Object.freeze({
    input: 0,
    output: 0,
});

const ABUSE_ENDPOINT_POLICIES = Object.freeze({
    plan_event: Object.freeze({
        rateLimitEndpoint: 'eventPlanner',
        idempotencyTtlSeconds: 20,
        challengeTtlSeconds: 180,
        reviewDelayMs: 350,
        scoringWeights: Object.freeze({
            velocity: 25,
            payloadAnomaly: 65,
            priorAbuse: 30,
            failures: 25,
        }),
        thresholds: Object.freeze({
            review: 62,
            challenge: 78,
            block: 92,
        }),
    }),
    court_serve: Object.freeze({
        rateLimitEndpoint: 'court',
        idempotencyTtlSeconds: 8,
        challengeTtlSeconds: 180,
        reviewDelayMs: 200,
        scoringWeights: Object.freeze({
            velocity: 30,
            payloadAnomaly: 65,
            priorAbuse: 30,
            failures: 20,
        }),
        thresholds: Object.freeze({
            review: 65,
            challenge: 82,
            block: 94,
        }),
    }),
    court_submit_addendum: Object.freeze({
        rateLimitEndpoint: 'court',
        idempotencyTtlSeconds: 10,
        challengeTtlSeconds: 180,
        reviewDelayMs: 250,
        scoringWeights: Object.freeze({
            velocity: 30,
            payloadAnomaly: 60,
            priorAbuse: 35,
            failures: 25,
        }),
        thresholds: Object.freeze({
            review: 62,
            challenge: 80,
            block: 93,
        }),
    }),
    court_resolution_hybrid: Object.freeze({
        rateLimitEndpoint: 'court',
        idempotencyTtlSeconds: 8,
        challengeTtlSeconds: 180,
        reviewDelayMs: 250,
        scoringWeights: Object.freeze({
            velocity: 30,
            payloadAnomaly: 65,
            priorAbuse: 35,
            failures: 25,
        }),
        thresholds: Object.freeze({
            review: 60,
            challenge: 78,
            block: 92,
        }),
    }),
});

module.exports = {
    TOKENS_PER_MILLION,
    MODEL_PRICING_USD_PER_1M_TOKENS,
    DEFAULT_MODEL_PRICING,
    ABUSE_ENDPOINT_POLICIES,
};
