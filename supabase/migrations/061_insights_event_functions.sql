-- Helper functions for AI insights scheduling counters

CREATE OR REPLACE FUNCTION increment_insight_counter(
    p_user_id UUID,
    p_increment NUMERIC,
    p_event_at TIMESTAMPTZ,
    p_threshold NUMERIC
)
RETURNS TABLE (score NUMERIC)
LANGUAGE sql
AS $$
    INSERT INTO insight_event_counters (user_id, score, last_event_at, updated_at)
    VALUES (p_user_id, p_increment, p_event_at, p_event_at)
    ON CONFLICT (user_id) DO UPDATE
        SET score = LEAST(insight_event_counters.score + EXCLUDED.score, p_threshold),
            last_event_at = EXCLUDED.last_event_at,
            updated_at = EXCLUDED.updated_at
    RETURNING score;
$$;

CREATE OR REPLACE FUNCTION try_set_insight_run(
    p_user_id UUID,
    p_run_date TEXT,
    p_run_at TIMESTAMPTZ
)
RETURNS TABLE (did_set BOOLEAN)
LANGUAGE plpgsql
AS $$
DECLARE
    changed BOOLEAN := FALSE;
BEGIN
    INSERT INTO insight_event_counters (user_id, score, last_run_date, last_run_at, updated_at)
    VALUES (p_user_id, 0, p_run_date, p_run_at, p_run_at)
    ON CONFLICT (user_id) DO UPDATE
        SET last_run_date = EXCLUDED.last_run_date,
            last_run_at = EXCLUDED.last_run_at,
            updated_at = EXCLUDED.updated_at
    WHERE insight_event_counters.last_run_date IS DISTINCT FROM EXCLUDED.last_run_date
    RETURNING TRUE INTO changed;

    RETURN QUERY SELECT COALESCE(changed, FALSE);
END;
$$;
