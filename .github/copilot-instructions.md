# Cat Judge (Kitty Court) - AI Coding Instructions

## Architecture Overview

Couples dispute resolution app with AI "Judge Whiskers" persona. Monorepo structure:

- **`client/`** - React 19 + Vite SPA (mobile-first PWA)
- **`server/`** - Express 5 API with Judge Engine pipeline
- **`supabase/`** - Production database schema (auth + profiles + pgvector)

**Core Flow**: Partners connect via partner codes → set anniversary date → submit disputes asynchronously → Judge Whiskers delivers psychologically-grounded verdicts using Gottman Method + NVC principles.

## Development Commands

```bash
npm run dev              # Both client + server concurrently
cd client && npm test    # Vitest + React Testing Library
```

**Environment**: Server requires `.env` with `OPENROUTER_API_KEY`, `OPENAI_API_KEY` (embeddings), `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`.

## Judge Engine Pipeline (Critical Path)

The AI verdict system in `server/src/lib/judgeEngine.js` runs a **3-step chain** with moderation + RAG in parallel:

1. **Safety Guardrail** - OpenAI Moderation API filters harmful content
2. **Analytical Phase** - Kimi K2 (via OpenRouter) performs clinical psychological analysis using JSON schema mode
3. **Verdict Generation** - Same model with Judge Whiskers persona injection

Key files: `prompts.js` (psychological framework), `jsonSchemas.js` (structured output), `repairAttempts.js` (Gottman repair exercises).

**Never modify prompts without understanding the psychological framework** - verdicts must avoid blame percentages, trivializing emotions, or declaring winners.

## Memory System (RAG)

`server/MEMORY_SYSTEM.md` documents the hybrid memory approach:
- **Static profiles** (JSONB) - attachment style, love languages, conflict style
- **Episodic memories** (pgvector) - AI-extracted behavioral patterns with embeddings
- `stenographer.js` - Background extraction after verdicts using GPT-4o-mini
- `memoryRetrieval.js` - RAG pipeline before verdict generation

## Dual Store Architecture (Client)

Two Zustand stores with `persist` middleware:

```javascript
// useAuthStore.js - Supabase auth + profile
const { user, profile, signIn, refreshProfile } = useAuthStore();

// usePartnerStore.js - partner connection flow
const { partner, hasPartner, acceptRequest } = usePartnerStore();

// useOnboardingStore.js - onboarding flow state
const { onboardingComplete } = useOnboardingStore();

// useAppStore.js - Court sessions, cases, verdicts, kibble economy
// IMPORTANT: Uses auth store for user identification, NOT legacy User A/B pattern
const { courtSession, activeCase, generateVerdict, submitSide } = useAppStore();
```

**Case status flow**: `DRAFT → LOCKED_A → DELIBERATING → RESOLVED`

## Data Isolation Per Couple

All couple-specific data is isolated:
- **Supabase RLS**: `get_my_partner_id()` function enables secure couple-scoped policies
- **Backend filtering**: Cases API accepts `userAId` and `userBId` query params
- **Cases/Appreciations/Calendar**: Scoped by `user_a_id`/`user_b_id` or `created_by`

**Anniversary Date**: Set when accepting partner request (immutable via DB trigger). Stored on both partners' profiles.

## Database: Supabase Only

All data is stored in Supabase PostgreSQL with Row Level Security (RLS).
- `supabase/migrations/*.sql` - Database schema and functions

Key migrations:
- `001_initial_schema.sql` - Core tables and RLS
- `002_fix_rls_recursion.sql` - `get_my_partner_id()` function
- `003_add_anniversary_and_couple_isolation.sql` - Anniversary date + couple RLS policies
- `005_daily_questions_and_full_schema.sql` - Daily questions system
- `006_add_vector_memory_support.sql` - pgvector for AI memory
- `008_fix_duplicate_key_and_mood.sql` - Immutable mood, reward redemptions

## Partner Connection Flow

1. User A shares `partner_code` with User B
2. User B enters code in Connect Partner page
3. User A sees `PartnerRequestModal` 
4. User A enters **anniversary date** (immutable) and accepts
5. Both profiles updated with `partner_id` and `anniversary_date`
6. Calendar event created for anniversary (yearly recurring)

## Styling System

Tailwind CSS with court-themed palette in `tailwind.config.js`:
- Primary: `court-gold`, `court-brown`, `court-cream`, `court-maroon`
- Legacy: `blush`, `lavender`, `cream`, `mint`, `peach`
- Key classes: `glass-card`, `text-gradient`, `btn-primary`, `shadow-soft`

## Component Patterns

- All pages use Framer Motion for transitions (see `MainLayout.jsx`)
- Modals: `z-[60]` to appear above bottom dock (`z-40`), add `pb-20` for safe area
- `RequirePartner.jsx` - Wrapper that blocks access until partner connected
- User names: Always use `profile?.display_name` or `partner?.display_name`, never "User A/B"

## API Structure

- `/api/judge/deliberate` - Main verdict endpoint (POST)
- `/api/memory/*` - Profile and memory management
- `/api/court-sessions/*` - Real-time session coordination
- `/api/cases?userAId=&userBId=` - Case history filtered by couple
- `/api/appreciations/:userId` - Appreciations received by user

## Mobile-First Considerations

- `dvh` units for viewport, safe area padding (`safe-top`, `safe-bottom`)
- Touch-optimized with `whileTap` animations
- Bottom nav constrained to `max-w-lg` and centered
