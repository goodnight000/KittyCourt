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
- Language config is centralized in `i18n.languages.json` and consumed by client/server. Client helpers live in `client/src/i18n/languageConfig.js`; server helpers live in `server/src/lib/language.js` (profile-first, header fallback).

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

## Language System + Adding New Content

- Shared config: `i18n.languages.json` defines `default`, `supported[]` (`code`, `labelKey`, `nativeLabel`, `aliases`). Add aliases for region codes (e.g. `pt-BR`) to keep normalization consistent.
- Client i18n:
  - Locale files: `client/src/i18n/locales/<code>.json`.
  - Config + normalization: `client/src/i18n/languageConfig.js` (use `matchLanguage` for strict matching, `normalizeLanguage` for fallback-to-default).
  - Use `useI18n().t()` in UI; use `translate()` in non-hook helpers (`client/src/utils/helpers.js`).
  - Onboarding: language selection is the first step; selection immediately updates the UI and persists to onboarding data.
- Server i18n:
  - Use `resolveRequestLanguage` from `server/src/lib/language.js` (profile preferred language wins; header is fallback).
  - For prompts/LLM output, use `normalizeLanguage` + `getLanguageLabel`.
- Adding new localized content:
  1) Add the language entry to `i18n.languages.json` (include `nativeLabel` and `aliases`).
  2) Add `client/src/i18n/locales/<code>.json`.
  3) Seed DB translations (`question_bank_translations`, `challenges_translations`) for new languages.
  4) If server fallback copy exists (e.g. event planner), add the language there.
  5) For new UI strings, add keys to locale JSON and replace literals with `t()` calls.
  6) For new server/user-visible strings, pass `resolveRequestLanguage` through the API path and localize as needed.

## Security & Configuration Tips

- Never commit secrets. Use `server/.env.example` as a template; client reads `VITE_*` variables.
- Common env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `CORS_ORIGIN`.

## Commit & Pull Request Guidelines

- Commit history is inconsistent (many placeholder one-letter messages). For new work, use short, imperative summaries (optionally `feat:`, `fix:`, `chore:`), e.g. `fix: sync court session status`.
- PRs: include a clear description, linked issue (if any), and screenshots for UI changes. Call out any Supabase migration changes and the commands you ran (lint/tests).
