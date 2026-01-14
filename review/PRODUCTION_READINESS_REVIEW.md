# Production Readiness Review - Pause

**Last Updated:** January 2026
**Review Method:** Multi-agent comprehensive analysis of client, server, and real-time features

---

## Executive Summary

The Pause app has a solid foundation with good Supabase auth/RLS patterns, thoughtful localization, and defensive input handling in key areas. However, **the app is not production-ready**. There are 3 blocking issues, 6 high-severity issues, and 15+ medium-severity issues that must be addressed before App Store/Google Play submission.

The most critical gaps are:
1. **Authentication flow** - Sign-up doesn't handle email confirmation properly
2. **Webhook security** - RevenueCat signature verification will fail in production
3. **Court session reliability** - Timeouts are lost on server restart, sessions can become orphaned
4. **App Store compliance** - Missing account deletion and partner disconnect

---

## Findings by Severity

### Blocking (Must Fix Before Any Production Deployment)

| # | Issue | Files | Description |
|---|-------|-------|-------------|
| B1 | RevenueCat HMAC verification broken | `server/src/routes/webhooks.js:73-79` | Uses `JSON.stringify(req.body)` instead of raw request payload. HMAC signatures are computed over exact bytes sent by RevenueCat, so verification will always fail once `REVENUECAT_WEBHOOK_SECRET` is enabled. All subscription webhooks will be rejected, keeping subscriptions out of sync. |
| B2 | Sign-up marks authenticated with no session | `client/src/store/useAuthStore.js:410-436` | When Supabase requires email confirmation, it returns `data.user` but `data.session` is null. The code sets `isAuthenticated: true` regardless, causing a signed-in UI state with no valid access token. Results in 401 errors and broken onboarding. |
| B3 | Court session timeouts not recoverable | `server/src/lib/court/timeoutHandlers.js:9-19`, `server/src/lib/court/SessionStateRepository.js:207-221` | All session timeouts use JavaScript `setTimeout` which is lost on server restart. Sessions restored from Redis don't have timeouts reinstated. For multi-instance deployments, sessions can become orphaned indefinitely with no mechanism to timeout. |

### High (Must Fix Before Store Submission)

| # | Issue | Files | Description |
|---|-------|-------|-------------|
| H1 | No account deletion | `client/src/pages/SettingsPage.jsx:110-157` | Settings page has no account deletion option. Required by Apple (Account Deletion Requirement, June 2022) and Google Play User Data policy for apps that create accounts. |
| H2 | Partner disconnect is no-op | `client/src/pages/SettingsPage.jsx:306-315` | Disconnect confirm button only closes the modal without any actual disconnection logic. Users cannot unpair after a mistaken connection. Safety/relationship UX gap. |
| H3 | Push logout deactivates ALL device tokens | `client/src/services/pushNotifications.js:267-295` | `deactivateDeviceToken` marks ALL tokens for the user as inactive via `.eq('user_id', user.id)`. Logging out on one device disables push notifications on every other device. |
| H4 | AI insights auto-consent | `server/src/routes/insights.js:58-83` | When `ai_insights_consent_at` is null, consent is automatically set to true without user action. Bypasses explicit opt-in, may violate privacy expectations and app store AI feature policies. |
| H5 | Race condition in resolution picks | `server/src/lib/court/ResolutionService.js:125-163` | `_handleMismatchPick` reads and writes session state without distributed locking. In multi-instance deployment, simultaneous picks from both users can both succeed with different values, causing inconsistent state. |
| H6 | Settlement timeout not persisted | `server/src/lib/court/SettlementService.js:35-46` | Settlement request stores only `settlementRequested: userId` with no timestamp. Timeout is JavaScript `setTimeout`, lost on restart. No way to calculate remaining duration after recovery. |

### Medium (Should Fix Before Launch)

