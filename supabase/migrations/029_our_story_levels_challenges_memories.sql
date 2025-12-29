-- ============================================
-- OUR STORY: Levels, Challenges, Memories, Insights
-- ============================================
-- Aligns with profiles.partner_id pattern (no couples table)
-- Adds helper functions, tables, and RLS policies

-- ============================================
-- Helper functions
-- ============================================

CREATE OR REPLACE FUNCTION get_my_couple_ids()
RETURNS TABLE(user_a_id UUID, user_b_id UUID)
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT gc.out_user_a, gc.out_user_b
    FROM get_couple_ids(auth.uid(), get_my_partner_id()) gc
    WHERE get_my_partner_id() IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION is_my_couple(check_user_a UUID, check_user_b UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM get_my_couple_ids() c
        WHERE c.user_a_id = check_user_a AND c.user_b_id = check_user_b
    )
$$;

CREATE OR REPLACE FUNCTION is_connected()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT get_my_partner_id() IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION get_couple_folder()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT CONCAT(
        LEAST(auth.uid()::text, get_my_partner_id()::text),
        '_',
        GREATEST(auth.uid()::text, get_my_partner_id()::text)
    )
    WHERE get_my_partner_id() IS NOT NULL
$$;

REVOKE ALL ON FUNCTION get_my_couple_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_my_couple_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_couple_ids() TO service_role;

REVOKE ALL ON FUNCTION is_my_couple(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_my_couple(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_my_couple(UUID, UUID) TO service_role;

REVOKE ALL ON FUNCTION is_connected() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_connected() TO authenticated;
GRANT EXECUTE ON FUNCTION is_connected() TO service_role;

REVOKE ALL ON FUNCTION get_couple_folder() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_couple_folder() TO authenticated;
GRANT EXECUTE ON FUNCTION get_couple_folder() TO service_role;

-- ============================================
-- Consent columns (profiles)
-- ============================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_insights_consent BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_insights_consent_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_insights_paused_until TIMESTAMPTZ;

-- ============================================
-- Tables
-- ============================================

CREATE TABLE IF NOT EXISTS couple_levels (
    user_a_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    user_b_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    total_xp INTEGER DEFAULT 0,
    current_level INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_a_id, user_b_id),
    CHECK (user_a_id < user_b_id)
);

CREATE TABLE IF NOT EXISTS xp_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key TEXT UNIQUE NOT NULL,
    user_a_id UUID NOT NULL,
    user_b_id UUID NOT NULL,
    user_id UUID REFERENCES profiles(id) NOT NULL,
    action_type TEXT NOT NULL,
    source_id TEXT,
    xp_amount INTEGER NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_a_id, user_b_id) REFERENCES couple_levels(user_a_id, user_b_id) ON DELETE CASCADE,
    CHECK (user_a_id < user_b_id)
);

CREATE INDEX IF NOT EXISTS idx_xp_transactions_couple
    ON xp_transactions(user_a_id, user_b_id, created_at);
CREATE INDEX IF NOT EXISTS idx_xp_transactions_user_action
    ON xp_transactions(user_id, action_type, created_at);

CREATE TABLE IF NOT EXISTS challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    emoji TEXT,
    type TEXT NOT NULL CHECK (type IN ('count', 'streak', 'milestone', 'behavioral')),
    target_value INTEGER NOT NULL,
    verification_config JSONB NOT NULL,
    requires_partner_confirm BOOLEAN DEFAULT FALSE,
    reward_xp INTEGER DEFAULT 0,
    reward_badge_id UUID,
    difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    cooldown_days INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS couple_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_a_id UUID NOT NULL,
    user_b_id UUID NOT NULL,
    challenge_id UUID REFERENCES challenges(id) NOT NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    current_progress INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired', 'skipped')),
    completed_at TIMESTAMPTZ,
    partner_confirm_requested_at TIMESTAMPTZ,
    partner_confirmed_at TIMESTAMPTZ,
    verification_log JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (user_a_id < user_b_id),
    UNIQUE(user_a_id, user_b_id, challenge_id, started_at)
);

