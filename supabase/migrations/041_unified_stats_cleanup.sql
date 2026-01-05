-- Migration: 041_unified_stats_cleanup.sql
-- Purpose: Add appreciations tracking to user_stats and clean up old stat trackers
-- This creates a SINGLE SOURCE OF TRUTH for all user statistics

-- ============================================================================
-- STEP 1: Add appreciations_received column to user_stats
-- ============================================================================

ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS appreciations_received INT NOT NULL DEFAULT 0;

-- ============================================================================
-- STEP 2: Function to increment appreciations_received
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_appreciations_received(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO user_stats (user_id, appreciations_received)
    VALUES (p_user_id, 1)
    ON CONFLICT (user_id) DO UPDATE SET
        appreciations_received = user_stats.appreciations_received + 1,
        updated_at = NOW();
END;
$$;

-- ============================================================================
-- STEP 3: Trigger function for appreciations insert
-- ============================================================================

CREATE OR REPLACE FUNCTION on_appreciation_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Increment appreciations_received for the recipient (to_user_id)
    PERFORM increment_appreciations_received(NEW.to_user_id);
    RETURN NEW;
END;
$$;

-- Create trigger on appreciations table
DROP TRIGGER IF EXISTS on_appreciation_created_trigger ON appreciations;
CREATE TRIGGER on_appreciation_created_trigger
    AFTER INSERT ON appreciations
    FOR EACH ROW
    EXECUTE FUNCTION on_appreciation_created();

-- ============================================================================
-- STEP 4: Trigger function for case resolution
-- ============================================================================

CREATE OR REPLACE FUNCTION on_case_resolved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only trigger when status changes to RESOLVED
    IF NEW.status = 'RESOLVED' AND (OLD.status IS NULL OR OLD.status != 'RESOLVED') THEN
        -- Increment cases_resolved for both users
        PERFORM increment_cases_resolved(NEW.user_a_id);
        PERFORM increment_cases_resolved(NEW.user_b_id);
    END IF;
    RETURN NEW;
END;
$$;

-- Create trigger on cases table
DROP TRIGGER IF EXISTS on_case_resolved_trigger ON cases;
CREATE TRIGGER on_case_resolved_trigger
    AFTER INSERT OR UPDATE ON cases
    FOR EACH ROW
    EXECUTE FUNCTION on_case_resolved();

-- ============================================================================
-- STEP 5: Migrate existing appreciation counts to user_stats
-- ============================================================================

WITH appreciation_counts AS (
    SELECT
        to_user_id as user_id,
        COUNT(*) as appreciation_count
    FROM appreciations
    GROUP BY to_user_id
)
INSERT INTO user_stats (user_id, appreciations_received, created_at, updated_at)
SELECT
    ac.user_id,
    ac.appreciation_count,
    NOW(),
    NOW()
FROM appreciation_counts ac
ON CONFLICT (user_id) DO UPDATE SET
    appreciations_received = EXCLUDED.appreciations_received,
    updated_at = NOW();

-- ============================================================================
-- STEP 6: Recalculate cases_resolved from actual resolved cases
-- (ensures accuracy after migration)
-- ============================================================================

WITH case_counts AS (
    SELECT user_id, SUM(case_count) as total_cases FROM (
        SELECT user_a_id as user_id, COUNT(*) as case_count
        FROM cases WHERE status = 'RESOLVED'
        GROUP BY user_a_id
        UNION ALL
        SELECT user_b_id as user_id, COUNT(*) as case_count
        FROM cases WHERE status = 'RESOLVED'
        GROUP BY user_b_id
    ) combined
    GROUP BY user_id
)
UPDATE user_stats
SET cases_resolved = COALESCE(cc.total_cases, 0),
    updated_at = NOW()
FROM case_counts cc
WHERE user_stats.user_id = cc.user_id;

-- ============================================================================
-- STEP 7: Grant permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION increment_appreciations_received TO authenticated;
GRANT EXECUTE ON FUNCTION on_appreciation_created TO authenticated;
GRANT EXECUTE ON FUNCTION on_case_resolved TO authenticated;
