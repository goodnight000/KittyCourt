-- ============================================
-- MIGRATION: Fix usage_tracking RLS + atomic increment
-- ============================================

-- 1) Restrict the overly-broad "Service can manage usage" policy
DROP POLICY IF EXISTS "Service can manage usage" ON usage_tracking;

CREATE POLICY "Service can manage usage" ON usage_tracking
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 2) Atomic increment function (avoids race conditions on concurrent increments)
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
BEGIN
    IF p_type NOT IN ('lightning', 'mittens', 'whiskers', 'plan') THEN
        RAISE EXCEPTION 'Invalid usage type: %', p_type;
    END IF;

    INSERT INTO usage_tracking (
        user_id,
        period_start,
        lightning_count,
        mittens_count,
        whiskers_count,
        plan_count
    ) VALUES (
        p_user_id,
        p_period_start,
        CASE WHEN p_type = 'lightning' THEN 1 ELSE 0 END,
        CASE WHEN p_type = 'mittens' THEN 1 ELSE 0 END,
        CASE WHEN p_type = 'whiskers' THEN 1 ELSE 0 END,
        CASE WHEN p_type = 'plan' THEN 1 ELSE 0 END
    )
    ON CONFLICT (user_id, period_start) DO UPDATE SET
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

REVOKE ALL ON FUNCTION increment_usage(UUID, DATE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_usage(UUID, DATE, TEXT) TO service_role;

