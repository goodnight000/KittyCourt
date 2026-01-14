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

const { z } = require('zod/v3');

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
    language: z.string().optional(),
});

const SubmissionSchema = z.object({
    cameraFacts: z.string().min(1, 'Camera facts are required'),
    selectedPrimaryEmotion: z.string().optional().default('not specified'),
    theStoryIamTellingMyself: z.string().min(1, 'Story is required'),
    unmetNeeds: z.string().min(1, 'Unmet needs are required'),
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
    language: z.string().optional(),
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

const NeedsAddressedSchema = z.object({
    userA: z.array(z.string()),
    userB: z.array(z.string()),
});

const NeedsAnalysisSchema = z.object({
    userA_PrimaryNeed: z.string(),
    userA_SecondaryNeeds: z.array(z.string()).optional().default([]),
    userA_StatedNeedMapping: z.string().optional().default(''),
    userB_PrimaryNeed: z.string(),
    userB_SecondaryNeeds: z.array(z.string()).optional().default([]),
    userB_StatedNeedMapping: z.string().optional().default(''),
    needCollision: z.string(),
    bridgingPath: z.string(),
});

const ResolutionSchema = z.object({
    id: z.string(),
    title: z.string(),
    repairAttemptIds: z.array(z.string()),
    combinedDescription: z.string(),
    rationale: z.string(),
    needsAddressed: NeedsAddressedSchema,
    howItMeetsNeeds: z.string(),
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
        needsAnalysis: NeedsAnalysisSchema,
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

/**
 * Individual priming content for each partner
 * @property {string} yourFeelings - Validation of their emotional experience
 * @property {string} partnerPerspective - Help understanding partner's viewpoint
 * @property {string[]} reflectionQuestions - Questions for self-reflection
 * @property {string[]} questionsForPartner - Questions to ask their partner
 * @property {string} yourNeeds - NVC-based explanation of their own needs
 * @property {string} partnerNeeds - NVC-based explanation of partner's needs
 */
const IndividualPrimingSchema = z.object({
    yourFeelings: z.string(),
    partnerPerspective: z.string(),
    reflectionQuestions: z.array(z.string()),
    questionsForPartner: z.array(z.string()),
    yourNeeds: z.string(),
    partnerNeeds: z.string(),
});

/**
 * Needs bridge in joint menu - helps partners find common ground
 * @property {string} whatUserANeeds - Concise statement of User A's core need
 * @property {string} whatUserBNeeds - Concise statement of User B's core need
 * @property {string} commonGround - What both partners share at a deeper level
 * @property {string} bridgingInsight - Key insight that reframes conflict to solutions
 */
const NeedsBridgeSchema = z.object({
    whatUserANeeds: z.string(),
    whatUserBNeeds: z.string(),
    commonGround: z.string(),
    bridgingInsight: z.string(),
});

const JointMenuSchema = z.object({
    theSummary: z.string(),
    needsBridge: NeedsBridgeSchema,
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
    NeedsAnalysisSchema,
    NeedsAddressedSchema,
    NeedsBridgeSchema,

    // Type enums
    HorsemanType,
    DynamicType,
    IntensityType,
    SeverityLevel,
    AnalysisDepthType,
};
