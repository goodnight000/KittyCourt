/**
 * TypeScript Type Definitions for Judge Engine v2
 *
 * These mirror the Zod schemas in `server/src/lib/schemas.js`
 * and are intended for editor IntelliSense only.
 */

// --- Input Types ---

export interface Participant {
    name: string;
    id: string;
    loveLanguage?: string;
    communicationStyle?: string;
    conflictStyle?: string;
    appreciationStyle?: string;
    petPeeves?: string[];
}

export interface Submission {
    cameraFacts: string;
    selectedPrimaryEmotion: string;
    theStoryIamTellingMyself: string;
    coreNeed: string;
}

export interface AddendumEntry {
    userId?: string;
    fromUser?: 'userA' | 'userB';
    text: string;
    submittedAt?: number;
}

export type IntensityLevel = 'high' | 'medium' | 'low';

export interface DeliberationInput {
    participants: {
        userA: Participant;
        userB: Participant;
    };
    submissions: {
        userA: Submission;
        userB: Submission;
    };
    addendumHistory?: AddendumEntry[];
    userReportedIntensity?: IntensityLevel | null;
}

// --- Analysis Types ---

export type HorsemanType = 'Criticism' | 'Contempt' | 'Defensiveness' | 'Stonewalling' | 'None';
export type DynamicType = 'Pursuer-Distancer' | 'Attack-Defend' | 'Demand-Withdraw' | 'Mutual Avoidance' | 'Minor Friction';
export type AnalysisDepth = 'full' | 'moderate' | 'lightweight';
export type SeverityLevel = 'high_tension' | 'friction' | 'disconnection';

export interface ResolutionOption {
    id: string;
    title: string;
    repairAttemptIds: string[];
    combinedDescription: string;
    rationale: string;
    estimatedDuration: string;
}

export interface AnalystRepairOutput {
    userReportedIntensity?: string | null;
    assessedIntensity: string;
    intensityMismatch: boolean;
    analysisDepth: string;
    analysis: {
        identifiedDynamic: string;
        dynamicExplanation: string;
        userA_Horsemen?: string[] | null;
        userB_Horsemen?: string[] | null;
        userA_VulnerableEmotion: string;
        userB_VulnerableEmotion: string;
        rootConflictTheme: string;
    };
    caseMetadata: {
        caseTitle: string;
        severityLevel: string;
    };
    resolutions: ResolutionOption[];
}

// --- Priming + Joint Menu Types ---

export interface IndividualPriming {
    yourFeelings: string;
    partnerPerspective: string;
    reflectionQuestions: string[];
    questionsForPartner: string[];
}

export interface JointMenu {
    theSummary: string;
    theGoodStuff: {
        userA: string;
        userB: string;
    };
    theGrowthEdges: {
        userA: string;
        userB: string;
    };
    resolutionPreview: string;
    closingWisdom: string;
}

export interface PrimingJointOutput {
    voiceUsed: 'gentle_counselor' | 'judge_whiskers';
    individualPriming: {
        userA: IndividualPriming;
        userB: IndividualPriming;
    };
    jointMenu: JointMenu;
}

// --- Hybrid Resolution Types ---

export interface HybridResolutionOutput {
    hybridResolution: {
        title: string;
        description: string;
        rationale: string;
        fromUserA: string;
        fromUserB: string;
        estimatedDuration: string;
    };
    bridgingMessage: string;
}
