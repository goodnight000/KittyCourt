-- ============================================
-- MIGRATION: Fix Daily Questions Function
-- ============================================
-- Fixes the "column reference is ambiguous" error in get_todays_question
-- by using explicit aliases for all returned columns
-- ============================================

CREATE OR REPLACE FUNCTION get_todays_question(p_user_id UUID, p_partner_id UUID)
RETURNS TABLE(
    assignment_id UUID,
    question_id INT,
    question TEXT,
    emoji TEXT,
    category TEXT,
    assigned_date DATE,
    status TEXT,
    is_backlog BOOLEAN
) AS $$
DECLARE
    v_user_a UUID;
    v_user_b UUID;
    v_assignment_id UUID;
    v_question_id INT;
    v_today DATE := CURRENT_DATE;
    v_yesterday DATE := CURRENT_DATE - 1;
BEGIN
    -- Get consistent couple ID ordering
    SELECT * INTO v_user_a, v_user_b FROM get_couple_ids(p_user_id, p_partner_id);
    
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
            cqa.id AS assignment_id,
            cqa.question_id AS question_id,
            qb.question AS question,
            qb.emoji AS emoji,
            qb.category AS category,
            cqa.assigned_date AS assigned_date,
            cqa.status AS status,
            TRUE AS is_backlog
        FROM couple_question_assignments cqa
        JOIN question_bank qb ON qb.id = cqa.question_id
        WHERE cqa.id = v_assignment_id;
        RETURN;
    END IF;
    
    -- Check for today's active question
    SELECT cqa.id, cqa.question_id
    INTO v_assignment_id, v_question_id
    FROM couple_question_assignments cqa
    WHERE cqa.user_a_id = v_user_a 
      AND cqa.user_b_id = v_user_b
      AND cqa.assigned_date = v_today
      AND cqa.status = 'active'
    LIMIT 1;
    
    IF v_assignment_id IS NOT NULL THEN
        -- Return today's existing question
        RETURN QUERY
        SELECT 
            cqa.id AS assignment_id,
            cqa.question_id AS question_id,
            qb.question AS question,
            qb.emoji AS emoji,
            qb.category AS category,
            cqa.assigned_date AS assigned_date,
            cqa.status AS status,
            FALSE AS is_backlog
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
    
    -- Create the assignment
    INSERT INTO couple_question_assignments (user_a_id, user_b_id, question_id, assigned_date, status)
    VALUES (v_user_a, v_user_b, v_question_id, v_today, 'active')
    RETURNING id INTO v_assignment_id;
    
    -- Return the new question
    RETURN QUERY
    SELECT 
        cqa.id AS assignment_id,
        cqa.question_id AS question_id,
        qb.question AS question,
        qb.emoji AS emoji,
        qb.category AS category,
        cqa.assigned_date AS assigned_date,
        cqa.status AS status,
        FALSE AS is_backlog
    FROM couple_question_assignments cqa
    JOIN question_bank qb ON qb.id = cqa.question_id
    WHERE cqa.id = v_assignment_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- DONE! 🎉
-- ============================================
