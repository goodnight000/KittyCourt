-- ============================================
-- MIGRATION: Optimize auth calls in RLS policies
-- ============================================
-- Wrap auth.uid()/auth.role() in SELECT to avoid per-row re-evaluation.
-- https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
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

-- Profiles
SELECT public._alter_policy_if_exists(
    'public',
    'profiles',
    'Users can view own profile',
    $$(id = (SELECT auth.uid()))$$,
    NULL
);

SELECT public._alter_policy_if_exists(
    'public',
    'profiles',
    'Users can update own profile',
    $$(id = (SELECT auth.uid()))$$,
    NULL
);

SELECT public._alter_policy_if_exists(
    'public',
    'profiles',
    'Users can insert own profile',
    NULL,
    $$(id = (SELECT auth.uid()))$$
);

SELECT public._alter_policy_if_exists(
    'public',
    'profiles',
    'Users can view own and partner profiles only',
    $$(id = (SELECT auth.uid()) OR id = get_my_partner_id())$$,
    NULL
);

SELECT public._alter_policy_if_exists(
    'public',
    'profiles',
    'Users can view sender of pending partner requests',
    $$(
        id IN (
            SELECT sender_id
            FROM partner_requests
            WHERE receiver_id = (SELECT auth.uid())
              AND status = 'pending'
        )
    )$$,
    NULL
);

-- Court sessions
SELECT public._alter_policy_if_exists(
    'public',
    'court_sessions',
    'Users can view own sessions',
    $$(created_by = (SELECT auth.uid()) OR created_by = get_my_partner_id())$$,
    NULL
);

SELECT public._alter_policy_if_exists(
    'public',
    'court_sessions',
    'Users can update own sessions',
    $$(created_by = (SELECT auth.uid()) OR created_by = get_my_partner_id())$$,
    NULL
);

SELECT public._alter_policy_if_exists(
    'public',
    'court_sessions',
    'Users can create sessions',
    NULL,
    $$(created_by = (SELECT auth.uid()))$$
);

-- Cases
SELECT public._alter_policy_if_exists(
    'public',
    'cases',
    'Users can view couple cases',
    $$(user_a_id = (SELECT auth.uid()) OR user_b_id = (SELECT auth.uid()))$$,
    NULL
);

SELECT public._alter_policy_if_exists(
    'public',
    'cases',
    'Users can insert couple cases',
    NULL,
    $$(
        (user_a_id = (SELECT auth.uid()) AND user_b_id = get_my_partner_id()) OR
        (user_b_id = (SELECT auth.uid()) AND user_a_id = get_my_partner_id())
    )$$
);

SELECT public._alter_policy_if_exists(
    'public',
    'cases',
    'Users can update couple cases',
    $$(user_a_id = (SELECT auth.uid()) OR user_b_id = (SELECT auth.uid()))$$,
    NULL
);

SELECT public._alter_policy_if_exists(
    'public',
    'cases',
    'Users can create cases',
    NULL,
    $$((SELECT auth.uid()) = user_a_id)$$
);

-- Verdicts
SELECT public._alter_policy_if_exists(
    'public',
    'verdicts',
    'Users can view verdicts for own cases',
    $$(
        case_id IN (
            SELECT id
            FROM cases
            WHERE user_a_id = (SELECT auth.uid()) OR user_b_id = (SELECT auth.uid())
        )
    )$$,
    NULL
);

SELECT public._alter_policy_if_exists(
    'public',
    'verdicts',
    'Users can view couple verdicts',
    $$(
        EXISTS (
            SELECT 1
            FROM cases
            WHERE cases.id = verdicts.case_id
              AND (cases.user_a_id = (SELECT auth.uid()) OR cases.user_b_id = (SELECT auth.uid()))
        )
    )$$,
    NULL
);

-- Transactions
SELECT public._alter_policy_if_exists(
    'public',
    'transactions',
    'Users can view own transactions',
    $$(user_id = (SELECT auth.uid()))$$,
    NULL
);

SELECT public._alter_policy_if_exists(
    'public',
    'transactions',
    'Users can create own transactions',
    NULL,
    $$(user_id = (SELECT auth.uid()))$$
);

-- Appreciations
SELECT public._alter_policy_if_exists(
    'public',
    'appreciations',
    'Users can view sent/received appreciations',
    $$(from_user_id = (SELECT auth.uid()) OR to_user_id = (SELECT auth.uid()))$$,
    NULL
);

SELECT public._alter_policy_if_exists(
    'public',
    'appreciations',
    'Users can send appreciations',
    NULL,
    $$(from_user_id = (SELECT auth.uid()))$$
);

