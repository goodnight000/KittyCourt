-- ============================================
-- MEMORY JOBS QUEUE FOUNDATION
-- ============================================

CREATE TABLE IF NOT EXISTS memory_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead_letter')),
    payload JSONB NOT NULL DEFAULT '{}'::JSONB,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    source TEXT,
    source_type TEXT,
    source_id TEXT,
    couple_id UUID,
    retry_at TIMESTAMPTZ,
    claimed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memory_jobs_status_retry_created
    ON memory_jobs(status, retry_at, created_at);

CREATE INDEX IF NOT EXISTS idx_memory_jobs_type_status_created
    ON memory_jobs(job_type, status, created_at);

ALTER TABLE memory_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage memory jobs" ON memory_jobs;
CREATE POLICY "Service role can manage memory jobs" ON memory_jobs
    FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS update_memory_jobs_updated_at ON memory_jobs;
CREATE TRIGGER update_memory_jobs_updated_at
    BEFORE UPDATE ON memory_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
