-- ============================================
-- MIGRATION: Add verdict_acceptances and resolved_at to court_sessions
-- ============================================
-- This adds columns needed for the verdict acceptance flow

-- Add verdict_acceptances JSONB column to track which users have accepted the verdict
ALTER TABLE court_sessions 
ADD COLUMN IF NOT EXISTS verdict_acceptances JSONB DEFAULT '{"creator": false, "partner": false}'::jsonb;

-- Add resolved_at timestamp to track when the verdict was generated
ALTER TABLE court_sessions 
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

COMMENT ON COLUMN court_sessions.verdict_acceptances IS 'Tracks which users have accepted the verdict. When both are true, the session is closed.';
COMMENT ON COLUMN court_sessions.resolved_at IS 'Timestamp when the verdict was generated and the case was resolved.';
