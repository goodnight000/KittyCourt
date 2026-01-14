import { describe, expect, it, vi, beforeEach } from 'vitest';
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

const createMockReq = ({ method = 'GET', body = {}, query = {}, params = {} } = {}) => ({
    method,
    body,
    query,
    params,
    headers: {},
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

const mocks = vi.hoisted(() => ({
    courtSessionManager: {
        getStateForUser: vi.fn(() => ({ phase: 'ACTIVE' })),
        serve: vi.fn().mockResolvedValue(),
    },
    VIEW_PHASE: { IDLE: 'IDLE' },
    PHASE: { IDLE: 'IDLE' },
    requireAuthUserId: vi.fn(async () => 'user-1'),
    requireSupabase: vi.fn(),
    getPartnerIdForUser: vi.fn(async () => 'partner-1'),
    isSupabaseConfigured: vi.fn(() => false),
    resolveRequestLanguage: vi.fn(async () => 'en'),
    getUserPreferredLanguage: vi.fn(async () => 'en'),
}));

vi.mock('../lib/courtSessionManager', () => ({
    courtSessionManager: mocks.courtSessionManager,
    VIEW_PHASE: mocks.VIEW_PHASE,
    PHASE: mocks.PHASE,
}));
vi.mock('../lib/auth', () => ({
    requireAuthUserId: mocks.requireAuthUserId,
    requireSupabase: mocks.requireSupabase,
    getPartnerIdForUser: mocks.getPartnerIdForUser,
}));
vi.mock('../lib/supabase', () => ({
    isSupabaseConfigured: mocks.isSupabaseConfigured,
}));
vi.mock('../lib/language', () => ({
    resolveRequestLanguage: mocks.resolveRequestLanguage,
    getUserPreferredLanguage: mocks.getUserPreferredLanguage,
}));

const getRouter = () => {
    vi.resetModules();
    // Re-apply mocks after reset
    vi.doMock('../lib/courtSessionManager', () => ({
        courtSessionManager: mocks.courtSessionManager,
        VIEW_PHASE: mocks.VIEW_PHASE,
        PHASE: mocks.PHASE,
    }));
    vi.doMock('../lib/auth', () => ({
        requireAuthUserId: mocks.requireAuthUserId,
        requireSupabase: mocks.requireSupabase,
        getPartnerIdForUser: mocks.getPartnerIdForUser,
    }));
    vi.doMock('../lib/supabase', () => ({
        isSupabaseConfigured: mocks.isSupabaseConfigured,
    }));
    vi.doMock('../lib/language', () => ({
        resolveRequestLanguage: mocks.resolveRequestLanguage,
        getUserPreferredLanguage: mocks.getUserPreferredLanguage,
    }));
    return require('./court');
};

describe('court routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns idle state when unauthenticated state request', async () => {
        const router = getRouter();
        const handlers = getRouteHandlers(router, 'get', '/state');
        const req = createMockReq({ method: 'GET' });
        const res = createMockRes();

        await runHandlers(handlers, req, res);

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ phase: 'IDLE', myViewPhase: 'IDLE', session: null });
    });

    it('rejects serve requests missing partnerId', async () => {
        const router = getRouter();
        const handlers = getRouteHandlers(router, 'post', '/serve');
        const req = createMockReq({ method: 'POST', body: { userId: 'user-1' } });
        const res = createMockRes();

        await runHandlers(handlers, req, res);

        expect(res.statusCode).toBe(400);
        expect(res.body.errorCode).toBe('PARTNER_REQUIRED');
    });

    // TODO: Fix vitest module mocking - vi.mock/vi.doMock with vi.resetModules
    // doesn't properly apply mocks to CommonJS requires
    it.skip('serves a court session when partnerId is provided', async () => {
        const router = getRouter();
        mocks.courtSessionManager.getStateForUser.mockReturnValueOnce({ phase: 'PENDING' });
        const handlers = getRouteHandlers(router, 'post', '/serve');
        const req = createMockReq({
            method: 'POST',
            body: { userId: 'user-1', partnerId: 'partner-1', coupleId: 'couple-1' },
        });
        const res = createMockRes();

        await runHandlers(handlers, req, res);

        expect(res.statusCode).toBe(200);
        expect(res.body.phase).toBe('PENDING');
        expect(mocks.courtSessionManager.serve).toHaveBeenCalled();
    });
});
