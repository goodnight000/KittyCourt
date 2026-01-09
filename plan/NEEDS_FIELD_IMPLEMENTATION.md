# Needs Field Implementation Plan

## Executive Summary

This plan outlines the addition of a "Needs" field to the evidence submission phase of the judging system. This enhancement is grounded in **Nonviolent Communication (NVC)** principles, which emphasize that behind every conflict are unmet needs. By explicitly capturing these needs, the AI judge can:

1. Provide more targeted resolutions that address root causes
2. Help partners understand *what* each person needs, not just *what* they're upset about
3. Create priming content that builds empathy around needs, not just feelings
4. Select resolution options that directly address the expressed needs

---

## MANDATORY: Subagent Model Directive

**ALL SUBAGENTS MUST USE `opus 4.5` (claude-opus-4-5-20251101) MODEL.**

This is non-negotiable. When spawning any Task for junior developers, always specify:
```javascript
model: "opus"
```

---

## Part 1: Technical Implementation

### 1.1 Database Migration (NEW)

A new migration file is required to add needs columns to both tables.

#### File: `supabase/migrations/XXX_add_needs_fields.sql`

```sql
-- Add needs fields to court_sessions (real-time session)
ALTER TABLE court_sessions
ADD COLUMN IF NOT EXISTS user_a_needs TEXT;

ALTER TABLE court_sessions
ADD COLUMN IF NOT EXISTS user_b_needs TEXT;

-- Add needs fields to cases (permanent storage for history)
ALTER TABLE cases
ADD COLUMN IF NOT EXISTS user_a_needs TEXT DEFAULT '';

ALTER TABLE cases
ADD COLUMN IF NOT EXISTS user_b_needs TEXT DEFAULT '';

-- Add comment for documentation
COMMENT ON COLUMN court_sessions.user_a_needs IS 'User A unmet needs during evidence phase';
COMMENT ON COLUMN court_sessions.user_b_needs IS 'User B unmet needs during evidence phase';
COMMENT ON COLUMN cases.user_a_needs IS 'User A unmet needs (persisted from session)';
COMMENT ON COLUMN cases.user_b_needs IS 'User B unmet needs (persisted from session)';
```

---

### 1.2 Schema Changes

#### Server: `server/src/lib/schemas.js`

**Updated SubmissionSchema:**
```javascript
const SubmissionSchema = z.object({
    cameraFacts: z.string().min(1, 'Camera facts are required'),
    selectedPrimaryEmotion: z.string().optional().default('not specified'),
    theStoryIamTellingMyself: z.string().min(1, 'Story is required'),
    unmetNeeds: z.string().min(1, 'Unmet needs are required'),  // NEW REQUIRED FIELD
});
```

**Note:** Remove `coreNeed` field - it was unused and this is not a published app.

---

### 1.3 Backend API Changes

#### Files to Update:
- `server/src/routes/court.js` - WebSocket handlers
- `server/src/routes/cases.js` - REST API for case persistence
- `server/src/lib/courtSessionManager.js` - Session state management

**Changes Required:**

1. **Evidence Submission Handler:**
   - Accept `needs` field alongside `evidence` and `feelings`
   - Store in session state: `user_a_needs` / `user_b_needs`

2. **Case Creation (when session closes):**
   - Copy `user_a_needs` and `user_b_needs` from session to cases table

3. **Case Retrieval (`transformCase` function in `cases.js`):**
   - Include `userANeeds` and `userBNeeds` in transformed output

```javascript
// In transformCase function:
return {
    id: c.id,
    userAId: c.user_a_id,
    userBId: c.user_b_id,
    userAInput: c.user_a_input,
    userAFeelings: c.user_a_feelings,
    userANeeds: c.user_a_needs,        // NEW
    userBInput: c.user_b_input,
    userBFeelings: c.user_b_feelings,
    userBNeeds: c.user_b_needs,        // NEW
    // ... rest
};
```

---

### 1.4 Frontend Changes

#### File: `client/src/store/courtStore.js`

