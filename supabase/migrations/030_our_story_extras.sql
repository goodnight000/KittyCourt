-- ============================================
-- OUR STORY: Missing helpers, triggers, storage RLS
-- ============================================

-- ============================================
-- Timezone helpers (America/New_York)
-- ============================================

CREATE OR REPLACE FUNCTION get_current_day_et()
RETURNS DATE
LANGUAGE SQL
STABLE
AS $$
    SELECT (NOW() AT TIME ZONE 'America/New_York')::DATE
$$;

CREATE OR REPLACE FUNCTION get_streak_day_et(ts TIMESTAMPTZ DEFAULT NOW())
RETURNS DATE
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    et_time TIME;
    et_date DATE;
BEGIN
    et_time := (ts AT TIME ZONE 'America/New_York')::TIME;
    et_date := (ts AT TIME ZONE 'America/New_York')::DATE;

    IF et_time < '02:00:00'::TIME THEN
        RETURN et_date - 1;
    END IF;

    RETURN et_date;
END;
$$;

CREATE OR REPLACE FUNCTION is_same_streak_day(ts1 TIMESTAMPTZ, ts2 TIMESTAMPTZ)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN get_streak_day_et(ts1) = get_streak_day_et(ts2);
END;
$$;

REVOKE ALL ON FUNCTION get_current_day_et() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_current_day_et() TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_day_et() TO service_role;

REVOKE ALL ON FUNCTION get_streak_day_et(TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_streak_day_et(TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_streak_day_et(TIMESTAMPTZ) TO service_role;

REVOKE ALL ON FUNCTION is_same_streak_day(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_same_streak_day(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION is_same_streak_day(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

-- ============================================
-- Couple disconnect history (30-day purge tracking)
-- ============================================

CREATE TABLE IF NOT EXISTS couple_disconnect_history (
    user_a_id UUID NOT NULL,
    user_b_id UUID NOT NULL,
    disconnected_by UUID REFERENCES profiles(id),
    disconnected_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    PRIMARY KEY (user_a_id, user_b_id),
    CHECK (user_a_id < user_b_id)
);

CREATE INDEX IF NOT EXISTS idx_disconnect_history_time
    ON couple_disconnect_history(disconnected_at);

ALTER TABLE couple_disconnect_history ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Couple level initialization trigger
-- ============================================

CREATE OR REPLACE FUNCTION create_couple_levels_on_connect()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_a UUID;
    v_user_b UUID;
BEGIN
    IF OLD.partner_id IS NULL AND NEW.partner_id IS NOT NULL THEN
        IF NEW.id < NEW.partner_id THEN
            v_user_a := NEW.id;
            v_user_b := NEW.partner_id;
        ELSE
            v_user_a := NEW.partner_id;
            v_user_b := NEW.id;
        END IF;

        INSERT INTO couple_levels (user_a_id, user_b_id, total_xp, current_level)
        VALUES (v_user_a, v_user_b, 0, 1)
        ON CONFLICT (user_a_id, user_b_id) DO NOTHING;

        DELETE FROM couple_disconnect_history
        WHERE user_a_id = v_user_a AND user_b_id = v_user_b;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_create_couple_levels ON profiles;

CREATE TRIGGER trigger_create_couple_levels
    AFTER UPDATE OF partner_id ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION create_couple_levels_on_connect();

-- ============================================
-- Storage bucket policies (couple-memories)
-- ============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('couple-memories', 'couple-memories', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Couples can view their memories" ON storage.objects;
CREATE POLICY "Couples can view their memories"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'couple-memories'
    AND (storage.foldername(name))[1] = get_couple_folder()
);

DROP POLICY IF EXISTS "Couples can upload memories" ON storage.objects;
CREATE POLICY "Couples can upload memories"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'couple-memories'
    AND (storage.foldername(name))[1] = get_couple_folder()
);

DROP POLICY IF EXISTS "Couples can delete memories" ON storage.objects;
CREATE POLICY "Couples can delete memories"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'couple-memories'
    AND (storage.foldername(name))[1] = get_couple_folder()
);

-- ============================================
-- relationship_stats (read-only for clients)
-- ============================================

DROP POLICY IF EXISTS "Connected couples can view their stats" ON relationship_stats;
CREATE POLICY "Connected couples can view their stats"
ON relationship_stats FOR SELECT
USING (
    is_connected() AND
    is_my_couple(user_a_id, user_b_id)
);

-- ============================================
-- End migration
-- ============================================
