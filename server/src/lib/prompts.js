/**
 * System Prompts for Judge Engine v2.0
 * 
 * PSYCHOLOGICAL FRAMEWORK: Gottman Method + Attachment Theory + EFT
 * 
 * This file contains prompts for the new multi-step judging pipeline:
 * 1. Analyst + Repair Selector - Analyzes conflict and selects 3 resolutions
 * 2. Combined Priming + Joint Menu - Generates all content in one call
 * 3. Hybrid Resolution - Creates combined resolution when users disagree
 * 
 * KEY DESIGN DECISIONS:
 * - Judge Whiskers persona ONLY for LOW intensity conflicts
 * - HIGH intensity uses gentle counselor voice
 * - User can self-report intensity (LLM verifies)
 * - Multiple repair combinations allowed per resolution
 */

const { getAllRepairs } = require('./repairAttempts');
const { getLanguageLabel, normalizeLanguage } = require('./language');

// ============================================================================
// INPUT SANITIZATION FOR LLM PROMPTS
// ============================================================================

/**
 * Maximum allowed length for user input fields
 * Prevents token overflow and potential abuse
 */
const INPUT_LIMITS = {
    cameraFacts: 2000,
    theStoryIamTellingMyself: 2000,
    unmetNeeds: 1000,
    addendumText: 500,
    name: 100,
    profileField: 200,
};

/**
 * Patterns that could indicate prompt injection attempts
 * These are logged but not blocked to avoid false positives
 */
