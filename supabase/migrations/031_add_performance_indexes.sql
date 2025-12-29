-- ============================================
-- MIGRATION: Add performance indexes for hot paths
-- ============================================
-- Adds composite/partial indexes to support high-frequency queries
-- in RPC functions and common list views.

-- couple_question_assignments: backlog + today lookups
CREATE INDEX IF NOT EXISTS idx_cqa_couple_assigned_date
    ON couple_question_assignments(user_a_id, user_b_id, assigned_date);

CREATE INDEX IF NOT EXISTS idx_cqa_pending_by_couple_date
    ON couple_question_assignments(user_a_id, user_b_id, assigned_date)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_cqa_couple_question_active
    ON couple_question_assignments(user_a_id, user_b_id, question_id)
    WHERE status IN ('completed', 'active', 'pending');

-- partner_requests: pending lists ordered by newest first
CREATE INDEX IF NOT EXISTS idx_partner_requests_receiver_pending_created_at
    ON partner_requests(receiver_id, created_at DESC)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_partner_requests_sender_pending_created_at
    ON partner_requests(sender_id, created_at DESC)
    WHERE status = 'pending';

-- usage_tracking: couple-period lookups
CREATE INDEX IF NOT EXISTS idx_usage_tracking_couple_period
    ON usage_tracking(couple_id, period_start);

-- user_memories: recent/important memory context
CREATE INDEX IF NOT EXISTS idx_user_memories_active_rank
    ON user_memories(user_id, reinforcement_count DESC, confidence_score DESC)
    WHERE is_active = TRUE;

-- memory_comments: per-memory timelines
CREATE INDEX IF NOT EXISTS idx_memory_comments_memory_created_at
    ON memory_comments(memory_id, created_at DESC);

-- couple_challenges: active challenge lists per couple
CREATE INDEX IF NOT EXISTS idx_couple_challenges_couple_status_started_at
    ON couple_challenges(user_a_id, user_b_id, status, started_at DESC);
