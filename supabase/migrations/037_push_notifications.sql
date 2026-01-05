-- ============================================
-- MIGRATION: Push Notifications System
-- ============================================
-- Adds device token management, notification preferences,
-- and notification logging for push notification delivery.
-- ============================================

-- ============================================
-- DEVICE TOKENS TABLE
-- ============================================
-- Stores device tokens for push notification delivery.
-- Supports iOS, Android, and web push notifications.
-- Tracks device metadata for debugging and analytics.
-- ============================================
CREATE TABLE IF NOT EXISTS device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,

    -- Token and platform
    token TEXT NOT NULL UNIQUE,
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),

    -- Device metadata (optional, for debugging)
    device_model TEXT,
    os_version TEXT,
    app_version TEXT,

    -- Token lifecycle
    active BOOLEAN DEFAULT TRUE,
    deactivated_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for device_tokens
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_token ON device_tokens(token);
CREATE INDEX IF NOT EXISTS idx_device_tokens_active ON device_tokens(user_id, active) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_device_tokens_platform ON device_tokens(platform);

-- Apply updated_at trigger
DROP TRIGGER IF EXISTS update_device_tokens_updated_at ON device_tokens;
CREATE TRIGGER update_device_tokens_updated_at
    BEFORE UPDATE ON device_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- NOTIFICATION PREFERENCES TABLE
-- ============================================
-- User-specific notification preferences.
-- Controls which notification types are enabled and quiet hours.
-- One row per user (created automatically on profile creation).
-- ============================================
CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,

    -- Global notification toggle
    notifications_enabled BOOLEAN DEFAULT TRUE,

    -- Feature-specific toggles
    court_sessions BOOLEAN DEFAULT TRUE,
    verdicts BOOLEAN DEFAULT TRUE,
    appreciations BOOLEAN DEFAULT TRUE,
    daily_questions BOOLEAN DEFAULT TRUE,
    partner_activity BOOLEAN DEFAULT TRUE,
    reminders BOOLEAN DEFAULT TRUE,

    -- Quiet hours
    quiet_hours_enabled BOOLEAN DEFAULT FALSE,
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    timezone TEXT DEFAULT 'America/New_York',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for notification_preferences
CREATE INDEX IF NOT EXISTS idx_notification_preferences_enabled ON notification_preferences(notifications_enabled);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_quiet_hours ON notification_preferences(quiet_hours_enabled) WHERE quiet_hours_enabled = TRUE;

-- Apply updated_at trigger
DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON notification_preferences;
CREATE TRIGGER update_notification_preferences_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- NOTIFICATION LOG TABLE
-- ============================================
-- Logs all notification attempts for analytics and debugging.
-- Tracks delivery status, errors, and user interactions.
-- ============================================
CREATE TABLE IF NOT EXISTS notification_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,

    -- Notification details
    type TEXT NOT NULL, -- 'court_session', 'verdict', 'appreciation', 'daily_question', 'partner_activity', 'reminder'
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB, -- Additional payload data

    -- Delivery tracking
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    delivered_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    error TEXT,

    -- Device tracking
    device_token_id UUID REFERENCES device_tokens(id) ON DELETE SET NULL
);

