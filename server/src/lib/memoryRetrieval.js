/**
 * Memory Retrieval Service (RAG Pipeline)
 * 
 * Handles the retrieval of relevant memories and profile data
 * before verdict generation to provide historical context.
 */

const { generateCaseQueryEmbedding, generateUserQueryEmbedding } = require('./embeddings');
const {
    retrieveRelevantMemories,
    retrieveRelevantMemoriesV2,
    getUserProfile,
    isSupabaseConfigured,
    checkUserHasMemories
} = require('./supabase');
const { normalizeLanguage } = require('./language');

// Configuration
const CONFIG = {
    maxMemoriesToRetrieve: 4, // Total memories to include
    maxMemoriesPerUser: 3, // Per-user cap for v2 retrieval
    maxMemoriesPerType: 2, // Per-type cap for diversity
    candidateMultiplier: 5, // Over-fetch multiplier for v2 rerank
    minSimilarityScore: 0.5, // Minimum similarity threshold
    minScore: 0.0, // Minimum composite score (v2)
};

const USE_V2 = process.env.MEMORY_ENGINE_V2_ENABLED === 'true';

const buildUserQueryInputs = (submissions, addendumHistory, userKey) => {
    const addendumForUser = Array.isArray(addendumHistory)
        ? addendumHistory.filter(entry => entry?.fromUser === userKey)
        : [];

    return {
        userFacts: submissions?.[userKey]?.cameraFacts || '',
        userFeelings: submissions?.[userKey]?.theStoryIamTellingMyself || '',
        addendumHistory: addendumForUser,
    };
};

const hasQueryInputs = (inputs) => {
    if (!inputs) return false;
    const addendumTexts = Array.isArray(inputs.addendumHistory)
        ? inputs.addendumHistory.map(entry => entry?.text).filter(Boolean)
        : [];
    return [inputs.userFacts, inputs.userFeelings, ...addendumTexts].some(Boolean);
};

/**
 * Retrieve historical context for a case
 * This is the main RAG function called BEFORE verdict generation
 * 
 * @param {object} caseData - The case data with submissions
 * @returns {Promise<object>} Historical context to inject into the prompt
 */
