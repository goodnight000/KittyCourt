# Cat Judge - Architecture Refactoring Plan
**Version:** 1.0
**Date:** 2026-01-03
**Strategy:** Balanced server/client approach with tests
**Git Strategy:** Long-lived `refactor/architecture-2026` branch

---

## Executive Summary

This refactoring plan addresses **critical code quality issues** across the Cat Judge codebase, identified through comprehensive analysis by four specialized review agents. The plan targets:

- **~6,400 lines** of complex React components
- **~5,800 lines** of server core logic
- **~700 lines** of duplicate code in API routes
- **High coupling** in Zustand stores

**Timeline Estimate:** 3-4 weeks with parallel workstreams
**Risk Level:** Medium (mitigated by tests and incremental approach)
**Expected Benefits:**
- 40-50% reduction in file sizes for critical components
- 80%+ test coverage for extracted business logic
- Elimination of circular dependencies
- Improved onboarding time for new developers (from 2-3 weeks to 3-5 days)

---

## Phase 1: Foundation - Shared Utilities & Middleware (Week 1)

### 1.1 Server-Side Utilities

#### File: `server/src/lib/shared/dateTimeUtils.js` (NEW)
**Consolidates:** Date logic from `challengeService.js` (~190 lines) + `xpService.js` (~50 lines)

**Functions to Extract:**
```javascript
// From challengeService.js
export const getEtDateString = (date = new Date()) => { /* lines 109-123 */ };
export const getEtWeekdayIndex = (dateStr) => { /* lines 125-139 */ };
export const addDaysToDateString = (dateStr, days) => { /* lines 141-153 */ };
export const getPeriodRange = (cadence, dateStr) => { /* lines 155-193 */ };
export const getTimeZoneOffsetMinutes = (date, tzName) => { /* lines 99-107 */ };
export const getEtMidnightIso = (dateStr) => { /* lines 195-205 */ };
export const getEtParts = (dateStr) => { /* lines 207-223 */ };
export const getStreakDayEt = (date) => { /* lines 225-238 */ };

// From xpService.js
export const formatDateForComparison = (date) => { /* lines 108-120 */ };
export const getStartOfDay = (date) => { /* lines 122-134 */ };
```

**Tests to Write:**
- `dateTimeUtils.test.js` - Test all 10 functions with edge cases (timezone boundaries, DST, leap years)

**Migration Strategy:**
1. Create new file with extracted functions
2. Update `challengeService.js` and `xpService.js` imports
3. Run existing integration tests to verify behavior unchanged
4. Remove old implementations

**Files Modified:**
- `server/src/lib/challengeService.js` (delete lines 99-238)
- `server/src/lib/xpService.js` (delete lines 108-161)

**Lines Saved:** ~240 duplicate lines

---

#### File: `server/src/lib/shared/llmRetryHandler.js` (NEW)
**Consolidates:** Retry logic from `judgeEngine.js` (3 occurrences), `eventPlanner.js` (1 occurrence)

**Function Signature:**
```javascript
/**
 * Calls an LLM with automatic retry, JSON parsing, and Zod validation
 * @param {Object} config - LLM call configuration (model, messages, etc.)
 * @param {ZodSchema} schema - Zod schema for validation
 * @param {Object} options - { maxRetries: 3, backoffMs: 1000, label: 'LLM Call' }
 * @returns {Promise<Object>} Validated parsed response
 */
export async function callLLMWithRetry(config, schema, options = {}) {
  const { maxRetries = 3, backoffMs = 1000, label = 'LLM Call' } = options;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await createChatCompletion(config);
      const content = response.choices[0].message.content;

      // Try direct parse first
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch {
        // Fallback to repair
        parsed = repairAndParseJSON(content);
      }

      // Validate with Zod schema
      const validated = schema.parse(parsed);
      return validated;

    } catch (error) {
      const isLastAttempt = attempt === maxRetries;

      if (isLastAttempt) {
        throw new Error(`${label} failed after ${maxRetries} attempts: ${error.message}`);
      }

      const delay = backoffMs * attempt;
      console.warn(`[llmRetryHandler] ${label} attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

**Tests to Write:**
- `llmRetryHandler.test.js` - Mock LLM failures, test retry backoff, validation errors

**Migration Strategy:**
1. Create new file with generic retry logic
2. Update `judgeEngine.js` functions:
   - `runAnalystRepair` (lines 80-131) → use `callLLMWithRetry`
   - `runPrimingJoint` (lines 155-201) → use `callLLMWithRetry`
   - `runHybridResolution` (lines 228-268) → use `callLLMWithRetry`
3. Update `eventPlanner.js:generateEventPlan` (lines 395-555)
4. Verify verdicts still generate correctly via integration tests

**Files Modified:**
- `server/src/lib/judgeEngine.js` (simplify 3 functions)
- `server/src/lib/eventPlanner.js` (simplify 1 function)

**Lines Saved:** ~120 duplicate retry logic

---

#### File: `server/src/lib/shared/errorUtils.js` (NEW)
**Consolidates:** `safeErrorMessage` helper from 8 route files

**Implementation:**
```javascript
const isProd = process.env.NODE_ENV === 'production';

/**
 * Returns safe error message for API responses
 * In production: generic message
 * In development: full error details
 */
export const safeErrorMessage = (error) =>
  isProd ? 'Internal server error' : (error?.message || String(error));

/**
 * Standardized error response helper
 * @param {Response} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} errorCode - Machine-readable error code (e.g., 'NO_PARTNER')
 * @param {string} message - Human-readable message
 */
export const sendError = (res, statusCode, errorCode, message) => {
  return res.status(statusCode).json({
    errorCode,
    error: message,
    ...(isProd ? {} : { stack: new Error().stack })
  });
};
```

**Migration Strategy:**
1. Create new file
2. Update 8 route files to import from shared location:
   - `appreciations.js`, `calendar.js`, `cases.js`, `challenges.js`, `economy.js`, `insights.js`, `levels.js`, `memories.js`
3. Standardize to use `sendError` throughout (currently only 3 routes use it)

**Files Modified:** 8 route files

**Lines Saved:** ~16 duplicate lines (minor but improves consistency)

---

### 1.2 Server-Side Middleware

#### File: `server/src/middleware/requirePartner.js` (NEW)
**Consolidates:** Partner validation from 11+ routes

**Implementation:**
```javascript
const { requireAuthUserId, getPartnerIdForUser, requireSupabase } = require('../lib/auth.js');

/**
 * Middleware that ensures authenticated user has a connected partner
 * Attaches userId, partnerId, and supabase client to req object
 */
async function requirePartner(req, res, next) {
  try {
    const userId = await requireAuthUserId(req);
    const supabase = requireSupabase();
    const partnerId = await getPartnerIdForUser(supabase, userId);

    if (!partnerId) {
      return res.status(400).json({
        errorCode: 'NO_PARTNER',
        error: 'No partner connected. Please connect with a partner first.'
      });
    }

    // Attach to request for downstream handlers
    req.userId = userId;
    req.partnerId = partnerId;
    req.supabase = supabase;
    req.coupleIds = [userId, partnerId].sort(); // For RLS queries

    next();
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message });
  }
}

module.exports = { requirePartner };
```

**Migration Strategy:**
1. Create new middleware file
2. Update 11 routes to use middleware:
   - `appreciations.js` (line 33)
   - `calendar.js` (lines 23, 91, 151, 205)
   - `cases.js` (line 74)
   - `challenges.js` (lines 28-35)
   - `court.js` (lines 80-86)
   - `dailyQuestions.js` (lines 65-76, 95-96, 462-463)
   - `insights.js` (lines 38-42)
   - `levels.js` (lines 35-39)
3. Replace inline validation with: `router.get('/path', requirePartner, async (req, res) => { ... })`

**Example Before:**
```javascript
router.post('/', async (req, res) => {
  try {
    const viewerId = await requireAuthUserId(req);
    const supabase = requireSupabase();
    const partnerId = await getPartnerIdForUser(supabase, viewerId);
    if (!partnerId) {
      return res.status(400).json({ error: 'No partner connected' });
    }
    // ... handler logic
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error) });
  }
});
```

**Example After:**
```javascript
router.post('/', requirePartner, async (req, res) => {
  try {
    // req.userId, req.partnerId, req.supabase already available
    const { userId, partnerId, supabase } = req;
    // ... handler logic
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error) });
  }
});
```

**Files Modified:** 11 route files

**Lines Saved:** ~110 duplicate validation lines

---

#### File: `server/src/middleware/asyncHandler.js` (NEW)
**Problem:** `court.js` manually wraps async routes in IIFEs, risking unhandled rejections

**Implementation:**
```javascript
/**
 * Wraps async route handlers to catch promise rejections
 * Prevents unhandled promise rejections from crashing the server
 */
const asyncHandler = (fn) => (req, res, next) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { asyncHandler };
```

