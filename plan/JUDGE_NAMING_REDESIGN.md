# Judge Naming System Redesign

## Problem Statement

The current judge naming system has several issues:

1. **Speed claims are inaccurate**: DeepSeek (Lightning) is labeled as "fast and focused" but Gemini 3 Flash is actually the fastest model
2. **Names don't reflect value proposition**: The names (Lightning, Mittens, Whiskers) don't clearly communicate what users are paying for
3. **IDs are misleading**: `fast`, `logical`, `best` don't accurately describe the models
4. **Model change needed**: Opus 4.5 should be changed to GPT 5.2 for Whiskers

## Current State

| ID | Name | Model | Subtitle | Target |
|----|------|-------|----------|--------|
| `fast` | Lightning | DeepSeek v3.2 | Fast and focused | Free tier |
| `logical` | Mittens | Gemini 3 Flash | Balanced and logical | Paid (speed) |
| `best` | Whiskers | Opus 4.5 | Deep and empathetic | Paid (quality) |

**Problems with current IDs:**
- `fast` → DeepSeek is NOT the fastest (Gemini is)
- `logical` → Gemini isn't particularly more "logical" than others
- `best` → Subjective, doesn't describe what makes it better

---

## Model Characteristics (Deep Dive)

### DeepSeek v3.2 (Reasoning Model)
- **Core Strength**: Chain-of-thought reasoning, methodical analysis
- **Personality**: The thoughtful analyst who considers all angles
- **Best for**: Everyday disputes, users who want solid reasoning
- **Trade-off**: Takes more time to think through problems
- **Why free tier**: Most cost-effective while still delivering quality

### Gemini 3 Flash
- **Core Strength**: Lightning-fast inference, efficient processing without sacrificing quality
- **Personality**: The quick-witted judge who cuts to the heart of the matter
- **Quality**: Often produces results as good as or better than slower models
- **Best for**: Busy couples who need quality resolution NOW
- **Why premium**: Users pay for speed AND quality - the best of both worlds

### OpenAI GPT 5.2
- **Core Strength**: Exceptional emotional intelligence, nuanced human understanding, deep empathy
- **Personality**: The wise elder who's seen it all and truly understands
- **Best for**: Complex emotional disputes, recurring patterns, deep-seated issues
- **Trade-off**: Premium pricing
- **Why premium**: Therapist-level insight is worth paying for

---

## Proposed ID System

New IDs that accurately reflect each judge's actual characteristics:

| Old ID | New ID | Rationale |
|--------|--------|-----------|
| `fast` | `classic` | The standard, reliable everyday option |
| `logical` | `swift` | Fast AND excellent quality |
| `best` | `wise` | Reflects wisdom and depth, not just "better" |

**Why these IDs work:**
- **`classic`**: Like "classic" Coke - the standard, reliable choice everyone knows
- **`swift`**: Communicates speed while being elegant (not implying lesser quality)
- **`wise`**: Describes the actual differentiator - wisdom and emotional depth

---

## Proposed Judge Names & Personalities

### Judge Mochi (DeepSeek v3.2) - ID: `classic`

**Why "Mochi":**
- Mochi is made slowly with care - like DeepSeek's methodical reasoning
- Soft, comforting, approachable - perfect for everyday disputes
- A beloved cat name that feels warm and friendly
- Unique and memorable

**Personality Profile:**
> *A gentle, contemplative cat who believes good things take time. Judge Mochi approaches every dispute with patience and care, kneading through the details until everything makes sense. Like the treat they're named after, Mochi's verdicts are soft on delivery but satisfying to the core. Your cozy, reliable companion for everyday disagreements.*

### Judge Dash (Gemini 3 Flash) - ID: `swift`

**Why "Dash":**
- Immediately communicates speed (cats dash!)
- Short, punchy name that matches the quick personality
- Memorable and distinct from other judges

**Personality Profile:**
> *Don't let the speed fool you—Judge Dash is sharp as a claw. The prodigy of Cat Court, Dash earned her reputation by delivering verdicts that are both lightning-fast AND brilliantly insightful. While others are still pondering, Dash has already seen the answer. When you need clarity in the heat of the moment without compromising on quality, there's only one choice.*

