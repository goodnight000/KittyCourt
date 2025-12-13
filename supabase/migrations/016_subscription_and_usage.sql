-- ============================================
-- SUBSCRIPTION & USAGE TRACKING
-- ============================================
-- Adds subscription tier columns to profiles and
-- creates usage tracking table for feature limits.
-- ============================================

-- Add subscription columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS store_customer_id TEXT;

-- Create index for subscription queries
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier ON profiles(subscription_tier);

-- ============================================
-- USAGE TRACKING TABLE
-- ============================================
-- Tracks monthly usage for rate-limited features.
-- Each user gets one row per billing period.
-- ============================================
CREATE TABLE IF NOT EXISTS usage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    period_start DATE NOT NULL,  -- First day of the usage period (month)
    lightning_count INT DEFAULT 0,
    mittens_count INT DEFAULT 0,
    whiskers_count INT DEFAULT 0,
    plan_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, period_start)
);

-- Indexes for usage tracking
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_id ON usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_period ON usage_tracking(period_start);

-- Apply updated_at trigger (drop first to avoid duplicate)
DROP TRIGGER IF EXISTS update_usage_tracking_updated_at ON usage_tracking;
CREATE TRIGGER update_usage_tracking_updated_at
    BEFORE UPDATE ON usage_tracking
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY FOR USAGE TRACKING
-- ============================================
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

-- Users can view their own usage
CREATE POLICY "Users can view own usage" ON usage_tracking
    FOR SELECT USING (user_id = auth.uid());

-- Users can insert their own usage (first-time creation)
CREATE POLICY "Users can insert own usage" ON usage_tracking
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own usage
CREATE POLICY "Users can update own usage" ON usage_tracking
    FOR UPDATE USING (user_id = auth.uid());

-- Service role can manage all usage (for webhooks)
CREATE POLICY "Service can manage usage" ON usage_tracking
    FOR ALL USING (true);

-- ============================================
-- DONE! 
-- ============================================
-- New columns in profiles:
--   • subscription_tier ('free' or 'pause_gold')
--   • subscription_expires_at (for Gold users)
--   • store_customer_id (RevenueCat ID)
--
-- New table:
--   • usage_tracking (monthly feature usage)
-- ============================================
