-- ============================================
-- MIGRATION: I18N tables, language columns, and localized daily questions
-- ============================================

-- 1) Language columns
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en';

UPDATE profiles
SET preferred_language = 'en'
WHERE preferred_language IS NULL;

ALTER TABLE cases
ADD COLUMN IF NOT EXISTS case_language TEXT DEFAULT 'en';

UPDATE cases
SET case_language = 'en'
WHERE case_language IS NULL;

ALTER TABLE user_memories
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';

UPDATE user_memories
SET language = 'en'
WHERE language IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_memories_language
    ON user_memories(user_id, language)
    WHERE is_active = TRUE;

-- 2) Translation tables
CREATE TABLE IF NOT EXISTS question_bank_translations (
    question_id INT REFERENCES question_bank(id) ON DELETE CASCADE,
    language TEXT NOT NULL,
    question TEXT NOT NULL,
    emoji TEXT,
    category TEXT,
    PRIMARY KEY (question_id, language)
);

CREATE TABLE IF NOT EXISTS challenges_translations (
    challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
    language TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    PRIMARY KEY (challenge_id, language)
);

ALTER TABLE question_bank_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges_translations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read question bank translations" ON question_bank_translations;
CREATE POLICY "Authenticated can read question bank translations"
    ON question_bank_translations FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Authenticated can read challenges translations" ON challenges_translations;
CREATE POLICY "Authenticated can read challenges translations"
    ON challenges_translations FOR SELECT
    TO authenticated
    USING (true);

-- 3) Backfill English translations
INSERT INTO question_bank_translations (question_id, language, question, emoji, category)
SELECT id, 'en', question, emoji, category
FROM question_bank
ON CONFLICT DO NOTHING;

INSERT INTO challenges_translations (challenge_id, language, name, description)
SELECT id, 'en', name, description
FROM challenges
ON CONFLICT DO NOTHING;