```javascript
// Add to state
localNeeds: '',

// Add setter
setLocalNeeds: (text) => set({ localNeeds: text }),

// Update submitEvidence action
submitEvidence: async () => {
    const { localEvidence, localFeelings, localNeeds } = get();
    // Clear all local inputs on submit
    set({ localEvidence: '', localFeelings: '', localNeeds: '' });

    // Include needs in WebSocket payload
    const response = await submitAction(socketRef, {
        evidence: localEvidence,
        feelings: localFeelings,
        needs: localNeeds  // NEW
    });
    // ...
}

// Update reset function
reset: () => {
    set({
        // ... existing fields
        localNeeds: '',  // NEW
    });
}
```

#### File: `client/src/pages/CourtroomPage.jsx`

**EvidenceForm component - Add third textarea:**

```jsx
{/* NEW: Needs Field */}
<div>
    <label className="flex items-center gap-2 text-sm font-medium text-court-brown mb-2">
        <Target className="w-4 h-4" />  {/* or appropriate icon */}
        {t('courtroom.evidence.needsLabel')}
    </label>
    <textarea
        value={localNeeds}
        onChange={(e) => setLocalNeeds(e.target.value)}
        placeholder={t('courtroom.evidence.needsPlaceholder')}
        maxLength={maxLen}
        className="w-full h-32 px-4 py-3 rounded-xl border-2 border-court-tan/30
            focus:border-court-gold focus:ring-2 focus:ring-court-gold/20
            bg-white/50 text-court-brown placeholder-court-brownLight/50
            transition-all resize-none"
    />
    <div className="flex items-center justify-between mt-2">
        <span className="text-[11px] text-court-brownLight/80">
            {t('courtroom.evidence.needsHint')}
        </span>
        <span className="text-[11px] text-neutral-400">{needsLen}/{maxLen}</span>
    </div>
</div>
```

**Update submit button disabled condition:**
```jsx
disabled={isSubmitting || !localEvidence.trim() || !localFeelings.trim() || !localNeeds.trim()}
```

---

### 1.5 Case History Display (NEW SECTION)

#### File: `client/src/pages/CaseDetailPage.jsx`

**Update Partner Statements section to include needs:**

```jsx
{/* Partner A */}
<div className="glass-card p-4 border-l-4 border-pink-400">
    {/* ... existing content ... */}
    <div className="space-y-2 pl-10">
        <div className="flex items-start gap-2">
            <MessageCircle className="w-4 h-4 text-pink-400 mt-0.5 flex-shrink-0" />
            <p className="text-neutral-700 text-sm">
                {caseData.userAInput || t('cases.detail.partnerStatements.noInput')}
            </p>
        </div>
        {caseData.userAFeelings && (
            <div className="flex items-start gap-2">
                <Heart className="w-4 h-4 text-pink-400 mt-0.5 flex-shrink-0" />
                <p className="text-neutral-600 text-sm italic">{caseData.userAFeelings}</p>
            </div>
        )}
        {/* NEW: Needs display */}
        {caseData.userANeeds && (
            <div className="flex items-start gap-2">
                <Target className="w-4 h-4 text-pink-400 mt-0.5 flex-shrink-0" />
                <div>
                    <p className="text-[10px] font-bold text-pink-500 uppercase mb-0.5">
                        {t('cases.detail.partnerStatements.needs')}
                    </p>
                    <p className="text-neutral-600 text-sm">{caseData.userANeeds}</p>
                </div>
            </div>
        )}
    </div>
</div>

{/* Partner B - same pattern */}
```

---

### 1.6 LLM Prompt Changes

#### File: `server/src/lib/prompts.js`

**`buildAnalystRepairUserPrompt` - Updated submissions section:**

```javascript
return `Analyze this couple's conflict and select 3 resolution options.

## Participants
- User A: ${input.participants.userA.name}
- User B: ${input.participants.userB.name}

## User Self-Reported Intensity
${userReportedIntensity || "Not provided — assess from language"}

## Personality Profiles
### ${input.participants.userA.name}
${userAProfile}

### ${input.participants.userB.name}
${userBProfile}

## Historical Context
${historicalContext || "No prior history available"}

## Submissions

### ${input.participants.userA.name}
- **Facts (what happened)**: "${input.submissions.userA.cameraFacts}"
- **Feelings (how it made them feel)**: "${input.submissions.userA.theStoryIamTellingMyself}"
- **Unmet Needs**: "${input.submissions.userA.unmetNeeds}"