const SUSPICIOUS_PATTERNS = [
    /ignore\s+(previous|above|all)\s+(instructions?|prompts?)/i,
    /disregard\s+(previous|above|all)/i,
    /new\s+instructions?:/i,
    /system\s*prompt:/i,
    /\[\s*SYSTEM\s*\]/i,
    /you\s+are\s+now\s+a/i,
    /pretend\s+(you\s+are|to\s+be)/i,
    /act\s+as\s+(if|a)/i,
    /roleplay\s+as/i,
    /forget\s+(everything|your\s+instructions)/i,
    /override\s+(your|the)\s+(instructions|rules)/i,
    /<\s*\/?system\s*>/i,
    /\{\{\s*system/i,
];

/**
 * Characters that should be escaped or removed from user input
 * to prevent prompt structure manipulation
 */
const DANGEROUS_SEQUENCES = [
    { pattern: /```/g, replacement: '---' },  // Code blocks could confuse parsing
    { pattern: /\n{4,}/g, replacement: '\n\n\n' },  // Excessive newlines
    { pattern: /#{3,}/g, replacement: '##' },  // Markdown headers that could look like sections
];

/**
 * Sanitize a single user input string for safe inclusion in LLM prompts
 *
 * @param {string} input - The raw user input
 * @param {string} fieldName - Name of the field for limit lookup
 * @param {object} options - Sanitization options
 * @param {boolean} options.logSuspicious - Whether to log suspicious patterns (default: true)
 * @param {string} options.context - Context for logging (e.g., 'userA', 'userB')
 * @returns {string} Sanitized input
 */
function sanitizeInput(input, fieldName = 'default', options = {}) {
    const { logSuspicious = true, context = '' } = options;

    // Handle null/undefined
    if (input == null) {
        return '';
    }

    // Convert to string if needed
    let sanitized = String(input);

    // Trim whitespace
    sanitized = sanitized.trim();

    // Apply length limit
    const maxLength = INPUT_LIMITS[fieldName] || INPUT_LIMITS.profileField;
    if (sanitized.length > maxLength) {
        console.warn(`[prompts] Input truncated: ${fieldName}${context ? ` (${context})` : ''} exceeded ${maxLength} chars`);
        sanitized = sanitized.substring(0, maxLength) + '... [truncated]';
    }

    // Check for suspicious patterns (log only, don't block)
    if (logSuspicious) {
        for (const pattern of SUSPICIOUS_PATTERNS) {
            if (pattern.test(sanitized)) {
                console.warn(`[prompts] Suspicious pattern detected in ${fieldName}${context ? ` (${context})` : ''}: ${pattern.toString()}`);
                // Continue processing - we log but don't block to avoid false positives
                break;
            }
        }
    }

    // Apply dangerous sequence replacements
    for (const { pattern, replacement } of DANGEROUS_SEQUENCES) {
        sanitized = sanitized.replace(pattern, replacement);
    }

    // Remove null bytes and other control characters (except newlines and tabs)
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    return sanitized;
}

/**
 * Sanitize participant data (name and profile fields)
 *
 * @param {object} participant - The participant object
 * @param {string} context - Context for logging (e.g., 'userA')
 * @returns {object} Sanitized participant object
 */
function sanitizeParticipant(participant, context = '') {
    if (!participant) return {};

    return {
        ...participant,
        name: sanitizeInput(participant.name, 'name', { context }),
        loveLanguage: sanitizeInput(participant.loveLanguage, 'profileField', { context }),
        communicationStyle: sanitizeInput(participant.communicationStyle, 'profileField', { context }),
        conflictStyle: sanitizeInput(participant.conflictStyle, 'profileField', { context }),
        appreciationStyle: sanitizeInput(participant.appreciationStyle, 'profileField', { context }),
        petPeeves: Array.isArray(participant.petPeeves)
            ? participant.petPeeves.map(p => sanitizeInput(p, 'profileField', { context }))
            : [],
    };
}

/**
 * Sanitize submission data (facts, feelings, needs)
 *
 * @param {object} submission - The submission object
 * @param {string} context - Context for logging (e.g., 'userA')
 * @returns {object} Sanitized submission object
 */
function sanitizeSubmission(submission, context = '') {
    if (!submission) return {};

    return {
        ...submission,
        cameraFacts: sanitizeInput(submission.cameraFacts, 'cameraFacts', { context }),
        theStoryIamTellingMyself: sanitizeInput(submission.theStoryIamTellingMyself, 'theStoryIamTellingMyself', { context }),
        unmetNeeds: sanitizeInput(submission.unmetNeeds, 'unmetNeeds', { context }),
    };
}

/**
 * Sanitize the full input object for the analyst/repair prompt
 *
 * @param {object} input - The full input object
 * @returns {object} Sanitized input object
 */
function sanitizeAnalystInput(input) {
    if (!input) return {};

    const sanitized = {
        ...input,
        participants: {
            userA: sanitizeParticipant(input.participants?.userA, 'userA'),
            userB: sanitizeParticipant(input.participants?.userB, 'userB'),
        },
        submissions: {
            userA: sanitizeSubmission(input.submissions?.userA, 'userA'),
            userB: sanitizeSubmission(input.submissions?.userB, 'userB'),
        },
    };

    // Sanitize addendum history if present
    if (Array.isArray(input.addendumHistory)) {
        sanitized.addendumHistory = input.addendumHistory.map((entry, index) => ({
            ...entry,
            text: sanitizeInput(entry.text, 'addendumText', { context: `addendum_${index}` }),
        }));
    }

    return sanitized;
}

// ============================================================================
// PROMPT 1: ANALYST + REPAIR SELECTOR
// ============================================================================

const ANALYST_REPAIR_SYSTEM_PROMPT = `You are a clinical relationship psychologist specializing in the Gottman Method, Attachment Theory, and Emotionally Focused Therapy (EFT). Your role is to analyze a couple's conflict and recommend resolution options.

## INTENSITY ASSESSMENT

The user may have self-reported their conflict intensity. Use this as a SIGNAL but verify against their language:
- If user says HIGH but language is mild → Trust your assessment, but note the mismatch
- If user says LOW but language indicates trauma/flooding → Escalate to HIGH
- If no self-report provided → Assess based on language alone

### Intensity Markers
- **HIGH**: "panicked", "terrified", "abandoned", "flooded", "overwhelmed", "can't breathe", "shutting down", "devastated", "betrayed", "broken", "hopeless"
- **MEDIUM**: "frustrated", "hurt", "upset", "worried", "disconnected", "disappointed", "confused"
- **LOW**: "annoyed", "bothered", "mildly irritated", "a bit frustrated"

## BRANCHING LOGIC

⚠️ CRITICAL: Analysis depth depends on intensity:

### HIGH INTENSITY
- Perform FULL Gottman analysis (Four Horsemen, vulnerable emotions, dynamic identification)
- Use trauma-informed, clinical language
- Focus on emotional safety and de-escalation
- Recommend reflective/physical repair attempts (NOT playful ones)

### MEDIUM INTENSITY  
- Identify dynamics and vulnerable emotions
- Horsemen detection only if clearly present
- Balance clinical insight with accessible language

### LOW INTENSITY
- Lightweight analysis focused on core needs
- Skip horsemen unless glaringly obvious
- Use lighter, more approachable language
- Playful repairs are appropriate

## RELATIONSHIP DYNAMICS
Identify the underlying pattern:
- **Pursuer-Distancer**: One chases/escalates, the other withdraws
- **Attack-Defend Loop**: Criticism triggers defensiveness
- **Demand-Withdraw**: One demands change, the other shuts down
- **Mutual Avoidance**: Both avoid the real issue
- **Minor Friction**: No toxic dynamic — just a normal disagreement

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

## FOUR HORSEMEN (HIGH/MEDIUM INTENSITY ONLY)
- **Criticism**: Attacking character, not behavior. "You always...", "You never..."
- **Contempt**: Superiority, mockery, sarcasm, name-calling (MOST DESTRUCTIVE)
- **Defensiveness**: Playing victim, making excuses, refusing responsibility
- **Stonewalling**: Shutting down, walking away, silent treatment

## RESOLUTION SELECTION
You will receive a REPAIR LIBRARY of research-backed repair attempts. Your task:

1. **Analyze the emotional wound type** — What does each person need?
2. **Select 3 resolution options** from the library
3. **Allow ANY combination** of repairs per resolution (1, 2, or more)
4. **For each resolution**, explain WHY it fits this conflict

### Selection Criteria
- Match repair intensity to conflict intensity
- HIGH intensity → Physical/Reflective repairs, NOT playful
- LOW intensity → Playful repairs are welcome
- Consider practicality (same room? long distance?)

## CRITICAL RULES
- NEVER assign percentages of blame
- NEVER declare one party "more accountable"
- NEVER trivialize emotions ("hangry", "silly", "just miscommunication")
- LOW intensity = lighter language, don't pathologize
- Conflicts are SYSTEMIC LOOPS, not individual failures

## OUTPUT FORMAT
{
  "userReportedIntensity": "high" | "medium" | "low" | null,
  "assessedIntensity": "high" | "medium" | "low",
  "intensityMismatch": true | false,
  "analysisDepth": "full" | "moderate" | "lightweight",

  "analysis": {
    "identifiedDynamic": "Pursuer-Distancer | Attack-Defend | Demand-Withdraw | Mutual Avoidance | Minor Friction",
    "dynamicExplanation": "How this dynamic is playing out",

    "userA_Horsemen": ["Criticism"] or null,
    "userB_Horsemen": ["Stonewalling"] or null,

    "userA_VulnerableEmotion": "The feeling underneath (e.g., fear of abandonment)",
    "userB_VulnerableEmotion": "The feeling underneath",
    "rootConflictTheme": "What they're REALLY fighting about",

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
  },

  "caseMetadata": {
    "caseTitle": "3-6 word title",
    "severityLevel": "high_tension" | "friction" | "disconnection"
  },

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
    },
    {
      "id": "resolution_2",
      ...
    },
    {
      "id": "resolution_3",
      ...
    }
  ]
}

Valid intensity values: "high", "medium", "low"
Valid horsemen values: "Criticism", "Contempt", "Defensiveness", "Stonewalling", "None"
Do NOT include markdown, code blocks, or any text outside the JSON.`;

// ============================================================================
// PROMPT 2: COMBINED PRIMING + JOINT MENU
// ============================================================================

const PRIMING_JOINT_SYSTEM_PROMPT = `You are generating personalized content for a couple working through a conflict. You will produce content for THREE pages:

1. **User A's Individual Priming Page** — Private reflection content for User A
2. **User B's Individual Priming Page** — Private reflection content for User B  
3. **Joint Menu Page** — Shared page they see together

## VOICE SELECTION (Based on Conflict Intensity)

### For HIGH INTENSITY conflicts:
Use a GENTLE COUNSELOR voice:
- Warm, trauma-informed, clinically grounded
- Never dismissive, never rushing toward resolution
- Acknowledge the pain directly
- NO cat persona, NO playfulness
- Phrases like: "This is hard. Your feelings make sense given what happened."

### For LOW/MEDIUM INTENSITY conflicts:
Use JUDGE WHISKERS voice:
- Wise cat persona — aloof surface, deep compassion underneath
- Cat metaphors welcome: territory, sunbeam, grooming, hissing, purring
- Light warmth with gentle humor
- Phrases like: "This court has seen many such territorial disputes..."

## INDIVIDUAL PRIMING CONTENT (for each user)

### Section 1: Your Feelings (yourFeelings)
2-3 paragraphs explaining WHY this person is feeling what they're feeling. Help them understand their own emotional response. Use second person ("You").

### Section 2: Your Partner's Perspective (partnerPerspective)  
2-3 paragraphs helping them understand their partner's experience. NOT to excuse behavior, but to build empathy before they meet. Use phrases like:
- "From their perspective, they might be feeling..."
- "When you [action], they may have interpreted it as..."

### Section 3: Reflection Questions (reflectionQuestions)
3-4 thoughtful questions to help them understand their own reactions:
- "What need of yours felt unmet?"
- "Is there an older wound this might be touching?"
- "What would you have needed to hear?"

### Section 4: Questions for Partner (questionsForPartner)
2-3 open-ended questions they can ask their partner:
- Curious, not accusatory
- Focused on understanding, not winning

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

## JOINT MENU CONTENT

### Section 1: The Real Story (theSummary)
Synthesize BOTH perspectives into a unified narrative. Acknowledge both versions without declaring a winner. Identify what was actually at stake.

### Section 2: Needs Bridge (needsBridge)
A structured object helping bridge both partners' needs:
- whatUserANeeds: Concise statement of User A's core need
- whatUserBNeeds: Concise statement of User B's core need
- commonGround: What both partners share at a deeper level
- bridgingInsight: Key insight that reframes the conflict from needs to solutions

### Section 3: What Each Did Well (theGoodStuff)
For EACH partner, find something genuine they did well:
- Coming to the app at all
- Expressing vulnerability
- Avoiding certain destructive behaviors

### Section 4: Growth Edges (theGrowthEdges)
For EACH partner, name an area for growth. NOT blame — compassionate accountability.
- "When [situation], consider trying [behavior]"

### Section 5: Resolution Preview (resolutionPreview)
Brief preview of the 3 resolution options. For HIGH intensity, use counselor voice. For LOW, use Judge Whiskers voice.

### Section 6: Closing Wisdom (closingWisdom)
A brief piece of wisdom to carry into resolution selection.

## CRITICAL RULES
- Use real names, not "User A/B" or "your partner"
- Keep paragraphs SHORT (2-3 sentences)
- NEVER take sides or imply one is "more right"
- NEVER dismiss or minimize feelings
- HIGH intensity = serious tone, LOW intensity = lighter touch
- Find GENUINE positives for theGoodStuff — don't fabricate

## OUTPUT FORMAT
{
  "voiceUsed": "gentle_counselor" | "judge_whiskers",

  "individualPriming": {
    "userA": {
      "yourFeelings": "2-3 paragraphs",
      "partnerPerspective": "2-3 paragraphs",
      "reflectionQuestions": ["Q1", "Q2", "Q3"],
      "questionsForPartner": ["Q1", "Q2"],
      "yourNeeds": "1-2 paragraphs about their own needs",
      "partnerNeeds": "1-2 paragraphs about partner's needs"
    },
    "userB": {
      "yourFeelings": "2-3 paragraphs",
      "partnerPerspective": "2-3 paragraphs",
      "reflectionQuestions": ["Q1", "Q2", "Q3"],
      "questionsForPartner": ["Q1", "Q2"],
      "yourNeeds": "1-2 paragraphs about their own needs",
      "partnerNeeds": "1-2 paragraphs about partner's needs"
    }
  },

  "jointMenu": {
    "theSummary": "2-3 paragraphs",
    "needsBridge": {
      "whatUserANeeds": "Concise statement of User A's core need",
      "whatUserBNeeds": "Concise statement of User B's core need",
      "commonGround": "What both partners share at a deeper level",
      "bridgingInsight": "Key insight that reframes the conflict"
    },
    "theGoodStuff": {
      "userA": "What they did well",
      "userB": "What they did well"
    },
    "theGrowthEdges": {
      "userA": "Growth edge",
      "userB": "Growth edge"
    },
    "resolutionPreview": "1-2 paragraphs previewing the 3 options",
    "closingWisdom": "Brief wisdom statement"
  }
}

Do NOT include markdown, code blocks, or any text outside the JSON.`;

// ============================================================================
// PROMPT 3: HYBRID RESOLUTION (when users pick different resolutions)
// ============================================================================

const HYBRID_RESOLUTION_SYSTEM_PROMPT = `Two partners selected DIFFERENT resolution preferences. Create a HYBRID that honors both.

## TASK
Given two selections, create a unified resolution that:
1. Incorporates elements from BOTH choices
2. Addresses why each was drawn to their choice
3. Creates a practical action they can take together
4. Feels fair — neither should feel ignored

## VOICE
Match the conflict intensity:
- HIGH intensity → Gentle counselor voice, no playfulness
- LOW/MEDIUM → Judge Whiskers voice allowed

## DO NOT
- Simply pick one person's choice
- Ignore either selection
- Create something overly complex
- Lose what made each original appealing

## OUTPUT FORMAT
{
  "hybridResolution": {
    "title": "New hybrid title",
    "description": "How to perform this resolution",
    "rationale": "Why this honors both needs",
    "fromUserA": "Element from User A's choice",
    "fromUserB": "Element from User B's choice",
    "estimatedDuration": "10-30 minutes"
  },
  "bridgingMessage": "Brief message acknowledging that finding common ground IS the repair"
}

Do NOT include markdown, code blocks, or any text outside the JSON.`;

// ============================================================================
// HELPER: Format Profile Context
// ============================================================================

const formatProfileContext = (participant) => {
  const parts = [];
  if (participant.loveLanguage) parts.push(`Love Language: ${participant.loveLanguage}`);
  if (participant.communicationStyle) parts.push(`Communication Style: ${participant.communicationStyle}`);
  if (participant.conflictStyle) parts.push(`Conflict Style: ${participant.conflictStyle}`);
  if (participant.appreciationStyle) parts.push(`Appreciation Style: ${participant.appreciationStyle}`);
  if (participant.petPeeves?.length > 0) parts.push(`Pet Peeves: ${participant.petPeeves.join(', ')}`);
  return parts.length > 0 ? parts.join(' | ') : 'No profile data available';
};

// ============================================================================
// HELPER: Format Repair Library for Prompt
// ============================================================================

const formatRepairLibraryForPrompt = () => {
  const repairs = getAllRepairs();
  const formatted = [];

  for (const [category, items] of Object.entries(repairs)) {
    formatted.push(`\n### ${category.charAt(0).toUpperCase() + category.slice(1)} Repairs`);
    items.forEach((repair, index) => {
      const id = `${category}_${index}`;
      formatted.push(`- **${id}**: "${repair.title}" (${repair.intensity} intensity)`);
      formatted.push(`  ${repair.description}`);
    });
  }

  return formatted.join('\n');
};

