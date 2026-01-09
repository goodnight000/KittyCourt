-- ============================================
-- MIGRATION: Replace Shallow Fun Questions with Deep, Meaningful Questions
-- ============================================
-- This migration:
-- 1. DELETES 20 shallow "fun" questions (permanently removed)
-- 2. DELETES 14 original questions replaced by better new versions
-- 3. Adds 20 new fun questions that are playful yet psychologically meaningful
-- 4. Adds 19 new deep questions (Gottman Love Maps, vulnerability research)
-- 5. Adds 16 new romantic questions (gratitude, appreciation, capitalization)
-- 6. Adds 20 new growth questions (Self-Expansion Theory, shared goals)
-- 7. Adds 16 new memories questions (positive sentiment, shared reminiscence)
-- 8. All 91 new questions include English and Simplified Chinese translations
-- ============================================

-- ============================================
-- STEP 1: Delete Shallow Fun Questions
-- ============================================
-- These questions are too superficial ("Who is better at X?") and don't foster connection
-- First delete translations, then the questions themselves

DELETE FROM question_bank_translations
WHERE question_id IN (
    SELECT id FROM question_bank WHERE question IN (
        'Who would survive longer in a zombie apocalypse?',
        'Who is more likely to become famous?',
        'Who is the better cook?',
        'Who would win in an argument?',
        'Who is more likely to cry at a movie?',
        'Who spends more money?',
        'Who is the early bird?',
        'Who takes longer to get ready?',
        'Who is the better driver?',
        'Who falls asleep first?',
        'Who is more adventurous?',
        'Who is the bigger foodie?',
        'Who is more competitive?',
        'Who is the funnier one?',
        'Who is more likely to get lost?',
        'Who has better taste in music?',
        'Who is the messier one?',
        'Who would survive alone on a deserted island?',
        'Who is more likely to forget an anniversary?',
        'Who is the bigger scaredy-cat?'
    )
);

DELETE FROM question_bank WHERE question IN (
    'Who would survive longer in a zombie apocalypse?',
    'Who is more likely to become famous?',
    'Who is the better cook?',
    'Who would win in an argument?',
    'Who is more likely to cry at a movie?',
    'Who spends more money?',
    'Who is the early bird?',
    'Who takes longer to get ready?',
    'Who is the better driver?',
    'Who falls asleep first?',
    'Who is more adventurous?',
    'Who is the bigger foodie?',
    'Who is more competitive?',
    'Who is the funnier one?',
    'Who is more likely to get lost?',
    'Who has better taste in music?',
    'Who is the messier one?',
    'Who would survive alone on a deserted island?',
    'Who is more likely to forget an anniversary?',
    'Who is the bigger scaredy-cat?'
);

-- ============================================
-- STEP 1b: Delete Original Questions (replaced by better new versions)
-- ============================================
DELETE FROM question_bank_translations
WHERE question_id IN (
    SELECT id FROM question_bank WHERE question IN (
        'How has our relationship changed you as a person?',
        'What''s a challenge we overcame that made us stronger?',
        'What''s something small your partner does that means a lot to you?',
        'What dream do you hope we achieve together?',
        'What was your first impression of your partner?',
        'What song reminds you of your relationship?',
        'What moment made you realize you were in love?',
        'What''s one habit you''d like to build together?',
        'What''s something new you want to try as a couple?',
        'Where do you see us in 5 years?',
        'How can we better support each other''s individual dreams?',
        'What''s your favorite holiday memory together?',
        'What meal together stands out most in your memory?',
        'What''s a tradition you want us to keep forever?'
    )
);

DELETE FROM question_bank WHERE question IN (
    'How has our relationship changed you as a person?',
    'What''s a challenge we overcame that made us stronger?',
    'What''s something small your partner does that means a lot to you?',
    'What dream do you hope we achieve together?',
    'What was your first impression of your partner?',
    'What song reminds you of your relationship?',
    'What moment made you realize you were in love?',
    'What''s one habit you''d like to build together?',
    'What''s something new you want to try as a couple?',
    'Where do you see us in 5 years?',
    'How can we better support each other''s individual dreams?',
    'What''s your favorite holiday memory together?',
    'What meal together stands out most in your memory?',
    'What''s a tradition you want us to keep forever?'
);

