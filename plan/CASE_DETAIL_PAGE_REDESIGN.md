# CaseDetailPage Redesign Plan

## Design Philosophy: Content-First Enhancement

**Goal:** Enhance the existing CaseDetailPage to feel more premium, cute, and immersive while keeping the **content as the primary focus**. This is not a theatrical redesign—it's a refinement that improves readability, hierarchy, and visual polish.

**Key Principle:** Every design decision should serve the content, not distract from it.

---

## What to REMOVE

1. **Judging Journey Overview** - The grid showing Evidence > Analysis > Priming etc. is not useful for reviewing a case
2. **Whiskers Avatar in Partner Cards** - Doesn't make sense, partners should have their own identity
3. **Whiskers Avatar in Verdict Header** - Reduces focus on the actual verdict content
4. **Resolution summary at top** - Clutters the header area

## What to ADD

1. **Judge Model Indicator** - Show which AI model (best/fast/logical) was used for this case
2. **Clear Facts/Feelings/Needs Layout** - Structured display of user inputs
3. **Subtle Page Backdrop** - Soft gradient orbs matching app style
4. **Better Section Headers** - Kicker-style labels for clear hierarchy
5. **Partner Profile Pictures** - Use actual profile pictures or initials, not Whiskers

## What to ENHANCE

1. **Partner Statement Cards** - Better structure for facts, feelings, needs
2. **Color Usage** - More intentional use of rose/violet for partner identity
3. **Typography Hierarchy** - Clearer visual levels
4. **Subtle Animations** - Keep existing animations, polish timing

---

## Detailed Changes

### 1. Header Enhancement

**Current:** Back button + title + date in one row

**Enhanced:**
```jsx
<div className="flex items-start gap-3">
  <motion.button
    whileTap={{ scale: 0.95 }}
    onClick={handleBack}
    className="rounded-2xl border border-white/80 bg-white/80 p-2.5 shadow-soft"
  >
    <ChevronLeft className="w-5 h-5 text-neutral-600" />
  </motion.button>
  <div className="flex-1 min-w-0">
    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-600">
      Case #{caseId?.slice(-6)}
    </p>
    <h1 className="text-xl font-display font-bold text-neutral-800 leading-tight">
      {caseData.caseTitle}
    </h1>
    <div className="flex items-center gap-2 text-xs text-neutral-500 mt-1">
      <Calendar className="w-3 h-3" />
      <span>{formattedDate}</span>
    </div>
  </div>
</div>
```

### 2. Case Meta Card (Replace Summary Card + Journey)

**New design:** Simple metadata card with badges and judge model