| # | Issue | Files | Description |
|---|-------|-------|-------------|
| M1 | LLM security middleware not wired | `server/src/lib/security/securityMiddleware.js`, `server/src/lib/security/index.js:150` | Comprehensive LLM security middleware exists (`llmSecurityMiddleware`, `createSecurityStack`) but is never imported or used in routes. Only `processSecureInput` is manually called in `court.js`. Missing from `/api/daily-questions/*`, `/api/calendar/*`, `/api/insights/*`. |
| M2 | LLM output validation never invoked | `server/src/lib/security/index.js` | Functions `processSecureOutput`, `validateVerdictOutput`, `validateOutput` exist but are never called in application code. LLM outputs stored/returned without validation for compromise indicators. |
| M3 | Rate limiting in-memory only | `server/src/lib/rateLimit.js:5`, `server/src/lib/security/rateLimiter.js:11-14` | Both API and LLM rate limiters use in-memory Maps. Reset on restart, don't coordinate across instances. Abuse protection unreliable in production. |
| M4 | Error message leakage (35+ instances) | See table below | Many routes return raw `error.message` instead of using `safeErrorMessage()`, leaking internal details. |
| M5 | Session tokens in localStorage | `client/src/services/authSessionBackup.js:20-35` | Access + refresh tokens stored in localStorage as backup. Vulnerable to XSS - any malicious script can exfiltrate tokens. |
| M6 | Event reminders need external scheduler | `server/src/lib/eventReminderService.js:225-232`, `server/src/routes/notifications.js:94-116` | `processEventReminders()` designed for cron job, but only trigger route is dev-only gated. Reminders will never send in production without external scheduler. |
| M7 | Redis pub/sub race on startup | `server/src/lib/court/SessionStateRepository.js:35-48` | Constructor subscribes to Redis and hydrates asynchronously without coordination. Messages arriving before hydration completes cause inconsistent state. |
| M8 | No TTL on Redis session keys | `server/src/lib/court/SessionStateRepository.js:229-246` | Session keys stored without expiration. If session never deleted (crash during cleanup), keys persist indefinitely. Memory leak potential. |
| M9 | Verdict generation fire-and-forget | `server/src/lib/courtSessionManager.js:250-251` | `_generateVerdict(session)` called without await. Server crash during generation leaves session in ANALYZING phase with no retry mechanism. |
| M10 | Auth initialization race conditions | `client/src/store/useAuthStore.js:271-322` | Singleton promise pattern but `handleSupabaseAuthEvent` may set state during initialization. INITIAL_SESSION skipped but manual handling may run after listener active. |
| M11 | Session backup no expiry check | `client/src/store/useAuthStore.js:214-232` | `restoreSessionFromBackup` doesn't validate `expires_at` before using tokens. Expired tokens sent to `setSession`, causing errors before SDK can refresh. |
| M12 | Court drafts lost on refresh | `client/src/store/useCourtStore.js:118-123` | `localEvidence`, `localFeelings`, `localNeeds` stored only in Zustand (memory). Lost on page refresh, app close, or reconnection. |
| M13 | No in-app notification UI | `client/src/services/pushNotifications.js:162-185` | Foreground notifications dispatch `pushNotificationReceived` event but no component listens. Users don't see notifications while using app. |
| M14 | No runtime offline detection | N/A | Service worker has offline fallback, but no runtime detection in React. No offline banner, no action queueing, no clear feedback for connectivity failures. |
| M15 | WebSocket no auth token refresh | `server/src/lib/courtWebSocket.js:118-134` | When Supabase session token expires and refreshes, WebSocket connection doesn't re-authenticate. Subsequent authenticated operations fail. |

#### Error Message Leakage Detail (M4)

| Route File | Instances | Lines |
|------------|-----------|-------|
| `server/src/routes/dailyQuestions.js` | 10 | 108, 166, 469, 519, 579, 640, 648, 695, 722 |
| `server/src/routes/court.js` | 12 | 113, 131, 148, 204, 250, 280, 325, 345, 363, 385, 403, 421 |
| `server/src/routes/memory.js` | 4 | 57, 97, 135, 182 |
| `server/src/routes/usage.js` | 3 | 146, 178, 227 |
| `server/src/routes/stats.js` | 3 | 47, 80, 139 |
| `server/src/routes/subscription.js` | 2 | 151, 232 |
| `server/src/routes/webhooks.js` | 1 | 216 |