-- ============================================
-- STEP 2: Insert New Fun Questions (20) - Deep but Playful
-- ============================================
INSERT INTO question_bank (question, emoji, category) VALUES
('If a documentary crew followed us around for a day, what would they title the episode and what ''plot twist'' would they capture?', '🎬', 'fun'),
('What''s a skill or hobby you''ve secretly always wanted us to try together but felt too silly to suggest?', '🎭', 'fun'),
('If our love story was a food dish, what ingredients would be in it and what would it taste like?', '🍳', 'fun'),
('You wake up tomorrow with the ability to speak fluent Cat. What''s the first thing you''d say to our cat (real or imaginary)?', '🐱', 'fun'),
('If you could bottle one moment from our relationship to re-experience whenever you wanted, which would you choose?', '✨', 'fun'),
('Aliens land and ask you to explain human relationships using only our relationship as an example. What three things do you show them?', '👽', 'fun'),
('If we opened a tiny shop together that sold only one very specific thing, what would it be and what would we name it?', '🏪', 'fun'),
('What''s a ''plot hole'' in your childhood that you''ve never figured out? (A memory that doesn''t quite make sense)', '🧩', 'fun'),
('If your emotions today were a weather system, what would the forecast be?', '🌦️', 'fun'),
('You''re creating a museum exhibit about ''us.'' What three artifacts go in the display case and what do the little plaques say?', '🏛️', 'fun'),
('What''s a compliment you''ve never given me because it felt too weird or specific to say out loud?', '💭', 'fun'),
('If we were both characters in a video game, what would our special abilities be and what items would we drop when defeated?', '🎮', 'fun'),
('What ordinary thing that I do makes you feel surprisingly loved, even though I probably don''t realize it?', '💝', 'fun'),
('If you could send a 10-word message back in time to yourself on our first date, what would it say?', '⏰', 'fun'),
('What''s a tiny, irrational fear you have that you''ve never told anyone about?', '🙈', 'fun'),
('If our relationship had a blooper reel, which moment would definitely be on it?', '🤭', 'fun'),
('You''re writing the fortune cookie message that perfectly describes your current life chapter. What does it say?', '🥠', 'fun'),
('If you could have dinner with any version of me from the past or future, which age would you pick and what would you ask them?', '🍽️', 'fun'),
('What''s something you''ve changed your mind about since we''ve been together that you wouldn''t have expected?', '🔄', 'fun'),
('If we had a couples'' superhero team name and catchphrase, what would they be? (Bonus: what''s our weakness?)', '🦸', 'fun')
ON CONFLICT DO NOTHING;

-- ============================================
-- STEP 3: Insert New Deep Questions (19) - Vulnerability & Inner World
-- ============================================
-- Note: Removed "What do you need most from me when you're going through a hard time?"
-- as it duplicates the vulnerability question below
INSERT INTO question_bank (question, emoji, category) VALUES
('What''s a dream you''ve quietly held onto but rarely talk about?', '✨', 'deep'),
('When do you feel most like your true self?', '🌟', 'deep'),
('What''s something you wish people understood about you without having to explain?', '💭', 'deep'),
('What childhood experience shaped who you are today in ways others might not see?', '🌱', 'deep'),
('What makes you feel truly seen and understood?', '👁️', 'deep'),
('What''s a fear you carry that you don''t often share?', '🌊', 'deep'),
('If you could change one thing about how you were raised, what would it be?', '🔄', 'deep'),
('What''s something about our future together that excites you?', '🌅', 'deep'),
('When have you felt most proud of yourself, even if no one else noticed?', '🏆', 'deep'),
('What''s a belief or value you hold that feels core to who you are?', '🧭', 'deep'),
('What''s something you''ve never fully forgiven yourself for?', '💔', 'deep'),
('How do you want to be remembered by the people who matter most to you?', '🕊️', 'deep'),
('What''s a part of yourself you''re still learning to accept?', '🌙', 'deep'),
('What does feeling safe in a relationship mean to you?', '🏠', 'deep'),
('What''s something you wish you could tell your younger self?', '💌', 'deep'),
('When do you feel most vulnerable, and how can I support you in those moments?', '🫂', 'deep'),
('What''s a hope you have for us that you haven''t fully expressed?', '🌈', 'deep'),
('What life experience changed how you see the world?', '🔮', 'deep'),
('What does being truly loved look like to you?', '💝', 'deep')
ON CONFLICT DO NOTHING;