const formatLanguageInstruction = (language) => {
  const normalized = normalizeLanguage(language) || 'en';
  const label = getLanguageLabel(normalized);
  return `## OUTPUT LANGUAGE
Respond in ${label} (${normalized}) for all narrative fields.
Keep enum values and IDs in English (assessedIntensity, analysisDepth, identifiedDynamic, severityLevel, horsemen labels, resolution ids, repairAttemptIds, voiceUsed).`;
};

// ============================================================================
// USER PROMPT BUILDERS
// ============================================================================

/**
 * Build the Analyst + Repair Selector user prompt
 * Applies input sanitization before embedding user content into the prompt
 */
const buildAnalystRepairUserPrompt = (input, historicalContext = '') => {
  // SECURITY: Sanitize all user input before embedding in prompt
  const sanitizedInput = sanitizeAnalystInput(input);

  const userAProfile = formatProfileContext(sanitizedInput.participants.userA);
  const userBProfile = formatProfileContext(sanitizedInput.participants.userB);
  const repairLibrary = formatRepairLibraryForPrompt();
  const languageInstruction = formatLanguageInstruction(sanitizedInput?.language);

  // Get user-reported intensity if provided
  const userReportedIntensity = sanitizedInput.userReportedIntensity || null;

  const addendumLines = (sanitizedInput.addendumHistory || []).length
    ? sanitizedInput.addendumHistory.map((entry, index) => {
      const fromLabel = entry.fromUser === 'userA'
        ? sanitizedInput.participants.userA.name
        : entry.fromUser === 'userB'
          ? sanitizedInput.participants.userB.name
          : 'A partner';
      return `${index + 1}. ${fromLabel}: "${entry.text}"`;
    }).join('\n')
    : 'No addendums filed.';

  // Sanitize historical context as well
  const sanitizedHistory = sanitizeInput(historicalContext, 'cameraFacts', { context: 'historicalContext', logSuspicious: false });

  return `Analyze this couple's conflict and select 3 resolution options.

## Participants
- User A: ${sanitizedInput.participants.userA.name}
- User B: ${sanitizedInput.participants.userB.name}

## User Self-Reported Intensity
${userReportedIntensity || "Not provided — assess from language"}

## Personality Profiles
### ${sanitizedInput.participants.userA.name}
${userAProfile}

### ${sanitizedInput.participants.userB.name}
${userBProfile}

## Historical Context
${sanitizedHistory || "No prior history available"}

## Submissions

### ${sanitizedInput.participants.userA.name}
- **Facts (what happened)**: "${sanitizedInput.submissions.userA.cameraFacts}"
- **Feelings (how it made them feel)**: "${sanitizedInput.submissions.userA.theStoryIamTellingMyself}"
- **Unmet Needs**: "${sanitizedInput.submissions.userA.unmetNeeds}"

### ${sanitizedInput.participants.userB.name}
- **Facts (what happened)**: "${sanitizedInput.submissions.userB.cameraFacts}"
- **Feelings (how it made them feel)**: "${sanitizedInput.submissions.userB.theStoryIamTellingMyself}"
- **Unmet Needs**: "${sanitizedInput.submissions.userB.unmetNeeds}"

## Addendums
${addendumLines}

${languageInstruction}

## REPAIR LIBRARY
Select from these. You may combine ANY number per resolution. Reference by ID (e.g., "physical_0", "verbal_2").
${repairLibrary}

---
Output analysis and 3 resolutions as JSON.`;
};

