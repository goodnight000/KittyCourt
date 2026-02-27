import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
    buildHealthSnapshot,
    checkMemoryWorkerReadiness,
    deriveOverallStatus,
} = require('./health');

describe('health readiness', () => {
    it('returns HTTP 503 when critical dependency is down', async () => {
        const snapshot = await buildHealthSnapshot({
            memoryRuntimeConfig: {
                embeddedWorkerEnabled: false,
                queueOnlyMode: true,
                externalWorkerExpected: true,
                pollIntervalMs: 1000,
            },
            deps: {
                isSupabaseConfigured: () => true,
                getSupabase: () => ({
                    from: () => ({
                        select: () => ({
                            limit: async () => ({ error: new Error('db unavailable') }),
                        }),
                    }),
                }),
                isOpenRouterConfigured: () => false,
                fetchFn: vi.fn(),
            },
        });

        expect(snapshot.status).toBe('down');
        expect(snapshot.httpStatus).toBe(503);
        expect(snapshot.dependencies.supabase.status).toBe('down');
    });

    it('returns degraded when only non-critical dependency is degraded', () => {
        const overall = deriveOverallStatus({
            app: { critical: true, status: 'ready' },
            supabase: { critical: true, status: 'ready' },
            openrouter: { critical: false, status: 'degraded' },
            memory_worker: { critical: false, status: 'ready' },
        });

        expect(overall.status).toBe('degraded');
        expect(overall.httpStatus).toBe(200);
    });

    it('reports external memory worker expectation as ready in queue-only external mode', () => {
        const worker = checkMemoryWorkerReadiness({
            memoryRuntimeConfig: {
                embeddedWorkerEnabled: false,
                queueOnlyMode: true,
                externalWorkerExpected: true,
                pollIntervalMs: 1000,
            },
        });

        expect(worker.status).toBe('ready');
        expect(worker.mode).toBe('external_expected');
    });
});
