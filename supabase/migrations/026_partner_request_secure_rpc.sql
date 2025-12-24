-- ============================================
-- MIGRATION: Secure Partner Request RPCs
-- ============================================
-- Provides restricted profile fields for partner request flows
-- without exposing full profiles via RLS joins.
-- ============================================

CREATE OR REPLACE FUNCTION get_pending_partner_requests()
RETURNS TABLE(
    id UUID,
    sender_id UUID,
    receiver_id UUID,
    status TEXT,
    message TEXT,
    created_at TIMESTAMPTZ,
    responded_at TIMESTAMPTZ,
    sender_display_name TEXT,
    sender_avatar_url TEXT,
    sender_partner_code TEXT
) AS $$
    SELECT
        pr.id,
        pr.sender_id,
        pr.receiver_id,
        pr.status,
        pr.message,
        pr.created_at,
        pr.responded_at,
        p.display_name,
        p.avatar_url,
        p.partner_code
    FROM partner_requests pr
    JOIN profiles p ON p.id = pr.sender_id
    WHERE pr.receiver_id = auth.uid()
      AND pr.status = 'pending'
    ORDER BY pr.created_at DESC
$$ LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public;

REVOKE ALL ON FUNCTION get_pending_partner_requests() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_pending_partner_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_partner_requests() TO service_role;

CREATE OR REPLACE FUNCTION get_sent_partner_requests()
RETURNS TABLE(
    id UUID,
    sender_id UUID,
    receiver_id UUID,
    status TEXT,
    message TEXT,
    created_at TIMESTAMPTZ,
    responded_at TIMESTAMPTZ,
    receiver_display_name TEXT,
    receiver_avatar_url TEXT,
    receiver_partner_code TEXT
) AS $$
    SELECT
        pr.id,
        pr.sender_id,
        pr.receiver_id,
        pr.status,
        pr.message,
        pr.created_at,
        pr.responded_at,
        p.display_name,
        p.avatar_url,
        p.partner_code
    FROM partner_requests pr
    JOIN profiles p ON p.id = pr.receiver_id
    WHERE pr.sender_id = auth.uid()
      AND pr.status = 'pending'
    ORDER BY pr.created_at DESC
$$ LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public;

REVOKE ALL ON FUNCTION get_sent_partner_requests() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_sent_partner_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION get_sent_partner_requests() TO service_role;

-- ============================================
-- DONE
-- ============================================
