-- ============================================
-- MIGRATION: Add Anniversary Date + Couple Data Isolation
-- ============================================
-- This migration:
-- 1. Adds anniversary_date column to profiles
-- 2. Updates calendar_events to support couple sharing
-- 3. Fixes RLS policies for couple-scoped data
-- ============================================

-- ============================================
-- STEP 1: Add Anniversary Date to Profiles
-- ============================================

-- Add anniversary_date column (immutable once set)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS anniversary_date DATE;

-- Add a trigger to prevent anniversary_date from being changed once set
CREATE OR REPLACE FUNCTION prevent_anniversary_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.anniversary_date IS NOT NULL AND NEW.anniversary_date IS DISTINCT FROM OLD.anniversary_date THEN
        RAISE EXCEPTION 'Anniversary date cannot be changed once set';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_anniversary_immutable ON profiles;
CREATE TRIGGER enforce_anniversary_immutable
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION prevent_anniversary_change();

-- ============================================
-- STEP 2: Update Calendar Events for Couple Sharing
-- ============================================

-- Update calendar_events RLS policies for couple sharing
DROP POLICY IF EXISTS "Users can view own events" ON calendar_events;
DROP POLICY IF EXISTS "Users can view own and partner events" ON calendar_events;
DROP POLICY IF EXISTS "Users can insert own events" ON calendar_events;
DROP POLICY IF EXISTS "Users can update own events" ON calendar_events;
DROP POLICY IF EXISTS "Users can delete own events" ON calendar_events;

-- Both partners can view all events in the couple
CREATE POLICY "Users can view couple events" ON calendar_events
    FOR SELECT USING (
        created_by = auth.uid() OR
        created_by = get_my_partner_id()
    );

-- Both partners can insert events
CREATE POLICY "Users can insert couple events" ON calendar_events
    FOR INSERT WITH CHECK (
        created_by = auth.uid()
    );

-- Both partners can update events in the couple
CREATE POLICY "Users can update couple events" ON calendar_events
    FOR UPDATE USING (
        created_by = auth.uid() OR
        created_by = get_my_partner_id()
    );

-- Both partners can delete events in the couple
CREATE POLICY "Users can delete couple events" ON calendar_events
    FOR DELETE USING (
        created_by = auth.uid() OR
        created_by = get_my_partner_id()
    );

-- ============================================
-- STEP 3: Fix Cases RLS for Couple Isolation
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own cases" ON cases;
DROP POLICY IF EXISTS "Users can insert own cases" ON cases;
DROP POLICY IF EXISTS "Users can update own cases" ON cases;

-- Users can only view cases where they are user_a or user_b
CREATE POLICY "Users can view couple cases" ON cases
    FOR SELECT USING (
        user_a_id = auth.uid() OR
        user_b_id = auth.uid()
    );

-- Users can only create cases involving themselves and their partner
CREATE POLICY "Users can insert couple cases" ON cases
    FOR INSERT WITH CHECK (
        (user_a_id = auth.uid() AND user_b_id = get_my_partner_id()) OR
        (user_b_id = auth.uid() AND user_a_id = get_my_partner_id())
    );

-- Users can update cases they're involved in
CREATE POLICY "Users can update couple cases" ON cases
    FOR UPDATE USING (
        user_a_id = auth.uid() OR
        user_b_id = auth.uid()
    );

-- ============================================
-- STEP 4: Fix Appreciations RLS for Couple Isolation
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own appreciations" ON appreciations;
DROP POLICY IF EXISTS "Users can view received appreciations" ON appreciations;
DROP POLICY IF EXISTS "Users can insert appreciations" ON appreciations;

-- Users can view appreciations they sent or received
CREATE POLICY "Users can view couple appreciations" ON appreciations
    FOR SELECT USING (
        from_user_id = auth.uid() OR
        to_user_id = auth.uid()
    );

-- Users can only create appreciations to their partner
CREATE POLICY "Users can insert appreciations to partner" ON appreciations
    FOR INSERT WITH CHECK (
        from_user_id = auth.uid() AND
        to_user_id = get_my_partner_id()
    );

-- ============================================
-- STEP 5: Fix Daily Answers RLS for Couple Isolation
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own answers" ON daily_answers;
DROP POLICY IF EXISTS "Users can view own and partner answers" ON daily_answers;
DROP POLICY IF EXISTS "Users can insert own answers" ON daily_answers;

-- Both partners can view each other's daily answers
CREATE POLICY "Users can view couple daily answers" ON daily_answers
    FOR SELECT USING (
        user_id = auth.uid() OR
        user_id = get_my_partner_id()
    );

-- Users can insert their own answers
CREATE POLICY "Users can insert own daily answers" ON daily_answers
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
    );

-- ============================================
-- STEP 6: Fix Verdicts RLS for Couple Isolation
-- ============================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view verdicts" ON verdicts;
DROP POLICY IF EXISTS "Users can view own verdicts" ON verdicts;

-- Users can view verdicts for cases they're involved in
CREATE POLICY "Users can view couple verdicts" ON verdicts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM cases 
            WHERE cases.id = verdicts.case_id 
            AND (cases.user_a_id = auth.uid() OR cases.user_b_id = auth.uid())
        )
    );

-- ============================================
-- DONE! Couple data isolation is now enforced
-- ============================================
