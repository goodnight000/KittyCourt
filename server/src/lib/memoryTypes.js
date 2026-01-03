/**
 * Type Definitions for the Hybrid Memory Matrix
 * 
 * These TypeScript-style JSDoc types provide IDE support
 * and documentation for the memory system.
 */

/**
 * @typedef {'trigger' | 'core_value' | 'pattern' | 'preference'} MemoryType
 * Categorization of extracted insights:
 * - trigger: Emotional triggers that activate strong responses
 * - core_value: Deeply held beliefs that drive behavior
 * - pattern: Recurring behavioral tendencies in conflict
 * - preference: Stable preferences surfaced in daily answers
 */

/**
 * @typedef {Object} UserProfile
 * Static profile data stored in JSONB
 * @property {string} [attachmentStyle] - 'secure' | 'anxious' | 'avoidant' | 'disorganized'
 * @property {string[]} [loveLanguages] - Primary love languages
 * @property {string} [conflictStyle] - 'collaborative' | 'competitive' | 'compromising' | 'accommodating' | 'avoidant'
 * @property {string} [stressResponse] - 'fight' | 'flight' | 'freeze' | 'fawn'
 * @property {string[]} [coreNeeds] - Fundamental relationship needs
 * @property {Object} [customFields] - Additional user-defined fields
 */

/**
 * @typedef {Object} ExtractedInsight
 * An insight extracted by the Stenographer agent
 * @property {string} text - The insight description (10-25 words)
 * @property {MemoryType} type - Category of the insight
 * @property {number} confidence - Confidence score (0.5-1.0)
 * @property {string} [subtype] - Optional subtype for preference detail
 */

/**
 * @typedef {Object} ExtractionResult
 * Result from the Stenographer extraction LLM
 * @property {Object} userA
 * @property {ExtractedInsight[]} userA.insights - Insights for User A
 * @property {Object} userB
 * @property {ExtractedInsight[]} userB.insights - Insights for User B
 */

/**
 * @typedef {Object} StoredMemory
 * A memory stored in the user_memories table
 * @property {string} id - UUID primary key
 * @property {string} user_id - Foreign key to User
 * @property {string} memory_text - The insight text
 * @property {MemoryType} memory_type - Category
 * @property {number[]} embedding - 1536-dimension vector
 * @property {string} [source_case_id] - Reference to originating case
 * @property {number} confidence_score - Confidence (0-1)
 * @property {number} reinforcement_count - Times this pattern was observed
 * @property {string} last_reinforced_at - ISO timestamp
 * @property {string} [memory_subtype] - Optional subtype for preferences
 * @property {string} [observed_at] - ISO timestamp for first observed
 * @property {string} [last_observed_at] - ISO timestamp for last observed
 * @property {string} [source_type] - Source type (case, daily_question, etc.)
 * @property {string} [source_id] - Reference to source entity
 * @property {string} [language] - Language tag (e.g., en, zh-Hans)
 * @property {string} created_at - ISO timestamp
 */

/**
 * @typedef {Object} RetrievedMemory
 * A memory retrieved via RAG search
 * @property {string} id - Memory UUID
 * @property {string} user_id - User who this memory belongs to
 * @property {string} memory_text - The insight text
 * @property {MemoryType} memory_type - Category
 * @property {number} similarity - Cosine similarity score (0-1)
 * @property {number} [score] - Composite score for ranking
 * @property {string} [memory_subtype] - Optional subtype
 * @property {number} [confidence_score] - Confidence (0-1)
 * @property {string} [last_observed_at] - ISO timestamp
 * @property {string} [source_type] - Source type
 * @property {string} [language] - Language tag
 */

/**
 * @typedef {Object} FormattedMemory
 * A memory formatted for prompt injection
 * @property {string} userId - User ID
 * @property {string} userName - User's display name
 * @property {string} text - The insight text
 * @property {MemoryType} type - Category
 * @property {number} relevance - Relevance percentage (0-100)
 * @property {number} [confidenceScore] - Confidence (0-1)
 * @property {string} [lastObservedAt] - ISO timestamp
 * @property {string} [sourceType] - Source type
 */

/**
 * @typedef {Object} HistoricalContext
 * Complete historical context for a case
 * @property {boolean} enabled - Whether the memory system is active
 * @property {Object} profiles - Static profile data
 * @property {UserProfile} profiles.userA - User A's profile
 * @property {UserProfile} profiles.userB - User B's profile
 * @property {FormattedMemory[]} memories - Relevant episodic memories
 * @property {string} [error] - Error message if retrieval failed
 */

/**
 * @typedef {Object} ProcessingStats
 * Statistics from insight processing
 * @property {number} stored - New memories inserted
 * @property {number} reinforced - Existing memories reinforced
 * @property {number} discarded - Insights that failed to process
 */

/**
 * @typedef {Object} ExtractionPipelineResult
 * Result from the full extraction pipeline
 * @property {boolean} success - Whether extraction succeeded
 * @property {string} [error] - Error message if failed
 * @property {ProcessingStats} userA - Stats for User A
 * @property {ProcessingStats} userB - Stats for User B
 * @property {number} [totalStored] - Total new memories
 * @property {number} [totalReinforced] - Total reinforced memories
 */

/**
 * @typedef {Object} VerdictMeta
 * Extended metadata in verdict response
 * @property {Object} analysis - Psychological analysis
 * @property {boolean} moderationPassed - Passed safety check
 * @property {number} processingTimeMs - Total processing time
 * @property {string} model - LLM model used
 * @property {boolean} hasHistoricalContext - Whether RAG context was used
 * @property {number} memoriesUsed - Number of memories in context
 */

// Export for JSDoc references
module.exports = {};