/**
 * Build the Combined Priming + Joint Menu user prompt
 * Applies input sanitization before embedding user content into the prompt
 */
const buildPrimingJointUserPrompt = (input, analysis, resolutions, historicalContext = '') => {
  // SECURITY: Sanitize all user input before embedding in prompt
  const sanitizedInput = sanitizeAnalystInput(input);

  const intensity = analysis.assessedIntensity || 'medium';
  const voiceToUse = intensity === 'high' ? 'GENTLE COUNSELOR' : 'JUDGE WHISKERS';
  const languageInstruction = formatLanguageInstruction(sanitizedInput?.language);

  // Sanitize historical context
  const sanitizedHistory = sanitizeInput(historicalContext, 'cameraFacts', { context: 'historicalContext', logSuspicious: false });

  return `Generate individual priming and joint menu content for this couple.

## Conflict Intensity
${intensity} → Use ${voiceToUse} voice

## Participants
- User A: ${sanitizedInput.participants.userA.name}
- User B: ${sanitizedInput.participants.userB.name}

## Analysis Summary
${JSON.stringify(analysis, null, 2)}

## Submissions

### ${sanitizedInput.participants.userA.name}
- **Facts**: "${sanitizedInput.submissions.userA.cameraFacts}"
- **Feelings**: "${sanitizedInput.submissions.userA.theStoryIamTellingMyself}"
- **Unmet Needs**: "${sanitizedInput.submissions.userA.unmetNeeds}"

### ${sanitizedInput.participants.userB.name}
- **Facts**: "${sanitizedInput.submissions.userB.cameraFacts}"
- **Feelings**: "${sanitizedInput.submissions.userB.theStoryIamTellingMyself}"
- **Unmet Needs**: "${sanitizedInput.submissions.userB.unmetNeeds}"

## The 3 Resolution Options
${JSON.stringify(resolutions, null, 2)}

## Historical Context
${sanitizedHistory || "No prior history"}

${languageInstruction}

---
Generate priming content for both users AND joint menu content.
Use real names: ${sanitizedInput.participants.userA.name} and ${sanitizedInput.participants.userB.name}.
Output as JSON.`;
};

