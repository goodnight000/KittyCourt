-- ============================================
-- SECURITY FIX: Restrict Profile Data Exposure & Memory Policies
-- ============================================
-- Migration: 020_security_rls_fixes.sql
-- 
-- This migration addresses two security findings:
-- 1. Profiles RLS policy was exposing all profile data to any authenticated user
-- 2. user_memories policies allowed unrestricted INSERT/UPDATE
-- ============================================

-- ============================================
-- FIX 1: Restrict Profiles RLS Policy
-- ============================================
-- Problem: "Anyone can search by partner code" policy exposes all profile columns.
-- Solution: Create a function that only returns id and partner_code for lookups.

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can search by partner code" ON profiles;

-- Create a secure partner lookup function that bypasses RLS
-- This returns ONLY the id for a given partner_code (no other data)
CREATE OR REPLACE FUNCTION lookup_user_by_partner_code(code TEXT)
RETURNS TABLE(id UUID)
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT p.id FROM profiles p WHERE p.partner_code = code
$$;

-- Re-create a more restrictive policy:
-- Users can only select their own profile, their partner's profile, 
-- OR profiles where they match by partner_code (for connection flow).
-- Note: The connection flow should use lookup_user_by_partner_code() function instead.
CREATE POLICY "Users can view own and partner profiles only" ON profiles
    FOR SELECT USING (
        id = auth.uid() OR 
        id = get_my_partner_id()
    );

-- ============================================
-- FIX 2: Restrict user_memories INSERT/UPDATE Policies
-- ============================================
-- Problem: Policies allowed any authenticated user to write to any user's memories.
-- Solution: Require user_id = auth.uid() for user-initiated writes.
-- Note: Server uses service role key which bypasses RLS, so AI can still write.

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Service can insert memories" ON user_memories;
DROP POLICY IF EXISTS "Service can update memories" ON user_memories;

-- Create more restrictive policies
-- Users can only insert memories for themselves (defense in depth)
CREATE POLICY "Users can insert own memories" ON user_memories
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can only update their own memories
CREATE POLICY "Users can update own memories" ON user_memories
    FOR UPDATE USING (user_id = auth.uid());

-- ============================================
-- DONE! RLS policies are now properly restricted.
-- ============================================
-- Note: The server's service role key bypasses these policies,
-- so the AI can still write memories via the backend.
-- ============================================
