const DEFAULT_WEIGHTS = Object.freeze({
    velocity: 15,
    failures: 15,
    networkSpread: 10,
    ipReputation: 15,
    accountAge: 10,
    payloadAnomaly: 10,
    deviceRisk: 10,
    geoVelocity: 5,
    disposableEmail: 5,
    priorAbuse: 5,
});

const DEFAULT_LEVEL_THRESHOLDS = Object.freeze({
    medium: 30,
    high: 55,
    critical: 80,
});

function toFiniteNumber(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp01(value) {
    const numeric = toFiniteNumber(value);
    if (numeric < 0) return 0;
    if (numeric > 1) return 1;
    return numeric;
}

function round(value, decimals = 3) {
    const multiplier = 10 ** decimals;
    return Math.round(value * multiplier) / multiplier;
}

function resolveLevel(score, thresholds) {
    if (score >= thresholds.critical) return 'critical';
    if (score >= thresholds.high) return 'high';
    if (score >= thresholds.medium) return 'medium';
    return 'low';
}

function scoreRisk(signals = {}, options = {}) {
    const weights = {
        ...DEFAULT_WEIGHTS,
        ...(options.weights || {}),
    };

    const levelThresholds = {
        ...DEFAULT_LEVEL_THRESHOLDS,
        ...(options.levelThresholds || {}),
    };

    const normalizedSignals = {};
    const contributors = [];
    let score = 0;

    for (const key of Object.keys(weights)) {
        const weight = toFiniteNumber(weights[key]);
        if (weight <= 0) continue;

        const signalValue = clamp01(signals[key]);
        const contribution = round(signalValue * weight);

        normalizedSignals[key] = signalValue;
        score += contribution;
        contributors.push({
            key,
            weight,
            signal: signalValue,
            contribution,
        });
    }

    contributors.sort((a, b) => {
        if (b.contribution !== a.contribution) {
            return b.contribution - a.contribution;
        }
        return a.key.localeCompare(b.key);
    });

    const roundedScore = round(score);

    return {
        score: roundedScore,
        level: resolveLevel(roundedScore, levelThresholds),
        normalizedSignals,
        contributors,
    };
}

module.exports = {
    DEFAULT_WEIGHTS,
    DEFAULT_LEVEL_THRESHOLDS,
    scoreRisk,
};
