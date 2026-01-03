# I18n Follow-up Fixes Review

## Overview
This review documents the follow-up fixes requested in `instructions/i18n_followup_fixes.md`. The work focuses on scalable language normalization, profile-vs-header precedence, removal of hardcoded defaults, and full i18n coverage in Appreciations. It also adds tests to lock the behavior.

## Reasoning and Implementation Notes

### 1) Vite dev server access to shared config
- **Why**: `client/src/i18n/index.js` imports `i18n.languages.json` from repo root; Vite blocks paths outside the project root by default.
- **What**: Added `server.fs.allow` in `client/vite.config.js` to include the repo root. This keeps the config in a single source of truth while preserving a clean client import path.
- **Impact**: Dev server can load the shared JSON without fs errors.

### 2) Alias + base locale normalization on client/server
- **Why**: Browser locales like `zh-CN` should resolve to `zh-Hans` and should not break on casing or region codes.
- **What**:
  - Added `aliases` arrays to each language entry in `i18n.languages.json`.
  - Built canonical+alias lookup maps in both client and server.
  - Added base-locale fallback (e.g., `pt-BR` → `pt`) after direct/alias resolution.
- **Impact**: `normalizeLanguage('zh-CN')` consistently resolves to `zh-Hans` on both client and server.

### 3) Prefer profile language over Accept-Language
- **Why**: A user’s in-app preference must win over browser headers to prevent unexpected language switching.
- **What**:
  - Updated `resolveLanguageFromHeader` to check profile language first.
  - Kept header as fallback when profile language is unset.
  - Set `preferred_language` when profiles are created using `navigator.language` (client).
- **Impact**: After a user changes language in-app, server outputs respect that choice.

### 4) Remove hardcoded default language in auth store
- **Why**: `DEFAULT_LANGUAGE = 'en'` would be incorrect if the shared config default changes.
- **What**:
  - Introduced `client/src/i18n/languageConfig.js` for shared client constants + normalization.
  - Updated `client/src/store/useAuthStore.js` to import `DEFAULT_LANGUAGE` + normalization utilities.
- **Impact**: Client default language now always follows the shared config.

### 5) Localize validation errors in Profiles
- **Why**: `ProfilesPage` displayed raw English validation errors.
- **What**: Mirrored the `translateValidationError` helper from `OnboardingPage`, using `validation.errorCode` with `t('validation.<code>')` and falling back to `validation.error`.
- **Impact**: Birthday validation errors localize correctly.

### 6) Fully localize Appreciations UI
- **Why**: Remaining English strings and relative time labels were hardcoded.
- **What**:
  - Added i18n keys for headers, empty state, relative time labels, and kibble badge.
  - Replaced literals with `t()` calls.
  - Kept locale-aware `toLocaleDateString` for date formatting.
- **Impact**: The page switches cleanly between languages without English leftovers.

### 7) Tests for normalization + precedence
- **Why**: Prevent regressions when adding new languages or changing normalization logic.
- **What**:
  - Client tests in `client/src/test/i18n.test.js`.
  - Server tests in `server/src/lib/language.test.js`.
- **Impact**: Alias mapping and profile-vs-header precedence are locked in.

## Files Added
- `client/src/i18n/languageConfig.js`
- `client/src/test/i18n.test.js`
- `server/src/lib/language.test.js`
- `review/i18n_followup_fixes_review.md`

## Files Updated
- `i18n.languages.json`
- `client/vite.config.js`
- `client/src/i18n/index.js`
- `client/src/store/useAuthStore.js`
- `client/src/pages/ProfilesPage.jsx`
- `client/src/pages/AppreciationsPage.jsx`
- `client/src/i18n/locales/en.json`
- `client/src/i18n/locales/zh-Hans.json`
- `server/src/lib/language.js`

## Tests
- Not run (not requested).
