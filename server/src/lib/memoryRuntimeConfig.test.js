import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const ENV_KEYS = {
    queueOnlyMode: 'MEMORY_QUEUE_ONLY',
    embeddedWorkerEnabled: 'MEMORY_EMBEDDED_WORKER_ENABLED',
    externalWorkerExpected: 'MEMORY_EXTERNAL_WORKER_EXPECTED',
    pollIntervalMs: 'MEMORY_JOBS_POLL_INTERVAL_MS',
};

function loadSubject() {
    const modulePath = require.resolve('./memoryRuntimeConfig');
    delete require.cache[modulePath];
    return require('./memoryRuntimeConfig');
}

function expectContainsTokens(errors, ...tokens) {
    expect(Array.isArray(errors)).toBe(true);
    expect(errors.length).toBeGreaterThan(0);

    const normalized = errors.join(' ').toLowerCase();
    for (const token of tokens) {
        expect(normalized).toContain(String(token).toLowerCase());
    }
}

describe('memoryRuntimeConfig', () => {
    it('default env is valid queue-only mode with external worker expectation', () => {
        const {
            parseMemoryRuntimeConfig,
            validateMemoryRuntimeConfig,
            assertMemoryRuntimeConfig,
        } = loadSubject();

        const config = parseMemoryRuntimeConfig({});

        expect(config).toEqual({
            queueOnlyMode: true,
            embeddedWorkerEnabled: false,
            externalWorkerExpected: true,
            pollIntervalMs: 1000,
        });
        expect(validateMemoryRuntimeConfig(config)).toEqual([]);
        expect(() => assertMemoryRuntimeConfig({ env: {} })).not.toThrow();
    });

    it('queue-only without embedded/external worker is invalid', () => {
        const {
            parseMemoryRuntimeConfig,
            validateMemoryRuntimeConfig,
            assertMemoryRuntimeConfig,
        } = loadSubject();

        const env = {
            [ENV_KEYS.queueOnlyMode]: 'true',
            [ENV_KEYS.embeddedWorkerEnabled]: 'false',
            [ENV_KEYS.externalWorkerExpected]: 'false',
        };
        const config = parseMemoryRuntimeConfig(env);
        const errors = validateMemoryRuntimeConfig(config);

        expectContainsTokens(errors, 'queue', 'worker');
        expect(() => assertMemoryRuntimeConfig({ env })).toThrow();
    });

    it('embedded worker enabled while queue-only false is invalid', () => {
        const {
            parseMemoryRuntimeConfig,
            validateMemoryRuntimeConfig,
            assertMemoryRuntimeConfig,
        } = loadSubject();

        const env = {
            [ENV_KEYS.queueOnlyMode]: 'false',
            [ENV_KEYS.embeddedWorkerEnabled]: 'true',
        };
        const config = parseMemoryRuntimeConfig(env);
        const errors = validateMemoryRuntimeConfig(config);

        expectContainsTokens(errors, 'embedded', 'queue');
        expect(() => assertMemoryRuntimeConfig({ env })).toThrow();
    });

    it('external worker expected while queue-only false is invalid', () => {
        const {
            parseMemoryRuntimeConfig,
            validateMemoryRuntimeConfig,
            assertMemoryRuntimeConfig,
        } = loadSubject();

        const env = {
            [ENV_KEYS.queueOnlyMode]: 'false',
            [ENV_KEYS.externalWorkerExpected]: 'true',
        };
        const config = parseMemoryRuntimeConfig(env);
        const errors = validateMemoryRuntimeConfig(config);

        expectContainsTokens(errors, 'external', 'queue');
        expect(() => assertMemoryRuntimeConfig({ env })).toThrow();
    });

    it('queue-only with external worker expected is valid', () => {
        const {
            parseMemoryRuntimeConfig,
            validateMemoryRuntimeConfig,
            assertMemoryRuntimeConfig,
        } = loadSubject();

        const env = {
            [ENV_KEYS.queueOnlyMode]: 'true',
            [ENV_KEYS.externalWorkerExpected]: 'true',
        };
        const config = parseMemoryRuntimeConfig(env);

        expect(config).toEqual(expect.objectContaining({
            queueOnlyMode: true,
            embeddedWorkerEnabled: false,
            externalWorkerExpected: true,
        }));
        expect(validateMemoryRuntimeConfig(config)).toEqual([]);
        expect(() => assertMemoryRuntimeConfig({ env })).not.toThrow();
    });

    it('queue-only with embedded worker enabled is valid', () => {
        const {
            parseMemoryRuntimeConfig,
            validateMemoryRuntimeConfig,
            assertMemoryRuntimeConfig,
        } = loadSubject();

        const env = {
            [ENV_KEYS.queueOnlyMode]: 'true',
            [ENV_KEYS.embeddedWorkerEnabled]: 'true',
            [ENV_KEYS.externalWorkerExpected]: 'false',
        };
        const config = parseMemoryRuntimeConfig(env);

        expect(config).toEqual(expect.objectContaining({
            queueOnlyMode: true,
            embeddedWorkerEnabled: true,
            externalWorkerExpected: false,
        }));
        expect(validateMemoryRuntimeConfig(config)).toEqual([]);
        expect(() => assertMemoryRuntimeConfig({ env })).not.toThrow();
    });

    it('embedded worker enabled but supabase unconfigured is invalid', () => {
        const {
            parseMemoryRuntimeConfig,
            validateMemoryRuntimeConfig,
            assertMemoryRuntimeConfig,
        } = loadSubject();

        const env = {
            [ENV_KEYS.queueOnlyMode]: 'true',
            [ENV_KEYS.embeddedWorkerEnabled]: 'true',
            [ENV_KEYS.externalWorkerExpected]: 'false',
        };
        const config = parseMemoryRuntimeConfig(env);
        const errors = validateMemoryRuntimeConfig(config, { supabaseConfigured: false });

        expectContainsTokens(errors, 'embedded', 'supabase');
        expect(() => assertMemoryRuntimeConfig({ env, supabaseConfigured: false })).toThrow();
    });

    it('poll interval parsing: invalid/non-positive falls back to 1000', () => {
        const { parseMemoryRuntimeConfig } = loadSubject();
        const invalidValues = ['abc', '0', '-5', '', '   '];

        for (const value of invalidValues) {
            const config = parseMemoryRuntimeConfig({
                [ENV_KEYS.pollIntervalMs]: value,
            });
            expect(config.pollIntervalMs).toBe(1000);
        }
    });
});