-- ============================================
-- STEP 4: Insert New Romantic Questions (16) - Gratitude & Appreciation
-- ============================================
-- Removed duplicates:
-- - "What small gesture..." (similar to fun question about ordinary things)
-- - "If you could relive one moment..." (similar to fun question about bottling moments)
-- - "What is something your partner does that makes you feel deeply seen..." (duplicate of deep question)
-- - "How has loving your partner changed..." (duplicate of growth question about personal growth)
INSERT INTO question_bank (question, emoji, category) VALUES
('When did you last feel a surge of gratitude for having your partner in your life?', '🙏', 'romantic'),
('What quality in your partner has grown more attractive to you over time?', '🌹', 'romantic'),
('Describe a time your partner''s support helped you through something difficult.', '🤝', 'romantic'),
('What inside joke or shared memory always brings a smile to your face?', '😊', 'romantic'),
('What is something your partner sacrificed or compromised for you that you''ve never properly thanked them for?', '💝', 'romantic'),
('When do you feel most romantically connected to your partner?', '💑', 'romantic'),
('What aspect of your partner''s personality still surprises or delights you?', '🎁', 'romantic'),
('If you wrote a love letter to your partner right now, what would the opening line be?', '💌', 'romantic'),
('What is something your partner taught you about love that you didn''t know before?', '📖', 'romantic'),
('When you picture growing old with your partner, what moment are you most looking forward to?', '👴', 'romantic'),
('What sensory detail about your partner do you find yourself savoring—their scent, voice, or touch?', '🌸', 'romantic'),
('How did your partner show up for you in a way you didn''t expect but deeply appreciated?', '💫', 'romantic'),
('What is your favorite way your partner expresses their love for you?', '💕', 'romantic'),
('What dream or goal are you excited to pursue together with your partner?', '🌟', 'romantic'),
('When was a time you felt proud to be your partner''s significant other?', '🏆', 'romantic'),
('What is one thing you''d like to tell your partner that you haven''t said in a while?', '💬', 'romantic')
ON CONFLICT DO NOTHING;

-- ============================================
-- STEP 5: Insert New Growth Questions (20) - Self-Expansion & Shared Goals
-- ============================================
INSERT INTO question_bank (question, emoji, category) VALUES
('What''s one dream you''ve been hesitant to share with me, and how can I help make it feel more possible?', '🌟', 'growth'),
('In what ways have you grown as a person since we''ve been together?', '🌱', 'growth'),
('What''s something new you''d like us to learn or experience together this year?', '📚', 'growth'),
('What personal goal are you currently working toward, and how can I better support you?', '🎯', 'growth'),
('Where do you see us in five years, and what excites you most about that vision?', '🔮', 'growth'),
('What value or principle do you want to guide our relationship as we grow together?', '🧭', 'growth'),
('What''s a fear that''s holding you back from pursuing something important to you?', '🦋', 'growth'),
('How has loving me challenged you to become a better version of yourself?', '💪', 'growth'),
('What''s one habit we could build together that would make our lives richer?', '🔄', 'growth'),
('What part of your identity would you like to explore or develop more?', '🎭', 'growth'),
('What legacy do you hope we''ll create together as a couple?', '🏛️', 'growth'),
('When do you feel most supported by me in pursuing your ambitions?', '🤝', 'growth'),
('What''s something you''ve always wanted to try but felt wasn''t practical?', '✨', 'growth'),
('How can we better celebrate each other''s individual achievements?', '🎉', 'growth'),
('What shared project or adventure would bring us closer while helping us grow?', '🗺️', 'growth'),
('What''s a skill or talent of mine you''d like to see me develop further?', '🌻', 'growth'),
('How do you want our relationship to be different one year from now?', '📅', 'growth'),
('What''s a conversation we''ve been avoiding that might help us grow?', '💬', 'growth'),
('What does your ideal future self look like, and how can I help you get there?', '🚀', 'growth'),
('What new experience could we share that would expand both of our worlds?', '🌍', 'growth')
ON CONFLICT DO NOTHING;

