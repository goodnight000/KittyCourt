-- Add compound indexes to speed up court session and case history queries
CREATE INDEX IF NOT EXISTS idx_court_sessions_created_by_status
ON court_sessions(created_by, status);

CREATE INDEX IF NOT EXISTS idx_court_sessions_partner_status
ON court_sessions(partner_id, status);

CREATE INDEX IF NOT EXISTS idx_cases_user_a_user_b_created_at
ON cases(user_a_id, user_b_id, created_at DESC);