**Migration Strategy:**
1. Create middleware file
2. Update `court.js` routes (lines 42-63, 212-226, 249-263) to use wrapper
3. Consider applying to other routes proactively

**Example Before:**
```javascript
router.get('/state', (req, res) => {
  (async () => {
    try {
      // ... async logic
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  })();
});
```

**Example After:**
```javascript
const { asyncHandler } = require('../middleware/asyncHandler.js');

router.get('/state', asyncHandler(async (req, res) => {
  // ... async logic (errors caught by middleware)
}));
```

**Files Modified:** `court.js`, potentially others

**Lines Saved:** ~30 lines of boilerplate IIFEs

---

#### File: `server/src/lib/auth.js` (UPDATE)
**Add new helper to eliminate duplication in `subscription.js` and `usage.js`**

**New Function:**
```javascript
/**
 * Returns authenticated user ID or null (no throwing)
 * Used for optional authentication scenarios
 */
async function getAuthUserIdOrNull(req) {
  try {
    return await requireAuthUserId(req);
  } catch (error) {
    return null;
  }
}

exports.getAuthUserIdOrNull = getAuthUserIdOrNull;
```

**Migration Strategy:**
1. Add function to `auth.js`
2. Replace `getUserIdFromAuth` in `subscription.js` (lines 40-56) with import
3. Replace `getUserIdFromAuth` in `usage.js` (lines 126-143) with import

**Files Modified:**
- `server/src/lib/auth.js` (+10 lines)
- `server/src/routes/subscription.js` (-17 lines)
- `server/src/routes/usage.js` (-18 lines)

**Lines Saved:** ~25 lines

---

### 1.3 Client-Side Utilities

#### File: `client/src/utils/promiseHelpers.js` (NEW)
**Consolidates:** Timeout wrapper patterns from `useAuthStore.js` (2 occurrences)

**Implementation:**
```javascript
/**
 * Races a promise against a timeout
 * @param {Promise} promise - The promise to race
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} label - Label for error message
 * @returns {Promise} Resolves with promise result or rejects on timeout
 */
export const withTimeout = (promise, timeoutMs, label = 'Operation') => {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`${label} timeout after ${timeoutMs}ms`)), timeoutMs)
  );

  return Promise.race([promise, timeoutPromise]);
};

/**
 * Races a promise against a timeout with fallback
 * @param {Promise} promise - The promise to race
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {Function} onTimeout - Callback to invoke on timeout
 * @returns {Promise} Resolves with promise result or onTimeout result
 */
export const raceWithTimeout = async (promise, timeoutMs, onTimeout) => {
  try {
    return await withTimeout(promise, timeoutMs);
  } catch (error) {
    if (error.message.includes('timeout')) {
      return await onTimeout();
    }
    throw error;
  }
};
```

**Tests to Write:**
- `promiseHelpers.test.js` - Test timeout behavior, fallback logic

**Migration Strategy:**
1. Create new file
2. Update `useAuthStore.js`:
   - Replace timeout pattern in `loadAuthContext` (lines 50-58)
   - Replace timeout pattern in `signIn` (lines 367-377)

**Files Modified:** `useAuthStore.js`

**Lines Saved:** ~20 lines

---

#### File: `client/src/utils/dateFormatters.js` (NEW)
**Consolidates:** Date formatting from `CalendarPage.jsx`, `CaseDetailPage.jsx`, `DailyMeowPage.jsx`

**Implementation:**
```javascript
import { useTranslation } from 'react-i18next';

/**
 * Parses local date string (YYYY-MM-DD) to Date object
 */
export const parseLocalDate = (dateString) => {
  if (!dateString) return null;
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/**
 * Formats Date to local date string (YYYY-MM-DD)
 */
export const formatLocalDate = (date) => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Formats date for display with i18n support
 */
export const formatDisplayDate = (date, locale = 'en') => {
  if (!date) return '';
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
};

/**
 * Gets relative time string (e.g., "2 days ago")
 */
export const getRelativeTime = (date, locale = 'en') => {
  if (!date) return '';
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return formatDisplayDate(date, locale);
};
```

**Tests to Write:**
- `dateFormatters.test.js` - Test parsing, formatting, timezone edge cases

**Migration Strategy:**
1. Create new file
2. Update components:
   - `CalendarPage.jsx` - Replace `parseLocalDate` inline function
   - `CaseDetailPage.jsx` - Use `formatDisplayDate` for verdict timestamps
   - `DailyMeowPage.jsx` - Use `getRelativeTime` for question dates

**Files Modified:** 3 component files

**Lines Saved:** ~50 lines (minor but improves consistency)

---

#### File: `client/src/components/shared/Modal.jsx` (NEW)
**Consolidates:** Modal wrapper pattern from 6+ components

**Implementation:**
```javascript
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

/**
 * Reusable modal wrapper with animation and accessibility
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md', // sm, md, lg, xl
  showCloseButton = true
}) {
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-[60] p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={`glass-card p-6 w-full ${sizeClasses[size]} pointer-events-auto relative`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              {(title || showCloseButton) && (
                <div className="flex items-center justify-between mb-4">
                  {title && <h2 className="text-xl font-bold">{title}</h2>}
                  {showCloseButton && (
                    <button
                      onClick={onClose}
                      className="p-2 hover:bg-court-tan/50 rounded-full transition-colors"
                    >
                      <X size={20} />
                    </button>
                  )}
                </div>
              )}

              {/* Content */}
              {children}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
```

**Tests to Write:**
- `Modal.test.jsx` - Test open/close, accessibility, escape key, backdrop click

**Migration Strategy:**
1. Create new component
2. Update components using inline modal patterns:
   - `CalendarPage.jsx` - Use for AddEventModal, EventDetailsModal, PlanningModal
   - `ProfilesPage.jsx` - Use for EditProfileModal
   - `DashboardPage.jsx` - Use for GoodDeedModal
   - Others as needed

**Files Modified:** 6+ component files

**Lines Saved:** ~200 lines of duplicate modal markup

---

#### File: `client/src/components/shared/LoadingSpinner.jsx` (NEW)
**Consolidates:** Spinner markup from 8+ components

**Implementation:**
```javascript
import { motion } from 'framer-motion';

export default function LoadingSpinner({ size = 'md', color = 'court-gold' }) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  return (
    <motion.div
      className={`${sizes[size]} border-4 border-${color}/20 border-t-${color} rounded-full`}
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
    />
  );
}
```

**Migration Strategy:**
1. Create new component
2. Replace inline spinner divs across codebase
3. Standardize loading states

**Files Modified:** 8+ component files

**Lines Saved:** ~80 lines

---

### 1.4 Phase 1 Testing Strategy

**Unit Tests to Write:**
- `dateTimeUtils.test.js` - 10 functions, 50+ test cases
- `llmRetryHandler.test.js` - Mock LLM, test retry logic, 20+ test cases
- `promiseHelpers.test.js` - Timeout behavior, 15+ test cases
- `dateFormatters.test.js` - Parsing, formatting, i18n, 25+ test cases
- `Modal.test.jsx` - Accessibility, interactions, 15+ test cases
- `LoadingSpinner.test.jsx` - Rendering, sizes, 10+ test cases

**Integration Tests to Verify:**
- Server: Run existing judge engine tests to ensure verdicts still generate
- Client: Run existing component tests to ensure UI still works

**Test Coverage Goal:** 85%+ for new utility files

---

### 1.5 Phase 1 Success Metrics

- ✅ ~700 lines of duplicate code eliminated
- ✅ 11 API routes now use shared middleware
- ✅ 6+ React components using shared Modal wrapper
- ✅ All new utilities have 85%+ test coverage
- ✅ No regressions in existing functionality
- ✅ CI/CD pipeline passes all checks

---

## Phase 2: Server Core Logic Refactoring (Week 2)

### 2.1 Court Session Manager Refactoring

#### File: `server/src/lib/courtSessionManager.js`
**Current:** 1,211 lines with deep nesting
**Target:** <600 lines with extracted services

---

#### Refactor 2.1.1: `submitResolutionPick` Function (Lines 554-632)

**Problem:** 79-line function with 5-level nesting, handles mismatch state, validation, lock management, and state transitions

**New Architecture:**
```
server/src/lib/
  ├── courtSessionManager.js (orchestrator)
  └── court/
      ├── MismatchResolutionHandler.js (NEW)
      └── ResolutionValidator.js (NEW)
```

