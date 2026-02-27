import { describe, it, expect } from 'vitest';
import { createChallengeStore } from '../challengeStore.js';

function extractMathAnswer(prompt) {
    const match = String(prompt || '').match(/(\d+)\s*\+\s*(\d+)/);
    if (!match) {
        throw new Error(`Unable to parse challenge prompt: ${prompt}`);
    }
    return String(Number(match[1]) + Number(match[2]));
}

function createRedisStub({ now = () => Date.now(), throwOnSet = false } = {}) {
    const store = new Map();

    function prune() {
        const nowMs = now();
        for (const [key, entry] of store.entries()) {
            if (entry.expiresAtMs && entry.expiresAtMs <= nowMs) {
                store.delete(key);
            }
        }
    }

    return {
        async set(key, value, mode, ttlSeconds) {
            if (throwOnSet) {
                throw new Error('redis unavailable');
            }

            const expiresAtMs = mode === 'EX'
                ? now() + (Number(ttlSeconds || 0) * 1000)
                : null;

            store.set(key, { value, expiresAtMs });
            return 'OK';
        },
        async get(key) {
            prune();
            const entry = store.get(key);
            return entry ? entry.value : null;
        },
        async del(key) {
            store.delete(key);
            return 1;
        },
    };
}

describe('challengeStore', () => {
    it('creates challenge, verifies answer, and issues endpoint-bound token', async () => {
        let nowMs = 1000;
        const store = createChallengeStore({
            redisClient: null,
            now: () => nowMs,
            random: () => 0.2,
            challengeIdGenerator: () => 'challenge-1',
            challengeTokenGenerator: () => 'token-1',
        });

        const challenge = await store.createAbuseChallenge({
            userId: 'user-1',
            endpointKey: 'plan_event',
            reason: 'score_gte_challenge',
            score: 88,
            ttlSeconds: 45,
        });

        expect(challenge.challengeId).toBe('challenge-1');
        expect(challenge.prompt).toContain('+');
        expect(challenge.ttlSeconds).toBe(45);
        expect(challenge.expiresAt).toBe(46_000);

        const verified = await store.verifyAbuseChallenge({
            userId: 'user-1',
            challengeId: challenge.challengeId,
            answer: extractMathAnswer(challenge.prompt),
        });

        expect(verified.ok).toBe(true);
        expect(verified.challengeToken).toBe('token-1');
        expect(verified.endpointKey).toBe('plan_event');
        expect(
            await store.hasValidChallengeToken({
                userId: 'user-1',
                challengeToken: 'token-1',
                endpointKey: 'plan_event',
            })
        ).toBe(true);
        expect(
            await store.hasValidChallengeToken({
                userId: 'user-1',
                challengeToken: 'token-1',
                endpointKey: 'court_serve',
            })
        ).toBe(false);

        nowMs += (15 * 60 * 1000) + 1;
        expect(
            await store.hasValidChallengeToken({
                userId: 'user-1',
                challengeToken: 'token-1',
                endpointKey: 'plan_event',
            })
        ).toBe(false);
    });

    it('rejects incorrect answers and enforces challenge ownership', async () => {
        const store = createChallengeStore({
            redisClient: null,
            challengeIdGenerator: () => 'challenge-2',
            challengeTokenGenerator: () => 'token-2',
            random: () => 0.4,
        });

        const challenge = await store.createAbuseChallenge({
            userId: 'owner-1',
            endpointKey: 'plan_event',
            reason: 'duplicate_payload',
            score: 80,
        });

        const forbidden = await store.verifyAbuseChallenge({
            userId: 'other-user',
            challengeId: challenge.challengeId,
            answer: extractMathAnswer(challenge.prompt),
        });
        expect(forbidden.ok).toBe(false);
        expect(forbidden.code).toBe('ABUSE_CHALLENGE_FORBIDDEN');

        const incorrect = await store.verifyAbuseChallenge({
            userId: 'owner-1',
            challengeId: challenge.challengeId,
            answer: '999',
        });
        expect(incorrect.ok).toBe(false);
        expect(incorrect.code).toBe('ABUSE_CHALLENGE_INCORRECT');

        const verified = await store.verifyAbuseChallenge({
            userId: 'owner-1',
            challengeId: challenge.challengeId,
            answer: extractMathAnswer(challenge.prompt),
        });
        expect(verified.ok).toBe(true);

        const reused = await store.verifyAbuseChallenge({
            userId: 'owner-1',
            challengeId: challenge.challengeId,
            answer: extractMathAnswer(challenge.prompt),
        });
        expect(reused.ok).toBe(false);
        expect(reused.code).toBe('ABUSE_CHALLENGE_NOT_FOUND');
    });

    it('supports redis backend and falls back to memory when redis fails', async () => {
        let nowMs = 2000;
        const redisClient = createRedisStub({ now: () => nowMs });
        const redisStore = createChallengeStore({
            redisClient,
            now: () => nowMs,
            random: () => 0.3,
            challengeIdGenerator: () => 'redis-challenge',
            challengeTokenGenerator: () => 'redis-token',
        });

        const redisChallenge = await redisStore.createAbuseChallenge({
            userId: 'redis-user',
            endpointKey: 'court_serve',
            reason: 'burst',
            score: 85,
        });

        const redisVerified = await redisStore.verifyAbuseChallenge({
            userId: 'redis-user',
            challengeId: redisChallenge.challengeId,
            answer: extractMathAnswer(redisChallenge.prompt),
        });
        expect(redisVerified.ok).toBe(true);
        expect(redisVerified.challengeToken).toBe('redis-token');

        const fallbackStore = createChallengeStore({
            redisClient: createRedisStub({ throwOnSet: true }),
            random: () => 0.1,
            challengeIdGenerator: () => 'fallback-challenge',
            challengeTokenGenerator: () => 'fallback-token',
        });

        const fallbackChallenge = await fallbackStore.createAbuseChallenge({
            userId: 'fallback-user',
            endpointKey: 'plan_event',
            reason: 'burst',
            score: 82,
        });

        const fallbackVerified = await fallbackStore.verifyAbuseChallenge({
            userId: 'fallback-user',
            challengeId: fallbackChallenge.challengeId,
            answer: extractMathAnswer(fallbackChallenge.prompt),
        });
        expect(fallbackVerified.ok).toBe(true);
        expect(fallbackVerified.challengeToken).toBe('fallback-token');
    });
});
