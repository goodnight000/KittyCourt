-- Migration: 057_database_security_fixes.sql
-- Purpose: Fix HIGH priority database security issues
--   DB-H-001: Add parameter validation to stats functions
--   DB-H-002: Add missing RLS policies for data_export_requests
--   DB-H-003: Revoke unnecessary grants on trigger functions

-- ============================================================================
-- DB-H-001: Stats function parameter validation
-- Add NULL checks and validation to prevent invalid data from being processed
-- ============================================================================

-- Fix get_or_create_user_stats with parameter validation
CREATE OR REPLACE FUNCTION get_or_create_user_stats(p_user_id UUID)
RETURNS user_stats
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_stats user_stats;
BEGIN
    -- Parameter validation: reject NULL user_id
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'get_or_create_user_stats: p_user_id cannot be NULL';
    END IF;

    -- Try to get existing stats
    SELECT * INTO v_stats FROM user_stats WHERE user_id = p_user_id;

    -- If not found, create new record
    IF NOT FOUND THEN
        INSERT INTO user_stats (user_id)
        VALUES (p_user_id)
        ON CONFLICT (user_id) DO NOTHING
        RETURNING * INTO v_stats;

        -- If still null (race condition), fetch again
        IF v_stats IS NULL THEN
            SELECT * INTO v_stats FROM user_stats WHERE user_id = p_user_id;
        END IF;
    END IF;

    RETURN v_stats;
END;
$$;

