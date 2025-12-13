-- ============================================
-- MIGRATION: Event plans persistence + secret events
-- ============================================

-- --- Calendar: secret events ---
ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS is_secret BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_calendar_events_secret ON calendar_events(is_secret);

-- Update calendar_events RLS policies to respect secret events
-- NOTE: Service-role clients bypass RLS; API still enforces access checks.
DROP POLICY IF EXISTS "Users can view couple events" ON calendar_events;
DROP POLICY IF EXISTS "Users can insert couple events" ON calendar_events;
DROP POLICY IF EXISTS "Users can update couple events" ON calendar_events;
DROP POLICY IF EXISTS "Users can delete couple events" ON calendar_events;

-- Viewer can see:
-- - their own events (including secret)
-- - partner events only if not secret
CREATE POLICY "Users can view couple events" ON calendar_events
    FOR SELECT USING (
        created_by = auth.uid()
        OR (created_by = get_my_partner_id() AND is_secret = FALSE)
    );

-- Creator can insert their own events (including secret)
CREATE POLICY "Users can insert couple events" ON calendar_events
    FOR INSERT WITH CHECK (
        created_by = auth.uid()
    );

-- Updates:
-- - creator can always update their events
-- - partner can update only non-secret events
CREATE POLICY "Users can update couple events" ON calendar_events
    FOR UPDATE USING (
        created_by = auth.uid()
        OR (created_by = get_my_partner_id() AND is_secret = FALSE)
    );

-- Deletes:
-- - creator can always delete their events
-- - partner can delete only non-secret events
CREATE POLICY "Users can delete couple events" ON calendar_events
    FOR DELETE USING (
        created_by = auth.uid()
        OR (created_by = get_my_partner_id() AND is_secret = FALSE)
    );

-- --- Event plans persistence (per user, per event, per style) ---
CREATE TABLE IF NOT EXISTS event_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    partner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

    -- Stable reference for both DB-backed and computed events
    event_key TEXT NOT NULL,

    -- Snapshot of the event at generation time (title/date/type/emoji/notes/isSecret)
    event_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- 'cozy' | 'playful' | 'fancy' | 'low_key'
    style TEXT NOT NULL,

    plan JSONB NOT NULL,

    -- Checklist state keyed by UI item key (e.g. "3-Book dinner")
    checklist_state JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, event_key, style)
);

CREATE INDEX IF NOT EXISTS idx_event_plans_user_event ON event_plans(user_id, event_key);

-- updated_at trigger
DROP TRIGGER IF EXISTS update_event_plans_updated_at ON event_plans;
CREATE TRIGGER update_event_plans_updated_at
    BEFORE UPDATE ON event_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE event_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own event plans" ON event_plans;
DROP POLICY IF EXISTS "Users can insert own event plans" ON event_plans;
DROP POLICY IF EXISTS "Users can update own event plans" ON event_plans;
DROP POLICY IF EXISTS "Users can delete own event plans" ON event_plans;

CREATE POLICY "Users can view own event plans" ON event_plans
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own event plans" ON event_plans
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own event plans" ON event_plans
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own event plans" ON event_plans
    FOR DELETE USING (user_id = auth.uid());

