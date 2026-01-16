# Pause App - Codebase Research & Automated Fix Prompt

**Generated:** 2026-01-15
**Purpose:** Complete codebase documentation and autonomous agent prompt for fixing all identified issues

---

# PART 1: CODEBASE ARCHITECTURE DOCUMENTATION

## 1.1 Project Overview

**Pause** is a couples dispute resolution app featuring an AI Cat Judge persona that delivers psychologically-grounded verdicts based on Gottman Method and NVC principles.

### Tech Stack
- **Frontend:** React 19 + Vite + Capacitor (iOS/Android)
- **Backend:** Express 5 + Socket.IO
- **Database:** Supabase PostgreSQL with pgvector
- **AI:** OpenRouter (DeepSeek, Gemini, GPT-5.2) + OpenAI embeddings
- **Subscriptions:** RevenueCat

### Monorepo Structure
```
/Users/charleszheng/Desktop/Ideas/Pause/
├── client/                    # React 19 + Vite frontend
│   ├── src/
│   │   ├── components/        # 80+ React components
│   │   ├── pages/             # 22 pages
│   │   ├── store/             # 11 Zustand stores
│   │   ├── services/          # API, Supabase, RevenueCat
│   │   └── i18n/              # Internationalization
│   ├── capacitor.config.json  # Mobile configuration
│   └── package.json
├── server/                    # Express 5 API
│   ├── src/
│   │   ├── routes/            # 20 route files
│   │   ├── lib/               # Core services
│   │   │   ├── security/      # LLM security system
│   │   │   ├── court/         # Court session services
│   │   │   └── shared/        # Shared utilities
│   └── package.json
└── supabase/
    └── migrations/            # 55 SQL migrations
```

---

## 1.2 Client Architecture

### Pages (22 total)
| Page | File | Purpose |
|------|------|---------|
| DashboardPage | `client/src/pages/DashboardPage.jsx` | Home screen with stats, daily questions, quick actions |
| CourtroomPage | `client/src/pages/CourtroomPage.jsx` | AI judge dispute resolution |
| OnboardingPage | `client/src/pages/OnboardingPage.jsx` | 12-step new user flow |
| DailyMeowPage | `client/src/pages/DailyMeowPage.jsx` | Daily question answering |
| ProfilesPage | `client/src/pages/ProfilesPage.jsx` | User profile + relationship tab |
| CalendarPage | `client/src/pages/CalendarPage.jsx` | Shared couple calendar |
| SettingsPage | `client/src/pages/SettingsPage.jsx` | App settings, logout, delete |
| ChallengesPage | `client/src/pages/ChallengesPage.jsx` | Couple challenges for XP |
| InsightsPage | `client/src/pages/InsightsPage.jsx` | AI relationship insights |
| MemoriesPage | `client/src/pages/MemoriesPage.jsx` | Photo memories gallery |
| EconomyPage | `client/src/pages/EconomyPage.jsx` | Kibble economy, coupons |
| HistoryPage | `client/src/pages/HistoryPage.jsx` | Past court case history |
| CaseDetailPage | `client/src/pages/CaseDetailPage.jsx` | Individual verdict view |
| AppreciationsPage | `client/src/pages/AppreciationsPage.jsx` | Love notes received |

### Zustand Stores (11 total)
| Store | File | State Managed |
|-------|------|---------------|
| useAuthStore | `client/src/store/useAuthStore.js` | Auth, profile, partner, session |
| useAppStore | `client/src/store/useAppStore.js` | Case history, appreciations |
| useCourtStore | `client/src/store/useCourtStore.js` | Court session state machine (17 phases) |
| useSubscriptionStore | `client/src/store/useSubscriptionStore.js` | RevenueCat, usage limits |
| useCacheStore | `client/src/store/useCacheStore.js` | SWR-style caching |
| usePartnerStore | `client/src/store/usePartnerStore.js` | Partner requests, connection |
| useLevelStore | `client/src/store/useLevelStore.js` | XP/level progression |
| useChallengeStore | `client/src/store/useChallengeStore.js` | Weekly challenges |
| useInsightsStore | `client/src/store/useInsightsStore.js` | AI relationship insights |
| useMemoryStore | `client/src/store/useMemoryStore.js` | Photo memories |
| useOnboardingStore | `client/src/store/useOnboardingStore.js` | Onboarding flow state |