async function retrieveHistoricalContext(caseData) {
    console.log('[Memory Retrieval] Starting RAG pipeline...');

    // Return empty context if Supabase is not configured
    if (!isSupabaseConfigured()) {
        console.log('[Memory Retrieval] Supabase not configured, skipping RAG');
        return {
            enabled: false,
            profiles: { userA: {}, userB: {} },
            memories: [],
        };
    }

    try {
        const { participants, submissions } = caseData;
        const userAId = participants.userA.id;
        const userBId = participants.userB.id;
        const defaultLanguage = normalizeLanguage(caseData?.language) || 'en';

        // Step 1: Fetch static profiles for both users (in parallel)
        // Also check if any memories exist before generating embeddings
        console.log('[Memory Retrieval] Fetching user profiles and checking for memories...');
        const [profileA, profileB, userAMemoryCount, userBMemoryCount] = await Promise.all([
            getUserProfile(userAId),
            getUserProfile(userBId),
            checkUserHasMemories(userAId),
            checkUserHasMemories(userBId),
        ]);
        const userALanguage = normalizeLanguage(profileA?.preferredLanguage)
            || normalizeLanguage(participants?.userA?.language)
            || defaultLanguage;
        const userBLanguage = normalizeLanguage(profileB?.preferredLanguage)
            || normalizeLanguage(participants?.userB?.language)
            || defaultLanguage;

        // Skip embedding generation and RAG if no memories exist for either user
        if (userAMemoryCount === 0 && userBMemoryCount === 0) {
            console.log('[Memory Retrieval] No memories exist for either user, skipping RAG embedding generation');
            return {
                enabled: true,
                profiles: { userA: profileA, userB: profileB },
                memories: [],
            };
        }

        const retrieveMemoriesV1 = async () => {
            console.log(`[Memory Retrieval] Generating query embedding (found ${userAMemoryCount + userBMemoryCount} total memories)...`);
            const queryEmbedding = await generateCaseQueryEmbedding({
                userAFacts: submissions.userA.cameraFacts,
                userAFeelings: submissions.userA.theStoryIamTellingMyself,
                userBFacts: submissions.userB.cameraFacts,
                userBFeelings: submissions.userB.theStoryIamTellingMyself,
                addendumHistory: caseData.addendumHistory || []
            });

            console.log('[Memory Retrieval] Searching for relevant memories...');
            const retrieveForUser = async (userId, language) => {
                if (!userId) return [];
                const normalizedLanguage = normalizeLanguage(language) || 'en';
                let results = await retrieveRelevantMemories(
                    queryEmbedding,
                    [userId],
                    CONFIG.maxMemoriesPerUser,
                    normalizedLanguage
                );
                if (results.length === 0 && normalizedLanguage !== 'en') {
                    results = await retrieveRelevantMemories(
                        queryEmbedding,
                        [userId],
                        CONFIG.maxMemoriesPerUser,
                        'en'
                    );
                }
                return results;
            };

            const [memoriesA, memoriesB] = await Promise.all([
                userAMemoryCount > 0 ? retrieveForUser(userAId, userALanguage) : [],
                userBMemoryCount > 0 ? retrieveForUser(userBId, userBLanguage) : [],
            ]);

            const combined = [...memoriesA, ...memoriesB];
            const filteredMemories = combined.filter(
                m => m.similarity >= CONFIG.minSimilarityScore
            );

            filteredMemories.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));

            console.log(`[Memory Retrieval] Found ${filteredMemories.length} relevant memories`);

            return filteredMemories.slice(0, CONFIG.maxMemoriesToRetrieve).map(memory => ({
                userId: memory.user_id,
                userName: memory.user_id === userAId
                    ? participants.userA.name
                    : participants.userB.name,
                text: memory.memory_text,
                type: memory.memory_type,
                relevance: Math.round(memory.similarity * 100),
            }));
        };

        let formattedMemories = [];

        if (USE_V2) {
            console.log('[Memory Retrieval] Using v2 retrieval pipeline...');
            try {
                const addendumHistory = caseData.addendumHistory || [];
                const userAInputs = buildUserQueryInputs(submissions, addendumHistory, 'userA');
                const userBInputs = buildUserQueryInputs(submissions, addendumHistory, 'userB');

                const userAEmbedding = (userAMemoryCount > 0 && hasQueryInputs(userAInputs))
                    ? await generateUserQueryEmbedding(userAInputs)
                    : null;
                const userBEmbedding = (userBMemoryCount > 0 && hasQueryInputs(userBInputs))
                    ? await generateUserQueryEmbedding(userBInputs)
                    : null;

                console.log('[Memory Retrieval] Searching for relevant memories (v2)...');
                const retrieveForUser = async (embedding, userId, language) => {
                    const normalizedLanguage = normalizeLanguage(language) || 'en';
                    let results = await retrieveRelevantMemoriesV2(
                        embedding,
                        [userId],
                        CONFIG.maxMemoriesPerUser,
                        CONFIG.candidateMultiplier,
                        normalizedLanguage
                    );
                    if (results.length === 0 && normalizedLanguage !== 'en') {
                        results = await retrieveRelevantMemoriesV2(
                            embedding,
                            [userId],
                            CONFIG.maxMemoriesPerUser,
                            CONFIG.candidateMultiplier,
                            'en'
                        );
                    }
                    return results;
                };
                const [memoriesA, memoriesB] = await Promise.all([
                    userAEmbedding
                        ? retrieveForUser(userAEmbedding, userAId, userALanguage)
                        : [],
                    userBEmbedding
                        ? retrieveForUser(userBEmbedding, userBId, userBLanguage)
                        : [],
                ]);

                const combined = [...memoriesA, ...memoriesB];
                const filtered = combined.filter(memory => (
                    memory.similarity >= CONFIG.minSimilarityScore
                    && (memory.score || 0) >= CONFIG.minScore
                ));

                filtered.sort((a, b) => (b.score - a.score) || (b.similarity - a.similarity));

                const perTypeCounts = new Map();
                const selected = [];
                for (const memory of filtered) {
                    const type = memory.memory_type || 'unknown';
                    const currentCount = perTypeCounts.get(type) || 0;
                    if (currentCount >= CONFIG.maxMemoriesPerType) continue;
                    selected.push(memory);
                    perTypeCounts.set(type, currentCount + 1);
                    if (selected.length >= CONFIG.maxMemoriesToRetrieve) break;
                }

                console.log(`[Memory Retrieval] Found ${selected.length} relevant memories (v2)`);

                formattedMemories = selected.map(memory => ({
                    userId: memory.user_id,
                    userName: memory.user_id === userAId
                        ? participants.userA.name
                        : participants.userB.name,
                    text: memory.memory_text,
                    type: memory.memory_type,
                    relevance: Math.round(memory.similarity * 100),
                    confidenceScore: memory.confidence_score,
                    lastObservedAt: memory.last_observed_at,
                    sourceType: memory.source_type,
                    memorySubtype: memory.memory_subtype,
                }));
            } catch (error) {
                console.warn('[Memory Retrieval] v2 retrieval failed, falling back to v1:', error.message);
                formattedMemories = await retrieveMemoriesV1();
            }
        } else {
            formattedMemories = await retrieveMemoriesV1();
        }

        return {
            enabled: true,
            profiles: {
                userA: profileA,
                userB: profileB,
            },
            memories: formattedMemories,
        };
    } catch (error) {
        console.error('[Memory Retrieval] RAG pipeline failed:', error);
        return {
            enabled: false,
            error: error.message,
            profiles: { userA: {}, userB: {} },
            memories: [],
        };
    }
}

