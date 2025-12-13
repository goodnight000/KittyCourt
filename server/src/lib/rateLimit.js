function createRateLimiter({ windowMs, max, keyGenerator }) {
    if (!Number.isFinite(windowMs) || windowMs <= 0) throw new Error('windowMs must be > 0');
    if (!Number.isFinite(max) || max <= 0) throw new Error('max must be > 0');

    const hits = new Map(); // key -> { count, resetAt }

    const getKey = keyGenerator || ((req) => req.ip || 'unknown');

    return function rateLimit(req, res, next) {
        const now = Date.now();
        const key = String(getKey(req) || 'unknown');

        const current = hits.get(key);
        if (!current || now >= current.resetAt) {
            hits.set(key, { count: 1, resetAt: now + windowMs });
            res.setHeader('X-RateLimit-Limit', String(max));
            res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - 1)));
            res.setHeader('X-RateLimit-Reset', String(Math.ceil((now + windowMs) / 1000)));
            return next();
        }

        current.count += 1;
        res.setHeader('X-RateLimit-Limit', String(max));
        res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - current.count)));
        res.setHeader('X-RateLimit-Reset', String(Math.ceil(current.resetAt / 1000)));

        if (current.count > max) {
            res.status(429).json({ error: 'Too many requests' });
            return;
        }

        return next();
    };
}

module.exports = { createRateLimiter };