### Services
| Service | File | Purpose |
|---------|------|---------|
| API Client | `client/src/services/api.js` | Axios with auth interceptor |
| Supabase | `client/src/services/supabase.js` | Auth, database, realtime |
| RevenueCat | `client/src/services/revenuecat.js` | Subscriptions (iOS/Android) |
| Session Backup | `client/src/services/authSessionBackup.js` | Mobile webview persistence |
| Sentry | `client/src/services/sentry.js` | Error tracking |

### Court Session State Machine (17 VIEW_PHASEs)
```
IDLE → PENDING_CREATOR/PENDING_PARTNER → EVIDENCE → WAITING_EVIDENCE →
ANALYZING → PRIMING → WAITING_PRIMING → JOINT_MENU → WAITING_JOINT →
RESOLUTION_SELECT → RESOLUTION_MISMATCH → WAITING_RESOLUTION →
VERDICT → WAITING_ACCEPT → RATING → CLOSED
```

---

## 1.3 Server Architecture

### API Routes (20 files)
| Route | File | Endpoints |
|-------|------|-----------|
| Court | `server/src/routes/court.js` | 15+ endpoints for session management |
| Subscription | `server/src/routes/subscription.js` | Status, sync, debug-grant |
| Webhooks | `server/src/routes/webhooks.js` | RevenueCat webhooks |
| Memory | `server/src/routes/memory.js` | Memory/RAG endpoints |
| Cases | `server/src/routes/cases.js` | Case history CRUD |
| Appreciations | `server/src/routes/appreciations.js` | Partner appreciations |
| Calendar | `server/src/routes/calendar.js` | Shared calendar + AI planning |
| Usage | `server/src/routes/usage.js` | Usage tracking |
| Daily Questions | `server/src/routes/dailyQuestions.js` | Daily check-ins |
| Profile | `server/src/routes/profile.js` | Profile management |
| Account | `server/src/routes/account.js` | Account deletion |
| Economy | `server/src/routes/economy.js` | Kibble transactions |
| Memories | `server/src/routes/memories.js` | Photo memories |
| Levels | `server/src/routes/levels.js` | XP/leveling |
| Challenges | `server/src/routes/challenges.js` | Couple challenges |
| Insights | `server/src/routes/insights.js` | AI insights |
| Feedback | `server/src/routes/feedback.js` | User feedback |
| Notifications | `server/src/routes/notifications.js` | Push notifications |
| Stats | `server/src/routes/stats.js` | Statistics |
| Exports | `server/src/routes/exports.js` | Data export |

### Core Libraries
| Library | File | Purpose |
|---------|------|---------|
| Judge Engine | `server/src/lib/judgeEngine.js` | 6-step AI verdict pipeline |
| Prompts | `server/src/lib/prompts.js` | Psychological framework (Gottman/NVC) |
| Memory Retrieval | `server/src/lib/memoryRetrieval.js` | RAG with pgvector |
| Stenographer | `server/src/lib/stenographer.js` | Background memory extraction |
| Embeddings | `server/src/lib/embeddings.js` | OpenAI text-embedding-3-small |
| OpenRouter | `server/src/lib/openrouter.js` | LLM API client |
| Court WebSocket | `server/src/lib/courtWebSocket.js` | Socket.IO real-time |
| Court Session Manager | `server/src/lib/courtSessionManager.js` | In-memory session state |
| Auth | `server/src/lib/auth.js` | JWT authentication |
| Rate Limit | `server/src/lib/rateLimit.js` | Express rate limiting |

### Security System
| Component | File | Purpose |
|-----------|------|---------|
| Index | `server/src/lib/security/index.js` | Security module aggregator |
| Injection Detector | `server/src/lib/security/injectionDetector.js` | Prompt injection detection |
| Input Sanitizer | `server/src/lib/security/inputSanitizer.js` | Unicode normalization, escaping |
| Output Validator | `server/src/lib/security/outputValidator.js` | LLM output validation |
| Prompt Armor | `server/src/lib/security/promptArmor.js` | Injection-resistant prompts |
| Rate Limiter | `server/src/lib/security/rateLimiter.js` | Abuse detection |
| Audit Logger | `server/src/lib/security/auditLogger.js` | Security event logging |
| Security Middleware | `server/src/lib/security/securityMiddleware.js` | Express middleware stack |
| Injection Patterns | `server/src/lib/security/patterns/injectionPatterns.js` | Detection patterns |

