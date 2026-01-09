# I18n Follow-up Fixes Plan (Senior Review)

## Skills to Use
- react-state-management (Zustand/default language wiring in client store)
- debugging-strategies (systematic validation of edge cases, fallbacks, and Accept-Language parsing)

## Context / Goal
We already have Simplified Chinese wired in. This plan addresses review findings to make language switching bug-free, edge-case safe, and scalable to 8+ additional languages. The end state should allow adding a new language by:
1) Adding a locale JSON file in `client/src/i18n/locales/`
2) Adding a supported entry (with aliases) in the shared language config
3) (Optional) Adding any server-side fallback copy if needed

## Required Changes

### 1) Fix shared language config import for Vite (dev + build)
Problem: `client/src/i18n/index.js` imports `../../../i18n.languages.json`, which is outside the Vite root and can break dev server.

Pick ONE approach and apply consistently (preferred: Option A).

**Option A (preferred): Keep shared config at repo root and allow it in Vite dev server**
- Update `client/vite.config.js` to add `server.fs.allow` with the repo root path so dev server can serve the JSON.
- Import Node `path` and compute the repo root path.

**Option B: Move shared config under a shared folder inside the repo root, and update both client + server paths**
- Move `i18n.languages.json` to `shared/i18n.languages.json` (or similar).
- Update `client/src/i18n/index.js` import path.
- Update `server/src/lib/language.js` path to the new location.
- If you do this, update any README or reference docs that mention the config file.

Deliverable: Vite dev server loads language config without errors.

### 2) Add locale aliasing + base locale fallback (scalable to new languages)
Goal: Browser locales like `zh-CN` or `zh` resolve to `zh-Hans` automatically.

Changes:
- Extend `i18n.languages.json` entries to include an `aliases` array per language.
- Add aliases now for Simplified Chinese (`zh`, `zh-CN`, `zh-SG`) and English (`en-US`, `en-GB`).
- Update language normalization on both client and server to:
  - Match canonical codes case-insensitively
  - Match aliases case-insensitively
  - If still no match, try a base language fallback (e.g. `pt-BR` -> `pt`) against both codes and aliases

Files:
- `i18n.languages.json`
- `client/src/i18n/index.js`
- `server/src/lib/language.js`

Deliverable: `normalizeLanguage('zh-CN')` resolves to `zh-Hans` on both client and server.

### 3) Prefer user profile language over Accept-Language (except first-time)
Problem: `resolveRequestLanguage` currently prefers the header over profile language. This can ignore a user’s in-app selection if the browser header differs.

Approach:
- Update `resolveRequestLanguage` (or `resolveLanguageFromHeader`) to prefer profile language when it is set.
- Keep Accept-Language as a fallback when profile language is missing.

Important note: to make Accept-Language work for first-time users, we need a way to detect “language not set yet.” Pick ONE:

**Option A (lighter change):**
- When creating a profile (client or server), set `preferred_language` using normalized `navigator.language` (client) or request header (server) only if the profile is new.
- This makes the first-time experience match the user’s locale without changing the precedence rules later.

**Option B (more robust):**
- Add a new column like `preferred_language_source` or `language_set_by_user` so we can distinguish auto-set vs user-set.
- Only override header when `language_set_by_user` is true.

Deliverable: after a user explicitly changes language in-app, server endpoints that use `resolveRequestLanguage` honor that preference.

### 4) Remove hardcoded default language in client auth store
Problem: `client/src/store/useAuthStore.js` hardcodes `DEFAULT_LANGUAGE = 'en'`, which will be wrong if we change the default in config.

Plan:
- Create a small shared client module (e.g. `client/src/i18n/languageConfig.js`) that reads `i18n.languages.json` and exports `DEFAULT_LANGUAGE` and `SUPPORTED_LANGUAGES`.
- Update `client/src/i18n/index.js` and `client/src/store/useAuthStore.js` to import from that module (avoid circular imports with `useI18n`).

Deliverable: client default language comes from config, not from hardcoded string.

### 5) Fix untranslated validation errors in Profiles
Problem: `ProfilesPage` uses `validation.error` (English) directly.

Plan:
- Mirror the `translateValidationError` logic used in `OnboardingPage`.
- Use `validation.errorCode` when available (`t('validation.<code>')`).
- Fall back to `validation.error` if there is no code.

File:
- `client/src/pages/ProfilesPage.jsx`

Deliverable: birthday errors are localized when switching languages.

### 6) Localize leftover hardcoded UI strings in Appreciations
Problem: `AppreciationsPage` still contains hardcoded English strings and relative time labels.

Plan:
- Add translation keys for:
  - “Just now”, “Today”, “Yesterday”, and “X minutes/hours/days ago” labels
  - Page header / empty state / helper text
- Replace hardcoded strings with `t()` calls.
- Use a formatter helper if this logic appears elsewhere.

Files:
- `client/src/pages/AppreciationsPage.jsx`
- `client/src/i18n/locales/en.json`
- `client/src/i18n/locales/zh-Hans.json`

Deliverable: page fully switches language with no English leftovers.

### 7) Add tests for language normalization and header parsing
Add targeted Vitest coverage to lock in behavior:

Client:
- `client/src/test/i18n.test.js`
  - `normalizeLanguage('zh-CN') -> 'zh-Hans'`
  - `normalizeLanguage('EN-us') -> 'en'`
  - unknown locale falls back to default

Server:
- `server/src/lib/language.test.js`
  - `resolveLanguageFromHeader('zh-CN, en;q=0.9')` resolves to `zh-Hans`
  - profile language wins when set (if you implement profile-first)

Deliverable: tests pass and guard against regressions for future languages.

## Acceptance Criteria
- Dev server runs without Vite fs errors for language config.
- User-selected language always overrides browser locale for server outputs.
- New locale additions only require JSON entry + translation file.
- No untranslated validation errors or hardcoded labels in pages touched above.
- Tests cover alias mapping and profile vs header precedence.

## Notes on Future Language Additions
When adding a new language:
1) Add `client/src/i18n/locales/<code>.json`.
2) Add a supported entry (with `aliases`) in `i18n.languages.json`.
3) If the language has script variants, include aliases (e.g. `zh-Hant` for Traditional Chinese).
4) Run tests.

