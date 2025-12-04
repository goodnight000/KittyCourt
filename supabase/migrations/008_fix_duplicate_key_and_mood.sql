-- ============================================
-- MIGRATION: Fix Duplicate Key & Add Immutable Mood
-- ============================================
-- Fixes:
-- 1. Duplicate key error in get_todays_question
-- 2. Adds mood column to daily_answers with immutability
-- 3. Adds questions_answered count tracking
-- ============================================

-- ============================================
-- STEP 1: Fix the get_todays_question function
-- The issue is checking for status='active' but constraint is on date
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
    
    -- Create the assignment (use ON CONFLICT for safety)
    INSERT INTO couple_question_assignments (user_a_id, user_b_id, question_id, assigned_date, status)
    VALUES (v_user_a, v_user_b, v_question_id, v_today, 'active')
    ON CONFLICT (user_a_id, user_b_id, assigned_date) DO UPDATE SET status = 'active'
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
-- STEP 2: Make mood immutable in daily_answers
-- Once a mood is set, it cannot be changed
-- ============================================
CREATE OR REPLACE FUNCTION prevent_mood_change()
RETURNS TRIGGER AS $$
BEGIN
    -- If mood was already set and someone tries to change it, prevent it
    IF OLD.mood IS NOT NULL AND NEW.mood IS DISTINCT FROM OLD.mood THEN
        RAISE EXCEPTION 'Mood cannot be changed once set';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_mood_change_trigger ON daily_answers;
CREATE TRIGGER prevent_mood_change_trigger
    BEFORE UPDATE ON daily_answers
    FOR EACH ROW EXECUTE FUNCTION prevent_mood_change();

-- ============================================
-- STEP 3: Add questions_answered to profiles
-- ============================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS questions_answered INT DEFAULT 0;

-- Function to update questions_answered count when answer is inserted
CREATE OR REPLACE FUNCTION update_questions_answered_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Increment the user's questions_answered count
    UPDATE profiles 
    SET questions_answered = COALESCE(questions_answered, 0) + 1
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS increment_questions_answered ON daily_answers;
CREATE TRIGGER increment_questions_answered
    AFTER INSERT ON daily_answers
    FOR EACH ROW EXECUTE FUNCTION update_questions_answered_count();

-- ============================================
-- STEP 4: Create reward_redemptions table for tracking
-- ============================================
CREATE TABLE IF NOT EXISTS reward_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    partner_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    reward_name TEXT NOT NULL,
    reward_description TEXT,
    kibble_cost INT NOT NULL,
    redeemed_at TIMESTAMPTZ DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ, -- When partner saw the notification
    fulfilled_at TIMESTAMPTZ, -- When partner marked as done
    status TEXT DEFAULT 'pending' -- 'pending', 'acknowledged', 'fulfilled'
);

CREATE INDEX idx_redemptions_partner ON reward_redemptions(partner_id, status);
CREATE INDEX idx_redemptions_user ON reward_redemptions(user_id);

-- RLS for reward_redemptions
ALTER TABLE reward_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their redemptions" ON reward_redemptions
    FOR SELECT USING (user_id = auth.uid() OR partner_id = auth.uid());

CREATE POLICY "Users can insert their redemptions" ON reward_redemptions
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Partners can update redemption status" ON reward_redemptions
    FOR UPDATE USING (partner_id = auth.uid());

-- ============================================
-- DONE! 🎉
-- ============================================