### Court Services
| Service | File | Purpose |
|---------|------|---------|
| Evidence Service | `server/src/lib/court/EvidenceService.js` | Evidence submission |
| Resolution Service | `server/src/lib/court/ResolutionService.js` | Resolution picking |
| Settlement Service | `server/src/lib/court/SettlementService.js` | Settlement flow |
| Session State Repository | `server/src/lib/court/SessionStateRepository.js` | Session persistence |
| Phase Transition Controller | `server/src/lib/court/PhaseTransitionController.js` | State machine |
| Verdict Generator | `server/src/lib/court/verdictGenerator.js` | Verdict orchestration |
| Timeout Handlers | `server/src/lib/court/timeoutHandlers.js` | Session timeouts |

### Judge Engine 6-Step Pipeline
```
1. Safety Guardrail → OpenAI Moderation API
2. Memory Retrieval → pgvector RAG (top-4 memories)
3. Analyst + Repair Selection → Psychological analysis + 3 options
4. Priming + Joint Menu → Individual priming + shared menu
5. Hybrid Resolution → When users pick different options
6. Background Extraction → Stenographer stores memories
```

### LLM Models
```javascript
const JUDGE_MODELS = {
    wise: 'openai/gpt-5.2-chat',           // Judge Whiskers
    classic: 'deepseek/deepseek-v3.2',     // Judge Mochi
    swift: 'google/gemini-3-flash-preview' // Judge Dash
};
const HYBRID_MODEL = 'x-ai/grok-4.1-fast';
```

---

## 1.4 Database Schema

### Key Tables (35+ total)
| Table | Purpose | RLS |
|-------|---------|-----|
| profiles | User profiles with partner relationships | Yes |
| cases | Dispute cases (couple-scoped) | Yes |
| verdicts | AI-generated judgments | Yes |
| court_sessions | Real-time session state | Yes |
| user_memories | pgvector embeddings for RAG | Yes |
| daily_answers | Daily question responses | Yes |
| calendar_events | Shared couple calendar | Yes |
| appreciations | Partner appreciation messages | Yes |
| usage_tracking | Feature usage limits | Yes |
| couple_levels | XP and leveling | Yes |
| challenges | Challenge definitions | Yes |
| couple_challenges | Active challenge tracking | Yes |
| memories | Photo uploads | Yes |
| insights | AI relationship insights | Yes |

### Key Security Functions
```sql
get_my_partner_id()          -- Returns current user's partner ID
is_my_couple(user_a, user_b) -- Validates couple membership
is_connected()               -- Checks if user has partner
lookup_user_by_partner_code(code) -- Rate-limited partner lookup
```

