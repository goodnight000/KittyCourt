const Sentry = require('@sentry/node');

let Tracing = null;
try {
    Tracing = require('@sentry/tracing');
} catch (_error) {
    Tracing = null;
}

const parseSampleRate = (value, fallback) => {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return fallback;
    return Math.min(Math.max(parsed, 0), 1);
};

const initSentry = (app) => {
    const dsn = process.env.SENTRY_DSN;
    if (!dsn) {
        return false;
    }

    const tracesSampleRate = parseSampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE, 0.1);
    const profilesSampleRate = parseSampleRate(process.env.SENTRY_PROFILES_SAMPLE_RATE, 0);
    const environment = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development';
    const release = process.env.SENTRY_RELEASE;

    const integrations = [];
    if (Sentry.Integrations?.Http) {
        integrations.push(new Sentry.Integrations.Http({ tracing: true }));
    }
    if (Tracing?.Integrations?.Express && app) {
        integrations.push(new Tracing.Integrations.Express({ app }));
    }

    Sentry.init({
        dsn,
        environment,
        release,
        integrations,
        tracesSampleRate,
        profilesSampleRate,
    });

    if (Sentry.Handlers?.requestHandler) {
        app.use(Sentry.Handlers.requestHandler());
    }
    if (Sentry.Handlers?.tracingHandler) {
        app.use(Sentry.Handlers.tracingHandler());
    }

    return true;
};

const setupSentryErrorHandler = (app) => {
    if (!process.env.SENTRY_DSN) return;
    if (typeof Sentry.setupExpressErrorHandler === 'function') {
        Sentry.setupExpressErrorHandler(app);
        return;
    }
    if (Sentry.Handlers?.errorHandler) {
        app.use(Sentry.Handlers.errorHandler());
    }
};

const captureException = (error, context) => {
    if (!process.env.SENTRY_DSN) return;
    Sentry.captureException(error, context);
};

module.exports = {
    initSentry,
    setupSentryErrorHandler,
    captureException,
};