SELECT public._alter_policy_if_exists(
    'public',
    'appreciations',
    'Users can view couple appreciations',
    $$(from_user_id = (SELECT auth.uid()) OR to_user_id = (SELECT auth.uid()))$$,
    NULL
);

SELECT public._alter_policy_if_exists(
    'public',
    'appreciations',
    'Users can insert appreciations to partner',
    NULL,
    $$(from_user_id = (SELECT auth.uid()) AND to_user_id = get_my_partner_id())$$
);

-- Daily answers
SELECT public._alter_policy_if_exists(
    'public',
    'daily_answers',
    'Users can view couple daily answers',
    $$(user_id = (SELECT auth.uid()) OR user_id = get_my_partner_id())$$,
    NULL
);

SELECT public._alter_policy_if_exists(
    'public',
    'daily_answers',
    'Users can insert own daily answers',
    NULL,
    $$(user_id = (SELECT auth.uid()))$$
);

SELECT public._alter_policy_if_exists(
    'public',
    'daily_answers',
    'Users can view couple answers',
    $$(user_id = (SELECT auth.uid()) OR user_id = get_my_partner_id())$$,
    NULL
);

SELECT public._alter_policy_if_exists(
    'public',
    'daily_answers',
    'Users can insert own answers',
    NULL,
    $$(user_id = (SELECT auth.uid()))$$
);

SELECT public._alter_policy_if_exists(
    'public',
    'daily_answers',
    'Users can update own answers',
    $$(user_id = (SELECT auth.uid()))$$,
    NULL
);

-- Calendar events
SELECT public._alter_policy_if_exists(
    'public',
    'calendar_events',
    'Users can view couple events',
    $$(
        created_by = (SELECT auth.uid())
        OR (created_by = get_my_partner_id() AND is_secret = FALSE)
    )$$,
    NULL
);

SELECT public._alter_policy_if_exists(
    'public',
    'calendar_events',
    'Users can insert couple events',
    NULL,
    $$(created_by = (SELECT auth.uid()))$$
);

SELECT public._alter_policy_if_exists(
    'public',
    'calendar_events',
    'Users can update couple events',
    $$(
        created_by = (SELECT auth.uid())
        OR (created_by = get_my_partner_id() AND is_secret = FALSE)
    )$$,
    NULL
);

SELECT public._alter_policy_if_exists(
    'public',
    'calendar_events',
    'Users can delete couple events',
    $$(
        created_by = (SELECT auth.uid())
        OR (created_by = get_my_partner_id() AND is_secret = FALSE)
    )$$,
    NULL
);

SELECT public._alter_policy_if_exists(
    'public',
    'calendar_events',
    'Users can create events',
    NULL,
    $$(created_by = (SELECT auth.uid()))$$
);

-- Partner requests
SELECT public._alter_policy_if_exists(
    'public',
    'partner_requests',
    'Users can view requests sent to them',
    $$(receiver_id = (SELECT auth.uid()))$$,
    NULL
);

SELECT public._alter_policy_if_exists(
    'public',
    'partner_requests',
    'Users can view requests they sent',
    $$(sender_id = (SELECT auth.uid()))$$,
    NULL
);

SELECT public._alter_policy_if_exists(
    'public',
    'partner_requests',
    'Users can send partner requests',
    NULL,
    $$(sender_id = (SELECT auth.uid()))$$
);

SELECT public._alter_policy_if_exists(
    'public',
    'partner_requests',
    'Receivers can update request status',
    $$(receiver_id = (SELECT auth.uid()))$$,
    NULL
);

SELECT public._alter_policy_if_exists(
    'public',
    'partner_requests',
    'Senders can delete own pending requests',
    $$(
        sender_id = (SELECT auth.uid())
        AND status = 'pending'
    )$$,
    NULL
);

SELECT public._alter_policy_if_exists(
    'public',
    'partner_requests',
    'Receivers can delete rejected requests',
    $$(receiver_id = (SELECT auth.uid()))$$,
    NULL
);

-- User memories
SELECT public._alter_policy_if_exists(
    'public',
    'user_memories',
    'Users can view own memories',
    $$(user_id = (SELECT auth.uid()))$$,
    NULL
);

-- Reward redemptions
SELECT public._alter_policy_if_exists(
    'public',
    'reward_redemptions',
    'Users can view their redemptions',
    $$(user_id = (SELECT auth.uid()) OR partner_id = (SELECT auth.uid()))$$,
    NULL
);

SELECT public._alter_policy_if_exists(
    'public',
    'reward_redemptions',
    'Users can insert their redemptions',
    NULL,
    $$(user_id = (SELECT auth.uid()) AND partner_id = get_my_partner_id())$$
);

