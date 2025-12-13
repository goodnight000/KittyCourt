# Repository Guidelines

## Project Structure & Module Organization

- `client/`: React 19 + Vite app (mobile-first) with Capacitor shells in `client/ios/` and `client/android/`.
  - UI: `client/src/components/`, screens: `client/src/pages/`, layouts: `client/src/layouts/`
  - State: `client/src/store/` (Zustand), API/Supabase: `client/src/services/`
  - Tests: `client/src/test/`
- `server/`: Express API + Socket.IO.
  - Entry: `server/src/app.js`
  - Routes: `server/src/routes/`, core logic: `server/src/lib/` (judge engine, memory, court session)
  - Tests: `server/src/**/*.test.js`
- `supabase/`: schema migrations in `supabase/migrations/*.sql`

## Architecture Overview

- AI verdict flow lives in `server/src/lib/judgeEngine.js` (guardrail → analysis → verdict). Keep changes in `server/src/lib/prompts.js` and `server/src/lib/jsonSchemas.js` in sync.
- Memory/RAG behavior is documented in `server/MEMORY_SYSTEM.md`; update/add Vitest coverage when changing extraction or retrieval.
- Client state lives in Zustand stores under `client/src/store/`; avoid reintroducing legacy "User A/B" UI patterns.

## Build, Test, and Development Commands

```bash
npm run install:all         # install root + client + server deps
npm run dev                 # run client + server concurrently
cd client && npm run dev    # Vite dev server
cd client && npm run lint   # ESLint (client only)
cd client && npm run test   # Vitest (jsdom)
cd server && npm run dev    # node --watch server/src/app.js
cd server && npm test       # Vitest (run once)
```

## Coding Style & Naming Conventions

- Match the surrounding file’s style.
- Client: ESM, 2-space indentation, no semicolons (see `client/eslint.config.js`). Components are `PascalCase.jsx`; hooks are `useThing.js`.
- Server: CommonJS (`require`), semicolons, and 4-space indentation (see `server/src/app.js`). Keep route handlers in `server/src/routes/` and shared logic in `server/src/lib/`.

## Testing Guidelines

- Use Vitest on both client and server.
- Client tests live in `client/src/test/` (setup: `client/src/test/setup.js`). Prefer `*.test.js` naming.
- Server tests live alongside the code they cover (e.g., `server/src/lib/judgeEngine.test.js`).

## Security & Configuration Tips

- Never commit secrets. Use `server/.env.example` as a template; client reads `VITE_*` variables.
- Common env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `CORS_ORIGIN`.

## Commit & Pull Request Guidelines

- Commit history is inconsistent (many placeholder one-letter messages). For new work, use short, imperative summaries (optionally `feat:`, `fix:`, `chore:`), e.g. `fix: sync court session status`.
- PRs: include a clear description, linked issue (if any), and screenshots for UI changes. Call out any Supabase migration changes and the commands you ran (lint/tests).
