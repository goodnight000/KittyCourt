-- ============================================
-- MIGRATION: Fix Duplicate Questions
-- ============================================
-- Problem: question_bank had no UNIQUE constraint on question column,
-- so ON CONFLICT DO NOTHING didn't prevent duplicates.
-- This migration removes duplicates and adds the constraint.
--
-- Note: question_bank_translations has ON DELETE CASCADE, so
-- translations are automatically deleted when questions are deleted.
-- ============================================

-- ============================================
-- STEP 1: Remove duplicate questions (keep lowest ID for each unique question)
-- ============================================
-- This uses a CTE to identify which IDs to keep (the minimum ID for each question text)
-- Then deletes all other rows
WITH keep_ids AS (
    SELECT MIN(id) as id
    FROM question_bank
    GROUP BY question
)
DELETE FROM question_bank
WHERE id NOT IN (SELECT id FROM keep_ids);

-- Translations are automatically cleaned up via ON DELETE CASCADE

-- ============================================
-- STEP 2: Add UNIQUE constraint to prevent future duplicates
-- ============================================
ALTER TABLE question_bank
ADD CONSTRAINT question_bank_question_unique UNIQUE (question);

-- ============================================
-- VERIFICATION (run manually):
-- ============================================
-- SELECT
--     'question_bank' as table_name,
--     COUNT(*) as total_rows
-- FROM question_bank
-- UNION ALL
-- SELECT
--     'question_bank_translations',
--     COUNT(*)
-- FROM question_bank_translations;

-- ============================================
-- DONE!
-- ============================================
