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
const { isOpenRouterConfigured } = require('./lib/openrouter');
const { corsMiddleware, securityHeaders } = require('./lib/security');

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
    max: 20,
    keyGenerator: (req) => req.headers.authorization || req.ip || 'unknown',
});

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(securityHeaders);

// Initialize court services (WebSocket, SessionManager, DB recovery)
initializeCourtServices(server).catch(err => {
    console.error('[App] Court services initialization failed:', err);
});

app.use(corsMiddleware());
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '256kb' }));
app.use(express.urlencoded({ extended: false, limit: process.env.JSON_BODY_LIMIT || '256kb' }));

const isProd = process.env.NODE_ENV === 'production';
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

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        supabase: isSupabaseConfigured(),
        openrouter: isOpenRouterConfigured(),
        timestamp: new Date().toISOString()
    });
});

// Centralized error handling (CORS + unexpected errors)
app.use((err, req, res, _next) => {
    if (err?.message === 'CORS blocked') {
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
    }
    process.exit(1);
});

server.listen(PORT, HOST, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Supabase configured: ${isSupabaseConfigured()}`);
    console.log(`WebSocket server initialized`);
});