```jsx
<div className="glass-card p-4 space-y-3">
  {/* Badges row */}
  <div className="flex flex-wrap gap-2">
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${severityClasses}`}>
      <SeverityIcon className="w-3.5 h-3.5" />
      {severityLabel}
    </span>

    {primaryHissTag && primaryHissTag !== 'None' && (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${horsemanClasses}`}>
        {horsemanLabel}
      </span>
    )}
  </div>

  {/* Judge model indicator */}
  <div className="flex items-center gap-2 pt-2 border-t border-neutral-100">
    <Cpu className="w-4 h-4 text-neutral-400" />
    <span className="text-xs text-neutral-500">
      Judged by: <span className="font-semibold text-neutral-700">{getJudgeModelName(caseData.judgeModel)}</span>
    </span>
  </div>
</div>
```

**Judge Model Names:**
```js
const JUDGE_MODELS = {
  best: { name: 'Claude Opus', description: 'Most thoughtful' },
  fast: { name: 'DeepSeek', description: 'Quick response' },
  logical: { name: 'Gemini', description: 'Logical analysis' },
};
```

### 3. Partner Statements - Facts, Feelings, Needs Structure

**Current:** Single text block with statement and feelings

**Enhanced:** Clearly separated sections for different types of input

```jsx
<div className="space-y-4">
  {/* Section header */}
  <div className="flex items-center gap-2">
    <MessageCircle className="w-4 h-4 text-amber-500" />
    <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-[0.2em]">
      Partner Perspectives
    </span>
    <div className="flex-1 h-px bg-amber-200/50" />
  </div>

  {/* Partner A Card */}
  <div className="glass-card p-4 border-l-4 border-rose-400 space-y-4">
    {/* Header with profile */}
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-100 to-pink-100 border-2 border-white shadow-sm flex items-center justify-center">
        {partnerA?.avatar_url ? (
          <img src={partnerA.avatar_url} className="w-full h-full rounded-full object-cover" />
        ) : (
          <span className="text-sm font-bold text-rose-500">
            {partnerA?.display_name?.charAt(0) || 'A'}
          </span>
        )}
      </div>
      <div>
        <p className="font-semibold text-neutral-800">{partnerAName}</p>
        <p className="text-[10px] text-rose-400 uppercase tracking-wide">Their side</p>
      </div>
    </div>

    {/* The Facts - What happened */}
    <div className="space-y-1.5">
      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide flex items-center gap-1.5">
        <FileText className="w-3 h-3" />
        What happened
      </p>
      <p className="text-sm text-neutral-700 leading-relaxed bg-rose-50/50 rounded-lg p-3">
        {caseData.userAInput || 'No statement provided'}
      </p>
    </div>

    {/* The Feelings */}
    {caseData.userAFeelings && (
      <div className="space-y-1.5">
        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide flex items-center gap-1.5">
          <Heart className="w-3 h-3" />
          How they felt
        </p>
        <p className="text-sm text-neutral-600 italic pl-3 border-l-2 border-rose-200">
          {caseData.userAFeelings}
        </p>
      </div>
    )}

    {/* The Needs (if available from analysis) */}
    {analysisData?.userA_UnderlyingNeed && (
      <div className="space-y-1.5">
        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide flex items-center gap-1.5">
          <Sparkles className="w-3 h-3" />
          Underlying need
        </p>
        <p className="text-sm text-neutral-600 bg-amber-50/50 rounded-lg p-3">
          {analysisData.userA_UnderlyingNeed}
        </p>
      </div>
    )}
  </div>

  {/* Partner B Card - same structure with violet theme */}
  <div className="glass-card p-4 border-l-4 border-violet-400 space-y-4">
    {/* ... same structure ... */}
  </div>
</div>
```

### 4. Section Headers Pattern

**Consistent kicker-style headers for all sections:**

```jsx
const SectionHeader = ({ icon: Icon, title, color = 'amber' }) => (
  <div className="flex items-center gap-2">
    <Icon className={`w-4 h-4 text-${color}-500`} />
    <span className={`text-[11px] font-semibold text-${color}-700 uppercase tracking-[0.2em]`}>
      {title}
    </span>
    <div className={`flex-1 h-px bg-${color}-200/50`} />
  </div>
);
```

### 5. Subtle Page Backdrop

**Add soft gradient orbs matching app style:**

```jsx
const PageBackdrop = () => (
  <div className="fixed inset-0 pointer-events-none -z-10">
    <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-amber-100/20 blur-3xl" />
    <div className="absolute top-1/3 -left-20 h-72 w-72 rounded-full bg-rose-100/15 blur-3xl" />
    <div className="absolute bottom-20 right-10 h-48 w-48 rounded-full bg-violet-100/15 blur-3xl" />
  </div>
);
```

### 6. Analysis Section Enhancement

**Current:** Grid of small cards

**Enhanced:** Clearer hierarchy with full-width cards for important items

```jsx
{analysisData && (
  <div className="space-y-4">
    <SectionHeader icon={Scale} title="Analysis" color="amber" />

    {/* Root conflict - full width, emphasized */}
    {analysisData.rootConflictTheme && (
      <div className="glass-card p-4 bg-gradient-to-br from-amber-50/30 to-white border border-amber-200/30">
        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide mb-2">
          Core Issue
        </p>
        <p className="text-neutral-700 leading-relaxed">
          {analysisData.rootConflictTheme}
        </p>
      </div>
    )}

    {/* Intensity and Dynamic - side by side */}
    <div className="grid grid-cols-2 gap-3">
      <div className="glass-card p-3">
        <p className="text-[10px] font-bold text-neutral-400 uppercase">Intensity</p>
        <p className="text-sm font-semibold text-neutral-800 capitalize mt-1">
          {assessedIntensity || 'Not assessed'}
        </p>
      </div>
      <div className="glass-card p-3">
        <p className="text-[10px] font-bold text-neutral-400 uppercase">Dynamic</p>
        <p className="text-sm font-semibold text-neutral-800 mt-1">
          {analysisData.identifiedDynamic || '—'}
        </p>
      </div>
    </div>

    {/* Vulnerable emotions - with partner colors */}
    <div className="grid grid-cols-2 gap-3">
      <div className="glass-card p-3 border-l-2 border-rose-300">
        <p className="text-[10px] font-bold text-rose-500 uppercase">{partnerAName}'s vulnerable emotion</p>
        <p className="text-sm text-neutral-700 mt-1">{analysisData.userA_VulnerableEmotion || '—'}</p>
      </div>
      <div className="glass-card p-3 border-l-2 border-violet-300">
        <p className="text-[10px] font-bold text-violet-500 uppercase">{partnerBName}'s vulnerable emotion</p>
        <p className="text-sm text-neutral-700 mt-1">{analysisData.userB_VulnerableEmotion || '—'}</p>
      </div>
    </div>
  </div>
)}
```

### 7. Verdict Section - Content Focus

**Remove:** Judge avatar header
**Keep:** All verdict content with enhanced typography

```jsx
{currentVerdict && (
  <div className="space-y-4">
    <SectionHeader icon={Scale} title="The Verdict" color="court-gold" />

    <div className="glass-card p-5 space-y-5">
      {/* The Summary - emphasized */}
      {currentVerdict.theSummary && (
        <div>
          <p className="text-xs font-bold text-violet-500 uppercase tracking-wide mb-2">
            Summary
          </p>
          <p className="text-neutral-700 leading-relaxed">
            {currentVerdict.theSummary}
          </p>
        </div>
      )}

      {/* The Purr - Validation */}
      {currentVerdict.theRuling_ThePurr && (
        <div className="space-y-3">
          <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide">
            What you both did right
          </p>
          <div className="grid gap-2">
            <div className="bg-emerald-50/60 rounded-xl p-3 border-l-3 border-emerald-400">
              <p className="text-[10px] font-semibold text-emerald-600 mb-1">{partnerAName}</p>
              <p className="text-sm text-neutral-700">{currentVerdict.theRuling_ThePurr.userA}</p>
            </div>
            <div className="bg-emerald-50/60 rounded-xl p-3 border-l-3 border-emerald-400">
              <p className="text-[10px] font-semibold text-emerald-600 mb-1">{partnerBName}</p>
              <p className="text-sm text-neutral-700">{currentVerdict.theRuling_ThePurr.userB}</p>
            </div>
          </div>
        </div>
      )}

      {/* The Hiss - Growth areas */}
      {currentVerdict.theRuling_TheHiss?.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-amber-600 uppercase tracking-wide">
            Room to grow
          </p>
          <div className="bg-amber-50/50 rounded-xl p-4">
            <ul className="space-y-2">
              {currentVerdict.theRuling_TheHiss.map((hiss, i) => (
                <li key={i} className="text-sm text-neutral-700 flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span>{hiss}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* The Sentence - Repair exercise */}
      {currentVerdict.theSentence && (
        <div className="bg-rose-50/60 rounded-xl p-4 border border-rose-200/50 space-y-2">
          <p className="text-xs font-bold text-rose-600 uppercase tracking-wide">
            Repair Exercise
          </p>
          <p className="font-semibold text-neutral-800">{currentVerdict.theSentence.title}</p>
          <p className="text-sm text-neutral-700">{currentVerdict.theSentence.description}</p>
          {currentVerdict.theSentence.rationale && (
            <p className="text-xs text-neutral-500 italic pt-2 border-t border-rose-100">
              Why this helps: {currentVerdict.theSentence.rationale}
            </p>
          )}
        </div>
      )}

      {/* Closing statement */}
      {currentVerdict.closingStatement && (
        <div className="pt-4 border-t border-neutral-100 text-center">
          <p className="text-neutral-500 text-sm italic">
            "{currentVerdict.closingStatement}"
          </p>
        </div>
      )}
    </div>
  </div>
)}
```

---

## Color Palette Usage

| Element | Color | Purpose |
|---------|-------|---------|
| Partner A | `rose-400/500` | Pink accent for partner A identity |
| Partner B | `violet-400/500` | Purple accent for partner B identity |
| Section headers | `amber-500/700` | Warm gold for labels |
| Validation (Purr) | `emerald-500/600` | Green for positive feedback |
| Growth (Hiss) | `amber-500/600` | Amber for gentle feedback |
| Repair | `rose-500/600` | Pink for love/healing theme |
| Neutral text | `neutral-700/800` | Primary content |
| Labels | `neutral-400/500` | Secondary labels |

---

## Badge Refinements

**Severity badges with borders:**
```jsx
const SEVERITY_STYLES = {
  high_tension: 'bg-red-50 text-red-600 border-red-200',
  friction: 'bg-amber-50 text-amber-600 border-amber-200',
  disconnection: 'bg-sky-50 text-sky-600 border-sky-200',
};
```

**Horseman badges:**
```jsx
const HORSEMAN_STYLES = {
  Criticism: 'bg-pink-50 text-pink-700 border-pink-200',
  Contempt: 'bg-red-50 text-red-700 border-red-200',
  Defensiveness: 'bg-amber-50 text-amber-700 border-amber-200',
  Stonewalling: 'bg-slate-50 text-slate-700 border-slate-200',
};
```

---

## Animation Guidelines

**Keep subtle, purpose-driven animations:**

| Element | Animation | Purpose |
|---------|-----------|---------|
| Page sections | `opacity: 0→1, y: 10→0` | Smooth content reveal |
| Buttons | `whileTap: scale 0.95` | Tactile feedback |
| Collapsible | `height: 0→auto` | Smooth expand/collapse |
| Badges | None | Static, not distracting |

**Remove theatrical animations:**
- No seal stamp effects
- No overlapping card layouts
- No decorative spinning elements
- No dramatic delays (max 0.1s stagger)

---

## Content Hierarchy

```
1. HEADER
   └── Case ID (kicker)
   └── Case Title (hero)
   └── Date

2. META CARD
   └── Severity badge
   └── Horseman badge (if any)
   └── Judge model used

3. PARTNER PERSPECTIVES (most important!)
   └── Partner A
       └── What happened (facts)
       └── How they felt (feelings)
       └── Underlying need (if available)
   └── Partner B
       └── (same structure)

4. AI ANALYSIS (collapsible)
   └── Core Issue
   └── Intensity & Dynamic
   └── Vulnerable emotions

5. PRIMING INSIGHTS (collapsible)
   └── Per-partner reflections

6. JOINT MENU (collapsible)
   └── Summary
   └── Good stuff / Growth edges

7. THE VERDICT (always visible)
   └── Summary
   └── What you did right
   └── Room to grow
   └── Repair exercise
   └── Closing

8. TIMELINE (if multiple verdicts)
   └── Version selector
   └── Addendum history
```

---

## Implementation Changes

### Files to Modify

1. **`client/src/pages/CaseDetailPage.jsx`**
   - Remove Judging Journey section (lines 230-264)
   - Remove Whiskers avatars from partner cards
   - Remove Whiskers avatar from verdict header
   - Add judge model indicator
   - Restructure partner cards for Facts/Feelings/Needs
   - Add section header components
   - Add subtle page backdrop

2. **`client/src/i18n/locales/en.json`**
   - Add keys for "What happened", "How they felt", "Underlying need"
   - Add keys for judge model names

3. **`client/src/i18n/locales/zh-Hans.json`**
   - Add Chinese translations for new keys

### Database/API Consideration

The `judgeModel` field needs to be stored and returned with case data. Check if this is already available in `caseData`.

---

## Success Criteria

1. **Content First** - User can easily read and understand all case details
2. **Clear Hierarchy** - Facts, feelings, needs are clearly separated
3. **Premium Feel** - Subtle polish without being distracting
4. **Consistent Style** - Matches other pages in the app
5. **Judge Model Visible** - Users know which AI judged their case
6. **No Theatrical Elements** - Clean, professional, content-focused
