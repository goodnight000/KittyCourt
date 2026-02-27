/**
 * Pause Server
 * 
 * Express API server that uses Supabase for all data storage.
 * No more Prisma/SQLite - everything goes to Supabase!
 */

const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');

// Load environment variables (prefer repo root .env, allow server/.env to override)
const dotenv = require('dotenv');
const repoEnvPath = path.resolve(__dirname, '../../.env');
const serverEnvPath = path.resolve(__dirname, '../.env');

if (fs.existsSync(repoEnvPath)) {
    dotenv.config({ path: repoEnvPath });
}
if (fs.existsSync(serverEnvPath)) {
    dotenv.config({ path: serverEnvPath, override: true });
}

// Import Supabase client
const { isSupabaseConfigured } = require('./lib/supabase');
const { buildHealthSnapshot } = require('./lib/health');
const { corsMiddleware, securityHeaders } = require('./lib/security');
const { initSentry, setupSentryErrorHandler, captureException } = require('./lib/sentry');
const { isRedisConfigured } = require('./lib/redis');
const { runMemoryJobsWorker } = require('./lib/memoryJobsWorker');
const { assertMemoryRuntimeConfig } = require('./lib/memoryRuntimeConfig');

// Import routes
const memoryRoutes = require('./routes/memory');
const dailyQuestionsRoutes = require('./routes/dailyQuestions');
const usageRoutes = require('./routes/usage');
const webhookRoutes = require('./routes/webhooks');
const subscriptionRoutes = require('./routes/subscription');
const casesRoutes = require('./routes/cases');
const economyRoutes = require('./routes/economy');
const appreciationsRoutes = require('./routes/appreciations');
const calendarRoutes = require('./routes/calendar');
const levelsRoutes = require('./routes/levels');
const challengesRoutes = require('./routes/challenges');
const memoriesRoutes = require('./routes/memories');
const insightsRoutes = require('./routes/insights');
const feedbackRoutes = require('./routes/feedback');
const notificationsRoutes = require('./routes/notifications');
const statsRoutes = require('./routes/stats');
const accountRoutes = require('./routes/account');
const profileRoutes = require('./routes/profile');
const exportsRoutes = require('./routes/exports');
const abuseRoutes = require('./routes/abuse');

// Court architecture
const courtRoutes = require('./routes/court');
const { initializeCourtServices } = require('./lib/courtInit');

// Rate limiting for expensive operations
const { createRateLimiter } = require('./lib/rateLimit');

// Rate limiters for different operation types
const courtServeRateLimiter = createRateLimiter({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10,
    keyGenerator: (req) => req.headers.authorization || req.ip || 'unknown',
});

const casesRateLimiter = createRateLimiter({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 60, // Increased from 20 to allow browsing case history
    keyGenerator: (req) => {
        // Prefer auth token for per-user rate limiting
        // Fall back to IP + user-agent hash to separate unauthenticated requests
        const auth = req.headers.authorization;
        if (auth) return auth;
        const ip = req.ip || 'unknown';
        const ua = req.headers['user-agent'] || '';
        return `${ip}:${ua.slice(0, 50)}`;
    },
});

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const isProd = process.env.NODE_ENV === 'production';

initSentry(app);

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(securityHeaders);

if (isProd && !isRedisConfigured()) {
    console.error('[Security] CRITICAL: Redis is required in production for session persistence.');
    console.error('[Security] Set REDIS_URL or REDIS_HOST before starting the server.');
    process.exit(1);
}

let memoryRuntimeConfig;
try {
    memoryRuntimeConfig = assertMemoryRuntimeConfig({
        supabaseConfigured: isSupabaseConfigured(),
    });
} catch (error) {
    console.error('[MemoryWorker] FATAL: Invalid memory runtime configuration.');
    console.error(`[MemoryWorker] ${error.message}`);
    process.exit(1);
}

let embeddedMemoryWorkerStarted = false;
let embeddedMemoryWorkerStopRequested = false;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function startEmbeddedMemoryWorker(pollIntervalMs) {
    if (embeddedMemoryWorkerStarted) {
        return;
    }

    embeddedMemoryWorkerStarted = true;
    console.log(`[MemoryWorker] Starting embedded memory jobs worker (poll interval: ${pollIntervalMs}ms).`);

    const runLoop = async () => {
        while (!embeddedMemoryWorkerStopRequested) {
            try {
                const summary = await runMemoryJobsWorker({
                    pollIntervalMs,
                    once: true,
                });

                if (summary?.emptyPolls > 0 && !embeddedMemoryWorkerStopRequested) {
                    await sleep(pollIntervalMs);
                }
            } catch (error) {
                console.error('[MemoryWorker] Embedded memory worker iteration failed:', error);
                if (!embeddedMemoryWorkerStopRequested) {
                    await sleep(pollIntervalMs);
                }
            }
        }
    };

    runLoop().catch((error) => {
        console.error('[MemoryWorker] Embedded memory worker loop crashed:', error);
    });
}

server.on('close', () => {
    if (embeddedMemoryWorkerStarted) {
        embeddedMemoryWorkerStopRequested = true;
        console.log('[MemoryWorker] Embedded memory worker stop requested.');
    }
});

