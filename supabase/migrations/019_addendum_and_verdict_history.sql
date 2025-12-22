-- ============================================
-- V2.1 - Addendum + Verdict History Tracking
-- ============================================
-- Tracks addendum usage (shared limit) and stores verdict history

ALTER TABLE court_sessions
ADD COLUMN IF NOT EXISTS addendum_history JSONB;

ALTER TABLE court_sessions
ADD COLUMN IF NOT EXISTS addendum_count INT DEFAULT 0;

ALTER TABLE court_sessions
ADD COLUMN IF NOT EXISTS verdict_history JSONB;

-- ============================================
-- DONE
-- ============================================
