const { isSupabaseConfigured, getSupabase } = require('./supabase');
const { isOpenRouterConfigured } = require('./openrouter');

const DEFAULT_CHECK_TIMEOUT_MS = Number(process.env.HEALTHCHECK_TIMEOUT_MS || 1500);
const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';

async function withTimeout(taskFactory, timeoutMs = DEFAULT_CHECK_TIMEOUT_MS) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timerId = controller
        ? setTimeout(() => controller.abort(), timeoutMs)
        : null;

    try {
        const result = await taskFactory(controller?.signal);
        return { timedOut: false, result };
    } catch (error) {
        if (error?.name === 'AbortError') {
            return {
                timedOut: true,
                error: new Error(`Health check timed out after ${timeoutMs}ms`),
            };
        }
        return { timedOut: false, error };
    } finally {
        if (timerId) clearTimeout(timerId);
    }
}

async function checkSupabaseReadiness({ timeoutMs = DEFAULT_CHECK_TIMEOUT_MS, deps = {} } = {}) {
    const supabaseConfigured = (deps.isSupabaseConfigured || isSupabaseConfigured)();
    if (!supabaseConfigured) {
        return {
            name: 'supabase',
            critical: true,
            status: 'unconfigured',
            message: 'Supabase is not configured',
        };
    }

    const supabaseClient = (deps.getSupabase || getSupabase)();
    const startedAt = Date.now();

    const { timedOut, error } = await withTimeout(async () => {
        const { error: queryError } = await supabaseClient
            .from('profiles')
            .select('id')
            .limit(1);

        if (queryError) throw queryError;
    }, timeoutMs);

    if (timedOut) {
        return {
            name: 'supabase',
            critical: true,
            status: 'down',
            latencyMs: Date.now() - startedAt,
            message: 'Supabase health check timed out',
        };
    }

    if (error) {
        return {
            name: 'supabase',
            critical: true,
            status: 'down',
            latencyMs: Date.now() - startedAt,
            message: `Supabase check failed: ${error.message || 'unknown error'}`,
        };
    }

    return {
        name: 'supabase',
        critical: true,
        status: 'ready',
        latencyMs: Date.now() - startedAt,
    };
}

async function checkOpenRouterReadiness({ timeoutMs = DEFAULT_CHECK_TIMEOUT_MS, deps = {} } = {}) {
    const openRouterConfigured = (deps.isOpenRouterConfigured || isOpenRouterConfigured)();
    if (!openRouterConfigured) {
        return {
            name: 'openrouter',
            critical: false,
            status: 'unconfigured',
            message: 'OpenRouter is not configured',
        };
    }

    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterKey) {
        return {
            name: 'openrouter',
            critical: false,
            status: 'unconfigured',
            message: 'OpenRouter API key is missing',
        };
    }

    const startedAt = Date.now();
    const fetchFn = deps.fetchFn || fetch;

    const { timedOut, error, result } = await withTimeout(async (signal) => {
        return fetchFn(OPENROUTER_MODELS_URL, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${openRouterKey}`,
            },
            signal,
        });
    }, timeoutMs);

    if (timedOut) {
        return {
            name: 'openrouter',
            critical: false,
            status: 'down',
            latencyMs: Date.now() - startedAt,
            message: 'OpenRouter health check timed out',
        };
    }

    if (error) {
        return {
            name: 'openrouter',
            critical: false,
            status: 'down',
            latencyMs: Date.now() - startedAt,
            message: `OpenRouter check failed: ${error.message || 'unknown error'}`,
        };
    }

    if (!result?.ok) {
        return {
            name: 'openrouter',
            critical: false,
            status: result?.status >= 500 ? 'down' : 'degraded',
            latencyMs: Date.now() - startedAt,
            httpStatus: result?.status || null,
            message: `OpenRouter responded with ${result?.status || 'unknown status'}`,
        };
    }

    return {
        name: 'openrouter',
        critical: false,
        status: 'ready',
        latencyMs: Date.now() - startedAt,
    };
}

function checkMemoryWorkerReadiness({ memoryRuntimeConfig } = {}) {
    if (!memoryRuntimeConfig) {
        return {
            name: 'memory_worker',
            critical: false,
            status: 'unknown',
            message: 'Memory worker runtime config unavailable',
        };
    }

    if (memoryRuntimeConfig.embeddedWorkerEnabled) {
        return {
            name: 'memory_worker',
            critical: false,
            status: 'ready',
            mode: 'embedded',
            pollIntervalMs: memoryRuntimeConfig.pollIntervalMs,
        };
    }

    if (memoryRuntimeConfig.queueOnlyMode && memoryRuntimeConfig.externalWorkerExpected) {
        return {
            name: 'memory_worker',
            critical: false,
            status: 'ready',
            mode: 'external_expected',
            message: 'Queue-only mode with external memory worker expected',
            pollIntervalMs: memoryRuntimeConfig.pollIntervalMs,
        };
    }

    if (memoryRuntimeConfig.queueOnlyMode) {
        return {
            name: 'memory_worker',
            critical: false,
            status: 'ready',
            mode: 'queue_only',
            message: 'Queue-only mode enabled',
            pollIntervalMs: memoryRuntimeConfig.pollIntervalMs,
        };
    }

    return {
        name: 'memory_worker',
        critical: false,
        status: 'ready',
        mode: 'inactive',
    };
}

function deriveOverallStatus(checks) {
    const values = Object.values(checks || {});
    const isCriticalFailure = (check) => (
        !!check?.critical && (check.status === 'down' || check.status === 'unconfigured')
    );
    if (values.some(isCriticalFailure)) {
        return { status: 'down', httpStatus: 503 };
    }

    const isDegradedState = (check) => {
        if (!check) return false;
        // Optional services can be disabled/unconfigured intentionally.
        if (!check.critical && (check.status === 'disabled' || check.status === 'unconfigured')) {
            return false;
        }
        return check.status === 'degraded' || check.status === 'down';
    };

    if (values.some(isDegradedState)) {
        return { status: 'degraded', httpStatus: 200 };
    }

    return { status: 'ok', httpStatus: 200 };
}

async function buildHealthSnapshot({ memoryRuntimeConfig, deps = {} } = {}) {
    const [supabaseCheck, openRouterCheck] = await Promise.all([
        checkSupabaseReadiness({ deps }),
        checkOpenRouterReadiness({ deps }),
    ]);

    const memoryWorkerCheck = checkMemoryWorkerReadiness({ memoryRuntimeConfig });

    const dependencies = {
        app: {
            name: 'app',
            critical: true,
            status: 'ready',
            message: 'Express server is running',
        },
        supabase: supabaseCheck,
        openrouter: openRouterCheck,
        memory_worker: memoryWorkerCheck,
    };

    const overall = deriveOverallStatus(dependencies);

    return {
        status: overall.status,
        httpStatus: overall.httpStatus,
        timestamp: new Date().toISOString(),
        dependencies,
    };
}

module.exports = {
    checkSupabaseReadiness,
    checkOpenRouterReadiness,
    checkMemoryWorkerReadiness,
    deriveOverallStatus,
    buildHealthSnapshot,
};