// Security: Verify production environment is properly configured
if (isProd) {
    // Verify critical security settings in production
    if (!process.env.CORS_ORIGIN) {
        console.warn('[Security] Warning: CORS_ORIGIN not set in production - CORS may be restrictive');
    }
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
        console.error('[Security] CRITICAL: Supabase not configured in production');
    }
    // Log security mode
    console.log('[Security] Running in PRODUCTION mode with strict security');
} else {
    console.log('[Security] Running in DEVELOPMENT mode - auth bypass may be available');
    if (process.env.REQUIRE_AUTH_IN_DEV === 'true') {
        console.log('[Security] REQUIRE_AUTH_IN_DEV is set - authentication required even in dev');
    }
}

app.use(corsMiddleware());

// Raw body parsing for webhook HMAC verification (must be BEFORE express.json())
// This ensures req.body is a Buffer for signature verification
app.use('/api/webhooks/revenuecat', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '256kb' }));
app.use(express.urlencoded({ extended: false, limit: process.env.JSON_BODY_LIMIT || '256kb' }));
const safeErrorMessage = (error) => (isProd ? 'Internal server error' : (error?.message || String(error)));

// --- Routes ---

// Memory System Routes
app.use('/api/memory', memoryRoutes);

// Daily Questions Routes
app.use('/api/daily-questions', dailyQuestionsRoutes);

// Court Session Routes (with rate limiting on serve)
app.use('/api/court/serve', courtServeRateLimiter);
app.use('/api/court', courtRoutes);

// Usage Tracking Routes (Subscription limits)
app.use('/api/usage', usageRoutes);

// Webhook Routes (RevenueCat, etc.)
app.use('/api/webhooks', webhookRoutes);

// Subscription Status Routes
app.use('/api/subscription', subscriptionRoutes);

// Cases Routes (with rate limiting)
app.use('/api/cases', casesRateLimiter, casesRoutes);

// Economy Routes
app.use('/api/economy', economyRoutes);

// Appreciations Routes
app.use('/api/appreciations', appreciationsRoutes);

// Calendar Routes
app.use('/api/calendar', calendarRoutes);

// Levels Routes
app.use('/api/levels', levelsRoutes);

// Challenges Routes
app.use('/api/challenges', challengesRoutes);

// Memories Routes
app.use('/api/memories', memoriesRoutes);

// Insights Routes
app.use('/api/insights', insightsRoutes);

// Feedback Routes
app.use('/api/feedback', feedbackRoutes);

// Notifications Routes
app.use('/api/notifications', notificationsRoutes);

// Stats Routes
app.use('/api/stats', statsRoutes);

// Profile Routes
app.use('/api/profile', profileRoutes);

// Data Export Routes
app.use('/api/exports', exportsRoutes);

// Account Routes (account deletion, etc.)
app.use('/api/account', accountRoutes);

// Abuse Challenge Routes
app.use('/api/abuse', abuseRoutes);

// Root endpoint - for easy verification
app.get('/', (req, res) => {
    res.json({
        name: 'Pause API',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            health: '/api/health',
            court: '/api/court'
        }
    });
});

// Health check with dependency readiness/degradation details
app.get('/api/health', async (req, res) => {
    const snapshot = await buildHealthSnapshot({ memoryRuntimeConfig });
    const { httpStatus, ...payload } = snapshot;
    res.status(httpStatus).json(payload);
});

// Centralized error handling (CORS + unexpected errors)
setupSentryErrorHandler(app);
app.use((err, req, res, _next) => {
    if (err?.message === 'CORS blocked') {
        const origin = req?.headers?.origin || req?.headers?.Origin || 'unknown';
        console.warn('[CORS] Blocked request', {
            origin,
            method: req?.method,
            path: req?.originalUrl,
            allowed: process.env.CORS_ORIGIN || '(not set)',
        });
        return res.status(403).json({ error: 'CORS blocked' });
    }
    console.error('[App] Unhandled error:', err);
    return res.status(500).json({ error: safeErrorMessage(err) });
});

server.on('error', (error) => {
    if (error?.code === 'EADDRINUSE' || error?.code === 'EPERM') {
        console.error(`[App] Failed to bind ${HOST}:${PORT} (${error.code}).`);
        console.error('[App] Try freeing the port or running with PORT=<free_port> npm run dev');
    } else {
        console.error('[App] Server error:', error);
        captureException(error);
    }
    process.exit(1);
});

async function startServer() {
    try {
        // Initialize court services (WebSocket, SessionManager, DB recovery)
        await initializeCourtServices(server);
    } catch (error) {
        console.error('[App] Court services initialization failed:', error);
        captureException(error);
        process.exit(1);
    }

    server.listen(PORT, HOST, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Supabase configured: ${isSupabaseConfigured()}`);
        console.log('WebSocket server initialized');
        console.log(
            `[MemoryWorker] Runtime config: queueOnly=${memoryRuntimeConfig.queueOnlyMode}, embedded=${memoryRuntimeConfig.embeddedWorkerEnabled}, external=${memoryRuntimeConfig.externalWorkerExpected}, pollIntervalMs=${memoryRuntimeConfig.pollIntervalMs}`
        );

        if (memoryRuntimeConfig.embeddedWorkerEnabled) {
            startEmbeddedMemoryWorker(memoryRuntimeConfig.pollIntervalMs);
        } else if (memoryRuntimeConfig.queueOnlyMode && memoryRuntimeConfig.externalWorkerExpected) {
            console.log('[MemoryWorker] Queue-only mode active. External memory worker is expected.');
        }
    });
}

startServer();