/**
 * Format historical context for injection into the Judge prompt
 * 
 * @param {object} context - The historical context object
 * @param {object} participants - The participants info
 * @returns {string} Formatted context string for the prompt
 */
function formatContextForPrompt(context, participants) {
    if (!context.enabled || (Object.keys(context.profiles.userA).length === 0
        && Object.keys(context.profiles.userB).length === 0
        && context.memories.length === 0)) {
        return ''; // No historical context available
    }

    const sections = [];

    // Helper to format a single profile
    const formatProfile = (profile, name) => {
        const lines = [];
        lines.push(`\n### ${name}'s Profile`);

        if (profile.loveLanguages && profile.loveLanguages.length > 0) {
            lines.push(`- **Love Language:** ${profile.loveLanguages.join(', ')}`);
        }
        if (profile.attachmentStyle) {
            lines.push(`- **Attachment Style:** ${profile.attachmentStyle}`);
        }
        if (profile.communicationStyle) {
            lines.push(`- **Communication Style:** ${profile.communicationStyle}`);
        }
        if (profile.conflictStyle) {
            lines.push(`- **Conflict Style:** ${profile.conflictStyle}`);
        }
        if (profile.appreciationStyle) {
            lines.push(`- **Appreciation Style:** ${profile.appreciationStyle}`);
        }
        if (profile.petPeeves && profile.petPeeves.length > 0) {
            lines.push(`- **Pet Peeves:** ${profile.petPeeves.join(', ')}`);
        }
        if (profile.bio) {
            lines.push(`- **About:** ${profile.bio}`);
        }

        return lines;
    };

    // Section 1: Static Profiles
    const profileA = context.profiles.userA;
    const profileB = context.profiles.userB;

    if (Object.keys(profileA).length > 0 || Object.keys(profileB).length > 0) {
        sections.push('## HISTORICAL PROFILE DATA');

        if (Object.keys(profileA).length > 0) {
            sections.push(...formatProfile(profileA, participants.userA.name));
        }

        if (Object.keys(profileB).length > 0) {
            sections.push(...formatProfile(profileB, participants.userB.name));
        }
    }

    // Section 2: Episodic Memories (RAG results)
    if (context.memories.length > 0) {
        sections.push('\n## RELEVANT PAST INSIGHTS');
        sections.push('*The following insights were observed in previous conflicts:*\n');

        for (const memory of context.memories) {
            const typeEmoji = {
                'trigger': '⚡',
                'core_value': '💎',
                'pattern': '🔄',
                'preference': '🎯',
            }[memory.type] || '📝';

            const metaParts = [];
            if (typeof memory.confidenceScore === 'number') {
                metaParts.push(`confidence ${Math.round(memory.confidenceScore * 100)}%`);
            }
            if (memory.lastObservedAt) {
                const observedDate = new Date(memory.lastObservedAt);
                if (!Number.isNaN(observedDate.getTime())) {
                    metaParts.push(`last observed ${observedDate.toISOString().slice(0, 10)}`);
                }
            }
            if (memory.sourceType) {
                metaParts.push(`source ${memory.sourceType}`);
            }
            if (memory.memorySubtype) {
                metaParts.push(`subtype ${memory.memorySubtype}`);
            }

            const metaSuffix = metaParts.length ? ` (${metaParts.join(', ')})` : '';
            sections.push(`${typeEmoji} **${memory.userName}** (${memory.type}): ${memory.text}${metaSuffix}`);
        }
    }

    // Add context usage instruction
    if (sections.length > 0) {
        sections.push('\n---');
        sections.push('*Use this historical context to provide more personalized insights. Reference past patterns when relevant, but focus on the current conflict.*');
    }

    return sections.join('\n');
}

/**
 * Check if historical context is meaningful
 * 
 * @param {object} context - The historical context
 * @returns {boolean} True if context has useful data
 */
function hasHistoricalContext(context) {
    if (!context.enabled) return false;

    const hasProfileA = Object.keys(context.profiles.userA || {}).length > 0;
    const hasProfileB = Object.keys(context.profiles.userB || {}).length > 0;
    const hasMemories = (context.memories || []).length > 0;

    return hasProfileA || hasProfileB || hasMemories;
}

module.exports = {
    retrieveHistoricalContext,
    formatContextForPrompt,
    hasHistoricalContext,
    CONFIG,
};