-- ============================================
-- STEP 6: Insert New Memories Questions (16) - Shared Reminiscence
-- ============================================
-- Removed duplicates:
-- - "What's the funniest thing that's ever happened to us as a couple?" (duplicate of original Q54)
-- - "When did you feel most supported by me during a difficult time?" (duplicate of romantic support question)
-- - "What moment from our early dating days do you wish you could relive?" (similar to fun bottling question)
-- - "What's something I did that made you feel truly seen and understood?" (duplicate of deep question)
INSERT INTO question_bank (question, emoji, category) VALUES
('What''s a small, seemingly ordinary moment from our relationship that you find yourself thinking about often?', '💭', 'memories'),
('What was your first impression of me, and how has it changed over time?', '✨', 'memories'),
('Which trip or adventure together stands out as the most memorable for you?', '🗺️', 'memories'),
('What moment made you realize you were falling in love with me?', '💕', 'memories'),
('What''s a challenge we overcame together that you''re proud of?', '🏆', 'memories'),
('What tradition have we created together that means the most to you?', '🎄', 'memories'),
('What''s a meal or dish we''ve shared that brings back special memories?', '🍽️', 'memories'),
('What''s something I said early in our relationship that you still remember?', '💬', 'memories'),
('What''s your favorite photo of us and why does it mean so much to you?', '📸', 'memories'),
('What song reminds you of a specific moment in our relationship?', '🎵', 'memories'),
('What''s the best surprise you''ve ever received from me?', '🎁', 'memories'),
('What''s a place that holds special meaning for our relationship?', '📍', 'memories'),
('What''s a holiday or celebration we spent together that you loved?', '🎉', 'memories'),
('What''s a time when we laughed so hard we couldn''t stop?', '🤣', 'memories'),
('What''s something new we tried together that became a favorite memory?', '🌟', 'memories'),
('What memory of us would you want to tell our future selves about?', '💌', 'memories')
ON CONFLICT DO NOTHING;