### pgvector Configuration
```sql
-- Vector storage for RAG
ALTER TABLE user_memories ADD COLUMN embedding vector(1536);
CREATE INDEX idx_user_memories_embedding
ON user_memories USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

---

# PART 2: ALL IDENTIFIED ISSUES

## 2.1 Critical Issues (12 total)

### CRITICAL-001: WebSocket Addendum Bypasses Security
- **File:** `server/src/lib/courtWebSocket.js`
- **Lines:** 372-389
- **Issue:** `court:submit_addendum` event handler does not sanitize text input
- **Current Code:**
```javascript
socket.on('court:submit_addendum', async ({ text }, ack) => {
    // No processSecureInput call - text goes directly to manager
    await courtSessionManager.submitAddendum(socket.userId, text);
});
```
- **Fix:** Add `processSecureInput` validation matching evidence submission
- **Test:** `npm test -- courtWebSocket` should verify addendum validation

### CRITICAL-002: Moderation Failure Returns Safe=True
- **File:** `server/src/lib/openrouter.js`
- **Lines:** 155-158
- **Issue:** When OpenAI moderation API fails, content is treated as safe
- **Current Code:**
```javascript
} catch (error) {
    console.error('[OpenRouter] Moderation check failed:', error);
    return { results: [{ flagged: false, categories: {} }] };
}
```
- **Fix:** Return `{ flagged: true }` on failure (fail-closed)
- **Test:** Mock API failure and verify content is blocked

### CRITICAL-003: Output Blocking Too Permissive
- **File:** `server/src/lib/security/outputValidator.js`
- **Lines:** 312-315
- **Issue:** Only blocks when confidence is 'HIGH', single CRITICAL detection doesn't block
- **Current Code:**
```javascript
function shouldBlockOutput(output) {
  const compromise = detectOutputCompromise(output);
  return compromise.isCompromised && compromise.confidence === 'HIGH';
}
```
- **Fix:** Block on any CRITICAL severity regardless of count
- **Test:** `npm test -- outputValidator` with single CRITICAL pattern

### CRITICAL-004: isProd Variable Undefined
- **File:** `server/src/routes/economy.js`
- **Line:** 25
- **Issue:** `isProd` used but never declared, causes ReferenceError
- **Fix:** Add `const isProd = process.env.NODE_ENV === 'production';` after imports
- **Test:** Run economy route tests

### CRITICAL-005: Rate Limit Bypass via userId
- **File:** `server/src/lib/security/securityMiddleware.js`
- **Line:** 25
- **Issue:** Unauthenticated users can bypass rate limits by changing userId param
- **Current Code:**
```javascript
const userId = req.user?.id || req.body?.userId || req.query?.userId || 'anonymous';
```
- **Fix:** Only accept userId from authenticated session
```javascript
const userId = req.user?.id || `ip:${req.ip}`;
```
- **Test:** Verify rate limit applies consistently regardless of body params

### CRITICAL-006: WebSocket Auth Bypass Risk
- **File:** `server/src/lib/courtWebSocket.js`
- **Lines:** 147-169
- **Issue:** Auth bypass depends on strict NODE_ENV === 'production' match
- **Fix:** Add explicit Supabase requirement check in production
- **Test:** Verify auth required when Supabase configured

### CRITICAL-007: WebSocket Rate Limit Memory Growth
- **File:** `server/src/lib/courtWebSocket.js`
- **Lines:** 48-53
- **Issue:** Rate limit map only cleans at 10,000 entries
- **Current Code:**
```javascript
if (wsRateLimits.size > 10000) {
    for (const [k, v] of wsRateLimits.entries()) {
        if (now > v.resetAt) wsRateLimits.delete(k);
    }
}
```
- **Fix:** Implement periodic cleanup via setInterval
- **Test:** Verify cleanup runs periodically

### CRITICAL-008: No Token Refresh Retry on 401
- **File:** `client/src/services/api.js`
- **Lines:** 39-65
- **Issue:** No response interceptor to handle 401 errors with token refresh
- **Fix:** Add response interceptor that catches 401, refreshes token, retries request
- **Test:** `npm test -- api` with token expiration scenario

### CRITICAL-009: Initialize Promise Not Reset
- **File:** `client/src/store/useAuthStore.js`
- **Lines:** 282-333
- **Issue:** `initializePromise` not reset after error, locks app in error state
- **Fix:** Add `initializePromise = null` in catch block
- **Test:** `npm test -- useAuthStore` with initialization failure

### CRITICAL-010: Missing Deep Linking
- **File:** `client/capacitor.config.json`
- **Issue:** No deep linking configuration for OAuth callbacks
- **Fix:** Add App plugin configuration for pauseapp.com URLs
- **Test:** Manual test OAuth flow on iOS/Android

### CRITICAL-011: ErrorBoundary Hardcoded English
- **File:** `client/src/components/ErrorBoundary.jsx`
- **Lines:** 31-34
- **Issue:** Error messages not translated
- **Fix:** Add i18n support with useTranslation hook
- **Test:** Verify error message appears in Chinese when locale is zh-Hans

### CRITICAL-012: Missing user_feedback RLS
- **File:** `supabase/migrations/`
- **Issue:** user_feedback table may lack proper RLS policy
- **Fix:** Add RLS policy for user isolation
- **Test:** Verify RLS prevents cross-user access

---

## 2.2 High Priority Issues (33 total)

### Security High (5)
1. **SEC-H-001**: Audit logs not tamper-resistant (`server/src/lib/security/auditLogger.js:110-119`)
2. **SEC-H-002**: PII logged in security events (`server/src/lib/security/securityMiddleware.js:97-104`)
3. **SEC-H-003**: Boundary markers predictable (`server/src/lib/security/promptArmor.js:14-16`)
4. **SEC-H-004**: Rate limit middleware fails open (`server/src/lib/security/securityMiddleware.js:231-236`)
5. **SEC-H-005**: Insufficient homoglyph detection (`server/src/lib/security/injectionDetector.js:39-48`)

### AI Pipeline High (4)
1. **AI-H-001**: No model fallback on LLM failure (`server/src/lib/shared/llmRetryHandler.js:30-111`)
2. **AI-H-002**: Missing input sanitization before LLM (`server/src/lib/prompts.js:403-465`)
3. **AI-H-003**: Stenographer not integrated into pipeline (`server/src/lib/judgeEngine.js`)
4. **AI-H-004**: No rate limit handling for OpenRouter (`server/src/lib/openrouter.js:84-104`)

### Backend API High (5)
1. **API-H-001**: Webhook replay attack missing (`server/src/routes/webhooks.js:89-267`)
2. **API-H-002**: Court routes dev bypass risk (`server/src/routes/court.js:21-53`)
3. **API-H-003**: Missing rate limiting on LLM endpoints (`server/src/routes/calendar.js`, `dailyQuestions.js`, `insights.js`)
4. **API-H-004**: Cases route allows client verdict (`server/src/routes/cases.js:79,121-132`)
5. **API-H-005**: Partner verification missing on stats (`server/src/routes/stats.js:36-51`)

### Frontend High (6)
1. **FE-H-001**: Partner store event listeners at module scope (`client/src/store/usePartnerStore.js:67-81`)
2. **FE-H-002**: Court store socket reference is global mutable (`client/src/store/useCourtStore.js:44-46`)
3. **FE-H-003**: Cache store no memory limits (`client/src/store/useCacheStore.js:153-520`)
4. **FE-H-004**: Subscription store no offline handling (`client/src/store/useSubscriptionStore.js:139-181`)
5. **FE-H-005**: Circular dependencies between stores (`useAuthStore`, `usePartnerStore`, `useLevelStore`)
6. **FE-H-006**: RevenueCat key exposure verification (`client/src/services/revenuecat.js:15`)

### WebSocket High (4)
1. **WS-H-001**: In-memory session loss on restart (`server/src/lib/court/SessionStateRepository.js:26-27`)
2. **WS-H-002**: Socket disconnect doesn't notify partner (`server/src/lib/courtWebSocket.js:473-481`)
3. **WS-H-003**: No resolution ID validation (`server/src/lib/court/ResolutionService.js:33-64`)
4. **WS-H-004**: Distributed lock fails open (`server/src/lib/redis.js:100-107`)

### Mobile/Accessibility High (7)
1. **MOB-H-001**: Missing keyboard avoidance (`client/src/layouts/MainLayout.jsx`)
2. **MOB-H-002**: Insufficient touch targets (`client/src/layouts/MainLayout.jsx:171-176`)
3. **MOB-H-003**: Missing aria-labels (`client/src/pages/DashboardPage.jsx`)
4. **MOB-H-004**: Missing focus management in modals (`client/src/components/Paywall.jsx`)
5. **MOB-H-005**: Reduced motion not respected (`client/src/components/Paywall.jsx:141-168`)
6. **MOB-H-006**: Color contrast issues (`client/src/pages/DashboardPage.jsx:473-489`)
7. **MOB-H-007**: Missing Escape key handler (`client/src/components/Paywall.jsx`)

### Database High (3)
1. **DB-H-001**: Stats function parameter validation (`supabase/migrations/`)
2. **DB-H-002**: Missing export request RLS policy (`supabase/migrations/`)
3. **DB-H-003**: Unnecessary function grants (`supabase/migrations/`)

---

## 2.3 Medium Priority Issues (45 total)

[See PRODUCTION_READINESS_REPORT.md for full list]

Key categories:
- Input validation gaps
- Pagination missing on list endpoints
- Error response format inconsistency
- Cache store memory management
- Animation optimization
- Translation completeness

---

## 2.4 Test Failures to Fix

### useAuthStore Tests (20 failures)
- **File:** `client/src/store/useAuthStore.test.js`
- **Issue:** Mock missing `SUPPORTED_LANGUAGES` export
- **Fix:**
```javascript
vi.mock('../i18n/languageConfig', () => ({
    DEFAULT_LANGUAGE: 'en',
    SUPPORTED_LANGUAGES: ['en', 'zh-Hans'],
    normalizeLanguage: vi.fn((lang) => lang === 'zh-Hans' || lang === 'en' ? lang : null)
}));
```

### useAppStore Tests (2 failures)
- **File:** `client/src/store/useAppStore.test.js`
- **Issue:** API mock configuration for fetchCaseHistory and fetchAppreciations
- **Fix:** Review async timing and mock response configuration

### courtWebSocket Tests (2 failures)
- **File:** `server/src/lib/courtWebSocket.test.js`
- **Issue:** Test timeouts (5 seconds exceeded)
- **Fix:** Increase timeout and verify acknowledgment callbacks

---

# PART 3: AUTONOMOUS FIX AGENT PROMPT

## Agent Instructions

You are an autonomous multi-agent system tasked with fixing all identified issues in the Pause app codebase. You must work systematically through all issues until they are completely resolved.

### Working Directory
```
/Users/charleszheng/Desktop/Ideas/Pause
```

### Agent Architecture

You will orchestrate the following specialized agents:

1. **Security Fix Agent** - Fixes security-related issues (SEC-*)
2. **AI Pipeline Fix Agent** - Fixes AI/LLM issues (AI-*)
3. **Backend Fix Agent** - Fixes API route issues (API-*)
4. **Frontend Fix Agent** - Fixes React/Zustand issues (FE-*)
5. **WebSocket Fix Agent** - Fixes real-time issues (WS-*)
6. **Mobile Fix Agent** - Fixes Capacitor/accessibility issues (MOB-*)
7. **Database Fix Agent** - Fixes Supabase/RLS issues (DB-*)
8. **Test Fix Agent** - Fixes failing tests
9. **Verification Agent** - Runs tests and verifies fixes

### Execution Loop

```
WHILE issues_remaining > 0:
    1. SELECT next priority issue (CRITICAL > HIGH > MEDIUM)
    2. DISPATCH to appropriate specialist agent
    3. AGENT implements fix
    4. VERIFICATION agent runs relevant tests
    5. IF tests pass:
         MARK issue as RESOLVED
       ELSE:
         RETRY with error context (max 3 attempts)
    6. UPDATE progress tracker

