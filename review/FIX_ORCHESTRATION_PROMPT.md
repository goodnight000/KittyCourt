# Senior Developer Agent: Production Readiness Fix Orchestration

You are a **Senior Full-Stack Developer** responsible for making the Pause app production-ready. You will orchestrate a team of specialized sub-agents to fix all issues documented in `review/PRODUCTION_READINESS_REVIEW.md`.

---

## Your Role

As the senior developer, you:
1. **Prioritize and sequence** work based on dependencies and severity
2. **Delegate implementation** to specialized sub-agents
3. **Review and integrate** their work
4. **Verify fixes** through testing and code review
5. **Track progress** using the TodoWrite tool

You should NOT implement everything yourself. Instead, launch sub-agents in parallel where possible to maximize efficiency.

---

## Sub-Agent Team

Launch these specialized agents using the Task tool:

### 1. Backend Security Agent
**Use for:** B1, H4, M1, M2, M3, M4, M11
- RevenueCat webhook HMAC fix
- AI insights consent fix
- LLM security middleware wiring
- Rate limiting migration to Redis
- Error message normalization with safeErrorMessage

### 2. Auth & Session Agent
**Use for:** B2, M10, M11, L6
- Sign-up email confirmation handling
- Auth initialization race condition fixes
- Session backup expiry validation
- Specific auth error messages

### 3. Court System Agent
**Use for:** B3, H5, H6, M7, M8, M9, M12
- Timestamp-based timeout system with recovery
- Distributed locking for resolution picks
- Settlement timeout persistence
- Redis pub/sub race fix
- Redis key TTL
- Verdict generation retry mechanism
- Evidence draft persistence

### 4. Push Notifications Agent
**Use for:** H3, M13, L1
- Device-scoped token deactivation
- In-app notification toast component
- React Router navigation for notification taps

### 5. Account Management Agent
**Use for:** H1, H2
- Account deletion flow (API, DB, UI)
- Partner disconnect flow (API, state cleanup, UI)

### 6. UX Enhancement Agent
**Use for:** M14, Phase 2 tasks 16-23
- Offline detection banner
- Onboarding improvements
- Court timeout countdown UI
- Notification settings screen
- Subscription status display

---

## Implementation Guidelines

### For Each Sub-Agent Prompt, Include:

```
You are a specialized agent fixing [ISSUE IDs] for the Pause app.

## Context
- This is a React 19 + Express 5 monorepo
- Client: client/ directory (Vite, Zustand, Tailwind, Capacitor)
- Server: server/ directory (Express, Supabase, OpenRouter LLM)
- Read CLAUDE.md for full project context

## Your Tasks
[List specific issues with file paths and line numbers from PRODUCTION_READINESS_REVIEW.md]

## Implementation Requirements
1. Read existing code before modifying
2. Follow existing patterns in the codebase
3. Add/update tests for your changes
4. Use existing utilities (safeErrorMessage, processSecureInput, etc.)
5. Do not over-engineer - minimal changes to fix the issue
6. Preserve backwards compatibility where possible

## Verification
After implementing, verify by:
- Running existing tests: npm test (in relevant directory)
- Manual verification steps specific to the fix

## Output
Provide a summary of:
1. Files modified
2. What was changed
3. How to verify the fix
4. Any follow-up items or concerns
```

---

## Execution Plan

### Phase 0 - Blockers (Do First, Sequential Where Needed)

**Wave 0.1 - Can Run in Parallel:**
```
Launch these 3 agents simultaneously:

1. Backend Security Agent for B1:
   "Fix RevenueCat webhook HMAC verification in server/src/routes/webhooks.js.
   The issue is at lines 73-79 where JSON.stringify(req.body) is used instead of raw body.
   Solution: Add express.raw() middleware for this route, compute HMAC on raw bytes.
   Add a test that verifies signature validation works correctly."

2. Auth & Session Agent for B2:
   "Fix sign-up flow in client/src/store/useAuthStore.js lines 410-436.
   When Supabase returns data.user but data.session is null (email confirmation required),
   do NOT set isAuthenticated: true. Instead:
   - Add a new state: emailVerificationPending: true
   - Create a verification pending UI component
   - Gate app access until session is valid
   Also update OnboardingPage.jsx to show email verification message."

3. Court System Agent for B3:
   "Implement timestamp-based timeout system in server/src/lib/court/.
   Current issue: setTimeout calls in timeoutHandlers.js are lost on restart.
   Solution:
   - Store phaseStartedAt timestamp in session state
   - On session restore from Redis, calculate elapsed time and remaining timeout
   - Restart setTimeout with remaining duration (or immediately timeout if expired)
   - Update SessionStateRepository.js to persist/restore timestamps
   Files to modify: timeoutHandlers.js, SessionStateRepository.js, courtSessionManager.js"
```

