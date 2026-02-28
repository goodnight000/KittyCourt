import { describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { io as ioClient } from 'socket.io-client';

// NOTE: courtWebSocket.js is a CommonJS module that uses require() internally.
// vitest's vi.mock() does not intercept CJS require() calls from within CJS modules.
// Therefore, the real dependencies are loaded. The tests are designed to work with
// the real module code, using environment variables to control behavior where needed.

const emitWithAck = (socket, event, payload) => (
    new Promise((resolve) => {
        if (payload !== undefined) {
            socket.emit(event, payload, resolve);
        } else {
            socket.emit(event, resolve);
        }
    })
);

const createTestServer = async () => {
    const httpServer = createServer();
    await new Promise((resolve) => httpServer.listen(0, resolve));
    const port = httpServer.address().port;

    // Dynamic import to get a fresh module. The CJS singleton is reused across tests
    // in the same module, but createCourtWebSocketService gives a fresh instance.
    const { createCourtWebSocketService } = await import('./courtWebSocket');
    const courtWebSocket = createCourtWebSocketService();
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
    it('registers user sockets and emits to user', { timeout: 10000 }, async () => {
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

    it('rejects actions when not registered', { timeout: 10000 }, async () => {
        const { port, cleanup } = await createTestServer();
        const socket = ioClient(`http://localhost:${port}`, { transports: ['websocket'] });
        await once(socket, 'connect');

        const response = await emitWithAck(socket, 'court:accept');
        expect(response.ok).toBe(false);
        expect(response.error).toBe('Not registered');

        socket.disconnect();
        await cleanup();
    });

    it('enforces rate limits for serve requests', { timeout: 15000 }, async () => {
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

    it('rejects connections without auth when Supabase is configured', { timeout: 10000 }, async () => {
        // Set env vars so the real isSupabaseConfigured() returns true.
        // This triggers the auth middleware which rejects connections without a token.
        const origUrl = process.env.SUPABASE_URL;
        const origKey = process.env.SUPABASE_SERVICE_KEY;
        process.env.SUPABASE_URL = 'https://fake.supabase.co';
        process.env.SUPABASE_SERVICE_KEY = 'fake-key';

        try {
            const { port, cleanup } = await createTestServer();

            const socket = ioClient(`http://localhost:${port}`, {
                transports: ['websocket'],
                reconnection: false,
            });

            const [err] = await once(socket, 'connect_error');
            expect(err.message).toContain('Unauthorized');

            socket.disconnect();
            await cleanup();
        } finally {
            // Restore env vars
            if (origUrl === undefined) {
                delete process.env.SUPABASE_URL;
            } else {
                process.env.SUPABASE_URL = origUrl;
            }
            if (origKey === undefined) {
                delete process.env.SUPABASE_SERVICE_KEY;
            } else {
                process.env.SUPABASE_SERVICE_KEY = origKey;
            }
        }
    });
});