SELECT public._alter_policy_if_exists(
    'public',
    'reward_redemptions',
    'Partners can update redemption status',
    $$(partner_id = (SELECT auth.uid()))$$,
    $$(partner_id = (SELECT auth.uid()))$$
);

-- Usage tracking
SELECT public._alter_policy_if_exists(
    'public',
    'usage_tracking',
    'Users can view own usage',
    $$(user_id = (SELECT auth.uid()))$$,
    NULL
);

-- Couple question assignments
SELECT public._alter_policy_if_exists(
    'public',
    'couple_question_assignments',
    'Users can view own assignments',
    $$(user_a_id = (SELECT auth.uid()) OR user_b_id = (SELECT auth.uid()))$$,
    NULL
);

-- Device tokens
SELECT public._alter_policy_if_exists(
    'public',
    'device_tokens',
    'Users can view own device tokens',
    $$(user_id = (SELECT auth.uid()))$$,
    NULL
);

SELECT public._alter_policy_if_exists(
    'public',
    'device_tokens',
    'Users can insert own device tokens',
    NULL,
    $$(user_id = (SELECT auth.uid()))$$
);

SELECT public._alter_policy_if_exists(
    'public',
    'device_tokens',
    'Users can update own device tokens',
    $$(user_id = (SELECT auth.uid()))$$,
    NULL
);

SELECT public._alter_policy_if_exists(
    'public',
    'device_tokens',
    'Users can delete own device tokens',
    $$(user_id = (SELECT auth.uid()))$$,
    NULL
);

-- Notification preferences
SELECT public._alter_policy_if_exists(
    'public',
    'notification_preferences',
    'Users can view own preferences',
    $$(user_id = (SELECT auth.uid()))$$,
    NULL
);

SELECT public._alter_policy_if_exists(
    'public',
    'notification_preferences',
    'Users can insert own preferences',
    NULL,
    $$(user_id = (SELECT auth.uid()))$$
);

SELECT public._alter_policy_if_exists(
    'public',
    'notification_preferences',
    'Users can update own preferences',
    $$(user_id = (SELECT auth.uid()))$$,
    NULL
);

-- Notification log
SELECT public._alter_policy_if_exists(
    'public',
    'notification_log',
    'Users can view own notification logs',
    $$(user_id = (SELECT auth.uid()))$$,
    NULL
);

-- Event plans
SELECT public._alter_policy_if_exists(
    'public',
    'event_plans',
    'Users can view own event plans',
    $$(user_id = (SELECT auth.uid()))$$,
    NULL
);

SELECT public._alter_policy_if_exists(
    'public',
    'event_plans',
    'Users can insert own event plans',
    NULL,
    $$(user_id = (SELECT auth.uid()))$$
);

SELECT public._alter_policy_if_exists(
    'public',
    'event_plans',
    'Users can update own event plans',
    $$(user_id = (SELECT auth.uid()))$$,
    NULL
);

SELECT public._alter_policy_if_exists(
    'public',
    'event_plans',
    'Users can delete own event plans',
    $$(user_id = (SELECT auth.uid()))$$,
    NULL
);

-- Memories
SELECT public._alter_policy_if_exists(
    'public',
    'memories',
    'Connected couples can view memories',
    $$(
        is_connected() AND
        is_my_couple(user_a_id, user_b_id) AND
        (
            is_deleted = FALSE OR
            (
                is_deleted = TRUE AND
                deleted_by IS NOT NULL AND
                deleted_by != (SELECT auth.uid()) AND
                deleted_at >= (NOW() - INTERVAL '30 days')
            )
        )
    )$$,
    NULL
);

SELECT public._alter_policy_if_exists(
    'public',
    'memories',
    'Connected couples can insert memories',
    NULL,
    $$(
        is_connected() AND
        is_my_couple(user_a_id, user_b_id) AND
        uploaded_by = (SELECT auth.uid())
    )$$
);

SELECT public._alter_policy_if_exists(
    'public',
    'memories',
    'Uploader can soft-delete memories',
    $$(
        is_connected() AND
        is_my_couple(user_a_id, user_b_id) AND
        uploaded_by = (SELECT auth.uid()) AND
        is_deleted = FALSE
    )$$,
    $$(
        is_deleted = TRUE AND
        deleted_by = (SELECT auth.uid()) AND
        deleted_at IS NOT NULL
    )$$
);

