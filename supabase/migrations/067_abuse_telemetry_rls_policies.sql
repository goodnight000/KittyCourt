-- Add explicit service_role policies on abuse telemetry tables
-- Defense-in-depth: explicitly grant service_role access
-- (service_role bypasses RLS by default, but explicit policies document intent
--  and protect against future Supabase policy changes)

CREATE POLICY "Service role can manage usage events"
    ON ai_usage_events
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role can manage abuse actions"
    ON abuse_actions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
