-- Migration: 040_user_stats.sql
-- Purpose: Create unified user_stats table as single source of truth for:
--   - Daily meow streak (with grace period support)
--   - Questions completed (both partners answered)
--   - Cases resolved
--   - Streak revival for Gold users (once per 3 months)

-- ============================================================================
-- STEP 1: Create user_stats table
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_stats (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Streak tracking
    current_streak INT NOT NULL DEFAULT 0,
    longest_streak INT NOT NULL DEFAULT 0,
    last_streak_date DATE,  -- The date of the last completed daily question
    streak_updated_at TIMESTAMPTZ,

    -- Grace period tracking
    grace_period_active BOOLEAN NOT NULL DEFAULT false,
    grace_period_started_at TIMESTAMPTZ,

    -- Streak revival (Gold users only - once per 3 months)
    last_revival_used_at TIMESTAMPTZ,
    revival_streak_value INT,  -- The streak value that was saved when revival was used

    -- Unified counts (single source of truth)
    questions_completed INT NOT NULL DEFAULT 0,  -- Only counted when BOTH partners answer
    cases_resolved INT NOT NULL DEFAULT 0,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON user_stats(user_id);

-- Enable RLS
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;

-- Users can only see their own stats
CREATE POLICY "Users can view own stats"
    ON user_stats FOR SELECT
    USING (auth.uid() = user_id);

-- Users can update their own stats (for streak updates)
CREATE POLICY "Users can update own stats"
    ON user_stats FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can insert their own stats (auto-creation)
CREATE POLICY "Users can insert own stats"
    ON user_stats FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- STEP 2: Function to get or create user stats
-- ============================================================================

CREATE OR REPLACE FUNCTION get_or_create_user_stats(p_user_id UUID)
RETURNS user_stats
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_stats user_stats;
BEGIN
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

-- ============================================================================
-- STEP 3: Function to update streak with grace period logic
-- ============================================================================

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
AS $$
DECLARE
    v_stats user_stats;
    v_days_since_last INT;
    v_old_streak INT;
    v_new_streak INT;
    v_grace_period BOOLEAN := false;
    v_streak_broken BOOLEAN := false;
BEGIN
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

-- ============================================================================
-- STEP 4: Function to check current streak status (with grace period check)
-- ============================================================================

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

-- ============================================================================
-- STEP 5: Function to revive streak (Gold users only)
-- ============================================================================

CREATE OR REPLACE FUNCTION revive_streak(p_user_id UUID)
RETURNS TABLE (
    success BOOLEAN,
    new_streak INT,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_stats user_stats;
    v_can_revive BOOLEAN;
    v_revival_available TIMESTAMPTZ;
    v_days_since_last INT;
BEGIN
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

-- ============================================================================
-- STEP 6: Function to save streak before it breaks (for revival)
-- ============================================================================

CREATE OR REPLACE FUNCTION save_streak_for_revival(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_stats user_stats;
BEGIN
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
-- STEP 7: Function to increment questions_completed
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_questions_completed(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO user_stats (user_id, questions_completed)
    VALUES (p_user_id, 1)
    ON CONFLICT (user_id) DO UPDATE SET
        questions_completed = user_stats.questions_completed + 1,
        updated_at = NOW();
END;
$$;

-- ============================================================================
-- STEP 8: Function to increment cases_resolved
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_cases_resolved(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO user_stats (user_id, cases_resolved)
    VALUES (p_user_id, 1)
    ON CONFLICT (user_id) DO UPDATE SET
        cases_resolved = user_stats.cases_resolved + 1,
        updated_at = NOW();
END;
$$;

-- ============================================================================
-- STEP 9: Update trigger for daily_answers to use new stats
-- Replace the old increment_questions_answered trigger
-- ============================================================================

-- Drop old trigger if exists
DROP TRIGGER IF EXISTS increment_questions_answered ON daily_answers;

-- Create new trigger function that handles streak AND question count
CREATE OR REPLACE FUNCTION on_daily_question_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_assignment RECORD;
    v_user_a_answered BOOLEAN;
    v_user_b_answered BOOLEAN;
BEGIN
    -- Get the assignment details
    SELECT * INTO v_assignment
    FROM couple_question_assignments
    WHERE id = NEW.assignment_id;

    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    -- Check if both users have now answered
    SELECT EXISTS(
        SELECT 1 FROM daily_answers
        WHERE assignment_id = NEW.assignment_id
        AND user_id = v_assignment.user_a_id
    ) INTO v_user_a_answered;

    SELECT EXISTS(
        SELECT 1 FROM daily_answers
        WHERE assignment_id = NEW.assignment_id
        AND user_id = v_assignment.user_b_id
    ) INTO v_user_b_answered;

    -- Only process when BOTH partners have answered (completion)
    IF v_user_a_answered AND v_user_b_answered THEN
        -- Save streak for potential revival before updating
        PERFORM save_streak_for_revival(v_assignment.user_a_id);
        PERFORM save_streak_for_revival(v_assignment.user_b_id);

        -- Update streak for both users
        PERFORM update_user_streak(v_assignment.user_a_id, v_assignment.assigned_date);
        PERFORM update_user_streak(v_assignment.user_b_id, v_assignment.assigned_date);

        -- Increment questions_completed for both users
        PERFORM increment_questions_completed(v_assignment.user_a_id);
        PERFORM increment_questions_completed(v_assignment.user_b_id);
    END IF;

    RETURN NEW;
END;
$$;

-- Create the new trigger
CREATE TRIGGER on_daily_question_completed_trigger
    AFTER INSERT ON daily_answers
    FOR EACH ROW
    EXECUTE FUNCTION on_daily_question_completed();

-- ============================================================================
-- STEP 10: Migrate existing data to user_stats
-- ============================================================================

-- Create stats records for all existing users
INSERT INTO user_stats (user_id, questions_completed, created_at, updated_at)
SELECT
    p.id,
    COALESCE(p.questions_answered, 0),
    NOW(),
    NOW()
FROM profiles p
WHERE NOT EXISTS (SELECT 1 FROM user_stats us WHERE us.user_id = p.id)
ON CONFLICT (user_id) DO NOTHING;

-- Calculate and set cases_resolved from actual completed cases
WITH case_counts AS (
    SELECT
        user_a_id as user_id,
        COUNT(*) as case_count
    FROM cases
    WHERE status = 'RESOLVED'
    GROUP BY user_a_id
    UNION ALL
    SELECT
        user_b_id as user_id,
        COUNT(*) as case_count
    FROM cases
    WHERE status = 'RESOLVED'
    GROUP BY user_b_id
),
aggregated AS (
    SELECT user_id, SUM(case_count) as total_cases
    FROM case_counts
    GROUP BY user_id
)
UPDATE user_stats
SET cases_resolved = COALESCE(a.total_cases, 0)
FROM aggregated a
WHERE user_stats.user_id = a.user_id;

-- Recalculate questions_completed based on actual completed assignments
WITH completed_questions AS (
    SELECT
        da.user_id,
        COUNT(DISTINCT da.assignment_id) as completed_count
    FROM daily_answers da
    JOIN couple_question_assignments cqa ON da.assignment_id = cqa.id
    WHERE cqa.status = 'completed'
    GROUP BY da.user_id
)
UPDATE user_stats
SET questions_completed = COALESCE(cq.completed_count, 0)
FROM completed_questions cq
WHERE user_stats.user_id = cq.user_id;

-- ============================================================================
-- STEP 11: Grant permissions
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON user_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_user_stats TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_streak TO authenticated;
GRANT EXECUTE ON FUNCTION check_streak_status TO authenticated;
GRANT EXECUTE ON FUNCTION revive_streak TO authenticated;
GRANT EXECUTE ON FUNCTION increment_questions_completed TO authenticated;
GRANT EXECUTE ON FUNCTION increment_cases_resolved TO authenticated;