-- 4) Seed Simplified Chinese translations for question bank
INSERT INTO question_bank_translations (question_id, language, question, emoji, category)
SELECT qb.id, 'zh-Hans', v.translated_question, qb.emoji, qb.category
FROM (
    VALUES
        ('Who would survive longer in a zombie apocalypse?', '谁能在僵尸末日里活得更久？'),
        ('Who is more likely to become famous?', '谁更可能成名？'),
        ('Who is the better cook?', '谁更会做饭？'),
        ('Who would win in an argument?', '吵架时谁更容易赢？'),
        ('Who is more likely to cry at a movie?', '谁更容易在电影里哭？'),
        ('Who spends more money?', '谁花钱更多？'),
        ('Who is the early bird?', '谁更早起？'),
        ('Who takes longer to get ready?', '谁准备出门更慢？'),
        ('Who is the better driver?', '谁开车更好？'),
        ('Who falls asleep first?', '谁先睡着？'),
        ('Who is more adventurous?', '谁更爱冒险？'),
        ('Who is the bigger foodie?', '谁更是吃货？'),
        ('Who is more competitive?', '谁更好胜？'),
        ('Who is the funnier one?', '谁更有趣？'),
        ('Who is more likely to get lost?', '谁更容易迷路？'),
        ('Who has better taste in music?', '谁的音乐品味更好？'),
        ('Who is the messier one?', '谁更爱乱？'),
        ('Who would survive alone on a deserted island?', '谁能在荒岛上独自生存？'),
        ('Who is more likely to forget an anniversary?', '谁更容易忘记纪念日？'),
        ('Who is the bigger scaredy-cat?', '谁更胆小？'),
        ('What''s something you''ve never told your partner but always wanted to?', '有什么事你一直想告诉对方却从未说过？'),
        ('What moment in our relationship made you feel most loved?', '在我们的关系中，哪个瞬间让你最感到被爱？'),
        ('What''s your biggest fear about our future together?', '你对我们未来最大的担心是什么？'),
        ('What do you think is our greatest strength as a couple?', '你觉得我们作为情侣最大的优势是什么？'),
        ('What''s something you wish we did more often?', '你希望我们更常做的一件事是什么？'),
        ('How has our relationship changed you as a person?', '我们的关系如何改变了你这个人？'),
        ('What''s a challenge we overcame that made us stronger?', '我们一起克服过的哪个挑战让我们更强大？'),
        ('What do you admire most about your partner?', '你最欣赏对方的是什么？'),
        ('What''s something small your partner does that means a lot to you?', '对方做过哪件小事对你意义很大？'),
        ('What dream do you hope we achieve together?', '你希望我们一起实现的梦想是什么？'),
        ('What''s the best advice you''ve received about relationships?', '你听过关于关系最好的建议是什么？'),
        ('How do you know when your partner needs support?', '你怎么知道对方需要支持？'),
        ('What''s something you want to apologize for?', '你想为哪件事道歉？'),
        ('What makes you feel most connected to your partner?', '什么让你和对方最有连接感？'),
        ('What''s a lesson you''ve learned from our disagreements?', '你从我们的争执中学到了什么？'),
        ('What was your first impression of your partner?', '你对对方的第一印象是什么？'),
        ('Describe your perfect date night with your partner.', '描述一下你理想中的约会之夜。'),
        ('What''s your favorite physical feature of your partner?', '你最喜欢对方的哪个外貌特征？'),
        ('What song reminds you of your relationship?', '哪首歌让你想起我们的关系？'),
        ('Where would you love to travel together?', '你最想和对方一起去哪里旅行？'),
        ('What''s the most romantic thing your partner has done?', '对方做过最浪漫的一件事是什么？'),
        ('What nickname do you secretly love being called?', '你私下里最喜欢被叫的昵称是什么？'),
        ('What moment made you realize you were in love?', '哪一刻让你意识到自己爱上了对方？'),
        ('What''s your favorite memory of us?', '你最喜欢的我们的回忆是什么？'),
        ('How do you most like to show love?', '你最喜欢用什么方式表达爱？'),
        ('What''s one habit you''d like to build together?', '你希望我们一起养成的一个习惯是什么？'),
        ('What''s something new you want to try as a couple?', '作为情侣，你想尝试的新事物是什么？'),
        ('Where do you see us in 5 years?', '你觉得我们五年后会是什么样？'),
        ('What''s a skill you''d like to learn together?', '你想和对方一起学的一项技能是什么？'),
        ('What does success look like for our relationship?', '我们的关系成功的样子是什么？'),
        ('What''s one way we could communicate better?', '我们可以在哪个方面沟通得更好？'),
        ('What boundaries are important to you in our relationship?', '在我们的关系中，对你来说重要的界限是什么？'),
        ('How can we better support each other''s individual dreams?', '我们怎样更好地支持彼此的个人梦想？'),
        ('What''s the funniest thing that''s happened to us?', '我们经历过最搞笑的一件事是什么？'),
        ('Describe our first kiss.', '描述我们的初吻。'),
        ('What''s your favorite holiday memory together?', '你最喜欢的我们一起度过的假期回忆是什么？'),
        ('What meal together stands out most in your memory?', '你印象最深的一次一起吃饭是哪一顿？'),
        ('What''s the best gift you''ve received from your partner?', '你收到过对方最好的礼物是什么？'),
        ('What''s a spontaneous adventure we had that you loved?', '我们的一次即兴冒险中你最喜欢哪一次？'),
        ('What''s a tradition you want us to keep forever?', '你希望我们永远保持的传统是什么？')
) AS v(original_question, translated_question)
JOIN question_bank qb ON qb.question = v.original_question
ON CONFLICT DO NOTHING;

