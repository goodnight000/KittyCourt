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

## Frontend Optimization Log (2026-02-19)

### Scope
- Target: all frontend files in `client/src/**` + `client/tailwind.config.js` + `client/src/index.css` + `client/src/App.css`
- Skills in use: `fixing-motion-performance`, `react-native-architecture`, `vercel-react-best-practices`, `vercel-react-native-skills`

### Status
- Inventory: complete
- Audit: complete
- Fixes: in progress (wave 1 applied)
- Verification: partial (client build + targeted tests passed; lint has pre-existing baseline errors)

### Agent Updates (Concise)
- [coordinator] Initialized universal memory log and audit scope.
- [agent-05] audited 8 files | issues: H0/M2/L1 | top: heavy animated blur layers | rec: limit blur + add reduced-motion
- [agent-04] audited 8 files | issues: H0/M3/L1 | top: animation-heavy modals | rec: limit blur + honor reduced-motion
- [agent-12] audited 7 files | issues: H0/M2/L2 | top: background blur + looping motion overload | rec: gate heavy animation with prefers-reduced-motion + flatten blur layers
- [agent-13] audited 7 files | issues: H2/M2/L1 | top: blur-heavy layers + list re-renders | rec: trim filters/animations, memoize list slices + reduce motion requests
- [agent-14] audited 8 files | issues: H1/M3/L0 | top: blur-heavy progress + layout animation | rec: reduce blur paints + animate progress/expansion via transform and honor prefers-reduced-motion

- [agent-11] audited 7 files | issues: H0/M2/L2 | top: blur-heavy hero/modal motion | rec: tone down blur layers and limit transitions to transform/opacity
- [agent-08] audited 7 files | issues: H0/M2/L1 | top: floating-heart overlay + layout-heavy progress bar | rec: gate hearts + cat bounce via prefers-reduced-motion, memoize positions, and animate progress via scaleX/transform
- [agent-22] audited 7 files | issues: H0/M2/L1 | top: confetti + layered blur saturation | rec: gate motion (prefers-reduced-motion) & flatten blur paints
- [agent-23] audited 7 files | issues: H0/M3/L2 | top: looping decorative icons + unvirtualized history list | rec: gate heavy loops/blurs to prefers-reduced-motion and throttle history renders with virtualization/pagination
- [agent-23] audited 7 files | issues: H0/M3/L2 | top: looping decorative icons + unvirtualized history list | rec: gate heavy loops/blurs to prefers-reduced-motion and throttle history renders with virtualization/pagination

- [agent-24] audited 7 files | issues: H1/M1/L0 | top: court/daily-meow fullscreen blur loops + repeating motion | rec: gate heavy loops to prefers-reduced-motion and cap blur radius
### Consolidated Action Items
- Pending audit results.
- [coordinator] Created 24 non-overlapping frontend audit shards (174 files total, 7-8 files each).
- [agent-02] audited 8 files | issues: 0H/2M/1L | top: motion-heavy court/economy views | rec: gate anims to prefers-reduced-motion
- [agent-06] audited 8 files | issues: H1/M4/L0 | top: overlay blur panel | rec: reduce full-screen filters

- [agent-01] audited 8 files | issues: H3/M6/L0 | top: reduce blur-heavy overlays | rec: limit motion loops

- [agent-03] audited 8 files | issues: H1/M5/L0 | top: modal blur/backdrop cost | rec: clean ripple timers + memo
- [agent-10] audited 7 files | issues: H1/M3/L0 | top: full-screen looped overlays + layout animation | rec: gate heavy motion (prefers-reduced-motion) and animate via transform
- [agent-08] audited 7 files | issues: H0/M3/L1 | top: floating-heart overlay + layout-heavy progress exit waits | rec: memoize/reduce heart layers, animate progress via scaleX, drop wait-mode when possible

- [agent-09] audited 7 files | issues: H0/M3/L0 | top: settlement modal re-render + heavy blur | rec: subscribe to sliced court state + gate blurs/scroll updates

