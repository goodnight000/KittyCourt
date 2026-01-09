-- Migration: Rename judge usage tracking columns
-- Old: lightning_count, mittens_count, whiskers_count
-- New: classic_count, swift_count, wise_count
--
-- This aligns with the new judge naming:
-- - classic (Mochi) - DeepSeek v3.2
-- - swift (Dash) - Gemini 3 Flash
-- - wise (Whiskers) - GPT 5.2

-- Rename columns in usage_tracking table
ALTER TABLE usage_tracking
  RENAME COLUMN lightning_count TO classic_count;

ALTER TABLE usage_tracking
  RENAME COLUMN mittens_count TO swift_count;

ALTER TABLE usage_tracking
  RENAME COLUMN whiskers_count TO wise_count;

-- Drop existing functions first (required when changing return types)
DROP FUNCTION IF EXISTS increment_usage(UUID, DATE, TEXT);
DROP FUNCTION IF EXISTS get_couple_usage(UUID, DATE);

-- Recreate the increment_usage function with new column names
CREATE OR REPLACE FUNCTION increment_usage(
  p_user_id UUID,
  p_period_start DATE,
  p_type TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
  v_couple_id TEXT;
BEGIN
  -- Get couple_id for this user
  SELECT
    CASE
      WHEN partner_id IS NOT NULL THEN
        CASE
          WHEN id::text < partner_id::text THEN id::text || '-' || partner_id::text
          ELSE partner_id::text || '-' || id::text
        END
      ELSE id::text
    END INTO v_couple_id
  FROM profiles
  WHERE id = p_user_id;

  -- Insert or update usage record
  INSERT INTO usage_tracking (user_id, couple_id, period_start, classic_count, swift_count, wise_count, plan_count)
  VALUES (p_user_id, v_couple_id, p_period_start, 0, 0, 0, 0)
  ON CONFLICT (user_id, period_start) DO NOTHING;

  -- Increment the appropriate counter
  IF p_type = 'classic' THEN
    UPDATE usage_tracking
    SET classic_count = classic_count + 1, updated_at = NOW()
    WHERE user_id = p_user_id AND period_start = p_period_start
    RETURNING classic_count INTO v_count;
  ELSIF p_type = 'swift' THEN
    UPDATE usage_tracking
    SET swift_count = swift_count + 1, updated_at = NOW()
    WHERE user_id = p_user_id AND period_start = p_period_start
    RETURNING swift_count INTO v_count;
  ELSIF p_type = 'wise' THEN
    UPDATE usage_tracking
    SET wise_count = wise_count + 1, updated_at = NOW()
    WHERE user_id = p_user_id AND period_start = p_period_start
    RETURNING wise_count INTO v_count;
  ELSIF p_type = 'plan' THEN
    UPDATE usage_tracking
    SET plan_count = plan_count + 1, updated_at = NOW()
    WHERE user_id = p_user_id AND period_start = p_period_start
    RETURNING plan_count INTO v_count;
  ELSE
    RAISE EXCEPTION 'Invalid usage type: %', p_type;
  END IF;

  RETURN v_count;
END;
$$;

-- Recreate the get_couple_usage function with new column names
CREATE OR REPLACE FUNCTION get_couple_usage(
  p_user_id UUID,
  p_period_start DATE
)
RETURNS TABLE (
  classic_count INTEGER,
  swift_count INTEGER,
  wise_count INTEGER,
  plan_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_couple_id TEXT;
BEGIN
  -- Get couple_id for this user
  SELECT
    CASE
      WHEN partner_id IS NOT NULL THEN
        CASE
          WHEN id::text < partner_id::text THEN id::text || '-' || partner_id::text
          ELSE partner_id::text || '-' || id::text
        END
      ELSE id::text
    END INTO v_couple_id
  FROM profiles
  WHERE id = p_user_id;

  -- Sum usage across couple
  RETURN QUERY
  SELECT
    COALESCE(SUM(ut.classic_count), 0)::INTEGER,
    COALESCE(SUM(ut.swift_count), 0)::INTEGER,
    COALESCE(SUM(ut.wise_count), 0)::INTEGER,
    COALESCE(SUM(ut.plan_count), 0)::INTEGER
  FROM usage_tracking ut
  WHERE ut.couple_id = v_couple_id
    AND ut.period_start = p_period_start;
END;
$$;
