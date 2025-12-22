/**
 * Judge Engine Tests
 * 
 * Unit tests for the Judge Engine pipeline components.
 * Tests schema validation and basic functionality.
 * 
 * Run with: npm test
 */

import { describe, it, expect } from 'vitest';
import { DeliberationInputSchema, AnalystRepairOutputSchema, HorsemanType } from './schemas.js';

// Sample valid input
const validInput = {
    participants: {
        userA: { name: 'Alex', id: 'u123' },
        userB: { name: 'Sam', id: 'u456' },
    },
    submissions: {
        userA: {
            cameraFacts: 'I came home and the dishes were in the sink.',
            selectedPrimaryEmotion: 'Overwhelmed',
            theStoryIamTellingMyself: 'That I am not a priority.',
            coreNeed: 'Support & Partnership',
        },
        userB: {
            cameraFacts: 'Alex came home and immediately commented on the dishes.',
            selectedPrimaryEmotion: 'Defensive',
            theStoryIamTellingMyself: 'That I am being attacked.',
            coreNeed: 'Appreciation & Peace',
        },
    },
};

// Mock analyst + repair response (v2.0 schema)
const validAnalystRepair = {
    userReportedIntensity: null,
    assessedIntensity: 'medium',
    intensityMismatch: false,
    analysisDepth: 'full',
    analysis: {
        identifiedDynamic: 'Pursuer-Distancer',
        dynamicExplanation: 'Alex pursues connection while Sam distances',
        userA_Horsemen: ['Criticism'],
        userB_Horsemen: ['Defensiveness', 'Stonewalling'],
        userA_VulnerableEmotion: 'Overwhelmed',
        userB_VulnerableEmotion: 'Defensive',
        rootConflictTheme: 'Autonomy vs. Connection conflicts.',
    },
    caseMetadata: {
        caseTitle: 'Dish duty clash',
        severityLevel: 'friction',
    },
    resolutions: [
        {
            id: 'resolution_1',
            title: 'Reset together',
            repairAttemptIds: ['verbal_1'],
            combinedDescription: 'Set a timer and reset the conversation.',
            rationale: 'Creates safety and clarity.',
            estimatedDuration: '10 minutes',
        },
        {
            id: 'resolution_2',
            title: 'Shared plan',
            repairAttemptIds: ['practical_0'],
            combinedDescription: 'Agree on a simple chores plan.',
            rationale: 'Reduces ambiguity and resentment.',
            estimatedDuration: '15 minutes',
        },
        {
            id: 'resolution_3',
            title: 'Soften and reconnect',
            repairAttemptIds: ['emotional_2'],
            combinedDescription: 'Start with validation and one request.',
            rationale: 'Turns conflict into collaboration.',
            estimatedDuration: '12 minutes',
        },
    ],
};

describe('Schema Validation', () => {
    describe('DeliberationInputSchema', () => {
        it('should validate correct input', () => {
            expect(() => DeliberationInputSchema.parse(validInput)).not.toThrow();
        });

        it('should reject input with missing participant name', () => {
            const invalidInput = {
                ...validInput,
                participants: {
                    ...validInput.participants,
                    userA: { name: '', id: 'u123' },
                },
            };
            expect(() => DeliberationInputSchema.parse(invalidInput)).toThrow();
        });

        it('should reject input with missing participant id', () => {
            const invalidInput = {
                ...validInput,
                participants: {
                    ...validInput.participants,
                    userB: { name: 'Sam', id: '' },
                },
            };
            expect(() => DeliberationInputSchema.parse(invalidInput)).toThrow();
        });

        it('should reject input with empty cameraFacts', () => {
            const invalidInput = {
                ...validInput,
                submissions: {
                    ...validInput.submissions,
                    userA: {
                        ...validInput.submissions.userA,
                        cameraFacts: '',
                    },
                },
            };
            expect(() => DeliberationInputSchema.parse(invalidInput)).toThrow();
        });

        // Note: selectedPrimaryEmotion now has a default value, so this test is removed
        // as missing the field is no longer an error

        it('should accept valid unicode characters in text fields', () => {
            const unicodeInput = {
                ...validInput,
                submissions: {
                    ...validInput.submissions,
                    userA: {
                        ...validInput.submissions.userA,
                        cameraFacts: 'I said "Why?!" and they replied \'Because!\' 🙄',
                        theStoryIamTellingMyself: 'Je suis très frustré 😤',
                    },
                },
            };
            expect(() => DeliberationInputSchema.parse(unicodeInput)).not.toThrow();
        });
    });

    describe('AnalystRepairOutputSchema', () => {
        it('should validate correct analyst + repair output', () => {
            expect(() => AnalystRepairOutputSchema.parse(validAnalystRepair)).not.toThrow();
        });
    });

    describe('HorsemanType', () => {
        it('should accept valid horseman types', () => {
            expect(() => HorsemanType.parse('Criticism')).not.toThrow();
            expect(() => HorsemanType.parse('Contempt')).not.toThrow();
            expect(() => HorsemanType.parse('Defensiveness')).not.toThrow();
            expect(() => HorsemanType.parse('Stonewalling')).not.toThrow();
            expect(() => HorsemanType.parse('None')).not.toThrow();
        });

        it('should reject invalid horseman types', () => {
            expect(() => HorsemanType.parse('Anger')).toThrow();
            expect(() => HorsemanType.parse('Sadness')).toThrow();
            expect(() => HorsemanType.parse('')).toThrow();
        });
    });
});

describe('Edge Cases', () => {
    it('should handle very long input text', () => {
        const longInput = {
            ...validInput,
            submissions: {
                ...validInput.submissions,
                userA: {
                    ...validInput.submissions.userA,
                    cameraFacts: 'A'.repeat(5000),
                },
            },
        };
        expect(() => DeliberationInputSchema.parse(longInput)).not.toThrow();
    });

    it('should preserve whitespace in text fields', () => {
        const whitespaceInput = {
            ...validInput,
            submissions: {
                ...validInput.submissions,
                userA: {
                    ...validInput.submissions.userA,
                    cameraFacts: '  Leading and trailing spaces  ',
                    theStoryIamTellingMyself: 'Line 1\nLine 2\nLine 3',
                },
            },
        };
        const parsed = DeliberationInputSchema.parse(whitespaceInput);
        expect(parsed.submissions.userA.cameraFacts).toBe('  Leading and trailing spaces  ');
        expect(parsed.submissions.userA.theStoryIamTellingMyself).toContain('\n');
    });

    it('should handle missing optional fields by throwing', () => {
        // All fields are required in the current schema
        const incompleteInput = {
            participants: validInput.participants,
            // Missing submissions
        };
        expect(() => DeliberationInputSchema.parse(incompleteInput)).toThrow();
    });
});