- [agent-07] audited 7 files | issues: H3/M3/L1 | top: blur-heavy overlays + cache jank | rec: cap filters + throttle cache writes
- [agent-15] audited 7 files | issues: H0/M2/L0 | top: looping confetti + waiting-indicator motion | rec: gate heavy loops to prefers-reduced-motion & trim simultaneous animations
- [agent-17] audited 7 files | issues: H0/M5/L1 | top: blur + motion-heavy cards & loaders | rec: cap expensive blurs/loops and offload avatar compression
- [agent-16] audited 7 files | issues: H3/M2/L0 | top: full-screen blur + looping paint-heavy layers | rec: cap blur filters, shrink animation budget, and honor prefers-reduced-motion
- [agent-18] audited 7 files | issues: H0/M2/L0 | top: animated blur+auto-height reveal | rec: gate blur/scale anims with prefers-reduced-motion and animate via transform instead of height
- [agent-19] audited 8 files | issues: H0/M3/L1 | top: blur + motion-heavy case/detail + paywall/glass filters | rec: cap repeated blur/looped anims, gate distortion filters, parallelize profile loader fetches
- [agent-21] audited 7 files | issues: H1/M2/L1 | top: infinite floating icons + modal blur | rec: gate loops to prefers-reduced-motion & flatten glass filters
- [agent-20] audited 7 files | issues: H1/M2/L0 | top: collapsed completed list animates height:auto | rec: swap to transform-based collapse and trim blur overlays