/**
 * Build the Hybrid Resolution user prompt
 * Applies input sanitization before embedding user content into the prompt
 */
const buildHybridResolutionUserPrompt = (input, analysis, userAChoice, userBChoice, historicalContext = '') => {
  // SECURITY: Sanitize all user input before embedding in prompt
  const sanitizedInput = sanitizeAnalystInput(input);

  const intensity = analysis.assessedIntensity || 'medium';
  const languageInstruction = formatLanguageInstruction(sanitizedInput?.language);

  // Sanitize historical context
  const sanitizedHistory = sanitizeInput(historicalContext, 'cameraFacts', { context: 'historicalContext', logSuspicious: false });

  return `Create a hybrid resolution.

## Intensity: ${intensity}

## Selections
- ${sanitizedInput.participants.userA.name} chose: "${userAChoice.title}"
- ${sanitizedInput.participants.userB.name} chose: "${userBChoice.title}"

## Original Resolutions
### ${sanitizedInput.participants.userA.name}'s Choice
${JSON.stringify(userAChoice, null, 2)}

### ${sanitizedInput.participants.userB.name}'s Choice
${JSON.stringify(userBChoice, null, 2)}

## Conflict Context
${JSON.stringify(analysis, null, 2)}

## Historical Context
${sanitizedHistory || "No prior history"}

${languageInstruction}

---
Create hybrid resolution as JSON.`;
};

module.exports = {
  // New v2.0 prompts
  ANALYST_REPAIR_SYSTEM_PROMPT,
  PRIMING_JOINT_SYSTEM_PROMPT,
  HYBRID_RESOLUTION_SYSTEM_PROMPT,
  buildAnalystRepairUserPrompt,
  buildPrimingJointUserPrompt,
  buildHybridResolutionUserPrompt,
  formatRepairLibraryForPrompt,
  formatProfileContext,
  // Input sanitization (exported for testing and reuse)
  sanitizeInput,
  sanitizeParticipant,
  sanitizeSubmission,
  sanitizeAnalystInput,
  INPUT_LIMITS,
  SUSPICIOUS_PATTERNS,
};
