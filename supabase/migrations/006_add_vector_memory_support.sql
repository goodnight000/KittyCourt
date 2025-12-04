-- ============================================
-- MIGRATION: Add Vector Support for User Memories
-- ============================================
-- This migration adds:
-- 1. pgvector extension for embedding storage
-- 2. embedding column to user_memories
-- 3. RPC functions for similarity search
-- 4. Additional columns for memory system
-- ============================================

-- Enable pgvector extension (must be done by superuser/owner)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- STEP 1: Update user_memories table
-- ============================================

-- Add memory-specific columns
ALTER TABLE user_memories 
ADD COLUMN IF NOT EXISTS memory_text TEXT;

ALTER TABLE user_memories 
ADD COLUMN IF NOT EXISTS memory_type TEXT; -- 'trigger', 'core_value', 'pattern'

ALTER TABLE user_memories 
ADD COLUMN IF NOT EXISTS embedding vector(1536); -- OpenAI embedding dimension

ALTER TABLE user_memories 
ADD COLUMN IF NOT EXISTS source_case_id UUID REFERENCES cases(id);

ALTER TABLE user_memories 
ADD COLUMN IF NOT EXISTS confidence_score FLOAT DEFAULT 0.8;

ALTER TABLE user_memories 
ADD COLUMN IF NOT EXISTS reinforcement_count INT DEFAULT 1;

ALTER TABLE user_memories 
ADD COLUMN IF NOT EXISTS last_reinforced_at TIMESTAMPTZ;

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_user_memories_embedding 
ON user_memories USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- ============================================
-- STEP 2: RPC Functions for Memory System
-- ============================================

-- Function to search similar memories (for de-duplication)
CREATE OR REPLACE FUNCTION search_similar_memories(
    query_embedding vector(1536),
    target_user_id UUID,
    similarity_threshold FLOAT DEFAULT 0.92,
    max_results INT DEFAULT 10
)
RETURNS TABLE(
    id UUID,
    memory_text TEXT,
    memory_type TEXT,
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        um.id,
        um.memory_text,
        um.memory_type,
        1 - (um.embedding <=> query_embedding) as similarity
    FROM user_memories um
    WHERE um.user_id = target_user_id
      AND um.embedding IS NOT NULL
      AND um.is_active = TRUE
      AND 1 - (um.embedding <=> query_embedding) >= similarity_threshold
    ORDER BY um.embedding <=> query_embedding
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Function to retrieve relevant memories for RAG
CREATE OR REPLACE FUNCTION retrieve_relevant_memories(
    query_embedding vector(1536),
    user_ids UUID[],
    max_results INT DEFAULT 4
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    memory_text TEXT,
    memory_type TEXT,
    confidence_score FLOAT,
    reinforcement_count INT,
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        um.id,
        um.user_id,
        um.memory_text,
        um.memory_type,
        um.confidence_score,
        um.reinforcement_count,
        1 - (um.embedding <=> query_embedding) as similarity
    FROM user_memories um
    WHERE um.user_id = ANY(user_ids)
      AND um.embedding IS NOT NULL
      AND um.is_active = TRUE
    ORDER BY um.embedding <=> query_embedding
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Function to get recent memories for a user
CREATE OR REPLACE FUNCTION get_user_memory_context(
    target_user_id UUID,
    max_memories INT DEFAULT 10
)
RETURNS TABLE(
    memory_text TEXT,
    memory_type TEXT,
    confidence_score FLOAT,
    times_observed INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        um.memory_text,
        um.memory_type,
        um.confidence_score,
        um.reinforcement_count as times_observed
    FROM user_memories um
    WHERE um.user_id = target_user_id
      AND um.is_active = TRUE
    ORDER BY um.reinforcement_count DESC, um.confidence_score DESC
    LIMIT max_memories;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 3: Update RLS policies for memory system
-- ============================================

-- Allow service role to manage memories (needed for AI extraction)
DROP POLICY IF EXISTS "Service can insert memories" ON user_memories;
DROP POLICY IF EXISTS "Service can update memories" ON user_memories;

CREATE POLICY "Anyone can insert memories" ON user_memories
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update memories" ON user_memories
    FOR UPDATE USING (true);

-- ============================================
-- DONE! 🎉
-- ============================================