SELECT public._alter_policy_if_exists(
    'public',
    'memories',
    'Partner can restore deleted memories',
    $$(
        is_connected() AND
        is_my_couple(user_a_id, user_b_id) AND
        is_deleted = TRUE AND
        deleted_by != (SELECT auth.uid()) AND
        deleted_at >= (NOW() - INTERVAL '30 days')
    )$$,
    $$(
        is_deleted = FALSE AND
        deleted_by IS NULL AND
        deleted_at IS NULL
    )$$
);

SELECT public._alter_policy_if_exists(
    'public',
    'memories',
    'Uploader can restore within 24h',
    $$(
        is_connected() AND
        is_my_couple(user_a_id, user_b_id) AND
        is_deleted = TRUE AND
        deleted_by = (SELECT auth.uid()) AND
        deleted_at >= (NOW() - INTERVAL '24 hours')
    )$$,
    $$(
        is_deleted = FALSE AND
        deleted_by IS NULL AND
        deleted_at IS NULL
    )$$
);

-- Memory reactions
SELECT public._alter_policy_if_exists(
    'public',
    'memory_reactions',
    'Connected couples can add reactions',
    NULL,
    $$(
        is_connected() AND
        user_id = (SELECT auth.uid()) AND
        EXISTS (
            SELECT 1
            FROM memories m
            WHERE m.id = memory_id
              AND is_my_couple(m.user_a_id, m.user_b_id)
              AND m.is_deleted = FALSE
        )
    )$$
);

SELECT public._alter_policy_if_exists(
    'public',
    'memory_reactions',
    'Users can update own reactions',
    $$(user_id = (SELECT auth.uid()))$$,
    NULL
);

SELECT public._alter_policy_if_exists(
    'public',
    'memory_reactions',
    'Users can delete own reactions',
    $$(user_id = (SELECT auth.uid()))$$,
    NULL
);

-- Memory comments
SELECT public._alter_policy_if_exists(
    'public',
    'memory_comments',
    'Connected couples can add comments',
    NULL,
    $$(
        is_connected() AND
        user_id = (SELECT auth.uid()) AND
        EXISTS (
            SELECT 1
            FROM memories m
            WHERE m.id = memory_id
              AND is_my_couple(m.user_a_id, m.user_b_id)
              AND m.is_deleted = FALSE
        )
    )$$
);

SELECT public._alter_policy_if_exists(
    'public',
    'memory_comments',
    'Users can update own comments',
    $$(user_id = (SELECT auth.uid()))$$,
    NULL
);

-- Challenges
SELECT public._alter_policy_if_exists(
    'public',
    'challenges',
    'Challenges are readable',
    $$((SELECT auth.role()) = 'authenticated')$$,
    NULL
);

-- Badges
SELECT public._alter_policy_if_exists(
    'public',
    'badges',
    'Badges are readable',
    $$((SELECT auth.role()) = 'authenticated')$$,
    NULL
);

-- Insights
SELECT public._alter_policy_if_exists(
    'public',
    'insights',
    'Consented couples can view insights',
    $$(
        is_connected() AND
        is_my_couple(user_a_id, user_b_id) AND
        EXISTS (
            SELECT 1
            FROM profiles p1, profiles p2
            WHERE p1.id = (SELECT auth.uid())
              AND p2.id = get_my_partner_id()
              AND p1.ai_insights_consent = TRUE
              AND p2.ai_insights_consent = TRUE
              AND (p1.ai_insights_paused_until IS NULL OR p1.ai_insights_paused_until < NOW())
              AND (p2.ai_insights_paused_until IS NULL OR p2.ai_insights_paused_until < NOW())
        )
    )$$,
    NULL
);

-- User stats
SELECT public._alter_policy_if_exists(
    'public',
    'user_stats',
    'Users can view own stats',
    $$((SELECT auth.uid()) = user_id)$$,
    NULL
);

SELECT public._alter_policy_if_exists(
    'public',
    'user_stats',
    'Users can update own stats',
    $$((SELECT auth.uid()) = user_id)$$,
    NULL
);

SELECT public._alter_policy_if_exists(
    'public',
    'user_stats',
    'Users can insert own stats',
    NULL,
    $$((SELECT auth.uid()) = user_id)$$
);

-- User feedback
SELECT public._alter_policy_if_exists(
    'public',
    'user_feedback',
    'Users can insert own feedback',
    NULL,
    $$((SELECT auth.uid()) = user_id)$$
);

-- Disconnect history
SELECT public._alter_policy_if_exists(
    'public',
    'couple_disconnect_history',
    'Users can view their disconnect history',
    $$((SELECT auth.uid()) = user_a_id OR (SELECT auth.uid()) = user_b_id)$$,
    NULL
);

DROP FUNCTION IF EXISTS public._alter_policy_if_exists(text, text, text, text, text);
