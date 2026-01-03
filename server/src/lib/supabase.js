/**
 * Supabase Client Configuration
 * 
 * Provides connection to Supabase PostgreSQL database for:
 * - Vector similarity search (pgvector)
 * - Profile data storage (JSONB)
 * - Episodic memory management
 */

const { createClient } = require('@supabase/supabase-js');

let _supabase = null;
const LEGACY_CATEGORY_BY_TYPE = {
    trigger: 'triggers',
    core_value: 'strengths',
    pattern: 'patterns',
    preference: 'preferences',
};

/**
 * Get the Supabase client instance
 * Lazily initialized to avoid startup errors when not configured
 * 
 * @returns {import('@supabase/supabase-js').SupabaseClient} The Supabase client
 * @throws {Error} If Supabase is not configured
 */
function getSupabase() {
    if (!_supabase) {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY; // server-side service role

        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY).');
        }

        _supabase = createClient(supabaseUrl, supabaseKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });
    }
    return _supabase;
}

/**
 * Check if Supabase is configured
 * @returns {boolean}
 */
function isSupabaseConfigured() {
    return !!(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));
}

/**
 * Search for similar memories using vector similarity
 * 
 * @param {number[]} embedding - The query embedding vector
 * @param {string} userId - The user ID to search for
 * @param {number} threshold - Similarity threshold (0-1)
 * @param {number} limit - Maximum results to return
 * @returns {Promise<Array>} Similar memories
 */
async function searchSimilarMemories(embedding, userId, threshold = 0.92, limit = 10, language = 'en') {
    const supabase = getSupabase();

    const { data, error } = await supabase.rpc('search_similar_memories', {
        query_embedding: embedding,
        target_user_id: userId,
        target_language: language || 'en',
        similarity_threshold: threshold,
        max_results: limit,
    });

    if (error) {
        console.error('[Supabase] Error searching similar memories:', error);
        throw error;
    }

    return data || [];
}

/**
 * Retrieve relevant memories for RAG
 * 
 * @param {number[]} embedding - The query embedding vector
 * @param {string[]} userIds - User IDs to search for
 * @param {number} limit - Maximum results to return
 * @returns {Promise<Array>} Relevant memories
 */
async function retrieveRelevantMemories(embedding, userIds, limit = 4, language = 'en') {
    const supabase = getSupabase();

    const { data, error } = await supabase.rpc('retrieve_relevant_memories', {
        query_embedding: embedding,
        user_ids: userIds,
        target_language: language || 'en',
        max_results: limit,
    });

    if (error) {
        console.error('[Supabase] Error retrieving relevant memories:', error);
        throw error;
    }

    return data || [];
}

/**
 * Retrieve relevant memories for RAG (v2 composite scoring)
 * 
 * @param {number[]} embedding - The query embedding vector
 * @param {string[]} userIds - User IDs to search for
 * @param {number} limit - Maximum results to return
 * @param {number} candidateMultiplier - Over-fetch multiplier for reranking
 * @returns {Promise<Array>} Relevant memories with scores
 */
async function retrieveRelevantMemoriesV2(embedding, userIds, limit = 6, candidateMultiplier = 5, language = 'en') {
    const supabase = getSupabase();

    const { data, error } = await supabase.rpc('retrieve_relevant_memories_v2', {
        query_embedding: embedding,
        user_ids: userIds,
        target_language: language || 'en',
        max_results: limit,
        candidate_multiplier: candidateMultiplier,
    });

    if (error) {
        console.error('[Supabase] Error retrieving relevant memories v2:', error);
        throw error;
    }

    return data || [];
}

