/**
 * JSON Schema Definitions for OpenRouter API
 * 
 * These schemas are used with the json_schema response_format
 * to ensure consistent structured output from the LLM.
 * 
 * Following Moonshot API JSON mode documentation pattern.
 */

/**
 * Analysis Schema for Step 2
 * Provides structure for psychological analysis output
 */
const ANALYSIS_JSON_SCHEMA = {
    name: 'psychological_analysis',
    strict: true,
    schema: {
        type: 'object',
        properties: {
            analysis: {
                type: 'object',
                properties: {
                    identifiedDynamic: {
                        type: 'string',
                        description: 'The relationship pattern: Pursuer-Distancer, Attack-Defend, Demand-Withdraw, or Mutual Avoidance'
                    },
                    dynamicExplanation: {
                        type: 'string',
                        description: 'Brief explanation of how this dynamic is playing out'
                    },
                    userA_Horsemen: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Gottman Four Horsemen detected for User A: Criticism, Contempt, Defensiveness, Stonewalling, or None'
                    },
                    userB_Horsemen: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Gottman Four Horsemen detected for User B'
                    },
                    userA_VulnerableEmotion: {
                        type: 'string',
                        description: 'The vulnerable feeling underneath User A anger (e.g., fear of abandonment)'
                    },
                    userB_VulnerableEmotion: {
                        type: 'string',
                        description: 'The vulnerable feeling underneath User B anger'
                    },
                    conflictIntensity: {
                        type: 'string',
                        description: 'Intensity level: high, medium, or low'
                    },
                    rootConflictTheme: {
                        type: 'string',
                        description: 'What they are REALLY fighting about (the deeper need clash)'
                    },
                    userA_VulnerableTranslation: {
                        type: 'string',
                        description: 'Full translation of User A deeper truth'
                    },
                    userB_VulnerableTranslation: {
                        type: 'string',
                        description: 'Full translation of User B deeper truth'
                    },
                    recommendedRepair: {
                        type: 'string',
                        description: 'One of: The 20-Minute Reset, The 20-Second Hug, The Speaker-Listener Exercise, The Soft Startup Redo'
                    },
                    caseTitle: {
                        type: 'string',
                        description: 'A 3-6 word title summarizing the conflict topic'
                    },
                    severityLevel: {
                        type: 'string',
                        description: 'Severity: high_tension, friction, or disconnection'
                    },
                    primaryHissTag: {
                        type: ['string', 'null'],
                        description: 'The MOST significant Horseman detected, or null if none'
                    },
                    shortResolution: {
                        type: 'string',
                        description: 'A 3-5 word summary of the repair'
                    }
                },
                required: [
                    'identifiedDynamic',
                    'dynamicExplanation',
                    'userA_Horsemen',
                    'userB_Horsemen',
                    'userA_VulnerableEmotion',
                    'userB_VulnerableEmotion',
                    'conflictIntensity',
                    'rootConflictTheme',
                    'userA_VulnerableTranslation',
                    'userB_VulnerableTranslation',
                    'recommendedRepair',
                    'caseTitle',
                    'severityLevel',
                    'primaryHissTag',
                    'shortResolution'
                ],
                additionalProperties: false
            }
        },
        required: ['analysis'],
        additionalProperties: false
    }
};

/**
 * Verdict Schema for Step 3
 * Provides structure for Judge Mittens verdict output
 */
const VERDICT_JSON_SCHEMA = {
    name: 'judge_verdict',
    strict: true,
    schema: {
        type: 'object',
        properties: {
            theSummary: {
                type: 'string',
                description: 'The translation of what this fight is really about'
            },
            theRuling_ThePurr: {
                type: 'object',
                properties: {
                    userA: {
                        type: 'string',
                        description: 'Deep validation for User A emotions'
                    },
                    userB: {
                        type: 'string',
                        description: 'Deep validation for User B emotions'
                    }
                },
                required: ['userA', 'userB'],
                additionalProperties: false
            },
            theRuling_TheHiss: {
                type: 'array',
                items: { type: 'string' },
                description: 'Accountability statements with Hiss'
            },
            theSentence: {
                type: 'object',
                properties: {
                    title: {
                        type: 'string',
                        description: 'MUST be one of: The 20-Minute Reset, The 20-Second Hug, The Speaker-Listener Exercise, The Soft Startup Redo'
                    },
                    description: {
                        type: 'string',
                        description: 'Detailed description of how to perform this specific repair'
                    },
                    rationale: {
                        type: 'string',
                        description: 'WHY this repair was chosen for THIS specific conflict emotional wound'
                    }
                },
                required: ['title', 'description', 'rationale'],
                additionalProperties: false
            },
            closingStatement: {
                type: 'string',
                description: 'Wise cat closing statement'
            }
        },
        required: ['theSummary', 'theRuling_ThePurr', 'theRuling_TheHiss', 'theSentence', 'closingStatement'],
        additionalProperties: false
    }
};

module.exports = {
    ANALYSIS_JSON_SCHEMA,
    VERDICT_JSON_SCHEMA,
};
