const crypto = require('crypto');
const { getRedisClient } = require('../redis');

const DEFAULT_CHALLENGE_TTL_SECONDS = 180;
const DEFAULT_CHALLENGE_TOKEN_TTL_SECONDS = 15 * 60;

const CHALLENGE_KEY_PREFIX = 'abuse:challenge:v1:';
const TOKEN_KEY_PREFIX = 'abuse:challenge-token:v1:';
const FALLBACK_SECRET = crypto.randomBytes(32).toString('hex');

function normalizeTtl(ttlSeconds, fallback) {
    const numeric = Number(ttlSeconds);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return fallback;
    }
    return Math.floor(numeric);
}

function normalizeAnswer(answer) {
    if (answer === undefined || answer === null) {
        return '';
    }
    return String(answer).trim();
}

function safeParse(serialized) {
    if (serialized === null || serialized === undefined) {
        return null;
    }

    try {
        return JSON.parse(serialized);
    } catch (_error) {
        return null;
    }
}

function safeEqual(left, right) {
    if (typeof left !== 'string' || typeof right !== 'string') {
        return false;
    }

    const leftBuffer = Buffer.from(left, 'utf8');
    const rightBuffer = Buffer.from(right, 'utf8');

    if (leftBuffer.length !== rightBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function toFiniteNumber(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}

function createChallengeStore(options = {}) {
    const hasRedisClientOption = Object.prototype.hasOwnProperty.call(options, 'redisClient');
    const now = typeof options.now === 'function' ? options.now : () => Date.now();
    const random = typeof options.random === 'function' ? options.random : () => Math.random();
    const challengeSecret = options.secret || process.env.ABUSE_CHALLENGE_SECRET || FALLBACK_SECRET;
    const tokenTtlSeconds = normalizeTtl(
        options.tokenTtlSeconds,
        DEFAULT_CHALLENGE_TOKEN_TTL_SECONDS
    );

    const memoryChallenges = new Map();
    const memoryTokens = new Map();
    let useMemoryOnly = false;

    function getClient() {
        if (useMemoryOnly) return null;
        if (hasRedisClientOption) return options.redisClient;

        try {
            return getRedisClient();
        } catch (_error) {
            return null;
        }
    }

    function challengeKey(challengeId) {
        return `${CHALLENGE_KEY_PREFIX}${challengeId}`;
    }

    function tokenKey(challengeToken) {
        return `${TOKEN_KEY_PREFIX}${challengeToken}`;
    }

    function pruneMemory() {
        const nowMs = now();

        for (const [key, value] of memoryChallenges.entries()) {
            if (!value || value.expiresAtMs <= nowMs) {
                memoryChallenges.delete(key);
            }
        }

        for (const [key, value] of memoryTokens.entries()) {
            if (!value || value.expiresAtMs <= nowMs) {
                memoryTokens.delete(key);
            }
        }
    }

    function randomInteger(min, max) {
        const range = (max - min) + 1;
        return min + Math.floor(random() * range);
    }

    function createMathChallenge() {
        const left = randomInteger(2, 12);
        const right = randomInteger(2, 12);
        return {
            prompt: `Solve to continue: ${left} + ${right} = ?`,
            answer: String(left + right),
        };
    }

    function createChallengeId() {
        if (typeof options.challengeIdGenerator === 'function') {
            return options.challengeIdGenerator();
        }
        return crypto.randomUUID();
    }

    function createChallengeToken() {
        if (typeof options.challengeTokenGenerator === 'function') {
            return options.challengeTokenGenerator();
        }
        return crypto.randomBytes(24).toString('base64url');
    }

    function hashAnswer({ challengeId, userId, endpointKey, answer }) {
        const normalized = normalizeAnswer(answer);
        const payload = `${challengeId}:${userId}:${endpointKey}:${normalized}`;
        return crypto.createHmac('sha256', challengeSecret).update(payload).digest('hex');
    }

    async function writeChallenge(record, ttlSeconds) {
        const serialized = JSON.stringify(record);
        const client = getClient();

        if (client) {
            try {
                await client.set(challengeKey(record.challengeId), serialized, 'EX', ttlSeconds);
                return 'redis';
            } catch (_error) {
                useMemoryOnly = true;
            }
        }

        pruneMemory();
        memoryChallenges.set(record.challengeId, {
            serializedValue: serialized,
            expiresAtMs: record.expiresAtMs,
        });
        return 'memory';
    }

    async function writeToken(record, ttlSeconds) {
        const serialized = JSON.stringify(record);
        const client = getClient();

        if (client) {
            try {
                await client.set(tokenKey(record.challengeToken), serialized, 'EX', ttlSeconds);
                return 'redis';
            } catch (_error) {
                useMemoryOnly = true;
            }
        }

        pruneMemory();
        memoryTokens.set(record.challengeToken, {
            serializedValue: serialized,
            expiresAtMs: record.expiresAtMs,
        });
        return 'memory';
    }

    async function readChallenge(challengeId) {
        const client = getClient();

        if (client) {
            try {
                return safeParse(await client.get(challengeKey(challengeId)));
            } catch (_error) {
                useMemoryOnly = true;
            }
        }

        pruneMemory();
        const entry = memoryChallenges.get(challengeId);
        return entry ? safeParse(entry.serializedValue) : null;
    }

    async function readToken(challengeToken) {
        const client = getClient();

        if (client) {
            try {
                return safeParse(await client.get(tokenKey(challengeToken)));
            } catch (_error) {
                useMemoryOnly = true;
            }
        }

        pruneMemory();
        const entry = memoryTokens.get(challengeToken);
        return entry ? safeParse(entry.serializedValue) : null;
    }

    async function removeChallenge(challengeId) {
        const client = getClient();
        if (client) {
            try {
                await client.del(challengeKey(challengeId));
            } catch (_error) {
                useMemoryOnly = true;
            }
        }
        memoryChallenges.delete(challengeId);
    }

    async function removeToken(challengeToken) {
        const client = getClient();
        if (client) {
            try {
                await client.del(tokenKey(challengeToken));
            } catch (_error) {
                useMemoryOnly = true;
            }
        }
        memoryTokens.delete(challengeToken);
    }

    async function createAbuseChallenge({
        userId,
        endpointKey,
        reason,
        score,
        ttlSeconds,
    } = {}) {
        if (typeof userId !== 'string' || userId.trim().length === 0) {
            throw new Error('createAbuseChallenge requires a non-empty userId');
        }
        if (typeof endpointKey !== 'string' || endpointKey.trim().length === 0) {
            throw new Error('createAbuseChallenge requires a non-empty endpointKey');
        }

        const normalizedUserId = userId.trim();
        const normalizedEndpointKey = endpointKey.trim();
        const normalizedTtlSeconds = normalizeTtl(ttlSeconds, DEFAULT_CHALLENGE_TTL_SECONDS);
        const issuedAtMs = now();
        const expiresAtMs = issuedAtMs + (normalizedTtlSeconds * 1000);
        const challengeId = createChallengeId();

        const challenge = createMathChallenge();
        const answerHash = hashAnswer({
            challengeId,
            userId: normalizedUserId,
            endpointKey: normalizedEndpointKey,
            answer: challenge.answer,
        });

        const record = {
            challengeId,
            userId: normalizedUserId,
            endpointKey: normalizedEndpointKey,
            reason: reason || 'unspecified',
            score: toFiniteNumber(score, 0),
            prompt: challenge.prompt,
            answerHash,
            issuedAtMs,
            expiresAtMs,
        };

        await writeChallenge(record, normalizedTtlSeconds);

        return {
            challengeId,
            prompt: challenge.prompt,
            expiresAt: expiresAtMs,
            ttlSeconds: normalizedTtlSeconds,
        };
    }

    async function verifyAbuseChallenge({
        userId,
        challengeId,
        answer,
    } = {}) {
        if (typeof userId !== 'string' || userId.trim().length === 0) {
            throw new Error('verifyAbuseChallenge requires a non-empty userId');
        }
        if (typeof challengeId !== 'string' || challengeId.trim().length === 0) {
            throw new Error('verifyAbuseChallenge requires a non-empty challengeId');
        }

        const challenge = await readChallenge(challengeId.trim());
        if (!challenge) {
            return {
                ok: false,
                code: 'ABUSE_CHALLENGE_NOT_FOUND',
                message: 'Challenge not found or expired.',
            };
        }

        const normalizedUserId = userId.trim();
        if (challenge.userId !== normalizedUserId) {
            return {
                ok: false,
                code: 'ABUSE_CHALLENGE_FORBIDDEN',
                message: 'Challenge does not belong to user.',
            };
        }

        const nowMs = now();
        if (toFiniteNumber(challenge.expiresAtMs, 0) <= nowMs) {
            await removeChallenge(challenge.challengeId);
            return {
                ok: false,
                code: 'ABUSE_CHALLENGE_EXPIRED',
                message: 'Challenge expired. Please retry request.',
            };
        }

        const providedHash = hashAnswer({
            challengeId: challenge.challengeId,
            userId: normalizedUserId,
            endpointKey: challenge.endpointKey,
            answer,
        });

        if (!safeEqual(providedHash, challenge.answerHash)) {
            return {
                ok: false,
                code: 'ABUSE_CHALLENGE_INCORRECT',
                message: 'Incorrect challenge answer.',
            };
        }

        await removeChallenge(challenge.challengeId);

        const challengeToken = createChallengeToken();
        const tokenIssuedAtMs = now();
        const tokenExpiresAtMs = tokenIssuedAtMs + (tokenTtlSeconds * 1000);

        await writeToken({
            challengeToken,
            userId: normalizedUserId,
            endpointKey: challenge.endpointKey,
            challengeId: challenge.challengeId,
            issuedAtMs: tokenIssuedAtMs,
            expiresAtMs: tokenExpiresAtMs,
        }, tokenTtlSeconds);

        return {
            ok: true,
            challengeToken,
            expiresAt: tokenExpiresAtMs,
            endpointKey: challenge.endpointKey,
        };
    }

    async function hasValidChallengeToken({
        userId,
        challengeToken,
        endpointKey,
    } = {}) {
        if (typeof userId !== 'string' || userId.trim().length === 0) {
            return false;
        }
        if (typeof challengeToken !== 'string' || challengeToken.trim().length === 0) {
            return false;
        }

        const tokenRecord = await readToken(challengeToken.trim());
        if (!tokenRecord) {
            return false;
        }

        const normalizedUserId = userId.trim();
        if (tokenRecord.userId !== normalizedUserId) {
            return false;
        }

        const nowMs = now();
        if (toFiniteNumber(tokenRecord.expiresAtMs, 0) <= nowMs) {
            await removeToken(challengeToken.trim());
            return false;
        }

        if (
            typeof endpointKey === 'string'
            && endpointKey.trim().length > 0
            && tokenRecord.endpointKey !== endpointKey.trim()
        ) {
            return false;
        }

        return true;
    }

    return {
        createAbuseChallenge,
        verifyAbuseChallenge,
        hasValidChallengeToken,
    };
}

const defaultStore = createChallengeStore();

async function createAbuseChallenge(input) {
    return defaultStore.createAbuseChallenge(input);
}

async function verifyAbuseChallenge(input) {
    return defaultStore.verifyAbuseChallenge(input);
}

async function hasValidChallengeToken(input) {
    return defaultStore.hasValidChallengeToken(input);
}

module.exports = {
    DEFAULT_CHALLENGE_TTL_SECONDS,
    DEFAULT_CHALLENGE_TOKEN_TTL_SECONDS,
    createChallengeStore,
    createAbuseChallenge,
    verifyAbuseChallenge,
    hasValidChallengeToken,
};
