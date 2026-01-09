# Judge Engine v2.0 - Architecture & Bug Tracking

## Overview

The v2.0 judging system implements a **multi-stage therapeutic pipeline** for couple conflict resolution. Instead of a single LLM call that produces a verdict, the new system guides couples through a collaborative resolution process.

Note: The legacy v1 pipeline has been removed. There is no fallback path.

---

## Expected Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          V2.0 THERAPEUTIC PIPELINE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. EVIDENCE PHASE                                                          │
│     ├─ Both users submit their facts and feelings                           │
│     └─ Phase: EVIDENCE → ANALYZING                                          │
│                                                                             │
│  2. ANALYZING PHASE (LLM Call 1)                                            │
│     ├─ Safety moderation check                                              │
│     ├─ Memory retrieval (RAG for historical context)                        │
│     ├─ Analyst + Repair Selection                                           │
│     │   ├─ Identifies conflict dynamics (Pursuer-Distancer, etc.)           │
│     │   ├─ Detects Four Horsemen patterns                                   │
│     │   ├─ Assesses intensity (high/medium/low)                             │
│     │   └─ Generates 3 resolution options                                   │
│     └─ Phase: ANALYZING → PRIMING                                           │
│                                                                             │
│  3. PRIMING PHASE (LLM Call 2)                                              │
│     ├─ Generates personalized priming content for each user                 │
│     │   ├─ "Your Feelings" - reflection on their perspective                │
│     │   ├─ "Partner's Perspective" - empathy building                       │
│     │   └─ Reflection questions                                             │
│     ├─ Generates joint menu content                                         │
│     │   ├─ Summary of the real issue                                        │
│     │   ├─ "The Good Stuff" - what each person did well                     │
│     │   ├─ "Growth Edges" - areas to improve                                │
│     │   └─ Resolution preview                                               │
│     └─ Phase: PRIMING (users read individually)                             │
│                                                                             │
│  4. JOINT_READY PHASE                                                       │
│     ├─ Both users mark priming as complete                                  │
│     ├─ Users view joint menu together                                       │
│     └─ Phase: JOINT_READY → RESOLUTION                                      │
│                                                                             │
│  5. RESOLUTION PHASE                                                        │
│     ├─ Users independently pick their preferred resolution (A, B, or C)     │
│     ├─ If picks match → resolution finalized                                │
│     ├─ If picks differ (RESOLUTION_MISMATCH):                               │
│     │   ├─ Accept partner's choice, OR                                      │
│     │   └─ Request hybrid resolution (LLM Call 3)                           │
│     └─ Phase: RESOLUTION → VERDICT                                          │
│                                                                             │
│  6. VERDICT PHASE                                                           │
│     ├─ Final resolution displayed                                           │
│     ├─ Both users accept                                                    │
│     └─ Phase: VERDICT → CLOSED                                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## New Phases

| Phase | Description | Timeout |
|-------|-------------|---------|
| `ANALYZING` | LLM analyzing conflict and generating resolutions | 5 minutes |
| `PRIMING` | Users reading personalized reflection content | 1 hour |
| `JOINT_READY` | Both users ready to view joint menu | 1 hour |
| `RESOLUTION` | Users picking preferred resolution | 1 hour |

---

## Key Files Modified

### Backend
| File | Changes |
|------|---------|
| `server/src/lib/judgeEngine.js` | Added `deliberatePhase1`, `deliberatePhase2`, `runHybridResolution` functions |
| `server/src/lib/courtSessionManager.js` | Added new phases, methods, timeout handlers |
| `server/src/lib/courtInit.js` | **CRITICAL**: Must pass v2.0 functions to session manager |
| `server/src/routes/court.js` | Added v2.0 endpoints |
| `supabase/migrations/018_v2_priming_and_resolution.sql` | Database fields for v2.0 data |

### Frontend
| File | Changes |
|------|---------|
| `client/src/store/courtStore.js` | Added v2.0 VIEW_PHASE values, COURT_PHASES alias |
| `client/src/pages/CourtroomPageV2.jsx` | Added ANALYZING phase routing |

---

## 🐛 Current Bugs

### Bug 1: Verdict Page Shown Immediately After Evidence Submission
**Status:** 🔴 CRITICAL - Not Fixed

**Symptom:** 
After both users submit evidence, the verdict page ("Judge Whiskers Has Spoken") appears immediately instead of showing the meditation/waiting screen.

**Screenshot:**
![Verdict shown immediately](docs/bug_verdict_shown_immediately.png)

**Root Causes Identified:**
1. ~~`courtInit.js` only passed `deliberate` function, not v2.0 functions~~ (Fixed)
2. ~~Frontend `courtSession.status` vs backend `session.phase` mismatch~~ (Fixed)
3. **Server may not have been restarted** after code changes
4. **Frontend routing may still be falling through to verdict view**

**Investigation Needed:**
- Check server console for v2.0 pipeline logs (`[Court] V2.0 Phase 1:`, `[Court] V2.0 Phase 2:`)
- Verify `deliberatePhase1` is being called (add more logging)
- Check if `_computeViewPhase` returns correct values for new phases

---

### Bug 3: No V2.0 UI Pages Exist Yet
**Status:** ✅ Fixed

**Notes:**
The v2.0 UI pages now exist and are wired in `client/src/pages/CourtroomPageV2.jsx`.

---

## Debugging Checklist

### Server-Side
```bash
# 1. Restart server
cd server && npm run dev

# 2. Watch for these log messages:
# ✅ "[Court] V2.0 Phase 1: Analyst + Repair for session ..."
# ✅ "[Court] V2.0 Phase 2: Priming + Joint Menu for session ..."
# ✅ "[Court] V2.0 pipeline complete for session ... → PRIMING"
```

### Frontend-Side
```javascript
// Add to CourtroomPage.jsx for debugging:
console.log('[DEBUG] phase:', phase);
console.log('[DEBUG] sessionPhase:', courtSession?.phase);
console.log('[DEBUG] sessionStatus:', courtSession?.status);
```

---

## Next Steps

1. **Verify server restart** - The v2.0 functions won't be available until server restarts
2. **Add debugging logs** - Confirm which pipeline path is taken
3. **Create v2.0 UI pages** - PrimingPage, JointMenuPage, ResolutionSelectPage
4. **Test full flow** - Evidence → Analyzing → Priming → Joint → Resolution → Verdict

---

## API Endpoints (V2.0)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/court/priming/complete` | POST | Mark priming as read |
| `/api/court/joint/ready` | POST | Mark ready to proceed from joint menu |
| `/api/court/resolution/pick` | POST | Submit resolution choice (A, B, or C) |
| `/api/court/resolution/accept-partner` | POST | Accept partner's resolution pick |
| `/api/court/resolution/hybrid` | POST | Request hybrid resolution generation |
