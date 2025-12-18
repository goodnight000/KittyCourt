# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Pause** (formerly "Cat Judge") is a couples dispute resolution app featuring AI Cat persona that delivers psychologically-grounded verdicts based on Gottman Method and NVC principles. The app is a mobile-first PWA built with React 19 + Capacitor for iOS/Android deployment.

**Monorepo Structure:**
- `client/` - React 19 + Vite frontend (mobile PWA)
- `server/` - Express 5 API with AI judge pipeline
- `supabase/migrations/` - PostgreSQL schema with pgvector for AI memory

## Development Commands

```bash
# Root (run both client + server)
npm run dev              # Concurrently run client and server
npm run install:all      # Install all dependencies

# Client (from client/ directory)
npm run dev              # Vite dev server (port 5173)
npm run build            # Production build
npm run lint             # ESLint
npm test                 # Vitest unit tests
npm run test:coverage    # Test coverage report

# Server (from server/ directory)
npm run dev              # Node with --watch flag (port 3000)
npm start                # Production mode
npm test                 # Vitest tests

# Mobile (from client/ directory)
npx cap sync             # Sync web build to native platforms
npx cap open ios         # Open Xcode
npx cap open android     # Open Android Studio
```

**Environment Setup:**
Server requires `.env` file in `server/` directory with:
- `OPENROUTER_API_KEY` - For DeepSeek/Claude models
- `OPENAI_API_KEY` - For embeddings only
- `SUPABASE_URL` - Production database
- `SUPABASE_SERVICE_KEY` - Service role key

## Architecture

### Judge Engine Pipeline (Critical Path)

The AI verdict system (`server/src/lib/judgeEngine.js`) runs a **5-step sequential chain**:

1. **Safety Guardrail** - OpenAI Moderation API filters harmful content
2. **Memory Retrieval (RAG)** - Fetches historical patterns from pgvector
3. **Analytical Phase** - DeepSeek V3.2 performs psychological analysis (JSON schema mode)
4. **Verdict Generation** - User-selectable judge model with persona injection:
   - `best`: Claude Opus 4.5 (Judge Whiskers - empathic)
   - `fast`: DeepSeek V3.2 (The Fast Judge)
   - `logical`: Kimi K2 Thinking (Judge Mittens - methodical)
5. **Background Extraction** - Stenographer agent extracts behavioral patterns for future cases

**Key Files:**
- `server/src/lib/prompts.js` - Psychological framework (DO NOT modify without understanding)
- `server/src/lib/jsonSchemas.js` - Structured output schemas
- `server/src/lib/repairAttempts.js` - Gottman repair exercises

**Critical:** Verdicts must avoid blame percentages, trivializing emotions, or declaring winners. The psychological framework is carefully designed.

### Hybrid Memory System (RAG)

See `server/MEMORY_SYSTEM.md` for full documentation.

**Two-tier approach:**
1. **Static Profiles (JSONB)** - Attachment style, love languages, conflict style
2. **Episodic Memories (pgvector)** - AI-extracted behavioral patterns with embeddings

**Flow:**
- `stenographer.js` - Background extraction after verdicts using GPT-4o-mini
- `memoryRetrieval.js` - RAG pipeline before verdict generation (top-4 similar memories)
- `embeddings.js` - OpenAI text-embedding-3-small for vector generation

### Client State Architecture

**Two Zustand stores with persist middleware:**

```javascript
// useAuthStore.js - Supabase auth, partner connection, onboarding
const { user, profile, partner, hasPartner, signIn, acceptRequest } = useAuthStore();

// useAppStore.js - Case history, appreciations, kibble economy
const { caseHistory, fetchCaseHistory, currentUser } = useAppStore();

// courtStore.js - Court sessions only (real-time coordination)
const { courtSession, activeCase, generateVerdict, submitSide } = useCourtStore();
```

**Case Status Flow:** `DRAFT → LOCKED_A → DELIBERATING → RESOLVED`

**IMPORTANT:** Always use `profile?.display_name` or `partner?.display_name`, never "User A/B" pattern in UI code.

### Data Isolation & Security

All couple-specific data is isolated via Supabase Row Level Security (RLS):
- `get_my_partner_id()` function enables secure couple-scoped policies
- Cases/Appreciations/Calendar are filtered by `user_a_id`/`user_b_id`
- Backend endpoints accept `userAId` and `userBId` query params

**Anniversary Date:** Set when accepting partner request (immutable via DB trigger). Stored on both profiles.

### Partner Connection Flow

1. User A shares `partner_code` from profile
2. User B enters code in Connect Partner page
3. User A sees `PartnerRequestModal` to accept/decline
4. User A enters **anniversary date** (immutable) and accepts
5. Both profiles updated with `partner_id` and `anniversary_date`
6. Calendar event created for anniversary (yearly recurring)

