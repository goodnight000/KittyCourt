# Plan: Audit & Add Chinese Translations for All Pages

## Goal
Make all user-facing page copy translatable (English + Simplified Chinese) and ensure language switching is consistent across the entire app.

## Skills to Use
- frontend-design (ensure localized UI stays clean, balanced, and readable)
- react-state-management (consistent use of `useI18n`, language-aware formatting)
- debugging-strategies (systematic audit to catch missed hardcoded strings)

## Scope
Focus on **all pages in `client/src/pages/`**, plus any shared components those pages render if they contain user-facing copy.

## Inventory (from current audit)

### Pages with **no** `useI18n` (high priority — likely unlocalized)
Add `useI18n()` and move all visible strings into `en.json` + `zh-Hans.json`.
- `client/src/pages/AuthCallbackPage.jsx`
- `client/src/pages/ConnectPartnerPage.jsx`
- `client/src/pages/CourtroomPage.jsx`
- `client/src/pages/DashboardPage.jsx` (home page)
- `client/src/pages/EconomyPage.jsx` (kibble redeem)
- `client/src/pages/ForgotPasswordPage.jsx`
- `client/src/pages/InsightsPage.jsx`
- `client/src/pages/MemoriesPage.jsx`
- `client/src/pages/ResetPasswordPage.jsx`
- `client/src/pages/SignInPage.jsx`
- `client/src/pages/SignUpPage.jsx`

### Pages that **already use** `useI18n` but still contain hardcoded strings
These likely still contain English labels, buttons, helper text, or alerts. Audit every visible string.
- `client/src/pages/AppreciationsPage.jsx`
- `client/src/pages/CalendarPage.jsx`
- `client/src/pages/CaseDetailPage.jsx` (cases page)
- `client/src/pages/ChallengesPage.jsx`
- `client/src/pages/DailyMeowHistoryPage.jsx`
- `client/src/pages/DailyMeowPage.jsx`
- `client/src/pages/HistoryPage.jsx` (case history)
- `client/src/pages/OnboardingPage.jsx`
- `client/src/pages/ProfilesPage.jsx`

## Implementation Steps

### 1) Add i18n support to missing pages
For each page without `useI18n`:
- Import `useI18n` and destructure `t` (and `language` if you need locale formatting).
- Replace every user-visible string with `t('...')`.
- Include placeholders, button labels, tooltip/aria labels, error messages, and modal text.

### 2) Audit pages that already use i18n
For each page listed above:
- Search for **hardcoded strings** in JSX, `alert()`, `confirm()`, error messages, placeholders, etc.
- Replace with `t('...')`.
- For dynamic values (names, counts, etc.) use interpolation: `t('key', { name })`.

### 3) Create/extend translation namespaces
Add new keys under clear namespaces in:
- `client/src/i18n/locales/en.json`
- `client/src/i18n/locales/zh-Hans.json`

Recommended namespace structure (example):
```
"dashboard": { ... },
"court": { ... },
"cases": { ... },
"economy": { ... },
"profile": { ... },
"auth": { ... },
"memories": { ... },
"insights": { ... },
"calendar": { ... }
```

### 4) Handle pluralization manually
We don’t have automatic plural rules. Use the existing pattern:
- `keyOne`, `keyOther`
- choose based on count (`count === 1 ? t('...One') : t('...Other', { count })`).

### 5) Dates & locale formatting
- Use `language` from `useI18n` when calling `toLocaleDateString`.
- For relative time labels (“just now”, “x days ago”), ensure they come from i18n keys.

### 6) Verify coverage
After updating:
- Confirm every page string is translated by scanning for raw English in `client/src/pages/`.
- Run a quick grep for hardcoded text nodes:
  - `rg -n ">[^<]*[A-Za-z][^<]*<" client/src/pages`

## Acceptance Criteria
- Every page in `client/src/pages` uses `t()` for all user-visible text.
- All new translation keys exist in both `en.json` and `zh-Hans.json`.
- Switching language updates every visible string on pages listed above.
- No new hardcoded English text remains in UI pages.

## Notes / Edge Cases
- Some pages may reuse shared components. If those components contain user-facing text, either localize them in the component itself or move that copy into the page’s translation namespace.
- Keep English as source-of-truth for new keys; translate into Simplified Chinese.
- Avoid introducing new non-ASCII text in code files—only in translation JSON (already contains Chinese).