### Judge Whiskers (GPT 5.2) - ID: `wise`

**Why keep "Whiskers":**
- Already established as the premium brand
- "Whiskers" suggests age, wisdom, and experience
- Long whiskers = long experience in cat lore

**Personality Profile:**
> *The legendary sage of Cat Court. Judge Whiskers has spent a lifetime studying the intricate dance of human hearts. With an almost mystical ability to sense what's really happening beneath the surface—the fears, the hopes, the unspoken needs—Whiskers doesn't just resolve disputes. They transform them into moments of genuine understanding. When the stakes are highest and you need someone who truly gets it, Whiskers is there.*

---

## Full Descriptions (for UI)

### English

```json
"judges": {
  "classic": {
    "name": "Judge Mochi",
    "subtitle": "The Gentle Thinker",
    "description": "A warm, patient judge who takes time to understand both sides. Like the treat they're named after, Mochi's verdicts are comforting and satisfying. Your reliable companion for everyday disputes.",
    "tagline": "Included with your plan"
  },
  "swift": {
    "name": "Judge Dash",
    "subtitle": "Speed Meets Brilliance",
    "description": "Don't mistake fast for shallow. Dash delivers razor-sharp verdicts at record speed—no waiting, no compromises. When you need answers NOW without sacrificing quality, Dash is your judge.",
    "tagline": "Fast AND insightful"
  },
  "wise": {
    "name": "Judge Whiskers",
    "subtitle": "The Wise Sage",
    "description": "The legendary elder of Cat Court with an almost mystical understanding of the human heart. Whiskers sees what others miss—the patterns beneath the patterns, the needs behind the words. For your most important moments.",
    "tagline": "Therapist-level wisdom"
  }
}
```

### Chinese (Simplified)

```json
"judges": {
  "classic": {
    "name": "麻糬法官",
    "subtitle": "温柔的思考者",
    "description": "一位温暖、耐心的法官，会花时间理解双方。就像他们的名字一样，麻糬的裁决温暖而令人满足。您日常争议的可靠伙伴。",
    "tagline": "包含在您的计划中"
  },
  "swift": {
    "name": "疾风法官",
    "subtitle": "速度与智慧并存",
    "description": "不要误以为快就是浅。疾风以创纪录的速度给出精准的裁决——无需等待，绝不妥协。当您需要即刻答案而不牺牲质量时，疾风就是您的法官。",
    "tagline": "快速且深刻"
  },
  "wise": {
    "name": "胡须法官",
    "subtitle": "睿智的贤者",
    "description": "猫咪法庭的传奇长老，对人心有近乎神秘的洞察力。胡须法官能看到他人看不到的——表象之下的深层规律，话语背后的真实需求。为您最重要的时刻而存在。",
    "tagline": "心理治疗级的智慧"
  }
}
```

---

## Files to Modify

### 1. Server-Side Model Configuration
**File**: `server/src/lib/judgeEngine.js`

```javascript
// FROM:
const JUDGE_MODELS = {
    best: 'anthropic/claude-opus-4.5',
    fast: 'deepseek/deepseek-v3.2',
    logical: 'google/gemini-3-flash-preview'
};

// TO:
const JUDGE_MODELS = {
    wise: 'openai/gpt-5.2-chat',
    classic: 'deepseek/deepseek-v3.2',
    swift: 'google/gemini-3-flash-preview'
};
```

### 2. Client Judge Selection UI
**File**: `client/src/components/court/JudgeSelection.jsx`
- Update `JUDGES` array with new IDs, names, and i18n keys
- Update model display names

### 3. Translation Files
**Files**:
- `client/src/i18n/locales/en.json`
- `client/src/i18n/locales/zh-Hans.json`
- Update with new judge definitions (see above)

### 4. Subscription Store
**File**: `client/src/store/useSubscriptionStore.js`
- Update `JUDGE_ID_MAP` and `JUDGE_NAME_MAP`
- Update usage limits keys

