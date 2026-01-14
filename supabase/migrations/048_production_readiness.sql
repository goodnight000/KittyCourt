-- Migration: 048_production_readiness.sql
-- Description: Partner disconnect function for production readiness

-- Partner disconnect function
-- Allows a user to disconnect from their partner, clearing both profiles
CREATE OR REPLACE FUNCTION disconnect_partner()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_partner_id UUID;
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

    -- Clear both profiles' partner references
    UPDATE profiles SET
        partner_id = NULL,
        partner_connected_at = NULL
    WHERE id IN (v_user_id, v_partner_id);

    -- Delete pending partner requests between them
    DELETE FROM partner_requests
    WHERE (sender_id = v_user_id AND receiver_id = v_partner_id)
       OR (sender_id = v_partner_id AND receiver_id = v_user_id);

    RETURN json_build_object('success', true, 'disconnected_at', NOW());
END;
$$;

-- Revoke public access and grant only to authenticated users
REVOKE ALL ON FUNCTION disconnect_partner() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION disconnect_partner() TO authenticated;

-- ============================================================================
-- Account Deletion (Required for Apple App Store compliance)
-- ============================================================================

-- Account deletion function with cascade cleanup
CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_partner_id UUID;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RETURN json_build_object('error', 'Not authenticated');
    END IF;

    -- Get partner ID before deletion
    SELECT partner_id INTO v_partner_id FROM profiles WHERE id = v_user_id;

    -- Clear partner's reference to this user (bidirectional link)
    IF v_partner_id IS NOT NULL THEN
        UPDATE profiles
        SET partner_id = NULL, partner_connected_at = NULL
        WHERE id = v_partner_id;
    END IF;

    -- Deactivate push tokens
    UPDATE device_tokens SET active = false, deactivated_at = NOW() WHERE user_id = v_user_id;

    -- Delete user's memories
    DELETE FROM user_memories WHERE user_id = v_user_id;

    -- Soft-delete profile (keep for audit, remove PII)
    UPDATE profiles SET
        email = 'deleted_' || v_user_id || '@deleted.local',
        display_name = 'Deleted User',
        avatar_url = NULL,
        partner_code = NULL,
        partner_id = NULL,
        deleted_at = NOW()
    WHERE id = v_user_id;

    RETURN json_build_object('success', true, 'deleted_at', NOW());
END;
$$;

-- Security: Restrict function access
REVOKE ALL ON FUNCTION delete_user_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_user_account() TO authenticated;

-- Add deleted_at column to profiles if not exists (for soft delete tracking)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE profiles ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    END IF;
END $$;

-- Index for finding deleted accounts (useful for cleanup jobs)
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON profiles(deleted_at) WHERE deleted_at IS NOT NULL;

COMMENT ON FUNCTION delete_user_account() IS 'Safely deletes user account: removes PII, disconnects partner, cleans up memories. Required for App Store compliance.';
