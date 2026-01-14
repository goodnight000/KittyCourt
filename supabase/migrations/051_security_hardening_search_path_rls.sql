-- Migration: 051_security_hardening_search_path_rls.sql
-- Purpose: Fix role-mutable search_path warnings, tighten service RLS policies,
-- and move pgvector out of public schema.

-- Ensure extensions schema exists (required for pgvector and search_path updates).
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move pgvector to extensions schema if it's currently in public.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_extension e
        JOIN pg_namespace n ON n.oid = e.extnamespace
        WHERE e.extname = 'vector' AND n.nspname = 'public'
    ) THEN
        ALTER EXTENSION vector SET SCHEMA extensions;
    END IF;
END $$;

-- Tighten service role policies to service_role only.
DROP POLICY IF EXISTS "Service can manage device tokens" ON device_tokens;
CREATE POLICY "Service can manage device tokens" ON device_tokens
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Service can manage preferences" ON notification_preferences;
CREATE POLICY "Service can manage preferences" ON notification_preferences
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Service can insert notification logs" ON notification_log;
CREATE POLICY "Service can insert notification logs" ON notification_log
    FOR INSERT TO service_role
    WITH CHECK (true);

DROP POLICY IF EXISTS "Service can update notification logs" ON notification_log;
CREATE POLICY "Service can update notification logs" ON notification_log
    FOR UPDATE TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Service can view all logs" ON notification_log;
CREATE POLICY "Service can view all logs" ON notification_log
    FOR SELECT TO service_role
    USING (true);

-- Fix role-mutable search_path on functions (guarded for missing overloads).
DO $$
DECLARE
    fn TEXT;
BEGIN
    PERFORM set_config('search_path', 'public, extensions', true);

    FOREACH fn IN ARRAY ARRAY[
        'public.get_todays_question(uuid, uuid)',
        'public.get_todays_question(uuid, uuid, text)',
        'public.check_streak_status(uuid)',
        'public.create_default_notification_preferences()',
        'public.get_couple_usage(uuid, date)',
        'public.is_same_streak_day(timestamptz, timestamptz)',
        'public.get_current_day_et()',
        'public.compute_couple_id(uuid, uuid)',
        'public.cleanup_accepted_requests()',
        'public.on_appreciation_created()',
        'public.increment_cases_resolved(uuid)',
        'public.increment_appreciations_received(uuid)',
        'public.on_case_resolved()',
        'public.update_updated_at_column()',
        'public.save_streak_for_revival(uuid)',
        'public.update_daily_answer_timestamps()',
        'public.prevent_mood_change()',
        'public.send_partner_request(uuid, uuid, text)',
        'public.get_user_memory_context(uuid, integer)',
        'public.update_user_streak(uuid, date)',
        'public.should_send_notification(uuid, text)',
        'public.is_valid_past_date(date)',
        'public.get_couple_ids(uuid, uuid)',
        'public.get_streak_day_et(timestamptz)',
        'public.update_questions_answered_count()',
        'public.on_daily_question_completed()',
        'public.prevent_anniversary_change()',
        'public.revive_streak(uuid)',
        'public.get_or_create_user_stats(uuid)',
        'public.increment_usage(uuid, date, text)',
        'public.increment_questions_completed(uuid)'
    ]
    LOOP
        IF to_regprocedure(fn) IS NOT NULL THEN
            EXECUTE 'ALTER FUNCTION ' || fn || ' SET search_path = public';
        END IF;
    END LOOP;

    FOREACH fn IN ARRAY ARRAY[
        'public.search_similar_memories(vector, uuid, double precision, integer)',
        'public.search_similar_memories(vector, uuid, text, double precision, integer)',
        'public.retrieve_relevant_memories(vector, uuid[], integer)',
        'public.retrieve_relevant_memories(vector, uuid[], text, integer)',
        'public.retrieve_relevant_memories_v2(vector, uuid[], integer, integer)',
        'public.retrieve_relevant_memories_v2(vector, uuid[], text, integer, integer)'
    ]
    LOOP
        IF to_regprocedure(fn) IS NOT NULL THEN
            EXECUTE 'ALTER FUNCTION ' || fn || ' SET search_path = public, extensions';
        END IF;
    END LOOP;
END $$;
