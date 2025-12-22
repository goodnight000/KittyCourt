const cors = require('cors');

function parseCsv(value) {
    if (!value || typeof value !== 'string') return [];
    return value
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
}

function getAllowedOrigins() {
    const envOrigins = parseCsv(process.env.CORS_ORIGIN);

    // In production, fail closed unless explicitly configured.
    if (process.env.NODE_ENV === 'production') {
        return envOrigins;
    }

    // In development, allow everything by default to keep local workflows easy.
    if (envOrigins.length === 0) return ['*'];
    return envOrigins;
}

function createCorsOptions() {
    const allowedOrigins = getAllowedOrigins();

    // Wildcard in dev.
    if (allowedOrigins.includes('*')) {
        return {
            origin: '*',
            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization'],
            maxAge: 600,
        };
    }

    // Explicit allowlist.
    return {
        origin(origin, callback) {
            // Non-browser requests (no Origin header).
            if (!origin) return callback(null, true);
            if (allowedOrigins.includes(origin)) return callback(null, true);
            return callback(new Error('CORS blocked'), false);
        },
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        maxAge: 600,
    };
}

function createSocketCorsOptions() {
    const allowedOrigins = getAllowedOrigins();
    if (allowedOrigins.includes('*')) {
        return { origin: '*', methods: ['GET', 'POST'] };
    }
    return { origin: allowedOrigins, methods: ['GET', 'POST'] };
}

function securityHeaders(req, res, next) {
    // Basic hardening (helmet-lite) for an API server.
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');

    // Content Security Policy - defense in depth against XSS
    // Note: 'unsafe-inline' for styles is needed for React's inline styling
    const cspDirectives = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https:",
        "font-src 'self' https://fonts.gstatic.com",
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openai.com",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
    ].join('; ');
    res.setHeader('Content-Security-Policy', cspDirectives);

    next();
}

function corsMiddleware() {
    const options = createCorsOptions();
    return cors(options);
}

module.exports = {
    createCorsOptions,
    createSocketCorsOptions,
    securityHeaders,
    corsMiddleware,
    getAllowedOrigins,
};

