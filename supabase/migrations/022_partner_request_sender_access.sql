-- ============================================
-- MIGRATION: Fix Partner Request Sender Profile Access
-- ============================================
-- Allows users to view basic profile info of users who sent them
-- partner requests, so the partner request modal can display
-- the sender's name, avatar, and partner code.
-- ============================================

-- Allow viewing profile of users who sent you a pending partner request
CREATE POLICY "Users can view sender of pending partner requests"
ON profiles FOR SELECT
USING (
    id IN (
        SELECT sender_id 
        FROM partner_requests 
        WHERE receiver_id = auth.uid() 
          AND status = 'pending'
    )
);

-- ============================================
-- DONE! 
-- ============================================
-- This policy enables the partner request modal to display:
--   • Sender's display_name
--   • Sender's avatar_url  
--   • Sender's partner_code (for verification)
-- ============================================
