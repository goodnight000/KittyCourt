-- ============================================
-- KITTY COURT - COMPLETE SUPABASE SCHEMA
-- ============================================
-- This migration sets up the complete database schema for Kitty Court.
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)
--
-- IMPORTANT: This replaces any previous local SQLite/Prisma setup.
-- Supabase handles authentication via auth.users (built-in).
-- We extend it with a profiles table for app-specific data.
-- ============================================

-- ============================================
-- CLEANUP: Drop existing tables if they exist
-- (Safe to run multiple times)
-- ============================================
DROP TABLE IF EXISTS user_memories CASCADE;
DROP TABLE IF EXISTS calendar_events CASCADE;
DROP TABLE IF EXISTS appreciations CASCADE;
DROP TABLE IF EXISTS daily_answers CASCADE;
DROP TABLE IF EXISTS verdicts CASCADE;
DROP TABLE IF EXISTS cases CASCADE;
DROP TABLE IF EXISTS court_sessions CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Drop old functions if they exist
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- ============================================
-- PROFILES TABLE
-- ============================================
-- Extends Supabase's auth.users with app-specific data.
-- Each user gets a unique 12-character partner_code for connecting.
-- ============================================
CREATE TABLE profiles (
    -- Links to Supabase auth.users
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    
    -- Partner Connection
    partner_code TEXT UNIQUE NOT NULL, -- 12-char code for connecting partners
    partner_id UUID REFERENCES profiles(id), -- Connected partner
    partner_connected_at TIMESTAMPTZ,
    
    -- Basic Info
    display_name TEXT,
    birthday DATE,
    avatar_url TEXT,
    
    -- Personality & Preferences (from onboarding)
    love_language TEXT, -- 'words', 'acts', 'gifts', 'time', 'touch'
    communication_style TEXT, -- 'direct', 'processing', 'emotional', 'logical', 'avoidant'
    conflict_style TEXT, -- 'talk', 'space', 'write', 'physical', 'distract'
    favorite_date_activities TEXT[], -- Array of activity IDs
    pet_peeves TEXT[], -- Array of pet peeve IDs  
    appreciation_style TEXT, -- 'public', 'private', 'reciprocate', 'none'
    bio TEXT,
    
    -- Economy
    kibble_balance INT DEFAULT 0,
    
    -- Status
    onboarding_complete BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for profiles
CREATE INDEX idx_profiles_partner_code ON profiles(partner_code);
CREATE INDEX idx_profiles_partner_id ON profiles(partner_id);

-- ============================================
-- USER MEMORIES TABLE (AI-Gathered Insights)
-- ============================================
-- Stores behavioral patterns and insights about each user
-- gathered through cases, daily questions, and interactions.
-- Used by Judge Whiskers for personalized verdicts.
-- ============================================
CREATE TABLE user_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    
    -- Memory categorization
    category TEXT NOT NULL, -- 'communication', 'triggers', 'strengths', 'patterns', 'preferences', 'growth', 'likes', 'dislikes'
    subcategory TEXT, -- More specific (see below for examples)
    
    -- The actual insight/memory
    content TEXT NOT NULL, -- The insight itself
    context TEXT, -- Where this was learned (e.g., "Case #123 about dishes")
    
    -- Confidence and relevance
    confidence FLOAT DEFAULT 0.7, -- 0-1, how confident the AI is about this insight
    times_observed INT DEFAULT 1, -- How many times this pattern was seen
    last_observed_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Source tracking
    source_type TEXT NOT NULL, -- 'case', 'daily_meow', 'appreciation', 'onboarding', 'partner_input', 'calendar'
    source_id UUID, -- Reference to the source (case_id, etc.)
    
    -- For AI context building
    embedding_text TEXT, -- Formatted text for AI context injection
    is_active BOOLEAN DEFAULT TRUE, -- Can be deactivated if outdated
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CATEGORY REFERENCE:
-- ============================================
-- 'communication'  → How they communicate (subcategory: 'style', 'when_upset', 'apology_preference')
-- 'triggers'       → What upsets them (subcategory: 'conflict_triggers', 'pet_peeves', 'stress_triggers')
-- 'strengths'      → Their positive traits (subcategory: 'relationship', 'personal', 'growth_areas')
-- 'patterns'       → Behavioral patterns (subcategory: 'conflict_patterns', 'love_expressions', 'routines')
-- 'preferences'    → General preferences (subcategory: 'quality_time', 'gifts', 'experiences')
-- 'growth'         → Areas of improvement (subcategory: 'working_on', 'improved_at', 'goals')
-- 'likes'          → Things they enjoy (see subcategories below)
-- 'dislikes'       → Things they avoid (see subcategories below)
-- ============================================
-- LIKES/DISLIKES SUBCATEGORIES (for gift & date suggestions):
-- ============================================
-- 'food'           → Favorite cuisines, restaurants, snacks, drinks, dietary restrictions
-- 'activities'     → Hobbies, sports, games, outdoor activities
-- 'entertainment'  → Movies, music, TV shows, books, podcasts, artists
-- 'shopping'       → Brands, stores, product categories, styles
-- 'travel'         → Destinations, travel style, bucket list places
-- 'experiences'    → Spa, concerts, classes, adventures
-- 'gifts'          → Gift preferences, wishlist items, sentimental vs practical
-- 'romance'        → Romantic gestures, date ideas, surprises
-- 'home'           → Home decor, plants, cozy preferences
-- 'self_care'      → Skincare, wellness, relaxation preferences
-- ============================================

-- Indexes for user_memories
CREATE INDEX idx_user_memories_user_id ON user_memories(user_id);
CREATE INDEX idx_user_memories_category ON user_memories(category);
CREATE INDEX idx_user_memories_subcategory ON user_memories(subcategory);
CREATE INDEX idx_user_memories_active ON user_memories(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_user_memories_likes ON user_memories(user_id, category) WHERE category = 'likes';
CREATE INDEX idx_user_memories_dislikes ON user_memories(user_id, category) WHERE category = 'dislikes';

-- ============================================
-- CASES TABLE (Disputes)
-- ============================================
-- Each case is a dispute between two partners.
-- Status flow: DRAFT → LOCKED_A → DELIBERATING → RESOLVED
-- ============================================
CREATE TABLE cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Participants (the couple)
    user_a_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    user_b_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    
    -- Submissions
    user_a_input TEXT,
    user_a_feelings TEXT DEFAULT '',
    user_b_input TEXT,
    user_b_feelings TEXT DEFAULT '',
    
    -- Status: DRAFT, LOCKED_A, DELIBERATING, RESOLVED
    status TEXT DEFAULT 'DRAFT',
    
    -- AI-generated metadata (from verdict)
    case_title TEXT, -- 3-6 word summary
    severity_level TEXT, -- 'high_tension', 'friction', 'disconnection'
    primary_hiss_tag TEXT, -- Main "Horseman" detected
    short_resolution TEXT, -- 5-word summary
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for cases
CREATE INDEX idx_cases_user_a ON cases(user_a_id);
CREATE INDEX idx_cases_user_b ON cases(user_b_id);
CREATE INDEX idx_cases_status ON cases(status);

-- ============================================
-- VERDICTS TABLE
-- ============================================
-- Each case can have multiple verdicts (original + addendums).
-- Content is stored as JSONB for flexible verdict structure.
-- ============================================
CREATE TABLE verdicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
    
    version INT DEFAULT 1, -- 1 = original, 2+ = after addendums
    content JSONB NOT NULL, -- The full verdict JSON from AI
    
    -- Addendum info (if this is a revised verdict)
    addendum_by TEXT, -- 'user_a' or 'user_b'
    addendum_text TEXT, -- The addendum that triggered this
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_verdicts_case_id ON verdicts(case_id);

-- ============================================
-- COURT SESSIONS TABLE
-- ============================================
-- Temporary sessions for the "summoning" animation system.
-- When one partner "serves" the other, a session is created.
-- ============================================
CREATE TABLE court_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    status TEXT DEFAULT 'WAITING', -- 'WAITING', 'IN_SESSION', 'CLOSED'
    created_by UUID REFERENCES profiles(id) NOT NULL,
    
    user_a_joined BOOLEAN DEFAULT FALSE,
    user_b_joined BOOLEAN DEFAULT FALSE,
    
    case_id UUID REFERENCES cases(id), -- Linked case once created
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL -- Session expiration
);

CREATE INDEX idx_court_sessions_status ON court_sessions(status);

-- ============================================
-- TRANSACTIONS TABLE (Kibble Economy)
-- ============================================
-- Tracks all kibble earnings and spending.
-- ============================================
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    
    amount INT NOT NULL,
    type TEXT NOT NULL, -- 'EARN' or 'SPEND'
    description TEXT NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);

