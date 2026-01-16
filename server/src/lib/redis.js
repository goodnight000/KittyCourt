const Redis = require('ioredis');

let redisClient = null;
let redisSubscriber = null;

const isRedisConfigured = () => (
    !!process.env.REDIS_URL || !!process.env.REDIS_HOST
);

const buildRedisOptions = () => {
    if (process.env.REDIS_URL) {
        return process.env.REDIS_URL;
    }

    const host = process.env.REDIS_HOST || '127.0.0.1';
    const port = process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379;
    const password = process.env.REDIS_PASSWORD || undefined;
    const tls = process.env.REDIS_TLS === 'true' ? {} : undefined;

    return {
        host,
        port,
        password,
        tls,
    };
};

const getRedisClient = () => {
    if (!isRedisConfigured()) return null;
    if (!redisClient) {
        redisClient = new Redis(buildRedisOptions());
        redisClient.on('error', (error) => {
            console.error('[Redis] Client error:', error?.message || error);
        });
    }
    return redisClient;
};

const getRedisSubscriber = () => {
    const client = getRedisClient();
    if (!client) return null;
    if (!redisSubscriber) {
        redisSubscriber = client.duplicate();
        redisSubscriber.on('error', (error) => {
            console.error('[Redis] Subscriber error:', error?.message || error);
        });
    }
    return redisSubscriber;
};

const LOCK_TTL_MS = 5000; // 5 second lock TTL

/**
 * Acquire a distributed lock using Redis SETNX
 * @param {string} lockKey - The key to lock on
 * @param {number} ttlMs - Lock TTL in milliseconds
 * @returns {Promise<Object>} - { acquired: boolean, lockValue: string, release: function }
 */
const acquireLock = async (lockKey, ttlMs = LOCK_TTL_MS) => {
    const client = getRedisClient();

    // If Redis not configured, assume single instance - no lock needed
    if (!client) {
        return {
            acquired: true,
            lockValue: null,
            release: async () => {}
        };
    }

    const lockValue = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

    try {
        // SETNX with expiration: SET key value PX milliseconds NX
        const result = await client.set(lockKey, lockValue, 'PX', ttlMs, 'NX');

        if (result === 'OK') {
            return {
                acquired: true,
                lockValue,
                release: async () => {
                    try {
                        // Only release if we still own the lock
                        const current = await client.get(lockKey);
                        if (current === lockValue) {
                            await client.del(lockKey);
                        }
                    } catch (err) {
                        console.error('[Redis] Failed to release lock:', err);
                    }
                }
            };
        }

        return {
            acquired: false,
            lockValue: null,
            release: async () => {}
        };
    } catch (err) {
        console.error('[Redis] Failed to acquire lock:', err);
        // WS-H-004: Fail-closed when Redis is configured but unavailable
        // This prevents race conditions in distributed deployments
        return {
            acquired: false,
            lockValue: null,
            release: async () => {},
            error: 'Lock service unavailable'
        };
    }
};

module.exports = {
    getRedisClient,
    getRedisSubscriber,
    isRedisConfigured,
    acquireLock,
};