Routes using `safeErrorMessage` correctly: `cases.js`, `insights.js`, `notifications.js`

### Low (Nice to Have)

| # | Issue | Files | Description |
|---|-------|-------|-------------|
| L1 | Notification tap full reload | `client/src/services/pushNotifications.js:207-257` | Uses `window.location.href` instead of React Router. Full page reload loses local state. |
| L2 | Hard-coded version number | `client/src/pages/SettingsPage.jsx:253` | Version `1.0.0` hard-coded instead of reading from package.json or environment. |
| L3 | Rate limit map memory growth | `server/src/lib/courtWebSocket.js:47-52` | `wsRateLimits` Map cleanup only triggers at 10,000 entries. Synchronous cleanup blocks event loop. |
| L4 | Event bus listeners at module load | `client/src/store/useOnboardingStore.js:18-32`, `client/src/store/usePartnerStore.js:52-65` | Listeners registered during store creation, not in `init()`. Cannot be cleaned up, testing requires mocks. |
| L5 | No idempotency keys on court actions | `server/src/lib/courtSessionManager.js` | Actions like `submitEvidence`, `markPrimingComplete` lack request IDs. Network retries could cause duplicate processing. |
| L6 | Generic auth error messages | `client/src/pages/OnboardingPage.jsx:402-407` | All sign-up errors show generic message. "Email already registered" or "Invalid email format" not surfaced. |

---

## UX and Feature Gaps

### App Store Compliance (Required)
- Account deletion not surfaced in-app
- Data export not available
- Partner disconnect not implemented

### Onboarding and Authentication
- No "Check your email to verify" state when Supabase returns no session
- No onboarding progress indicator or pause/resume
- No AI safety/consent step explaining LLM data usage
- Generic error messages don't help users fix sign-up issues

### Partner Connection and Safety
- Disconnect/unpair flow missing entirely
- No ability to cancel pending requests, resend invites, or block/report
- No distinct "pending" state on dashboard with wait time

### Court Flow
- No save-draft for evidence inputs - long entries lost on refresh
- Timeout countdown not shown to users
- No explicit messaging about what happens when timeout fires
- Sessions can become orphaned after server restart

### Notifications and Reminders
- No notification settings screen showing permission status
- No guided flow to re-enable notifications after denial
- No in-app notification center for missed pushes
- Foreground notifications not visible in app

### Subscription and Limits
- No subscription status in Settings (plan, renewal date)
- No restore purchase flow

### Accessibility
- VoiceOver labels and focus order not audited
- High-contrast fallback for badges/chips needed
- Minimum tap targets not verified

### Reliability
- No "connection issue" banner with retry
- No error reporting service (Sentry/LogRocket)
- No report content or safety resources for sensitive outcomes

---

## Security and Privacy Checklist

| Item | Status | Notes |
|------|--------|-------|
| AI data handling in privacy policy | ⚠️ Check | Ensure consent is explicit, not auto-consent |
| LLM security middleware active | ❌ Missing | Not wired into routes |
| LLM output validation | ❌ Missing | Functions exist but never called |
| Rate limiting distributed | ❌ Missing | In-memory only |
| Token storage security | ⚠️ Concern | localStorage vulnerable to XSS |
| Input sanitization | ✅ Partial | Court evidence uses `processSecureInput` |
| Error message safety | ❌ Incomplete | 35+ routes leak internal errors |

---

## Operational Readiness