-- ============================================
-- APPRECIATIONS TABLE
-- ============================================
-- When one partner appreciates something the other did.
-- Awards kibble and strengthens the relationship.
-- ============================================
CREATE TABLE appreciations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    from_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    to_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    
    message TEXT NOT NULL,
    category TEXT, -- 'kindness', 'support', 'fun', etc.
    kibble_amount INT DEFAULT 10,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_appreciations_from ON appreciations(from_user_id);
CREATE INDEX idx_appreciations_to ON appreciations(to_user_id);

-- ============================================
-- DAILY ANSWERS TABLE (Daily Meow)
-- ============================================
-- Stores answers to the daily relationship question.
-- One answer per user per day.
-- ============================================
CREATE TABLE daily_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    
    question_date DATE NOT NULL,
    question_id INT NOT NULL, -- References the question in the app
    answer TEXT NOT NULL,
    mood TEXT, -- Emoji mood selected
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- One answer per user per day
    UNIQUE(user_id, question_date)
);

CREATE INDEX idx_daily_answers_user ON daily_answers(user_id);
CREATE INDEX idx_daily_answers_date ON daily_answers(question_date);

-- ============================================
-- CALENDAR EVENTS TABLE
-- ============================================
-- Shared calendar events between partners.
-- Supports recurring events (birthdays, anniversaries).
-- ============================================
CREATE TABLE calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    
    title TEXT NOT NULL,
    emoji TEXT DEFAULT '📅',
    event_date DATE NOT NULL,
    event_type TEXT, -- 'anniversary', 'birthday', 'date', 'reminder', etc.
    notes TEXT,
    
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_pattern TEXT, -- 'yearly', 'monthly', etc.
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_calendar_events_date ON calendar_events(event_date);
CREATE INDEX idx_calendar_events_created_by ON calendar_events(created_by);

