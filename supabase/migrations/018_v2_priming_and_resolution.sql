-- ============================================
-- JUDGE ENGINE V2.0 - PRIMING AND RESOLUTION FIELDS
-- ============================================
-- Adds new fields to court_sessions for the multi-step pipeline:
-- 1. Analysis + Resolutions (from LLM Call 1)
-- 2. Priming + Joint Menu (from LLM Call 2)
-- 3. Resolution picks and hybrid resolution (from LLM Call 3)
-- ============================================

-- Add partner tracking
ALTER TABLE court_sessions 
ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES profiles(id);

ALTER TABLE court_sessions 
ADD COLUMN IF NOT EXISTS couple_id UUID;

ALTER TABLE court_sessions 
ADD COLUMN IF NOT EXISTS judge_type TEXT DEFAULT 'logical';

-- Evidence capture (separate from cases table for real-time session)
ALTER TABLE court_sessions 
ADD COLUMN IF NOT EXISTS user_a_evidence TEXT;

ALTER TABLE court_sessions 
ADD COLUMN IF NOT EXISTS user_a_feelings TEXT;

ALTER TABLE court_sessions 
ADD COLUMN IF NOT EXISTS user_b_evidence TEXT;

ALTER TABLE court_sessions 
ADD COLUMN IF NOT EXISTS user_b_feelings TEXT;

-- User-reported intensity (optional)
ALTER TABLE court_sessions 
ADD COLUMN IF NOT EXISTS user_reported_intensity TEXT;

-- Phase 1: Analysis output
ALTER TABLE court_sessions 
ADD COLUMN IF NOT EXISTS analysis JSONB;

ALTER TABLE court_sessions 
ADD COLUMN IF NOT EXISTS resolutions JSONB;

ALTER TABLE court_sessions 
ADD COLUMN IF NOT EXISTS assessed_intensity TEXT;

-- Phase 2: Priming + Joint content
ALTER TABLE court_sessions 
ADD COLUMN IF NOT EXISTS priming_content JSONB;

ALTER TABLE court_sessions 
ADD COLUMN IF NOT EXISTS joint_menu JSONB;

-- Sync flags for priming phase
ALTER TABLE court_sessions 
ADD COLUMN IF NOT EXISTS user_a_priming_ready BOOLEAN DEFAULT FALSE;

ALTER TABLE court_sessions 
ADD COLUMN IF NOT EXISTS user_b_priming_ready BOOLEAN DEFAULT FALSE;

-- Sync flags for joint menu phase
ALTER TABLE court_sessions 
ADD COLUMN IF NOT EXISTS user_a_joint_ready BOOLEAN DEFAULT FALSE;

ALTER TABLE court_sessions 
ADD COLUMN IF NOT EXISTS user_b_joint_ready BOOLEAN DEFAULT FALSE;

-- Resolution picks (resolution_1, resolution_2, resolution_3, or null)
ALTER TABLE court_sessions 
ADD COLUMN IF NOT EXISTS user_a_resolution_pick TEXT;

ALTER TABLE court_sessions 
ADD COLUMN IF NOT EXISTS user_b_resolution_pick TEXT;

-- Hybrid resolution (if generated)
ALTER TABLE court_sessions 
ADD COLUMN IF NOT EXISTS hybrid_resolution JSONB;

-- Final chosen resolution
ALTER TABLE court_sessions 
ADD COLUMN IF NOT EXISTS final_resolution JSONB;

-- Final verdict (replaces old verdict column if exists)
ALTER TABLE court_sessions 
ADD COLUMN IF NOT EXISTS verdict JSONB;

-- Phase tracking (more granular than status)
ALTER TABLE court_sessions 
ADD COLUMN IF NOT EXISTS phase TEXT DEFAULT 'IDLE';

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_court_sessions_phase ON court_sessions(phase);
CREATE INDEX IF NOT EXISTS idx_court_sessions_couple_id ON court_sessions(couple_id);
CREATE INDEX IF NOT EXISTS idx_court_sessions_partner_id ON court_sessions(partner_id);

-- ============================================
-- DONE! 
-- Court sessions now support v2.0 priming and resolution flow
-- ============================================
