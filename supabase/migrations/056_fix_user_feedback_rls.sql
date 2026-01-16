-- Migration: Fix user_feedback RLS (CRITICAL-012)
-- Description: Add SELECT policy for users to read their own feedback

-- Users can select their own feedback
CREATE POLICY IF NOT EXISTS "Users can select own feedback"
    ON user_feedback FOR SELECT
    USING (auth.uid() = user_id);
