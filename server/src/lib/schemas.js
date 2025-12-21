/**
 * Zod Schemas for Judge Engine v2.0 Input/Output Validation
 * 
 * Updated for the new psychological framework and pipeline:
 * - Analyst + Repair Selector output
 * - Combined Priming + Joint Menu output
 * - Hybrid Resolution output
 * 
 * Based on:
 * - Gottman Method
 * - Attachment Theory  
 * - Emotionally Focused Therapy (EFT)
 */

const { z } = require('zod');

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

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
    // New: User can optionally self-report conflict intensity
    userReportedIntensity: z.enum(['high', 'medium', 'low']).optional().nullable(),
});

// ============================================================================
// ANALYST + REPAIR OUTPUT SCHEMAS (v2.0)
// ============================================================================

const IntensityType = z.enum(['high', 'medium', 'low']);
const AnalysisDepthType = z.enum(['full', 'moderate', 'lightweight']);
const SeverityLevel = z.enum(['high_tension', 'friction', 'disconnection']);

const DynamicType = z.enum([
    'Pursuer-Distancer',
    'Attack-Defend',
    'Demand-Withdraw',
    'Mutual Avoidance',
    'Minor Friction'  // New: for low-intensity conflicts
]);

const HorsemanType = z.enum(['Criticism', 'Contempt', 'Defensiveness', 'Stonewalling', 'None']);

const ResolutionSchema = z.object({
    id: z.string(),
    title: z.string(),
    repairAttemptIds: z.array(z.string()),
    combinedDescription: z.string(),
    rationale: z.string(),
    estimatedDuration: z.string(),
});

const AnalystRepairOutputSchema = z.object({
    userReportedIntensity: z.string().nullable().optional(),
    assessedIntensity: z.string(),
    intensityMismatch: z.boolean(),
    analysisDepth: z.string(),
    analysis: z.object({
        identifiedDynamic: z.string(),
        dynamicExplanation: z.string(),
        userA_Horsemen: z.array(z.string()).nullable().optional(),
        userB_Horsemen: z.array(z.string()).nullable().optional(),
        userA_VulnerableEmotion: z.string(),
        userB_VulnerableEmotion: z.string(),
        rootConflictTheme: z.string(),
    }),
    caseMetadata: z.object({
        caseTitle: z.string(),
        severityLevel: z.string(),
    }),
    resolutions: z.array(ResolutionSchema),
});

// ============================================================================
// PRIMING + JOINT MENU OUTPUT SCHEMAS (v2.0)
// ============================================================================

const IndividualPrimingSchema = z.object({
    yourFeelings: z.string(),
    partnerPerspective: z.string(),
    reflectionQuestions: z.array(z.string()),
    questionsForPartner: z.array(z.string()),
});

const JointMenuSchema = z.object({
    theSummary: z.string(),
    theGoodStuff: z.object({
        userA: z.string(),
        userB: z.string(),
    }),
    theGrowthEdges: z.object({
        userA: z.string(),
        userB: z.string(),
    }),
    resolutionPreview: z.string(),
    closingWisdom: z.string(),
});

const PrimingJointOutputSchema = z.object({
    voiceUsed: z.enum(['gentle_counselor', 'judge_whiskers']),
    individualPriming: z.object({
        userA: IndividualPrimingSchema,
        userB: IndividualPrimingSchema,
    }),
    jointMenu: JointMenuSchema,
});

// ============================================================================
// HYBRID RESOLUTION OUTPUT SCHEMAS (v2.0)
// ============================================================================

const HybridResolutionOutputSchema = z.object({
    hybridResolution: z.object({
        title: z.string(),
        description: z.string(),
        rationale: z.string(),
        fromUserA: z.string(),
        fromUserB: z.string(),
        estimatedDuration: z.string(),
    }),
    bridgingMessage: z.string(),
});

// ============================================================================
// LEGACY SCHEMAS (for backward compatibility)
// ============================================================================

const RepairType = z.enum([
    'The 20-Minute Reset',
    'The 20-Second Hug',
    'The Speaker-Listener Exercise',
    'The Soft Startup Redo'
]);

const AnalysisSchema = z.object({
    analysis: z.object({
        identifiedDynamic: z.string(),
        dynamicExplanation: z.string().optional(),
        userA_Horsemen: z.array(HorsemanType),
        userB_Horsemen: z.array(HorsemanType),
        userA_VulnerableEmotion: z.string(),
        userB_VulnerableEmotion: z.string(),
        conflictIntensity: z.string(),
        rootConflictTheme: z.string(),
        userA_VulnerableTranslation: z.string(),
        userB_VulnerableTranslation: z.string(),
        recommendedRepair: z.string().optional(),
        caseTitle: z.string().optional(),
        severityLevel: z.string().optional(),
        primaryHissTag: z.string().nullable().optional(),
        shortResolution: z.string().optional(),
    }),
});

const RepairAttemptSchema = z.object({
    title: z.string(),
    description: z.string(),
    rationale: z.string().optional(),
});

const JudgeContentSchema = z.object({
    theSummary: z.string().optional(),
    translationSummary: z.string().optional(),
    theRuling_ThePurr: z.object({
        userA: z.string(),
        userB: z.string(),
    }).optional(),
    validation_ThePurr: z.object({
        userA: z.string(),
        userB: z.string(),
    }).optional(),
    theRuling_TheHiss: z.array(z.string()).optional(),
    callouts_TheHiss: z.array(z.string()).optional(),
    theSentence: RepairAttemptSchema.optional(),
    theSentence_RepairAttempt: RepairAttemptSchema.optional(),
    closingStatement: z.string().optional(),
    openingStatement: z.string().optional(),
}).transform((data) => {
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

const ModerationResultSchema = z.object({
    flagged: z.boolean(),
    categories: z.record(z.boolean()).optional(),
    category_scores: z.record(z.number()).optional(),
});

module.exports = {
    // Input schemas
    ParticipantSchema,
    SubmissionSchema,
    DeliberationInputSchema,

    // New v2.0 output schemas
    AnalystRepairOutputSchema,
    PrimingJointOutputSchema,
    HybridResolutionOutputSchema,
    ResolutionSchema,
    IndividualPrimingSchema,
    JointMenuSchema,

    // Legacy schemas for backward compatibility
    AnalysisSchema,
    VerdictOutputSchema,
    JudgeContentSchema,
    ModerationResultSchema,

    // Type enums
    HorsemanType,
    DynamicType,
    IntensityType,
    SeverityLevel,
    AnalysisDepthType,
};
