/**
 * Insight scoring helpers.
 */

const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const clampUnit = (value) => Math.min(1, Math.max(0, value));

const getHelpfulnessScore = (helpfulCount, notHelpfulCount) => {
    const helpful = Math.max(0, toNumber(helpfulCount, 0));
    const notHelpful = Math.max(0, toNumber(notHelpfulCount, 0));
    return (helpful + 1) / (helpful + notHelpful + 2);
};

const calculateSignificanceScore = ({
    confidenceScore,
    memorySignal,
    helpfulCount = 0,
    notHelpfulCount = 0,
}) => {
    const confidence = clampUnit(toNumber(confidenceScore, 0.6));
    const memory = clampUnit(toNumber(memorySignal, 0.5));
    const helpfulness = getHelpfulnessScore(helpfulCount, notHelpfulCount);
    const rawScore = (0.5 * confidence) + (0.3 * memory) + (0.2 * helpfulness);
    return clampUnit(rawScore);
};

module.exports = {
    calculateSignificanceScore,
};
