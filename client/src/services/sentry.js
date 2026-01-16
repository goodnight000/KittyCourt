import { Capacitor } from '@capacitor/core';
import * as Sentry from '@sentry/capacitor';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const SENTRY_ENVIRONMENT = import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE;
const SENTRY_RELEASE = import.meta.env.VITE_SENTRY_RELEASE;

const parseSampleRate = (value, fallback) => {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return fallback;
    return Math.min(Math.max(parsed, 0), 1);
};

const getTraceTargets = () => {
    const targets = ['localhost', /^\//];
    const apiUrl = import.meta.env.VITE_API_URL;
    if (!apiUrl) return targets;
    try {
        const url = new URL(apiUrl);
        targets.push(url.origin);
    } catch (_error) {
        targets.push(apiUrl);
    }
    return targets;
};

let isInitialized = false;

export const initSentry = () => {
    if (!SENTRY_DSN) {
        return false;
    }
    if (isInitialized) return true;

    const tracesSampleRate = parseSampleRate(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE, 0.1);
    const integrations = [];
    if (typeof Sentry.browserTracingIntegration === 'function') {
        integrations.push(
            Sentry.browserTracingIntegration({
                tracePropagationTargets: getTraceTargets(),
            })
        );
    }

    Sentry.init({
        dsn: SENTRY_DSN,
        environment: SENTRY_ENVIRONMENT,
        release: SENTRY_RELEASE,
        enableNative: Capacitor.isNativePlatform(),
        integrations,
        tracesSampleRate,
    });

    Sentry.setTag('platform', Capacitor.getPlatform());
    isInitialized = true;
    return true;
};

export const captureException = (error, context) => {
    if (!SENTRY_DSN) return;
    Sentry.captureException(error, context);
};

export const captureMessage = (message, level = 'info') => {
    if (!SENTRY_DSN) return;
    Sentry.captureMessage(message, level);
};