**New File: `court/MismatchResolutionHandler.js`**
```javascript
class MismatchResolutionHandler {
  /**
   * Validates mismatch resolution pick against locking rules
   * @returns {{ valid: boolean, error?: string }}
   */
  validateMismatchPick(session, userId, resolutionId) {
    const mismatchPicks = session.mismatchPicks || { userA: null, userB: null };
    const isUserA = String(session.userAId) === String(userId);
    const userKey = isUserA ? 'userA' : 'userB';
    const partnerKey = isUserA ? 'userB' : 'userA';

    // Check lock constraints
    const { lockId, lockOwner } = session;
    if (lockId && lockOwner && lockOwner !== userId) {
      if (lockId !== resolutionId) {
        return {
          valid: false,
          error: `Your partner locked option ${lockId}. You must pick the same.`
        };
      }
    }

    // Check partner pick constraints
    if (mismatchPicks[partnerKey] && mismatchPicks[partnerKey] !== resolutionId) {
      return {
        valid: false,
        error: `Your partner chose option ${mismatchPicks[partnerKey]}. Please align.`
        };
    }

    return { valid: true };
  }

  /**
   * Updates mismatch picks and checks for resolution
   * @returns {{ resolved: boolean, agreedResolutionId?: string }}
   */
  updatePicks(session, userId, resolutionId) {
    const isUserA = String(session.userAId) === String(userId);
    const userKey = isUserA ? 'userA' : 'userB';
    const partnerKey = isUserA ? 'userB' : 'userA';

    session.mismatchPicks = session.mismatchPicks || {};
    session.mismatchPicks[userKey] = resolutionId;

    // Check if both picked the same
    const userPick = session.mismatchPicks[userKey];
    const partnerPick = session.mismatchPicks[partnerKey];

    if (userPick && partnerPick && userPick === partnerPick) {
      return { resolved: true, agreedResolutionId: userPick };
    }

    return { resolved: false };
  }

  /**
   * Handles lock/unlock operations
   */
  handleLock(session, userId, resolutionId, shouldLock) {
    if (shouldLock) {
      session.lockId = resolutionId;
      session.lockOwner = userId;
    } else {
      session.lockId = null;
      session.lockOwner = null;
    }
  }
}

module.exports = new MismatchResolutionHandler();
```

**Updated `courtSessionManager.js:submitResolutionPick`:**
```javascript
const MismatchHandler = require('./court/MismatchResolutionHandler');

async submitResolutionPick(userId, resolutionId, shouldLock = false) {
  const session = this._getSessionForUser(userId);
  if (!session) throw this._error('Session not found', 404);

  // Validate phase
  if (session.phase !== PHASE.RESOLUTION && !this._isMismatchActive(session)) {
    throw this._error('Not in resolution phase', 400);
  }

  // Validate resolution ID
  if (!session.jointMenu?.some(r => r.id === resolutionId)) {
    throw this._error('Invalid resolution ID', 400);
  }

  // Handle mismatch scenario
  if (this._isMismatchActive(session)) {
    const validation = MismatchHandler.validateMismatchPick(session, userId, resolutionId);
    if (!validation.valid) {
      throw this._error(validation.error, 400);
    }

    MismatchHandler.handleLock(session, userId, resolutionId, shouldLock);
    const result = MismatchHandler.updatePicks(session, userId, resolutionId);

    if (result.resolved) {
      // Both agreed, finalize
      await this._finalizeResolution(session, result.agreedResolutionId, 'user-hybrid-agreed');
    }

    return { success: true, mismatchResolved: result.resolved };
  }

  // Standard resolution flow
  await this._finalizeResolution(session, resolutionId, 'user-pick');
  return { success: true };
}
```

**Tests to Write:**
- `MismatchResolutionHandler.test.js` - Unit tests for all methods
- `courtSessionManager.integration.test.js` - Test mismatch flow end-to-end

**Lines Reduced:** From 79 lines to ~35 lines in main function

---

#### Refactor 2.1.2: `_reconstructFromDB` Function (Lines 1095-1191)

**Problem:** 97-line function handling deserialization, phase inference, language normalization, state reconstruction

**New File: `court/SessionDeserializer.js`**
```javascript
class SessionDeserializer {
  /**
   * Parses phase from database record with fallbacks
   */
  parsePhase(dbRecord) {
    const rawPhase = dbRecord.phase || 'idle';
    const validPhases = Object.values(PHASE);

    if (validPhases.includes(rawPhase)) {
      return rawPhase;
    }

    // Infer phase from state
    if (dbRecord.verdict) return PHASE.VERDICT;
    if (dbRecord.joint_menu) return PHASE.JOINT_READY;
    if (dbRecord.evidence_a || dbRecord.evidence_b) return PHASE.EVIDENCE;

    return PHASE.IDLE;
  }

  /**
   * Normalizes language settings
   */
  parseLanguageSettings(dbRecord) {
    const userALang = dbRecord.user_a_language || 'en';
    const userBLang = dbRecord.user_b_language || 'en';

    return {
      userALanguage: userALang === 'zh-Hans' ? 'zh-Hans' : 'en',
      userBLanguage: userBLang === 'zh-Hans' ? 'zh-Hans' : 'en'
    };
  }

  /**
   * Parses user-specific states (priming completion, ready flags)
   */
  parseUserStates(dbRecord) {
    return {
      userAPrimingComplete: dbRecord.user_a_priming_complete || false,
      userBPrimingComplete: dbRecord.user_b_priming_complete || false,
      userAReady: dbRecord.user_a_ready || false,
      userBReady: dbRecord.user_b_ready || false
    };
  }

  /**
   * Detects if session is in mismatch state
   */
  detectMismatchState(dbRecord) {
    if (!dbRecord.joint_menu) return null;

    const mismatchPicks = dbRecord.mismatch_picks || {};
    const lockId = dbRecord.lock_id || null;
    const lockOwner = dbRecord.lock_owner || null;

    return { mismatchPicks, lockId, lockOwner };
  }

  /**
   * Main deserialization method
   */
  deserialize(dbRecord) {
    const phase = this.parsePhase(dbRecord);
    const languages = this.parseLanguageSettings(dbRecord);
    const userStates = this.parseUserStates(dbRecord);
    const mismatchState = this.detectMismatchState(dbRecord);

    return {
      id: dbRecord.id,
      coupleId: dbRecord.couple_id,
      userAId: dbRecord.user_a_id,
      userBId: dbRecord.user_b_id,
      phase,
      ...languages,
      ...userStates,
      evidenceA: dbRecord.evidence_a || null,
      evidenceB: dbRecord.evidence_b || null,
      verdict: dbRecord.verdict || null,
      jointMenu: dbRecord.joint_menu || null,
      ...(mismatchState && mismatchState),
      createdAt: dbRecord.created_at,
      updatedAt: dbRecord.updated_at
    };
  }
}

module.exports = new SessionDeserializer();
```

**Updated `courtSessionManager.js:_reconstructFromDB`:**
```javascript
const SessionDeserializer = require('./court/SessionDeserializer');

async _reconstructFromDB(coupleId) {
  const { data: dbRecord, error } = await this.supabase
    .from('court_sessions')
    .select('*')
    .eq('couple_id', coupleId)
    .single();

  if (error || !dbRecord) return null;

  const session = SessionDeserializer.deserialize(dbRecord);
  return session;
}
```

**Tests to Write:**
- `SessionDeserializer.test.js` - Unit tests for parsing logic
- Test phase inference, language normalization, mismatch detection

**Lines Reduced:** From 97 lines to ~15 lines in main function

---

#### Refactor 2.1.3: Extract Generic Timeout Handler

**Problem:** 7 timeout handlers with identical structure (Lines 987-1057)

**Solution: Add generic method**
```javascript
/**
 * Generic phase timeout handler
 * @param {string} coupleId - Couple ID
 * @param {string} expectedPhase - Phase to check before cleanup
 * @param {string} logLabel - Label for console log
 */
async _handlePhaseTimeout(coupleId, expectedPhase, logLabel) {
  const session = this.sessions.get(coupleId);
  if (!session || session.phase !== expectedPhase) return;

  console.log(`[Court] ${logLabel} timeout for session ${session.id}`);
  await this._deleteSession(session);
  this._cleanup(coupleId);
}

// Replace all 7 handlers with:
async _handlePendingTimeout(coupleId) {
  await this._handlePhaseTimeout(coupleId, PHASE.PENDING, 'Pending');
}

async _handleEvidenceTimeout(coupleId) {
  await this._handlePhaseTimeout(coupleId, PHASE.EVIDENCE, 'Evidence');
}

// ... etc for all 7 phases
```

**Tests to Write:**
- `courtSessionManager.timeout.test.js` - Test timeout behavior for all phases

**Lines Reduced:** From ~70 lines to ~35 lines

---

#### Refactor 2.1.4: Extract Timeout Management

**Problem:** Timeout clearing pattern duplicated 8 times

**Solution: Add helper method**
```javascript
/**
 * Clears session timeout and nullifies reference
 */
_clearTimeout(session) {
  if (session.timeoutId) {
    clearTimeout(session.timeoutId);
    session.timeoutId = null;
  }
}
```

**Update all occurrences:**
```javascript
// Before (8 occurrences):
if (session.timeoutId) {
    clearTimeout(session.timeoutId);
    session.timeoutId = null;
}

// After:
this._clearTimeout(session);
```

