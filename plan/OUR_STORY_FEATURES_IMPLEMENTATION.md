# Our Story Feature Enhancements - Implementation Plan

> **Last Updated:** December 28, 2024 (Rev 4 - Final Schema & Policy Fixes)  
> **Status:** Planning Phase  
> **Goal:** Make the "Our Story" section in the Profile page more functional and sticky through four interconnected features.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Schema Strategy: No Couples Table](#schema-strategy-no-couples-table)
3. [Critical Design Principles](#critical-design-principles)
4. [Progressive Disclosure Rules](#progressive-disclosure-rules)
5. [Feature 1: Level System & XP](#feature-1-level-system--xp)
6. [Feature 2: Challenges Framework](#feature-2-challenges-framework)
7. [Feature 3: Shared Memory Gallery](#feature-3-shared-memory-gallery)
8. [Feature 4: AI Relationship Insights](#feature-4-ai-relationship-insights)
9. [Technical Safeguards](#technical-safeguards)
10. [Edge Case Analysis & Decisions](#edge-case-analysis--decisions)
11. [Partner & Couple Lifecycle](#partner--couple-lifecycle)
12. [Database Schema](#database-schema)
13. [Implementation Phases](#implementation-phases)
14. [Verification Plan](#verification-plan)

---

## Executive Summary

### The Four Features

| Feature | Description | Stickiness Factor | Complexity |
|---------|-------------|-------------------|------------|
| **Level System** | Gamified XP progression with unlockable rewards | High - visible progress | Low |
| **Challenges** | Weekly/daily tasks that reward engagement | Very High - recurring motivation | Medium |
| **Memory Gallery** | Shared couple photos with timeline | High - emotional value | Medium |
| **AI Insights** | Personalized relationship analysis + conflict patterns | Very High - unique value | High |

### Integration Philosophy

- **Progressive Disclosure**: New users see simple features first; complexity unlocks over time
- **Interconnected But Independent**: Each feature works alone, but together they create engagement loops
- **Server-Authoritative**: All progress/rewards calculated server-side to prevent cheating
- **Premium Gating**: Free tier gets taste of each feature; Gold unlocks full potential
- **"Together" not "Scoreboard"**: Always frame as shared journey, never compare partners

---

## Schema Strategy: No Couples Table

> [!IMPORTANT]
> The existing app uses `profiles.partner_id` + helper functions, **NOT** a separate `couples` table.
> All new features **MUST** follow this existing pattern.

### Current Partner System

The app uses:
1. **`profiles.partner_id`**: UUID reference to partner's profile (NULL = no partner)
2. **`get_my_partner_id()`**: SECURITY DEFINER function that returns partner_id for current user
3. **`get_couple_ids(user1, user2)`**: Returns ordered UUID pair (smaller first) for consistent couple identification

### Why Not Add a `couples` Table?

| Option | Pros | Cons |
|--------|------|------|
| **Add `couples` table** | Cleaner foreign keys | Requires migration of ALL existing data, new join patterns, risk of sync issues |
| **Use existing pattern** | Zero migration, battle-tested, consistent with 20+ existing migrations | Slightly more verbose RLS policies |

**Decision**: Use existing `profiles.partner_id` pattern.

### Computed Couple ID Pattern

For tables that need to identify a couple (like `couple_levels`, `memories`), we use:

```sql
-- Computed couple identifier using ordered UUIDs
-- This is the same pattern used by couple_question_assignments

-- Example: couple_levels table uses the get_couple_ids pattern
-- user_a_id and user_b_id where user_a_id < user_b_id (lexicographically)
```

### Helper Functions to Add

```sql
-- Get computed couple identifier for current user
CREATE OR REPLACE FUNCTION get_my_couple_ids()
RETURNS TABLE(user_a_id UUID, user_b_id UUID)
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT * FROM get_couple_ids(auth.uid(), get_my_partner_id())
    WHERE get_my_partner_id() IS NOT NULL
$$;

-- Check if user is part of a specific couple (for RLS)
CREATE OR REPLACE FUNCTION is_my_couple(check_user_a UUID, check_user_b UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM get_my_couple_ids() 
        WHERE user_a_id = check_user_a AND user_b_id = check_user_b
    )
$$;

-- Check if currently connected (partner_id is not null)
CREATE OR REPLACE FUNCTION is_connected()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT get_my_partner_id() IS NOT NULL
$$;
```

---

## Critical Design Principles

> [!IMPORTANT]
> These principles address core UX risks identified in senior review.

### 1. Avoid Overwhelming Users

**Problem**: Four big features at once may feel overwhelming or "too gamified" for time-poor couples.

**Solution**: 
- Features unlock progressively (see [Progressive Disclosure Rules](#progressive-disclosure-rules))
- Never show more than ONE new feature prompt per session
- "Quiet mode" toggle to hide gamification elements

### 2. "Together" Framing, Not Competition

**Problem**: XP/Level systems can create scoreboard pressure and partner friction.

**Solution**:
- **NEVER show individual XP contributions** in main views
- Always display as "We earned" not "You earned" or "Partner earned"
- XP breakdown only accessible in optional detail view, clearly labeled "For curiosity only"
- Level celebrations always show both avatars together

**UI Copy Examples**:
```
✅ "You two reached Level 7 together! 🎉"
✅ "Together, you've answered 50 questions"
❌ "You answered 30, Partner answered 20"
❌ "You're carrying the team!"
```

### 3. Challenges as Invitations, Not Homework

**Problem**: Challenges that feel like homework will churn users, especially if one partner is less engaged.

**Solution**:
- Challenges are **never mandatory**
- No public failure shaming - expired challenges just disappear
- Focus on celebration when complete, silence when missed
- Start with VERY easy challenges (achievable in 2-3 days)
- Behavioral challenges have "Skip for this week" without penalty

**UI Copy Examples**:
```
✅ "New optional challenge available: Answer 3 questions together 💬"
✅ Challenge expired? → Simply gone, no "Failed" badge
❌ "You missed this week's challenge!"
❌ "Partner hasn't confirmed yet... nudge them?"
```

### 4. AI Insights: Safety Framing

**Problem**: AI insights can feel like surveillance or judgment. A bad insight can feel like relationship critique.

**Solution**:
- **Explicit opt-in required** (see AI Consent section)
- Every insight has "This is not relationship advice" disclaimer
- Frame as "observations" not "diagnoses"
- Never suggest one partner is "the problem"
- Easy one-tap "pause insights" option

**UI Copy Examples**:
```
✅ "We noticed you both tend to chat more in evenings 🌙"
✅ "This is based on patterns in your app activity, not professional advice"
❌ "Partner A isn't communicating enough"
❌ "You have a conflict problem with chores"
```

---

## Progressive Disclosure Rules

> [!NOTE]
> These concrete thresholds prevent visual overload on mobile and guide feature adoption.

### Dashboard Feature Visibility

| User State | What's Visible | What's Hidden |
|------------|---------------|---------------|
| **Day 1-3** | Daily Question card only | Level banner, Challenges, Memory of Day |
| **After 3 questions answered** | + Level banner (minimal) | Challenges, Memory of Day |
| **Level 5 reached** | + Challenge preview (1 card max) | Full challenges section |
| **Level 7 reached** | + Memory of Day widget | - |
| **Level 10 + AI consent** | + Insight teaser | - |

### Our Story Tab Visibility

| Level | Visible Sections |
|-------|-----------------|
| 1-4 | Relationship Card, Stats, Achievements |
| 5-6 | + Challenges preview (collapsed) |
| 7-9 | + Memories section (4 photo grid) |
| 10+ | + AI Insights card (if opted in) |

### Implementation

```javascript
// Progressive disclosure helper
function getVisibleFeatures(level, hasAIConsent, daysSinceSignup, questionsAnswered) {
  return {
    showLevelBanner: questionsAnswered >= 3,
    showChallengePreview: level >= 5,
    showFullChallenges: level >= 7,
    showMemoryOfDay: level >= 7,
    showMemoriesSection: level >= 7,
    showInsightsCard: level >= 10 && hasAIConsent,
    maxChallengesShown: level < 7 ? 1 : 3,
    maxMemoriesPreview: level < 10 ? 4 : 8,
  };
}
```

---

## Feature 1: Level System & XP

### Overview

A relationship-level progression system where couples earn XP through healthy engagement activities. The level is **shared** between partners (not individual) to reinforce "together" mindset.

### XP System Design

#### XP Sources with Anti-Exploit Measures

| Action | Base XP | Daily Cap | Weekly Cap | Quality Requirements |
|--------|---------|-----------|------------|---------------------|
| Daily Question Answer | 50 | 50 | 350 | Answer ≥ 20 characters |
| Daily Mood Check-in | 20 | 20 | 140 | Once per day |
| Appreciation Given | 30 | 90 | 450 | ≥ 10 chars, max 3 quality/day |
| Court Case Resolution | 100 | 100 | 300 | Both partners submitted evidence |
| Memory Upload | 25 | 50 | 100 | Valid image, moderation passed |
| Challenge Completion | 50-200 | - | - | Based on difficulty |
| Calendar Event Created | 15 | 30 | 100 | Future date, max 2/day |

#### Level Curve (Exponential)

| Level | Total XP Required | Title |
|-------|------------------|-------|
| 1 | 0 | Curious Kittens |
| 2 | 100 | Playful Paws |
| 3 | 250 | Snuggle Buddies |
| 5 | 700 | Cozy Companions |
| 7 | 1,200 | Cuddle Champions |
| 10 | 3,000 | Purr-fect Partners |
| 15 | 7,500 | Soulmates |
| 20 | 15,000 | Legendary Bond |
| 30 | 35,000 | Eternal Flame |
| 50 | 100,000 | Cat Royalty 👑 |

#### Level Rewards (Visible in UI)

| Level | Unlock | Where Visible |
|-------|--------|---------------|
| 3 | Badge: "Getting Started" | Profile card, Our Story |
| 5 | Profile frame: "Cozy Border" | Both avatars throughout app |
| 7 | Challenges system unlocks | Dashboard, Our Story |
| 10 | AI Insights available (with consent) | Our Story |
| 15 | Custom status titles | Profile, partner view |
| 20 | Advanced AI Insights (Gold) | Our Story |
| 30 | Exclusive "Veteran" badge | Profile, Our Story |
| 50 | Legendary crown overlay on avatars | Everywhere |

### Technical Implementation

#### Idempotent XP Awards

> [!IMPORTANT]
> All XP awards use idempotency keys to prevent double-awarding from retries or duplicates.

**Idempotency Key Format**: `{action_type}:{source_id}:{user_id}:{date}`

| Action Type | Idempotency Key Example |
|------------|------------------------|
| daily_question | `daily_question:dq_abc123:user_xyz:2024-12-28` |
| appreciation | `appreciation:apr_def456:user_xyz:2024-12-28` |
| case_resolution | `case_resolution:case_ghi789:user_xyz:2024-12-28` |
| memory_upload | `memory_upload:mem_jkl012:user_xyz:2024-12-28` |

---

## Feature 2: Challenges Framework

### Timezone Handling for Streaks

> [!IMPORTANT]
> **Unified Timezone Rule**: Use the existing `America/New_York` timezone from daily questions.
> This is already implemented in `get_todays_question()` and should be consistent across all features.

**Timezone Strategy**:
1. **Use `America/New_York`** for all streak and daily calculations (consistent with existing system)
2. **No per-couple timezone setting** - this would conflict with daily questions
3. **Grace period**: 2 hours past midnight ET for late-night completions
4. **Display**: Show "Days reset at midnight Eastern Time" in UI

**Implementation**:
```sql
-- Consistent with get_todays_question() in 010_daily_questions_est_timezone.sql
-- All day boundaries use America/New_York timezone

CREATE OR REPLACE FUNCTION get_current_day_et()
RETURNS DATE AS $$
BEGIN
    RETURN (NOW() AT TIME ZONE 'America/New_York')::DATE;
END;
$$ LANGUAGE plpgsql;

-- Grace period: treat 12:00-2:00 AM ET as previous day for streaks
CREATE OR REPLACE FUNCTION get_streak_day_et(ts TIMESTAMPTZ DEFAULT NOW())
RETURNS DATE AS $$
DECLARE
    et_time TIME;
    et_date DATE;
BEGIN
    et_time := (ts AT TIME ZONE 'America/New_York')::TIME;
    et_date := (ts AT TIME ZONE 'America/New_York')::DATE;
    
    -- If between midnight and 2 AM, count as previous day
    IF et_time < '02:00:00'::TIME THEN
        RETURN et_date - 1;
    END IF;
    
    RETURN et_date;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION is_same_streak_day(ts1 TIMESTAMPTZ, ts2 TIMESTAMPTZ)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_streak_day_et(ts1) = get_streak_day_et(ts2);
END;
$$ LANGUAGE plpgsql;
```

### Challenge Types with Strict Verification Config

> [!WARNING]
> No free-form SQL templates. Use typed, enumerated verification rules.

#### Verification Config Schema (Typed, Not SQL)

```typescript
type VerificationConfig = 
  | { type: 'count'; action: ActionType; min_count: number; per_partner?: boolean }
  | { type: 'streak'; action: ActionType; days: number; require_both: boolean }
  | { type: 'milestone'; action: ActionType; total_count: number }
  | { type: 'behavioral'; confirmation_timeout_hours: number };

type ActionType = 
  | 'daily_question_answer'
  | 'appreciation_given'
  | 'mood_checkin'
  | 'memory_upload'
  | 'case_resolved'
  | 'calendar_event';
```

---

## Feature 3: Shared Memory Gallery

### Memory Storage Security

> [!CAUTION]
> Photo URLs must be secured. Leaked URLs would expose sensitive couple photos.

#### Storage Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ PRIVATE BUCKET: couple-memories                                  │
│ Visibility: PRIVATE (not public)                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Structure:                                                       │
│   {user_a_id}_{user_b_id}/                                       │
│       {uuid}.webp                                                │
│       {uuid}.webp                                                │
│                                                                  │
│ Access Control:                                                  │
│   - RLS on storage.objects table                                 │
│   - Only couple members can read/write their folder              │
│   - Signed URLs with 1-hour expiration for viewing               │
│                                                                  │
│ Upload Flow:                                                     │
│   1. Client requests upload URL from server                      │
│   2. Server validates couple membership                          │
│   3. Server returns signed upload URL (10 min TTL)               │
│   4. Client uploads directly to storage                          │
│   5. Server creates memory record after upload confirmed         │
│                                                                  │
│ Viewing Flow:                                                    │
│   1. Client requests memory list from API                        │
│   2. Server validates couple membership                          │
│   3. Server returns memory data with signed URLs (1 hour TTL)    │
│   4. Client displays images using signed URLs                    │
│   5. Signed URLs auto-expire, refreshed on next fetch            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Supabase Storage RLS

```sql
-- Storage bucket RLS for couple-memories

-- Couples can read their own photos
CREATE POLICY "Couples can view their memories"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'couple-memories'
    AND (storage.foldername(name))[1] = (
        SELECT CONCAT(
            LEAST(auth.uid()::text, get_my_partner_id()::text),
            '_',
            GREATEST(auth.uid()::text, get_my_partner_id()::text)
        )
        WHERE get_my_partner_id() IS NOT NULL
    )
);

-- Couples can upload to their folder
CREATE POLICY "Couples can upload memories"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'couple-memories'
    AND (storage.foldername(name))[1] = (
        SELECT CONCAT(
            LEAST(auth.uid()::text, get_my_partner_id()::text),
            '_',
            GREATEST(auth.uid()::text, get_my_partner_id()::text)
        )
        WHERE get_my_partner_id() IS NOT NULL
    )
);

-- Couples can delete from their folder
CREATE POLICY "Couples can delete memories"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'couple-memories'
    AND (storage.foldername(name))[1] = (
        SELECT CONCAT(
            LEAST(auth.uid()::text, get_my_partner_id()::text),
            '_',
            GREATEST(auth.uid()::text, get_my_partner_id()::text)
        )
        WHERE get_my_partner_id() IS NOT NULL
    )
);
```

### Memory Soft-Delete & Restore

> [!NOTE]
> Both delete and restore need proper RLS policies that work together.

**Delete/Restore Semantics**:

| Actor | Can Delete? | Can Restore? | Can See Deleted? |
|-------|-------------|--------------|------------------|
| Uploader | ✅ Yes (soft-delete) | ✅ Within 24h of delete | ❌ After 24h |
| Partner | ❌ No | ✅ Within 30 days | ✅ Sees "X deleted" count |

**UX Flow**:
1. Partner A (uploader) deletes memory → Immediately hidden from both
2. Partner B sees: "1 memory was recently deleted" placeholder
3. Partner B can tap "Restore" → Memory reappears
4. After 30 days → Permanent deletion, no restore

**Database Schema for Proper Restore**:
```sql
-- memories table has restore capability
-- Partner can restore, not just uploader

-- Memory is visible if:
--   1. Not deleted, OR
--   2. Deleted by partner (I can see deleted count + restore option)
```

---

## Feature 4: AI Relationship Insights

### AI Consent & Opt-In

> [!CAUTION]
> AI insights require explicit consent and easy opt-out to maintain user trust.

**Consent stored in profiles table** (existing table, new columns):
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_insights_consent BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_insights_consent_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_insights_paused_until TIMESTAMPTZ;
```

**Both partners must consent** for insights to generate.

---

## Technical Safeguards

### RLS Policies for All New Tables

> [!IMPORTANT]
> All policies correctly handle disconnection: `get_my_partner_id() IS NOT NULL` check.

```sql
-- ========================================
-- HELPER FUNCTIONS (add to migration)
-- ========================================

-- Check if user is currently connected
CREATE OR REPLACE FUNCTION is_connected()
RETURNS BOOLEAN
LANGUAGE SQL SECURITY DEFINER STABLE
SET search_path = public
AS $$
    SELECT get_my_partner_id() IS NOT NULL
$$;

-- Get couple folder name for storage
CREATE OR REPLACE FUNCTION get_couple_folder()
RETURNS TEXT
LANGUAGE SQL SECURITY DEFINER STABLE
SET search_path = public
AS $$
    SELECT CONCAT(
        LEAST(auth.uid()::text, get_my_partner_id()::text),
        '_',
        GREATEST(auth.uid()::text, get_my_partner_id()::text)
    )
    WHERE get_my_partner_id() IS NOT NULL
$$;

-- ========================================
-- COUPLE LEVELS
-- ========================================
ALTER TABLE couple_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Connected couples can view their level"
ON couple_levels FOR SELECT
USING (
    is_connected() AND
    is_my_couple(user_a_id, user_b_id)
);

-- Server-only insert/update via service role

-- ========================================
-- XP TRANSACTIONS
-- ========================================
ALTER TABLE xp_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Connected couples can view XP history"
ON xp_transactions FOR SELECT
USING (
    is_connected() AND
    is_my_couple(user_a_id, user_b_id)
);

-- Server-only insert via service role

-- ========================================
-- COUPLE CHALLENGES
-- ========================================
ALTER TABLE couple_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Connected couples can view their challenges"
ON couple_challenges FOR SELECT
USING (
    is_connected() AND
    is_my_couple(user_a_id, user_b_id)
);

-- Server-only management via service role

-- ========================================
-- MEMORIES
-- ========================================
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

-- Viewing: Can see if connected AND (not deleted OR deleted by partner for restore)
CREATE POLICY "Connected couples can view memories"
ON memories FOR SELECT
USING (
    is_connected() AND
    is_my_couple(user_a_id, user_b_id) AND
    (
        is_deleted = FALSE OR
        (is_deleted = TRUE AND deleted_by != auth.uid()) -- Partner can see deleted for restore
    )
);

-- Insert: Connected couples can add memories
CREATE POLICY "Connected couples can insert memories"
ON memories FOR INSERT
WITH CHECK (
    is_connected() AND
    is_my_couple(user_a_id, user_b_id) AND
    uploaded_by = auth.uid()
);

-- Soft-delete: Uploader can mark as deleted
CREATE POLICY "Uploader can soft-delete memories"
ON memories FOR UPDATE
USING (uploaded_by = auth.uid() AND is_deleted = FALSE)
WITH CHECK (is_deleted = TRUE AND deleted_by = auth.uid());

-- Restore: Partner (not deleter) can restore within 30 days
CREATE POLICY "Partner can restore deleted memories"
ON memories FOR UPDATE
USING (
    is_connected() AND
    is_my_couple(user_a_id, user_b_id) AND
    is_deleted = TRUE AND
    deleted_by != auth.uid() AND -- Not the one who deleted
    deleted_at > NOW() - INTERVAL '30 days' -- Within 30 days
)
WITH CHECK (is_deleted = FALSE AND deleted_by IS NULL AND deleted_at IS NULL);

-- Restore: Uploader can undo their delete within 24 hours
CREATE POLICY "Uploader can restore within 24h"
ON memories FOR UPDATE
USING (
    is_connected() AND
    is_my_couple(user_a_id, user_b_id) AND
    is_deleted = TRUE AND
    deleted_by = auth.uid() AND -- I deleted it
    deleted_at > NOW() - INTERVAL '24 hours' -- Within 24 hours
)
WITH CHECK (is_deleted = FALSE AND deleted_by IS NULL AND deleted_at IS NULL);

-- ========================================
-- MEMORY REACTIONS
-- ========================================
ALTER TABLE memory_reactions ENABLE ROW LEVEL SECURITY;

-- View reactions for visible memories
CREATE POLICY "Connected couples can view reactions"
ON memory_reactions FOR SELECT
USING (
    is_connected() AND
    EXISTS (
        SELECT 1 FROM memories m 
        WHERE m.id = memory_id 
        AND is_my_couple(m.user_a_id, m.user_b_id)
        AND m.is_deleted = FALSE
    )
);

-- Insert own reactions
CREATE POLICY "Connected couples can add reactions"
ON memory_reactions FOR INSERT
WITH CHECK (
    is_connected() AND
    user_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM memories m 
        WHERE m.id = memory_id 
        AND is_my_couple(m.user_a_id, m.user_b_id)
        AND m.is_deleted = FALSE
    )
);

-- Update own reactions (change emoji)
CREATE POLICY "Users can update own reactions"
ON memory_reactions FOR UPDATE
USING (user_id = auth.uid());

-- Delete own reactions
CREATE POLICY "Users can delete own reactions"
ON memory_reactions FOR DELETE
USING (user_id = auth.uid());

-- ========================================
-- MEMORY COMMENTS
-- ========================================
ALTER TABLE memory_comments ENABLE ROW LEVEL SECURITY;

-- View comments for visible memories
CREATE POLICY "Connected couples can view comments"
ON memory_comments FOR SELECT
USING (
    is_connected() AND
    EXISTS (
        SELECT 1 FROM memories m 
        WHERE m.id = memory_id 
        AND is_my_couple(m.user_a_id, m.user_b_id)
        AND m.is_deleted = FALSE
    )
);

-- Insert own comments
CREATE POLICY "Connected couples can add comments"
ON memory_comments FOR INSERT
WITH CHECK (
    is_connected() AND
    user_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM memories m 
        WHERE m.id = memory_id 
        AND is_my_couple(m.user_a_id, m.user_b_id)
        AND m.is_deleted = FALSE
    )
);

-- Update own comments
CREATE POLICY "Users can update own comments"
ON memory_comments FOR UPDATE
USING (user_id = auth.uid());

-- Delete: Both partners can delete any comment (shared space)
CREATE POLICY "Couples can delete comments"
ON memory_comments FOR DELETE
USING (
    is_connected() AND
    EXISTS (
        SELECT 1 FROM memories m 
        WHERE m.id = memory_id 
        AND is_my_couple(m.user_a_id, m.user_b_id)
    )
);

-- ========================================
-- INSIGHTS
-- ========================================
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Consented couples can view insights"
ON insights FOR SELECT
USING (
    is_connected() AND
    is_my_couple(user_a_id, user_b_id) AND
    -- Both partners must have consented
    EXISTS (
        SELECT 1 FROM profiles p1, profiles p2
        WHERE p1.id = auth.uid() 
        AND p2.id = get_my_partner_id()
        AND p1.ai_insights_consent = TRUE 
        AND p2.ai_insights_consent = TRUE
        AND (p1.ai_insights_paused_until IS NULL OR p1.ai_insights_paused_until < NOW())
        AND (p2.ai_insights_paused_until IS NULL OR p2.ai_insights_paused_until < NOW())
    )
);

-- Server-only insert via service role
```

### Post-Disconnection Access Control

> [!CAUTION]
> When `profiles.partner_id` is set to NULL, all couple data becomes inaccessible.

**How It Works**:
1. Disconnection sets `partner_id = NULL` for both users
2. `get_my_partner_id()` returns NULL
3. `is_connected()` returns FALSE
4. All RLS policies check `is_connected()` → Access denied

**What Happens to Data**:
- Data remains in database (for potential reconnection within 30 days)
- Neither ex-partner can view it via RLS
- After 30 days, background job permanently deletes

### Server-Side Membership Checks

> [!WARNING]
> RLS is defense-in-depth. All API routes MUST also verify couple membership.

```javascript
// Middleware for all /api routes that touch couple data
async function verifyCoupleAccess(req, res, next) {
  const userId = req.user.id;
  
  // Fetch user's partner_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('partner_id')
    .eq('id', userId)
    .single();
  
  if (!profile?.partner_id) {
    return res.status(403).json({ error: 'No partner connected' });
  }
  
  req.partnerId = profile.partner_id;
  
  // For endpoints that specify a couple, verify membership
  if (req.params.userAId && req.params.userBId) {
    const couple = getOrderedCoupleIds(userId, profile.partner_id);
    if (couple.user_a_id !== req.params.userAId || couple.user_b_id !== req.params.userBId) {
      logger.warn('Couple access denied', { userId, attempted: req.params });
      return res.status(403).json({ error: 'Access denied' });
    }
  }
  
  next();
}

// Helper matching get_couple_ids() SQL function
function getOrderedCoupleIds(user1, user2) {
  if (user1 < user2) {
    return { user_a_id: user1, user_b_id: user2 };
  }
  return { user_a_id: user2, user_b_id: user1 };
}
```

---

## Partner & Couple Lifecycle

### Disconnection Mechanics

> [!IMPORTANT]
> Disconnection = setting `partner_id = NULL` on both profiles.

```
┌─────────────────────────────────────────────────────────────────┐
│  Disconnect Flow                                                 │
├─────────────────────────────────────────────────────────────────┤
│  1. Initiating partner sees:                                     │
│     "Disconnecting will end your shared story with [Partner].   │
│     All shared data will be hidden for 30 days, then deleted.   │
│     [Cancel] [Disconnect]"                                       │
│                                                                  │
│  2. On confirm (atomic transaction):                             │
│     a. Compute ordered couple IDs                                │
│     b. INSERT INTO couple_disconnect_history                     │
│        (user_a_id, user_b_id, disconnected_by, disconnected_at)  │
│        ON CONFLICT DO UPDATE SET disconnected_at = NOW()         │
│     c. UPDATE profiles SET partner_id = NULL,                    │
│                            partner_connected_at = NULL           │
│        WHERE id IN (user_id, partner_id)                         │
│     d. Partner B notified: "Partner has ended your connection"  │
│                                                                  │
│  3. Immediate effect (via RLS):                                  │
│     - get_my_partner_id() returns NULL for both                  │
│     - is_connected() returns FALSE for both                      │
│     - All couple data becomes inaccessible via RLS               │
│                                                                  │
│  4. After 30 days (background job):                              │
│     - Query couple_disconnect_history WHERE                      │
│       disconnected_at < NOW() - INTERVAL '30 days'               │
│     - For each: permanently delete couple_levels, xp_transactions│
│       couple_challenges, memories, insights, relationship_stats  │
│     - Delete storage bucket folder                               │
│     - Delete couple_disconnect_history row                       │
└─────────────────────────────────────────────────────────────────┘
```

### Re-Pairing (Same or New Partner)

**Same Partner Reconnects** (within 30 days):
- Data still exists in database
- New partner connection restores access via RLS
- "Welcome back! Your memories are still here."

**New Partner**:
- Old couple data remains inaccessible (different couple IDs)
- New couple starts fresh
- After 30 days, old data is permanently deleted

---

## Database Schema

### New Tables (Following Existing Pattern)

```sql
-- ========================================
-- PREREQUISITE: Ensure pgcrypto for gen_random_uuid()
-- ========================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ========================================
-- COUPLE DISCONNECT HISTORY (for 30-day purge tracking)
-- ========================================
CREATE TABLE couple_disconnect_history (
    user_a_id UUID NOT NULL,
    user_b_id UUID NOT NULL,
    disconnected_by UUID REFERENCES profiles(id),
    disconnected_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    PRIMARY KEY (user_a_id, user_b_id),
    CHECK (user_a_id < user_b_id)
);

CREATE INDEX idx_disconnect_history_time ON couple_disconnect_history(disconnected_at);

-- ========================================
-- COUPLE LEVELS (uses user_a_id, user_b_id pattern)
-- ========================================
CREATE TABLE couple_levels (
    user_a_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    user_b_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    total_xp INTEGER DEFAULT 0,
    current_level INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_a_id, user_b_id),
    -- Enforce ordering constraint
    CHECK (user_a_id < user_b_id)
);

-- ========================================
-- XP TRANSACTIONS
-- ========================================
CREATE TABLE xp_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key TEXT UNIQUE NOT NULL,
    user_a_id UUID NOT NULL,
    user_b_id UUID NOT NULL,
    user_id UUID REFERENCES profiles(id) NOT NULL, -- Who earned it
    action_type TEXT NOT NULL,
    source_id TEXT,
    xp_amount INTEGER NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_a_id, user_b_id) REFERENCES couple_levels(user_a_id, user_b_id) ON DELETE CASCADE,
    CHECK (user_a_id < user_b_id)
);

CREATE INDEX idx_xp_transactions_couple ON xp_transactions(user_a_id, user_b_id, created_at);

-- ========================================
-- CHALLENGES
-- ========================================
CREATE TABLE challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    emoji TEXT,
    type TEXT NOT NULL CHECK (type IN ('count', 'streak', 'milestone', 'behavioral')),
    target_value INTEGER NOT NULL,
    verification_config JSONB NOT NULL,
    requires_partner_confirm BOOLEAN DEFAULT FALSE,
    reward_xp INTEGER DEFAULT 0,
    reward_badge_id UUID,
    difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    cooldown_days INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- COUPLE CHALLENGES
-- ========================================
CREATE TABLE couple_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_a_id UUID NOT NULL,
    user_b_id UUID NOT NULL,
    challenge_id UUID REFERENCES challenges(id) NOT NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    current_progress INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired', 'skipped')),
    completed_at TIMESTAMPTZ,
    partner_confirm_requested_at TIMESTAMPTZ,
    partner_confirmed_at TIMESTAMPTZ,
    verification_log JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- FK to couple_levels ensures valid couple exists
    FOREIGN KEY (user_a_id, user_b_id) REFERENCES couple_levels(user_a_id, user_b_id) ON DELETE CASCADE,
    CHECK (user_a_id < user_b_id),
    UNIQUE(user_a_id, user_b_id, challenge_id, started_at)
);

-- ========================================
-- MEMORIES
-- ========================================
CREATE TABLE memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_a_id UUID NOT NULL,
    user_b_id UUID NOT NULL,
    uploaded_by UUID REFERENCES profiles(id) NOT NULL,
    storage_path TEXT NOT NULL, -- Path in couple-memories bucket
    caption TEXT,
    memory_date DATE NOT NULL,
    moderation_status TEXT DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- FK to couple_levels ensures valid couple exists
    FOREIGN KEY (user_a_id, user_b_id) REFERENCES couple_levels(user_a_id, user_b_id) ON DELETE CASCADE,
    CHECK (user_a_id < user_b_id)
);

CREATE INDEX idx_memories_couple ON memories(user_a_id, user_b_id, is_deleted, memory_date);

-- ========================================
-- MEMORY REACTIONS
-- ========================================
CREATE TABLE memory_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    memory_id UUID REFERENCES memories(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) NOT NULL,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(memory_id, user_id)
);

-- ========================================
-- MEMORY COMMENTS
-- ========================================
CREATE TABLE memory_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    memory_id UUID REFERENCES memories(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- BADGES
-- ========================================
CREATE TABLE badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    emoji TEXT NOT NULL,
    unlock_condition TEXT,
    display_surface TEXT[],
    is_hidden BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- COUPLE BADGES  
-- ========================================
CREATE TABLE couple_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_a_id UUID NOT NULL,
    user_b_id UUID NOT NULL,
    badge_id UUID REFERENCES badges(id) NOT NULL,
    earned_at TIMESTAMPTZ DEFAULT NOW(),
    -- FK to couple_levels ensures valid couple exists
    FOREIGN KEY (user_a_id, user_b_id) REFERENCES couple_levels(user_a_id, user_b_id) ON DELETE CASCADE,
    CHECK (user_a_id < user_b_id),
    UNIQUE(user_a_id, user_b_id, badge_id)
);

-- ========================================
-- INSIGHTS
-- ========================================
CREATE TABLE insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_a_id UUID NOT NULL,
    user_b_id UUID NOT NULL,
    category TEXT NOT NULL,
    insight_text TEXT NOT NULL,
    evidence_summary TEXT,
    confidence_score NUMERIC(3,2),
    helpful_count INTEGER DEFAULT 0,
    not_helpful_count INTEGER DEFAULT 0,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    -- FK to couple_levels ensures valid couple exists
    FOREIGN KEY (user_a_id, user_b_id) REFERENCES couple_levels(user_a_id, user_b_id) ON DELETE CASCADE,
    CHECK (user_a_id < user_b_id)
);

CREATE INDEX idx_insights_couple ON insights(user_a_id, user_b_id, is_active);

-- ========================================
-- RELATIONSHIP STATS (for AI)
-- ========================================
CREATE TABLE relationship_stats (
    user_a_id UUID NOT NULL,
    user_b_id UUID NOT NULL,
    stats JSONB DEFAULT '{}',
    last_calculated TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_a_id, user_b_id),
    -- FK to couple_levels ensures valid couple exists
    FOREIGN KEY (user_a_id, user_b_id) REFERENCES couple_levels(user_a_id, user_b_id) ON DELETE CASCADE,
    CHECK (user_a_id < user_b_id)
);

-- RLS for relationship_stats (server-managed, read-only for clients)
ALTER TABLE relationship_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Connected couples can view their stats"
ON relationship_stats FOR SELECT
USING (
    is_connected() AND
    is_my_couple(user_a_id, user_b_id)
);

-- No INSERT/UPDATE/DELETE policies for clients - server-only via service role
```

### Couple Levels Initialization

> [!IMPORTANT]
> The `couple_levels` row must exist before any XP can be awarded or any other couple data created.

**Initialization Trigger** (on partner connection):

```sql
-- Trigger function to create couple_levels when partners connect
CREATE OR REPLACE FUNCTION create_couple_levels_on_connect()
RETURNS TRIGGER AS $$
DECLARE
    v_user_a UUID;
    v_user_b UUID;
BEGIN
    -- Only act when partner_id transitions from NULL to a value
    IF OLD.partner_id IS NULL AND NEW.partner_id IS NOT NULL THEN
        -- Get ordered couple IDs
        IF NEW.id < NEW.partner_id THEN
            v_user_a := NEW.id;
            v_user_b := NEW.partner_id;
        ELSE
            v_user_a := NEW.partner_id;
            v_user_b := NEW.id;
        END IF;
        
        -- Create couple_levels row if it doesn't exist
        INSERT INTO couple_levels (user_a_id, user_b_id, total_xp, current_level)
        VALUES (v_user_a, v_user_b, 0, 1)
        ON CONFLICT (user_a_id, user_b_id) DO NOTHING;
        
        -- Remove from disconnect history if reconnecting
        DELETE FROM couple_disconnect_history 
        WHERE user_a_id = v_user_a AND user_b_id = v_user_b;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_create_couple_levels
    AFTER UPDATE OF partner_id ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION create_couple_levels_on_connect();
```

**Alternative: Server-Side Initialization**:

If triggers are not preferred, the server can ensure initialization:

```javascript
// Called when partner connection is accepted
async function onPartnerConnected(userA, userB) {
  const couple = getOrderedCoupleIds(userA, userB);
  
  // Upsert couple_levels
  await db.query(`
    INSERT INTO couple_levels (user_a_id, user_b_id, total_xp, current_level)
    VALUES ($1, $2, 0, 1)
    ON CONFLICT (user_a_id, user_b_id) DO NOTHING
  `, [couple.user_a_id, couple.user_b_id]);
  
  // Remove from disconnect history if exists (reconnection)
  await db.query(`
    DELETE FROM couple_disconnect_history 
    WHERE user_a_id = $1 AND user_b_id = $2
  `, [couple.user_a_id, couple.user_b_id]);
}
```

---

## Implementation Phases

---

## Senior Review & Handoff Protocol (How We Work)

> [!IMPORTANT]
> This section is the coordination contract between senior and junior developer.

### Communication Channel
- All updates, questions, and decisions must be recorded in this document.
- Use the "Check-in Template" below for every handoff or review request.

### Ownership Split
- **Junior Dev owns**: client UI, wiring, and non-sensitive server routes.
- **Senior Dev owns**: DB migrations, RLS policies, idempotency logic, and any security‑critical flows.

### When to Request Review
- **Before starting any phase**: confirm scope + acceptance criteria.
- **Before merging a phase**: request review with test results and risk notes.
- **Anytime you change data shape**: stop and request review (migrations, RLS, schema).

### What to Hand Off to Senior
- RLS policy drafts (SQL) for any new tables or storage buckets.
- Migration plan for new tables/columns (including rollback notes).
- Idempotency key formats and dedupe logic.
- Any logic touching authentication, partner access, or private media URLs.

### What Junior Should Implement First
1) **Phase 1 UI**: Level banner + Our Story level section (placeholder data OK).
2) **Phase 1 service wiring**: XP award calls from existing actions (feature flagged).
3) **Phase 2 UI**: Challenges preview + Challenges page scaffolding.

### Required Reviews by Phase
- **Phase 1**: Senior reviews migrations + RLS + XP service before merge.
- **Phase 2**: Senior reviews challenge verification engine and idempotency log.
- **Phase 3**: Senior reviews storage RLS + signed URL flow + moderation fail states.
- **Phase 4**: Senior reviews AI consent flow + insight generation safety guardrails.

### Check-in Template (Paste for Every Review Request)
```
## Check-in: <phase> / <date>

### Summary
- What changed:
- Why:

### Files / Modules
- Server:
- Client:
- Migrations/RLS:

### Testing
- Commands run:
- Results:

### Risks / Edge Cases
- Potential issues:
- Open questions:

### Review Request
- Please review:
- Blocking items:
```

### Phase 1: Level System & XP (1-2 weeks)
**Dependencies:** None  
**Value:** Immediate visible progression, foundation for challenges

| Task | Effort | Files |
|------|--------|-------|
| Add helper functions (`is_connected`, `is_my_couple`, etc.) | 1h | `supabase/migrations/` |
| Create `couple_levels` and `xp_transactions` tables with RLS | 3h | `supabase/migrations/` |
| XP service with idempotency, caps, quality checks | 6h | `server/src/lib/xpService.js` |
| Integrate XP awards into existing actions | 4h | Multiple route handlers |
| Level progress component | 3h | `client/src/components/LevelProgress.jsx` |
| Dashboard level banner (conditional) | 3h | `DashboardPage.jsx` |
| Our Story level display | 2h | `ProfilesPage.jsx` |

### Phase 2: Challenges Framework (2-3 weeks)
**Dependencies:** Level System (for XP rewards)  
**Value:** Recurring engagement driver

| Task | Effort | Files |
|------|--------|-------|
| Challenge tables with typed verification config | 3h | `supabase/migrations/` |
| Challenge service with strict verification engine | 8h | `server/src/lib/challengeService.js` |
| ET timezone-aware streak checking | 4h | `server/src/lib/streakService.js` |
| Partner confirmation flow (48h timeout) | 6h | Full-stack |
| Dashboard challenge banner (Level 5+) | 3h | `DashboardPage.jsx` |
| Challenges page | 6h | `client/src/pages/ChallengesPage.jsx` |

### Phase 3: Memory Gallery (2 weeks)
**Dependencies:** None (can parallel with Phase 2)  
**Value:** Emotional anchor

| Task | Effort | Files |
|------|--------|-------|
| Create private storage bucket with RLS | 2h | Supabase Dashboard + migrations |
| Memories tables with proper RLS | 3h | `supabase/migrations/` |
| Signed URL generation for secure viewing | 3h | `server/src/lib/storageService.js` |
| Content moderation integration | 6h | `server/src/lib/moderationService.js` |
| Soft delete with partner restore | 3h | `server/src/routes/memories.js` |
| Memory gallery page | 8h | `client/src/pages/MemoriesPage.jsx` |

### Phase 4: AI Insights (2-3 weeks)
**Dependencies:** Level 10 + Consent system  
**Value:** Premium differentiator

| Task | Effort | Files |
|------|--------|-------|
| Add consent columns to profiles | 1h | `supabase/migrations/` |
| Consent UI and flow | 4h | Full-stack |
| Privacy controls (pause, delete, export) | 4h | Full-stack |
| Insights tables with consent-based RLS | 3h | `supabase/migrations/` |
| Data aggregation service | 8h | `server/src/lib/statsAggregator.js` |
| Insight generation with safety constraints | 8h | `server/src/lib/insightGenerator.js` |

---

## Verification Plan

### Automated Testing

#### RLS Policy Tests (Critical)

```bash
# Run from supabase directory
# These tests verify RLS works correctly

# Test setup: Create test users, connect them, verify access
# Test 1: Connected couple can see shared data
# Test 2: Disconnected user cannot see ex-couple data  
# Test 3: User A cannot see User C's couple data
# Test 4: Deleted memory visible to partner for restore
# Test 5: Restored memory visible to both
```

#### Unit Tests

| Test File | Coverage |
|-----------|----------|
| `xpService.test.js` | Idempotency, caps, level calculation |
| `challengeService.test.js` | Verification config parsing, progress tracking |
| `streakService.test.js` | ET timezone handling, grace period |
| `storageService.test.js` | Signed URL generation, expiration |

### Manual Testing Checklist

#### Disconnection Flow (Critical)
- [ ] Partner A disconnects → Partner A cannot see memories
- [ ] Partner B immediately cannot see memories
- [ ] Attempting to load Our Story shows "Connect to a partner"
- [ ] Reconnecting same partner → Data reappears

#### Memory Restore Flow
- [ ] User A uploads memory → Both see it
- [ ] User A deletes memory → User A cannot see it
- [ ] User B sees "1 deleted memory" with restore option
- [ ] User B restores → Both see memory again

---

## Open Questions (Updated)

1. **Memory Deletion UX**: Should the deleter see a placeholder, or just a count of deleted items visible only to partner?
   - **Recommendation**: Partner sees "X memories need attention" badge, not placeholders throughout gallery

2. **Same-Partner Reconnection**: What's the exact flow and timing window?
   - **Recommendation**: 30-day window, then permanent deletion via background job

3. **Timezone Display**: Should we explain "midnight Eastern" to users, or just say "midnight" and handle it?
   - **Recommendation**: Show "Days reset at midnight ET" in a tooltip/info icon

---

---

*This document updated December 28, 2024 to align with existing `profiles.partner_id` pattern, fix RLS policies for disconnection, add memory storage security, and unify timezone handling with existing daily questions system.*

---

## Junior Dev Handoff Note (2024-12-28)

### Completed Work (Phase 1A + 2A + 1B Skeleton)

#### Client Components Created
| File | Description |
|------|-------------|
| `client/src/store/useLevelStore.js` | Zustand store with mock data, progressive disclosure helpers |
| `client/src/components/LevelProgress.jsx` | Compact + full mode progress display, "together" framing |
| `client/src/components/ChallengeCard.jsx` | Progress bar, difficulty badges, skip, completed states |
| `client/src/pages/ChallengesPage.jsx` | Mock data, Level 5+ gate, active/available/completed sections |

#### Client Integrations
| File | Changes |
|------|---------|
| `client/src/pages/DashboardPage.jsx` | Added level banner (compact) with progressive disclosure |
| `client/src/pages/ProfilesPage.jsx` | Added level section to Our Story tab (full display) |
| `client/src/App.jsx` | Added `/challenges` route |

#### Server Skeleton
| File | Description |
|------|-------------|
| `server/src/lib/xpService.js` | No-op stub with TODOs for senior (see below) |

### Pending Senior Review: xpService.js

The XP service is a **no-op stub**. It returns safe results without touching the database.

**TODOs marked for you in the file:**
1. Check idempotency key in `xp_transactions` table
2. Check daily cap for action types
3. Insert into `xp_transactions` with `ON CONFLICT` handling
4. Update `couple_levels.total_xp` and handle level-up

**Feature flags:**
- Server: `process.env.XP_SYSTEM_ENABLED === 'true'` (default: false)
- Client: `import.meta.env.VITE_XP_SYSTEM_ENABLED === 'true'` (default: false)

### What Still Needs Senior Implementation

| Item | Priority | Notes |
|------|----------|-------|
| DB migrations | HIGH | Tables drafted in this doc (lines 890-1100) |
| RLS policies | HIGH | Policies drafted in this doc (lines 560-720) |
| XP service idempotency logic | HIGH | TODOs in `xpService.js` |
| `couple_levels` init trigger | MEDIUM | SQL in this doc (lines 1120-1180) |
| Storage bucket creation | MEDIUM | For Phase 3 (memories) |

### Check-in: Phase 1B Wiring / 2024-12-28

#### Summary
- What changed: Created XP service skeleton with no-op returns
- Why: Safe foundation for senior to implement real logic

#### Files / Modules
- Server: `server/src/lib/xpService.js` (skeleton only)
- Client: Level UI, Challenges scaffolding (all mock data)
- Migrations/RLS: **None created** (drafts in this doc)

#### Testing
- Commands run: Client dev server running, components render correctly
- Results: Level banner visible on dashboard (mock data), Challenges page accessible at `/challenges`

#### Risks / Edge Cases
- XP service is no-op, won't block user flows
- Mock data shape matches planned API

#### Review Request
- Please review: `xpService.js` TODOs before implementing
- Blocking items: None for UI work; backend needed before going live

---

## Senior Response: Next Work for Junior Dev (2024-12-28)

### ✅ XP Phase Status
- XP backend + `/api/levels/status` are now wired. You can remove mock data reliance once the flag is on.

### Next Focus: Phase 2B Challenges Backend + Client Wiring
**Goal:** Replace mock challenges data with real API data and add basic progression hooks.

#### Junior Dev Tasks (Start Now)
1. **Challenges API client wiring**
   - Update `client/src/pages/ChallengesPage.jsx` to fetch from `/api/challenges` (new endpoint in Phase 2B).
   - Keep a clean empty state when no challenges are active.
2. **Challenge store (optional but preferred)**
   - Add `client/src/store/useChallengeStore.js` with fetch + optimistic UI for skip.
3. **UI polish**
   - Ensure Challenge cards match existing look/feel; reuse gradients and spacing patterns.
   - Confirm skip button uses the “quiet” language (no shame).

#### Senior Dev Tasks (I will handle)
- Create DB migrations + RLS for `challenges`, `couple_challenges`, and any progress log table.
- Implement `server/src/lib/challengeService.js` (typed verification config + idempotent progress).
- Add `/api/challenges` endpoints (list active, list available, skip, mark complete).

### Review Gates
- Before you swap mock → API, post a check-in with:
  - Endpoint shape you expect (`/api/challenges` response schema)
  - Screens affected
  - Any UI state edge cases you noticed

### Check-in Template Reminder
Use the template in “Senior Review & Handoff Protocol” for every review request.

---

## Junior Dev Handoff: Phase 2B Client Wiring (2024-12-28)

### Completed Work

| File | Description |
|------|-------------|
| `client/src/store/useChallengeStore.js` | **NEW** - Zustand store with fetch, optimistic skip/start |
| `client/src/pages/ChallengesPage.jsx` | **UPDATED** - Uses store, loading skeletons, error state |

### Expected API Schema

```javascript
// GET /api/challenges
{
  active: [{ id, title, description, emoji, currentProgress, targetProgress, daysLeft, difficulty, rewardXP, status }],
  available: [...],
  completed: [...]
}

// POST /api/challenges/:id/skip → { success: true }
// POST /api/challenges/:id/start → { success: true, challenge: {...} }
```

### Check-in: Phase 2B / 2024-12-28

**Summary**: Created useChallengeStore.js with optimistic skip, updated ChallengesPage.jsx to use API.

**Files**: `useChallengeStore.js` (new), `ChallengesPage.jsx` (updated)

**Testing**: Page loads, shows empty state (API not yet implemented)

**Blocking**: Need `/api/challenges` endpoint to test live