-- ============================================
-- PARTNER REQUESTS TABLE
-- ============================================
-- Handles partner connection requests between users.
-- When User A enters User B's partner code, a request is created.
-- User B can then accept or reject the request.
-- ============================================
CREATE TABLE partner_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Who is sending and receiving
    sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    
    -- Request status
    status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
    
    -- Optional message from sender
    message TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    
    -- Prevent duplicate active requests
    UNIQUE(sender_id, receiver_id)
);

CREATE INDEX idx_partner_requests_sender ON partner_requests(sender_id);
CREATE INDEX idx_partner_requests_receiver ON partner_requests(receiver_id);
CREATE INDEX idx_partner_requests_status ON partner_requests(status);

-- ============================================
-- HELPER FUNCTION: Auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_memories_updated_at
    BEFORE UPDATE ON user_memories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cases_updated_at
    BEFORE UPDATE ON cases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calendar_events_updated_at
    BEFORE UPDATE ON calendar_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
-- Enable RLS on all tables to ensure users can only
-- access their own data or their partner's data.
-- ============================================

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE verdicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE appreciations ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROFILES POLICIES
-- ============================================
-- Users can view/update their own profile
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Users can view their partner's profile
CREATE POLICY "Users can view partner profile" ON profiles
    FOR SELECT USING (
        id = (SELECT partner_id FROM profiles WHERE id = auth.uid())
    );

-- Anyone can search profiles by partner_code (for connecting)
CREATE POLICY "Anyone can search by partner code" ON profiles
    FOR SELECT USING (true);

-- ============================================
-- CASES POLICIES
-- ============================================
CREATE POLICY "Users can view own cases" ON cases
    FOR SELECT USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

CREATE POLICY "Users can create cases" ON cases
    FOR INSERT WITH CHECK (auth.uid() = user_a_id);

CREATE POLICY "Users can update own cases" ON cases
    FOR UPDATE USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

-- ============================================
-- VERDICTS POLICIES
-- ============================================
CREATE POLICY "Users can view verdicts for own cases" ON verdicts
    FOR SELECT USING (
        case_id IN (SELECT id FROM cases WHERE user_a_id = auth.uid() OR user_b_id = auth.uid())
    );

