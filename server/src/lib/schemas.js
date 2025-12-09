/**
 * Zod Schemas for Judge Engine Input/Output Validation
 * 
 * Updated for the new psychological framework based on:
 * - Gottman Method
 * - Attachment Theory  
 * - Emotionally Focused Therapy (EFT)
 */

const { z } = require('zod');

// --- INPUT SCHEMAS ---

const ParticipantSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    id: z.string().min(1, 'ID is required'),
    // Optional profile data for personalized verdicts
    loveLanguage: z.string().optional(),
    communicationStyle: z.string().optional(),
    conflictStyle: z.string().optional(),
    appreciationStyle: z.string().optional(),
    petPeeves: z.array(z.string()).optional().default([]),
});

const SubmissionSchema = z.object({
    cameraFacts: z.string().min(1, 'Camera facts are required'),
    selectedPrimaryEmotion: z.string().optional().default('not specified'),
    theStoryIamTellingMyself: z.string().min(1, 'Story is required'),
    coreNeed: z.string().optional().default('understanding'),
});

const DeliberationInputSchema = z.object({
    participants: z.object({
        userA: ParticipantSchema,
        userB: ParticipantSchema,
    }),
    submissions: z.object({
        userA: SubmissionSchema,
        userB: SubmissionSchema,
    }),
});

// --- ANALYSIS SCHEMAS (Step 2 Output) ---

const HorsemanType = z.enum(['Criticism', 'Contempt', 'Defensiveness', 'Stonewalling', 'None']);

const DynamicType = z.enum([
    'Pursuer-Distancer',
    'Attack-Defend',
    'Demand-Withdraw',
    'Mutual Avoidance'
]);

const IntensityType = z.enum(['high', 'medium', 'low']);

const RepairType = z.enum([
    'The 20-Minute Reset',
    'The 20-Second Hug',
    'The Speaker-Listener Exercise',
    'The Soft Startup Redo'
]);

const SeverityLevel = z.enum(['high_tension', 'friction', 'disconnection']);

const AnalysisSchema = z.object({
    analysis: z.object({
        identifiedDynamic: z.string(), // More flexible to allow LLM variations
        dynamicExplanation: z.string().optional(),
        userA_Horsemen: z.array(HorsemanType),
        userB_Horsemen: z.array(HorsemanType),
        userA_VulnerableEmotion: z.string(),
        userB_VulnerableEmotion: z.string(),
        conflictIntensity: z.string(), // high, medium, low
        rootConflictTheme: z.string(),
        userA_VulnerableTranslation: z.string(),
        userB_VulnerableTranslation: z.string(),
        recommendedRepair: z.string().optional(), // The prescribed repair from analysis
        // Smart Summary Metadata for History View
        caseTitle: z.string().optional(), // 3-6 word title for the case
        severityLevel: z.string().optional(), // high_tension, friction, disconnection
        primaryHissTag: z.string().nullable().optional(), // Main Horseman detected
        shortResolution: z.string().optional(), // 3-5 word summary of repair
    }),
});

// --- VERDICT SCHEMAS (Step 3 Output) - NEW STRUCTURE ---

const RepairAttemptSchema = z.object({
    title: z.string(),
    description: z.string(),
    rationale: z.string().optional(), // Why this repair addresses the wound
});

// Accept multiple key variations and normalize them
const JudgeContentSchema = z.object({
    // The Translation - reframes the fight to the real dynamic
    // Accept: theSummary, translationSummary
    theSummary: z.string().optional(),
    translationSummary: z.string().optional(),

    // Validation - validates each person's emotions deeply  
    // Accept: theRuling_ThePurr, validation_ThePurr
    theRuling_ThePurr: z.object({
        userA: z.string(),
        userB: z.string(),
    }).optional(),
    validation_ThePurr: z.object({
        userA: z.string(),
        userB: z.string(),
    }).optional(),

    // Accountability - calls out behaviors (NOT character)
    // Accept: theRuling_TheHiss, callouts_TheHiss
    theRuling_TheHiss: z.array(z.string()).optional(),
    callouts_TheHiss: z.array(z.string()).optional(),

    // Targeted repair matched to the wound type
    // Accept: theSentence, theSentence_RepairAttempt
    theSentence: RepairAttemptSchema.optional(),
    theSentence_RepairAttempt: RepairAttemptSchema.optional(),

    // Wise closing (also accept openingStatement for backwards compat)
    closingStatement: z.string().optional(),
    openingStatement: z.string().optional(),
}).transform((data) => {
    // Normalize all field names to the canonical version
    return {
        theSummary: data.theSummary || data.translationSummary || '',
        theRuling_ThePurr: data.theRuling_ThePurr || data.validation_ThePurr || { userA: '', userB: '' },
        theRuling_TheHiss: data.theRuling_TheHiss || data.callouts_TheHiss || [],
        theSentence: data.theSentence || data.theSentence_RepairAttempt || { title: '', description: '' },
        closingStatement: data.closingStatement || data.openingStatement || '',
    };
});

const VerdictOutputSchema = z.object({
    verdictId: z.string(),
    timestamp: z.string(),
    status: z.enum(['success', 'error', 'unsafe_counseling_recommended']),
    judgeContent: JudgeContentSchema.optional(),
    error: z.string().optional(),
});

// --- MODERATION SCHEMA ---

const ModerationResultSchema = z.object({
    flagged: z.boolean(),
    categories: z.record(z.boolean()).optional(),
    category_scores: z.record(z.number()).optional(),
});

module.exports = {
    ParticipantSchema,
    SubmissionSchema,
    DeliberationInputSchema,
    AnalysisSchema,
    VerdictOutputSchema,
    JudgeContentSchema,
    ModerationResultSchema,
    HorsemanType,
    DynamicType,
    IntensityType,
    SeverityLevel,
};
