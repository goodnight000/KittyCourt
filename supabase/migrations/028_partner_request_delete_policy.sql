-- ============================================
-- MIGRATION: Add Delete Policy for Partner Requests
-- ============================================
-- Allows senders to cancel/delete their own pending requests
-- and receivers to delete rejected requests.
-- ============================================

-- Allow senders to delete their own pending requests (cancel)
CREATE POLICY "Senders can delete own pending requests" ON partner_requests
    FOR DELETE USING (
        sender_id = auth.uid() 
        AND status = 'pending'
    );

-- Allow receivers to delete requests they've rejected
CREATE POLICY "Receivers can delete rejected requests" ON partner_requests
    FOR DELETE USING (
        receiver_id = auth.uid()
    );

-- ============================================
-- DONE
-- ============================================
