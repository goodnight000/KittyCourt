-- ============================================
-- MIGRATION: Daily Answers Multi-Mood Support
-- ============================================
-- Adds `moods` to support selecting up to 3 moods per answer.
-- Keeps legacy `mood` as the primary/first mood for backward compatibility.

ALTER TABLE daily_answers
ADD COLUMN IF NOT EXISTS moods TEXT[];

-- Backfill moods from legacy mood (if present and moods is NULL)
UPDATE daily_answers
SET moods = ARRAY[mood]
WHERE moods IS NULL
  AND mood IS NOT NULL
  AND LENGTH(TRIM(mood)) > 0;