### ${input.participants.userB.name}
- **Facts (what happened)**: "${input.submissions.userB.cameraFacts}"
- **Feelings (how it made them feel)**: "${input.submissions.userB.theStoryIamTellingMyself}"
- **Unmet Needs**: "${input.submissions.userB.unmetNeeds}"

## Addendums
${addendumLines}

${languageInstruction}

## REPAIR LIBRARY
${repairLibrary}

---
Output analysis and 3 resolutions as JSON.`;
```

**Also update `buildPrimingJointUserPrompt` similarly.**

---

## Part 2: LLM Prompt Analysis & Improvements

### 2.1 Current Prompt Analysis

| Issue | Current State | Impact | Recommendation |
|-------|--------------|--------|----------------|
| **Missing needs framework** | Only analyzes "vulnerable emotions" | Misses actionable repair targets | Add explicit needs analysis section |
| **Horsemen detection is binary** | Reports presence/absence only | Loses nuance about severity | Add severity/frequency indicators |
| **Resolution rationale is generic** | "Why this fits THIS conflict" | Often produces template responses | Add structured rationale with needs→resolution mapping |
| **No differentiation for recurring patterns** | Treats all conflicts equally | Misses opportunity for pattern-breaking | Add "Is this a recurring theme?" detection |
| **Priming lacks needs translation** | Explains feelings but not needs | Doesn't help users articulate needs | Add yourNeeds/partnerNeeds sections |
| **Joint menu missing needs bridge** | Summarizes conflict without bridging | Misses opportunity to find common ground | Add needsBridge section |

---

### 2.2 Recommended Prompt Enhancements

#### Enhancement 1: Add Needs Analysis to Analyst Prompt

**Add to ANALYST_REPAIR_SYSTEM_PROMPT:**

```markdown
## NEEDS ANALYSIS (NVC Framework)

The user has explicitly stated their unmet needs. Map these to universal human needs:
- **Connection**: Closeness, intimacy, belonging, acceptance
- **Autonomy**: Independence, freedom, space, choice
- **Security**: Stability, predictability, trust, safety
- **Significance**: Recognition, appreciation, being valued
- **Growth**: Learning, progress, purpose, meaning

For each partner, identify:
1. **Primary unmet need** - What they most desperately need (derived from their stated needs)
2. **Secondary needs** - Other needs at play
3. **Need collision** - Where their needs conflict with partner's

Add to output:
"needsAnalysis": {
  "userA_PrimaryNeed": "connection",
  "userA_SecondaryNeeds": ["significance", "security"],
  "userA_StatedNeedMapping": "Their stated need for 'more quality time' maps to connection",
  "userB_PrimaryNeed": "autonomy",
  "userB_SecondaryNeeds": ["respect"],
  "userB_StatedNeedMapping": "Their stated need for 'space to decompress' maps to autonomy",
  "needCollision": "User A's need for connection conflicts with User B's need for autonomy",
  "bridgingPath": "Both need to feel they matter - A through togetherness, B through space"
}
```

---

#### Enhancement 2: Improve Resolution Selection with Needs Mapping

**Update resolution output format:**

```javascript
"resolutions": [
  {
    "id": "resolution_1",
    "title": "Display title",
    "repairAttemptIds": ["physical_0", "verbal_2"],
    "combinedDescription": "How to perform this resolution",
    "rationale": "Why this fits THIS conflict",
    "needsAddressed": {
      "userA": ["connection", "significance"],
      "userB": ["autonomy", "respect"]
    },
    "howItMeetsNeeds": "This resolution gives User A the verbal acknowledgment they crave while preserving User B's sense of agency by letting them choose the timing",
    "estimatedDuration": "5-30 minutes"
  }
]
```

---

#### Enhancement 3: Enhance Priming with Needs Translation

**Add to individual priming content:**

```markdown
### Section 5: Your Needs (yourNeeds)
1-2 paragraphs helping them understand their own needs in NVC terms:
- "You mentioned needing [their stated need]. At its core, this is about your need for [universal need]."
- "When this need isn't met, it makes sense that you feel [emotion]."
- "Your partner can help meet this need by [specific behavior], but remember that needs can be met in multiple ways."

### Section 6: Your Partner's Needs (partnerNeeds)
1-2 paragraphs helping them understand their partner's needs:
- "Your partner expressed needing [partner's stated need]. This is fundamentally about their need for [universal need]."
- "When you [behavior], they may interpret it as their [need] not mattering to you."
- "You could help meet this need by [specific behavior] - even small gestures count."
```

