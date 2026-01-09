# I18n Follow-up Implementation Plan

## Context
The app already has a Simplified Chinese (zh-Hans) localization pass. During review, several gaps were found that can break language persistence after server restarts, keep some features English-only, and make future language additions harder than necessary.

This plan fixes those gaps and standardizes the language pipeline to make adding new languages easy.

## Goals
1. Preserve the case/session language across server recovery.
2. Localize Event Planner output using the LLM (and avoid English-only RAG).
3. Eliminate remaining hardcoded English strings in UI helpers and profile flow.
4. Centralize the language list/config so adding a new language is low-effort.

---

## A) Persist Language on Court Session Recovery

### Why
Court sessions are persisted in `court_sessions` and restored after server restart. Currently language fields are not stored or restored, so recovered sessions default to English.

### Steps
1. **DB migration**: add language fields to `court_sessions`.
   - Create a new migration (e.g. `037_court_session_language.sql`).
   - SQL:
     - `ALTER TABLE court_sessions ADD COLUMN IF NOT EXISTS creator_language TEXT DEFAULT 'en';`
     - `ALTER TABLE court_sessions ADD COLUMN IF NOT EXISTS partner_language TEXT DEFAULT 'en';`
     - `ALTER TABLE court_sessions ADD COLUMN IF NOT EXISTS case_language TEXT DEFAULT 'en';`
     - Backfill nulls to `en` (if needed).
2. **Persist languages during checkpoint**:
   - File: `server/src/lib/courtDatabase.js`
   - Add `creator_language`, `partner_language`, `case_language` to the `data` payload in `checkpoint()`.
   - Add same fields to `buildMinimalPayload()` so minimal inserts also keep language when columns exist.
3. **Restore languages during recovery**:
   - File: `server/src/lib/courtSessionManager.js`
   - In `_reconstructFromDB`, read `db.creator_language`, `db.partner_language`, `db.case_language`.
   - Set on `session.creatorLanguage`, `session.partnerLanguage`, `session.caseLanguage`.
   - Use fallbacks: `caseLanguage || creatorLanguage || 'en'`.

### Acceptance Check
If a court session is created in zh-Hans, restart the server, and the session is restored, verdict generation still uses zh-Hans.

---

## B) Localize Event Planner via LLM + Language-Aware RAG

### Why
Event Planner currently outputs English-only text and uses RAG without language filters. With Chinese memories, RAG becomes empty and the LLM output remains English.

### Steps
1. **Pass request language to Event Planner**:
   - File: `server/src/routes/calendar.js`
   - Use `resolveRequestLanguage(req, supabase, viewerId)` and pass `language` into `generateEventPlan`.
2. **Update Event Planner interface**:
   - File: `server/src/lib/eventPlanner.js`
   - Add `language` to `generateEventPlan` params.
   - Add `language` to `retrievePartnerRagContext` params.
3. **Add LLM language instruction**:
   - File: `server/src/lib/eventPlanner.js`
   - Import `normalizeLanguage` and `getLanguageLabel` from `server/src/lib/language.js`.
   - Build a language instruction string, e.g.:
     - "Respond in <label> (<code>) for all narrative fields. Keep enum values in English."
   - Append this instruction to the `systemPrompt` or `userPrompt`.
4. **Language-aware RAG**:
   - File: `server/src/lib/eventPlanner.js`
   - When calling `retrieveRelevantMemories` or `retrieveRelevantMemoriesV2`, pass `language`.
   - If zero results and language != `en`, retry with `en`.
5. **Fallback plan localization**:
   - File: `server/src/lib/eventPlanner.js`
   - Update `buildFallbackPlan` to accept `language`.
   - Provide a minimal zh-Hans fallback map for each string to avoid English-only output if OpenRouter is not configured.
   - If language not supported, fall back to English.

### Acceptance Check
Event plan output uses the requester language (zh-Hans) when OpenRouter is configured. If OpenRouter is unavailable, fallback returns zh-Hans content (or English if unsupported).

---

## C) Clean Up Remaining Hardcoded English UI Strings

### Why
Some strings still bypass i18n, making new languages harder and producing mixed-language UI.

