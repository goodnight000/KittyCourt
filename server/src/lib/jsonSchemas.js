/**
 * JSON Schema Definitions for Judge Engine v2.0
 * 
 * These schemas are used with the json_schema response_format
 * to ensure consistent structured output from the LLM.
 * 
 * Updated for new pipeline:
 * 1. ANALYST_REPAIR_JSON_SCHEMA - Analysis + 3 resolution options
 * 2. PRIMING_JOINT_JSON_SCHEMA - Individual priming + joint menu content
 * 3. HYBRID_RESOLUTION_JSON_SCHEMA - Combined resolution when users disagree
 */

/**
 * Analyst + Repair Selection Schema
 * Combines psychological analysis with 3 resolution recommendations
 */
const ANALYST_REPAIR_JSON_SCHEMA = {
    name: 'analyst_repair_output',
    strict: true,
    schema: {
        type: 'object',
        description: 'All narrative strings must be in the requested language. Keep enum values and IDs in English.',
        properties: {
            userReportedIntensity: {
                type: ['string', 'null'],
                description: 'User self-reported intensity: high, medium, low, or null if not provided'
            },
            assessedIntensity: {
                type: 'string',
                description: 'LLM-assessed intensity: high, medium, or low'
            },
            intensityMismatch: {
                type: 'boolean',
                description: 'True if user-reported and assessed intensity differ significantly'
            },
            analysisDepth: {
                type: 'string',
                description: 'Analysis depth: full, moderate, or lightweight'
            },
            analysis: {
                type: 'object',
                properties: {
                    identifiedDynamic: {
                        type: 'string',
                        description: 'Relationship pattern: Pursuer-Distancer, Attack-Defend, Demand-Withdraw, Mutual Avoidance, or Minor Friction'
                    },
                    dynamicExplanation: {
                        type: 'string',
                        description: 'How this dynamic is playing out'
                    },
                    userA_Horsemen: {
                        type: ['array', 'null'],
                        items: { type: 'string' },
                        description: 'Four Horsemen for User A, or null for low intensity'
                    },
                    userB_Horsemen: {
                        type: ['array', 'null'],
                        items: { type: 'string' },
                        description: 'Four Horsemen for User B, or null for low intensity'
                    },
                    userA_VulnerableEmotion: {
                        type: 'string',
                        description: 'The vulnerable feeling underneath User A anger'
                    },
                    userB_VulnerableEmotion: {
                        type: 'string',
                        description: 'The vulnerable feeling underneath User B anger'
                    },
                    rootConflictTheme: {
                        type: 'string',
                        description: 'What they are REALLY fighting about'
                    }
                },
                required: [
                    'identifiedDynamic',
                    'dynamicExplanation',
                    'userA_VulnerableEmotion',
                    'userB_VulnerableEmotion',
                    'rootConflictTheme'
                ],
                additionalProperties: false
            },
            caseMetadata: {
                type: 'object',
                properties: {
                    caseTitle: {
                        type: 'string',
                        description: '3-6 word title for the case'
                    },
                    severityLevel: {
                        type: 'string',
                        description: 'high_tension, friction, or disconnection'
                    }
                },
                required: ['caseTitle', 'severityLevel'],
                additionalProperties: false
            },
            resolutions: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            description: 'Unique resolution ID: resolution_1, resolution_2, resolution_3'
                        },
                        title: {
                            type: 'string',
                            description: 'Display title for this resolution'
                        },
                        repairAttemptIds: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Array of repair IDs from the library (e.g., physical_0, verbal_2)'
                        },
                        combinedDescription: {
                            type: 'string',
                            description: 'How to perform this resolution'
                        },
                        rationale: {
                            type: 'string',
                            description: 'Why this resolution fits this conflict'
                        },
                        estimatedDuration: {
                            type: 'string',
                            description: 'Estimated time: 5-30 minutes'
                        }
                    },
                    required: ['id', 'title', 'repairAttemptIds', 'combinedDescription', 'rationale', 'estimatedDuration'],
                    additionalProperties: false
                },
                description: 'Exactly 3 resolution options'
            }
        },
        required: ['assessedIntensity', 'intensityMismatch', 'analysisDepth', 'analysis', 'caseMetadata', 'resolutions'],
        additionalProperties: false
    }
};

/**
 * Combined Priming + Joint Menu Schema
 * Individual priming content for both users + joint menu content
 */
