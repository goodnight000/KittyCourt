-- ============================================
-- MIGRATION: Daily Questions System + Schema Updates
-- ============================================
-- This migration:
-- 1. Creates question_bank table with 60+ relationship questions
-- 2. Updates daily_answers to support the new system
-- 3. Creates couple_question_assignments table for tracking
-- 4. Adds partner_id to court_sessions
-- 5. Ensures all tables have proper RLS
-- ============================================

-- ============================================
-- STEP 1: Question Bank Table
-- ============================================
CREATE TABLE IF NOT EXISTS question_bank (
    id SERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    emoji TEXT DEFAULT '💭',
    category TEXT DEFAULT 'general', -- 'fun', 'deep', 'romantic', 'growth', 'memories', 'future'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- STEP 2: Couple Question Assignments
-- ============================================
-- Tracks which questions have been assigned to which couple
-- and the current/pending questions in their stack
CREATE TABLE IF NOT EXISTS couple_question_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- The couple (always use smaller UUID as user_a for consistency)
    user_a_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    user_b_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    
    -- The assigned question
    question_id INT REFERENCES question_bank(id) NOT NULL,
    
    -- When this question was assigned
    assigned_date DATE NOT NULL,
    
    -- Status: 'active' (today's question), 'pending' (in stack), 'completed', 'expired'
    status TEXT DEFAULT 'active',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    -- Unique constraint: one question per couple per date
    UNIQUE(user_a_id, user_b_id, assigned_date)
);

CREATE INDEX idx_cqa_couple ON couple_question_assignments(user_a_id, user_b_id);
CREATE INDEX idx_cqa_status ON couple_question_assignments(status);
CREATE INDEX idx_cqa_date ON couple_question_assignments(assigned_date);

-- ============================================
-- STEP 3: Update daily_answers Table
-- ============================================
-- Drop existing table and recreate with better structure
DROP TABLE IF EXISTS daily_answers CASCADE;

CREATE TABLE daily_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    
    -- Link to the assignment (which tracks the couple + question)
    assignment_id UUID REFERENCES couple_question_assignments(id) ON DELETE CASCADE NOT NULL,
    
    -- The actual answer
    answer TEXT NOT NULL,
    mood TEXT, -- Emoji mood selected
    
    -- Edit tracking
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    edited_at TIMESTAMPTZ, -- NULL if never edited, timestamp if edited
    
    -- One answer per user per assignment
    UNIQUE(user_id, assignment_id)
);

CREATE INDEX idx_daily_answers_user ON daily_answers(user_id);
CREATE INDEX idx_daily_answers_assignment ON daily_answers(assignment_id);

-- Trigger to update updated_at and set edited_at
CREATE OR REPLACE FUNCTION update_daily_answer_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    -- Only set edited_at if this is an update (not initial insert) and answer changed
    IF OLD.answer IS DISTINCT FROM NEW.answer THEN
        NEW.edited_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_daily_answers_timestamps
    BEFORE UPDATE ON daily_answers
    FOR EACH ROW EXECUTE FUNCTION update_daily_answer_timestamps();

-- ============================================
-- STEP 4: Update court_sessions
-- ============================================
ALTER TABLE court_sessions 
ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES profiles(id);

ALTER TABLE court_sessions
ADD COLUMN IF NOT EXISTS creator_joined BOOLEAN DEFAULT TRUE;

ALTER TABLE court_sessions
ADD COLUMN IF NOT EXISTS partner_joined BOOLEAN DEFAULT FALSE;

-- ============================================
-- STEP 5: Enable RLS on new tables
-- ============================================
ALTER TABLE question_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE couple_question_assignments ENABLE ROW LEVEL SECURITY;

-- Question bank is readable by all authenticated users
CREATE POLICY "Anyone can read question bank" ON question_bank
    FOR SELECT USING (true);

-- Couple assignments - users can only see their own
CREATE POLICY "Users can view own assignments" ON couple_question_assignments
    FOR SELECT USING (
        user_a_id = auth.uid() OR user_b_id = auth.uid()
    );

CREATE POLICY "Service can manage assignments" ON couple_question_assignments
    FOR ALL USING (true);

-- Daily answers - existing policies should work, but let's update them
DROP POLICY IF EXISTS "Users can view own and partner answers" ON daily_answers;
DROP POLICY IF EXISTS "Users can insert own answers" ON daily_answers;
DROP POLICY IF EXISTS "Users can update own answers" ON daily_answers;

CREATE POLICY "Users can view couple answers" ON daily_answers
    FOR SELECT USING (
        user_id = auth.uid() OR 
        user_id = get_my_partner_id()
    );

CREATE POLICY "Users can insert own answers" ON daily_answers
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own answers" ON daily_answers
    FOR UPDATE USING (user_id = auth.uid());

