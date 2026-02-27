const {
    getRateLimitStatus,
    getAbuseMetrics,
    blockUser,
    isUserBlocked,
    trackAbuseIndicator,
} = require('../security/rateLimiter');
const { ABUSE_ENDPOINT_POLICIES } = require('./config');
const { buildRiskSignals } = require('./riskSignals');
const { scoreRisk } = require('./riskScorer');
const { decideAbuseAction } = require('./decisionEngine');
const { claimIdempotencyKey, stableStringify } = require('./idempotency');
const { recordAbuseAction } = require('./abuseRepository');
const { createAbuseChallenge, hasValidChallengeToken } = require('./challengeStore');

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function hashPayload(input) {
    const serialized = stableStringify(input);
    let hash = 2166136261;
    for (let i = 0; i < serialized.length; i++) {
        hash ^= serialized.charCodeAt(i);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(16);
}

function normalizeRiskLevel(riskLevel) {
    switch (riskLevel) {
        case 'BLOCKED':
            return 1;
        case 'HIGH':
            return 0.8;
        case 'MEDIUM':
            return 0.5;
        default:
            return 0;
    }
}

function normalizeChallengeToken(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed || null;
}

async function evaluateAbuseRisk({
    userId,
    endpointKey,
    payload,
    context = {},
} = {}) {
    if (!userId || !endpointKey || !ABUSE_ENDPOINT_POLICIES[endpointKey]) {
        return {
            allowed: true,
            action: 'allow',
            score: 0,
            level: 'low',
            delayMs: 0,
            reason: 'guardrail_not_configured',
        };
    }

    const policy = ABUSE_ENDPOINT_POLICIES[endpointKey];
    const challengeToken = normalizeChallengeToken(context.challengeToken || context.abuseChallengeToken);

    const blocked = await isUserBlocked(userId);
    if (blocked.blocked) {
        return {
            allowed: false,
            action: 'block',
            code: 'ABUSE_GUARDRAIL_BLOCKED',
            message: 'Temporary safety cooldown in effect. Please try again soon.',
            retryAfterMs: blocked.remainingMs || 0,
            reason: 'already_blocked',
            score: 100,
            level: 'critical',
            delayMs: 0,
        };
    }

    const [rateLimitStatus, abuseMetrics] = await Promise.all([
        getRateLimitStatus(userId),
        getAbuseMetrics(userId),
    ]);
    const hasChallengeBypass = challengeToken
        ? await hasValidChallengeToken({ userId, challengeToken, endpointKey })
        : false;

    const endpointRate = rateLimitStatus?.[policy.rateLimitEndpoint] || null;
    const velocityRatio = endpointRate && endpointRate.limit > 0
        ? Math.max(0, Math.min(1, (endpointRate.used || 0) / endpointRate.limit))
        : 0;

    const idempotencyHash = hashPayload({ endpointKey, payload });
    const idempotencyKey = `abuse:idempotency:${endpointKey}:${userId}:${idempotencyHash}`;
    const claim = await claimIdempotencyKey(idempotencyKey, policy.idempotencyTtlSeconds, {
        t: Date.now(),
        endpointKey,
    });

    const rawSignals = buildRiskSignals({
        velocity: velocityRatio,
        failures: Math.max(0, Math.min(1, (abuseMetrics.flaggedRequests || 0) / 10)),
        priorAbuse: Math.max(0, Math.min(1, (abuseMetrics.injectionAttempts || 0) / 5)),
        payloadAnomaly: claim.duplicate ? 1 : 0,
        accountAge: context.accountAgeRisk || 0,
        deviceRisk: context.deviceRisk || 0,
        geoVelocityRisk: context.geoVelocityRisk || 0,
        ipReputationScore: context.ipReputationScore,
    });

    const scored = scoreRisk(rawSignals, {
        weights: policy.scoringWeights || {},
    });
    const decision = decideAbuseAction(
        {
            score: scored.score,
            level: scored.level,
            signals: {
                ...rawSignals,
                historicalRisk: normalizeRiskLevel(abuseMetrics.riskLevel),
            },
        },
        {
            thresholds: policy.thresholds,
        }
    );
    const effectiveDecision = (
        (decision.action === 'challenge' || decision.action === 'block') && hasChallengeBypass
            ? {
                ...decision,
                action: 'review',
                reason: 'challenge_verified',
                shouldLog: true,
                expiresInSeconds: 0,
            }
            : decision
    );

    const response = {
        allowed: true,
        action: effectiveDecision.action,
        score: effectiveDecision.score,
        level: effectiveDecision.level,
        delayMs: effectiveDecision.action === 'review' ? policy.reviewDelayMs : 0,
        reason: effectiveDecision.reason,
        code: null,
        message: null,
        retryAfterMs: 0,
        challenge: null,
    };

    if (effectiveDecision.action === 'review') {
        await trackAbuseIndicator(userId, 'flagged_request', {
            endpointKey,
            reason: effectiveDecision.reason,
            score: effectiveDecision.score,
            duplicatePayload: claim.duplicate,
        });
    }

    if (effectiveDecision.action === 'challenge') {
        await trackAbuseIndicator(userId, 'flagged_request', {
            endpointKey,
            reason: effectiveDecision.reason,
            score: effectiveDecision.score,
            duplicatePayload: claim.duplicate,
        });
        const challenge = await createAbuseChallenge({
            userId,
            endpointKey,
            reason: effectiveDecision.reason,
            score: effectiveDecision.score,
            ttlSeconds: policy.challengeTtlSeconds || 180,
        });
        response.allowed = false;
        response.code = 'ABUSE_CHALLENGE_REQUIRED';
        response.message = 'We need a quick verification before continuing.';
        response.retryAfterMs = (challenge?.ttlSeconds || (policy.challengeTtlSeconds || 180)) * 1000;
        response.challenge = challenge || null;
    }

    if (effectiveDecision.action === 'block') {
        await trackAbuseIndicator(userId, 'flagged_request', {
            endpointKey,
            reason: effectiveDecision.reason,
            score: effectiveDecision.score,
            duplicatePayload: claim.duplicate,
        });
        await blockUser(userId, `Abuse guardrail block (${endpointKey})`, effectiveDecision.expiresInSeconds * 1000);
        response.allowed = false;
        response.code = 'ABUSE_GUARDRAIL_BLOCKED';
        response.message = 'Temporary safety cooldown in effect. Please try again soon.';
        response.retryAfterMs = effectiveDecision.expiresInSeconds * 1000;
    }

    if (effectiveDecision.shouldLog) {
        await recordAbuseAction({
            userId,
            action: effectiveDecision.action,
            reason: effectiveDecision.reason,
            metadata: {
                endpointKey,
                score: effectiveDecision.score,
                level: effectiveDecision.level,
                signals: rawSignals,
                duplicatePayload: claim.duplicate,
                hasChallengeBypass,
            },
        });
    }

    return response;
}

async function applyAbuseDelay(delayMs) {
    const ms = Number(delayMs || 0);
    if (!Number.isFinite(ms) || ms <= 0) return;
    await wait(ms);
}

module.exports = {
    evaluateAbuseRisk,
    applyAbuseDelay,
    hashPayload,
};