-- 5) Seed Simplified Chinese translations for challenges
INSERT INTO challenges_translations (challenge_id, language, name, description)
SELECT c.id, 'zh-Hans', v.translated_name, v.translated_description
FROM (
    VALUES
        ('Daily Question Duo', '每日问题双人组', '你们两人都回答今天的每日喵问题。'),
        ('Curiosity Pair', '好奇双人组', '今天总共回答2个每日喵问题。'),
        ('Gratitude Ping', '感恩提醒', '你们每人发送1条感谢。'),
        ('Appreciation Burst', '感谢连发', '今天总共发送3条感谢。'),
        ('Mood Mirror', '情绪镜像', '你们两人今天都记录一次情绪。'),
        ('Mood Notes', '情绪笔记', '今天总共记录2次情绪。'),
        ('Memory Snapshot', '记忆快照', '今天上传1条共享回忆。'),
        ('Calendar Spark', '日历火花', '今天添加1个共享日历事件。'),
        ('Tiny Case', '小案子', '今天一起解决1个案件。'),
        ('Quick Plan', '快速计划', '今天总共添加2个日历事件。'),
        ('Double Check-In', '双重打卡', '你们每人今天记录2次情绪。'),
        ('Kind Word', '暖心话', '今天总共发送1条感谢。'),
        ('Memory Tag', '回忆标记', '你们每人今天上传1条回忆。'),
        ('Daily Double', '每日双倍', '你们两人今天各回答2个每日喵问题。'),
        ('Question Streak', '问题连胜', '连续3天一起回答每日喵问题。'),
        ('Deep Talk Week', '深谈一周', '本周总共回答5个每日喵问题。'),
        ('Curiosity Marathon', '好奇马拉松', '本周你们每人回答4个每日喵问题。'),
        ('Gratitude Streak', '感恩连胜', '连续3天一起发送感谢。'),
        ('Appreciation Exchange', '感谢交换', '本周你们每人发送3条感谢。'),
        ('Seven Nice Things', '七件好事', '本周总共发送7条感谢。'),
        ('Mood Week', '情绪周', '本周你们两人有4天记录情绪。'),
        ('Memory Pair', '回忆双人', '本周你们每人上传1条共享回忆。'),
        ('Memory Trail', '回忆足迹', '本周上传3条共享回忆。'),
        ('Memory Marathon', '回忆马拉松', '本周上传5条共享回忆。'),
        ('Calendar Together', '日历同行', '本周你们每人添加1个共享日历事件。'),
        ('Courtroom Duo', '法庭双人组', '本周一起解决2个案件。'),
        ('Tiny Surprise', '小惊喜', '给对方一个小惊喜并确认。'),
        ('Gratitude Letter', '感恩信', '写一段简短的感谢话并一起确认。'),
        ('Walk and Talk', '散步聊聊', '一起散步15分钟并确认。'),
        ('Screen-Free 30', '30分钟无屏', '放下手机一起相处30分钟并确认。'),
        ('Cook Together', '一起下厨', '一起准备一份简单的点心或餐食并确认。'),
        ('Mini Celebration', '小小庆祝', '一起庆祝一个小小的胜利并确认。')
) AS v(original_name, translated_name, translated_description)
JOIN challenges c ON c.name = v.original_name
ON CONFLICT DO NOTHING;