### 5. Usage Tracking (Server)
**Files**:
- `server/src/lib/usageTracking.js`
- `server/src/lib/usageLimits.js`
- `server/src/routes/usage.js`
- Update valid types and column mappings

### 6. Verdict Generator
**File**: `server/src/lib/court/verdictGenerator.js`
- Update `mapJudgeTypeToUsage()` function

### 7. Court Store
**File**: `client/src/store/courtStore.js`
- Update any references to judge types

### 8. Database Migration (REQUIRED)
**New migration needed** to rename columns:
```sql
-- Rename usage tracking columns
ALTER TABLE usage_tracking
  RENAME COLUMN lightning_count TO classic_count;
ALTER TABLE usage_tracking
  RENAME COLUMN mittens_count TO swift_count;
ALTER TABLE usage_tracking
  RENAME COLUMN whiskers_count TO wise_count;
```

---

## ID Mapping (for migration)

| Old ID | Old DB Column | New ID | New DB Column |
|--------|---------------|--------|---------------|
| `fast` | `lightning_count` | `classic` | `classic_count` |
| `logical` | `mittens_count` | `swift` | `swift_count` |
| `best` | `whiskers_count` | `wise` | `wise_count` |

---

## Value Proposition Summary

| Judge | ID | Model | What Users Get | Why Pay? |
|-------|-----|-------|----------------|----------|
| **Mochi** | `classic` | DeepSeek v3.2 | Thoughtful, methodical verdicts | Free - your everyday companion |
| **Dash** | `swift` | Gemini 3 Flash | Speed + quality combined | Pay for speed without compromise |
| **Whiskers** | `wise` | GPT 5.2 | Deep emotional intelligence | Pay for therapist-level insight |

---

## Key Messaging Clarification

### Dash is NOT "lesser quality"
- Dash delivers verdicts that are often as good as or better than slower models
- Speed is the feature, not a trade-off
- Users pay for the luxury of not having to wait
- Messaging should emphasize "speed + brilliance" not "speed vs quality"

### Mochi is "solid and reliable"
- Not the fastest, not the most sophisticated, but dependable
- Perfect for everyday disputes that don't need premium treatment
- The comfortable choice users can always count on

### Whiskers is "the sage"
- For when you need someone who really understands human complexity
- Pattern recognition across relationship history
- Worth the premium for high-stakes emotional situations

---

## Implementation Steps

1. **Create database migration** - Rename columns in `usage_tracking` table
2. **Update server judge configuration** - New IDs and GPT 5.2 model
3. **Update usage tracking code** - Server-side type validation and mappings
4. **Update i18n files** - New names and rich descriptions (both languages)
5. **Update JudgeSelection component** - New IDs and UI
6. **Update subscription store** - ID maps and limits
7. **Update court store** - Any judge type references
8. **Test end-to-end** - Judge selection → verdict generation → usage tracking

---

## Alternative Name Options (If Not Mochi)

If "Mochi" doesn't feel right, here are other options for the DeepSeek judge:

| Name | Vibe | Rationale |
|------|------|-----------|
| **Judge Maple** | Warm, patient | Maple syrup = slow, careful process; sweet results |
| **Judge Chai** | Cozy, contemplative | A warm drink you savor slowly |
| **Judge Hazel** | Wise, grounded | Nature-inspired, warm hazel eyes |
| **Judge Chestnut** | Warm, thoughtful | Roasting chestnuts = slow, cozy, deliberate |
| **Judge Butterscotch** | Sweet, comforting | Rich and satisfying, takes time to make |
| **Judge Clover** | Lucky, patient | Quietly reliable, brings good fortune |

---

## Success Criteria

- [ ] IDs accurately reflect model characteristics (`classic`, `swift`, `wise`)
- [ ] Speed claims correctly positioned (Dash = fastest AND high quality)
- [ ] Names communicate personality (Mochi = gentle, Dash = brilliant speed, Whiskers = sage)
- [ ] Descriptions are engaging and character-driven
- [ ] GPT 5.2 is used for premium judge
- [ ] Database migration successful
- [ ] All usage tracking works with new IDs
- [ ] Both English and Chinese translations complete