**Lines Reduced:** ~24 lines (8 occurrences × 3 lines each)

---

### 2.2 Challenge Service Refactoring

#### File: `server/src/lib/challengeService.js`
**Current:** 1,103 lines with complex date logic
**Target:** <600 lines with extracted repository and calculator

---

#### Refactor 2.2.1: Extract Challenge Repository

**Problem:** ~150 lines of duplicated Supabase query patterns

**New File: `repositories/ChallengeRepository.js`**
```javascript
class ChallengeRepository {
  constructor(supabase) {
    this.supabase = supabase;
  }

  /**
   * Finds assignments for couple in a given period
   */
  async findAssignmentsForPeriod(coupleIds, cadence, startDate) {
    const { data, error } = await this.supabase
      .from('couple_challenge_assignments')
      .select('*, challenges(*)')
      .in('couple_id', coupleIds)
      .eq('period_cadence', cadence)
      .eq('period_start', startDate)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * Creates new challenge assignments
   */
  async createAssignments(assignments) {
    const { data, error } = await this.supabase
      .from('couple_challenge_assignments')
      .insert(assignments)
      .select('*, challenges(*)');

    if (error) throw error;
    return data || [];
  }

  /**
   * Activates challenges for existing assignments
   */
  async activateAssignments(coupleIds, assignmentIds) {
    const { data, error } = await this.supabase
      .from('couple_challenge_assignments')
      .update({ activated_at: new Date().toISOString() })
      .in('couple_id', coupleIds)
      .in('id', assignmentIds)
      .is('activated_at', null)
      .select('*, challenges(*)');

    if (error) throw error;
    return data || [];
  }

  /**
   * Updates assignment progress
   */
  async updateProgress(assignmentId, updates) {
    const { data, error } = await this.supabase
      .from('couple_challenge_assignments')
      .update(updates)
      .eq('id', assignmentId)
      .select('*, challenges(*)')
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Finds active assignments by action type
   */
  async findActiveByAction(coupleIds, actionType) {
    const { data, error } = await this.supabase
      .from('couple_challenge_assignments')
      .select('*, challenges(*)')
      .in('couple_id', coupleIds)
      .not('activated_at', 'is', null)
      .or('completed_at.is.null,partner_confirm_requested_at.not.is.null')
      .filter('challenges.action_config->>action', 'eq', actionType);

    if (error) throw error;
    return data || [];
  }
}

module.exports = ChallengeRepository;
```

**Updated `challengeService.js`:**
```javascript
const ChallengeRepository = require('../repositories/ChallengeRepository');

class ChallengeService {
  constructor(supabase) {
    this.supabase = supabase;
    this.repository = new ChallengeRepository(supabase);
  }

  async ensureAssignments(coupleIds, cadence, startDate) {
    // Now uses repository methods
    const existing = await this.repository.findAssignmentsForPeriod(coupleIds, cadence, startDate);

    if (existing.length > 0) return existing;

    // ... assignment creation logic using repository.createAssignments()
  }
}
```

**Tests to Write:**
- `ChallengeRepository.test.js` - Mock Supabase, test all query methods

**Lines Reduced:** ~150 lines of query logic moved to repository

---

#### Refactor 2.2.2: Extract Progress Calculator

**Problem:** Complex progress calculation functions (43 lines for streak, 18 for count)

**New File: `lib/challengeProgressCalculator.js`**
```javascript
/**
 * Pure functions for challenge progress calculation
 * No side effects, easily testable
 */

/**
 * Computes count-based progress (e.g., "log 3 appreciations")
 */
export function computeCountProgress(log, config) {
  if (!Array.isArray(log) || !config) return 0;

  const { action, countField = 'count', target = 1 } = config;

  return log.reduce((sum, entry) => {
    if (entry.action !== action) return sum;
    return sum + (entry[countField] || 1);
  }, 0);
}

/**
 * Computes streak-based progress (e.g., "3-day streak")
 */
export function computeStreakProgress(log, config, dateUtils) {
  if (!Array.isArray(log) || !config) return 0;

  const { action, target = 3 } = config;
  const entries = log.filter(e => e.action === action);

  if (entries.length === 0) return 0;

  // Get unique dates, sorted ascending
  const uniqueDates = [...new Set(entries.map(e => e.date))].sort();

  // Find longest streak
  let maxStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < uniqueDates.length; i++) {
    const prevDate = uniqueDates[i - 1];
    const currDate = uniqueDates[i];

    // Check if consecutive days
    const isConsecutive = dateUtils.addDaysToDateString(prevDate, 1) === currDate;

    if (isConsecutive) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

  return maxStreak;
}

/**
 * Computes generic progress based on action config
 */
export function computeProgress(log, config, dateUtils) {
  const { progressType = 'count' } = config;

  switch (progressType) {
    case 'count':
      return computeCountProgress(log, config);
    case 'streak':
      return computeStreakProgress(log, config, dateUtils);
    default:
      return 0;
  }
}
```

**Tests to Write:**
- `challengeProgressCalculator.test.js` - Comprehensive tests for all calculation types

**Lines Reduced:** ~60 lines of calculation logic moved to pure functions

---

#### Refactor 2.2.3: Decompose `recordChallengeAction` (Lines 792-928)

**Problem:** 137-line function with 5-level nesting

**Strategy: Split into 4 functions:**

**1. `validateChallengeAction` (new private method)**
```javascript
_validateChallengeAction({ userId, partnerId, action, sourceId }) {
  if (!userId || !partnerId) {
    throw new Error('userId and partnerId required');
  }

  if (!action || typeof action !== 'string') {
    throw new Error('action must be a string');
  }

  // Feature flag check
  const CHALLENGES_ENABLED = process.env.FEATURE_CHALLENGES !== 'false';
  if (!CHALLENGES_ENABLED) {
    return { enabled: false };
  }

  return { enabled: true };
}
```

**2. `updateChallengeProgress` (new private method)**
```javascript
async _updateChallengeProgress(assignment, action, sourceId, dateUtils) {
  const config = assignment.challenges?.action_config || {};
  if (config.action !== action) return null;

  // Parse log
  const log = Array.isArray(assignment.verification_log)
    ? assignment.verification_log
    : [];

  // Check for duplicate entry
  const hasEntry = log.some(e => e.sourceId === sourceId);
  if (!hasEntry) {
    log.push({
      action,
      sourceId,
      date: dateUtils.getEtDateString(),
      timestamp: new Date().toISOString()
    });
  }

  // Compute progress
  const progress = computeProgress(log, config, dateUtils);
  const target = config.target || 1;

  // Update in database
  const updated = await this.repository.updateProgress(assignment.id, {
    verification_log: log,
    current_progress: progress
  });

  return { ...updated, progress, target };
}
```

**3. `handleChallengeCompletion` (refactor existing method)**
```javascript
async _handleChallengeCompletion(assignment, userId, partnerId) {
  const { challenges, current_progress } = assignment;
  const target = challenges?.action_config?.target || 1;

  if (current_progress < target) return { completed: false };

  const requiresConfirm = challenges?.requires_partner_confirm || false;

  if (requiresConfirm && !assignment.partner_confirm_requested_at) {
    // Request confirmation
    await this.repository.updateProgress(assignment.id, {
      partner_confirm_requested_at: new Date().toISOString()
    });

    // TODO: Send notification to partner

    return { completed: false, awaitingConfirmation: true };
  }

  // Mark complete and award XP
  await this.repository.updateProgress(assignment.id, {
    completed_at: new Date().toISOString()
  });

  const xpReward = challenges?.xp_reward || 50;
  await awardXP({
    userId,
    partnerId,
    actionType: ACTION_TYPES.CHALLENGE_COMPLETE,
    sourceId: assignment.id,
    xpAmount: xpReward
  });

  return { completed: true, xpAwarded: xpReward };
}
```

**4. Updated `recordChallengeAction` (main orchestrator)**
```javascript
async recordChallengeAction({ userId, partnerId, action, sourceId }) {
  // Validate
  const validation = this._validateChallengeAction({ userId, partnerId, action, sourceId });
  if (!validation.enabled) {
    return { success: true, challengesDisabled: true };
  }

  // Get couple IDs
  const coupleIds = [userId, partnerId].sort();

  // Find active assignments for this action
  const assignments = await this.repository.findActiveByAction(coupleIds, action);

  if (assignments.length === 0) {
    return { success: true, noActiveAssignments: true };
  }

  const results = [];

  // Process each assignment
  for (const assignment of assignments) {
    // Update progress
    const updated = await this._updateChallengeProgress(assignment, action, sourceId, dateUtils);

    if (!updated) continue;

    // Check for completion
    const completion = await this._handleChallengeCompletion(updated, userId, partnerId);

    results.push({ assignment: updated, completion });
  }

  return { success: true, results };
}
```