END CONDITION: All tests pass AND all CRITICAL/HIGH issues resolved
```

### Priority Order

Fix issues in this exact order:

#### Phase 1: Critical Fixes (MUST complete all)
```
1. CRITICAL-004: isProd undefined (5 min fix, unblocks economy tests)
2. CRITICAL-009: Initialize promise reset (15 min)
3. CRITICAL-005: Rate limit bypass (30 min)
4. CRITICAL-003: Output blocking severity (30 min)
5. CRITICAL-001: Addendum security (30 min)
6. CRITICAL-002: Moderation fail-closed (1 hr)
7. CRITICAL-006: WebSocket auth check (30 min)
8. CRITICAL-007: Rate limit cleanup (1 hr)
9. CRITICAL-008: Token refresh retry (2 hr)
10. CRITICAL-010: Deep linking (1 hr)
11. CRITICAL-011: ErrorBoundary i18n (30 min)
12. CRITICAL-012: user_feedback RLS (30 min)
```

#### Phase 2: Test Fixes (Unblocks verification)
```
1. Fix useAuthStore mock configuration
2. Fix useAppStore API mock
3. Fix courtWebSocket test timeouts
```

#### Phase 3: High Priority Fixes
```
[Process all 33 HIGH issues by domain]
```

### Agent Prompts by Domain

#### Security Fix Agent Prompt
```
You are the Security Fix Agent. Fix security issues in the Pause app.

