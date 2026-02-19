ALTER TABLE insights
    ADD COLUMN IF NOT EXISTS memory_signal NUMERIC(4,3) DEFAULT 0.5,
    ADD COLUMN IF NOT EXISTS significance_score NUMERIC(4,3);

UPDATE insights
SET memory_signal = COALESCE(memory_signal, 0.5)
WHERE memory_signal IS NULL;

UPDATE insights
SET significance_score = LEAST(1, GREATEST(0,
    (0.5 * COALESCE(confidence_score, 0.6)) +
    (0.3 * COALESCE(memory_signal, 0.5)) +
    (0.2 * ((COALESCE(helpful_count, 0) + 1.0) / (COALESCE(helpful_count, 0) + COALESCE(not_helpful_count, 0) + 2.0)))
))
WHERE significance_score IS NULL;

CREATE INDEX IF NOT EXISTS idx_insights_significance
    ON insights(recipient_user_id, user_a_id, user_b_id, is_active, generated_at, significance_score DESC);
