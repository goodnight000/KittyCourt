-- ============================================
-- SECURITY HARDENING V2 MIGRATION
-- ============================================
-- Additional security controls for defense-in-depth
-- Migration: 043_security_hardening_v2.sql
-- ============================================

-- ============================================
-- 1) Add rate limiting table for partner code lookups
-- ============================================
-- This tracks lookup attempts to prevent brute-force enumeration

CREATE TABLE IF NOT EXISTS security_rate_limits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    ip_address INET,
    action_type TEXT NOT NULL,
    attempt_count INTEGER DEFAULT 1,
    window_start TIMESTAMPTZ DEFAULT NOW(),
    blocked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_rate_limit_key UNIQUE (user_id, action_type, window_start)
);

-- RLS for rate limits (service role only)
ALTER TABLE security_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages rate limits" ON security_rate_limits
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================
-- 2) Create secure partner code lookup with rate limiting
-- ============================================
DROP FUNCTION IF EXISTS lookup_user_by_partner_code(TEXT);

CREATE OR REPLACE FUNCTION lookup_user_by_partner_code(code TEXT)
RETURNS TABLE(id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_recent_attempts INTEGER;
BEGIN
    v_caller_id := auth.uid();

    -- Rate limiting: max 10 lookups per hour per user
    IF v_caller_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_recent_attempts
        FROM security_rate_limits
        WHERE user_id = v_caller_id
          AND action_type = 'partner_code_lookup'
          AND window_start > NOW() - INTERVAL '1 hour';

        IF v_recent_attempts >= 10 THEN
            RAISE EXCEPTION 'Rate limit exceeded for partner code lookup';
        END IF;

        -- Record this attempt
        INSERT INTO security_rate_limits (user_id, action_type, attempt_count)
        VALUES (v_caller_id, 'partner_code_lookup', 1)
        ON CONFLICT (user_id, action_type, window_start)
        DO UPDATE SET attempt_count = security_rate_limits.attempt_count + 1;
    END IF;

    -- Return only the ID, no other fields
    RETURN QUERY SELECT p.id FROM profiles p WHERE p.partner_code = code;
END;
$$;

REVOKE ALL ON FUNCTION lookup_user_by_partner_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lookup_user_by_partner_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION lookup_user_by_partner_code(TEXT) TO service_role;

-- ============================================
-- 3) Security audit log table
-- ============================================
CREATE TABLE IF NOT EXISTS security_audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    target_user_id UUID,
    ip_address INET,
    user_agent TEXT,
    event_data JSONB DEFAULT '{}',
    severity TEXT DEFAULT 'INFO' CHECK (severity IN ('DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for audit log (service role only for writes, admins for reads)
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can insert audit logs" ON security_audit_log
    FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "Service role can read audit logs" ON security_audit_log
    FOR SELECT TO service_role USING (true);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_security_audit_log_user_id ON security_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_event_type ON security_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_created_at ON security_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_severity ON security_audit_log(severity);

-- ============================================
-- 4) Function to log security events
-- ============================================
CREATE OR REPLACE FUNCTION log_security_event(
    p_event_type TEXT,
    p_user_id UUID DEFAULT NULL,
    p_target_user_id UUID DEFAULT NULL,
    p_event_data JSONB DEFAULT '{}',
    p_severity TEXT DEFAULT 'INFO'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO security_audit_log (event_type, user_id, target_user_id, event_data, severity)
    VALUES (p_event_type, COALESCE(p_user_id, auth.uid()), p_target_user_id, p_event_data, p_severity)
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$;

REVOKE ALL ON FUNCTION log_security_event(TEXT, UUID, UUID, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION log_security_event(TEXT, UUID, UUID, JSONB, TEXT) TO service_role;

-- ============================================
-- 5) Add failed login tracking (for abuse detection)
-- ============================================
CREATE TABLE IF NOT EXISTS failed_auth_attempts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT,
    ip_address INET,
    attempt_count INTEGER DEFAULT 1,
    first_attempt_at TIMESTAMPTZ DEFAULT NOW(),
    last_attempt_at TIMESTAMPTZ DEFAULT NOW(),
    blocked_until TIMESTAMPTZ,
    CONSTRAINT unique_failed_auth UNIQUE (email, ip_address)
);

-- RLS (service role only)
ALTER TABLE failed_auth_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages failed auth" ON failed_auth_attempts
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================
-- 6) Cleanup job for old rate limit and audit entries
-- ============================================
-- Note: This should be called periodically via a cron job or scheduled function

CREATE OR REPLACE FUNCTION cleanup_security_tables()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_deleted INTEGER := 0;
    v_count INTEGER;
BEGIN
    -- Clean up old rate limit entries (older than 24 hours)
    DELETE FROM security_rate_limits
    WHERE window_start < NOW() - INTERVAL '24 hours';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted := v_deleted + v_count;

    -- Clean up old failed auth attempts (older than 7 days)
    DELETE FROM failed_auth_attempts
    WHERE last_attempt_at < NOW() - INTERVAL '7 days';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted := v_deleted + v_count;

    -- Optionally archive old audit logs (keep 90 days in main table)
    -- For now, just delete very old entries
    DELETE FROM security_audit_log
    WHERE created_at < NOW() - INTERVAL '90 days';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted := v_deleted + v_count;

    RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION cleanup_security_tables() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_security_tables() TO service_role;

-- ============================================
-- 7) Additional profile constraints
-- ============================================
-- Ensure partner_code is always 12 characters (if not already enforced)
DO $$
BEGIN
    ALTER TABLE profiles
    ADD CONSTRAINT profiles_partner_code_format_check
    CHECK (partner_code ~ '^[A-Za-z0-9]{12}$');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- DONE
-- ============================================
