-- ============================================
-- MIGRATION: Fix Ambiguous Column Reference
-- ============================================
-- Fixes the "column reference 'assigned_date' is ambiguous" error
-- The issue: RETURNS TABLE creates output variables that conflict with table columns
-- Solution: Rename RETURNS TABLE columns to use "out_" prefix to avoid ambiguity

-- First, drop the existing functions (required when changing return type)
DROP FUNCTION IF EXISTS get_couple_ids(UUID, UUID);
DROP FUNCTION IF EXISTS get_todays_question(UUID, UUID);

-- Recreate get_couple_ids with safe output names
CREATE OR REPLACE FUNCTION get_couple_ids(p_user1 UUID, p_user2 UUID)
RETURNS TABLE(out_user_a UUID, out_user_b UUID) AS $$
BEGIN
    IF p_user1 < p_user2 THEN
        RETURN QUERY SELECT p_user1, p_user2;
    ELSE
        RETURN QUERY SELECT p_user2, p_user1;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_todays_question(p_user_id UUID, p_partner_id UUID)
RETURNS TABLE(
    out_assignment_id UUID,
    out_question_id INT,
    out_question TEXT,
    out_emoji TEXT,
    out_category TEXT,
    out_assigned_date DATE,
    out_status TEXT,
    out_is_backlog BOOLEAN
) AS $$
DECLARE
    v_user_a UUID;
    v_user_b UUID;
    v_assignment_id UUID;
    v_question_id INT;
    -- Use America/New_York timezone for EST/EDT (handles daylight saving automatically)
    v_today DATE := (NOW() AT TIME ZONE 'America/New_York')::DATE;
    v_yesterday DATE := ((NOW() AT TIME ZONE 'America/New_York') - INTERVAL '1 day')::DATE;
BEGIN
    -- Get consistent couple ID ordering
    SELECT gc.out_user_a, gc.out_user_b INTO v_user_a, v_user_b 
    FROM get_couple_ids(p_user_id, p_partner_id) gc;
    
    -- First, check if there's a pending question from yesterday (backlog)
    SELECT cqa.id, cqa.question_id
    INTO v_assignment_id, v_question_id
    FROM couple_question_assignments cqa
    WHERE cqa.user_a_id = v_user_a 
      AND cqa.user_b_id = v_user_b
      AND cqa.status = 'pending'
    ORDER BY cqa.assigned_date ASC
    LIMIT 1;
    
    IF v_assignment_id IS NOT NULL THEN
        -- Return the pending (backlog) question
        RETURN QUERY
        SELECT 
            cqa.id,
            cqa.question_id,
            qb.question,
            qb.emoji,
            qb.category,
            cqa.assigned_date,
            cqa.status,
            TRUE::BOOLEAN
        FROM couple_question_assignments cqa
        JOIN question_bank qb ON qb.id = cqa.question_id
        WHERE cqa.id = v_assignment_id;
        RETURN;
    END IF;
    
    -- Check for today's question (ANY status - not just active)
    SELECT cqa.id, cqa.question_id
    INTO v_assignment_id, v_question_id
    FROM couple_question_assignments cqa
    WHERE cqa.user_a_id = v_user_a 
      AND cqa.user_b_id = v_user_b
      AND cqa.assigned_date = v_today
    LIMIT 1;
    
    IF v_assignment_id IS NOT NULL THEN
        -- Return today's existing question
        RETURN QUERY
        SELECT 
            cqa.id,
            cqa.question_id,
            qb.question,
            qb.emoji,
            qb.category,
            cqa.assigned_date,
            cqa.status,
            FALSE::BOOLEAN
        FROM couple_question_assignments cqa
        JOIN question_bank qb ON qb.id = cqa.question_id
        WHERE cqa.id = v_assignment_id;
        RETURN;
    END IF;
    
    -- Need to assign a new question
    -- First, mark yesterday's unanswered question as pending (if exists)
    UPDATE couple_question_assignments
    SET status = 'pending'
    WHERE user_a_id = v_user_a 
      AND user_b_id = v_user_b
      AND couple_question_assignments.assigned_date = v_yesterday
      AND couple_question_assignments.status = 'active';
    
    -- Pick a random question that hasn't been used by this couple
    SELECT qb.id INTO v_question_id
    FROM question_bank qb
    WHERE qb.is_active = TRUE
      AND NOT EXISTS (
          SELECT 1 FROM couple_question_assignments cqa
          WHERE cqa.user_a_id = v_user_a 
            AND cqa.user_b_id = v_user_b
            AND cqa.question_id = qb.id
            AND cqa.status IN ('completed', 'active', 'pending')
      )
    ORDER BY RANDOM()
    LIMIT 1;
    
    -- If all questions have been used, reset and pick any
    IF v_question_id IS NULL THEN
        SELECT qb.id INTO v_question_id
        FROM question_bank qb
        WHERE qb.is_active = TRUE
        ORDER BY RANDOM()
        LIMIT 1;
    END IF;
    
    -- If still no question (empty question_bank), return nothing
    IF v_question_id IS NULL THEN
        RETURN;
    END IF;
    
    -- Create the assignment (use ON CONFLICT for safety)
    INSERT INTO couple_question_assignments (user_a_id, user_b_id, question_id, assigned_date, status)
    VALUES (v_user_a, v_user_b, v_question_id, v_today, 'active')
    ON CONFLICT (user_a_id, user_b_id, assigned_date) DO UPDATE SET status = 'active'
    RETURNING id INTO v_assignment_id;
    
    -- Return the new question
    RETURN QUERY
    SELECT 
        cqa.id,
        cqa.question_id,
        qb.question,
        qb.emoji,
        qb.category,
        cqa.assigned_date,
        cqa.status,
        FALSE::BOOLEAN
    FROM couple_question_assignments cqa
    JOIN question_bank qb ON qb.id = cqa.question_id
    WHERE cqa.id = v_assignment_id;
END;
$$ LANGUAGE plpgsql;

-- Add comments documenting the functions
COMMENT ON FUNCTION get_couple_ids IS 'Returns user IDs in consistent alphabetical order. Output columns prefixed with out_ to avoid ambiguity.';
COMMENT ON FUNCTION get_todays_question IS 'Gets or creates today''s question for a couple. Uses America/New_York (EST/EDT) timezone, resetting at midnight Eastern Time. Output columns prefixed with out_ to avoid ambiguity with table columns.';
