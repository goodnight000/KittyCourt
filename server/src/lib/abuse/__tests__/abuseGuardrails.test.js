import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { evaluateAbuseRisk } = require('../abuseGuardrails');
const { verifyAbuseChallenge } = require('../challengeStore');
const { blockUser, unblockUser, checkRateLimit } = require('../../security/rateLimiter');

function userId(seed) {
    return `abuse-test-${seed}-${Date.now()}`;
}

function extractMathAnswer(prompt) {
    const match = String(prompt || '').match(/(\d+)\s*\+\s*(\d+)/);
    if (!match) {
        throw new Error(`Unexpected challenge prompt: ${prompt}`);
    }
    return String(Number(match[1]) + Number(match[2]));
}

describe('abuseGuardrails', () => {
    it('allows when endpoint policy does not exist', async () => {
        const result = await evaluateAbuseRisk({
            userId: userId('unknown'),
            endpointKey: 'not_configured',
            payload: { a: 1 },
        });

        expect(result.allowed).toBe(true);
        expect(result.action).toBe('allow');
    });

    it('applies duplicate payload friction for plan_event', async () => {
        const uid = userId('duplicate');

        const first = await evaluateAbuseRisk({
            userId: uid,
            endpointKey: 'plan_event',
            payload: { title: 'Date night', style: 'cozy' },
        });
        const second = await evaluateAbuseRisk({
            userId: uid,
            endpointKey: 'plan_event',
            payload: { title: 'Date night', style: 'cozy' },
        });

        expect(first.action).toBe('allow');
        expect(second.action).toBe('review');
        expect(second.allowed).toBe(true);
        expect(second.delayMs).toBeGreaterThan(0);
    });

    it('returns blocked response when user is already blocked', async () => {
        const uid = userId('blocked');
        await blockUser(uid, 'test block', 2000);

        const result = await evaluateAbuseRisk({
            userId: uid,
            endpointKey: 'plan_event',
            payload: { title: 'Blocked request' },
        });

        expect(result.allowed).toBe(false);
        expect(result.action).toBe('block');
        expect(result.code).toBe('ABUSE_GUARDRAIL_BLOCKED');

        await unblockUser(uid);
    });

    it('escalates to challenge under sustained burst behavior and returns challenge payload', async () => {
        const uid = userId('burst');

        for (let i = 0; i < 20; i++) {
            await checkRateLimit(uid, 'eventPlanner');
        }

        await evaluateAbuseRisk({
            userId: uid,
            endpointKey: 'plan_event',
            payload: { event: 'x' },
        });

        const second = await evaluateAbuseRisk({
            userId: uid,
            endpointKey: 'plan_event',
            payload: { event: 'x' },
        });

        expect(second.action).toBe('challenge');
        expect(second.allowed).toBe(false);
        expect(second.code).toBe('ABUSE_CHALLENGE_REQUIRED');
        expect(second.challenge).toBeTruthy();
        expect(second.challenge.challengeId).toBeTypeOf('string');
        expect(second.challenge.prompt).toContain('+');
        expect(second.challenge.expiresAt).toBeGreaterThan(Date.now());
    });

    it('allows a verified challenge token to downgrade repeated challenge into review', async () => {
        const uid = userId('bypass');

        for (let i = 0; i < 20; i++) {
            await checkRateLimit(uid, 'eventPlanner');
        }

        await evaluateAbuseRisk({
            userId: uid,
            endpointKey: 'plan_event',
            payload: { event: 'same-payload' },
        });

        const challenged = await evaluateAbuseRisk({
            userId: uid,
            endpointKey: 'plan_event',
            payload: { event: 'same-payload' },
        });

        expect(challenged.action).toBe('challenge');
        expect(challenged.challenge?.challengeId).toBeTruthy();

        const verified = await verifyAbuseChallenge({
            userId: uid,
            challengeId: challenged.challenge.challengeId,
            answer: extractMathAnswer(challenged.challenge.prompt),
        });

        expect(verified.ok).toBe(true);
        expect(verified.challengeToken).toBeTypeOf('string');

        const bypassed = await evaluateAbuseRisk({
            userId: uid,
            endpointKey: 'plan_event',
            payload: { event: 'same-payload' },
            context: { challengeToken: verified.challengeToken },
        });

        expect(bypassed.allowed).toBe(true);
        expect(bypassed.action).toBe('review');
        expect(bypassed.reason).toBe('challenge_verified');
        expect(bypassed.delayMs).toBeGreaterThan(0);
    });
});
