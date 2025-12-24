-- ============================================
-- SECURITY HARDENING MIGRATION
-- ============================================
-- Tightens RLS policies, restricts RPC access,
-- and adds data integrity guards for production.
-- ============================================

-- ============================================
-- 1) user_memories: remove permissive write policies
-- ============================================
DROP POLICY IF EXISTS "Anyone can insert memories" ON user_memories;
DROP POLICY IF EXISTS "Anyone can update memories" ON user_memories;
DROP POLICY IF EXISTS "Users can insert own memories" ON user_memories;
DROP POLICY IF EXISTS "Users can update own memories" ON user_memories;

CREATE POLICY "Service role can insert memories" ON user_memories
    FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "Service role can update memories" ON user_memories
    FOR UPDATE TO service_role USING (true) WITH CHECK (true);

-- ============================================
-- 2) verdicts: restrict inserts to service role
-- ============================================
DROP POLICY IF EXISTS "Allow verdict inserts" ON verdicts;

CREATE POLICY "Service role can insert verdicts" ON verdicts
    FOR INSERT TO service_role WITH CHECK (true);

-- ============================================
-- 3) couple_question_assignments: service-only writes
-- ============================================
DROP POLICY IF EXISTS "Service can manage assignments" ON couple_question_assignments;

CREATE POLICY "Service role can manage assignments" ON couple_question_assignments
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================
-- 4) question_bank: restrict reads to authenticated
-- ============================================
DROP POLICY IF EXISTS "Anyone can read question bank" ON question_bank;

CREATE POLICY "Authenticated can read question bank" ON question_bank
    FOR SELECT TO authenticated USING (true);

-- ============================================
-- 5) usage_tracking: prevent client-side tampering
-- ============================================
DROP POLICY IF EXISTS "Users can insert own usage" ON usage_tracking;
DROP POLICY IF EXISTS "Users can update own usage" ON usage_tracking;

REVOKE ALL ON FUNCTION increment_usage(UUID, DATE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_usage(UUID, DATE, TEXT) TO service_role;

-- ============================================
-- 6) RPC access: restrict to required roles
-- ============================================
REVOKE ALL ON FUNCTION get_todays_question(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_todays_question(UUID, UUID) TO service_role;

REVOKE ALL ON FUNCTION get_couple_ids(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_couple_ids(UUID, UUID) TO service_role;

REVOKE ALL ON FUNCTION search_similar_memories(vector, UUID, FLOAT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION search_similar_memories(vector, UUID, FLOAT, INT) TO service_role;

REVOKE ALL ON FUNCTION search_similar_memories(vector(1536), UUID, DOUBLE PRECISION, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION search_similar_memories(vector(1536), UUID, DOUBLE PRECISION, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION retrieve_relevant_memories(vector, UUID[], INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION retrieve_relevant_memories(vector, UUID[], INT) TO service_role;

REVOKE ALL ON FUNCTION retrieve_relevant_memories(vector(1536), UUID[], INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION retrieve_relevant_memories(vector(1536), UUID[], INTEGER) TO service_role;

REVOKE ALL ON FUNCTION get_user_memory_context(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_user_memory_context(UUID, INT) TO service_role;

REVOKE ALL ON FUNCTION get_my_partner_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_my_partner_id() TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_partner_id() TO service_role;

REVOKE ALL ON FUNCTION lookup_user_by_partner_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lookup_user_by_partner_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION lookup_user_by_partner_code(TEXT) TO service_role;

-- ============================================
-- 7) Partner request sender access: return limited profile fields
-- ============================================
DROP POLICY IF EXISTS "Users can view sender of pending partner requests" ON profiles;

CREATE OR REPLACE FUNCTION get_pending_partner_request_senders()
RETURNS TABLE(
    id UUID,
    display_name TEXT,
    avatar_url TEXT,
    partner_code TEXT
) AS $$
    SELECT p.id, p.display_name, p.avatar_url, p.partner_code
    FROM partner_requests pr
    JOIN profiles p ON p.id = pr.sender_id
    WHERE pr.receiver_id = auth.uid()
      AND pr.status = 'pending'
$$ LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public;

REVOKE ALL ON FUNCTION get_pending_partner_request_senders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_pending_partner_request_senders() TO authenticated;

-- ============================================
-- 8) Partner connection: block relinking and invalid dates
-- ============================================
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

    v_now := NOW();

    UPDATE partner_requests
    SET status = 'accepted', responded_at = v_now
    WHERE id = p_request_id;

    UPDATE profiles
    SET 
        partner_id = v_sender_id,
        partner_connected_at = v_now,
        anniversary_date = COALESCE(p_anniversary_date, anniversary_date)
    WHERE id = v_receiver_id;

    UPDATE profiles
    SET 
        partner_id = v_receiver_id,
        partner_connected_at = v_now,
        anniversary_date = COALESCE(p_anniversary_date, anniversary_date)
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

-- ============================================
-- 9) Data integrity checks
-- ============================================
ALTER TABLE partner_requests
ADD CONSTRAINT partner_requests_no_self_request
CHECK (sender_id <> receiver_id);

ALTER TABLE profiles
ADD CONSTRAINT profiles_partner_code_length_check
CHECK (length(partner_code) = 12);

ALTER TABLE profiles
ADD CONSTRAINT profiles_partner_not_self_check
CHECK (partner_id IS NULL OR partner_id <> id);

-- ============================================
-- 10) reward_redemptions: enforce partner ownership
-- ============================================
DROP POLICY IF EXISTS "Users can insert their redemptions" ON reward_redemptions;
DROP POLICY IF EXISTS "Partners can update redemption status" ON reward_redemptions;

CREATE POLICY "Users can insert their redemptions" ON reward_redemptions
    FOR INSERT WITH CHECK (
        user_id = auth.uid() AND partner_id = get_my_partner_id()
    );

CREATE POLICY "Partners can update redemption status" ON reward_redemptions
    FOR UPDATE USING (partner_id = auth.uid()) WITH CHECK (partner_id = auth.uid());

-- ============================================
-- DONE
-- ============================================
