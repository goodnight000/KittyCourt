-- Migration: Add needs fields to court_sessions and cases
-- Purpose: Support "unmet needs" field in evidence submission (NVC principles)

-- Add needs fields to court_sessions (real-time session)
ALTER TABLE court_sessions
ADD COLUMN IF NOT EXISTS user_a_needs TEXT;

ALTER TABLE court_sessions
ADD COLUMN IF NOT EXISTS user_b_needs TEXT;

-- Add needs fields to cases (permanent storage for history)
ALTER TABLE cases
ADD COLUMN IF NOT EXISTS user_a_needs TEXT DEFAULT '';

ALTER TABLE cases
ADD COLUMN IF NOT EXISTS user_b_needs TEXT DEFAULT '';

-- Add comments for documentation
COMMENT ON COLUMN court_sessions.user_a_needs IS 'User A unmet needs during evidence phase';
COMMENT ON COLUMN court_sessions.user_b_needs IS 'User B unmet needs during evidence phase';
COMMENT ON COLUMN cases.user_a_needs IS 'User A unmet needs (persisted from session)';
COMMENT ON COLUMN cases.user_b_needs IS 'User B unmet needs (persisted from session)';
