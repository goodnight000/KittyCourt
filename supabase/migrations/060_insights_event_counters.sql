-- Insight event counters for AI insights scheduling

CREATE TABLE IF NOT EXISTS insight_event_counters (
    user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    score NUMERIC(6,2) DEFAULT 0,
    last_event_at TIMESTAMPTZ,
    last_run_at TIMESTAMPTZ,
    last_run_date TEXT,
    last_insight_generated_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS insight_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    event_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    weight NUMERIC(6,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, event_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_insight_events_user_date
    ON insight_events(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_insight_event_counters_updated
    ON insight_event_counters(updated_at);

ALTER TABLE insight_event_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE insight_events ENABLE ROW LEVEL SECURITY;