-- Indexes for notification_log
CREATE INDEX IF NOT EXISTS idx_notification_log_user_id ON notification_log(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_type ON notification_log(type);
CREATE INDEX IF NOT EXISTS idx_notification_log_sent_at ON notification_log(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_log_user_type ON notification_log(user_id, type);
CREATE INDEX IF NOT EXISTS idx_notification_log_device_token ON notification_log(device_token_id);

-- Partial index for failed notifications (useful for debugging)
CREATE INDEX IF NOT EXISTS idx_notification_log_errors ON notification_log(user_id, sent_at DESC) WHERE error IS NOT NULL;

-- Partial index for undelivered notifications
CREATE INDEX IF NOT EXISTS idx_notification_log_undelivered ON notification_log(sent_at DESC) WHERE delivered_at IS NULL AND error IS NULL;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

-- ============================================
-- DEVICE TOKENS POLICIES
-- ============================================

-- Users can view their own device tokens
CREATE POLICY "Users can view own device tokens" ON device_tokens
    FOR SELECT USING (user_id = auth.uid());

-- Users can insert their own device tokens
CREATE POLICY "Users can insert own device tokens" ON device_tokens
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own device tokens
CREATE POLICY "Users can update own device tokens" ON device_tokens
    FOR UPDATE USING (user_id = auth.uid());

-- Users can delete their own device tokens
CREATE POLICY "Users can delete own device tokens" ON device_tokens
    FOR DELETE USING (user_id = auth.uid());

-- Service role can manage all device tokens (for cleanup and admin tasks)
CREATE POLICY "Service can manage device tokens" ON device_tokens
    FOR ALL USING (true);

-- ============================================
-- NOTIFICATION PREFERENCES POLICIES
-- ============================================

-- Users can view their own preferences
CREATE POLICY "Users can view own preferences" ON notification_preferences
    FOR SELECT USING (user_id = auth.uid());

-- Users can insert their own preferences
CREATE POLICY "Users can insert own preferences" ON notification_preferences
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own preferences
CREATE POLICY "Users can update own preferences" ON notification_preferences
    FOR UPDATE USING (user_id = auth.uid());

-- Service role can manage all preferences
CREATE POLICY "Service can manage preferences" ON notification_preferences
    FOR ALL USING (true);

-- ============================================
-- NOTIFICATION LOG POLICIES
-- ============================================

-- Users can view their own notification logs
CREATE POLICY "Users can view own notification logs" ON notification_log
    FOR SELECT USING (user_id = auth.uid());

-- Service role can insert notification logs
CREATE POLICY "Service can insert notification logs" ON notification_log
    FOR INSERT WITH CHECK (true);

-- Service role can update notification logs (for delivery tracking)
CREATE POLICY "Service can update notification logs" ON notification_log
    FOR UPDATE USING (true);

-- Service role can view all logs (for analytics)
CREATE POLICY "Service can view all logs" ON notification_log
    FOR SELECT USING (true);

-- ============================================
-- AUTO-CREATE NOTIFICATION PREFERENCES
-- ============================================
-- Trigger to automatically create default notification preferences
-- when a new profile is created.
-- ============================================

CREATE OR REPLACE FUNCTION create_default_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notification_preferences (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS create_notification_preferences_on_profile_insert ON profiles;
CREATE TRIGGER create_notification_preferences_on_profile_insert
    AFTER INSERT ON profiles
    FOR EACH ROW EXECUTE FUNCTION create_default_notification_preferences();

-- Backfill notification preferences for existing users
INSERT INTO notification_preferences (user_id)
SELECT id FROM profiles
ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- UTILITY FUNCTIONS
-- ============================================

-- Function to check if notifications should be sent to a user
-- Takes into account quiet hours and global preferences
CREATE OR REPLACE FUNCTION should_send_notification(
    target_user_id UUID,
    notification_type TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    prefs notification_preferences;
    current_time_in_tz TIME;
    is_quiet_hours BOOLEAN;
BEGIN
    -- Get user preferences
    SELECT * INTO prefs
    FROM notification_preferences
    WHERE user_id = target_user_id;

    -- If no preferences found or notifications disabled globally, return false
    IF prefs IS NULL OR prefs.notifications_enabled = FALSE THEN
        RETURN FALSE;
    END IF;

    -- Check if specific notification type is disabled
    IF notification_type = 'court_sessions' AND prefs.court_sessions = FALSE THEN
        RETURN FALSE;
    ELSIF notification_type = 'verdicts' AND prefs.verdicts = FALSE THEN
        RETURN FALSE;
    ELSIF notification_type = 'appreciations' AND prefs.appreciations = FALSE THEN
        RETURN FALSE;
    ELSIF notification_type = 'daily_questions' AND prefs.daily_questions = FALSE THEN
        RETURN FALSE;
    ELSIF notification_type = 'partner_activity' AND prefs.partner_activity = FALSE THEN
        RETURN FALSE;
    ELSIF notification_type = 'reminders' AND prefs.reminders = FALSE THEN
        RETURN FALSE;
    END IF;

    -- Check quiet hours if enabled
    IF prefs.quiet_hours_enabled = TRUE AND prefs.quiet_hours_start IS NOT NULL AND prefs.quiet_hours_end IS NOT NULL THEN
        current_time_in_tz := (NOW() AT TIME ZONE COALESCE(prefs.timezone, 'America/New_York'))::TIME;

        -- Handle quiet hours that cross midnight
        IF prefs.quiet_hours_start <= prefs.quiet_hours_end THEN
            -- Normal range (e.g., 22:00 to 07:00)
            is_quiet_hours := current_time_in_tz >= prefs.quiet_hours_start AND current_time_in_tz <= prefs.quiet_hours_end;
        ELSE
            -- Range crosses midnight (e.g., 22:00 to 07:00)
            is_quiet_hours := current_time_in_tz >= prefs.quiet_hours_start OR current_time_in_tz <= prefs.quiet_hours_end;
        END IF;

        IF is_quiet_hours THEN
            RETURN FALSE;
        END IF;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role
REVOKE ALL ON FUNCTION should_send_notification(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION should_send_notification(UUID, TEXT) TO service_role;

COMMENT ON FUNCTION should_send_notification IS 'Checks if a notification should be sent to a user based on their preferences and quiet hours settings.';

-- ============================================
-- DONE!
-- ============================================
-- New tables:
--   • device_tokens (device registration for push notifications)
--   • notification_preferences (user notification settings)
--   • notification_log (notification delivery tracking)
--
-- New function:
--   • should_send_notification(user_id, type) - Check if notification should be sent
--
-- New trigger:
--   • Auto-creates notification_preferences on profile creation
-- ============================================
