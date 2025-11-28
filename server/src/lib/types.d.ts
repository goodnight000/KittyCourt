/**
 * TypeScript Type Definitions for Judge Engine
 * 
 * These types mirror the Zod schemas and can be used for better IDE support
 * even in JavaScript projects.
 */

// --- Input Types ---

export interface Participant {
    name: string;
    id: string;
}

export interface Submission {
    /** Objective, camera-like facts of what happened */
    cameraFacts: string;
    /** The primary emotion the user is experiencing */
    selectedPrimaryEmotion: string;
    /** The internal narrative/story the user is telling themselves */
    theStoryIamTellingMyself: string;
    /** The underlying need the user has */
    coreNeed: string;
}

export interface DeliberationInput {
    participants: {
        userA: Participant;
        userB: Participant;
    };
    submissions: {
        userA: Submission;
        userB: Submission;
    };
}

// --- Analysis Types ---

export type HorsemanType = 'Criticism' | 'Contempt' | 'Defensiveness' | 'Stonewalling' | 'None';

export interface Analysis {
    analysis: {
        /** Toxic patterns detected in User A's communication */
        userA_Horsemen: HorsemanType[];
        /** Toxic patterns detected in User B's communication */
        userB_Horsemen: HorsemanType[];
        /** The underlying theme of the conflict */
        rootConflictTheme: string;
        /** Translation of User A's complaint into vulnerable needs */
        userA_VulnerableTranslation: string;
        /** Translation of User B's complaint into vulnerable needs */
        userB_VulnerableTranslation: string;
    };
}

// --- Verdict Types ---

export interface RepairAttempt {
    title: string;
    description: string;
}

export interface JudgeContent {
    /** Judge Mittens' opening remarks */
    openingStatement: string;
    /** Validation of each user's emotions (The Purr) */
    validation_ThePurr: {
        userA: string;
        userB: string;
    };
    /** Call-outs of toxic behaviors (The Hiss) */
    callouts_TheHiss: string[];
    /** Summary of what the conflict is really about */
    translationSummary: string;
    /** The prescribed repair attempt (The Sentence) */
    theSentence_RepairAttempt: RepairAttempt;
    /** Judge Mittens' closing remarks */
    closingStatement: string;
}

export interface VerdictResponse {
    /** Unique identifier for this verdict */
    verdictId: string;
    /** ISO timestamp of when the verdict was generated */
    timestamp: string;
    /** Status of the deliberation */
    status: 'success' | 'error' | 'unsafe_counseling_recommended';
    /** The verdict content (only present on success) */
    judgeContent?: JudgeContent;
    /** Error message (only present on error) */
    error?: string;
    /** Categories flagged by moderation (only on unsafe status) */
    flaggedCategories?: string[];
    /** Metadata about the deliberation process */
    _meta?: {
        analysis: Analysis['analysis'];
        moderationPassed: boolean;
        processingTimeMs: number;
    };
}

// --- Repair Attempts Library Types ---

export type RepairCategory = 'physical' | 'verbal' | 'playful' | 'reflective';
export type RepairIntensity = 'low' | 'medium' | 'high';

export interface RepairAttemptEntry {
    title: string;
    description: string;
    intensity: RepairIntensity;
    category?: RepairCategory;
}

// --- Moderation Types ---

export interface ModerationResult {
    safe: boolean;
    flagged: boolean;
    categories?: string[];
    requiresCounseling?: boolean;
    error?: string;
}

// --- Health Check Types ---

export interface HealthCheckResponse {
    status: 'ready' | 'unconfigured';
    service: string;
    message: string;
    timestamp: string;
}
