# I18n Follow-up Fixes Plan v2 (Onboarding Language Step)

## Skills to Use
- react-state-management (Zustand flow for preferred language during onboarding)
- frontend-design (intuitive, seamless language selection UI)
- debugging-strategies (edge-case validation, profile vs header precedence)

## Context / Goal
We now require language selection as the **first step** of onboarding for new users. This is the first time preferred language is set. Users can still change language anytime in settings. This plan also fixes remaining edge cases around language normalization, legacy values, and server-side language selection so the system is scalable and bug-free for future languages.

## Required Changes

### 1) Add a new onboarding step: Language selection (first step)
**Goal:** The first screen a new user sees in onboarding is language selection. It should feel seamless and set UI language immediately.

Implementation notes:
- In `client/src/pages/OnboardingPage.jsx`, add a new step (e.g., `id: 'language'`) at the **beginning** of `ONBOARDING_STEPS`.
- The step should render a simple list/grid of available languages using `useI18n().supportedLanguages`.
- For each language option, show:
  - A label (use `labelKey` if provided, with `t(labelKey)`),
  - A native display if available (suggest adding `nativeLabel` to the language config to keep it intuitive even before any selection).
- When the user selects a language:
  - Call `setPreferredLanguage` from the auth store to update the global UI immediately.
  - Store selection in onboarding state (e.g., `updateOnboardingData({ preferredLanguage: code })`) so it persists through the flow.
- Add helper text like “You can change this later in settings” and a clear CTA (e.g., “Continue”).
- If only one supported language is configured, auto-skip the step to reduce friction.

Files:
- `client/src/pages/OnboardingPage.jsx`
- `client/src/i18n/locales/en.json`
- `client/src/i18n/locales/zh-Hans.json`
- `i18n.languages.json` (if adding `nativeLabel`)

### 2) Ensure profile creation uses onboarding-selected language
**Goal:** The language chosen in onboarding becomes the profile’s `preferred_language` on first creation.

Implementation notes:
- In `client/src/store/useAuthStore.js`, update profile creation logic (the branch where `upsertProfile` is called for a new profile) to prefer the current store `preferredLanguage` value over `navigator.language`.
- If `preferredLanguage` is unset, fall back to the current `getInitialLanguage()` behavior.
- Keep `setPreferredLanguage` behavior the same (no server update when user not authenticated).

Files:
- `client/src/store/useAuthStore.js`

### 3) Normalize profile language when populating the settings UI
**Goal:** Avoid invalid/legacy values (like `zh-CN`) breaking the language select UI.

Implementation notes:
- In `client/src/pages/ProfilesPage.jsx`, normalize `profile.preferred_language` before setting form state.
- Use `normalizeLanguage(profile?.preferred_language) || DEFAULT_LANGUAGE` when seeding `profileData`.

Files:
- `client/src/pages/ProfilesPage.jsx`

### 4) Fix server precedence edge case for invalid stored language
**Goal:** If profile has an invalid or unsupported language value, fall back to `Accept-Language` instead of forcing default.

Implementation notes:
- In `server/src/lib/language.js`, update `getUserPreferredLanguage` (or add a new helper) to use `matchLanguage` instead of `normalizeLanguage`.
  - `matchLanguage` returns `null` when no match, which allows `resolveLanguageFromHeader` to use header as fallback.
- Keep `resolveLanguageFromHeader` logic as “profile first, header second, default last.”

Files:
- `server/src/lib/language.js`
- `server/src/lib/language.test.js` (update/add a test for invalid profile language)

### 5) Add onboarding language strings
Add new translation keys for the language step:
- `onboarding.language.title`
- `onboarding.language.subtitle`
- `onboarding.language.helper`
- `onboarding.language.cta`

Files:
- `client/src/i18n/locales/en.json`
- `client/src/i18n/locales/zh-Hans.json`

### 6) Optional UX polish (recommended)
To make the step feel seamless:
- Preselect the language that matches `navigator.language` (via `normalizeLanguage`) but still require confirmation.
- Show a subtle “Selected” state and a single CTA to move forward.
- Switch the UI language immediately after selection.

## Tests
Add/adjust tests to lock behavior:

Client:
- Update or add to `client/src/test/i18n.test.js` to ensure `matchLanguage` returns null for invalid values and `normalizeLanguage` falls back to default.

Server:
- Update `server/src/lib/language.test.js` with a case where stored profile language is invalid and `Accept-Language` should win.

## Acceptance Criteria
- The first onboarding step is language selection.
- Selecting a language immediately changes UI language for the rest of onboarding.
- New profiles persist `preferred_language` from the onboarding selection.
- Invalid or legacy language values do not break settings UI or server resolution.
- Language additions remain low-effort: add locale file + config entry + optional native label.