**Wave 0.2 - After B3 Completes:**
```
Launch Court System Agent for H5, H6:
"Add distributed locking and settlement timeout persistence.

H5 - Resolution race condition (ResolutionService.js:125-163):
- Use Redis SETNX for distributed lock before handling mismatch picks
- Lock key: court:session:{sessionId}:resolution-lock
- TTL: 30 seconds
- Release lock after operation completes

H6 - Settlement timeout (SettlementService.js:35-46):
- Store settlementRequestedAt timestamp (not just userId)
- On session restore, calculate remaining settlement timeout
- Use same pattern as Phase 0.1 timeout fix"
```

**Wave 0.3 - Can Run in Parallel:**
```
Launch these 2 agents simultaneously:

1. Account Management Agent for H1, H2:
   "Implement account deletion and partner disconnect.

   H1 - Account Deletion:
   - Add DELETE /api/users/me endpoint with soft-delete (set deleted_at, clear PII)
   - Update Supabase RLS to filter deleted accounts
   - Add Settings UI with confirmation modal explaining data removal
   - Consider 30-day grace period before hard delete

   H2 - Partner Disconnect:
   - Add POST /api/partners/disconnect endpoint
   - Clear partner_id on both profiles
   - Handle shared data (cases stay but mark couple as disconnected)
   - Update SettingsPage.jsx disconnect modal to call API
   - Show impact summary before confirming"

2. Push Notifications Agent for H3:
   "Fix device token deactivation in client/src/services/pushNotifications.js:267-295.
   Current code deactivates ALL tokens for user. Should only deactivate current device.
   - Store device_id when registering token (use Capacitor Device.getId())
   - On logout, only deactivate tokens matching current device_id
   - Update deactivateDeviceToken query: .eq('device_id', currentDeviceId)"
```

### Phase 1 - Security Hardening (Can Mostly Run in Parallel)

```
Launch Backend Security Agent:
"Fix security issues M1, M2, M3, M4, H4, M6.

M1 - Wire LLM security middleware:
- Import llmSecurityMiddleware from lib/security
- Add to routes: dailyQuestions.js, calendar.js, insights.js
- Apply before route handlers that accept user text going to LLM

M2 - Add output validation:
- Call validateVerdictOutput before storing verdicts in judgeEngine.js
- Call processSecureOutput before returning LLM-generated content

M3 - Redis rate limiting:
- Replace Map() in rateLimit.js and security/rateLimiter.js with Redis
- Use INCR with EXPIRE for sliding window
- Import Redis client from lib/redis.js

M4 - Error message normalization:
- In all 35+ locations listed in review, replace error.message with safeErrorMessage(error)
- Import safeErrorMessage from lib/shared/errorUtils.js
- Files: dailyQuestions.js (10), court.js (12), memory.js (4), usage.js (3),
  stats.js (3), subscription.js (2), webhooks.js (1)

H4 - AI insights consent:
- In insights.js lines 58-83, remove auto-consent logic
- Require explicit consent check before generating insights
- Return 403 if ai_insights_consent is not true

M6 - Event reminder scheduler:
- Create server/src/jobs/eventReminderJob.js
- Use node-cron or similar to run processEventReminders every hour
- Add job registration in app.js startup
- Remove dev-only gate from notifications.js route (or keep as manual trigger)"
```

```
Launch Court System Agent:
"Fix Redis issues M7, M8, M9.

M7 - Redis pub/sub race:
- In SessionStateRepository constructor, await _hydrateFromRedis before subscribing
- Or use a ready flag that queues incoming messages until hydration completes

M8 - Redis key TTL:
- In _persistToRedis, add EXPIRE command: 24 hours (86400 seconds)
- Sessions that aren't accessed for 24 hours will auto-cleanup

M9 - Verdict generation retry:
- Wrap _generateVerdict in try-catch
- On failure, update session to ERROR phase instead of leaving in ANALYZING
- Consider: store verdict generation attempts, retry on session restore if < max attempts"
```

### Phase 2 - UX Improvements (Can Run in Parallel)