const PRIMING_JOINT_JSON_SCHEMA = {
    name: 'priming_joint_output',
    strict: true,
    schema: {
        type: 'object',
        description: 'All narrative strings must be in the requested language. Keep enum values and IDs in English.',
        properties: {
            voiceUsed: {
                type: 'string',
                description: 'Voice used: gentle_counselor or judge_whiskers'
            },
            individualPriming: {
                type: 'object',
                properties: {
                    userA: {
                        type: 'object',
                        properties: {
                            yourFeelings: {
                                type: 'string',
                                description: '2-3 paragraphs explaining why they feel this way'
                            },
                            partnerPerspective: {
                                type: 'string',
                                description: '2-3 paragraphs about partner perspective'
                            },
                            reflectionQuestions: {
                                type: 'array',
                                items: { type: 'string' },
                                description: '3-4 self-reflection questions'
                            },
                            questionsForPartner: {
                                type: 'array',
                                items: { type: 'string' },
                                description: '2-3 questions to ask partner'
                            }
                        },
                        required: ['yourFeelings', 'partnerPerspective', 'reflectionQuestions', 'questionsForPartner'],
                        additionalProperties: false
                    },
                    userB: {
                        type: 'object',
                        properties: {
                            yourFeelings: {
                                type: 'string',
                                description: '2-3 paragraphs explaining why they feel this way'
                            },
                            partnerPerspective: {
                                type: 'string',
                                description: '2-3 paragraphs about partner perspective'
                            },
                            reflectionQuestions: {
                                type: 'array',
                                items: { type: 'string' },
                                description: '3-4 self-reflection questions'
                            },
                            questionsForPartner: {
                                type: 'array',
                                items: { type: 'string' },
                                description: '2-3 questions to ask partner'
                            }
                        },
                        required: ['yourFeelings', 'partnerPerspective', 'reflectionQuestions', 'questionsForPartner'],
                        additionalProperties: false
                    }
                },
                required: ['userA', 'userB'],
                additionalProperties: false
            },
            jointMenu: {
                type: 'object',
                properties: {
                    theSummary: {
                        type: 'string',
                        description: '2-3 paragraphs synthesizing the real story'
                    },
                    theGoodStuff: {
                        type: 'object',
                        properties: {
                            userA: { type: 'string', description: 'What User A did well' },
                            userB: { type: 'string', description: 'What User B did well' }
                        },
                        required: ['userA', 'userB'],
                        additionalProperties: false
                    },
                    theGrowthEdges: {
                        type: 'object',
                        properties: {
                            userA: { type: 'string', description: 'Growth edge for User A' },
                            userB: { type: 'string', description: 'Growth edge for User B' }
                        },
                        required: ['userA', 'userB'],
                        additionalProperties: false
                    },
                    resolutionPreview: {
                        type: 'string',
                        description: '1-2 paragraphs previewing the 3 resolution options'
                    },
                    closingWisdom: {
                        type: 'string',
                        description: 'Brief wisdom statement'
                    }
                },
                required: ['theSummary', 'theGoodStuff', 'theGrowthEdges', 'resolutionPreview', 'closingWisdom'],
                additionalProperties: false
            }
        },
        required: ['voiceUsed', 'individualPriming', 'jointMenu'],
        additionalProperties: false
    }
};

/**
 * Hybrid Resolution Schema
 * When users pick different resolutions
 */
const HYBRID_RESOLUTION_JSON_SCHEMA = {
    name: 'hybrid_resolution_output',
    strict: true,
    schema: {
        type: 'object',
        description: 'All narrative strings must be in the requested language. Keep enum values and IDs in English.',
        properties: {
            hybridResolution: {
                type: 'object',
                properties: {
                    title: {
                        type: 'string',
                        description: 'New hybrid resolution title'
                    },
                    description: {
                        type: 'string',
                        description: 'How to perform this resolution'
                    },
                    rationale: {
                        type: 'string',
                        description: 'Why this honors both needs'
                    },
                    fromUserA: {
                        type: 'string',
                        description: 'Element from User A choice'
                    },
                    fromUserB: {
                        type: 'string',
                        description: 'Element from User B choice'
                    },
                    estimatedDuration: {
                        type: 'string',
                        description: '10-30 minutes'
                    }
                },
                required: ['title', 'description', 'rationale', 'fromUserA', 'fromUserB', 'estimatedDuration'],
                additionalProperties: false
            },
            bridgingMessage: {
                type: 'string',
                description: 'Message about finding common ground'
            }
        },
        required: ['hybridResolution', 'bridgingMessage'],
        additionalProperties: false
    }
};

module.exports = {
    // New v2.0 schemas
    ANALYST_REPAIR_JSON_SCHEMA,
    PRIMING_JOINT_JSON_SCHEMA,
    HYBRID_RESOLUTION_JSON_SCHEMA,
};
