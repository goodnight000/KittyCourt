-- ============================================
-- MIGRATION: Add per-user verdict ratings
-- ============================================
-- Stores a 1–5 rating for each partner on the verdict row.

ALTER TABLE verdicts
ADD COLUMN IF NOT EXISTS rating_user_a INT;

ALTER TABLE verdicts
ADD COLUMN IF NOT EXISTS rating_user_b INT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'verdicts_rating_user_a_check'
    ) THEN
        ALTER TABLE verdicts
        ADD CONSTRAINT verdicts_rating_user_a_check
        CHECK (rating_user_a IS NULL OR (rating_user_a >= 1 AND rating_user_a <= 5));
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'verdicts_rating_user_b_check'
    ) THEN
        ALTER TABLE verdicts
        ADD CONSTRAINT verdicts_rating_user_b_check
        CHECK (rating_user_b IS NULL OR (rating_user_b >= 1 AND rating_user_b <= 5));
    END IF;
END $$;

COMMENT ON COLUMN verdicts.rating_user_a IS 'User A rating for this verdict (1-5). Null if not rated.';
COMMENT ON COLUMN verdicts.rating_user_b IS 'User B rating for this verdict (1-5). Null if not rated.';