**Tests to Write:**
- `challengeService.recordChallengeAction.test.js` - Integration tests for full flow
- Mock repository, test validation, progress updates, completion

**Lines Reduced:** From 137 lines to ~40 lines in main function + 4 focused helper methods

---

### 2.3 Phase 2 Success Metrics

- ✅ `courtSessionManager.js` reduced from 1,211 to <600 lines
- ✅ `challengeService.js` reduced from 1,103 to <600 lines
- ✅ 3 new repository/service classes with 80%+ test coverage
- ✅ Cyclomatic complexity <10 for all extracted functions
- ✅ No regressions in court sessions or challenges

---

## Phase 3: React Component Decomposition (Week 3)

### 3.1 CalendarPage Refactoring

#### File: `client/src/pages/CalendarPage.jsx`
**Current:** 1,652 lines (4 components in one file)
**Target:** <200 lines orchestrator + 6 separate component files

---

#### Refactor 3.1.1: File Structure

**New Directory Structure:**
```
client/src/
├── pages/
│   └── CalendarPage.jsx (orchestrator, ~150 lines)
├── components/
│   └── calendar/
│       ├── CalendarGrid.jsx (calendar rendering)
│       ├── EventCard.jsx (event display)
│       ├── AddEventModal.jsx (creation form)
│       ├── EventDetailsModal.jsx (view/edit)
│       └── PlanningModal.jsx (AI planning)
├── hooks/
│   ├── useCalendarEvents.js (CRUD operations)
│   ├── useEventPlanning.js (AI planning logic)
│   └── useDateNavigation.js (month navigation)
└── utils/
    ├── dateHelpers.js (from Phase 1)
    └── eventHelpers.js (NEW - event filtering, categorization)
```

---

#### Component: `components/calendar/CalendarGrid.jsx`

**Responsibilities:**
- Render monthly calendar grid
- Highlight current day
- Display events on dates
- Handle date selection

**Props Interface:**
```javascript
interface CalendarGridProps {
  currentDate: Date;
  events: Event[];
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
  onEventClick: (event: Event) => void;
}
```

**Implementation Outline:**
```javascript
import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { parseLocalDate, formatLocalDate } from '@/utils/dateHelpers';
import { getEventsForDate } from '@/utils/eventHelpers';

export default function CalendarGrid({
  currentDate,
  events,
  selectedDate,
  onDateSelect,
  onEventClick
}) {
  const { t } = useTranslation();

  // Generate calendar days for current month
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Previous month padding
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push({ date: null, isCurrentMonth: false });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      days.push({ date, isCurrentMonth: true });
    }

    return days;
  }, [currentDate]);

  return (
    <div className="grid grid-cols-7 gap-2">
      {/* Weekday headers */}
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
        <div key={day} className="text-center text-sm font-medium text-court-brown/60">
          {t(`calendar.weekdays.${day.toLowerCase()}`)}
        </div>
      ))}

      {/* Calendar days */}
      {calendarDays.map((dayInfo, idx) => {
        if (!dayInfo.date) return <div key={idx} />;

        const dateStr = formatLocalDate(dayInfo.date);
        const dayEvents = getEventsForDate(events, dateStr);
        const isToday = formatLocalDate(new Date()) === dateStr;
        const isSelected = selectedDate && formatLocalDate(selectedDate) === dateStr;

        return (
          <motion.button
            key={dateStr}
            whileTap={{ scale: 0.95 }}
            onClick={() => onDateSelect(dayInfo.date)}
            className={`
              aspect-square p-2 rounded-lg transition-colors
              ${isToday ? 'ring-2 ring-court-gold' : ''}
              ${isSelected ? 'bg-court-gold/20' : 'hover:bg-court-tan/50'}
            `}
          >
            <div className="text-sm font-medium">{dayInfo.date.getDate()}</div>

            {/* Event indicators */}
            {dayEvents.length > 0 && (
              <div className="flex gap-1 mt-1 justify-center">
                {dayEvents.slice(0, 3).map(event => (
                  <div
                    key={event.id}
                    className="w-1.5 h-1.5 rounded-full bg-court-maroon"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                  />
                ))}
              </div>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
```

**Tests to Write:**
- `CalendarGrid.test.jsx` - Test calendar generation, date selection, event indicators

---

#### Hook: `hooks/useCalendarEvents.js`

**Responsibilities:**
- Fetch events for current month
- Cache events using useCacheStore
- Handle CRUD operations (create, update, delete)
- Real-time subscriptions for event changes

**Implementation:**
```javascript
import { useState, useEffect, useCallback } from 'react';
import api from '@/services/api';
import { useCacheStore } from '@/store/useCacheStore';
import { formatLocalDate } from '@/utils/dateHelpers';

export function useCalendarEvents(currentDate, userId, partnerId) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cache = useCacheStore();
  const cacheKey = `calendar-${currentDate.getFullYear()}-${currentDate.getMonth()}`;

  // Fetch events
  const fetchEvents = useCallback(async (force = false) => {
    if (!userId || !partnerId) return;

    // Check cache first
    if (!force) {
      const cached = cache.get(cacheKey);
      if (cached) {
        setEvents(cached);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;

      const response = await api.get('/calendar/events', {
        params: { year, month }
      });

      const eventsData = response.data.events || [];
      setEvents(eventsData);
      cache.set(cacheKey, eventsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentDate, userId, partnerId, cache, cacheKey]);

  // Create event
  const createEvent = useCallback(async (eventData) => {
    try {
      const response = await api.post('/calendar/events', eventData);
      const newEvent = response.data.event;

      setEvents(prev => [...prev, newEvent]);
      cache.invalidate(cacheKey);

      return { success: true, event: newEvent };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [cache, cacheKey]);

  // Update event
  const updateEvent = useCallback(async (eventId, updates) => {
    try {
      const response = await api.put(`/calendar/events/${eventId}`, updates);
      const updated = response.data.event;

      setEvents(prev => prev.map(e => e.id === eventId ? updated : e));
      cache.invalidate(cacheKey);

      return { success: true, event: updated };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [cache, cacheKey]);

  // Delete event
  const deleteEvent = useCallback(async (eventId) => {
    try {
      await api.delete(`/calendar/events/${eventId}`);

      setEvents(prev => prev.filter(e => e.id !== eventId));
      cache.invalidate(cacheKey);

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [cache, cacheKey]);

  // Load on mount and when month changes
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return {
    events,
    loading,
    error,
    refetch: fetchEvents,
    createEvent,
    updateEvent,
    deleteEvent
  };
}
```

**Tests to Write:**
- `useCalendarEvents.test.js` - Test fetching, caching, CRUD operations

---

#### Updated `CalendarPage.jsx` (Orchestrator)

**Responsibilities:**
- Coordinate child components
- Manage modal states
- Handle month navigation

**Implementation:**
```javascript
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';

import { useAuthStore } from '@/store/useAuthStore';
import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import { useDateNavigation } from '@/hooks/useDateNavigation';

import CalendarGrid from '@/components/calendar/CalendarGrid';
import EventCard from '@/components/calendar/EventCard';
import AddEventModal from '@/components/calendar/AddEventModal';
import EventDetailsModal from '@/components/calendar/EventDetailsModal';
import PlanningModal from '@/components/calendar/PlanningModal';

export default function CalendarPage() {
  const { t } = useTranslation();
  const { profile, partner } = useAuthStore();

  // Date navigation
  const { currentDate, goToNextMonth, goToPreviousMonth } = useDateNavigation();

  // Events
  const { events, loading, createEvent, updateEvent, deleteEvent } = useCalendarEvents(
    currentDate,
    profile?.id,
    partner?.id
  );

  // UI state
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showPlanningModal, setShowPlanningModal] = useState(false);

  // Handlers
  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setShowAddModal(true);
  };

  const handleEventClick = (event) => {
    setSelectedEvent(event);
    setShowDetailsModal(true);
  };

  const handleCreateEvent = async (eventData) => {
    const result = await createEvent(eventData);
    if (result.success) {
      setShowAddModal(false);
    }
    return result;
  };

  return (
    <div className="min-h-screen p-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">
          {t('calendar.title')}
        </h1>

        <button
          onClick={() => setShowPlanningModal(true)}
          className="btn-primary"
        >
          <Plus size={20} />
          {t('calendar.planEvent')}
        </button>
      </div>

      {/* Month Navigator */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={goToPreviousMonth} className="p-2">
          <ChevronLeft size={24} />
        </button>

        <h2 className="text-xl font-semibold">
          {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h2>

        <button onClick={goToNextMonth} className="p-2">
          <ChevronRight size={24} />
        </button>
      </div>

      {/* Calendar Grid */}
      <CalendarGrid
        currentDate={currentDate}
        events={events}
        selectedDate={selectedDate}
        onDateSelect={handleDateSelect}
        onEventClick={handleEventClick}
      />

      {/* Modals */}
      <AddEventModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleCreateEvent}
        selectedDate={selectedDate}
      />

      <EventDetailsModal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        event={selectedEvent}
        onUpdate={updateEvent}
        onDelete={deleteEvent}
      />

      <PlanningModal
        isOpen={showPlanningModal}
        onClose={() => setShowPlanningModal(false)}
        onCreateEvent={handleCreateEvent}
      />
    </div>
  );
}
```