---

#### Enhancement 4: Improve Joint Menu with Needs Bridge

**Update jointMenu output:**

```javascript
"jointMenu": {
  "theSummary": "2-3 paragraphs synthesizing the real story",
  "needsBridge": {
    "whatUserANeeds": "To feel prioritized and connected",
    "whatUserBNeeds": "To feel trusted and given space",
    "commonGround": "Both of you need to feel that you matter to the other",
    "bridgingInsight": "The conflict isn't about [surface issue] - it's about how you show each other that you care"
  },
  "theGoodStuff": { ... },
  "theGrowthEdges": { ... },
  "resolutionPreview": "...",
  "closingWisdom": "..."
}
```

---

## Part 3: Implementation Phases

### Phase 1: Database & Backend
**Assignee:** Subagent (MUST USE opus 4.5 model)
**Skills to use:** `backend-development:api-design-principles`, `sql-optimization-patterns`

1. Create new migration file `XXX_add_needs_fields.sql`
2. Update `SubmissionSchema` in `schemas.js` (remove `coreNeed`, add `unmetNeeds`)
3. Update WebSocket handlers in `court.js` to accept `needs` field
4. Update `courtSessionManager.js` to store needs in session state
5. Update `cases.js`:
   - `transformCase` to include `userANeeds` and `userBNeeds`
   - Case creation to copy needs from session
6. Write unit tests

### Phase 2: Frontend - Evidence Submission
**Assignee:** Subagent (MUST USE opus 4.5 model)
**Skills to use:** `react-state-management`, `frontend-design`

1. Add `localNeeds` state to `courtStore.js`
2. Add `setLocalNeeds` setter
3. Update `submitEvidence` action to include needs
4. Update `reset` function to clear `localNeeds`
5. Add third textarea to `EvidenceForm` in `CourtroomPage.jsx`
6. Update submit button disabled condition
7. Add i18n strings for needs field

### Phase 3: Frontend - Case History Display
**Assignee:** Subagent (MUST USE opus 4.5 model)
**Skills to use:** `react-state-management`, `frontend-design`

1. Update `CaseDetailPage.jsx` Partner Statements section
2. Add needs display for both partners with appropriate icon
3. Add i18n strings for case history needs labels
4. Handle missing needs gracefully (only show if present)

### Phase 4: LLM Prompt Updates
**Assignee:** Subagent (MUST USE opus 4.5 model)
**Skills to use:** `senior-prompt-engineer`

1. Update `buildAnalystRepairUserPrompt` to include needs in submissions
2. Add NEEDS ANALYSIS section to `ANALYST_REPAIR_SYSTEM_PROMPT`
3. Update `PRIMING_JOINT_SYSTEM_PROMPT` with needs sections
4. Update `buildPrimingJointUserPrompt` to pass needs
5. Update JSON schemas in `jsonSchemas.js` for new output fields
6. Update Zod schemas in `schemas.js` for new output validation

### Phase 5: Testing & Integration
**Assignee:** Subagent (MUST USE opus 4.5 model)
**Skills to use:** `debugging-strategies`, `code-review-excellence`

1. End-to-end testing of full evidence → verdict flow
2. LLM output quality review (are needs being used effectively?)
3. Case history display verification
4. Edge case testing (empty needs, very long needs)

---

## Part 4: JSON Schema Updates

### Updated ANALYST_REPAIR_JSON_SCHEMA