CREATE TABLE IF NOT EXISTS memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_a_id UUID NOT NULL,
    user_b_id UUID NOT NULL,
    uploaded_by UUID REFERENCES profiles(id) NOT NULL,
    storage_path TEXT NOT NULL,
    caption TEXT,
    memory_date DATE NOT NULL,
    moderation_status TEXT DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (user_a_id < user_b_id)
);

CREATE INDEX IF NOT EXISTS idx_memories_couple
    ON memories(user_a_id, user_b_id, is_deleted, memory_date);

CREATE TABLE IF NOT EXISTS memory_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    memory_id UUID REFERENCES memories(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) NOT NULL,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(memory_id, user_id)
);

CREATE TABLE IF NOT EXISTS memory_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    memory_id UUID REFERENCES memories(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    emoji TEXT NOT NULL,
    unlock_condition TEXT,
    display_surface TEXT[],
    is_hidden BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS couple_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_a_id UUID NOT NULL,
    user_b_id UUID NOT NULL,
    badge_id UUID REFERENCES badges(id) NOT NULL,
    earned_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (user_a_id < user_b_id),
    UNIQUE(user_a_id, user_b_id, badge_id)
);

CREATE TABLE IF NOT EXISTS insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_a_id UUID NOT NULL,
    user_b_id UUID NOT NULL,
    category TEXT NOT NULL,
    insight_text TEXT NOT NULL,
    evidence_summary TEXT,
    confidence_score NUMERIC(3,2),
    helpful_count INTEGER DEFAULT 0,
    not_helpful_count INTEGER DEFAULT 0,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    CHECK (user_a_id < user_b_id)
);

CREATE INDEX IF NOT EXISTS idx_insights_couple
    ON insights(user_a_id, user_b_id, is_active);

CREATE TABLE IF NOT EXISTS relationship_stats (
    user_a_id UUID NOT NULL,
    user_b_id UUID NOT NULL,
    stats JSONB DEFAULT '{}',
    last_calculated TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_a_id, user_b_id),
    CHECK (user_a_id < user_b_id)
);

-- ============================================
-- RLS Policies
-- ============================================

ALTER TABLE couple_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE xp_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE couple_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE couple_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationship_stats ENABLE ROW LEVEL SECURITY;

-- couple_levels
CREATE POLICY "Connected couples can view their level"
ON couple_levels FOR SELECT
USING (
    is_connected() AND
    is_my_couple(user_a_id, user_b_id)
);

-- xp_transactions
CREATE POLICY "Connected couples can view XP history"
ON xp_transactions FOR SELECT
USING (
    is_connected() AND
    is_my_couple(user_a_id, user_b_id)
);

-- challenges (read-only for authenticated users)
CREATE POLICY "Challenges are readable"
ON challenges FOR SELECT
USING (auth.role() = 'authenticated');

-- couple_challenges
CREATE POLICY "Connected couples can view their challenges"
ON couple_challenges FOR SELECT
USING (
    is_connected() AND
    is_my_couple(user_a_id, user_b_id)
);

-- memories
CREATE POLICY "Connected couples can view memories"
ON memories FOR SELECT
USING (
    is_connected() AND
    is_my_couple(user_a_id, user_b_id) AND
    (
        is_deleted = FALSE OR
        (
            is_deleted = TRUE AND
            deleted_by IS NOT NULL AND
            deleted_by != auth.uid() AND
            deleted_at >= (NOW() - INTERVAL '30 days')
        )
    )
);

CREATE POLICY "Connected couples can insert memories"
ON memories FOR INSERT
WITH CHECK (
    is_connected() AND
    is_my_couple(user_a_id, user_b_id) AND
    uploaded_by = auth.uid()
);

CREATE POLICY "Uploader can soft-delete memories"
ON memories FOR UPDATE
USING (
    is_connected() AND
    is_my_couple(user_a_id, user_b_id) AND
    uploaded_by = auth.uid() AND
    is_deleted = FALSE
)
WITH CHECK (
    is_deleted = TRUE AND
    deleted_by = auth.uid() AND
    deleted_at IS NOT NULL
);