**Lines Reduced:** From 1,652 lines to ~150 lines orchestrator

---

### 3.2 ProfilesPage Refactoring

#### File: `client/src/pages/ProfilesPage.jsx`
**Current:** 1,519 lines with 16+ state variables
**Target:** <200 lines orchestrator + 5 component files

**New Structure:**
```
client/src/
├── pages/
│   └── ProfilesPage.jsx (~150 lines)
├── components/
│   └── profile/
│       ├── MeTab.jsx (personal view)
│       ├── UsTab.jsx (relationship view)
│       ├── EditProfileModal.jsx (already 200+ lines)
│       ├── ChallengeCarousel.jsx (with scroll logic)
│       ├── MemoriesPreview.jsx
│       └── InsightsPreview.jsx
└── hooks/
    ├── useProfileData.js (consolidated state)
    ├── useRelationshipStats.js (days together, streak)
    └── useChallengeCarousel.js (scroll handling)
```

**Refactoring Approach:**
1. Extract `MeTab` component (personal profile, avatar, challenges)
2. Extract `UsTab` component (relationship stats, memories, insights)
3. Extract `EditProfileModal` to separate file
4. Create `useChallengeCarousel` hook for scroll logic
5. Consolidate state into `useProfileData` hook

**Expected Lines:** From 1,519 to ~150 in orchestrator

---

### 3.3 OnboardingPage Refactoring

#### File: `client/src/pages/OnboardingPage.jsx`
**Current:** 1,233 lines with giant config object
**Target:** <150 lines orchestrator + 8 step components

**New Structure:**
```
client/src/
├── pages/
│   └── OnboardingPage.jsx (~120 lines)
├── components/
│   └── onboarding/
│       ├── LanguageStep.jsx
│       ├── WelcomeStep.jsx
│       ├── AuthStep.jsx
│       ├── NameStep.jsx
│       ├── AvatarStep.jsx
│       ├── PreferencesStep.jsx
│       └── CompleteStep.jsx
├── hooks/
│   ├── useOnboardingFlow.js (step navigation)
│   └── useLanguageDetection.js (isolate detection)
└── config/
    └── onboardingSteps.js (move ONBOARDING_STEPS)
```

**Refactoring Approach:**
1. Extract `ONBOARDING_STEPS` (165 lines) to `config/onboardingSteps.js`
2. Create 8 step components (one per onboarding step)
3. Create `useOnboardingFlow` hook for navigation logic
4. Extract language detection to dedicated hook

**Expected Lines:** From 1,233 to ~120 in orchestrator

---

### 3.4 Phase 3 Testing Strategy

**Component Tests:**
- Each extracted component gets snapshot + interaction tests
- Target: 80%+ coverage for new components

**Integration Tests:**
- Test full calendar flow (create → view → edit → delete)
- Test onboarding completion flow
- Test profile editing flow

**Visual Regression:**
- Capture before/after screenshots of all pages
- Ensure UI looks identical after refactor

---

### 3.5 Phase 3 Success Metrics

- ✅ CalendarPage: 1,652 → ~150 lines
- ✅ ProfilesPage: 1,519 → ~150 lines
- ✅ OnboardingPage: 1,233 → ~120 lines
- ✅ Total: ~6,400 lines → ~420 lines (93% reduction)
- ✅ All new components have 80%+ test coverage
- ✅ No visual regressions
- ✅ Performance metrics unchanged or improved

---

## Phase 4: Zustand Store Decoupling (Week 4)

### 4.1 useAuthStore Refactoring

#### File: `client/src/store/useAuthStore.js`
**Current:** 876 lines with tight coupling
**Target:** <500 lines with event bus

---

#### Refactor 4.1.1: Extract Profile Loader Service

**Problem:** Profile loading logic duplicated 3 times

**New File: `services/profileLoader.js`**
```javascript
import { supabase } from './supabase';
import { withTimeout } from '@/utils/promiseHelpers';

/**
 * Loads full user context (profile + partner + pending requests)
 */
export async function loadUserContext(userId, options = {}) {
  const { timeoutMs = 5000 } = options;

  try {
    // Fetch profile with timeout
    const profilePromise = getProfile(userId);
    const profile = await withTimeout(profilePromise, timeoutMs, 'Profile fetch');

    if (!profile) {
      // Create profile if missing (PGRST116 error)
      const created = await createProfile(userId);
      return { profile: created, partner: null, pendingRequests: [] };
    }

    // Fetch partner if connected
    let partner = null;
    if (profile.partner_id) {
      const partnerPromise = getProfile(profile.partner_id);
      partner = await withTimeout(partnerPromise, timeoutMs, 'Partner fetch');
    }

    // Fetch pending requests
    const pendingRequests = await getPendingPartnerRequests(userId);

    return { profile, partner, pendingRequests };

  } catch (error) {
    console.error('[profileLoader] Error loading user context:', error);
    throw error;
  }
}

async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

async function createProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .insert({ id: userId, onboarding_complete: false })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function getPendingPartnerRequests(userId) {
  const { data, error } = await supabase
    .from('partner_requests')
    .select('*, requester:profiles!requester_id(*)')
    .eq('receiver_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}
```

**Migration Strategy:**
1. Create new service file
2. Update `useAuthStore`:
   - Replace inline logic in `loadAuthContext` (lines 60-114)
   - Replace logic in `signIn` (lines 364-418)
   - Replace logic in `handleSupabaseAuthEvent` (lines 261-278)
3. All three locations now call `loadUserContext(userId)`

**Tests to Write:**
- `profileLoader.test.js` - Test loading, timeout, error handling

**Lines Reduced:** ~150 lines of duplicate logic

---

#### Refactor 4.1.2: Create Event Bus for Cross-Store Communication

**Problem:** Direct calls to `useSubscriptionStore` and `useCacheStore` create tight coupling

**New File: `lib/eventBus.js`**
```javascript
/**
 * Simple event bus for decoupling stores
 */
class EventBus {
  constructor() {
    this.listeners = {};
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);

    // Return unsubscribe function
    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  }

  emit(event, data) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(callback => callback(data));
  }
}

export const eventBus = new EventBus();

// Define event types
export const EVENTS = {
  AUTH_LOGIN: 'auth:login',
  AUTH_LOGOUT: 'auth:logout',
  AUTH_SESSION_REFRESHED: 'auth:session-refreshed',
  PROFILE_UPDATED: 'profile:updated',
  PARTNER_CONNECTED: 'partner:connected',
  LANGUAGE_CHANGED: 'language:changed'
};
```

**Updated `useAuthStore.js`:**
```javascript
import { eventBus, EVENTS } from '@/lib/eventBus';

// Instead of:
// useSubscriptionStore.getState().reset();
// useCacheStore.getState().clearAll();

// Use:
eventBus.emit(EVENTS.AUTH_LOGOUT);
```

**Updated `useSubscriptionStore.js`:**
```javascript
import { eventBus, EVENTS } from '@/lib/eventBus';

// In store initialization
eventBus.on(EVENTS.AUTH_LOGOUT, () => {
  useSubscriptionStore.getState().reset();
});

eventBus.on(EVENTS.AUTH_LOGIN, ({ userId }) => {
  useSubscriptionStore.getState().initialize(userId);
});
```

**Updated `useCacheStore.js`:**
```javascript
import { eventBus, EVENTS } from '@/lib/eventBus';

eventBus.on(EVENTS.AUTH_LOGOUT, () => {
  useCacheStore.getState().clearAll();
});

eventBus.on(EVENTS.LANGUAGE_CHANGED, () => {
  useCacheStore.getState().invalidateAll();
});
```

**Benefits:**
- Stores no longer import each other directly
- Events are discoverable and documented
- Easy to add new listeners without modifying auth store

---

#### Refactor 4.1.3: Split `handleSupabaseAuthEvent`

**Problem:** 100-line function with 4 event types

