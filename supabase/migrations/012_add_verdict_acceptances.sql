-- ============================================
-- MIGRATION: Add missing columns to court_sessions
-- ============================================
-- This adds all the columns needed for the full court session flow

-- Partner tracking
ALTER TABLE court_sessions 
ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES profiles(id);

ALTER TABLE court_sessions 
ADD COLUMN IF NOT EXISTS creator_joined BOOLEAN DEFAULT FALSE;

ALTER TABLE court_sessions 
ADD COLUMN IF NOT EXISTS partner_joined BOOLEAN DEFAULT FALSE;

-- Evidence submission storage
ALTER TABLE court_sessions 
ADD COLUMN IF NOT EXISTS evidence_submissions JSONB DEFAULT '{"creator": {"submitted": false, "evidence": "", "feelings": ""}, "partner": {"submitted": false, "evidence": "", "feelings": ""}}'::jsonb;

-- Settlement tracking
ALTER TABLE court_sessions 
ADD COLUMN IF NOT EXISTS settle_requests JSONB DEFAULT '{"creator": false, "partner": false}'::jsonb;

-- Verdict acceptance tracking
ALTER TABLE court_sessions 
ADD COLUMN IF NOT EXISTS verdict_acceptances JSONB DEFAULT '{"creator": false, "partner": false}'::jsonb;

-- Verdict storage (optional, for persistence)
ALTER TABLE court_sessions 
ADD COLUMN IF NOT EXISTS verdict JSONB;

-- Rating
ALTER TABLE court_sessions 
ADD COLUMN IF NOT EXISTS verdict_rating INT;

-- Timestamp for when verdict was generated
ALTER TABLE court_sessions 
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- Comments
COMMENT ON COLUMN court_sessions.partner_id IS 'The partner who was served (invited to court)';
COMMENT ON COLUMN court_sessions.creator_joined IS 'Whether the session creator has joined';
COMMENT ON COLUMN court_sessions.partner_joined IS 'Whether the partner has joined';
COMMENT ON COLUMN court_sessions.evidence_submissions IS 'JSONB storing evidence from both users';
COMMENT ON COLUMN court_sessions.settle_requests IS 'Tracks which users have requested to settle out of court';
COMMENT ON COLUMN court_sessions.verdict_acceptances IS 'Tracks which users have accepted the verdict';
COMMENT ON COLUMN court_sessions.verdict IS 'The full verdict JSON from Judge Whiskers';
COMMENT ON COLUMN court_sessions.verdict_rating IS 'User rating of the verdict (1-5)';
COMMENT ON COLUMN court_sessions.resolved_at IS 'Timestamp when the verdict was generated';
