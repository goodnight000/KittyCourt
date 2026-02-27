import { describe, it, expect } from 'vitest';
import { createIdempotencyStore } from '../idempotency.js';

function createRedisStub({ throwOnSet = false } = {}) {
    const store = new Map();

    return {
        async set(key, value, mode, ttlSeconds, nxFlag) {
            if (throwOnSet) {
                throw new Error('redis unavailable');
            }

            const hasKey = store.has(key);
            if (mode === 'EX' && nxFlag === 'NX') {
                if (hasKey) {
                    return null;
                }
                store.set(key, { value, ttlSeconds });
                return 'OK';
            }

            store.set(key, { value, ttlSeconds });
            return 'OK';
        },
        async get(key) {
            const entry = store.get(key);
            return entry ? entry.value : null;
        },
        async del(key) {
            store.delete(key);
            return 1;
        },
    };
}

describe('idempotency', () => {
    it('uses in-memory backend when redis is unavailable', async () => {
        let nowMs = 1000;
        const store = createIdempotencyStore({
            redisClient: null,
            now: () => nowMs,
        });

        const first = await store.claim('k1', 60, { value: 1 });
        const second = await store.claim('k1', 60, { value: 2 });

        expect(first.backend).toBe('memory');
        expect(first.claimed).toBe(true);
        expect(second.duplicate).toBe(true);
        expect(second.value).toEqual({ value: 1 });

        nowMs += 61_000;
        const third = await store.claim('k1', 60, { value: 3 });
        expect(third.claimed).toBe(true);
        expect(third.duplicate).toBe(false);
    });

    it('uses redis backend when available', async () => {
        const redisClient = createRedisStub();
        const store = createIdempotencyStore({ redisClient });

        const first = await store.claim('redis-key', 120, { ok: true });
        const second = await store.claim('redis-key', 120, { ok: false });

        expect(first.backend).toBe('redis');
        expect(first.claimed).toBe(true);
        expect(second.duplicate).toBe(true);
        expect(second.value).toEqual({ ok: true });
    });

    it('falls back to memory when redis operations fail', async () => {
        const redisClient = createRedisStub({ throwOnSet: true });
        const store = createIdempotencyStore({ redisClient });

        const first = await store.claim('fallback-key', 30, { a: 1 });
        const second = await store.claim('fallback-key', 30, { a: 2 });

        expect(first.backend).toBe('memory');
        expect(first.claimed).toBe(true);
        expect(second.duplicate).toBe(true);
        expect(second.value).toEqual({ a: 1 });
    });

    it('supports peek and release', async () => {
        const store = createIdempotencyStore({ redisClient: null });

        await store.claim('peek-key', 60, { seen: true });
        expect(await store.peek('peek-key')).toEqual({ seen: true });

        await store.release('peek-key');
        expect(await store.peek('peek-key')).toBeNull();
    });
});