**Solution: Create per-event handlers**
```javascript
// Instead of one giant switch statement
const handleSupabaseAuthEvent = async (event, session) => {
  if (event === 'SIGNED_OUT') return handleSignedOut();
  if (event === 'TOKEN_REFRESHED') return handleTokenRefreshed(session);
  if (event === 'SIGNED_IN') return handleSignedIn(session);
  if (event === 'INITIAL_SESSION') return handleInitialSession(session);
};

const handleSignedOut = () => {
  set(initialState);
  eventBus.emit(EVENTS.AUTH_LOGOUT);
};

const handleTokenRefreshed = async (session) => {
  if (!session?.user) return;
  set({ user: session.user, session });
  eventBus.emit(EVENTS.AUTH_SESSION_REFRESHED, { user: session.user });
};

const handleSignedIn = async (session) => {
  const { profile, partner, pendingRequests } = await loadUserContext(session.user.id);

  set({
    user: session.user,
    session,
    profile,
    partner,
    hasPartner: !!profile.partner_id,
    onboardingComplete: !!profile.onboarding_complete,
    pendingRequests
  });

  eventBus.emit(EVENTS.AUTH_LOGIN, { userId: session.user.id });
  await setupRealtimeSubscriptions();
};

const handleInitialSession = async (session) => {
  if (!session?.user) {
    set({ sessionChecked: true });
    return;
  }

  // Similar to handleSignedIn but with cached profile optimization
  const { profile, partner, pendingRequests } = await loadUserContext(session.user.id);

  set({
    user: session.user,
    session,
    profile,
    partner,
    hasPartner: !!profile.partner_id,
    onboardingComplete: !!profile.onboarding_complete,
    sessionChecked: true,
    pendingRequests
  });
};
```

**Lines Reduced:** From 100-line function to 4 focused handlers (~25 lines each)

---

### 4.2 useAppStore Refactoring

#### Refactor 4.2.1: Eliminate `fetchUsers` Redundancy

**Problem:** `fetchUsers` duplicates data from `useAuthStore`

**Solution: Remove it entirely**
```javascript
// BEFORE: useAppStore maintains shadow copy
const { currentUser, users } = useAppStore();

// AFTER: Consume directly from useAuthStore
const { profile, partner } = useAuthStore();

// Create computed getter if needed
const users = useMemo(() => {
  if (!profile || !partner) return [];
  return [
    { ...profile, kibbleBalance: profile.kibble_balance || 0 },
    { ...partner, kibbleBalance: partner.kibble_balance || 0 }
  ];
}, [profile, partner]);
```

**Migration:**
1. Remove `currentUser` and `users` from `useAppStore` state
2. Remove `fetchUsers` action
3. Update components to use `useAuthStore` directly
4. If kibble balance is needed, fetch it in `useAuthStore` or create `useKibbleStore`

**Lines Reduced:** ~40 lines from useAppStore

---

#### Refactor 4.2.2: Extract Cache Logic to Custom Hooks

**Problem:** Cache checking mixed with business logic

**New Hooks:**
```javascript
// hooks/useCachedCaseHistory.js
export function useCachedCaseHistory(userId, partnerId) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  const cache = useCacheStore();
  const cacheKey = `case-history-${userId}-${partnerId}`;

  useEffect(() => {
    const fetchCases = async () => {
      // Check cache
      const cached = cache.get(cacheKey);
      if (cached) {
        setCases(cached);
        setLoading(false);
        return;
      }

      // Fetch from API
      const response = await api.get('/cases', {
        params: { userAId: userId, userBId: partnerId }
      });

      const data = response.data.cases || [];
      setCases(data);
      cache.set(cacheKey, data);
      setLoading(false);
    };

    fetchCases();
  }, [userId, partnerId, cache, cacheKey]);

  return { cases, loading };
}
```

**Migration:**
1. Remove `fetchCaseHistory` from `useAppStore`
2. Update components to use `useCachedCaseHistory` hook
3. Same for appreciations: create `useCachedAppreciations`

**Lines Reduced:** ~80 lines from useAppStore

---

#### Refactor 4.2.3: Remove courtStore Mutation

**Problem:** `loadCase` directly mutates courtStore state (lines 117-133)

**Solution: Use courtStore action**
```javascript
// BEFORE (in useAppStore):
import('./courtStore').then(m => {
  m.default.setState({ activeCase: {...} });
});

// AFTER (in courtStore):
// Add action to courtStore
setActiveCase: (caseData) => {
  set({ activeCase: caseData });
}

// In useAppStore:
import { useCourtStore } from './courtStore';
useCourtStore.getState().setActiveCase(caseData);
```

**Lines Reduced:** Maintains encapsulation, removes dynamic import

---

### 4.3 courtStore Optimization

#### Refactor 4.3.1: Extract WebSocket Action Wrapper

**Problem:** 12+ functions with identical Promise wrapper pattern

**New File: `utils/socketActionHelper.js`**
```javascript
/**
 * Wraps WebSocket actions with timeout and fallback logic
 */
export function createSocketAction(eventName, options = {}) {
  const { timeoutMs = 2500, fallbackFn = null } = options;

  return async (socketRef, payload) => {
    return new Promise((resolve) => {
      let done = false;

      const timeout = setTimeout(() => {
        if (done) return;
        done = true;

        if (fallbackFn) {
          fallbackFn().finally(resolve);
        } else {
          resolve({ error: 'Timeout' });
        }
      }, timeoutMs);

      socketRef.emit(eventName, payload, (response) => {
        if (done) return;
        done = true;
        clearTimeout(timeout);
        resolve(response);
      });
    });
  };
}
```

**Updated courtStore actions:**
```javascript
import { createSocketAction } from '@/utils/socketActionHelper';

const serveAction = createSocketAction('court:serve', {
  timeoutMs: 2500,
  fallbackFn: () => get().fetchState({ force: true })
});

serve: async (userLanguage, partnerLanguage) => {
  set({ isSubmitting: true });

  const userId = _getUserId();
  const response = await serveAction(socketRef, { userLanguage, partnerLanguage });

  if (response?.state) get().onStateSync(response.state);
  if (response?.error) get().onError(response.error);

  set({ isSubmitting: false });
}
```

**Lines Reduced:** ~300 lines (12 actions × ~25 lines of boilerplate each)

---

### 4.4 Phase 4 Success Metrics

- ✅ useAuthStore: 876 → <500 lines
- ✅ useAppStore: 240 → <100 lines
- ✅ courtStore: 842 → <550 lines
- ✅ Event bus eliminates 5 direct store imports
- ✅ All stores testable in isolation
- ✅ No circular dependencies

---

## Post-Refactoring Verification

### Automated Tests
- ✅ All existing tests pass
- ✅ New utility/service tests at 85%+ coverage
- ✅ Integration tests verify no regressions

### Manual Testing Checklist
- ✅ Onboarding flow (all languages)
- ✅ Partner connection flow
- ✅ Court session flow (all phases)
- ✅ Calendar CRUD operations
- ✅ Challenge completion flow
- ✅ Daily questions flow
- ✅ Profile editing
- ✅ Memory uploads

### Performance Metrics
- ✅ Initial load time unchanged or improved
- ✅ Court session latency unchanged
- ✅ Memory usage stable

### Code Quality Metrics
- ✅ Average file size reduced from 800 → 250 lines
- ✅ Cyclomatic complexity <10 for all functions
- ✅ Test coverage >80% overall
- ✅ No ESLint warnings
- ✅ No console.logs in production code

---

## Git Strategy

### Branch Structure
```
main
└── refactor/architecture-2026
    ├── feat/phase1-utilities
    ├── feat/phase2-server-core
    ├── feat/phase3-react-components
    └── feat/phase4-stores
```

### Commit Conventions
```
feat(phase1): extract date/time utilities to shared module
feat(phase1): create requirePartner middleware
refactor(phase2): decompose courtSessionManager.submitResolutionPick
refactor(phase3): split CalendarPage into 6 components
test(phase2): add challenge progress calculator tests
```

### PR Strategy
- **Option A:** Single large PR at end of Phase 4 (user preference)
- **Option B:** Four PRs (one per phase) if user changes mind

---

## Rollback Plan

If critical bugs are discovered:

1. **Phase-level rollback:** Keep each phase in separate commits, can revert entire phase
2. **Feature flag:** Add `FEATURE_REFACTORED_CALENDAR=true` env var to toggle new vs old components
3. **Git revert:** All changes are in feature branch, can abandon and start fresh

---

## Timeline & Estimates

| Phase | Focus | Duration | Risk |
|-------|-------|----------|------|
| Phase 1 | Utilities & Middleware | 3-4 days | Low |
| Phase 2 | Server Core Logic | 4-5 days | Medium |
| Phase 3 | React Components | 5-6 days | Medium |
| Phase 4 | Zustand Stores | 3-4 days | Low |
| **Total** | | **15-19 days** | |

**Parallelization:** Some work can be done in parallel (e.g., client + server utilities)

---

## Multiagent Execution Strategy

### Team Structure

To preserve context and enable parallel work, I'll deploy **specialized subagents** (your "junior developers") for each workstream:

