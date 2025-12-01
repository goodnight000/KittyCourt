# Cat Judge (Kitty Court) - AI Coding Instructions

## Architecture Overview

Couples dispute resolution app with AI "Judge Mittens" persona. Monorepo structure:

- **`client/`** - React 19 + Vite SPA (mobile-first PWA)
- **`server/`** - Express 5 API with Judge Engine pipeline
- **`supabase/`** - Production database schema (auth + profiles + pgvector)

**Core Flow**: Partners connect via partner codes → submit disputes asynchronously → Judge Mittens delivers psychologically-grounded verdicts using Gottman Method + NVC principles.

## Development Commands

```bash
npm run dev              # Both client + server concurrently
cd client && npm test    # Vitest + React Testing Library
```

**Environment**: Server requires `.env` with `OPENROUTER_API_KEY`, `OPENAI_API_KEY` (embeddings), `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`.

## Judge Engine Pipeline (Critical Path)

The AI verdict system in `server/src/lib/judgeEngine.js` runs a **3-step sequential chain**:

1. **Safety Guardrail** - OpenAI Moderation API filters harmful content
2. **Analytical Phase** - Kimi K2 (via OpenRouter) performs clinical psychological analysis using JSON schema mode
3. **Verdict Generation** - Same model with Judge Mittens persona injection

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
// useAuthStore.js - Supabase auth, partner connection, onboarding
const { user, profile, partner, hasPartner, signIn, connectPartner } = useAuthStore();

// useAppStore.js - Court sessions, cases, verdicts, kibble economy
const { courtSession, activeCase, generateVerdict, submitSide } = useAppStore();
```

**Case status flow**: `DRAFT → LOCKED_A → DELIBERATING → RESOLVED`

## Database: Supabase (Production) vs Prisma (Local)

- **Production**: `supabase/migrations/001_initial_schema.sql` - uses `auth.users` + `profiles` table with partner codes
- **Local dev**: `server/prisma/schema.prisma` (SQLite) - simplified, no auth

Partner connection uses 12-char `partner_code` on profiles table with request/accept flow.

## Styling System

Tailwind CSS with court-themed palette in `tailwind.config.js`:
- Primary: `court-gold`, `court-brown`, `court-cream`, `court-maroon`
- Legacy: `blush`, `lavender`, `cream`, `mint`, `peach`
- Key classes: `glass-card`, `text-gradient`, `btn-primary`, `shadow-soft`

```jsx
<GlassCard variant="gradient" accent="pink">...</GlassCard>  // Component
<div className="glass-card p-4">...</div>                     // Utility class
```

## Component Patterns

- All pages use Framer Motion for transitions (see `MainLayout.jsx`)
- Modals: `z-[60]` to appear above bottom dock (`z-40`), add `pb-20` for safe area
- `GlassCard.jsx` - variants: `default`, `gradient`, `elevated`, `glow`, `pastel`
- `RequirePartner.jsx` - HOC that blocks access until partner connected

## API Structure

- `/api/judge/deliberate` - Main verdict endpoint (POST)
- `/api/memory/*` - Profile and memory management
- `/api/court-sessions/*` - Real-time session coordination
- `/api/users`, `/api/cases` - CRUD operations

## Testing

Test cases for AI verdicts in `test-cases.json` (root). Client tests:
```javascript
beforeEach(() => {
    useAppStore.setState({ /* reset state */ });
});
```

## Mobile-First Considerations

- `dvh` units for viewport, safe area padding (`safe-top`, `safe-bottom`)
- Touch-optimized with `whileTap` animations
- Bottom nav constrained to `max-w-lg` and centered
