const {
    TOKENS_PER_MILLION,
    MODEL_PRICING_USD_PER_1M_TOKENS,
    DEFAULT_MODEL_PRICING,
} = require('./config');

function toNonNegativeInteger(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return 0;
    }

    return Math.floor(parsed);
}

function pickUsageField(usage, keys) {
    for (const key of keys) {
        if (usage[key] !== undefined && usage[key] !== null) {
            return usage[key];
        }
    }
    return 0;
}

function parseUsage(usage) {
    const safeUsage = usage && typeof usage === 'object' ? usage : {};

    const inputTokens = toNonNegativeInteger(pickUsageField(safeUsage, [
        'input_tokens',
        'prompt_tokens',
        'inputTokens',
        'promptTokens',
    ]));

    const outputTokens = toNonNegativeInteger(pickUsageField(safeUsage, [
        'output_tokens',
        'completion_tokens',
        'outputTokens',
        'completionTokens',
    ]));

    let totalTokens = toNonNegativeInteger(pickUsageField(safeUsage, [
        'total_tokens',
        'totalTokens',
    ]));

    if (totalTokens === 0 && (inputTokens > 0 || outputTokens > 0)) {
        totalTokens = inputTokens + outputTokens;
    }

    return {
        inputTokens,
        outputTokens,
        totalTokens,
    };
}

function normalizeModelName(model) {
    return String(model || '')
        .trim()
        .toLowerCase()
        .replace(/:free$/, '');
}

function resolveModelPricing(model) {
    const normalizedModel = normalizeModelName(model);

    if (MODEL_PRICING_USD_PER_1M_TOKENS[normalizedModel]) {
        return MODEL_PRICING_USD_PER_1M_TOKENS[normalizedModel];
    }

    const providerAgnosticModel = normalizedModel.includes('/')
        ? normalizedModel.split('/').pop()
        : normalizedModel;

    if (MODEL_PRICING_USD_PER_1M_TOKENS[providerAgnosticModel]) {
        return MODEL_PRICING_USD_PER_1M_TOKENS[providerAgnosticModel];
    }

    return DEFAULT_MODEL_PRICING;
}

function estimateCost({ model, usage } = {}) {
    const { inputTokens, outputTokens } = parseUsage(usage);
    const pricing = resolveModelPricing(model);

    const inputCost = (inputTokens / TOKENS_PER_MILLION) * pricing.input;
    const outputCost = (outputTokens / TOKENS_PER_MILLION) * pricing.output;

    return Number((inputCost + outputCost).toFixed(8));
}

function buildUsageTelemetryEvent({
    source = 'unknown',
    provider = 'unknown',
    model = 'unknown',
    usage = {},
    metadata = {},
} = {}) {
    const parsedUsage = parseUsage(usage);

    return {
        source,
        provider,
        model,
        inputTokens: parsedUsage.inputTokens,
        outputTokens: parsedUsage.outputTokens,
        totalTokens: parsedUsage.totalTokens,
        estimatedCostUsd: estimateCost({ model, usage: parsedUsage }),
        rawUsage: usage && typeof usage === 'object' ? usage : {},
        metadata: metadata && typeof metadata === 'object' ? metadata : {},
    };
}

async function emitUsageTelemetry(onTelemetry, telemetryEvent) {
    if (typeof onTelemetry !== 'function') {
        return undefined;
    }

    try {
        return await onTelemetry(telemetryEvent);
    } catch (error) {
        console.warn('[UsageTelemetry] onTelemetry callback failed:', error?.message || error);
        return undefined;
    }
}

module.exports = {
    parseUsage,
    resolveModelPricing,
    estimateCost,
    buildUsageTelemetryEvent,
    emitUsageTelemetry,
};