- [coordinator-fix] wave-1 applied | files: usePrefersReducedMotion + 13 frontend files | fixed: reduced-motion gating, width->scaleX bars, blur reductions, throttled cache reads, memoized history filters/grouping
- [coordinator-verify] client build passed | tests: onboarding LanguageStep/OnboardingStep passed | lint: fails due existing repo-wide baseline violations unrelated to this pass
- [wave2-taskA-impl] issue found | auth/layout surfaces used `backdrop-blur-xl` and several decorative infinite loops active by default on iOS-heavy routes
- [wave2-taskA-impl] fix applied | added/extended `usePrefersReducedMotion` gating in `MainLayout`, `SignInPage`, `SignUpPage`, `ForgotPasswordPage`; reduced blur intensity/scope; replaced sign-up requirement reveal from `height:auto` animation to opacity/transform
- [wave2-taskA-impl] recommendation | continue replacing remaining auth-adjacent non-essential loops with static reduced-motion fallbacks and keep glass layers at `backdrop-blur-md` or lower on mobile-critical screens
- [wave2-taskA-spec] status: pass | key: Motion-heavy auth surfaces now gate looping animations via `usePrefersReducedMotion` (MainLayout + auth pages) and blur wrappers are capped at `backdrop-blur-md` on auth screens | rec: continue auditing remaining auth flows for looping filters before closing Task A
- [wave2-taskA-verify] status: fail | `npm run build` (client) succeeds with existing baseline-browser mapping warning and chunk-size notes, but `npx eslint src/layouts/MainLayout.jsx ...` now blocks due to unused `motion` import plus unused `users`/`switchUser` and a missing dependency warning in `client/src/layouts/MainLayout.jsx:4-60` (severity: high, needs blocking fix)
- [wave2-taskA-verify] recommendation | drop or re-use the unused imports/state, update the dependency array (add `fetchState`/`fetchUsers` or move effect helpers), then re-run the focused lint/build commands so Task A verification can pass
- [wave2-taskA-verify] follow-up re-verify (2026-02-19) | pass | `npx eslint src/layouts/MainLayout.jsx src/pages/SignInPage.jsx src/pages/SignUpPage.jsx src/pages/ForgotPasswordPage.jsx` + `npm run build` both pass; remaining warnings: baseline-browser-mapping age, chunk-size/dynamic import notices in build (severity: low)
- [wave2-taskA-fix] status: pass | `MainLayout.jsx` lint blockers resolved (motion import aliased to `Motion`, unused `users`/`switchUser` removed, `useEffect` deps include `fetchState`/`fetchUsers`); `cd client && npx eslint src/layouts/MainLayout.jsx` passes with only existing baseline-browser-mapping notice
- [wave2-taskB-impl] issue found | court flow surfaces still had continuous decorative loops and paint-heavy blur stacks (including `blur(40px)` glass layers) across deliberation/priming/resolution/rating/settlement
- [wave2-taskB-impl] fix applied | added `usePrefersReducedMotion` gating to priming/resolution/rating/settlement, removed interval-driven pulse in deliberation (moved to transform-based animation), capped blur/backdrop intensities, and limited non-essential hover/scale flourishes while preserving submit/confirm interactions
- [wave2-taskB-impl] recommendation | continue auditing remaining court-adjacent overlays for high-radius backdrop filters and keep decorative motion opt-in via reduced-motion fallbacks on mobile-critical routes
- [wave2-taskB-spec] status: fail | DeliberatingScreen still runs quote/step cycling intervals regardless of `prefersReducedMotion`, so the non-essential looping state updates keep firing even when reduced motion is requested
- [wave2-taskB-spec] follow-up verify (2026-02-19) | pass | DeliberatingScreen intervals now gated on `prefersReducedMotion`, Task B spec satisfied
- [wave2-taskB-fix] status: pass | `DeliberatingScreen.jsx` now gates step/quote rotation intervals behind `!prefersReducedMotion`, eliminating decorative timer-driven state churn in reduced-motion mode while preserving loading/court flow semantics
- [wave2-taskB-verify] status: pass | `npx eslint src/components/court/DeliberatingScreen.jsx src/components/court/PrimingPage.jsx src/components/court/ResolutionSelectPage.jsx src/components/court/VerdictRating.jsx src/components/court/SettlementButton.jsx` + `npm run build` both succeed; remaining warnings include the stale `baseline-browser-mapping` notice, Vite reporter notes about mixed static/dynamic imports for `api.js` and `useCourtStore.js`, and the existing chunk-size alert
- [wave2-taskB-verify] status: pass | `npx eslint src/components/court/DeliberatingScreen.jsx src/components/court/PrimingPage.jsx src/components/court/ResolutionSelectPage.jsx src/components/court/VerdictRating.jsx src/components/court/SettlementButton.jsx` + `npm run build` both succeed; remaining warnings include the stale `baseline-browser-mapping` notice, Vite reporter notes about mixed static/dynamic imports for `api.js` and `useCourtStore.js`, and the existing chunk-size alert
- [wave2-taskC-impl] issue found | challenges/calendar surfaces still had `height:auto` collapse, infinite decorative icon pulsing, and heavier blur/glow layers on list-heavy screens
- [wave2-taskC-impl] fix applied | replaced completed-challenges reveal with transform/opacity animation, added reduced-motion gating for shimmer/modal decor, removed infinite emoji pulse loops, and applied `content-visibility`/containment helpers to challenge and calendar item surfaces
- [wave2-taskC-impl] recommendation | continue reducing repeated `EVENT_TYPES.find(...)` lookups in calendar surfaces by sharing a single type lookup map across calendar components
- [wave2-taskC-spec] status: pass | completed/active lists now use transform/opacity transitions gated by `usePrefersReducedMotion`, calendar cards respect new shared blur tokens/containment helpers, and perf-focused classes (`perf-content-auto*`) keep list rendering costs low
- [wave2-taskC-verify] status: pass | `npx eslint src/pages/ChallengesPage.jsx src/components/calendar/EventList.jsx src/components/calendar/EventDetailsModal.jsx` + `npm run build` both succeed; remaining warnings: baseline-browser-mapping age, Vite reporter mixed static/dynamic import notice for `api.js`/`useCourtStore.js`, and existing chunk-size warning
- [wave2-final-verify] status: pass | `cd client && npx eslint src/layouts/MainLayout.jsx src/pages/SignInPage.jsx src/pages/SignUpPage.jsx src/pages/ForgotPasswordPage.jsx src/components/court/DeliberatingScreen.jsx src/components/court/PrimingPage.jsx src/components/court/ResolutionSelectPage.jsx src/components/court/VerdictRating.jsx src/components/court/SettlementButton.jsx src/pages/ChallengesPage.jsx src/components/calendar/EventList.jsx src/components/calendar/EventDetailsModal.jsx` + `cd client && npm run build` both succeed; warnings: stale `baseline-browser-mapping`, Vite reporter notes about mixed static/dynamic imports for `api.js`/`useCourtStore.js`, and the existing chunk-size alert
- [wave3-impl] issue found | build still reported ineffective dynamic imports (`useAppStore -> useCourtStore`, `useCacheStore -> api`) plus oversized chunk and stale baseline-browser-mapping data warning
- [wave3-impl] fix applied | converted the two mixed dynamic imports to static imports, added conservative Vite `manualChunks` vendor grouping, and updated `baseline-browser-mapping` as a direct dev dependency
- [wave3-impl] result | `cd client && npx eslint src/store/useAppStore.js src/store/useCacheStore.js` passes clean and `cd client && npm run build` completes without dynamic-import, chunk-size, or baseline-browser-mapping warnings
- [wave3-impl] recommendation | keep new chunk groups stable and re-check bundle composition if large shared dependencies are added to prevent `vendor` chunk regressions
## [wave3-spec]
- [wave3-spec] status: pass | 2026-02-19 verification: dynamic imports now static, `manualChunks` vendor grouping validated, `baseline-browser-mapping` dev dependency pinned; scope stays limited to the targeted files.

