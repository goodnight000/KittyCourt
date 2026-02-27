-- ============================================
-- SUBSCRIPTION SECURITY HARDENING
-- ============================================
-- Goals:
-- 1) Prevent authenticated clients from directly editing subscription fields.
-- 2) Re-assert RPC execute grants so usage RPCs are service-role only.
-- ============================================

-- Keep subscription tier values constrained.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS store_customer_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_shared_by UUID;

DO $$
BEGIN
    ALTER TABLE profiles
        ADD CONSTRAINT profiles_subscription_tier_check
        CHECK (subscription_tier IN ('free', 'pause_gold'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Block direct client-side subscription tampering via inserts/updates.
REVOKE INSERT (subscription_tier, subscription_expires_at, store_customer_id, subscription_shared_by)
ON TABLE profiles
FROM anon;

REVOKE INSERT (subscription_tier, subscription_expires_at, store_customer_id, subscription_shared_by)
ON TABLE profiles
FROM authenticated;

GRANT INSERT (subscription_tier, subscription_expires_at, store_customer_id, subscription_shared_by)
ON TABLE profiles
TO service_role;

REVOKE UPDATE (subscription_tier, subscription_expires_at, store_customer_id, subscription_shared_by)
ON TABLE profiles
FROM anon;

REVOKE UPDATE (subscription_tier, subscription_expires_at, store_customer_id, subscription_shared_by)
ON TABLE profiles
FROM authenticated;

GRANT UPDATE (subscription_tier, subscription_expires_at, store_customer_id, subscription_shared_by)
ON TABLE profiles
TO service_role;

-- Ensure usage RPCs are not callable by client roles.
REVOKE ALL ON FUNCTION increment_usage(UUID, DATE, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION increment_usage(UUID, DATE, TEXT) FROM anon;
REVOKE ALL ON FUNCTION increment_usage(UUID, DATE, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION increment_usage(UUID, DATE, TEXT) TO service_role;

REVOKE ALL ON FUNCTION get_couple_usage(UUID, DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_couple_usage(UUID, DATE) FROM anon;
REVOKE ALL ON FUNCTION get_couple_usage(UUID, DATE) FROM authenticated;
GRANT EXECUTE ON FUNCTION get_couple_usage(UUID, DATE) TO service_role;