For each issue:
1. Read the file at the specified path
2. Understand the current implementation
3. Implement the fix as specified
4. Ensure no regressions in surrounding code
5. Add or update tests if needed

Current issue to fix: [ISSUE_ID]
File: [FILE_PATH]
Lines: [LINE_NUMBERS]
Problem: [DESCRIPTION]
Fix: [SOLUTION]

After fixing, report:
- Files modified
- Lines changed
- Test command to verify
```

#### Frontend Fix Agent Prompt
```
You are the Frontend Fix Agent. Fix React/Zustand issues in the Pause app client.

For each issue:
1. Read the store/component file
2. Understand the state management pattern
3. Implement the fix maintaining Zustand patterns
4. Ensure no circular dependencies introduced
5. Update tests if needed

Current issue to fix: [ISSUE_ID]
File: [FILE_PATH]
Lines: [LINE_NUMBERS]
Problem: [DESCRIPTION]
Fix: [SOLUTION]

After fixing, run: cd client && npm test -- [RELEVANT_TEST]
```

#### Test Fix Agent Prompt
```
You are the Test Fix Agent. Fix failing tests in the Pause app.

For each test failure:
1. Read the test file
2. Read the source file being tested
3. Understand why the test is failing
4. Fix the mock configuration or test setup
5. Verify the test passes