-- ============================================
-- STEP 7: Insert English Translations for All New Questions
-- ============================================
INSERT INTO question_bank_translations (question_id, language, question, emoji, category)
SELECT id, 'en', question, emoji, category
FROM question_bank
WHERE question IN (
    -- Fun (20)
    'If a documentary crew followed us around for a day, what would they title the episode and what ''plot twist'' would they capture?',
    'What''s a skill or hobby you''ve secretly always wanted us to try together but felt too silly to suggest?',
    'If our love story was a food dish, what ingredients would be in it and what would it taste like?',
    'You wake up tomorrow with the ability to speak fluent Cat. What''s the first thing you''d say to our cat (real or imaginary)?',
    'If you could bottle one moment from our relationship to re-experience whenever you wanted, which would you choose?',
    'Aliens land and ask you to explain human relationships using only our relationship as an example. What three things do you show them?',
    'If we opened a tiny shop together that sold only one very specific thing, what would it be and what would we name it?',
    'What''s a ''plot hole'' in your childhood that you''ve never figured out? (A memory that doesn''t quite make sense)',
    'If your emotions today were a weather system, what would the forecast be?',
    'You''re creating a museum exhibit about ''us.'' What three artifacts go in the display case and what do the little plaques say?',
    'What''s a compliment you''ve never given me because it felt too weird or specific to say out loud?',
    'If we were both characters in a video game, what would our special abilities be and what items would we drop when defeated?',
    'What ordinary thing that I do makes you feel surprisingly loved, even though I probably don''t realize it?',
    'If you could send a 10-word message back in time to yourself on our first date, what would it say?',
    'What''s a tiny, irrational fear you have that you''ve never told anyone about?',
    'If our relationship had a blooper reel, which moment would definitely be on it?',
    'You''re writing the fortune cookie message that perfectly describes your current life chapter. What does it say?',
    'If you could have dinner with any version of me from the past or future, which age would you pick and what would you ask them?',
    'What''s something you''ve changed your mind about since we''ve been together that you wouldn''t have expected?',
    'If we had a couples'' superhero team name and catchphrase, what would they be? (Bonus: what''s our weakness?)',
    -- Deep (19)
    'What''s a dream you''ve quietly held onto but rarely talk about?',
    'When do you feel most like your true self?',
    'What''s something you wish people understood about you without having to explain?',
    'What childhood experience shaped who you are today in ways others might not see?',
    'What makes you feel truly seen and understood?',
    'What''s a fear you carry that you don''t often share?',
    'If you could change one thing about how you were raised, what would it be?',
    'What''s something about our future together that excites you?',
    'When have you felt most proud of yourself, even if no one else noticed?',
    'What''s a belief or value you hold that feels core to who you are?',
    'What''s something you''ve never fully forgiven yourself for?',
    'How do you want to be remembered by the people who matter most to you?',
    'What''s a part of yourself you''re still learning to accept?',
    'What does feeling safe in a relationship mean to you?',
    'What''s something you wish you could tell your younger self?',
    'When do you feel most vulnerable, and how can I support you in those moments?',
    'What''s a hope you have for us that you haven''t fully expressed?',
    'What life experience changed how you see the world?',
    'What does being truly loved look like to you?',
    -- Romantic (16)
    'When did you last feel a surge of gratitude for having your partner in your life?',
    'What quality in your partner has grown more attractive to you over time?',
    'Describe a time your partner''s support helped you through something difficult.',
    'What inside joke or shared memory always brings a smile to your face?',
    'What is something your partner sacrificed or compromised for you that you''ve never properly thanked them for?',
    'When do you feel most romantically connected to your partner?',
    'What aspect of your partner''s personality still surprises or delights you?',
    'If you wrote a love letter to your partner right now, what would the opening line be?',
    'What is something your partner taught you about love that you didn''t know before?',
    'When you picture growing old with your partner, what moment are you most looking forward to?',
    'What sensory detail about your partner do you find yourself savoring—their scent, voice, or touch?',
    'How did your partner show up for you in a way you didn''t expect but deeply appreciated?',
    'What is your favorite way your partner expresses their love for you?',
    'What dream or goal are you excited to pursue together with your partner?',
    'When was a time you felt proud to be your partner''s significant other?',
    'What is one thing you''d like to tell your partner that you haven''t said in a while?',
    -- Growth (20)
    'What''s one dream you''ve been hesitant to share with me, and how can I help make it feel more possible?',
    'In what ways have you grown as a person since we''ve been together?',
    'What''s something new you''d like us to learn or experience together this year?',
    'What personal goal are you currently working toward, and how can I better support you?',
    'Where do you see us in five years, and what excites you most about that vision?',
    'What value or principle do you want to guide our relationship as we grow together?',
    'What''s a fear that''s holding you back from pursuing something important to you?',
    'How has loving me challenged you to become a better version of yourself?',
    'What''s one habit we could build together that would make our lives richer?',
    'What part of your identity would you like to explore or develop more?',
    'What legacy do you hope we''ll create together as a couple?',
    'When do you feel most supported by me in pursuing your ambitions?',
    'What''s something you''ve always wanted to try but felt wasn''t practical?',
    'How can we better celebrate each other''s individual achievements?',
    'What shared project or adventure would bring us closer while helping us grow?',
    'What''s a skill or talent of mine you''d like to see me develop further?',
    'How do you want our relationship to be different one year from now?',
    'What''s a conversation we''ve been avoiding that might help us grow?',
    'What does your ideal future self look like, and how can I help you get there?',
    'What new experience could we share that would expand both of our worlds?',
    -- Memories (16)
    'What''s a small, seemingly ordinary moment from our relationship that you find yourself thinking about often?',
    'What was your first impression of me, and how has it changed over time?',
    'Which trip or adventure together stands out as the most memorable for you?',
    'What moment made you realize you were falling in love with me?',
    'What''s a challenge we overcame together that you''re proud of?',
    'What tradition have we created together that means the most to you?',
    'What''s a meal or dish we''ve shared that brings back special memories?',
    'What''s something I said early in our relationship that you still remember?',
    'What''s your favorite photo of us and why does it mean so much to you?',
    'What song reminds you of a specific moment in our relationship?',
    'What''s the best surprise you''ve ever received from me?',
    'What''s a place that holds special meaning for our relationship?',
    'What''s a holiday or celebration we spent together that you loved?',
    'What''s a time when we laughed so hard we couldn''t stop?',
    'What''s something new we tried together that became a favorite memory?',
    'What memory of us would you want to tell our future selves about?'
)
ON CONFLICT DO NOTHING;

