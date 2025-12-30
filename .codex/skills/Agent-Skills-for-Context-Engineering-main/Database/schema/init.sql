-- Semantic Knowledge Registry Schema
-- PostgreSQL 16 + pgvector

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Skills table: Main registry of agent skills
CREATE TABLE IF NOT EXISTS skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    content TEXT NOT NULL,
    path VARCHAR(512) NOT NULL,
    version VARCHAR(50) DEFAULT '1.0.0',
    author VARCHAR(255),
    embedding vector(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Documents table: Source documents used to build skills
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(512) NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    path VARCHAR(512) NOT NULL UNIQUE,
    content_hash VARCHAR(64) NOT NULL,
    doc_type VARCHAR(50) DEFAULT 'reference',  -- 'research', 'blog', 'reference', 'case_study'
    source_url VARCHAR(512) DEFAULT 'No',
    embedding vector(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Skill sources: Links skills to their source documents
CREATE TABLE IF NOT EXISTS skill_sources (
    skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    relevance FLOAT DEFAULT 1.0 CHECK (relevance >= 0 AND relevance <= 1),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (skill_id, document_id)
);

-- Skill versions: Version history for skills
CREATE TABLE IF NOT EXISTS skill_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
    version VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    change_summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Skill references: Internal references within skills (to other skills, external resources)
CREATE TABLE IF NOT EXISTS skill_references (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
    ref_type VARCHAR(50) NOT NULL,  -- 'internal_skill', 'external_url', 'file_reference'
    ref_target VARCHAR(512) NOT NULL,
    ref_description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for semantic search
CREATE INDEX IF NOT EXISTS idx_skills_embedding ON skills 
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_documents_embedding ON documents 
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_skills_name ON skills(name);
CREATE INDEX IF NOT EXISTS idx_skills_updated ON skills(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_path ON documents(path);
CREATE INDEX IF NOT EXISTS idx_documents_hash ON documents(content_hash);
CREATE INDEX IF NOT EXISTS idx_skill_versions_skill ON skill_versions(skill_id, created_at DESC);

-- Function: Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS skills_updated_at ON skills;
CREATE TRIGGER skills_updated_at
    BEFORE UPDATE ON skills
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS documents_updated_at ON documents;
CREATE TRIGGER documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function: Semantic search for skills
CREATE OR REPLACE FUNCTION search_skills(
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    name VARCHAR(255),
    description TEXT,
    path VARCHAR(512),
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.name,
        s.description,
        s.path,
        1 - (s.embedding <=> query_embedding) AS similarity
    FROM skills s
    WHERE s.embedding IS NOT NULL
      AND 1 - (s.embedding <=> query_embedding) > match_threshold
    ORDER BY s.embedding <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Function: Semantic search for documents
CREATE OR REPLACE FUNCTION search_documents(
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    title VARCHAR(512),
    path VARCHAR(512),
    doc_type VARCHAR(50),
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.title,
        d.path,
        d.doc_type,
        1 - (d.embedding <=> query_embedding) AS similarity
    FROM documents d
    WHERE d.embedding IS NOT NULL
      AND 1 - (d.embedding <=> query_embedding) > match_threshold
    ORDER BY d.embedding <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Function: Find related skills for a document
CREATE OR REPLACE FUNCTION find_related_skills(
    doc_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
    skill_id UUID,
    skill_name VARCHAR(255),
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.name,
        1 - (s.embedding <=> doc_embedding) AS similarity
    FROM skills s
    WHERE s.embedding IS NOT NULL
      AND 1 - (s.embedding <=> doc_embedding) > match_threshold
    ORDER BY s.embedding <=> doc_embedding;
END;
$$ LANGUAGE plpgsql;

-- View: Skills with source count
CREATE OR REPLACE VIEW skills_with_sources AS
SELECT 
    s.id,
    s.name,
    s.description,
    s.version,
    s.path,
    s.updated_at,
    COUNT(ss.document_id) AS source_count
FROM skills s
LEFT JOIN skill_sources ss ON s.id = ss.skill_id
GROUP BY s.id;

-- View: Documents with skill count
CREATE OR REPLACE VIEW documents_with_skills AS
SELECT 
    d.id,
    d.title,
    d.path,
    d.doc_type,
    d.updated_at,
    COUNT(ss.skill_id) AS skill_count
FROM documents d
LEFT JOIN skill_sources ss ON d.id = ss.document_id
GROUP BY d.id;