/**
 * Insert a new memory with embedding
 * 
 * @param {object} memory - Memory object
 * @param {string} memory.userId - User ID
 * @param {string} memory.memoryText - The insight text
 * @param {string} memory.memoryType - 'trigger', 'core_value', 'pattern', or 'preference'
 * @param {number[]} memory.embedding - The embedding vector
 * @param {string} memory.sourceCaseId - Reference to the source case
 * @param {string} memory.sourceType - Source type (case, daily_question, etc.)
 * @param {string} memory.sourceId - Reference to originating source
 * @param {number} memory.confidenceScore - Confidence score (0-1)
 * @param {string} memory.memorySubtype - Optional subtype for preferences, etc.
 * @param {string} memory.observedAt - ISO timestamp when observed
 * @param {string} memory.lastObservedAt - ISO timestamp when last observed
 * @returns {Promise<object>} The inserted memory
 */
async function insertMemory(memory) {
    const supabase = getSupabase();
    const nowIso = new Date().toISOString();
    const sourceType = memory.sourceType || (memory.sourceCaseId ? 'case' : 'unknown');
    const sourceId = memory.sourceId || memory.sourceCaseId || null;
    const observedAt = memory.observedAt || nowIso;
    const lastObservedAt = memory.lastObservedAt || nowIso;

    const legacyCategory = LEGACY_CATEGORY_BY_TYPE[memory.memoryType] || 'patterns';
    const legacySubcategory = memory.memorySubtype || memory.memoryType || null;

    const { data, error } = await supabase
        .from('user_memories')
        .insert({
            user_id: memory.userId,
            memory_text: memory.memoryText,
            memory_type: memory.memoryType,
            memory_subtype: memory.memorySubtype || null,
            embedding: memory.embedding,
            source_case_id: memory.sourceCaseId,
            source_type: sourceType,
            source_id: sourceId,
            confidence_score: memory.confidenceScore || 0.8,
            observed_at: observedAt,
            last_observed_at: lastObservedAt,
            content: memory.memoryText,
            category: legacyCategory,
            subcategory: legacySubcategory,
            language: memory.language || 'en',
        })
        .select()
        .single();

    if (error) {
        console.error('[Supabase] Error inserting memory:', error);
        throw error;
    }

    return data;
}

/**
 * Reinforce an existing memory (increment count, update timestamp)
 * 
 * @param {string} memoryId - The memory ID to reinforce
 * @returns {Promise<object>} The updated memory
 */
async function reinforceMemory(memoryId) {
    const supabase = getSupabase();

    // First, get the current count
    const { data: current, error: fetchError } = await supabase
        .from('user_memories')
        .select('reinforcement_count')
        .eq('id', memoryId)
        .single();

    if (fetchError) {
        console.error('[Supabase] Error fetching memory for reinforcement:', fetchError);
        throw fetchError;
    }

    // Then update with incremented count
    const { data, error } = await supabase
        .from('user_memories')
        .update({
            reinforcement_count: (current.reinforcement_count || 1) + 1,
            last_reinforced_at: new Date().toISOString(),
            last_observed_at: new Date().toISOString(),
        })
        .eq('id', memoryId)
        .select()
        .single();

    if (error) {
        console.error('[Supabase] Error reinforcing memory:', error);
        throw error;
    }

    return data;
}

/**
 * Get user profile data for RAG context
 * Fetches relationship-relevant profile data from the profiles table
 * 
 * @param {string} userId - User ID
 * @returns {Promise<object>} The profile data formatted for RAG
 */
async function getUserProfile(userId) {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('profiles')
        .select(`
            display_name,
            love_language,
            communication_style,
            conflict_style,
            favorite_date_activities,
            pet_peeves,
            appreciation_style,
            bio,
            preferred_language
        `)
        .eq('id', userId)
        .single();

    if (error) {
        console.error('[Supabase] Error getting user profile:', error);
        return {};
    }

    if (!data) return {};

    // Map to the format expected by memoryRetrieval.js
    const profile = {};

    if (data.love_language) {
        profile.loveLanguages = [data.love_language];
    }
    if (data.communication_style) {
        profile.communicationStyle = data.communication_style;
    }
    if (data.conflict_style) {
        profile.conflictStyle = data.conflict_style;
    }
    if (data.favorite_date_activities && data.favorite_date_activities.length > 0) {
        profile.favoriteDateActivities = data.favorite_date_activities;
    }
    if (data.pet_peeves && data.pet_peeves.length > 0) {
        profile.petPeeves = data.pet_peeves;
    }
    if (data.appreciation_style) {
        profile.appreciationStyle = data.appreciation_style;
    }
    if (data.bio) {
        profile.bio = data.bio;
    }
    if (data.preferred_language) {
        profile.preferredLanguage = data.preferred_language;
    }

    return profile;
}

