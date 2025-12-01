-- ============================================
-- FIX: Infinite Recursion in Profiles RLS Policies
-- ============================================
-- The original policies caused infinite recursion because they
-- queried the profiles table within the policy check, which 
-- triggers RLS again, creating a loop.
--
-- Solution: Use a SECURITY DEFINER function that bypasses RLS
-- to get the partner_id without triggering policy checks.
-- ============================================

-- Step 1: Create a helper function to get partner_id (bypasses RLS)
CREATE OR REPLACE FUNCTION get_my_partner_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT partner_id FROM profiles WHERE id = auth.uid()
$$;

-- Step 2: Drop the problematic policies
DROP POLICY IF EXISTS "Users can view partner profile" ON profiles;
DROP POLICY IF EXISTS "Anyone can search by partner code" ON profiles;

-- Step 3: Recreate the policies using the helper function
-- Users can view their partner's profile (no recursion now)
CREATE POLICY "Users can view partner profile" ON profiles
    FOR SELECT USING (id = get_my_partner_id());

-- Anyone can search profiles by partner_code (for connecting)
-- This is safe because it doesn't reference profiles in a subquery
CREATE POLICY "Anyone can search by partner code" ON profiles
    FOR SELECT USING (partner_code IS NOT NULL);

-- ============================================
-- Also fix other tables that reference profiles in policies
-- ============================================

-- Fix court_sessions policies
DROP POLICY IF EXISTS "Users can view own sessions" ON court_sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON court_sessions;

CREATE POLICY "Users can view own sessions" ON court_sessions
    FOR SELECT USING (
        created_by = auth.uid() OR
        created_by = get_my_partner_id()
    );

CREATE POLICY "Users can update own sessions" ON court_sessions
    FOR UPDATE USING (
        created_by = auth.uid() OR
        created_by = get_my_partner_id()
    );

-- Fix daily_answers policies
DROP POLICY IF EXISTS "Users can view own and partner answers" ON daily_answers;

CREATE POLICY "Users can view own and partner answers" ON daily_answers
    FOR SELECT USING (
        user_id = auth.uid() OR 
        user_id = get_my_partner_id()
    );

-- Fix calendar_events policies
DROP POLICY IF EXISTS "Users can view own and partner events" ON calendar_events;

CREATE POLICY "Users can view own and partner events" ON calendar_events
    FOR SELECT USING (
        created_by = auth.uid() OR 
        created_by = get_my_partner_id()
    );

-- Fix user_memories policies
DROP POLICY IF EXISTS "Partner can view memories" ON user_memories;

CREATE POLICY "Partner can view memories" ON user_memories
    FOR SELECT USING (user_id = get_my_partner_id());

-- ============================================
-- DONE! The infinite recursion is now fixed.
-- ============================================