### Update Targets
1. **Profiles page**
   - File: `client/src/pages/ProfilesPage.jsx`
   - Replace:
     - `unlockHint` string
     - "Love Language" label
     - "Save Profile" button text
     - image upload alerts
   - Add new i18n keys under `profile` and/or `errors`.
2. **Helper messages**
   - File: `client/src/utils/helpers.js`
   - `getRandomCatMessage` and `getStreakMessage` must be localized.
   - Use `translate()` from `client/src/i18n/index.js` (not hooks) with arrays in JSON:
     - `common.catMessages` (array)
     - `common.streakMessages` (object by tier or array)
3. **Date formatting**
   - File: `client/src/utils/helpers.js`
   - Update `formatDate` to accept an optional `locale` in its options:
     - Example: `formatDate(dateInput, { locale: language, ...options })`
   - Update call sites to pass `language` from `useI18n`:
     - `client/src/pages/AppreciationsPage.jsx`
     - `client/src/pages/HistoryPage.jsx`
     - `client/src/pages/CaseDetailPage.jsx`

### Acceptance Check
Switching language changes these strings without leaving English artifacts.

---

## D) Centralize Supported Languages (Future-Proofing)

### Why
Supported languages are currently duplicated across client and server. Adding a new language requires editing multiple files and risks mismatches.

### Plan
1. **Add a shared language config file** at project root:
   - Example file: `i18n.languages.json`
   - Structure:
     ```json
     {
       "default": "en",
       "supported": [
         { "code": "en", "labelKey": "language.en" },
         { "code": "zh-Hans", "labelKey": "language.zhHans" }
       ]
     }
     ```
2. **Client: use shared config**
   - File: `client/src/i18n/index.js`
     - Load `i18n.languages.json` and set `SUPPORTED_LANGUAGES` + `DEFAULT_LANGUAGE`.
   - File: `client/src/pages/ProfilesPage.jsx`
     - Render the language dropdown from `supported` list instead of hardcoding.
3. **Server: use shared config**
   - File: `server/src/lib/language.js`
     - Load `i18n.languages.json` and derive `SUPPORTED_LANGUAGES`.

### Acceptance Check
Adding a new language only requires:
1) add it to `i18n.languages.json`
2) create `client/src/i18n/locales/<code>.json`
3) add translation rows to `question_bank_translations` and `challenges_translations`

---

## E) Translation File Updates

Update translation files to include new keys used above:
- `client/src/i18n/locales/en.json`
- `client/src/i18n/locales/zh-Hans.json`

Add keys for:
- Profile strings (love language label, save button, unlock hint, image upload errors)
- Helper messages (cat messages, streak messages)

---

## Files to Change (Checklist)

Server:
- `supabase/migrations/037_court_session_language.sql` (new)
- `server/src/lib/courtDatabase.js`
- `server/src/lib/courtSessionManager.js`
- `server/src/routes/calendar.js`
- `server/src/lib/eventPlanner.js`
- `server/src/lib/language.js` (if using shared config)

Client:
- `client/src/pages/ProfilesPage.jsx`
- `client/src/utils/helpers.js`
- `client/src/pages/AppreciationsPage.jsx`
- `client/src/pages/HistoryPage.jsx`
- `client/src/pages/CaseDetailPage.jsx`
- `client/src/i18n/index.js`
- `client/src/i18n/locales/en.json`
- `client/src/i18n/locales/zh-Hans.json`
- `i18n.languages.json` (new, root)

---

## Suggested QA
- Create a court session in zh-Hans, restart server, continue session, verify LLM output stays zh-Hans.
- Generate event plan in zh-Hans; verify LLM output language and memory usage.
- Switch language: profile UI, helper messages, and date formatting update.
- Ensure English still works as default.

---

## Notes for Future Languages
To add a new language:
1. Add code to `i18n.languages.json`.
2. Create `client/src/i18n/locales/<code>.json`.
3. Add translation rows into `question_bank_translations` and `challenges_translations`.
4. (Optional) Add fallback strings in `buildFallbackPlan` for the new language.
