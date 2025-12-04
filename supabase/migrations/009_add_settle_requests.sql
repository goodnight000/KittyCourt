-- ============================================
-- MIGRATION: Add settle_requests to court_sessions
-- ============================================
-- This adds the ability for couples to "settle out of court"
-- before a verdict is rendered.

-- Add settle_requests JSONB column to track which users requested settlement
ALTER TABLE court_sessions 
ADD COLUMN IF NOT EXISTS settle_requests JSONB DEFAULT '{"creator": false, "partner": false}'::jsonb;

-- Add SETTLED status as a valid option
-- (The status column is TEXT so no constraint update needed)

COMMENT ON COLUMN court_sessions.settle_requests IS 'Tracks which users have requested to settle out of court. When both are true, case is dismissed without saving.';