```javascript
// Add to analysis object properties:
needsAnalysis: {
  type: 'object',
  properties: {
    userA_PrimaryNeed: { type: 'string' },
    userA_SecondaryNeeds: { type: 'array', items: { type: 'string' } },
    userA_StatedNeedMapping: { type: 'string' },
    userB_PrimaryNeed: { type: 'string' },
    userB_SecondaryNeeds: { type: 'array', items: { type: 'string' } },
    userB_StatedNeedMapping: { type: 'string' },
    needCollision: { type: 'string' },
    bridgingPath: { type: 'string' }
  },
  required: ['userA_PrimaryNeed', 'userB_PrimaryNeed', 'needCollision', 'bridgingPath'],
  additionalProperties: false
}

// Add to each resolution:
needsAddressed: {
  type: 'object',
  properties: {
    userA: { type: 'array', items: { type: 'string' } },
    userB: { type: 'array', items: { type: 'string' } }
  },
  additionalProperties: false
},
howItMeetsNeeds: { type: 'string' }
```

### Updated PRIMING_JOINT_JSON_SCHEMA

```javascript
// Add to individualPriming.userA/userB:
yourNeeds: { type: 'string', description: '1-2 paragraphs about their needs' },
partnerNeeds: { type: 'string', description: '1-2 paragraphs about partner needs' }

// Add to jointMenu:
needsBridge: {
  type: 'object',
  properties: {
    whatUserANeeds: { type: 'string' },
    whatUserBNeeds: { type: 'string' },
    commonGround: { type: 'string' },
    bridgingInsight: { type: 'string' }
  },
  required: ['whatUserANeeds', 'whatUserBNeeds', 'commonGround', 'bridgingInsight'],
  additionalProperties: false
}
```

---

## Part 5: i18n Strings to Add

### English (`en.json`)
```json
{
  "courtroom": {
    "evidence": {
      "needsLabel": "What do you need?",
      "needsPlaceholder": "What needs of yours feel unmet? What would you need from your partner to feel heard, safe, or loved?",
      "needsHint": "Focus on your needs, not what your partner should do differently"
    }
  },
  "cases": {
    "detail": {
      "partnerStatements": {
        "needs": "Unmet Needs"
      }
    }
  }
}
```

### Chinese Simplified (`zh-Hans.json`)
```json
{
  "courtroom": {
    "evidence": {
      "needsLabel": "你需要什么？",
      "needsPlaceholder": "你有什么需求没有被满足？你需要伴侣做什么才能让你感到被倾听、安全或被爱？",
      "needsHint": "专注于你的需求，而不是你的伴侣应该怎么做"
    }
  },
  "cases": {
    "detail": {
      "partnerStatements": {
        "needs": "未满足的需求"
      }
    }
  }
}
```

---

## Part 6: File Change Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `supabase/migrations/XXX_add_needs_fields.sql` | **NEW** | Add needs columns to court_sessions and cases |
| `server/src/lib/schemas.js` | MODIFY | Add `unmetNeeds` to SubmissionSchema, remove `coreNeed` |
| `server/src/lib/jsonSchemas.js` | MODIFY | Add needsAnalysis, needsAddressed, needsBridge schemas |
| `server/src/lib/prompts.js` | MODIFY | Add needs to user prompts, add needs analysis instructions |
| `server/src/routes/court.js` | MODIFY | Accept needs in evidence submission |
| `server/src/routes/cases.js` | MODIFY | Include needs in transformCase output |
| `server/src/lib/courtSessionManager.js` | MODIFY | Store needs in session state |
| `client/src/store/courtStore.js` | MODIFY | Add localNeeds state and setter |
| `client/src/pages/CourtroomPage.jsx` | MODIFY | Add needs textarea to EvidenceForm |
| `client/src/pages/CaseDetailPage.jsx` | MODIFY | Display needs in Partner Statements |
| `client/src/i18n/locales/en.json` | MODIFY | Add needs i18n strings |
| `client/src/i18n/locales/zh-Hans.json` | MODIFY | Add needs i18n strings (Chinese) |

---

## Appendix: Skills Reference for Subagents

| Task Type | Recommended Skills |
|-----------|-------------------|
| Database migrations | `sql-optimization-patterns` |
| Backend API changes | `backend-development:api-design-principles` |
| Frontend state management | `react-state-management` |
| UI component design | `frontend-design` |
| LLM prompt optimization | `senior-prompt-engineer` |
| Testing strategy | `debugging-strategies` |
| Code quality review | `code-review-excellence` |

---

## CRITICAL REMINDER

**ALL SUBAGENTS MUST USE `opus 4.5` MODEL. NO EXCEPTIONS.**

When spawning Task tools, always include:
```javascript
model: "opus"
```