## Database Schema

All data stored in Supabase PostgreSQL with RLS. Key migrations:
- `001_initial_schema.sql` - Core tables and RLS
- `002_fix_rls_recursion.sql` - `get_my_partner_id()` function
- `003_add_anniversary_and_couple_isolation.sql` - Anniversary + couple RLS
- `005_daily_questions_and_full_schema.sql` - Daily questions system
- `006_add_vector_memory_support.sql` - pgvector for AI memory
- `016_subscription_and_usage.sql` - RevenueCat integration

**Key Tables:**
- `profiles` - User profiles with partner relationships
- `cases` - Dispute cases (couple-scoped)
- `appreciations` - Positive affirmations (couple-scoped)
- `user_memories` - pgvector embeddings for behavioral patterns
- `calendar_events` - Shared couple calendar
- `daily_questions` - Daily check-in prompts
- `usage_tracking` - Feature usage limits (free/premium)

## API Structure

**Backend Routes (`server/src/routes/`):**
- `/api/judge/deliberate` - Main verdict endpoint (POST)
- `/api/memory/*` - Profile and memory management
- `/api/court-sessions/*` - Real-time session coordination (WebSocket support)
- `/api/cases?userAId=&userBId=` - Case history filtered by couple
- `/api/appreciations/:userId` - Appreciations received by user
- `/api/daily-questions/*` - Daily check-in questions
- `/api/usage/*` - Usage tracking and limits
- `/api/webhooks/revenuecat` - RevenueCat subscription webhooks

**Frontend Services (`client/src/services/`):**
- `api.js` - Axios wrapper with auth interceptor
- `supabase.js` - Supabase client
- `revenuecat.js` - RevenueCat SDK wrapper (iOS/Android)

## Styling System

Tailwind CSS with court-themed palette (`client/tailwind.config.js`):
- **Primary Colors:** `court-gold`, `court-goldLight`, `court-goldDark`
- **Warm Browns:** `court-brown`, `court-brownLight`, `court-brownDark`
- **Neutrals:** `court-cream`, `court-tan`, `court-ivory`
- **Accents:** `court-maroon`, `court-maroonLight`
- **Legacy:** `blush`, `lavender`, `cream`, `mint`, `peach` (still supported)

**Utility Classes:**
- `glass-card` - Frosted glass effect
- `text-gradient` - Gradient text
- `btn-primary` - Primary button style
- `shadow-soft`, `shadow-soft-md`, `shadow-soft-lg` - Soft shadows

## Component Patterns

- **Framer Motion Transitions** - All pages use layout animations (see `MainLayout.jsx`)
- **Modal z-index** - Use `z-[60]` to appear above bottom dock (`z-40`), add `pb-20` for safe area
- **RequirePartner.jsx** - Wrapper that blocks access until partner connected
- **Mobile-first** - Use `dvh` units, safe area padding (`safe-top`, `safe-bottom`)
- **Touch-optimized** - Use `whileTap` animations for buttons

## Testing

**Client Tests (`client/src/test/`):**
- Vitest + React Testing Library
- `setup.js` - Global test configuration
- `courtroom.test.js` - Example test file

**Server Tests (`server/src/lib/`):**
- Vitest for unit tests
- `judgeEngine.test.js` - Judge pipeline tests
- `memory.test.js` - Memory system tests

## Mobile Deployment

The app uses Capacitor for iOS/Android deployment:
- `client/capacitor.config.json` - Capacitor configuration
- `client/ios/` - Xcode project
- `client/android/` - Android Studio project

**Key Integrations:**
- `@capacitor/splash-screen` - Native splash screen
- `@capacitor/status-bar` - Status bar styling
- `@revenuecat/purchases-capacitor` - Subscription management

## Code Conventions

- **Never use "User A/B" pattern** in UI code - always use display names
- **No inline console.logs in production code** - use conditional DEBUG_LOGS flag
- **Always check partner connection** before accessing couple-scoped features
- **Use Supabase RLS** - never bypass security policies in queries
- **Validate with Zod** - use schemas from `server/src/lib/schemas.js`
- **Handle WebSocket disconnects** - court sessions must gracefully recover
- **Test memory changes** - stenographer impacts future verdicts

## Important Files to Review Before Changes

- `server/src/lib/prompts.js` - Psychological framework (affects verdict quality)
- `client/src/store/useAuthStore.js` - Auth flow and partner connection
- `supabase/migrations/*.sql` - Database schema and RLS policies
- `server/MEMORY_SYSTEM.md` - Memory system documentation
- `.github/copilot-instructions.md` - Additional development context