| Item | Status | Notes |
|------|--------|-------|
| Event reminder scheduler | ❌ Missing | Need cron/worker to call `processEventReminders` |
| Webhook failure monitoring | ❌ Missing | No alerting for RevenueCat failures |
| LLM error monitoring | ❌ Missing | No alerting for judge engine errors |
| Client error reporting | ❌ Missing | No Sentry/LogRocket integration |
| Session timeout recovery | ❌ Missing | Need timestamp-based timeouts with recovery |
| Distributed locking | ❌ Missing | Need Redis locks for concurrent operations |
| Redis key TTL | ❌ Missing | Session keys persist indefinitely |

---

## Strengths Observed

- Good use of Supabase auth and RLS patterns across routes
- Thoughtful localization plumbing and onboarding language handling
- Defensive input handling for court/daily-question and LLM prompts where implemented
- Well-structured court service architecture with clear separation of concerns
- Comprehensive security module exists (just needs wiring)
- Redis pub/sub for multi-instance session sync (architecture is sound)

---

## Fix Plan

### Phase 0 - Blockers (Before Any Store Submission)

| # | Task | Effort |
|---|------|--------|
| 1 | Fix RevenueCat webhook to use raw request body via `express.raw()` middleware; add signature test | S |
| 2 | Update sign-up to handle email confirmation (no session) with verification screen and state gating | M |
| 3 | Implement account deletion flow end-to-end (API, DB cascade/soft-delete, UI confirmation) | L |
| 4 | Implement partner disconnect flow (API, state cleanup, UI confirmation with impact summary) | M |
| 5 | Scope push token deactivation to current device (add device_id to query) | S |
| 6 | Implement timestamp-based timeout tracking; recover/recalculate timeouts on session restore | L |
| 7 | Add distributed locking (Redis SETNX) for resolution mismatch picks | M |

### Phase 1 - Security and Operational Hardening

| # | Task | Effort |
|---|------|--------|
| 8 | Wire LLM security middleware into all LLM-related routes | M |
| 9 | Add LLM output validation before persistence | M |
| 10 | Move rate limiting to Redis (shared store) | M |
| 11 | Normalize all error responses with `safeErrorMessage` (35+ locations) | M |
| 12 | Add Redis TTL to session keys (e.g., 24 hours) | S |
| 13 | Fix AI insights to require explicit opt-in consent | S |
| 14 | Add scheduled job to run `processEventReminders` hourly | M |
| 15 | Add error reporting service (Sentry) to client and server | M |

### Phase 2 - UX Improvements

| # | Task | Effort |
|---|------|--------|
| 16 | Onboarding: Add email verification UI, progress indicator, pause/resume | L |
| 17 | Court: Implement evidence draft persistence (localStorage or server-side) | M |
| 18 | Court: Add timeout countdown UI and approaching-timeout warnings | M |
| 19 | Notifications: Add settings permissions screen with guided re-enable flow | M |
| 20 | Notifications: Add in-app notification toast for foreground | S |
| 21 | Add offline detection banner with retry for API failures | M |
| 22 | Subscription: Surface usage limits and plan status in Settings | M |
| 23 | Safety: Add report content path and safety resources links | S |

### Phase 3 - Polish

| # | Task | Effort |
|---|------|--------|
| 24 | Use React Router for notification navigation (avoid full reload) | S |
| 25 | Add accessibility audit (VoiceOver, focus order, tap targets) | M |
| 26 | Dynamic version number from package.json | S |
| 27 | Fix auth initialization race conditions | M |
| 28 | Add session backup expiry validation | S |

---

## Verdict

**Not production-ready.**

- **3 blocking issues** must be fixed before any production deployment
- **6 high-severity issues** must be fixed before App Store/Google Play submission
- **15+ medium-severity issues** should be addressed for production reliability

The court/real-time system is particularly concerning for multi-instance deployments due to timeout persistence and race condition issues. For a soft launch with single-instance deployment and close monitoring, addressing Phase 0 items may be sufficient.

**Minimum viable production:** Complete Phase 0 (7 tasks) + Phase 1 items 8-11, 13 (5 tasks) = 12 tasks

**Recommended for launch:** Complete Phase 0 + Phase 1 + Phase 2 items 16-18, 20-21 = 22 tasks
