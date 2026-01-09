# I18n Follow-up Review

## Summary
- Added shared language config and wired both client and server to consume it.
- Persisted/recovered court session languages and added DB migration for new columns.
- Localized Event Planner output with language-aware RAG + fallback zh-Hans copy.
- Removed hardcoded profile/helper strings and localized date formatting call sites.
- Follow-up fixes: alias-aware language normalization, profile-first resolution, and localized Appreciations UI + tests.

## Files Added
- `i18n.languages.json`
- `supabase/migrations/037_court_session_language.sql`
- `i18n_followup_review.md`
- `client/src/i18n/languageConfig.js`
- `client/src/test/i18n.test.js`
- `server/src/lib/language.test.js`

## Files Updated
- `server/src/lib/language.js`
- `server/src/lib/eventPlanner.js`
- `server/src/lib/courtDatabase.js`
- `server/src/lib/courtSessionManager.js`
- `server/src/routes/calendar.js`
- `client/src/i18n/index.js`
- `client/src/i18n/locales/en.json`
- `client/src/i18n/locales/zh-Hans.json`
- `client/src/pages/ProfilesPage.jsx`
- `client/src/pages/AppreciationsPage.jsx`
- `client/src/pages/HistoryPage.jsx`
- `client/src/pages/CaseDetailPage.jsx`
- `client/src/utils/helpers.js`
- `client/vite.config.js`
- `client/src/store/useAuthStore.js`

## Notes
- Event Planner now passes request language, adds LLM language instruction, filters RAG by language with English fallback, and uses zh-Hans fallback copy when OpenRouter is unavailable.
- Court session checkpoints include creator/partner/case language; recovery restores these with sensible fallback.
- Profiles page uses shared language config for the dropdown; helper messages and image upload alerts are localized via new i18n keys.
- Language config supports aliases/base fallback; profile language now overrides Accept-Language (new profiles default to browser locale).
- Appreciations page strings/relative time labels now pull from i18n.

## Tests
- Not run (not requested).
