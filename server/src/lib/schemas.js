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

const AddendumEntrySchema = z.object({
    userId: z.string().optional(),
    fromUser: z.enum(['userA', 'userB']).optional(),
    text: z.string().min(1),
    submittedAt: z.number().optional(),
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
    addendumHistory: z.array(AddendumEntrySchema).optional().default([]),
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

    // Type enums
    HorsemanType,
    DynamicType,
    IntensityType,
    SeverityLevel,
    AnalysisDepthType,
};