```
Senior Dev (Me - Orchestrator)
├── Junior Dev A: Server Utilities Team
│   ├── Task: Extract dateTimeUtils.js
│   ├── Task: Create llmRetryHandler.js
│   └── Task: Build errorUtils.js
├── Junior Dev B: Server Middleware Team
│   ├── Task: Create requirePartner middleware
│   ├── Task: Build asyncHandler wrapper
│   └── Task: Update auth.js helpers
├── Junior Dev C: Court Session Team
│   ├── Task: Refactor submitResolutionPick
│   ├── Task: Refactor _reconstructFromDB
│   └── Task: Extract timeout handlers
├── Junior Dev D: Challenge Team
│   ├── Task: Create ChallengeRepository
│   ├── Task: Extract progress calculator
│   └── Task: Decompose recordChallengeAction
├── Junior Dev E: Calendar UI Team
│   ├── Task: Split CalendarPage
│   ├── Task: Create hooks
│   └── Task: Build components
├── Junior Dev F: Profile UI Team
│   └── Task: Refactor ProfilesPage
├── Junior Dev G: Onboarding UI Team
│   └── Task: Decompose OnboardingPage
└── Junior Dev H: Store Team
    ├── Task: Refactor useAuthStore
    ├── Task: Optimize useAppStore
    └── Task: Streamline courtStore
```

### Code Review Integration

**Every subagent's work will be reviewed using the `code-review-excellence` skill before merging.**

#### Quality Assurance Workflow:

```
┌─────────────────────────────────────────────────────────┐
│ 1. Junior Dev: Implements refactor + writes tests       │
│    └─> Creates PR draft with changes                    │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 2. Code Review Agent: Reviews using excellence skill    │
│    ├─> Security checklist (SQL injection, XSS, etc.)   │
│    ├─> Performance review (N+1 queries, memory leaks)  │
│    ├─> Logic correctness (edge cases, null checks)     │
│    ├─> Test quality (coverage, behavior vs impl)       │
│    └─> Provides feedback with severity labels          │
│         🔴 [blocking] 🟡 [important] 🟢 [nit]          │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 3. Junior Dev: Addresses feedback                       │
│    └─> Fixes blocking issues, considers suggestions     │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 4. Senior Dev (Me): Final integration review            │
│    └─> Ensures consistency across team's work           │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 5. Merge to refactor/architecture-2026 branch           │
└─────────────────────────────────────────────────────────┘
```

### Parallel Execution Plan

**Phase 1 (Week 1):** 3 teams working in parallel
- Team A: Server utilities (3 days)
- Team B: Server middleware (3 days)
- Client utilities: I'll handle (2 days)

**Phase 2 (Week 2):** 2 teams working in parallel
- Team C: Court session refactor (5 days)
- Team D: Challenge service refactor (5 days)

**Phase 3 (Week 3):** 3 teams working in parallel
- Team E: CalendarPage (2 days)
- Team F: ProfilesPage (2 days)
- Team G: OnboardingPage (2 days)
- Then: Integration and testing (1 day)

**Phase 4 (Week 4):** 1 team + integration
- Team H: Store refactoring (3 days)
- Final integration + e2e testing (1 day)

### Review Checkpoints

Each phase ends with a **comprehensive review session** using `code-review-excellence`:

1. **Security Review**: Using skill's security checklist
   - Authentication/authorization checks
   - SQL injection prevention (parameterized queries)
   - XSS protection
   - Secrets management

2. **Performance Review**:
   - N+1 query detection
   - Memory leak checks
   - Blocking I/O identification
   - Caching opportunities

3. **Test Quality Review**:
   - Behavior-driven test validation
   - Edge case coverage
   - Test independence verification
   - Descriptive test names

4. **Architecture Review**:
   - Pattern consistency
   - Separation of concerns
   - DRY principle adherence
   - Scalability considerations

### Example Review Output (from skill):

```markdown
## Phase 1 - Server Utilities Review

## Summary
Reviewed dateTimeUtils.js, llmRetryHandler.js, errorUtils.js,
and middleware implementations. Total: ~350 lines of new code.

## Strengths
🎉 Excellent test coverage: 92% across all utilities
🎉 Pure functions in dateTimeUtils - easy to test and reason about
🎉 Consistent error handling pattern in middleware

## Required Changes
🔴 [blocking] llmRetryHandler.js:45 - Exponential backoff not
    implemented correctly. Current logic uses linear delay.
    Should be: delay = backoffMs * Math.pow(2, attempt - 1)

🔴 [blocking] requirePartner.js:23 - Race condition: partner
    validation doesn't account for concurrent partner disconnection.
    Need transaction or optimistic locking.

## Suggestions
💡 dateTimeUtils.js:89 - Consider caching timezone offset
   calculations. Called frequently in challenge service.

💡 errorUtils.js - Add structured logging (Winston/Pino)
   instead of console.error for production observability.

🟢 [nit] Use const instead of let in llmRetryHandler.js:67
   (delay variable never reassigned)

## Questions
❓ Should requirePartner middleware cache partner relationship
  in Redis to reduce database calls?

❓ What's the expected QPS for court sessions? May need rate
  limiting in middleware.

## Verdict
🔄 Request Changes - Fix 2 blocking issues before proceeding to Phase 2
```

---

## Phase 3 Review Notes (2026-01-03)

### Bugs Found & Fixed

| Issue | File | Root Cause | Fix Applied |
|-------|------|------------|-------------|
| Build failure | Client build | `prop-types` package not installed but used by new components | Installed `prop-types` via `npm install prop-types` |
| Test failure | `EventForm.test.jsx:26` | Test used `getByLabelText(/title/i)` but form labels use i18n translation keys (returns key string in test mock) | Changed to `getByText(/titleLabel/i)` and `getAllByRole('textbox')` |
| Test failure | `EventDetailsModal.test.jsx:85` | Test looked for `lucide-trash` CSS class but `Trash2` icon from lucide-react uses `lucide-trash-2` | Updated class selector to `lucide-trash-2` in 3 locations |

### Test Results After Fixes
- **Client Tests**: 48/48 passing
- **Client Build**: Success (1.28 MB JS, 153 KB CSS)

### Known Issues for Future Work

#### 1. Vite Dynamic Import Warnings
The build shows warnings about inconsistent import patterns:
```
(!) supabase.js is dynamically imported by useProfileData.js but also statically imported by 8+ other files
(!) useAuthStore.js is dynamically imported by useAppStore.js but also statically imported by 30+ files
(!) avatarService.js is dynamically imported by useAuthStore.js but also statically imported by 3 files
```

**Recommendation**: Refactor to use consistent import patterns. Either:
- Remove dynamic imports in `useProfileData.js` and use static imports
- Or move to fully dynamic imports with proper code-splitting boundaries

**Files to review**:
- `client/src/components/profile/useProfileData.js:82` - dynamic import of supabase
- `client/src/store/useAppStore.js` - multiple dynamic imports of useAuthStore

#### 2. Bundle Size Warning
Main JavaScript bundle is 1.28 MB (339 KB gzipped), exceeding the 500 KB recommended limit.

**Recommendation**: Implement code-splitting for:
- Large page components (CourtroomPage, CalendarPage)
- Heavy dependencies (framer-motion animations)
- Route-based lazy loading

**Implementation options**:
```javascript
// Option A: Route-based code splitting in App.jsx
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const ProfilesPage = lazy(() => import('./pages/ProfilesPage'));

// Option B: Manual chunks in vite.config.js
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-react': ['react', 'react-dom'],
        'vendor-motion': ['framer-motion'],
        'vendor-icons': ['lucide-react'],
      }
    }
  }
}
```

#### 3. Server Tests - Phase 2 Mock Issues
Server tests (Phase 2 challenges module) have 12 failures related to Supabase mock chaining:
```
TypeError: supabase.from(...).select(...).eq(...).eq is not a function
```

**Root Cause**: The Supabase mock doesn't properly chain `.eq()` methods.

**Files affected**:
- `server/src/lib/challenges/AssignmentManager.test.js`
- `server/src/lib/challenges/ChallengeRepository.test.js`

**Fix needed**: Update the Supabase mock to return chainable methods:
```javascript
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      }))
    }))
  }))
};
```

---

## Next Steps

1. **Review this updated plan** - Multiagent strategy + code review integration
2. **Approve to proceed** - I'll deploy the first subagent team
3. **Create refactor branch** - `git checkout -b refactor/architecture-2026`
4. **Launch Phase 1 Teams**:
   - Junior Dev A starts on dateTimeUtils.js
   - Junior Dev B starts on requirePartner middleware
   - Code Review Agent monitors PRs
5. **Daily standup updates** - I'll report progress from each team

---

## Questions for You

1. Are there any files/functions you want to **exclude** from refactoring?
2. Do you have **existing test infrastructure** I should be aware of?
3. Are there any **deploy/CI/CD considerations** for the long-lived branch?
4. Should I **prioritize certain features** for early refactoring (e.g., critical court session logic)?
5. Any **team members** I should coordinate with or get reviews from?
6. **New:** What's your preferred review cadence - after each subagent completes, or batched at end of each phase?

Let me know if you'd like me to adjust anything in this plan!