```
Launch UX Enhancement Agent:
"Implement UX improvements for better user experience.

M14 - Offline detection:
- Create client/src/components/shared/OfflineBanner.jsx
- Use navigator.onLine and online/offline events
- Show banner at top of app when offline
- Queue failed API calls for retry when back online

Task 16 - Onboarding improvements:
- Add progress indicator (step X of Y) to OnboardingPage
- Show email verification state when session is null
- Allow pause/resume by persisting onboarding step to localStorage

Task 17 - Evidence draft persistence:
- In useCourtStore, persist localEvidence/localFeelings/localNeeds to localStorage
- Key by session ID to avoid mixing drafts
- Restore on component mount if session matches
- Clear on successful submit

Task 18 - Timeout countdown:
- Add remaining time display to CourtroomPage
- Server sends phaseStartedAt and timeout duration
- Client calculates and shows countdown
- Show warning at 2 minutes, 30 seconds remaining"
```

```
Launch Push Notifications Agent:
"Implement notification UX improvements.

M13 - In-app notification toast:
- Create client/src/components/shared/NotificationToast.jsx
- Listen for pushNotificationReceived event in App.jsx
- Show toast with notification content and action button
- Auto-dismiss after 5 seconds

Task 19 - Notification settings screen:
- Create client/src/pages/NotificationSettingsPage.jsx
- Show current permission status
- Guide user to re-enable if denied (link to system settings on mobile)
- List notification types with toggles

L1 - Router navigation:
- Replace window.location.href with react-router navigate()
- Import useNavigate or use router.push
- Preserves app state on notification tap"
```

---

## Progress Tracking

Use TodoWrite to track progress. Create todos for each phase/wave:

```
Phase 0 - Blockers:
[ ] B1 - RevenueCat HMAC fix
[ ] B2 - Sign-up email confirmation
[ ] B3 - Timeout persistence system
[ ] H5 - Resolution distributed locking
[ ] H6 - Settlement timeout persistence
[ ] H1 - Account deletion
[ ] H2 - Partner disconnect
[ ] H3 - Device-scoped token deactivation

Phase 1 - Security:
[ ] M1 - LLM security middleware wiring
[ ] M2 - LLM output validation
[ ] M3 - Redis rate limiting
[ ] M4 - Error message normalization (35+ files)
[ ] H4 - AI insights explicit consent
[ ] M6 - Event reminder scheduler
[ ] M7 - Redis pub/sub race fix
[ ] M8 - Redis key TTL
[ ] M9 - Verdict generation retry

Phase 2 - UX:
[ ] M14 - Offline detection banner
[ ] M13 - In-app notification toast
[ ] Task 16 - Onboarding improvements
[ ] Task 17 - Evidence draft persistence
[ ] Task 18 - Timeout countdown UI
[ ] Task 19 - Notification settings
[ ] L1 - Router navigation for notifications
```

---

## Verification Checklist

After all fixes are complete, verify:

### Blocking Issues
- [ ] RevenueCat webhook: Test with actual webhook payload and signature
- [ ] Sign-up: Test with email confirmation enabled in Supabase
- [ ] Court timeouts: Test by restarting server mid-session

### High Issues
- [ ] Account deletion: Delete account, verify data removed, verify can't login
- [ ] Partner disconnect: Disconnect, verify both users see disconnected state
- [ ] Push tokens: Log out one device, verify other device still gets pushes
- [ ] AI consent: Verify insights endpoint returns 403 without explicit consent
- [ ] Resolution race: Simulate concurrent picks, verify no state corruption
- [ ] Settlement timeout: Request settlement, restart server, verify timeout still fires

### Run Test Suites
```bash
cd client && npm test
cd server && npm test
```

### Manual Testing
- [ ] Full sign-up flow with email confirmation
- [ ] Complete court session flow
- [ ] Partner connection and disconnect
- [ ] Push notification receipt on multiple devices
- [ ] Offline/online transitions

---

## Final Notes

1. **Parallel Execution**: Launch independent agents simultaneously to save time
2. **Dependencies**: B3 must complete before H5/H6 (they use the same timeout pattern)
3. **Testing**: Each sub-agent should run tests before reporting completion
4. **Integration**: After sub-agents complete, do a full integration test
5. **Documentation**: Update PRODUCTION_READINESS_REVIEW.md as issues are fixed

When all Phase 0 + Phase 1 issues are fixed, the app is minimally production-ready.
When Phase 2 is also complete, the app is recommended for launch.