-- ============================================
-- STEP 6: Seed Question Bank (60 questions)
-- ============================================
INSERT INTO question_bank (question, emoji, category) VALUES
-- Fun & Playful (20)
('Who would survive longer in a zombie apocalypse?', '🧟', 'fun'),
('Who is more likely to become famous?', '🌟', 'fun'),
('Who is the better cook?', '👨‍🍳', 'fun'),
('Who would win in an argument?', '🗣️', 'fun'),
('Who is more likely to cry at a movie?', '🎬', 'fun'),
('Who spends more money?', '💸', 'fun'),
('Who is the early bird?', '🐦', 'fun'),
('Who takes longer to get ready?', '💄', 'fun'),
('Who is the better driver?', '🚗', 'fun'),
('Who falls asleep first?', '😴', 'fun'),
('Who is more adventurous?', '🏔️', 'fun'),
('Who is the bigger foodie?', '🍕', 'fun'),
('Who is more competitive?', '🏆', 'fun'),
('Who is the funnier one?', '😂', 'fun'),
('Who is more likely to get lost?', '🗺️', 'fun'),
('Who has better taste in music?', '🎵', 'fun'),
('Who is the messier one?', '🧹', 'fun'),
('Who would survive alone on a deserted island?', '🏝️', 'fun'),
('Who is more likely to forget an anniversary?', '📅', 'fun'),
('Who is the bigger scaredy-cat?', '😱', 'fun'),

-- Deep & Meaningful (15)
('What''s something you''ve never told your partner but always wanted to?', '💭', 'deep'),
('What moment in our relationship made you feel most loved?', '💕', 'deep'),
('What''s your biggest fear about our future together?', '🔮', 'deep'),
('What do you think is our greatest strength as a couple?', '💪', 'deep'),
('What''s something you wish we did more often?', '✨', 'deep'),
('How has our relationship changed you as a person?', '🦋', 'deep'),
('What''s a challenge we overcame that made us stronger?', '🌈', 'deep'),
('What do you admire most about your partner?', '🌟', 'deep'),
('What''s something small your partner does that means a lot to you?', '🥹', 'deep'),
('What dream do you hope we achieve together?', '🌠', 'deep'),
('What''s the best advice you''ve received about relationships?', '📖', 'deep'),
('How do you know when your partner needs support?', '🤝', 'deep'),
('What''s something you want to apologize for?', '💐', 'deep'),
('What makes you feel most connected to your partner?', '🔗', 'deep'),
('What''s a lesson you''ve learned from our disagreements?', '🎓', 'deep'),

-- Romantic (10)
('What was your first impression of your partner?', '👀', 'romantic'),
('Describe your perfect date night with your partner.', '🌙', 'romantic'),
('What''s your favorite physical feature of your partner?', '😍', 'romantic'),
('What song reminds you of your relationship?', '🎶', 'romantic'),
('Where would you love to travel together?', '✈️', 'romantic'),
('What''s the most romantic thing your partner has done?', '💝', 'romantic'),
('What nickname do you secretly love being called?', '💋', 'romantic'),
('What moment made you realize you were in love?', '❤️', 'romantic'),
('What''s your favorite memory of us?', '📸', 'romantic'),
('How do you most like to show love?', '💗', 'romantic'),

-- Growth & Goals (8)
('What''s one habit you''d like to build together?', '🌱', 'growth'),
('What''s something new you want to try as a couple?', '🎯', 'growth'),
('Where do you see us in 5 years?', '🔭', 'growth'),
('What''s a skill you''d like to learn together?', '📚', 'growth'),
('What does success look like for our relationship?', '🏅', 'growth'),
('What''s one way we could communicate better?', '💬', 'growth'),
('What boundaries are important to you in our relationship?', '🚧', 'growth'),
('How can we better support each other''s individual dreams?', '🚀', 'growth'),

-- Memories & Nostalgia (7)
('What''s the funniest thing that''s happened to us?', '🤣', 'memories'),
('Describe our first kiss.', '💏', 'memories'),
('What''s your favorite holiday memory together?', '🎄', 'memories'),
('What meal together stands out most in your memory?', '🍽️', 'memories'),
('What''s the best gift you''ve received from your partner?', '🎁', 'memories'),
('What''s a spontaneous adventure we had that you loved?', '🎢', 'memories'),
('What''s a tradition you want us to keep forever?', '⭐', 'memories')

ON CONFLICT DO NOTHING;

-- ============================================
-- STEP 7: Helper function for getting couple ID pair
-- ============================================
-- Returns user IDs in consistent order (smaller first)
CREATE OR REPLACE FUNCTION get_couple_ids(user1 UUID, user2 UUID)
RETURNS TABLE(user_a_id UUID, user_b_id UUID) AS $$
BEGIN
    IF user1 < user2 THEN
        RETURN QUERY SELECT user1, user2;
    ELSE
        RETURN QUERY SELECT user2, user1;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 8: Function to get or create today's question for a couple
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
            cqa.id,
            cqa.question_id,
            qb.question,
            qb.emoji,
            qb.category,
            cqa.assigned_date,
            cqa.status,
            TRUE as is_backlog
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
            cqa.id,
            cqa.question_id,
            qb.question,
            qb.emoji,
            qb.category,
            cqa.assigned_date,
            cqa.status,
            FALSE as is_backlog
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
      AND assigned_date = v_yesterday
      AND status = 'active';
    
    -- Pick a random question that hasn't been used by this couple
    SELECT id INTO v_question_id
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
        SELECT id INTO v_question_id
        FROM question_bank
        WHERE is_active = TRUE
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
        cqa.id,
        cqa.question_id,
        qb.question,
        qb.emoji,
        qb.category,
        cqa.assigned_date,
        cqa.status,
        FALSE as is_backlog
    FROM couple_question_assignments cqa
    JOIN question_bank qb ON qb.id = cqa.question_id
    WHERE cqa.id = v_assignment_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- DONE! 🎉
-- ============================================
