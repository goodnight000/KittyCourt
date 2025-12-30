-- ============================================
-- Challenge cadence + assignments
-- ============================================

ALTER TABLE challenges
    ADD COLUMN IF NOT EXISTS cadence TEXT DEFAULT 'weekly'
    CHECK (cadence IN ('daily', 'weekly'));

UPDATE challenges
SET cadence = 'weekly'
WHERE cadence IS NULL;

CREATE TABLE IF NOT EXISTS challenge_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_a_id UUID NOT NULL,
    user_b_id UUID NOT NULL,
    challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE NOT NULL,
    cadence TEXT NOT NULL CHECK (cadence IN ('daily', 'weekly')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (user_a_id < user_b_id),
    UNIQUE (user_a_id, user_b_id, cadence, period_start, challenge_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_assignments_couple_period
    ON challenge_assignments(user_a_id, user_b_id, cadence, period_start);

CREATE INDEX IF NOT EXISTS idx_challenge_assignments_cadence_period
    ON challenge_assignments(cadence, period_start);

CREATE INDEX IF NOT EXISTS idx_challenges_cadence_active
    ON challenges(cadence, is_active);

ALTER TABLE challenge_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Couples can view challenge assignments"
ON challenge_assignments FOR SELECT
USING (is_my_couple(user_a_id, user_b_id));
