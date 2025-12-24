-- ============================================
-- MIGRATION: Fix Memory Function Overloading
-- ============================================
-- Problem: There are duplicate versions of search_similar_memories
-- and retrieve_relevant_memories with conflicting parameter types
-- (TEXT vs UUID), causing PostgREST error PGRST203.
--
-- Solution: Drop ALL versions and recreate with explicit UUID types.
-- ============================================

-- Drop ALL existing function overloads
DROP FUNCTION IF EXISTS search_similar_memories(vector, text, float, int);
DROP FUNCTION IF EXISTS search_similar_memories(vector, uuid, float, int);
DROP FUNCTION IF EXISTS search_similar_memories(vector(1536), text, float, int);
DROP FUNCTION IF EXISTS search_similar_memories(vector(1536), uuid, float, int);
DROP FUNCTION IF EXISTS search_similar_memories(vector(1536), text, double precision, int);
DROP FUNCTION IF EXISTS search_similar_memories(vector(1536), uuid, double precision, int);

DROP FUNCTION IF EXISTS retrieve_relevant_memories(vector, uuid[], int);
DROP FUNCTION IF EXISTS retrieve_relevant_memories(vector(1536), uuid[], int);
DROP FUNCTION IF EXISTS retrieve_relevant_memories(vector, text[], int);
DROP FUNCTION IF EXISTS retrieve_relevant_memories(vector(1536), text[], int);

-- ============================================
-- Recreate search_similar_memories (single version)
-- ============================================
CREATE OR REPLACE FUNCTION search_similar_memories(
    query_embedding vector(1536),
    target_user_id UUID,
    similarity_threshold DOUBLE PRECISION DEFAULT 0.92,
    max_results INTEGER DEFAULT 10
)
RETURNS TABLE(
    id UUID,
    memory_text TEXT,
    memory_type TEXT,
    similarity DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        um.id,
        um.memory_text,
        um.memory_type,
        (1 - (um.embedding <=> query_embedding))::DOUBLE PRECISION as similarity
    FROM user_memories um
    WHERE um.user_id = target_user_id
      AND um.embedding IS NOT NULL
      AND um.is_active = TRUE
      AND (1 - (um.embedding <=> query_embedding)) >= similarity_threshold
    ORDER BY um.embedding <=> query_embedding
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Recreate retrieve_relevant_memories (single version)
-- ============================================
CREATE OR REPLACE FUNCTION retrieve_relevant_memories(
    query_embedding vector(1536),
    user_ids UUID[],
    max_results INTEGER DEFAULT 4
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    memory_text TEXT,
    memory_type TEXT,
    confidence_score DOUBLE PRECISION,
    reinforcement_count INTEGER,
    similarity DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        um.id,
        um.user_id,
        um.memory_text,
        um.memory_type,
        um.confidence_score::DOUBLE PRECISION,
        um.reinforcement_count,
        (1 - (um.embedding <=> query_embedding))::DOUBLE PRECISION as similarity
    FROM user_memories um
    WHERE um.user_id = ANY(user_ids)
      AND um.embedding IS NOT NULL
      AND um.is_active = TRUE
    ORDER BY um.embedding <=> query_embedding
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

REVOKE ALL ON FUNCTION search_similar_memories(vector(1536), UUID, DOUBLE PRECISION, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION search_similar_memories(vector(1536), UUID, DOUBLE PRECISION, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION retrieve_relevant_memories(vector(1536), UUID[], INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION retrieve_relevant_memories(vector(1536), UUID[], INTEGER) TO service_role;

-- ============================================
-- DONE!
-- ============================================
-- After running this migration:
-- 1. Only ONE version of each function exists
-- 2. All parameters have explicit types (UUID, not TEXT)
-- 3. PostgREST can resolve the function call correctly
-- ============================================