-- Allow inserts (typically from server/service role)
CREATE POLICY "Allow verdict inserts" ON verdicts
    FOR INSERT WITH CHECK (true);

-- ============================================
-- COURT SESSIONS POLICIES
-- ============================================
CREATE POLICY "Users can view own sessions" ON court_sessions
    FOR SELECT USING (
        created_by = auth.uid() OR
        created_by = (SELECT partner_id FROM profiles WHERE id = auth.uid())
    );

CREATE POLICY "Users can create sessions" ON court_sessions
    FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own sessions" ON court_sessions
    FOR UPDATE USING (
        created_by = auth.uid() OR
        created_by = (SELECT partner_id FROM profiles WHERE id = auth.uid())
    );

-- ============================================
-- TRANSACTIONS POLICIES
-- ============================================
CREATE POLICY "Users can view own transactions" ON transactions
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create own transactions" ON transactions
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================
-- APPRECIATIONS POLICIES
-- ============================================
CREATE POLICY "Users can view sent/received appreciations" ON appreciations
    FOR SELECT USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

CREATE POLICY "Users can send appreciations" ON appreciations
    FOR INSERT WITH CHECK (from_user_id = auth.uid());

-- ============================================
-- DAILY ANSWERS POLICIES
-- ============================================
CREATE POLICY "Users can view own and partner answers" ON daily_answers
    FOR SELECT USING (
        user_id = auth.uid() OR 
        user_id = (SELECT partner_id FROM profiles WHERE id = auth.uid())
    );

CREATE POLICY "Users can insert own answers" ON daily_answers
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own answers" ON daily_answers
    FOR UPDATE USING (user_id = auth.uid());

-- ============================================
-- CALENDAR EVENTS POLICIES
-- ============================================
CREATE POLICY "Users can view own and partner events" ON calendar_events
    FOR SELECT USING (
        created_by = auth.uid() OR 
        created_by = (SELECT partner_id FROM profiles WHERE id = auth.uid())
    );

CREATE POLICY "Users can create events" ON calendar_events
    FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own events" ON calendar_events
    FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Users can delete own events" ON calendar_events
    FOR DELETE USING (created_by = auth.uid());

-- ============================================
-- PARTNER REQUESTS POLICIES
-- ============================================
CREATE POLICY "Users can view requests sent to them" ON partner_requests
    FOR SELECT USING (receiver_id = auth.uid());

CREATE POLICY "Users can view requests they sent" ON partner_requests
    FOR SELECT USING (sender_id = auth.uid());

CREATE POLICY "Users can send partner requests" ON partner_requests
    FOR INSERT WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Receivers can update request status" ON partner_requests
    FOR UPDATE USING (receiver_id = auth.uid());

-- ============================================
-- USER MEMORIES POLICIES
-- ============================================
-- Users can view their own memories (for transparency)
CREATE POLICY "Users can view own memories" ON user_memories
    FOR SELECT USING (user_id = auth.uid());

-- Service role can manage memories (AI writes these)
-- Users shouldn't directly insert/update memories
CREATE POLICY "Service can insert memories" ON user_memories
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Service can update memories" ON user_memories
    FOR UPDATE USING (true);

-- Partner can view each other's memories (for relationship transparency)
CREATE POLICY "Partner can view memories" ON user_memories
    FOR SELECT USING (
        user_id = (SELECT partner_id FROM profiles WHERE id = auth.uid())
    );

-- ============================================
-- DONE! 🎉
-- ============================================
-- Your Kitty Court database is now set up!
-- 
-- Tables created:
--   • profiles (extends auth.users)
--   • user_memories (AI-gathered insights about users)
--   • cases (disputes)
--   • verdicts (AI judgments)
--   • court_sessions (summoning system)
--   • transactions (kibble economy)
--   • appreciations (partner appreciation)
--   • daily_answers (Daily Meow feature)
--   • calendar_events (shared calendar)
--   • partner_requests (connection requests between users)
--
-- Next steps:
--   1. Enable Google OAuth in Authentication → Providers
--   2. Add http://localhost:5173/auth/callback as redirect URL
--   3. Test sign up flow in your app
-- ============================================
