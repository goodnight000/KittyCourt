-- ============================================
-- MIGRATION: Add Event Reminders to Notification System
-- ============================================
-- Adds event_reminders preference column to notification_preferences
-- and updates the should_send_notification function to handle it.
-- ============================================

-- ============================================
-- ADD EVENT_REMINDERS COLUMN
-- ============================================
-- Allows users to control notifications for calendar event reminders
-- (e.g., anniversary reminders, scheduled check-ins, etc.)
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'notification_preferences'
        AND column_name = 'event_reminders'
    ) THEN
        ALTER TABLE notification_preferences
        ADD COLUMN event_reminders BOOLEAN DEFAULT TRUE;
    END IF;
END $$;

COMMENT ON COLUMN notification_preferences.event_reminders IS 'Controls notifications for calendar event reminders (anniversaries, scheduled check-ins, etc.)';

-- ============================================
-- UPDATE SHOULD_SEND_NOTIFICATION FUNCTION
-- ============================================
-- Adds handling for the new 'event_reminders' notification type.
-- ============================================

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
    ELSIF notification_type = 'event_reminders' AND prefs.event_reminders = FALSE THEN
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

COMMENT ON FUNCTION should_send_notification IS 'Checks if a notification should be sent to a user based on their preferences and quiet hours settings. Supports: court_sessions, verdicts, appreciations, daily_questions, partner_activity, reminders, event_reminders.';

-- ============================================
-- DONE!
-- ============================================
-- Changes:
--   - Added event_reminders column to notification_preferences (BOOLEAN DEFAULT TRUE)
--   - Updated should_send_notification function to handle 'event_reminders' type
-- ============================================
