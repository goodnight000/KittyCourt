-- ============================================
-- MIGRATION: Guard daily question memory extraction
-- ============================================
-- Adds a timestamp marker to avoid duplicate extraction runs
-- when both partners submit simultaneously.
-- ============================================

ALTER TABLE couple_question_assignments
ADD COLUMN IF NOT EXISTS memory_extracted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_cqa_memory_extracted_at
    ON couple_question_assignments(id, memory_extracted_at);

-- ============================================
-- DONE
-- ============================================
