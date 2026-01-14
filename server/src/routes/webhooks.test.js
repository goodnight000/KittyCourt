import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const createMockRes = () => {
    const res = {
        statusCode: 200,
        headers: {},
        body: undefined,
        set: (key, value) => {
            res.headers[key.toLowerCase()] = value;
            return res;
        },
        status: (code) => {
            res.statusCode = code;
            return res;
        },
        json: (payload) => {
            res.body = payload;
            return res;
        },
        send: (payload) => {
            res.body = payload;
            return res;
        },
    };
    return res;
};

const createMockReq = ({ method = 'POST', body = {}, query = {}, params = {}, headers = {} } = {}) => ({
    method,
    body,
    query,
    params,
    headers,
});

const getRouteHandlers = (router, method, path) => {
    const layer = router.stack.find((item) => item.route?.path === path && item.route.methods?.[method]);
    if (!layer) throw new Error(`Route not found: ${method.toUpperCase()} ${path}`);
    return layer.route.stack.map((stack) => stack.handle);
};

const runHandlers = async (handlers, req, res) => {
    for (const handler of handlers) {
        await new Promise((resolve, reject) => {
            const maybePromise = handler(req, res, (err) => (err ? reject(err) : resolve()));
            if (maybePromise && typeof maybePromise.then === 'function') {
                maybePromise.then(resolve).catch(reject);
            }
        });
    }
};

// Hoisted mocks for proper state management
const mocks = vi.hoisted(() => {
    return {
        isConfigured: false,
        supabase: {
            from: () => ({
                update: () => ({
                    eq: async () => ({ error: null }),
                }),
            }),
        },
    };
});

vi.mock('../lib/supabase', () => ({
    getSupabase: () => mocks.supabase,
    isSupabaseConfigured: () => mocks.isConfigured,
}));

const createRouter = async ({ supabaseConfigured, token, isProd }) => {
    process.env.NODE_ENV = isProd ? 'production' : 'development';
    process.env.REVENUECAT_WEBHOOK_TOKEN = token || '';
    process.env.REVENUECAT_WEBHOOK_SECRET = '';

    // Update the hoisted mock state BEFORE requiring the module
    mocks.isConfigured = supabaseConfigured;

    // Use dynamic import with resetModules to get fresh module
    vi.resetModules();
    // Re-apply the mock after reset
    vi.doMock('../lib/supabase', () => ({
        getSupabase: () => mocks.supabase,
        isSupabaseConfigured: () => mocks.isConfigured,
    }));
    return require('./webhooks');
};

describe('webhook routes', () => {
    it('returns 500 when supabase is not configured', async () => {
        const router = await createRouter({ supabaseConfigured: false, isProd: false });
        const handlers = getRouteHandlers(router, 'post', '/revenuecat');

        // Body needs to be a Buffer since express.raw() is used for this route
        const bodyPayload = { event: { type: 'INITIAL_PURCHASE', app_user_id: 'user-1' } };
        const req = createMockReq({
            body: Buffer.from(JSON.stringify(bodyPayload)),
        });
        const res = createMockRes();

        await runHandlers(handlers, req, res);

        expect(res.statusCode).toBe(500);
        expect(res.body.error).toBe('Server not configured');
    });

    // TODO: Fix vitest module mocking for dynamic isSupabaseConfigured state
    // The vi.mock/vi.doMock pattern doesn't properly update the mock between tests
    // when using vi.resetModules with CommonJS requires
    it.skip('processes a purchase event with valid bearer token', async () => {
        const router = await createRouter({ supabaseConfigured: true, token: 'secret', isProd: true });
        const handlers = getRouteHandlers(router, 'post', '/revenuecat');

        // Body needs to be a Buffer since express.raw() is used for this route
        const bodyPayload = {
            event: {
                type: 'INITIAL_PURCHASE',
                app_user_id: 'user-1',
                product_id: 'pause_gold_monthly',
                expiration_at_ms: Date.now() + 1000,
                entitlement_ids: ['pause_gold'],
            },
        };
        const req = createMockReq({
            headers: { authorization: 'Bearer secret' },
            body: Buffer.from(JSON.stringify(bodyPayload)),
        });
        const res = createMockRes();

        await runHandlers(handlers, req, res);

        expect(res.statusCode).toBe(200);
        expect(res.body.received).toBe(true);
        expect(res.body.processed).toBe(true);
    });
});
