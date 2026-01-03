# I18n Follow-up Fixes v2 Review

## Overview
This update introduces a language-first onboarding step, tightens language normalization across client/server, and adds edge-case coverage for invalid profile values. It also ensures that the language selected during onboarding becomes the profile’s `preferred_language`.

## Key Changes and Reasoning

### 1) Language-first onboarding step
- **Why**: Language selection must be the first onboarding action so the UI immediately reflects the user’s preference.
- **What**:
  - Added a new `language` step at the start of `ONBOARDING_STEPS`.
  - Renders the supported languages from shared config (`useI18n().supportedLanguages`) with a selected state and native label.
  - Selection updates both onboarding state and the global store via `setPreferredLanguage`.
  - Auto-skips when only one language exists.
  - Preselects `navigator.language` for a seamless first render but still requires explicit confirmation.
- **Files**: `client/src/pages/OnboardingPage.jsx`, `i18n.languages.json`, `client/src/i18n/locales/en.json`, `client/src/i18n/locales/zh-Hans.json`

### 2) Profile creation uses onboarding-selected language
- **Why**: The onboarding choice should be persisted on first profile creation.
- **What**: Updated all profile-creation branches to prefer the current store language, falling back to browser locale if unset.
- **Files**: `client/src/store/useAuthStore.js`

### 3) Normalize profile language for settings UI
- **Why**: Legacy values like `zh-CN` can break the language dropdown.
- **What**: Normalized the profile’s stored language before seeding profile form state.
- **Files**: `client/src/pages/ProfilesPage.jsx`

### 4) Server precedence edge case (invalid stored language)
- **Why**: Invalid profile values should not override a valid header.
- **What**: `getUserPreferredLanguage` now uses `matchLanguage` so invalid values return null and header wins.
- **Files**: `server/src/lib/language.js`

### 5) Language config enhancements
- **Why**: UI needs a native label for intuitive selection before translation switches.
- **What**: Added `nativeLabel` to each language entry in `i18n.languages.json`.
- **Files**: `i18n.languages.json`, `client/src/i18n/languageConfig.js`

### 6) Tests
- **Why**: Lock alias matching and invalid-value fallbacks for future language additions.
- **What**:
  - Client: `matchLanguage` returns null for invalid values; `normalizeLanguage` still falls back to default.
  - Server: invalid profile language falls back to header resolution.
- **Files**: `client/src/test/i18n.test.js`, `server/src/lib/language.test.js`

## Files Added
- `review/i18n_followup_fixes_v2_review.md`

## Files Updated
- `client/src/pages/OnboardingPage.jsx`
- `client/src/store/useAuthStore.js`
- `client/src/pages/ProfilesPage.jsx`
- `client/src/i18n/languageConfig.js`
- `client/src/i18n/locales/en.json`
- `client/src/i18n/locales/zh-Hans.json`
- `client/src/test/i18n.test.js`
- `server/src/lib/language.js`
- `server/src/lib/language.test.js`
- `i18n.languages.json`

## Tests
- Not run (not requested).