/**
 * Update user profile data (merge with existing)
 * Note: This updates individual columns, not a JSONB blob
 * 
 * @param {string} userId - User ID
 * @param {object} profileUpdate - Profile data to update
 * @returns {Promise<object>} The updated profile
 */
async function updateUserProfile(userId, profileUpdate) {
    const supabase = getSupabase();

    // Map from RAG format back to database columns
    const updates = {};
    if (profileUpdate.loveLanguages) updates.love_language = profileUpdate.loveLanguages[0];
    if (profileUpdate.communicationStyle) updates.communication_style = profileUpdate.communicationStyle;
    if (profileUpdate.conflictStyle) updates.conflict_style = profileUpdate.conflictStyle;
    if (profileUpdate.petPeeves) updates.pet_peeves = profileUpdate.petPeeves;
    if (profileUpdate.appreciationStyle) updates.appreciation_style = profileUpdate.appreciationStyle;
    if (profileUpdate.bio) updates.bio = profileUpdate.bio;

    if (Object.keys(updates).length === 0) {
        return getUserProfile(userId);
    }

    const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

    if (error) {
        console.error('[Supabase] Error updating user profile:', error);
        throw error;
    }

    return getUserProfile(userId);
}

/**
 * Get all memories for a user
 * 
 * @param {string} userId - User ID
 * @param {string} memoryType - Optional filter by memory type
 * @returns {Promise<Array>} User's memories
 */
async function getUserMemories(userId, memoryType = null, language = null) {
    const supabase = getSupabase();

    let query = supabase
        .from('user_memories')
        .select('id, memory_text, memory_type, memory_subtype, confidence_score, reinforcement_count, last_observed_at, created_at, source_type, source_id')
        .eq('user_id', userId)
        .order('reinforcement_count', { ascending: false });

    if (memoryType) {
        query = query.eq('memory_type', memoryType);
    }
    if (language) {
        query = query.eq('language', language);
    }

    const { data, error } = await query;

    if (error) {
        console.error('[Supabase] Error getting user memories:', error);
        return [];
    }

    return data || [];
}

/**
 * Check if a user has any memories stored
 * Used to skip RAG embedding generation when no memories exist
 * 
 * @param {string} userId - User ID
 * @returns {Promise<number>} Count of memories
 */
async function checkUserHasMemories(userId, language = null) {
    const supabase = getSupabase();

    let query = supabase
        .from('user_memories')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_active', true);

    if (language) {
        query = query.eq('language', language);
    }

    const { count, error } = await query;
    if (error) {
        console.error('[Supabase] Error checking user memories:', error);
        return 0;
    }

    return count || 0;
}

/**
 * Check if any memories exist for a given source
 * 
 * @param {string} sourceType - Source type
 * @param {string} sourceId - Source ID
 * @returns {Promise<number>} Count of memories
 */
async function checkMemoriesBySource(sourceType, sourceId) {
    const supabase = getSupabase();

    const { count, error } = await supabase
        .from('user_memories')
        .select('*', { count: 'exact', head: true })
        .eq('source_type', sourceType)
        .eq('source_id', sourceId);

    if (error) {
        console.error('[Supabase] Error checking memories by source:', error);
        return 0;
    }

    return count || 0;
}

module.exports = {
    getSupabase,
    isSupabaseConfigured,
    searchSimilarMemories,
    retrieveRelevantMemories,
    retrieveRelevantMemoriesV2,
    insertMemory,
    reinforceMemory,
    getUserProfile,
    updateUserProfile,
    getUserMemories,
    checkUserHasMemories,
    checkMemoriesBySource,
};
