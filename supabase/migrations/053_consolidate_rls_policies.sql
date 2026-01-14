-- ============================================
-- MIGRATION: Consolidate duplicate RLS policies
-- ============================================
-- Removes multiple permissive policies for the same action and
-- keeps a single policy per action to reduce planner overhead.
-- ============================================

CREATE OR REPLACE FUNCTION public._alter_policy_if_exists(
    p_schema text,
    p_table text,
    p_policy text,
    p_using text,
    p_check text
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_sql text;
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_catalog.pg_policies
        WHERE schemaname = p_schema
          AND tablename = p_table
          AND policyname = p_policy
    ) THEN
        v_sql := pg_catalog.format('ALTER POLICY %I ON %I.%I', p_policy, p_schema, p_table);

        IF p_using IS NOT NULL THEN
            v_sql := v_sql || ' USING ' || p_using;
        END IF;

        IF p_check IS NOT NULL THEN
            v_sql := v_sql || ' WITH CHECK ' || p_check;
        END IF;

        EXECUTE v_sql;
    END IF;
END;
$$;

-- ============================================
-- Drop duplicate permissive policies
-- ============================================

-- Appreciations
DROP POLICY IF EXISTS "Users can send appreciations" ON appreciations;
DROP POLICY IF EXISTS "Users can view sent/received appreciations" ON appreciations;

-- Calendar events
DROP POLICY IF EXISTS "Users can create events" ON calendar_events;

-- Cases
DROP POLICY IF EXISTS "Users can create cases" ON cases;

-- Profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view partner profile" ON profiles;

-- User memories
DROP POLICY IF EXISTS "Partner can view memories" ON user_memories;

-- Verdicts
DROP POLICY IF EXISTS "Users can view verdicts for own cases" ON verdicts;

-- ============================================
-- Consolidate remaining policies where needed
-- ============================================

-- user_memories: own OR partner in one policy
SELECT public._alter_policy_if_exists(
    'public',
    'user_memories',
    'Users can view own memories',
    $$(user_id = (SELECT auth.uid()) OR user_id = get_my_partner_id())$$,
    NULL
);

-- memories: collapse update policies into one
DROP POLICY IF EXISTS "Partner can restore deleted memories" ON memories;
DROP POLICY IF EXISTS "Uploader can restore within 24h" ON memories;

SELECT public._alter_policy_if_exists(
    'public',
    'memories',
    'Uploader can soft-delete memories',
    $$(
        is_connected() AND
        is_my_couple(user_a_id, user_b_id) AND
        (
            (uploaded_by = (SELECT auth.uid()) AND is_deleted = FALSE)
            OR (is_deleted = TRUE AND deleted_by != (SELECT auth.uid()) AND deleted_at >= (NOW() - INTERVAL '30 days'))
            OR (is_deleted = TRUE AND deleted_by = (SELECT auth.uid()) AND deleted_at >= (NOW() - INTERVAL '24 hours'))
        )
    )$$,
    $$(
        (is_deleted = TRUE AND deleted_by = (SELECT auth.uid()) AND deleted_at IS NOT NULL)
        OR (is_deleted = FALSE AND deleted_by IS NULL AND deleted_at IS NULL)
    )$$
);

-- partner_requests: replace multiple policies with one per action
DROP POLICY IF EXISTS "Users can view own requests" ON partner_requests;
DROP POLICY IF EXISTS "Users can view requests sent to them" ON partner_requests;
DROP POLICY IF EXISTS "Users can view requests they sent" ON partner_requests;

DROP POLICY IF EXISTS "Users can insert requests" ON partner_requests;
DROP POLICY IF EXISTS "Users can send partner requests" ON partner_requests;

DROP POLICY IF EXISTS "Users can update own requests" ON partner_requests;
DROP POLICY IF EXISTS "Receivers can update request status" ON partner_requests;

DROP POLICY IF EXISTS "Receivers can delete rejected requests" ON partner_requests;
DROP POLICY IF EXISTS "Senders can delete own pending requests" ON partner_requests;

CREATE POLICY "Users can view own requests" ON partner_requests
    FOR SELECT USING (
        sender_id = (SELECT auth.uid()) OR
        receiver_id = (SELECT auth.uid())
    );

CREATE POLICY "Users can send partner requests" ON partner_requests
    FOR INSERT WITH CHECK (sender_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own requests" ON partner_requests
    FOR UPDATE USING (
        sender_id = (SELECT auth.uid()) OR
        receiver_id = (SELECT auth.uid())
    );

CREATE POLICY "Users can delete own requests" ON partner_requests
    FOR DELETE USING (
        (sender_id = (SELECT auth.uid()) AND status = 'pending')
        OR receiver_id = (SELECT auth.uid())
    );

DROP FUNCTION IF EXISTS public._alter_policy_if_exists(text, text, text, text, text);