-- ============================================
-- STEP 8: Insert Simplified Chinese Translations
-- ============================================
INSERT INTO question_bank_translations (question_id, language, question, emoji, category)
SELECT qb.id, 'zh-Hans', v.translated_question, qb.emoji, qb.category
FROM (
    VALUES
    -- Fun Questions (20)
    ('If a documentary crew followed us around for a day, what would they title the episode and what ''plot twist'' would they capture?', '如果有纪录片团队跟拍我们一天，他们会给这集取什么标题？会捕捉到什么''剧情反转''？'),
    ('What''s a skill or hobby you''ve secretly always wanted us to try together but felt too silly to suggest?', '有没有一项你一直偷偷想和我一起尝试的技能或爱好，但觉得说出来太傻了？'),
    ('If our love story was a food dish, what ingredients would be in it and what would it taste like?', '如果我们的爱情故事是一道菜，里面会有什么食材？尝起来是什么味道？'),
    ('You wake up tomorrow with the ability to speak fluent Cat. What''s the first thing you''d say to our cat (real or imaginary)?', '如果明天醒来你突然能说流利的猫语，你会对我们的猫（真实的或想象的）说的第一句话是什么？'),
    ('If you could bottle one moment from our relationship to re-experience whenever you wanted, which would you choose?', '如果你能把我们关系中的某个瞬间装进瓶子里，随时重温，你会选择哪个？'),
    ('Aliens land and ask you to explain human relationships using only our relationship as an example. What three things do you show them?', '外星人降落了，让你只用我们的关系来解释人类的感情。你会给他们展示哪三件事？'),
    ('If we opened a tiny shop together that sold only one very specific thing, what would it be and what would we name it?', '如果我们一起开一家只卖一种很特别东西的小店，会卖什么？店名叫什么？'),
    ('What''s a ''plot hole'' in your childhood that you''ve never figured out? (A memory that doesn''t quite make sense)', '你童年有什么''剧情漏洞''是你到现在都没想明白的？（一段说不太通的记忆）'),
    ('If your emotions today were a weather system, what would the forecast be?', '如果你今天的情绪是一个天气系统，天气预报会怎么说？'),
    ('You''re creating a museum exhibit about ''us.'' What three artifacts go in the display case and what do the little plaques say?', '你要为''我们''创建一个博物馆展览。展示柜里放哪三件文物？小标签上写什么？'),
    ('What''s a compliment you''ve never given me because it felt too weird or specific to say out loud?', '有没有一句你从没对我说过的赞美，因为觉得说出来太奇怪或太具体了？'),
    ('If we were both characters in a video game, what would our special abilities be and what items would we drop when defeated?', '如果我们是电子游戏里的角色，我们的特殊技能是什么？被打败时会掉落什么道具？'),
    ('What ordinary thing that I do makes you feel surprisingly loved, even though I probably don''t realize it?', '我做的什么普通小事会让你出乎意料地感到被爱，尽管我自己可能都没意识到？'),
    ('If you could send a 10-word message back in time to yourself on our first date, what would it say?', '如果你能给第一次约会时的自己发一条10个字的信息，你会说什么？'),
    ('What''s a tiny, irrational fear you have that you''ve never told anyone about?', '你有什么从没告诉过别人的、微小又不理性的恐惧？'),
    ('If our relationship had a blooper reel, which moment would definitely be on it?', '如果我们的感情有一个NG花絮集锦，哪个瞬间肯定会在里面？'),
    ('You''re writing the fortune cookie message that perfectly describes your current life chapter. What does it say?', '你要写一条完美描述你人生现阶段的幸运饼干签语。上面写什么？'),
    ('If you could have dinner with any version of me from the past or future, which age would you pick and what would you ask them?', '如果你能和过去或未来任何年龄的我共进晚餐，你会选几岁的我？你会问什么？'),
    ('What''s something you''ve changed your mind about since we''ve been together that you wouldn''t have expected?', '自从我们在一起后，有什么你意外改变了想法的事情？'),
    ('If we had a couples'' superhero team name and catchphrase, what would they be? (Bonus: what''s our weakness?)', '如果我们是一对超级英雄搭档，我们的队名和口号是什么？（加分项：我们的弱点是什么？）'),

    -- Deep Questions (19)
    ('What''s a dream you''ve quietly held onto but rarely talk about?', '你心里一直默默怀揣着但很少说起的梦想是什么？'),
    ('When do you feel most like your true self?', '什么时候你最能感受到真实的自己？'),
    ('What''s something you wish people understood about you without having to explain?', '有什么事情你希望别人不用解释就能理解你？'),
    ('What childhood experience shaped who you are today in ways others might not see?', '哪段童年经历以别人可能看不到的方式塑造了今天的你？'),
    ('What makes you feel truly seen and understood?', '什么让你感到被真正看见和理解？'),
    ('What''s a fear you carry that you don''t often share?', '你心里藏着什么不常与人分享的恐惧？'),
    ('If you could change one thing about how you were raised, what would it be?', '如果可以改变你成长过程中的一件事，会是什么？'),
    ('What''s something about our future together that excites you?', '关于我们共同的未来，什么让你感到兴奋？'),
    ('When have you felt most proud of yourself, even if no one else noticed?', '什么时候你最为自己骄傲，即使没人注意到？'),
    ('What''s a belief or value you hold that feels core to who you are?', '有什么信念或价值观是你觉得构成自己核心的？'),
    ('What''s something you''ve never fully forgiven yourself for?', '有什么事情你从未完全原谅过自己？'),
    ('How do you want to be remembered by the people who matter most to you?', '你希望那些对你最重要的人如何记住你？'),
    ('What''s a part of yourself you''re still learning to accept?', '你还在学着接受自己的哪一部分？'),
    ('What does feeling safe in a relationship mean to you?', '在一段关系中感到安全对你来说意味着什么？'),
    ('What''s something you wish you could tell your younger self?', '你希望能对年轻时的自己说什么？'),
    ('When do you feel most vulnerable, and how can I support you in those moments?', '你什么时候最感到脆弱，那些时刻我可以怎样支持你？'),
    ('What''s a hope you have for us that you haven''t fully expressed?', '你对我们有什么还没完全表达过的期望？'),
    ('What life experience changed how you see the world?', '什么人生经历改变了你看待世界的方式？'),
    ('What does being truly loved look like to you?', '对你来说，被真正爱着是什么样子的？'),

    -- Romantic Questions (16)
    ('When did you last feel a surge of gratitude for having your partner in your life?', '你上一次对拥有伴侣而涌起深深的感激是什么时候？'),
    ('What quality in your partner has grown more attractive to you over time?', '随着时间推移，伴侣身上哪种品质对你越来越有吸引力？'),
    ('Describe a time your partner''s support helped you through something difficult.', '描述一次伴侣的支持帮助你度过困难时期的经历。'),
    ('What inside joke or shared memory always brings a smile to your face?', '哪个只属于你们的笑话或共同回忆总能让你会心一笑？'),
    ('What is something your partner sacrificed or compromised for you that you''ve never properly thanked them for?', '伴侣为你做出过哪些牺牲或妥协是你从未好好感谢过的？'),
    ('When do you feel most romantically connected to your partner?', '什么时候你感觉和伴侣在浪漫上最有连接？'),
    ('What aspect of your partner''s personality still surprises or delights you?', '伴侣性格的哪个方面至今仍让你惊喜或欣喜？'),
    ('If you wrote a love letter to your partner right now, what would the opening line be?', '如果现在给伴侣写一封情书，开头第一句你会写什么？'),
    ('What is something your partner taught you about love that you didn''t know before?', '伴侣教会了你哪些关于爱的事是你以前不知道的？'),
    ('When you picture growing old with your partner, what moment are you most looking forward to?', '当你想象和伴侣一起变老，你最期待的是哪个时刻？'),
    ('What sensory detail about your partner do you find yourself savoring—their scent, voice, or touch?', '关于伴侣的哪个感官细节让你沉醉——他们的气味、声音还是触感？'),
    ('How did your partner show up for you in a way you didn''t expect but deeply appreciated?', '伴侣曾以哪种出乎意料的方式支持你，让你深深感激？'),
    ('What is your favorite way your partner expresses their love for you?', '伴侣表达爱意的方式中，你最喜欢哪一种？'),
    ('What dream or goal are you excited to pursue together with your partner?', '有什么梦想或目标是你期待和伴侣一起追求的？'),
    ('When was a time you felt proud to be your partner''s significant other?', '什么时候你为自己是伴侣的另一半而感到骄傲？'),
    ('What is one thing you''d like to tell your partner that you haven''t said in a while?', '有什么话是你想对伴侣说但已经很久没说的？'),

    -- Growth Questions (20)
    ('What''s one dream you''ve been hesitant to share with me, and how can I help make it feel more possible?', '有什么梦想你一直不太敢跟我说？我怎样能帮你觉得它更有可能实现？'),
    ('In what ways have you grown as a person since we''ve been together?', '自从我们在一起后，你觉得自己在哪些方面有所成长？'),
    ('What''s something new you''d like us to learn or experience together this year?', '今年你希望我们一起学习或体验什么新事物？'),
    ('What personal goal are you currently working toward, and how can I better support you?', '你目前正在努力实现什么个人目标？我怎样能更好地支持你？'),
    ('Where do you see us in five years, and what excites you most about that vision?', '你觉得五年后我们会是什么样子？这个愿景中最让你期待的是什么？'),
    ('What value or principle do you want to guide our relationship as we grow together?', '在我们共同成长的过程中，你希望什么价值观或原则来指引我们的关系？'),
    ('What''s a fear that''s holding you back from pursuing something important to you?', '有什么恐惧在阻碍你追求对你重要的事情？'),
    ('How has loving me challenged you to become a better version of yourself?', '爱我这件事如何促使你成为更好的自己？'),
    ('What''s one habit we could build together that would make our lives richer?', '我们可以一起培养什么习惯，能让我们的生活更加充实？'),
    ('What part of your identity would you like to explore or develop more?', '你想更多地探索或发展自己哪方面的特质？'),
    ('What legacy do you hope we''ll create together as a couple?', '作为一对伴侣，你希望我们共同留下什么样的传承？'),
    ('When do you feel most supported by me in pursuing your ambitions?', '在追求你的抱负时，什么时候你觉得我对你的支持最到位？'),
    ('What''s something you''ve always wanted to try but felt wasn''t practical?', '有什么你一直想尝试但觉得不太现实的事情？'),
    ('How can we better celebrate each other''s individual achievements?', '我们怎样能更好地庆祝彼此的个人成就？'),
    ('What shared project or adventure would bring us closer while helping us grow?', '什么共同的项目或冒险能让我们更亲近，同时也帮助我们成长？'),
    ('What''s a skill or talent of mine you''d like to see me develop further?', '我的哪项技能或才能是你希望看到我进一步发展的？'),
    ('How do you want our relationship to be different one year from now?', '一年后，你希望我们的关系有什么不同？'),
    ('What''s a conversation we''ve been avoiding that might help us grow?', '有什么我们一直在回避的对话，可能会帮助我们成长？'),
    ('What does your ideal future self look like, and how can I help you get there?', '你理想中未来的自己是什么样子？我怎样能帮助你实现？'),
    ('What new experience could we share that would expand both of our worlds?', '我们可以分享什么新体验，能够同时拓宽我们两个人的世界？'),

    -- Memories Questions (16)
    ('What''s a small, seemingly ordinary moment from our relationship that you find yourself thinking about often?', '我们关系中有哪个看似平凡的小瞬间，你会经常想起？'),
    ('What was your first impression of me, and how has it changed over time?', '你对我的第一印象是什么？随着时间推移有什么变化？'),
    ('Which trip or adventure together stands out as the most memorable for you?', '我们一起经历的哪次旅行或冒险让你印象最深刻？'),
    ('What moment made you realize you were falling in love with me?', '是什么时刻让你意识到自己正在爱上我？'),
    ('What''s a challenge we overcame together that you''re proud of?', '有什么我们一起克服的挑战让你感到骄傲？'),
    ('What tradition have we created together that means the most to you?', '我们一起建立的哪个传统对你来说最有意义？'),
    ('What''s a meal or dish we''ve shared that brings back special memories?', '有哪道我们一起吃过的美食能唤起美好的回忆？'),
    ('What''s something I said early in our relationship that you still remember?', '在我们刚在一起时，我说过的哪句话你至今还记得？'),
    ('What''s your favorite photo of us and why does it mean so much to you?', '你最喜欢我们的哪张合照？为什么它对你意义非凡？'),
    ('What song reminds you of a specific moment in our relationship?', '哪首歌会让你想起我们关系中的某个特定时刻？'),
    ('What''s the best surprise you''ve ever received from me?', '你收到过我给你的最棒的惊喜是什么？'),
    ('What''s a place that holds special meaning for our relationship?', '有什么地方对我们的感情有特殊意义？'),
    ('What''s a holiday or celebration we spent together that you loved?', '我们一起度过的哪个节日或庆祝活动让你特别喜欢？'),
    ('What''s a time when we laughed so hard we couldn''t stop?', '有没有哪次我们笑得停不下来？'),
    ('What''s something new we tried together that became a favorite memory?', '有什么我们一起尝试的新事物成为了美好的回忆？'),
    ('What memory of us would you want to tell our future selves about?', '你会想把我们的哪段回忆讲给未来的我们听？')
) AS v(original_question, translated_question)
JOIN question_bank qb ON qb.question = v.original_question
ON CONFLICT DO NOTHING;

-- ============================================
-- DONE!
-- ============================================
-- Summary of changes:
-- - DELETED 20 shallow "who is better" style fun questions
-- - DELETED 14 original questions replaced by better new versions
-- - Added 91 new unique questions total:
--   * 20 Fun (creative, playful, foster connection)
--   * 19 Deep (Gottman Love Maps, vulnerability, inner world)
--   * 16 Romantic (gratitude, appreciation, capitalization research)
--   * 20 Growth (Self-Expansion Theory, shared goals, secure base)
--   * 16 Memories (positive sentiment, shared reminiscence)
-- - All questions include both English and Simplified Chinese translations
-- - Duplicates removed to ensure unique question set
-- ============================================
