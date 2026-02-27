const DEFAULT_ACTION_THRESHOLDS = Object.freeze({
    review: 35,
    challenge: 55,
    block: 80,
});

const DEFAULT_ACTION_TTLS = Object.freeze({
    review: 0,
    challenge: 300,
    block: 900,
});

function toFiniteNumber(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}

function findHardBlockSignal(signals, hardBlockSignals) {
    const signalKeys = Object.keys(hardBlockSignals || {}).sort();

    for (const key of signalKeys) {
        const threshold = toFiniteNumber(hardBlockSignals[key], 1);
        const value = toFiniteNumber((signals || {})[key], 0);
        if (value >= threshold) {
            return key;
        }
    }

    return null;
}

function decideAbuseAction(input = {}, options = {}) {
    const thresholds = {
        ...DEFAULT_ACTION_THRESHOLDS,
        ...(options.thresholds || {}),
    };

    const ttls = {
        ...DEFAULT_ACTION_TTLS,
        ...(options.ttls || {}),
    };

    const score = Math.max(0, Math.min(100, toFiniteNumber(input.score, 0)));
    const signals = input.signals || {};
    const hardBlockKey = findHardBlockSignal(signals, options.hardBlockSignals);

    let action = 'allow';
    let reason = 'score_below_review';

    if (hardBlockKey) {
        action = 'block';
        reason = `hard_block:${hardBlockKey}`;
    } else if (score >= thresholds.block) {
        action = 'block';
        reason = 'score_gte_block';
    } else if (score >= thresholds.challenge) {
        action = 'challenge';
        reason = 'score_gte_challenge';
    } else if (score >= thresholds.review) {
        action = 'review';
        reason = 'score_gte_review';
    }

    return {
        action,
        reason,
        score,
        level: input.level || null,
        signals,
        expiresInSeconds: toFiniteNumber(ttls[action], 0),
        shouldLog: action !== 'allow',
    };
}

module.exports = {
    DEFAULT_ACTION_THRESHOLDS,
    DEFAULT_ACTION_TTLS,
    decideAbuseAction,
};