## [wave3-verify]
- [wave3-verify] status: pass | `cd client && npx eslint src/store/useAppStore.js src/store/useCacheStore.js` + `cd client && npm run build` both succeed; build log has no dynamic-import reporter warnings, chunk-size alerts, or baseline-browser-mapping notices, confirming the regression fix remains stable.

## [wave4-impl]
- [wave4-impl] method | added `client/perf/wave4_ios_perf.py` Playwright profiler (WebKit + `iPhone 13`, headless) and executed via `with_server.py` against root `npm run dev` on port `5173`; outputs written to `client/perf/wave4_ios_perf_report.json` and `client/perf/wave4_ios_perf_report.md`
- [wave4-impl] startup result | `/signin` median timings: `domContentLoadedEventEnd=144.0ms`, `domComplete=244.0ms`, `loadEventEnd=245.0ms`, `first-contentful-paint=258.0ms` (`first-paint` unavailable in WebKit run); startup FPS median: `avgFps=60.0`, `p95FrameMs=18.0`, `droppedFrameRatio=0.0` (3 runs)
- [wave4-impl] transition result | auth route transition FPS (2 rounds): `/signin->/signup avgFpsMean=59.995`, `/signup->/signin avgFpsMean=60.079`, `/signin->/forgot-password avgFpsMean=58.429`, `/forgot-password->/signin avgFpsMean=60.045`; all transitions reached expected path (`reachRate=1.0`)
- [wave4-impl] recommendation | keep this script as CI-runnable baseline and flag regressions when startup `avgFps < 55`, transition `avgFps < 55`, or `droppedFrameRatio > 0.03`; if `/signin->/forgot-password` remains lowest edge, prioritize reducing non-essential paint/filter work on that path first

## [wave4-verify]
- [wave4-verify] status: blocked | `with_server.py` rerun explicitly targeted `--port 4173` because the standard 5173 dev host is already used in this environment, but the helper timed out waiting for readiness since the sandbox forbids `localhost` TCP connections (`socket.create_connection` raises `PermissionError`), so no new profiler run could start.
- [wave4-verify] follow-up | manual `python3 client/perf/wave4_ios_perf.py --base-url http://127.0.0.1:4173` still aborts before collecting metrics because Playwright WebKit fails to launch on this host (`Abort trap: 6` from `pw_run.sh`), so neither JSON nor MD outputs changed.
- [wave4-verify] coordinator rerun (2026-02-19) | pass | executed `python3 .codex/skills/webapp-testing/scripts/with_server.py --server "npm run dev" --port 5173 --timeout 180 -- python3 client/perf/wave4_ios_perf.py`; reports regenerated successfully with consistent results (`startup avgFps median=60.0`, transition edges ~`59.25-60.08` FPS, all expected paths reached)
