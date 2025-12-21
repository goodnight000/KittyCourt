/**
 * Judge Engine Tests
 * 
 * Unit tests for the Judge Engine pipeline components.
 * Tests schema validation and basic functionality.
 * 
 * Run with: npm test
 */

import { describe, it, expect } from 'vitest';
import { DeliberationInputSchema, AnalysisSchema, HorsemanType } from './schemas.js';

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

// Mock analysis response (updated for v2.0 schema)
const validAnalysis = {
    analysis: {
        identifiedDynamic: 'Pursuer-Distancer',
        dynamicExplanation: 'Alex pursues connection while Sam distances',
        userA_Horsemen: ['Criticism'],
        userB_Horsemen: ['Defensiveness', 'Stonewalling'],
        userA_VulnerableEmotion: 'Overwhelmed',
        userB_VulnerableEmotion: 'Defensive',
        conflictIntensity: 'medium',
        rootConflictTheme: 'Autonomy vs. Connection conflicts.',
        userA_VulnerableTranslation: 'Alex feels overwhelmed and needs partnership.',
        userB_VulnerableTranslation: 'Sam feels attacked and needs peace.',
    },
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

    describe('AnalysisSchema', () => {
        it('should validate correct analysis output', () => {
            expect(() => AnalysisSchema.parse(validAnalysis)).not.toThrow();
        });

        it('should accept "None" as a valid horseman type', () => {
            const analysisWithNone = {
                analysis: {
                    ...validAnalysis.analysis,
                    userA_Horsemen: ['None'],
                },
            };
            expect(() => AnalysisSchema.parse(analysisWithNone)).not.toThrow();
        });

        it('should accept all four horsemen types', () => {
            const allHorsemen = {
                analysis: {
                    ...validAnalysis.analysis,
                    userA_Horsemen: ['Criticism', 'Contempt', 'Defensiveness', 'Stonewalling'],
                },
            };
            expect(() => AnalysisSchema.parse(allHorsemen)).not.toThrow();
        });

        it('should reject invalid horseman types', () => {
            const invalidHorsemen = {
                analysis: {
                    ...validAnalysis.analysis,
                    userA_Horsemen: ['Anger'], // Not a valid horseman
                },
            };
            expect(() => AnalysisSchema.parse(invalidHorsemen)).toThrow();
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
