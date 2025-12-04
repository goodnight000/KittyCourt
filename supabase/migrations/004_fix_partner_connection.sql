-- ============================================
-- MIGRATION: Fix Partner Connection (Both-Way Update)
-- ============================================
-- This migration creates a database function to properly
-- connect both partners, bypassing RLS restrictions.
-- ============================================

-- ============================================
-- STEP 1: Create Partner Connection Function
-- ============================================
-- This function is called when accepting a partner request.
-- It updates BOTH profiles to point to each other.
-- Uses SECURITY DEFINER to bypass RLS.

CREATE OR REPLACE FUNCTION accept_partner_connection(
    p_request_id UUID,
    p_anniversary_date DATE DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request RECORD;
    v_receiver_id UUID;
    v_sender_id UUID;
    v_now TIMESTAMPTZ;
    v_result JSON;
BEGIN
    -- Get the current user
    v_receiver_id := auth.uid();
    
    IF v_receiver_id IS NULL THEN
        RETURN json_build_object('error', 'Not authenticated');
    END IF;
    
    -- Get the request
    SELECT * INTO v_request
    FROM partner_requests
    WHERE id = p_request_id AND receiver_id = v_receiver_id AND status = 'pending';
    
    IF v_request IS NULL THEN
        RETURN json_build_object('error', 'Request not found or already processed');
    END IF;
    
    v_sender_id := v_request.sender_id;
    v_now := NOW();
    
    -- Update request status
    UPDATE partner_requests
    SET status = 'accepted', responded_at = v_now
    WHERE id = p_request_id;
    
    -- Update BOTH profiles to point to each other
    -- Update receiver's profile (current user)
    UPDATE profiles
    SET 
        partner_id = v_sender_id,
        partner_connected_at = v_now,
        anniversary_date = COALESCE(p_anniversary_date, anniversary_date)
    WHERE id = v_receiver_id;
    
    -- Update sender's profile
    UPDATE profiles
    SET 
        partner_id = v_receiver_id,
        partner_connected_at = v_now,
        anniversary_date = COALESCE(p_anniversary_date, anniversary_date)
    WHERE id = v_sender_id;
    
    -- Create anniversary calendar event if date provided
    IF p_anniversary_date IS NOT NULL THEN
        INSERT INTO calendar_events (
            created_by,
            title,
            notes,
            event_date,
            event_type,
            is_recurring,
            recurrence_pattern
        ) VALUES (
            v_receiver_id,
            '💕 Our Anniversary',
            'The day we started our journey together!',
            p_anniversary_date,
            'anniversary',
            true,
            'yearly'
        );
    END IF;
    
    -- Return success with updated profile
    SELECT json_build_object(
        'success', true,
        'receiver_id', v_receiver_id,
        'sender_id', v_sender_id,
        'anniversary_date', p_anniversary_date
    ) INTO v_result;
    
    RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION accept_partner_connection(UUID, DATE) TO authenticated;

-- ============================================
-- STEP 2: Create Date Validation Function
-- ============================================
-- Client-side validation is primary, but this provides
-- a database-level check as well.

CREATE OR REPLACE FUNCTION is_valid_past_date(p_date DATE)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
    -- Check if date is not null
    IF p_date IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Check if date is not in the future
    IF p_date > CURRENT_DATE THEN
        RETURN FALSE;
    END IF;
    
    -- Check if year is reasonable (1900-current year)
    IF EXTRACT(YEAR FROM p_date) < 1900 THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$;

-- Add constraint to anniversary_date
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS check_anniversary_date_valid;

ALTER TABLE profiles
ADD CONSTRAINT check_anniversary_date_valid
CHECK (anniversary_date IS NULL OR is_valid_past_date(anniversary_date));
