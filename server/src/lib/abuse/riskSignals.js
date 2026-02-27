const DEFAULT_SIGNAL_LIMITS = Object.freeze({
    attemptsPerMinute: 30,
    failedAttempts: 10,
    distinctAccountsPerIp: 5,
    accountAgeHours: 24 * 7,
    priorAbuseEvents: 5,
    ipReputationScore: 100,
});

function toFiniteNumber(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value, min, max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

function normalizeRatio(value, max) {
    if (!Number.isFinite(max) || max <= 0) return 0;
    return clamp(toFiniteNumber(value) / max, 0, 1);
}

function toRiskFlag(value) {
    if (typeof value === 'boolean') return value ? 1 : 0;
    return clamp(toFiniteNumber(value), 0, 1);
}

function buildRiskSignals(input = {}, options = {}) {
    const limits = {
        ...DEFAULT_SIGNAL_LIMITS,
        ...(options.limits || {}),
    };

    const velocity = input.velocity !== undefined
        ? input.velocity
        : normalizeRatio(input.attemptsPerMinute, limits.attemptsPerMinute);

    const failures = input.failures !== undefined
        ? input.failures
        : normalizeRatio(input.failedAttempts, limits.failedAttempts);

    const networkSpread = input.networkSpread !== undefined
        ? input.networkSpread
        : normalizeRatio(input.distinctAccountsPerIp, limits.distinctAccountsPerIp);

    const ipReputation = input.ipReputation !== undefined
        ? input.ipReputation
        : (
            input.ipReputationScore !== undefined
                ? 1 - normalizeRatio(input.ipReputationScore, limits.ipReputationScore)
                : 0
        );

    const accountAge = input.accountAge !== undefined
        ? input.accountAge
        : (
            input.accountAgeHours !== undefined
                ? 1 - normalizeRatio(input.accountAgeHours, limits.accountAgeHours)
                : 0
        );

    const priorAbuse = input.priorAbuse !== undefined
        ? input.priorAbuse
        : normalizeRatio(input.priorAbuseEvents, limits.priorAbuseEvents);

    return {
        velocity: clamp(toFiniteNumber(velocity), 0, 1),
        failures: clamp(toFiniteNumber(failures), 0, 1),
        networkSpread: clamp(toFiniteNumber(networkSpread), 0, 1),
        ipReputation: clamp(toFiniteNumber(ipReputation), 0, 1),
        accountAge: clamp(toFiniteNumber(accountAge), 0, 1),
        payloadAnomaly: clamp(toFiniteNumber(input.payloadAnomaly), 0, 1),
        deviceRisk: clamp(toFiniteNumber(input.deviceRisk), 0, 1),
        geoVelocity: clamp(toFiniteNumber(
            input.geoVelocity !== undefined ? input.geoVelocity : input.geoVelocityRisk
        ), 0, 1),
        disposableEmail: toRiskFlag(
            input.disposableEmailRisk !== undefined
                ? input.disposableEmailRisk
                : input.disposableEmail
        ),
        priorAbuse: clamp(toFiniteNumber(priorAbuse), 0, 1),
    };
}

function mergeRiskSignals(...signalSets) {
    const keys = [...new Set(signalSets.flatMap((set) => Object.keys(set || {})))].sort();
    const merged = {};

    for (const key of keys) {
        let highest = 0;
        for (const set of signalSets) {
            if (!set || !(key in set)) continue;
            const current = clamp(toFiniteNumber(set[key]), 0, 1);
            if (current > highest) {
                highest = current;
            }
        }
        merged[key] = highest;
    }

    return merged;
}

module.exports = {
    DEFAULT_SIGNAL_LIMITS,
    buildRiskSignals,
    mergeRiskSignals,
    clamp,
};
