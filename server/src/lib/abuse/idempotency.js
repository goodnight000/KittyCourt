const { getRedisClient } = require('../redis');

const DEFAULT_TTL_SECONDS = 300;

function stableStringify(value) {
    if (value === undefined) {
        return 'null';
    }

    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(',')}]`;
    }

    const keys = Object.keys(value).sort();
    const parts = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
    return `{${parts.join(',')}}`;
}

function tryParse(serialized) {
    if (serialized === null || serialized === undefined) return null;
    try {
        return JSON.parse(serialized);
    } catch (_error) {
        return null;
    }
}

function normalizeTtl(ttlSeconds) {
    const numeric = Number(ttlSeconds);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return DEFAULT_TTL_SECONDS;
    }
    return Math.floor(numeric);
}

function createIdempotencyStore(options = {}) {
    const hasRedisClientOption = Object.prototype.hasOwnProperty.call(options, 'redisClient');
    const now = typeof options.now === 'function' ? options.now : () => Date.now();
    const memoryStore = new Map();
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

    function pruneMemory() {
        const nowMs = now();
        for (const [key, entry] of memoryStore.entries()) {
            if (entry.expiresAtMs <= nowMs) {
                memoryStore.delete(key);
            }
        }
    }

    function claimFromMemory(key, ttlSeconds, serializedValue) {
        pruneMemory();
        const existing = memoryStore.get(key);
        if (existing) {
            return {
                claimed: false,
                duplicate: true,
                backend: 'memory',
                value: tryParse(existing.serializedValue),
            };
        }

        memoryStore.set(key, {
            serializedValue,
            expiresAtMs: now() + (ttlSeconds * 1000),
        });

        return {
            claimed: true,
            duplicate: false,
            backend: 'memory',
            value: tryParse(serializedValue),
        };
    }

    async function claim(key, ttlSeconds = DEFAULT_TTL_SECONDS, value = true) {
        if (typeof key !== 'string' || key.length === 0) {
            throw new Error('idempotency key must be a non-empty string');
        }

        const ttl = normalizeTtl(ttlSeconds);
        const serializedValue = stableStringify(value);
        const client = getClient();

        if (client) {
            try {
                const setResult = await client.set(key, serializedValue, 'EX', ttl, 'NX');
                if (setResult === 'OK') {
                    return {
                        claimed: true,
                        duplicate: false,
                        backend: 'redis',
                        value,
                    };
                }

                const existingValue = await client.get(key);
                return {
                    claimed: false,
                    duplicate: true,
                    backend: 'redis',
                    value: tryParse(existingValue),
                };
            } catch (_error) {
                useMemoryOnly = true;
            }
        }

        return claimFromMemory(key, ttl, serializedValue);
    }

    async function peek(key) {
        if (typeof key !== 'string' || key.length === 0) {
            throw new Error('idempotency key must be a non-empty string');
        }

        const client = getClient();
        if (client) {
            try {
                return tryParse(await client.get(key));
            } catch (_error) {
                useMemoryOnly = true;
            }
        }

        pruneMemory();
        const existing = memoryStore.get(key);
        return existing ? tryParse(existing.serializedValue) : null;
    }

    async function release(key) {
        if (typeof key !== 'string' || key.length === 0) {
            throw new Error('idempotency key must be a non-empty string');
        }

        const client = getClient();
        if (client) {
            try {
                await client.del(key);
            } catch (_error) {
                useMemoryOnly = true;
            }
        }

        memoryStore.delete(key);
        return { released: true };
    }

    return {
        claim,
        peek,
        release,
    };
}

const defaultStore = createIdempotencyStore();

async function claimIdempotencyKey(key, ttlSeconds, value) {
    return defaultStore.claim(key, ttlSeconds, value);
}

async function peekIdempotencyKey(key) {
    return defaultStore.peek(key);
}

async function releaseIdempotencyKey(key) {
    return defaultStore.release(key);
}

module.exports = {
    DEFAULT_TTL_SECONDS,
    stableStringify,
    createIdempotencyStore,
    claimIdempotencyKey,
    peekIdempotencyKey,
    releaseIdempotencyKey,
};
