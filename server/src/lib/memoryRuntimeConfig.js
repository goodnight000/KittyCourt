const DEFAULT_MEMORY_JOBS_POLL_INTERVAL_MS = 1000;

const TRUTHY_ENV_VALUES = new Set(['1', 'true', 'yes', 'on', 'enabled']);

function pickFirstDefined(values = []) {
    for (const value of values) {
        if (value !== undefined && value !== null) {
            return value;
        }
    }

    return undefined;
}

function parseBooleanEnv(value, defaultValue = false) {
    if (value === undefined || value === null) {
        return defaultValue;
    }

    if (typeof value === 'boolean') {
        return value;
    }

    const normalized = String(value).trim().toLowerCase();
    if (normalized.length === 0) {
        return defaultValue;
    }

    return TRUTHY_ENV_VALUES.has(normalized);
}

function parsePositiveInteger(value, fallback) {
    const parsed = Number.parseInt(String(value || ''), 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        return fallback;
    }

    return parsed;
}

function parseMemoryRuntimeConfig(env = process.env) {
    const sourceEnv = env && typeof env === 'object' ? env : {};
    const embeddedWorkerEnabledValue = pickFirstDefined([
        sourceEnv.MEMORY_JOBS_WORKER_ENABLED,
        sourceEnv.MEMORY_JOBS_WORKER_EMBEDDED,
        sourceEnv.MEMORY_JOBS_EMBEDDED_WORKER,
        sourceEnv.MEMORY_EMBEDDED_WORKER_ENABLED,
    ]);
    const externalWorkerExpectedValue = pickFirstDefined([
        sourceEnv.MEMORY_JOBS_WORKER_EXTERNAL,
        sourceEnv.MEMORY_JOBS_WORKER_EXPECTED,
        sourceEnv.MEMORY_JOBS_EXTERNAL_WORKER,
        sourceEnv.MEMORY_EXTERNAL_WORKER_EXPECTED,
    ]);
    const pollIntervalMsValue = pickFirstDefined([
        sourceEnv.MEMORY_JOBS_POLL_INTERVAL_MS,
        sourceEnv.MEMORY_JOBS_WORKER_POLL_INTERVAL_MS,
    ]);

    return {
        queueOnlyMode: parseBooleanEnv(sourceEnv.MEMORY_QUEUE_ONLY, true),
        embeddedWorkerEnabled: parseBooleanEnv(embeddedWorkerEnabledValue, false),
        externalWorkerExpected: parseBooleanEnv(externalWorkerExpectedValue, true),
        pollIntervalMs: parsePositiveInteger(pollIntervalMsValue, DEFAULT_MEMORY_JOBS_POLL_INTERVAL_MS),
    };
}

function validateMemoryRuntimeConfig(config, options = {}) {
    const runtimeConfig = config && typeof config === 'object' ? config : {};
    const errors = [];

    const queueOnlyMode = !!runtimeConfig.queueOnlyMode;
    const embeddedWorkerEnabled = !!runtimeConfig.embeddedWorkerEnabled;
    const externalWorkerExpected = !!runtimeConfig.externalWorkerExpected;
    const pollIntervalMs = runtimeConfig.pollIntervalMs;
    const supabaseConfigured = options.supabaseConfigured;

    if (!Number.isInteger(pollIntervalMs) || pollIntervalMs <= 0) {
        errors.push('pollIntervalMs must be a positive integer.');
    }

    if (queueOnlyMode && !embeddedWorkerEnabled && !externalWorkerExpected) {
        errors.push('Queue-only mode requires an embedded worker or an expected external worker.');
    }

    if (embeddedWorkerEnabled && !queueOnlyMode) {
        errors.push('Embedded worker mode is only valid when queue-only mode is enabled.');
    }

    if (externalWorkerExpected && !queueOnlyMode) {
        errors.push('External worker expectation is only valid when queue-only mode is enabled.');
    }

    if (embeddedWorkerEnabled && supabaseConfigured === false) {
        errors.push('Embedded worker mode requires Supabase to be configured.');
    }

    return errors;
}

function assertMemoryRuntimeConfig({ env, supabaseConfigured } = {}) {
    const config = parseMemoryRuntimeConfig(env);
    const errors = validateMemoryRuntimeConfig(config, { supabaseConfigured });

    if (errors.length > 0) {
        const details = errors.map((error) => `- ${error}`).join('\n');
        throw new Error(`Invalid memory runtime config:\n${details}`);
    }

    return config;
}

module.exports = {
    DEFAULT_MEMORY_JOBS_POLL_INTERVAL_MS,
    parseMemoryRuntimeConfig,
    validateMemoryRuntimeConfig,
    assertMemoryRuntimeConfig,
};
