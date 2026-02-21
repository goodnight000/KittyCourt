-- ============================================
-- OPTIMIZE MEMORY JOB CLAIM/RECLAIM PATHS
-- ============================================

CREATE INDEX IF NOT EXISTS idx_memory_jobs_pending_claim_partial
    ON memory_jobs(created_at, retry_at)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_memory_jobs_failed_retry_claim_partial
    ON memory_jobs(retry_at, created_at)
    WHERE status = 'failed';

CREATE INDEX IF NOT EXISTS idx_memory_jobs_processing_reclaim_partial
    ON memory_jobs(claimed_at, created_at)
    WHERE status = 'processing';
