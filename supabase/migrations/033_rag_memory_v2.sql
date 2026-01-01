-- ============================================
-- MIGRATION: RAG Memory v2 Enhancements
-- ============================================
-- Adds recency/salience metadata and a v2 retrieval RPC
-- with composite scoring (similarity + recency + confidence + reinforcement).
-- ============================================

-- Add v2 metadata columns (safe, idempotent)
ALTER TABLE user_memories
ADD COLUMN IF NOT EXISTS memory_subtype TEXT;

ALTER TABLE user_memories
ADD COLUMN IF NOT EXISTS observed_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE user_memories
ADD COLUMN IF NOT EXISTS last_observed_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE user_memories
ADD COLUMN IF NOT EXISTS salience_score DOUBLE PRECISION;

ALTER TABLE user_memories
ADD COLUMN IF NOT EXISTS deactivated_reason TEXT;

-- Backfill legacy fields into canonical columns when missing
UPDATE user_memories
SET memory_text = COALESCE(memory_text, content)
WHERE memory_text IS NULL
  AND content IS NOT NULL;

UPDATE user_memories
SET memory_type = COALESCE(memory_type, category)
WHERE memory_type IS NULL
  AND category IS NOT NULL;

UPDATE user_memories
SET observed_at = COALESCE(observed_at, created_at),
    last_observed_at = COALESCE(last_observed_at, last_reinforced_at, created_at)
WHERE observed_at IS NULL
   OR last_observed_at IS NULL;

-- Indexes to support v2 retrieval and source checks
CREATE INDEX IF NOT EXISTS idx_user_memories_source
    ON user_memories(source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_user_memories_last_observed
    ON user_memories(user_id, last_observed_at DESC)
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_user_memories_type_active
    ON user_memories(user_id, memory_type)
    WHERE is_active = TRUE;

-- ============================================
-- V2 Retrieval RPC (two-stage: vector prefilter + composite scoring)
-- ============================================
DROP FUNCTION IF EXISTS retrieve_relevant_memories_v2(vector(1536), UUID[], INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION retrieve_relevant_memories_v2(
    query_embedding vector(1536),
    user_ids UUID[],
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
            (1 - (um.embedding <=> query_embedding))::DOUBLE PRECISION as similarity,
            EXTRACT(EPOCH FROM (NOW() - COALESCE(um.last_observed_at, um.created_at))) / 86400.0 as age_days
        FROM user_memories um
        WHERE um.user_id = ANY(user_ids)
          AND um.embedding IS NOT NULL
          AND um.is_active = TRUE
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

REVOKE ALL ON FUNCTION retrieve_relevant_memories_v2(vector(1536), UUID[], INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION retrieve_relevant_memories_v2(vector(1536), UUID[], INTEGER, INTEGER) TO service_role;

-- ============================================
-- DONE
-- ============================================
