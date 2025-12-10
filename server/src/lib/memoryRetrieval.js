/**
 * Memory Retrieval Service (RAG Pipeline)
 * 
 * Handles the retrieval of relevant memories and profile data
 * before verdict generation to provide historical context.
 */

const { generateCaseQueryEmbedding } = require('./embeddings');
const {
    retrieveRelevantMemories,
    getUserProfile,
    isSupabaseConfigured,
    checkUserHasMemories
} = require('./supabase');

// Configuration
const CONFIG = {
    maxMemoriesToRetrieve: 4, // Top-k for RAG
    minSimilarityScore: 0.5, // Minimum relevance threshold
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

        // Step 1: Fetch static profiles for both users (in parallel)
        // Also check if any memories exist before generating embeddings
        console.log('[Memory Retrieval] Fetching user profiles and checking for memories...');
        const [profileA, profileB, userAMemoryCount, userBMemoryCount] = await Promise.all([
            getUserProfile(userAId),
            getUserProfile(userBId),
            checkUserHasMemories(userAId),
            checkUserHasMemories(userBId),
        ]);

        // Skip embedding generation and RAG if no memories exist for either user
        if (userAMemoryCount === 0 && userBMemoryCount === 0) {
            console.log('[Memory Retrieval] No memories exist for either user, skipping RAG embedding generation');
            return {
                enabled: true,
                profiles: { userA: profileA, userB: profileB },
                memories: [],
            };
        }

        // Step 2: Generate query embedding from case inputs (only if memories exist)
        console.log(`[Memory Retrieval] Generating query embedding (found ${userAMemoryCount + userBMemoryCount} total memories)...`);
        const queryEmbedding = await generateCaseQueryEmbedding({
            userAFacts: submissions.userA.cameraFacts,
            userAFeelings: submissions.userA.theStoryIamTellingMyself,
            userBFacts: submissions.userB.cameraFacts,
            userBFeelings: submissions.userB.theStoryIamTellingMyself,
        });

        // Step 3: Retrieve relevant episodic memories via vector search
        console.log('[Memory Retrieval] Searching for relevant memories...');
        const relevantMemories = await retrieveRelevantMemories(
            queryEmbedding,
            [userAId, userBId],
            CONFIG.maxMemoriesToRetrieve
        );


        // Filter by minimum similarity
        const filteredMemories = relevantMemories.filter(
            m => m.similarity >= CONFIG.minSimilarityScore
        );

        console.log(`[Memory Retrieval] Found ${filteredMemories.length} relevant memories`);

        // Step 4: Format memories with user attribution
        const formattedMemories = filteredMemories.map(memory => ({
            userId: memory.user_id,
            userName: memory.user_id === userAId
                ? participants.userA.name
                : participants.userB.name,
            text: memory.memory_text,
            type: memory.memory_type,
            relevance: Math.round(memory.similarity * 100),
        }));

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
            }[memory.type] || '📝';

            sections.push(`${typeEmoji} **${memory.userName}** (${memory.type}): ${memory.text}`);
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
