import { describe, expect, it, vi } from 'vitest';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { io as ioClient } from 'socket.io-client';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const mocks = vi.hoisted(() => {
    const courtSessionManager = {
        setWebSocketService: vi.fn(),
        getStateForUser: vi.fn(() => ({ phase: 'READY' })),
        serve: vi.fn().mockResolvedValue(),
        accept: vi.fn().mockResolvedValue(),
        cancel: vi.fn().mockResolvedValue(),
        dismiss: vi.fn().mockResolvedValue(),
        submitEvidence: vi.fn().mockResolvedValue(),
        acceptVerdict: vi.fn().mockResolvedValue(),
        requestSettlement: vi.fn(),
        acceptSettlement: vi.fn().mockResolvedValue(),
        declineSettlement: vi.fn(),
        submitAddendum: vi.fn().mockResolvedValue(),
        markPrimingComplete: vi.fn().mockResolvedValue(),
        markJointReady: vi.fn().mockResolvedValue(),
        submitResolutionPick: vi.fn().mockResolvedValue(),
        acceptPartnerResolution: vi.fn().mockResolvedValue(),
        requestHybridResolution: vi.fn().mockResolvedValue(),
    };

    return {
        courtSessionManager,
        isSupabaseConfigured: vi.fn(() => false),
        requireSupabase: vi.fn(),
        getPartnerIdForUser: vi.fn(async () => 'partner-1'),
        resolveLanguageFromHeader: vi.fn(async () => 'en'),
        getUserPreferredLanguage: vi.fn(async () => 'en'),
        processSecureInput: vi.fn((input) => ({ safe: true, input })),
        securityConfig: {
            fieldLimits: {
                cameraFacts: 500,
                theStoryIamTellingMyself: 500,
                unmetNeeds: 500,
            },
        },
        logSecurityEvent: vi.fn(),
        createSocketCorsOptions: vi.fn(() => ({ origin: '*' })),
    };
});

vi.mock('./courtSessionManager', () => ({
    courtSessionManager: mocks.courtSessionManager,
    VIEW_PHASE: { IDLE: 'IDLE' },
}));
vi.mock('./security', () => ({
    createSocketCorsOptions: mocks.createSocketCorsOptions,
}));
vi.mock('./security/index', () => ({
    processSecureInput: mocks.processSecureInput,
    securityConfig: mocks.securityConfig,
    logSecurityEvent: mocks.logSecurityEvent,
}));
vi.mock('./supabase', () => ({
    isSupabaseConfigured: mocks.isSupabaseConfigured,
}));
vi.mock('./auth', () => ({
    requireSupabase: mocks.requireSupabase,
    getPartnerIdForUser: mocks.getPartnerIdForUser,
}));
vi.mock('./language', () => ({
    resolveLanguageFromHeader: mocks.resolveLanguageFromHeader,
    getUserPreferredLanguage: mocks.getUserPreferredLanguage,
}));

const emitWithAck = (socket, event, payload) => (
    new Promise((resolve) => socket.emit(event, payload, resolve))
);

const createTestServer = async ({ supabaseConfigured = false } = {}) => {
    mocks.isSupabaseConfigured.mockReturnValue(supabaseConfigured);
    const httpServer = createServer();
    await new Promise((resolve) => httpServer.listen(0, resolve));
    const port = httpServer.address().port;

    const courtWebSocket = require('./courtWebSocket');
    if (courtWebSocket.io) {
        courtWebSocket.io.close();
    }
    courtWebSocket.userSockets?.clear?.();
    courtWebSocket.initialize(httpServer);

    const cleanup = async () => {
        if (courtWebSocket.io) {
            await new Promise((resolve) => courtWebSocket.io.close(resolve));
        }
        await new Promise((resolve) => httpServer.close(resolve));
        courtWebSocket.userSockets?.clear?.();
    };

    return { courtWebSocket, port, cleanup };
};

describe('courtWebSocket', () => {
    it('registers user sockets and emits to user', async () => {
        const { courtWebSocket, port, cleanup } = await createTestServer();
        const socket = ioClient(`http://localhost:${port}`, { transports: ['websocket'] });
        await once(socket, 'connect');

        const response = await emitWithAck(socket, 'court:register', { userId: 'user-1' });
        expect(response.ok).toBe(true);
        expect(courtWebSocket.isUserConnected('user-1')).toBe(true);

        const eventPromise = once(socket, 'court:ping');
        courtWebSocket.emitToUser('user-1', 'court:ping', { ok: true });
        const [payload] = await eventPromise;
        expect(payload).toEqual({ ok: true });

        socket.disconnect();
        await cleanup();
    });

    it('rejects actions when not registered', async () => {
        const { port, cleanup } = await createTestServer();
        const socket = ioClient(`http://localhost:${port}`, { transports: ['websocket'] });
        await once(socket, 'connect');

        const response = await emitWithAck(socket, 'court:accept');
        expect(response.ok).toBe(false);
        expect(response.error).toBe('Not registered');

        socket.disconnect();
        await cleanup();
    });

    it('enforces rate limits for serve requests', async () => {
        const { port, cleanup } = await createTestServer();
        const socket = ioClient(`http://localhost:${port}`, { transports: ['websocket'] });
        await once(socket, 'connect');

        await emitWithAck(socket, 'court:register', { userId: 'user-rate' });

        const results = [];
        for (let i = 0; i < 6; i += 1) {
            results.push(await emitWithAck(socket, 'court:serve', {
                partnerId: 'partner-1',
                coupleId: 'couple-1',
                judgeType: 'mittens',
            }));
        }

        expect(results[5].ok).toBe(false);
        expect(results[5].error).toBe('RATE_LIMIT_EXCEEDED');

        socket.disconnect();
        await cleanup();
    });

    it('rejects connections without auth when Supabase is configured', async () => {
        const { port, cleanup } = await createTestServer({ supabaseConfigured: true });

        const socket = ioClient(`http://localhost:${port}`, {
            transports: ['websocket'],
            reconnection: false,
        });

        const [err] = await once(socket, 'connect_error');
        expect(err.message).toBe('Unauthorized');

        socket.disconnect();
        await cleanup();
    });
});
