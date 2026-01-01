# Localization Implementation Plan (Pause)

## Summary
Add multi-language support with Chinese first (assume zh-Hans), built to scale to 8+ additional languages. Case content language is fixed at creation based on the creator's language. UI language can change per user without retro-translating old case content.

## Key Decisions (Locked)
- Case language fixed at creation (creator's current language).
- Database translations use translation tables (not per-language columns).
- Old case content remains in original language; UI chrome localizes.

## Assumptions to Confirm
- Chinese locale: zh-Hans (Simplified). Optional zh-Hant later.
- Language storage: `profiles.preferred_language` is the single source of truth.

---

## 1) Data Model & Migrations (Supabase)

### 1.1 Add language fields
- Add `preferred_language` to profiles.
  - New migration altering `profiles`
  - Default: `en`
- Add `case_language` to cases (and/or court sessions as needed).
  - New migration altering `cases`
  - Default: `en`
- Add `language` to user_memories to allow language-specific retrieval.
  - New migration altering `user_memories`
  - Default: `en`

### 1.2 Translation tables
Create translation tables with `(entity_id, language)` primary key and fallback to `en`.

- Daily questions
  - Base table: `question_bank`
  - New: `question_bank_translations`
  - Columns: `question_id`, `language`, `question`, `emoji`, `category`
- Challenges
  - Base table: `challenges`
  - New: `challenges_translations`
  - Columns: `challenge_id`, `language`, `name`, `description`

### 1.3 Update RPC for daily questions
- `get_todays_question` should accept language parameter:
  - `get_todays_question(p_user_id UUID, p_partner_id UUID, p_language TEXT)`
- Join translation table by language with fallback to `en`.

---

## 2) Server Changes

### 2.1 Language resolution
- Add a helper to resolve request language:
  - Prefer `Accept-Language` if present (exact match to supported languages).
  - Otherwise use user profile `preferred_language`.
  - Fallback to `en`.

### 2.2 Daily questions localization
- File: `server/src/routes/dailyQuestions.js`
  - Pass language into RPC call.
  - Use translation fallback if RPC returns null.

### 2.3 Challenges localization
- File: `server/src/lib/challengeService.js`
  - Join `challenges_translations` by language with fallback to `en`.

### 2.4 Case language + LLM pipeline
- Store `case_language` at case creation.
  - File: `server/src/routes/cases.js` or `server/src/routes/court.js`
- Pass language into judge engine.
  - File: `server/src/lib/court/verdictGenerator.js`
  - File: `server/src/lib/judgeEngine.js`
- Update prompts to include explicit output language:
  - File: `server/src/lib/prompts.js`
  - Add an injected block: "Respond in <language> for all narrative fields."
  - Keep all enum fields in English (`assessedIntensity`, `identifiedDynamic`, horsemen, etc).

### 2.5 Memory extraction language
- File: `server/src/lib/stenographer.js`
  - Add `userALanguage` and `userBLanguage`.
  - Single LLM call can output per-user text in different languages.
  - Save memory `language` per user.
- File: `server/src/lib/supabase.js`
  - Update memory insert to include `language`.
- File: `server/src/lib/memoryRetrieval.js`
  - Filter by language; fallback to `en` if no same-language memories.

### 2.6 Error codes for localization
- Add stable error codes in server responses:
  - File: `server/src/routes/*.js`
  - Example: `{ errorCode: "NO_PARTNER", error: "No partner connected" }`
- Client will map `errorCode` to `t('errors.NO_PARTNER')`.

---

## 3) Client Changes

### 3.1 i18n infrastructure
- Add i18n setup:
  - File: `client/src/i18n/index.js`
- Load translations from JSON files:
  - `client/src/i18n/locales/en.json`
  - `client/src/i18n/locales/zh-Hans.json`

### 3.2 Language state
- Store `preferred_language` in auth/profile store.
  - File: `client/src/store/useAuthStore.js`
- Add a language selector in profile/settings:
  - File: `client/src/pages/ProfilesPage.jsx`
- Update `document.documentElement.lang` on language change.

### 3.3 Replace UI copy with i18n keys
High priority screens/components:
- `client/src/pages/OnboardingPage.jsx`
- `client/src/pages/DailyMeowPage.jsx`
- `client/src/pages/DailyMeowHistoryPage.jsx`
- `client/src/pages/CalendarPage.jsx`
- `client/src/layouts/MainLayout.jsx`
- `client/src/components/court/VerdictView.jsx`
- `client/src/components/court/ResolutionSelectPage.jsx`
- `client/src/pages/ChallengesPage.jsx`

### 3.4 Option lists (stable IDs)
Replace inline labels with translation keys:
- Love language, communication style, conflict style
- Mood options
- Calendar day/month names
- Tab labels

### 3.5 Locale-aware date formatting
- File: `client/src/pages/CalendarPage.jsx`
  - Replace static `DAYS`/`MONTHS` arrays with `Intl.DateTimeFormat`.

### 3.6 Fonts for CJK
- File: `client/src/index.css`
  - Add CJK-friendly fallback (`Noto Sans SC` or system CJK).
  - Ensure no layout break for longer strings.

### 3.7 API language header
- File: `client/src/services/api.js`
  - Send `Accept-Language` with every request (from user setting).

---

## 4) Translation Content

### 4.1 Seed EN + ZH for DB content
- Add migration to insert zh-Hans rows into:
  - `question_bank_translations`
  - `challenges_translations`
- Backfill English into translation tables so fallback is consistent.

### 4.2 UI translation files
- Build structured keys:
  - `nav.home`, `nav.court`, `errors.NO_PARTNER`, `onboarding.title`, etc.

---

## 5) Rollout / Backward Compatibility

- Default language is `en`.
- If translation missing, fallback to `en` (both UI and DB).
- Old cases remain in original language; only UI changes.

---

## 6) QA Checklist

- Switch language: UI updates instantly.
- Create case in English, switch to Chinese: UI in Chinese, case content still English.
- Daily question shows Chinese question when language is Chinese.
- Challenges show Chinese name/description.
- Court verdict content returns in correct language.
- Error messages are localized via error codes.

---

## Files Likely Touched (Non-Exhaustive)
- `client/src/i18n/index.js`
- `client/src/i18n/locales/en.json`
- `client/src/i18n/locales/zh-Hans.json`
- `client/src/services/api.js`
- `client/src/store/useAuthStore.js`
- `client/src/pages/ProfilesPage.jsx`
- `client/src/pages/OnboardingPage.jsx`
- `client/src/pages/CalendarPage.jsx`
- `client/src/pages/DailyMeowPage.jsx`
- `client/src/pages/DailyMeowHistoryPage.jsx`
- `client/src/pages/ChallengesPage.jsx`
- `client/src/components/court/ResolutionSelectPage.jsx`
- `client/src/components/court/VerdictView.jsx`
- `server/src/routes/dailyQuestions.js`
- `server/src/lib/challengeService.js`
- `server/src/lib/judgeEngine.js`
- `server/src/lib/prompts.js`
- `server/src/lib/stenographer.js`
- `server/src/lib/memoryRetrieval.js`
- `server/src/lib/supabase.js`
- `supabase/migrations/*.sql`