-- Fix update_user_streak with parameter validation
CREATE OR REPLACE FUNCTION update_user_streak(
    p_user_id UUID,
    p_completion_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    new_streak INT,
    is_grace_period BOOLEAN,
    streak_broken BOOLEAN,
    old_streak INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_stats user_stats;
    v_days_since_last INT;
    v_old_streak INT;
    v_new_streak INT;
    v_grace_period BOOLEAN := false;
    v_streak_broken BOOLEAN := false;
BEGIN
    -- Parameter validation
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'update_user_streak: p_user_id cannot be NULL';
    END IF;

    IF p_completion_date IS NULL THEN
        RAISE EXCEPTION 'update_user_streak: p_completion_date cannot be NULL';
    END IF;

    -- Validate completion date is not in the future
    IF p_completion_date > CURRENT_DATE THEN
        RAISE EXCEPTION 'update_user_streak: p_completion_date cannot be in the future';
    END IF;

    -- Get or create user stats
    SELECT * INTO v_stats FROM get_or_create_user_stats(p_user_id);
    v_old_streak := COALESCE(v_stats.current_streak, 0);

    -- Calculate days since last streak date
    IF v_stats.last_streak_date IS NOT NULL THEN
        v_days_since_last := p_completion_date - v_stats.last_streak_date;
    ELSE
        v_days_since_last := NULL;
    END IF;

    -- Determine new streak based on days gap
    IF v_days_since_last IS NULL THEN
        -- First ever completion
        v_new_streak := 1;
    ELSIF v_days_since_last = 0 THEN
        -- Same day, no change
        v_new_streak := v_old_streak;
    ELSIF v_days_since_last = 1 THEN
        -- Consecutive day, increment streak
        v_new_streak := v_old_streak + 1;
        v_grace_period := false;
    ELSIF v_days_since_last = 2 THEN
        -- Within grace period (1 day missed)
        -- Keep streak but mark as grace period
        v_new_streak := v_old_streak + 1;
        v_grace_period := true;
    ELSE
        -- Streak broken (more than 1 day grace period)
        v_streak_broken := true;
        v_new_streak := 1;
        v_grace_period := false;
    END IF;

    -- Update stats
    UPDATE user_stats SET
        current_streak = v_new_streak,
        longest_streak = GREATEST(COALESCE(longest_streak, 0), v_new_streak),
        last_streak_date = p_completion_date,
        streak_updated_at = NOW(),
        grace_period_active = v_grace_period,
        grace_period_started_at = CASE
            WHEN v_grace_period THEN COALESCE(grace_period_started_at, NOW())
            ELSE NULL
        END,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    RETURN QUERY SELECT v_new_streak, v_grace_period, v_streak_broken, v_old_streak;
END;
$$;

-- Fix check_streak_status with parameter validation
CREATE OR REPLACE FUNCTION check_streak_status(p_user_id UUID)
RETURNS TABLE (
    current_streak INT,
    longest_streak INT,
    last_streak_date DATE,
    is_grace_period BOOLEAN,
    grace_days_remaining INT,
    streak_expired BOOLEAN,
    can_revive BOOLEAN,
    revival_available_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_stats user_stats;
    v_days_since_last INT;
    v_is_grace BOOLEAN := false;
    v_grace_remaining INT := 0;
    v_expired BOOLEAN := false;
    v_can_revive BOOLEAN := false;
    v_revival_available TIMESTAMPTZ;
BEGIN
    -- Parameter validation
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'check_streak_status: p_user_id cannot be NULL';
    END IF;

    -- Get user stats
    SELECT * INTO v_stats FROM get_or_create_user_stats(p_user_id);

    -- Calculate days since last completion
    IF v_stats.last_streak_date IS NOT NULL THEN
        v_days_since_last := CURRENT_DATE - v_stats.last_streak_date;
    ELSE
        v_days_since_last := NULL;
    END IF;

    -- Determine current state
    IF v_days_since_last IS NULL THEN
        -- No streak history
        v_expired := false;
        v_is_grace := false;
    ELSIF v_days_since_last <= 1 THEN
        -- Current (today or yesterday)
        v_expired := false;
        v_is_grace := false;
    ELSIF v_days_since_last = 2 THEN
        -- In grace period (1 day to recover)
        v_expired := false;
        v_is_grace := true;
        v_grace_remaining := 1;
    ELSE
        -- Streak has expired
        v_expired := true;
        v_is_grace := false;
    END IF;

    -- Check revival eligibility (3 months = 90 days)
    IF v_stats.last_revival_used_at IS NULL THEN
        v_can_revive := true;
        v_revival_available := NULL;
    ELSE
        v_revival_available := v_stats.last_revival_used_at + INTERVAL '90 days';
        v_can_revive := NOW() >= v_revival_available;
    END IF;

    RETURN QUERY SELECT
        CASE WHEN v_expired THEN 0 ELSE COALESCE(v_stats.current_streak, 0) END,
        COALESCE(v_stats.longest_streak, 0),
        v_stats.last_streak_date,
        v_is_grace,
        v_grace_remaining,
        v_expired,
        v_can_revive,
        v_revival_available;
END;
$$;

-- Fix revive_streak with parameter validation
CREATE OR REPLACE FUNCTION revive_streak(p_user_id UUID)
RETURNS TABLE (
    success BOOLEAN,
    new_streak INT,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_stats user_stats;
    v_can_revive BOOLEAN;
    v_revival_available TIMESTAMPTZ;
    v_days_since_last INT;
BEGIN
    -- Parameter validation
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'revive_streak: p_user_id cannot be NULL';
    END IF;

    -- Get user stats
    SELECT * INTO v_stats FROM get_or_create_user_stats(p_user_id);

    -- Check revival eligibility
    IF v_stats.last_revival_used_at IS NULL THEN
        v_can_revive := true;
    ELSE
        v_revival_available := v_stats.last_revival_used_at + INTERVAL '90 days';
        v_can_revive := NOW() >= v_revival_available;
    END IF;

    IF NOT v_can_revive THEN
        RETURN QUERY SELECT
            false,
            COALESCE(v_stats.current_streak, 0),
            'Revival not available yet. Next revival available at: ' || v_revival_available::TEXT;
        RETURN;
    END IF;

    -- Calculate days since last streak
    IF v_stats.last_streak_date IS NOT NULL THEN
        v_days_since_last := CURRENT_DATE - v_stats.last_streak_date;
    ELSE
        RETURN QUERY SELECT false, 0, 'No streak to revive';
        RETURN;
    END IF;

    -- Only allow revival if streak was actually broken (> 2 days gap)
    IF v_days_since_last <= 2 THEN
        RETURN QUERY SELECT
            false,
            COALESCE(v_stats.current_streak, 0),
            'Streak is not broken. No revival needed.';
        RETURN;
    END IF;

    -- Revive the streak - restore to previous value
    UPDATE user_stats SET
        current_streak = COALESCE(revival_streak_value, current_streak, 1),
        last_streak_date = CURRENT_DATE,
        streak_updated_at = NOW(),
        grace_period_active = false,
        grace_period_started_at = NULL,
        last_revival_used_at = NOW(),
        revival_streak_value = NULL,  -- Clear saved value after use
        updated_at = NOW()
    WHERE user_id = p_user_id;

    -- Get updated stats
    SELECT * INTO v_stats FROM user_stats WHERE user_id = p_user_id;

    RETURN QUERY SELECT
        true,
        v_stats.current_streak,
        'Streak revived successfully!';
END;
$$;

-- Fix increment_questions_completed with parameter validation
CREATE OR REPLACE FUNCTION increment_questions_completed(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Parameter validation
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'increment_questions_completed: p_user_id cannot be NULL';
    END IF;

    INSERT INTO user_stats (user_id, questions_completed)
    VALUES (p_user_id, 1)
    ON CONFLICT (user_id) DO UPDATE SET
        questions_completed = user_stats.questions_completed + 1,
        updated_at = NOW();
END;
$$;

-- Fix increment_cases_resolved with parameter validation
CREATE OR REPLACE FUNCTION increment_cases_resolved(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Parameter validation
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'increment_cases_resolved: p_user_id cannot be NULL';
    END IF;

    INSERT INTO user_stats (user_id, cases_resolved)
    VALUES (p_user_id, 1)
    ON CONFLICT (user_id) DO UPDATE SET
        cases_resolved = user_stats.cases_resolved + 1,
        updated_at = NOW();
END;
$$;

-- Fix increment_appreciations_received with parameter validation
CREATE OR REPLACE FUNCTION increment_appreciations_received(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Parameter validation
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'increment_appreciations_received: p_user_id cannot be NULL';
    END IF;

    INSERT INTO user_stats (user_id, appreciations_received)
    VALUES (p_user_id, 1)
    ON CONFLICT (user_id) DO UPDATE SET
        appreciations_received = user_stats.appreciations_received + 1,
        updated_at = NOW();
END;
$$;

-- Fix save_streak_for_revival with parameter validation
CREATE OR REPLACE FUNCTION save_streak_for_revival(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_stats user_stats;
BEGIN
    -- Parameter validation
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'save_streak_for_revival: p_user_id cannot be NULL';
    END IF;

    SELECT * INTO v_stats FROM user_stats WHERE user_id = p_user_id;

    IF v_stats IS NOT NULL AND v_stats.current_streak > 0 THEN
        UPDATE user_stats SET
            revival_streak_value = current_streak,
            updated_at = NOW()
        WHERE user_id = p_user_id;
    END IF;
END;
$$;

-- ============================================================================
-- DB-H-002: Add missing RLS policies for data_export_requests
-- Service role needs UPDATE policy to mark exports as processed/sent
-- ============================================================================

-- Add UPDATE policy for service role to process export requests
CREATE POLICY "Service can update export requests"
    ON data_export_requests
    FOR UPDATE TO service_role
    USING (true)
    WITH CHECK (true);

-- Add DELETE policy for service role to clean up old export requests
CREATE POLICY "Service can delete export requests"
    ON data_export_requests
    FOR DELETE TO service_role
    USING (true);

-- Add SELECT policy for service role to query pending exports
CREATE POLICY "Service can view export requests"
    ON data_export_requests
    FOR SELECT TO service_role
    USING (true);

-- ============================================================================
-- DB-H-003: Revoke unnecessary grants on trigger functions
-- Trigger functions (on_appreciation_created, on_case_resolved) run as
-- SECURITY DEFINER and are only called by database triggers, not by users.
-- Granting EXECUTE to authenticated role is unnecessary and a security risk.
-- ============================================================================

-- Revoke unnecessary grants from trigger functions
REVOKE EXECUTE ON FUNCTION on_appreciation_created() FROM authenticated;
REVOKE EXECUTE ON FUNCTION on_case_resolved() FROM authenticated;

-- Also revoke from public just to be safe (default grant)
REVOKE EXECUTE ON FUNCTION on_appreciation_created() FROM public;
REVOKE EXECUTE ON FUNCTION on_case_resolved() FROM public;

-- Grant only to postgres (owner) - triggers run as definer so no external grant needed
-- The trigger mechanism itself doesn't require external EXECUTE permissions
