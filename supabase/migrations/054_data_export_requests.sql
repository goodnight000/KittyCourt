-- ============================================
-- MIGRATION: Data export requests
-- ============================================
-- Tracks user-initiated data export jobs and delivery status.

CREATE TABLE IF NOT EXISTS data_export_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    requested_email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'ready', 'failed')),
    email_status TEXT NOT NULL DEFAULT 'pending' CHECK (email_status IN ('pending', 'stubbed', 'sent', 'failed')),
    file_bucket TEXT,
    file_path TEXT,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    emailed_at TIMESTAMPTZ,
    summary JSONB DEFAULT '{}'::jsonb,
    error TEXT
);

CREATE INDEX IF NOT EXISTS idx_data_export_requests_user
    ON data_export_requests(user_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_export_requests_status
    ON data_export_requests(status);

ALTER TABLE data_export_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own export requests"
    ON data_export_requests
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own export requests"
    ON data_export_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);
