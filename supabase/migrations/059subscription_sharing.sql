-- ============================================
-- SUBSCRIPTION SHARING SUPPORT
-- ============================================

-- Track whether Gold access is shared from a partner
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS subscription_shared_by UUID;

CREATE INDEX IF NOT EXISTS idx_profiles_subscription_shared_by
    ON profiles(subscription_shared_by);

-- ----------------------------------------------------------------------------
-- Update disconnect_partner to revoke shared Gold access
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

    -- Revoke shared Gold access for either side
    UPDATE profiles
    SET
        subscription_tier = 'free',
        subscription_expires_at = NULL,
        subscription_shared_by = NULL
    WHERE id = v_partner_id
      AND subscription_shared_by = v_user_id;

    UPDATE profiles
    SET
        subscription_tier = 'free',
        subscription_expires_at = NULL,
        subscription_shared_by = NULL
    WHERE id = v_user_id
      AND subscription_shared_by = v_partner_id;

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
-- Update accept_partner_connection to sync Gold sharing
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
        v_sender_tier TEXT;
        v_sender_expires TIMESTAMPTZ;
        v_sender_shared_by UUID;
        v_receiver_tier TEXT;
        v_receiver_expires TIMESTAMPTZ;
        v_receiver_shared_by UUID;
        v_sender_active_owner BOOLEAN := FALSE;
        v_receiver_active_owner BOOLEAN := FALSE;
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

    -- Sync Gold access if only one partner is the active owner
    SELECT subscription_tier, subscription_expires_at, subscription_shared_by
    INTO v_sender_tier, v_sender_expires, v_sender_shared_by
    FROM profiles WHERE id = v_sender_id;

    SELECT subscription_tier, subscription_expires_at, subscription_shared_by
    INTO v_receiver_tier, v_receiver_expires, v_receiver_shared_by
    FROM profiles WHERE id = v_receiver_id;

    v_sender_active_owner := v_sender_tier = 'pause_gold'
        AND v_sender_shared_by IS NULL
        AND (v_sender_expires IS NULL OR v_sender_expires >= v_now);

    v_receiver_active_owner := v_receiver_tier = 'pause_gold'
        AND v_receiver_shared_by IS NULL
        AND (v_receiver_expires IS NULL OR v_receiver_expires >= v_now);

    IF v_sender_active_owner AND NOT v_receiver_active_owner THEN
        UPDATE profiles
        SET
            subscription_tier = 'pause_gold',
            subscription_expires_at = v_sender_expires,
            subscription_shared_by = v_sender_id
        WHERE id = v_receiver_id;
    ELSIF v_receiver_active_owner AND NOT v_sender_active_owner THEN
        UPDATE profiles
        SET
            subscription_tier = 'pause_gold',
            subscription_expires_at = v_receiver_expires,
            subscription_shared_by = v_receiver_id
        WHERE id = v_sender_id;
    END IF;

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
