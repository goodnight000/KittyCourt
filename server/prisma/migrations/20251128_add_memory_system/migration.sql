-- Migration: Add Hybrid Memory Matrix (Profile System & RAG)
-- This migration sets up the infrastructure for long-term memory in Cat Judge

-- Enable the pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Add profile_data JSONB column to users table for static profile storage
-- This stores slowly changing facts like attachment styles, love languages, etc.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "profile_data" JSONB DEFAULT '{}'::jsonb;

-- Create user_memories table for episodic memory (RAG)
-- Stores distinct behavioral insights as vector embeddings
CREATE TABLE IF NOT EXISTS "user_memories" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "memory_text" TEXT NOT NULL,
    "memory_type" TEXT NOT NULL CHECK ("memory_type" IN ('trigger', 'core_value', 'pattern')),
    "embedding" vector(1536), -- OpenAI text-embedding-3-small dimension
    "source_case_id" TEXT, -- Reference to the case that generated this insight
    "confidence_score" FLOAT DEFAULT 0.8, -- How confident we are in this insight
    "reinforcement_count" INT DEFAULT 1, -- How many times we've seen similar patterns
    "last_reinforced_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_user
        FOREIGN KEY ("user_id") 
        REFERENCES "User"("id")
        ON DELETE CASCADE
);

-- Create HNSW index on the embedding column for fast similarity search
-- HNSW (Hierarchical Navigable Small World) provides excellent query performance
CREATE INDEX IF NOT EXISTS "idx_user_memories_embedding" 
ON "user_memories" 
USING hnsw ("embedding" vector_cosine_ops);

-- Create index on user_id for efficient filtering
CREATE INDEX IF NOT EXISTS "idx_user_memories_user_id" 
ON "user_memories" ("user_id");

-- Create index on memory_type for filtering by category
CREATE INDEX IF NOT EXISTS "idx_user_memories_type" 
ON "user_memories" ("memory_type");

-- Create composite index for user + type queries
CREATE INDEX IF NOT EXISTS "idx_user_memories_user_type" 
ON "user_memories" ("user_id", "memory_type");

-- Add GIN index on profile_data for efficient JSONB queries
CREATE INDEX IF NOT EXISTS "idx_user_profile_data" 
ON "User" USING gin ("profile_data");

-- Create a function for similarity search with threshold
CREATE OR REPLACE FUNCTION search_similar_memories(
    query_embedding vector(1536),
    target_user_id TEXT,
    similarity_threshold FLOAT DEFAULT 0.92,
    max_results INT DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    user_id TEXT,
    memory_text TEXT,
    memory_type TEXT,
    similarity FLOAT,
    reinforcement_count INT
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        um.id,
        um.user_id,
        um.memory_text,
        um.memory_type,
        1 - (um.embedding <=> query_embedding) AS similarity,
        um.reinforcement_count
    FROM user_memories um
    WHERE um.user_id = target_user_id
        AND 1 - (um.embedding <=> query_embedding) > similarity_threshold
    ORDER BY um.embedding <=> query_embedding
    LIMIT max_results;
END;
$$;

-- Create a function for RAG retrieval (top-k similar memories)
CREATE OR REPLACE FUNCTION retrieve_relevant_memories(
    query_embedding vector(1536),
    user_ids TEXT[],
    max_results INT DEFAULT 4
)
RETURNS TABLE (
    id UUID,
    user_id TEXT,
    memory_text TEXT,
    memory_type TEXT,
    similarity FLOAT
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        um.id,
        um.user_id,
        um.memory_text,
        um.memory_type,
        1 - (um.embedding <=> query_embedding) AS similarity
    FROM user_memories um
    WHERE um.user_id = ANY(user_ids)
    ORDER BY um.embedding <=> query_embedding
    LIMIT max_results;
END;
$$;

-- Comment on table for documentation
COMMENT ON TABLE user_memories IS 'Stores episodic memories extracted from case verdicts for RAG-based personalization';
COMMENT ON COLUMN user_memories.memory_type IS 'trigger = emotional trigger, core_value = deeply held value, pattern = recurring behavioral pattern';
COMMENT ON COLUMN user_memories.embedding IS 'OpenAI text-embedding-3-small vector (1536 dimensions)';
COMMENT ON COLUMN user_memories.reinforcement_count IS 'Increases when similar insights are extracted from new cases';
