-- ============================================
-- Add judge_type column to court_sessions
-- ============================================
-- Allows users to select which LLM judge to use for verdict generation.
-- Values: 'best' (Opus 4.5), 'fast' (DeepSeek), 'logical' (Kimi K2)
-- Default: 'logical'
-- ============================================

ALTER TABLE court_sessions 
ADD COLUMN IF NOT EXISTS judge_type TEXT DEFAULT 'logical';

-- Add comment for documentation
COMMENT ON COLUMN court_sessions.judge_type IS 'Selected judge type: best, fast, or logical';
