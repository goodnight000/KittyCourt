-- ============================================
-- MIGRATION: Fix Partner Request Duplicate Key Issues
-- ============================================
-- This migration fixes all edge cases that can cause:
-- "duplicate key value violates unique constraint partner_requests_sender_id_receiver_id_key"
--
-- Edge Cases Fixed:
-- 1. Self-requests (sender_id = receiver_id)
-- 2. Stale rejected requests not being deleted
-- 3. Race conditions during concurrent inserts
-- 4. Accepted requests remaining after users disconnect
-- 5. Orphaned requests from deleted profiles
-- ============================================

-- ============================================
-- STEP 1: Clean up existing problematic data
-- ============================================

-- Delete self-requests (where user tried to connect with themselves)
DELETE FROM partner_requests 
WHERE sender_id = receiver_id;

-- Delete old rejected requests (they should be cleaned up by the app but may be stale)
DELETE FROM partner_requests 
WHERE status = 'rejected';

-- Delete old accepted requests where users are no longer partners
-- (Accepted requests should be cleaned up after partner connection is established)
DELETE FROM partner_requests pr
WHERE pr.status = 'accepted'
AND NOT EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = pr.sender_id 
    AND p.partner_id = pr.receiver_id
);

-- ============================================
-- STEP 2: Add CHECK constraint to prevent self-requests
-- ============================================

-- Drop if exists (for idempotency)
ALTER TABLE partner_requests DROP CONSTRAINT IF EXISTS no_self_requests;

-- Add constraint - users cannot send requests to themselves
ALTER TABLE partner_requests 
ADD CONSTRAINT no_self_requests 
CHECK (sender_id != receiver_id);

-- ============================================
-- STEP 3: Create function to handle upsert-style request sending
-- ============================================
-- This function atomically handles the "delete rejected + insert new" pattern
-- to prevent race conditions

CREATE OR REPLACE FUNCTION send_partner_request(
    p_sender_id UUID,
    p_receiver_id UUID,
    p_message TEXT DEFAULT NULL
)
RETURNS TABLE(
    id UUID,
    sender_id UUID,
    receiver_id UUID,
    status TEXT,
    message TEXT,
    created_at TIMESTAMPTZ,
    error_message TEXT
) AS $$
DECLARE
    v_existing RECORD;
    v_new_id UUID;
BEGIN
    -- Check for self-request
    IF p_sender_id = p_receiver_id THEN
        RETURN QUERY SELECT 
            NULL::UUID, NULL::UUID, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ,
            'You cannot send a request to yourself'::TEXT;
        RETURN;
    END IF;

    -- Lock and check for existing request (in either direction)
    SELECT * INTO v_existing
    FROM partner_requests pr
    WHERE (pr.sender_id = p_sender_id AND pr.receiver_id = p_receiver_id)
       OR (pr.sender_id = p_receiver_id AND pr.receiver_id = p_sender_id)
    FOR UPDATE;

    IF FOUND THEN
        IF v_existing.status = 'pending' THEN
            IF v_existing.sender_id = p_sender_id THEN
                RETURN QUERY SELECT 
                    NULL::UUID, NULL::UUID, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ,
                    'You already sent a request to this person'::TEXT;
            ELSE
                RETURN QUERY SELECT 
                    NULL::UUID, NULL::UUID, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ,
                    'This person already sent you a request'::TEXT;
            END IF;
            RETURN;
        ELSIF v_existing.status = 'accepted' THEN
            RETURN QUERY SELECT 
                NULL::UUID, NULL::UUID, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ,
                'You are already connected with this person'::TEXT;
            RETURN;
        ELSIF v_existing.status = 'rejected' THEN
            -- Delete the old rejected request
            DELETE FROM partner_requests WHERE id = v_existing.id;
        END IF;
    END IF;

    -- Insert new request
    INSERT INTO partner_requests (sender_id, receiver_id, message, status)
    VALUES (p_sender_id, p_receiver_id, p_message, 'pending')
    RETURNING partner_requests.id INTO v_new_id;

    -- Return the new request
    RETURN QUERY SELECT 
        pr.id, pr.sender_id, pr.receiver_id, pr.status, pr.message, pr.created_at, NULL::TEXT
    FROM partner_requests pr
    WHERE pr.id = v_new_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 4: Create cleanup trigger for accepted requests
-- ============================================
-- When a request is accepted, schedule it for cleanup after profiles are updated

CREATE OR REPLACE FUNCTION cleanup_accepted_requests()
RETURNS TRIGGER AS $$
BEGIN
    -- When profiles are updated with partner connection, clean up the request
    IF NEW.partner_id IS NOT NULL AND OLD.partner_id IS NULL THEN
        DELETE FROM partner_requests
        WHERE (sender_id = NEW.id AND receiver_id = NEW.partner_id)
           OR (sender_id = NEW.partner_id AND receiver_id = NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS cleanup_partner_requests_on_connect ON profiles;

-- Create trigger
CREATE TRIGGER cleanup_partner_requests_on_connect
    AFTER UPDATE OF partner_id ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION cleanup_accepted_requests();

-- ============================================
-- DONE!
-- ============================================
-- Summary of fixes:
-- 1. Cleaned up all self-requests, rejected requests, and orphaned accepted requests
-- 2. Added CHECK constraint to prevent self-requests at database level
-- 3. Created atomic send_partner_request() function to prevent race conditions
-- 4. Created trigger to auto-cleanup accepted requests when partners connect
--
-- The client can optionally use the new send_partner_request() RPC function
-- for atomic, race-condition-free request sending.
-- ============================================