CREATE POLICY "Partner can restore deleted memories"
ON memories FOR UPDATE
USING (
    is_connected() AND
    is_my_couple(user_a_id, user_b_id) AND
    is_deleted = TRUE AND
    deleted_by != auth.uid() AND
    deleted_at >= (NOW() - INTERVAL '30 days')
)
WITH CHECK (
    is_deleted = FALSE AND
    deleted_by IS NULL AND
    deleted_at IS NULL
);

CREATE POLICY "Uploader can restore within 24h"
ON memories FOR UPDATE
USING (
    is_connected() AND
    is_my_couple(user_a_id, user_b_id) AND
    is_deleted = TRUE AND
    deleted_by = auth.uid() AND
    deleted_at >= (NOW() - INTERVAL '24 hours')
)
WITH CHECK (
    is_deleted = FALSE AND
    deleted_by IS NULL AND
    deleted_at IS NULL
);

-- memory_reactions
CREATE POLICY "Connected couples can view reactions"
ON memory_reactions FOR SELECT
USING (
    is_connected() AND
    EXISTS (
        SELECT 1 FROM memories m
        WHERE m.id = memory_id
        AND is_my_couple(m.user_a_id, m.user_b_id)
        AND m.is_deleted = FALSE
    )
);

CREATE POLICY "Connected couples can add reactions"
ON memory_reactions FOR INSERT
WITH CHECK (
    is_connected() AND
    user_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM memories m
        WHERE m.id = memory_id
        AND is_my_couple(m.user_a_id, m.user_b_id)
        AND m.is_deleted = FALSE
    )
);

CREATE POLICY "Users can update own reactions"
ON memory_reactions FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own reactions"
ON memory_reactions FOR DELETE
USING (user_id = auth.uid());

-- memory_comments
CREATE POLICY "Connected couples can view comments"
ON memory_comments FOR SELECT
USING (
    is_connected() AND
    EXISTS (
        SELECT 1 FROM memories m
        WHERE m.id = memory_id
        AND is_my_couple(m.user_a_id, m.user_b_id)
        AND m.is_deleted = FALSE
    )
);

CREATE POLICY "Connected couples can add comments"
ON memory_comments FOR INSERT
WITH CHECK (
    is_connected() AND
    user_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM memories m
        WHERE m.id = memory_id
        AND is_my_couple(m.user_a_id, m.user_b_id)
        AND m.is_deleted = FALSE
    )
);

CREATE POLICY "Users can update own comments"
ON memory_comments FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Couples can delete comments"
ON memory_comments FOR DELETE
USING (
    is_connected() AND
    EXISTS (
        SELECT 1 FROM memories m
        WHERE m.id = memory_id
        AND is_my_couple(m.user_a_id, m.user_b_id)
    )
);

-- badges
CREATE POLICY "Badges are readable"
ON badges FOR SELECT
USING (auth.role() = 'authenticated');

-- couple_badges
CREATE POLICY "Connected couples can view badges"
ON couple_badges FOR SELECT
USING (
    is_connected() AND
    is_my_couple(user_a_id, user_b_id)
);

-- insights
CREATE POLICY "Consented couples can view insights"
ON insights FOR SELECT
USING (
    is_connected() AND
    is_my_couple(user_a_id, user_b_id) AND
    EXISTS (
        SELECT 1 FROM profiles p1, profiles p2
        WHERE p1.id = auth.uid()
        AND p2.id = get_my_partner_id()
        AND p1.ai_insights_consent = TRUE
        AND p2.ai_insights_consent = TRUE
        AND (p1.ai_insights_paused_until IS NULL OR p1.ai_insights_paused_until < NOW())
        AND (p2.ai_insights_paused_until IS NULL OR p2.ai_insights_paused_until < NOW())
    )
);

-- relationship_stats (server-only; no SELECT policy)

-- ============================================
-- End migration
-- ============================================
