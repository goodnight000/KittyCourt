-- ============================================
-- MIGRATION: Per-Couple Usage Tracking
-- ============================================
-- Changes usage tracking from per-user to per-couple
-- so both partners share the same usage limits.
-- ============================================

-- Add couple_id column to usage_tracking
ALTER TABLE usage_tracking ADD COLUMN IF NOT EXISTS couple_id TEXT;

-- Create index for couple_id lookups
CREATE INDEX IF NOT EXISTS idx_usage_tracking_couple_id ON usage_tracking(couple_id);

-- Create helper function to compute canonical couple_id from two user IDs
-- Returns a consistent ID regardless of which user is first
CREATE OR REPLACE FUNCTION compute_couple_id(user_id_1 UUID, user_id_2 UUID)
RETURNS TEXT AS $$
BEGIN
    IF user_id_2 IS NULL THEN
        -- No partner, use user's own ID
        RETURN user_id_1::text;
    END IF;
    
    -- Sort the two UUIDs alphabetically to get a consistent couple ID
    IF user_id_1::text < user_id_2::text THEN
        RETURN user_id_1::text || '-' || user_id_2::text;
    ELSE
        RETURN user_id_2::text || '-' || user_id_1::text;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update the atomic increment function to use couple_id
CREATE OR REPLACE FUNCTION increment_usage(
    p_user_id UUID,
    p_period_start DATE,
    p_type TEXT
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_value INTEGER;
    v_partner_id UUID;
    v_couple_id TEXT;
BEGIN
    IF p_type NOT IN ('lightning', 'mittens', 'whiskers', 'plan') THEN
        RAISE EXCEPTION 'Invalid usage type: %', p_type;
    END IF;

    -- Look up the user's partner
    SELECT partner_id INTO v_partner_id FROM profiles WHERE id = p_user_id;
    
    -- Compute canonical couple_id
    v_couple_id := compute_couple_id(p_user_id, v_partner_id);

    -- Insert or update using couple_id
    INSERT INTO usage_tracking (
        user_id,
        couple_id,
        period_start,
        lightning_count,
        mittens_count,
        whiskers_count,
        plan_count
    ) VALUES (
        p_user_id,
        v_couple_id,
        p_period_start,
        CASE WHEN p_type = 'lightning' THEN 1 ELSE 0 END,
        CASE WHEN p_type = 'mittens' THEN 1 ELSE 0 END,
        CASE WHEN p_type = 'whiskers' THEN 1 ELSE 0 END,
        CASE WHEN p_type = 'plan' THEN 1 ELSE 0 END
    )
    ON CONFLICT (user_id, period_start) DO UPDATE SET
        couple_id = v_couple_id,
        lightning_count = usage_tracking.lightning_count + (CASE WHEN p_type = 'lightning' THEN 1 ELSE 0 END),
        mittens_count   = usage_tracking.mittens_count   + (CASE WHEN p_type = 'mittens' THEN 1 ELSE 0 END),
        whiskers_count  = usage_tracking.whiskers_count  + (CASE WHEN p_type = 'whiskers' THEN 1 ELSE 0 END),
        plan_count      = usage_tracking.plan_count      + (CASE WHEN p_type = 'plan' THEN 1 ELSE 0 END),
        updated_at      = NOW()
    RETURNING
        CASE
            WHEN p_type = 'lightning' THEN lightning_count
            WHEN p_type = 'mittens' THEN mittens_count
            WHEN p_type = 'whiskers' THEN whiskers_count
            WHEN p_type = 'plan' THEN plan_count
        END
    INTO new_value;

    RETURN new_value;
END;
$$;

-- Create a new function to get couple usage (sums both partners' records)
CREATE OR REPLACE FUNCTION get_couple_usage(
    p_user_id UUID,
    p_period_start DATE
) RETURNS TABLE (
    lightning_count INTEGER,
    mittens_count INTEGER,
    whiskers_count INTEGER,
    plan_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_partner_id UUID;
    v_couple_id TEXT;
BEGIN
    -- Look up the user's partner
    SELECT partner_id INTO v_partner_id FROM profiles WHERE id = p_user_id;
    
    -- Compute canonical couple_id
    v_couple_id := compute_couple_id(p_user_id, v_partner_id);

    -- Sum usage for all records with this couple_id in this period
    RETURN QUERY
    SELECT 
        COALESCE(SUM(ut.lightning_count), 0)::INTEGER,
        COALESCE(SUM(ut.mittens_count), 0)::INTEGER,
        COALESCE(SUM(ut.whiskers_count), 0)::INTEGER,
        COALESCE(SUM(ut.plan_count), 0)::INTEGER
    FROM usage_tracking ut
    WHERE ut.couple_id = v_couple_id 
      AND ut.period_start = p_period_start;
END;
$$;

REVOKE ALL ON FUNCTION compute_couple_id(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION compute_couple_id(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION compute_couple_id(UUID, UUID) TO service_role;

REVOKE ALL ON FUNCTION get_couple_usage(UUID, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_couple_usage(UUID, DATE) TO service_role;

-- ============================================
-- DONE!
-- ============================================
-- Changes:
--   • Added couple_id column to usage_tracking
--   • Added compute_couple_id() helper function
--   • Updated increment_usage() to store couple_id
--   • Added get_couple_usage() to sum couple usage
-- ============================================
