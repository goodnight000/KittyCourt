ALTER TABLE insights
    ADD COLUMN IF NOT EXISTS recipient_user_id UUID;

CREATE INDEX IF NOT EXISTS idx_insights_recipient
    ON insights(recipient_user_id, is_active, generated_at);

INSERT INTO insights (
    user_a_id,
    user_b_id,
    recipient_user_id,
    category,
    insight_text,
    evidence_summary,
    confidence_score,
    helpful_count,
    not_helpful_count,
    generated_at,
    expires_at,
    is_active
)
SELECT
    user_a_id,
    user_b_id,
    user_a_id,
    category,
    insight_text,
    evidence_summary,
    confidence_score,
    helpful_count,
    not_helpful_count,
    generated_at,
    expires_at,
    is_active
FROM insights
WHERE recipient_user_id IS NULL;

INSERT INTO insights (
    user_a_id,
    user_b_id,
    recipient_user_id,
    category,
    insight_text,
    evidence_summary,
    confidence_score,
    helpful_count,
    not_helpful_count,
    generated_at,
    expires_at,
    is_active
)
SELECT
    user_a_id,
    user_b_id,
    user_b_id,
    category,
    insight_text,
    evidence_summary,
    confidence_score,
    helpful_count,
    not_helpful_count,
    generated_at,
    expires_at,
    is_active
FROM insights
WHERE recipient_user_id IS NULL;

UPDATE insights
SET is_active = FALSE
WHERE recipient_user_id IS NULL;

DROP POLICY IF EXISTS "Consented couples can view insights" ON insights;

CREATE POLICY "Users can view own insights"
ON insights FOR SELECT
USING (
    auth.uid() = recipient_user_id
    AND EXISTS (
        SELECT 1
        FROM profiles p
        WHERE p.id = auth.uid()
          AND p.ai_insights_consent = TRUE
          AND (p.ai_insights_paused_until IS NULL OR p.ai_insights_paused_until < NOW())
    )
);