-- 6) Update get_todays_question to support language
DROP FUNCTION IF EXISTS get_todays_question(UUID, UUID);
DROP FUNCTION IF EXISTS get_todays_question(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION get_todays_question(p_user_id UUID, p_partner_id UUID, p_language TEXT)
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
    v_language TEXT := COALESCE(NULLIF(TRIM(p_language), ''), 'en');
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
        RETURN QUERY
        SELECT
            cqa.id,
            cqa.question_id,
            COALESCE(qbt_lang.question, qbt_en.question, qb.question),
            COALESCE(qbt_lang.emoji, qbt_en.emoji, qb.emoji),
            COALESCE(qbt_lang.category, qbt_en.category, qb.category),
            cqa.assigned_date,
            cqa.status,
            TRUE::BOOLEAN
        FROM couple_question_assignments cqa
        JOIN question_bank qb ON qb.id = cqa.question_id
        LEFT JOIN question_bank_translations qbt_lang
            ON qbt_lang.question_id = qb.id
            AND qbt_lang.language = v_language
        LEFT JOIN question_bank_translations qbt_en
            ON qbt_en.question_id = qb.id
            AND qbt_en.language = 'en'
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
        RETURN QUERY
        SELECT
            cqa.id,
            cqa.question_id,
            COALESCE(qbt_lang.question, qbt_en.question, qb.question),
            COALESCE(qbt_lang.emoji, qbt_en.emoji, qb.emoji),
            COALESCE(qbt_lang.category, qbt_en.category, qb.category),
            cqa.assigned_date,
            cqa.status,
            FALSE::BOOLEAN
        FROM couple_question_assignments cqa
        JOIN question_bank qb ON qb.id = cqa.question_id
        LEFT JOIN question_bank_translations qbt_lang
            ON qbt_lang.question_id = qb.id
            AND qbt_lang.language = v_language
        LEFT JOIN question_bank_translations qbt_en
            ON qbt_en.question_id = qb.id
            AND qbt_en.language = 'en'
        WHERE cqa.id = v_assignment_id;
        RETURN;
    END IF;

    -- Need to assign a new question
    UPDATE couple_question_assignments
    SET status = 'pending'
    WHERE user_a_id = v_user_a
      AND user_b_id = v_user_b
      AND couple_question_assignments.assigned_date = v_yesterday
      AND couple_question_assignments.status = 'active';

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

    IF v_question_id IS NULL THEN
        SELECT qb.id INTO v_question_id
        FROM question_bank qb
        WHERE qb.is_active = TRUE
        ORDER BY RANDOM()
        LIMIT 1;
    END IF;

    IF v_question_id IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO couple_question_assignments (user_a_id, user_b_id, question_id, assigned_date, status)
    VALUES (v_user_a, v_user_b, v_question_id, v_today, 'active')
    ON CONFLICT (user_a_id, user_b_id, assigned_date) DO UPDATE SET status = 'active'
    RETURNING id INTO v_assignment_id;

    RETURN QUERY
    SELECT
        cqa.id,
        cqa.question_id,
        COALESCE(qbt_lang.question, qbt_en.question, qb.question),
        COALESCE(qbt_lang.emoji, qbt_en.emoji, qb.emoji),
        COALESCE(qbt_lang.category, qbt_en.category, qb.category),
        cqa.assigned_date,
        cqa.status,
        FALSE::BOOLEAN
    FROM couple_question_assignments cqa
    JOIN question_bank qb ON qb.id = cqa.question_id
    LEFT JOIN question_bank_translations qbt_lang
        ON qbt_lang.question_id = qb.id
        AND qbt_lang.language = v_language
    LEFT JOIN question_bank_translations qbt_en
        ON qbt_en.question_id = qb.id
        AND qbt_en.language = 'en'
    WHERE cqa.id = v_assignment_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_todays_question IS 'Gets or creates today''s question for a couple. Uses America/New_York (EST/EDT) timezone, resetting at midnight Eastern Time. Output columns prefixed with out_ to avoid ambiguity with table columns.';

REVOKE ALL ON FUNCTION get_todays_question(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_todays_question(UUID, UUID, TEXT) TO service_role;

-- 7) Memory RPCs filtered by language
DROP FUNCTION IF EXISTS search_similar_memories(vector(1536), UUID, DOUBLE PRECISION, INTEGER);
DROP FUNCTION IF EXISTS search_similar_memories(vector(1536), UUID, TEXT, DOUBLE PRECISION, INTEGER);

CREATE OR REPLACE FUNCTION search_similar_memories(
    query_embedding vector(1536),
    target_user_id UUID,
    target_language TEXT DEFAULT 'en',
    similarity_threshold DOUBLE PRECISION DEFAULT 0.92,
    max_results INTEGER DEFAULT 10
)
RETURNS TABLE(
    id UUID,
    memory_text TEXT,
    memory_type TEXT,
    memory_subtype TEXT,
    language TEXT,
    similarity DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        um.id,
        um.memory_text,
        um.memory_type,
        um.memory_subtype,
        um.language,
        (1 - (um.embedding <=> query_embedding))::DOUBLE PRECISION as similarity
    FROM user_memories um
    WHERE um.user_id = target_user_id
      AND um.embedding IS NOT NULL
      AND um.is_active = TRUE
      AND um.language = COALESCE(target_language, 'en')
      AND (1 - (um.embedding <=> query_embedding)) >= similarity_threshold
    ORDER BY um.embedding <=> query_embedding
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

REVOKE ALL ON FUNCTION search_similar_memories(vector(1536), UUID, TEXT, DOUBLE PRECISION, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION search_similar_memories(vector(1536), UUID, TEXT, DOUBLE PRECISION, INTEGER) TO service_role;

DROP FUNCTION IF EXISTS retrieve_relevant_memories(vector(1536), UUID[], INTEGER);
DROP FUNCTION IF EXISTS retrieve_relevant_memories(vector(1536), UUID[], TEXT, INTEGER);

CREATE OR REPLACE FUNCTION retrieve_relevant_memories(
    query_embedding vector(1536),
    user_ids UUID[],
    target_language TEXT DEFAULT 'en',
    max_results INTEGER DEFAULT 4
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    memory_text TEXT,
    memory_type TEXT,
    memory_subtype TEXT,
    confidence_score DOUBLE PRECISION,
    reinforcement_count INTEGER,
    language TEXT,
    similarity DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        um.id,
        um.user_id,
        um.memory_text,
        um.memory_type,
        um.memory_subtype,
        um.confidence_score::DOUBLE PRECISION,
        um.reinforcement_count,
        um.language,
        (1 - (um.embedding <=> query_embedding))::DOUBLE PRECISION as similarity
    FROM user_memories um
    WHERE um.user_id = ANY(user_ids)
      AND um.embedding IS NOT NULL
      AND um.is_active = TRUE
      AND um.language = COALESCE(target_language, 'en')
    ORDER BY um.embedding <=> query_embedding
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

REVOKE ALL ON FUNCTION retrieve_relevant_memories(vector(1536), UUID[], TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION retrieve_relevant_memories(vector(1536), UUID[], TEXT, INTEGER) TO service_role;

DROP FUNCTION IF EXISTS retrieve_relevant_memories_v2(vector(1536), UUID[], INTEGER, INTEGER);
DROP FUNCTION IF EXISTS retrieve_relevant_memories_v2(vector(1536), UUID[], TEXT, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION retrieve_relevant_memories_v2(
    query_embedding vector(1536),
    user_ids UUID[],
    target_language TEXT DEFAULT 'en',
    max_results INTEGER DEFAULT 6,
    candidate_multiplier INTEGER DEFAULT 5
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    memory_text TEXT,
    memory_type TEXT,
    memory_subtype TEXT,
    confidence_score DOUBLE PRECISION,
    reinforcement_count INTEGER,
    last_observed_at TIMESTAMPTZ,
    source_type TEXT,
    source_id UUID,
    language TEXT,
    similarity DOUBLE PRECISION,
    score DOUBLE PRECISION
) AS $$
DECLARE
    candidate_limit INTEGER := GREATEST(max_results * candidate_multiplier, max_results);
BEGIN
    RETURN QUERY
    WITH candidates AS (
        SELECT
            um.id,
            um.user_id,
            um.memory_text,
            um.memory_type,
            um.memory_subtype,
            um.confidence_score::DOUBLE PRECISION,
            um.reinforcement_count,
            um.last_observed_at,
            um.source_type,
            um.source_id,
            um.language,
            (1 - (um.embedding <=> query_embedding))::DOUBLE PRECISION as similarity,
            EXTRACT(EPOCH FROM (NOW() - COALESCE(um.last_observed_at, um.created_at))) / 86400.0 as age_days
        FROM user_memories um
        WHERE um.user_id = ANY(user_ids)
          AND um.embedding IS NOT NULL
          AND um.is_active = TRUE
          AND um.language = COALESCE(target_language, 'en')
        ORDER BY um.embedding <=> query_embedding
        LIMIT candidate_limit
    )
    SELECT
        c.id,
        c.user_id,
        c.memory_text,
        c.memory_type,
        c.memory_subtype,
        c.confidence_score,
        c.reinforcement_count,
        c.last_observed_at,
        c.source_type,
        c.source_id,
        c.language,
        c.similarity,
        (
            (c.similarity * 0.55) +
            (EXP(-GREATEST(c.age_days, 0) / 45.0) * 0.20) +
            (COALESCE(c.confidence_score, 0.6) * 0.15) +
            (LEAST(1.0, COALESCE(c.reinforcement_count, 1) / 5.0) * 0.10)
        )::DOUBLE PRECISION as score
    FROM candidates c
    ORDER BY score DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

REVOKE ALL ON FUNCTION retrieve_relevant_memories_v2(vector(1536), UUID[], TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION retrieve_relevant_memories_v2(vector(1536), UUID[], TEXT, INTEGER, INTEGER) TO service_role;

-- 8) Court session language persistence
ALTER TABLE court_sessions
ADD COLUMN IF NOT EXISTS creator_language TEXT DEFAULT 'en';

ALTER TABLE court_sessions
ADD COLUMN IF NOT EXISTS partner_language TEXT DEFAULT 'en';

ALTER TABLE court_sessions
ADD COLUMN IF NOT EXISTS case_language TEXT DEFAULT 'en';

UPDATE court_sessions
SET creator_language = 'en'
WHERE creator_language IS NULL;

UPDATE court_sessions
SET partner_language = 'en'
WHERE partner_language IS NULL;

UPDATE court_sessions
SET case_language = 'en'
WHERE case_language IS NULL;

-- ============================================
-- DONE
-- ============================================