Current failure: [TEST_NAME]
File: [TEST_FILE]
Error: [ERROR_MESSAGE]
Root cause: [ANALYSIS]

After fixing, run full test suite to verify no regressions.
```

#### Verification Agent Prompt
```
You are the Verification Agent. Verify fixes are working correctly.

For each fix:
1. Run the specific test command provided
2. If tests fail, report the failure details
3. If tests pass, verify no regressions by running related tests
4. Report final status

Test command: [COMMAND]
Expected result: All tests pass

Report:
- Test results (pass/fail count)
- Any new failures introduced
- Coverage impact if applicable
```

### Detailed Fix Instructions

#### CRITICAL-004: isProd Undefined
```javascript
// File: server/src/routes/economy.js
// Add after line 10 (after imports):
const isProd = process.env.NODE_ENV === 'production';

// Verify: cd server && npm test -- economy
```

#### CRITICAL-009: Initialize Promise Reset
```javascript
// File: client/src/store/useAuthStore.js
// Find the initialize function around line 282
// In the catch block, add:
initializePromise = null;

// Before:
}).catch((error) => {
    console.error('[Auth] Initialization error:', error);
    throw error;
});

// After:
}).catch((error) => {
    console.error('[Auth] Initialization error:', error);
    initializePromise = null; // Reset to allow retry
    throw error;
});

// Verify: cd client && npm test -- useAuthStore
```

#### CRITICAL-005: Rate Limit Bypass
```javascript
// File: server/src/lib/security/securityMiddleware.js
// Line 25, change:
// FROM:
const userId = req.user?.id || req.body?.userId || req.query?.userId || 'anonymous';

// TO:
const userId = req.user?.id || `ip:${req.ip}`;

// Verify: cd server && npm test -- security
```

#### CRITICAL-003: Output Blocking Severity
```javascript
// File: server/src/lib/security/outputValidator.js
// Line 312-315, change shouldBlockOutput:

// FROM:
function shouldBlockOutput(output) {
  const compromise = detectOutputCompromise(output);
  return compromise.isCompromised && compromise.confidence === 'HIGH';
}

// TO:
function shouldBlockOutput(output) {
  const compromise = detectOutputCompromise(output);
  // Block on HIGH confidence OR any CRITICAL severity detection
  if (compromise.isCompromised && compromise.confidence === 'HIGH') {
    return true;
  }
  // Also block if any detection has CRITICAL severity
  if (compromise.detections && compromise.detections.some(d => d.severity === 'CRITICAL')) {
    return true;
  }
  return false;
}

// Verify: cd server && npm test -- outputValidator
```

#### CRITICAL-001: Addendum Security
```javascript
// File: server/src/lib/courtWebSocket.js
// Line 372-389, modify court:submit_addendum handler:

// Add import at top if not present:
const { processSecureInput } = require('./security');
const { securityConfig } = require('./security/config/securityConfig');

// Modify handler:
socket.on('court:submit_addendum', async ({ text }, ack) => {
    try {
        // Rate limit check (existing)
        if (!checkWsRateLimit(socket.userId, 'court:submit_addendum')) {
            return ack?.({ success: false, error: 'Rate limited' });
        }

        // ADD: Security validation for addendum text
        const securityCheck = processSecureInput(text || '', {
            userId: socket.userId,
            fieldName: 'addendum',
            maxLength: securityConfig.fieldLimits.addendum || 2000,
            endpoint: 'court',
        });

        if (securityCheck.action === 'BLOCK') {
            console.warn(`[WS] Blocked addendum from ${socket.userId}: ${securityCheck.reason}`);
            return ack?.({ success: false, error: 'Content not allowed' });
        }

        const sanitizedText = securityCheck.sanitizedValue;
        await courtSessionManager.submitAddendum(socket.userId, sanitizedText);
        ack?.({ success: true });
    } catch (error) {
        console.error('[WS] Addendum error:', error);
        ack?.({ success: false, error: safeErrorMessage(error) });
    }
});

// Verify: cd server && npm test -- courtWebSocket
```

#### CRITICAL-002: Moderation Fail-Closed
```javascript
// File: server/src/lib/openrouter.js
// Lines 155-158, change catch block:

// FROM:
} catch (error) {
    console.error('[OpenRouter] Moderation check failed:', error);
    return { results: [{ flagged: false, categories: {} }] };
}

