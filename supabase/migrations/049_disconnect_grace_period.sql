-- ============================================================================
-- Relationship disconnect grace period (30-day restore window)
-- ============================================================================
-- Behavior:
-- - On disconnect, we record the couple in couple_disconnect_history.
-- - If they reconnect to each other within 30 days, everything remains/restores.
-- - If they do not reconnect within 30 days, relationship data is purged.
-- - If either user connects to a NEW partner during the 30-day window, the prior
--   relationship data is purged immediately (restoration forfeited).
-- ============================================================================

-- RLS: allow users to view their own disconnect status rows (UI)
DROP POLICY IF EXISTS "Users can view their disconnect history" ON couple_disconnect_history;
CREATE POLICY "Users can view their disconnect history"
ON couple_disconnect_history FOR SELECT
USING (
    auth.uid() = user_a_id OR auth.uid() = user_b_id
);

-- ----------------------------------------------------------------------------
-- Purge helper: delete relationship-scoped data for a couple
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION purge_couple_data(
    p_user_a_id UUID,
    p_user_b_id UUID,
    p_cutoff TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_a UUID;
    v_user_b UUID;
BEGIN
    IF p_user_a_id IS NULL OR p_user_b_id IS NULL THEN
        RETURN json_build_object('error', 'Missing couple IDs');
    END IF;

    -- Ensure consistent ordering for couple-scoped tables
    IF p_user_a_id < p_user_b_id THEN
        v_user_a := p_user_a_id;
        v_user_b := p_user_b_id;
    ELSE
        v_user_a := p_user_b_id;
        v_user_b := p_user_a_id;
    END IF;

    -- Partner requests between them (any state)
    DELETE FROM partner_requests
    WHERE (sender_id = v_user_a AND receiver_id = v_user_b)
       OR (sender_id = v_user_b AND receiver_id = v_user_a);

    -- Court sessions linked to their cases (avoid FK issues), and direct sessions between them
    DELETE FROM court_sessions
    WHERE case_id IN (
        SELECT id FROM cases
        WHERE (user_a_id = v_user_a AND user_b_id = v_user_b)
           OR (user_a_id = v_user_b AND user_b_id = v_user_a)
    );

    DELETE FROM court_sessions
    WHERE (created_by = v_user_a AND partner_id = v_user_b)
       OR (created_by = v_user_b AND partner_id = v_user_a);

    -- Cases + verdicts (verdicts cascade on case delete)
    DELETE FROM cases
    WHERE (user_a_id = v_user_a AND user_b_id = v_user_b)
       OR (user_a_id = v_user_b AND user_b_id = v_user_a);

    -- Appreciations
    DELETE FROM appreciations
    WHERE (from_user_id = v_user_a AND to_user_id = v_user_b)
       OR (from_user_id = v_user_b AND to_user_id = v_user_a);

    -- Kibble reward redemptions
    DELETE FROM reward_redemptions
    WHERE (user_id = v_user_a AND partner_id = v_user_b)
       OR (user_id = v_user_b AND partner_id = v_user_a);

    -- Daily questions (answers cascade via assignments)
    DELETE FROM couple_question_assignments
    WHERE (user_a_id = v_user_a AND user_b_id = v_user_b)
       OR (user_a_id = v_user_b AND user_b_id = v_user_a);

    -- Couple progression + content
    DELETE FROM challenge_assignments
    WHERE user_a_id = v_user_a AND user_b_id = v_user_b;

    DELETE FROM couple_challenges
    WHERE user_a_id = v_user_a AND user_b_id = v_user_b;

    DELETE FROM couple_badges
    WHERE user_a_id = v_user_a AND user_b_id = v_user_b;

    DELETE FROM insights
    WHERE user_a_id = v_user_a AND user_b_id = v_user_b;

    DELETE FROM relationship_stats
    WHERE user_a_id = v_user_a AND user_b_id = v_user_b;

    DELETE FROM memories
    WHERE user_a_id = v_user_a AND user_b_id = v_user_b;

    -- xp_transactions cascade from couple_levels, but delete explicitly for clarity
    DELETE FROM xp_transactions
    WHERE user_a_id = v_user_a AND user_b_id = v_user_b;

    DELETE FROM couple_levels
    WHERE user_a_id = v_user_a AND user_b_id = v_user_b;

    -- Relationship-linked per-user rows
    --
    -- event_plans explicitly tracks partner_id, so it's safe to delete just plans tied to this relationship.
    DELETE FROM event_plans
    WHERE (user_id = v_user_a AND partner_id = v_user_b)
       OR (user_id = v_user_b AND partner_id = v_user_a);

    -- Remove the auto-created anniversary event for this relationship (doesn't belong after breakup)
    DELETE FROM calendar_events
    WHERE created_by IN (v_user_a, v_user_b)
      AND event_type = 'anniversary'
      AND title = 'Our Anniversary';

    RETURN json_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION purge_couple_data(UUID, UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION purge_couple_data(UUID, UUID, TIMESTAMPTZ) TO service_role;

-- ----------------------------------------------------------------------------
-- Purge expired disconnects (service role; typically run on a schedule)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION purge_expired_disconnect_couples()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row RECORD;
    v_purged_count INTEGER := 0;
BEGIN
    FOR v_row IN
        SELECT user_a_id, user_b_id, disconnected_at
        FROM couple_disconnect_history
        WHERE disconnected_at < (NOW() - INTERVAL '30 days')
        ORDER BY disconnected_at ASC
    LOOP
        PERFORM purge_couple_data(v_row.user_a_id, v_row.user_b_id, v_row.disconnected_at);
        DELETE FROM couple_disconnect_history
        WHERE user_a_id = v_row.user_a_id AND user_b_id = v_row.user_b_id;
        v_purged_count := v_purged_count + 1;
    END LOOP;

    RETURN json_build_object('success', true, 'purged', v_purged_count);
END;
$$;

REVOKE ALL ON FUNCTION purge_expired_disconnect_couples() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION purge_expired_disconnect_couples() TO service_role;

-- ----------------------------------------------------------------------------
-- UI helper: return the most recent disconnect state for the current user
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_my_disconnect_status()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_row RECORD;
    v_days_left INTEGER;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN json_build_object('error', 'Not authenticated');
    END IF;

    SELECT
        h.user_a_id,
        h.user_b_id,
        h.disconnected_by,
        h.disconnected_at,
        CASE WHEN h.user_a_id = v_user_id THEN h.user_b_id ELSE h.user_a_id END AS other_id,
        CASE WHEN h.user_a_id = v_user_id THEN pb.display_name ELSE pa.display_name END AS other_name,
        CASE WHEN h.user_a_id = v_user_id THEN pb.avatar_url ELSE pa.avatar_url END AS other_avatar_url
    INTO v_row
    FROM couple_disconnect_history h
    JOIN profiles pa ON pa.id = h.user_a_id
    JOIN profiles pb ON pb.id = h.user_b_id
    WHERE (h.user_a_id = v_user_id OR h.user_b_id = v_user_id)
      AND h.disconnected_at >= (NOW() - INTERVAL '30 days')
    ORDER BY h.disconnected_at DESC
    LIMIT 1;

    IF v_row IS NULL THEN
        RETURN json_build_object('status', 'none');
    END IF;

    v_days_left := GREATEST(
        0,
        CEIL(EXTRACT(EPOCH FROM ((v_row.disconnected_at + INTERVAL '30 days') - NOW())) / 86400.0)
    )::INT;

    RETURN json_build_object(
        'status', 'disconnected',
        'other_id', v_row.other_id,
        'other_name', COALESCE(v_row.other_name, 'your partner'),
        'other_avatar_url', v_row.other_avatar_url,
        'disconnected_by', v_row.disconnected_by,
        'disconnected_at', v_row.disconnected_at,
        'days_left', v_days_left
    );
END;
$$;

REVOKE ALL ON FUNCTION get_my_disconnect_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_my_disconnect_status() TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_disconnect_status() TO service_role;

-- ----------------------------------------------------------------------------
-- Update disconnect_partner to record grace-window state
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION disconnect_partner()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_partner_id UUID;
    v_user_a UUID;
    v_user_b UUID;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RETURN json_build_object('error', 'Not authenticated');
    END IF;

    -- Get current partner
    SELECT partner_id INTO v_partner_id FROM profiles WHERE id = v_user_id;

    IF v_partner_id IS NULL THEN
        RETURN json_build_object('error', 'No partner connected');
    END IF;

    -- Order the couple IDs for couple-scoped tables
    IF v_user_id < v_partner_id THEN
        v_user_a := v_user_id;
        v_user_b := v_partner_id;
    ELSE
        v_user_a := v_partner_id;
        v_user_b := v_user_id;
    END IF;

    -- Clear both profiles' partner references
    UPDATE profiles SET
        partner_id = NULL,
        partner_connected_at = NULL
    WHERE id IN (v_user_id, v_partner_id);

    -- Delete pending partner requests between them
    DELETE FROM partner_requests
    WHERE (sender_id = v_user_id AND receiver_id = v_partner_id)
       OR (sender_id = v_partner_id AND receiver_id = v_user_id);

    -- Record for 30-day grace period tracking
    INSERT INTO couple_disconnect_history (user_a_id, user_b_id, disconnected_by, disconnected_at)
    VALUES (v_user_a, v_user_b, v_user_id, NOW())
    ON CONFLICT (user_a_id, user_b_id)
    DO UPDATE SET
        disconnected_by = EXCLUDED.disconnected_by,
        disconnected_at = EXCLUDED.disconnected_at;

    RETURN json_build_object('success', true, 'disconnected_at', NOW());
END;
$$;

REVOKE ALL ON FUNCTION disconnect_partner() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION disconnect_partner() TO authenticated;
GRANT EXECUTE ON FUNCTION disconnect_partner() TO service_role;

-- ----------------------------------------------------------------------------
-- Update accept_partner_connection to purge forfeited relationships
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION accept_partner_connection(
    p_request_id UUID,
    p_anniversary_date DATE DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
	DECLARE
	    v_request RECORD;
	    v_receiver_id UUID;
	    v_sender_id UUID;
	    v_receiver_partner UUID;
	    v_sender_partner UUID;
	    v_now TIMESTAMPTZ;
	    v_result JSON;
	    v_hist RECORD;
	    v_other_id UUID;
	    v_pair_a UUID;
	    v_pair_b UUID;
	    v_is_reconnect BOOLEAN := FALSE;
	    v_pair_disconnected_at TIMESTAMPTZ;
	BEGIN
    v_receiver_id := auth.uid();

    IF v_receiver_id IS NULL THEN
        RETURN json_build_object('error', 'Not authenticated');
    END IF;

    SELECT * INTO v_request
    FROM partner_requests
    WHERE id = p_request_id AND receiver_id = v_receiver_id AND status = 'pending';

    IF v_request IS NULL THEN
        RETURN json_build_object('error', 'Request not found or already processed');
    END IF;

    v_sender_id := v_request.sender_id;

    IF p_anniversary_date IS NOT NULL AND NOT is_valid_past_date(p_anniversary_date) THEN
        RETURN json_build_object('error', 'Invalid anniversary date');
    END IF;

    SELECT partner_id INTO v_receiver_partner FROM profiles WHERE id = v_receiver_id;
    SELECT partner_id INTO v_sender_partner FROM profiles WHERE id = v_sender_id;

	IF v_receiver_partner IS NOT NULL OR v_sender_partner IS NOT NULL THEN
	    RETURN json_build_object('error', 'One or both users already connected');
	END IF;

	-- Determine if this is a reconnect to the same prior partner (grace window)
	IF v_receiver_id < v_sender_id THEN
	    v_pair_a := v_receiver_id;
	    v_pair_b := v_sender_id;
	ELSE
	    v_pair_a := v_sender_id;
	    v_pair_b := v_receiver_id;
	END IF;

	SELECT disconnected_at INTO v_pair_disconnected_at
	FROM couple_disconnect_history
	WHERE user_a_id = v_pair_a AND user_b_id = v_pair_b
	LIMIT 1;

	IF v_pair_disconnected_at IS NOT NULL THEN
	    IF v_pair_disconnected_at < (NOW() - INTERVAL '30 days') THEN
	        -- Expired window: purge before allowing a "fresh" connection, even if the scheduler hasn't run yet
	        PERFORM purge_couple_data(v_pair_a, v_pair_b, v_pair_disconnected_at);
	        DELETE FROM couple_disconnect_history WHERE user_a_id = v_pair_a AND user_b_id = v_pair_b;
	        v_is_reconnect := FALSE;
	    ELSE
	        v_is_reconnect := TRUE;
	    END IF;
	END IF;

    -- If either user connects to a NEW partner while they have a pending disconnect window
    -- with someone else, they forfeit restoration and the old relationship data is purged.
    FOR v_hist IN
        SELECT user_a_id, user_b_id, disconnected_at
        FROM couple_disconnect_history
        WHERE (user_a_id = v_receiver_id OR user_b_id = v_receiver_id)
    LOOP
        v_other_id := CASE WHEN v_hist.user_a_id = v_receiver_id THEN v_hist.user_b_id ELSE v_hist.user_a_id END;
        IF v_other_id <> v_sender_id THEN
            PERFORM purge_couple_data(v_hist.user_a_id, v_hist.user_b_id, v_hist.disconnected_at);
            DELETE FROM couple_disconnect_history
            WHERE user_a_id = v_hist.user_a_id AND user_b_id = v_hist.user_b_id;
        END IF;
    END LOOP;

    FOR v_hist IN
        SELECT user_a_id, user_b_id, disconnected_at
        FROM couple_disconnect_history
        WHERE (user_a_id = v_sender_id OR user_b_id = v_sender_id)
    LOOP
        v_other_id := CASE WHEN v_hist.user_a_id = v_sender_id THEN v_hist.user_b_id ELSE v_hist.user_a_id END;
        IF v_other_id <> v_receiver_id THEN
            PERFORM purge_couple_data(v_hist.user_a_id, v_hist.user_b_id, v_hist.disconnected_at);
            DELETE FROM couple_disconnect_history
            WHERE user_a_id = v_hist.user_a_id AND user_b_id = v_hist.user_b_id;
        END IF;
    END LOOP;

    v_now := NOW();

    UPDATE partner_requests
    SET status = 'accepted', responded_at = v_now
    WHERE id = p_request_id;

	UPDATE profiles
	SET
	    partner_id = v_sender_id,
	    partner_connected_at = v_now,
	    anniversary_date = CASE
	        WHEN v_is_reconnect THEN COALESCE(p_anniversary_date, anniversary_date)
	        ELSE p_anniversary_date
	    END
	WHERE id = v_receiver_id;

	UPDATE profiles
	SET
	    partner_id = v_receiver_id,
	    partner_connected_at = v_now,
	    anniversary_date = CASE
	        WHEN v_is_reconnect THEN COALESCE(p_anniversary_date, anniversary_date)
	        ELSE p_anniversary_date
	    END
	WHERE id = v_sender_id;

    IF p_anniversary_date IS NOT NULL THEN
        INSERT INTO calendar_events (
            created_by,
            title,
            notes,
            event_date,
            event_type,
            is_recurring,
            recurrence_pattern
        ) VALUES (
            v_receiver_id,
            'Our Anniversary',
            'The day we started our journey together.',
            p_anniversary_date,
            'anniversary',
            true,
            'yearly'
        );
    END IF;

    SELECT json_build_object(
        'success', true,
        'receiver_id', v_receiver_id,
        'sender_id', v_sender_id,
        'anniversary_date', p_anniversary_date
    ) INTO v_result;

    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION accept_partner_connection(UUID, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION accept_partner_connection(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_partner_connection(UUID, DATE) TO service_role;
