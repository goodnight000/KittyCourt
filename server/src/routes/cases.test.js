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

const createQuery = (getResult) => {
    const query = {
        select: () => query,
        order: () => query,
        or: () => query,
        eq: () => query,
        in: () => query,
        single: () => query,
        limit: () => query,
        range: () => query,
        maybeSingle: () => query,
        then: (resolve, reject) => Promise.resolve(getResult()).then(resolve, reject),
        catch: (reject) => Promise.resolve(getResult()).catch(reject),
    };
    return query;
};

const mocks = vi.hoisted(() => {
    let queryResult = { data: [], error: null };
    const supabase = {
        from: () => createQuery(() => queryResult),
    };

    return {
        setQueryResult: (result) => { queryResult = result; },
        supabase,
        requireAuthUserId: vi.fn(async () => 'user-1'),
        requireSupabase: vi.fn(() => supabase),
        getPartnerIdForUser: vi.fn(async () => 'user-2'),
        requirePartner: (req, _res, next) => {
            req.userId = 'user-1';
            req.partnerId = 'user-2';
            req.supabase = supabase;
            next();
        },
    };
});

vi.mock('../lib/auth', () => ({
    requireAuthUserId: mocks.requireAuthUserId,
    requireSupabase: mocks.requireSupabase,
    getPartnerIdForUser: mocks.getPartnerIdForUser,
}));
vi.mock('../middleware/requirePartner', () => ({
    requirePartner: mocks.requirePartner,
}));

const getRouter = () => {
    vi.resetModules();
    // Re-apply mocks after reset
    vi.doMock('../lib/auth', () => ({
        requireAuthUserId: mocks.requireAuthUserId,
        requireSupabase: mocks.requireSupabase,
        getPartnerIdForUser: mocks.getPartnerIdForUser,
    }));
    vi.doMock('../middleware/requirePartner', () => ({
        requirePartner: mocks.requirePartner,
    }));
    return require('./cases');
};

describe('cases routes', () => {
    // TODO: Fix vitest module mocking - vi.mock/vi.doMock with vi.resetModules
    // doesn't properly apply mocks to CommonJS requires
    it.skip('returns transformed case history', async () => {
        mocks.setQueryResult({
            data: [{
                id: 'case-1',
                user_a_id: 'user-1',
                user_b_id: 'user-2',
                user_a_input: 'input',
                user_a_feelings: 'feelings',
                user_a_needs: 'needs',
                user_b_input: '',
                user_b_feelings: '',
                user_b_needs: '',
                status: 'OPEN',
                case_language: 'en',
                case_title: 'Title',
                severity_level: 2,
                primary_hiss_tag: 'tag',
                short_resolution: 'short',
                created_at: '2024-01-01',
                updated_at: '2024-01-02',
                verdicts: [],
            }],
            error: null,
        });

        const router = getRouter();
        const handlers = getRouteHandlers(router, 'get', '/');
        const req = createMockReq({ method: 'GET' });
        const res = createMockRes();

        await runHandlers(handlers, req, res);

        expect(res.statusCode).toBe(200);
        expect(res.body[0].userAId).toBe('user-1');
        expect(res.body[0].caseTitle).toBe('Title');
    });

    // TODO: Fix vitest module mocking - vi.mock/vi.doMock with vi.resetModules
    // doesn't properly apply mocks to CommonJS requires
    it.skip('forbids access to cases not owned by the viewer', async () => {
        mocks.setQueryResult({
            data: {
                id: 'case-2',
                user_a_id: 'user-9',
                user_b_id: 'user-8',
                verdicts: [],
            },
            error: null,
        });

        const router = getRouter();
        const handlers = getRouteHandlers(router, 'get', '/:id');
        const req = createMockReq({ method: 'GET', params: { id: 'case-2' } });
        const res = createMockRes();

        await runHandlers(handlers, req, res);

        expect(res.statusCode).toBe(403);
        expect(res.body.error).toBe('Forbidden');
    });
});