// TO:
} catch (error) {
    console.error('[OpenRouter] Moderation check failed:', error);
    // Fail-closed: treat as flagged when API fails
    return {
        results: [{
            flagged: true,
            categories: { error: true },
            _moderationError: true
        }]
    };
}

// Verify: cd server && npm test -- judgeEngine
```

#### CRITICAL-008: Token Refresh Retry
```javascript
// File: client/src/services/api.js
// Add response interceptor after request interceptor (around line 65):

// Add response interceptor for 401 handling
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // If 401 and not already retrying
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                // Attempt to refresh session
                const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();

                if (refreshError || !session) {
                    // Refresh failed, emit logout event
                    eventBus.emit(EVENTS.AUTH_LOGOUT);
                    return Promise.reject(error);
                }

                // Update token and retry
                originalRequest.headers.Authorization = `Bearer ${session.access_token}`;
                return api(originalRequest);
            } catch (refreshError) {
                console.error('[API] Token refresh failed:', refreshError);
                eventBus.emit(EVENTS.AUTH_LOGOUT);
                return Promise.reject(error);
            }
        }

        return Promise.reject(error);
    }
);

// Verify: cd client && npm test -- api
```

#### Test Mock Fix: useAuthStore
```javascript
// File: client/src/store/useAuthStore.test.js
// Find the vi.mock for languageConfig (around line 69-72)
// Replace with:

vi.mock('../i18n/languageConfig', () => ({
    DEFAULT_LANGUAGE: 'en',
    SUPPORTED_LANGUAGES: ['en', 'zh-Hans'],
    normalizeLanguage: vi.fn((lang) => {
        if (lang === 'zh-Hans' || lang === 'en') return lang;
        return null;
    })
}));

// Verify: cd client && npm test -- useAuthStore
```

### End Conditions

The autonomous agent should STOP when ALL of the following are true:

1. **All Critical Issues Resolved:** 12/12 CRITICAL issues have verified fixes
2. **All Tests Passing:**
   - `cd server && npm test` returns 0 failures
   - `cd client && npm test` returns 0 failures
3. **No Regressions:** Test count has not decreased
4. **All High Issues Addressed:** 33/33 HIGH issues have fixes (can be in separate PRs)

### Progress Tracking

Maintain a status tracker:

```markdown
## Fix Progress

### Critical Issues (12 total)
- [x] CRITICAL-001: Addendum security - FIXED
- [x] CRITICAL-002: Moderation fail-closed - FIXED
- [ ] CRITICAL-003: Output blocking - IN PROGRESS
...

### Test Status
- Server: XX/XX passing
- Client: XX/XX passing

### Current Phase: [1-Critical | 2-Tests | 3-High]
### Current Issue: [ISSUE_ID]
### Attempts: [1/3]
```

### Error Recovery

If a fix fails verification:
1. Read the test error output
2. Analyze what went wrong
3. Adjust the fix
4. Retry (max 3 attempts per issue)
5. If still failing after 3 attempts, flag for human review and move to next issue

### Commands Reference

```bash
# Full test suites
cd /Users/charleszheng/Desktop/Ideas/Pause/server && npm test
cd /Users/charleszheng/Desktop/Ideas/Pause/client && npm test

# Specific test patterns
npm test -- [pattern]  # e.g., npm test -- useAuthStore

# Coverage
npm run test:coverage

# Lint
npm run lint
```

---

# PART 4: EXECUTION CHECKLIST

## Pre-Execution Verification
- [ ] Codebase is at expected state (git status clean or known changes)
- [ ] Node modules installed (`npm run install:all` from root)
- [ ] Environment variables configured

## Execution Order
1. [ ] Fix CRITICAL-004 (isProd undefined) - Unblocks other tests
2. [ ] Fix test mock issues - Unblocks verification
3. [ ] Fix remaining CRITICAL issues in order
4. [ ] Run full test suite - Verify no regressions
5. [ ] Fix HIGH issues by domain
6. [ ] Final verification

## Post-Execution Verification
- [ ] All server tests pass
- [ ] All client tests pass
- [ ] No console errors in development mode
- [ ] Manual smoke test of critical flows:
  - [ ] Authentication (login/logout)
  - [ ] Partner connection
  - [ ] Court session (serve → verdict)
  - [ ] Subscription flow

---

*This document provides complete context for an autonomous agent to fix all identified issues in the Pause app codebase.*
