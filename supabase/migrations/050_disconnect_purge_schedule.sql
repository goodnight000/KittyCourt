-- ============================================================================
-- Schedule purge_expired_disconnect_couples() via pg_cron (single source of truth)
-- ============================================================================
-- This schedules an hourly job inside Postgres so cleanup runs even if the API
-- server is not running or is horizontally scaled.

DO $do$
DECLARE
    v_jobid INTEGER;
    v_has_pg_cron BOOLEAN := FALSE;
BEGIN
    -- Best-effort: enable pg_cron if available.
    BEGIN
        CREATE EXTENSION IF NOT EXISTS pg_cron;
    EXCEPTION
        WHEN insufficient_privilege OR undefined_file THEN
            RAISE NOTICE 'pg_cron extension not available; disconnect purge scheduling skipped';
            -- fall through
    END;

    SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') INTO v_has_pg_cron;

    IF NOT v_has_pg_cron THEN
        RAISE NOTICE 'pg_cron extension not installed; disconnect purge scheduling skipped';
    ELSE
        -- Unschedule existing job if present (idempotent migrations)
        BEGIN
            SELECT jobid INTO v_jobid
            FROM cron.job
            WHERE jobname = 'purge_expired_disconnect_couples'
            LIMIT 1;

            IF v_jobid IS NOT NULL THEN
                PERFORM cron.unschedule(v_jobid);
            END IF;
        EXCEPTION
            WHEN undefined_table THEN
                -- Older pg_cron versions may not have cron.job view accessible
                NULL;
        END;

        -- Run hourly at minute 15 to avoid top-of-hour spikes
        BEGIN
            PERFORM cron.schedule(
                'purge_expired_disconnect_couples',
                '15 * * * *',
                $cmd$SELECT public.purge_expired_disconnect_couples();$cmd$
            );
        EXCEPTION
            WHEN undefined_function THEN
                -- Fallback for older pg_cron versions without named jobs
                PERFORM cron.schedule(
                    '15 * * * *',
                    $cmd$SELECT public.purge_expired_disconnect_couples();$cmd$
                );
        END;
    END IF;
END
$do$;
