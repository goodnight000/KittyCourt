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
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Use service key for server-side operations
        
        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.');
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
    return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
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
async function searchSimilarMemories(embedding, userId, threshold = 0.92, limit = 10) {
    const supabase = getSupabase();
    
    const { data, error } = await supabase.rpc('search_similar_memories', {
        query_embedding: embedding,
        target_user_id: userId,
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
async function retrieveRelevantMemories(embedding, userIds, limit = 4) {
    const supabase = getSupabase();
    
    const { data, error } = await supabase.rpc('retrieve_relevant_memories', {
        query_embedding: embedding,
        user_ids: userIds,
        max_results: limit,
    });
    
    if (error) {
        console.error('[Supabase] Error retrieving relevant memories:', error);
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
 * @param {string} memory.memoryType - 'trigger', 'core_value', or 'pattern'
 * @param {number[]} memory.embedding - The embedding vector
 * @param {string} memory.sourceCaseId - Reference to the source case
 * @param {number} memory.confidenceScore - Confidence score (0-1)
 * @returns {Promise<object>} The inserted memory
 */
async function insertMemory(memory) {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
        .from('user_memories')
        .insert({
            user_id: memory.userId,
            memory_text: memory.memoryText,
            memory_type: memory.memoryType,
            embedding: memory.embedding,
            source_case_id: memory.sourceCaseId,
            confidence_score: memory.confidenceScore || 0.8,
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
 * Get user profile data
 * 
 * @param {string} userId - User ID
 * @returns {Promise<object>} The profile data
 */
async function getUserProfile(userId) {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
        .from('User')
        .select('profile_data')
        .eq('id', userId)
        .single();
    
    if (error) {
        console.error('[Supabase] Error getting user profile:', error);
        return {};
    }
    
    return data?.profile_data || {};
}

/**
 * Update user profile data (merge with existing)
 * 
 * @param {string} userId - User ID
 * @param {object} profileUpdate - Profile data to merge
 * @returns {Promise<object>} The updated profile
 */
async function updateUserProfile(userId, profileUpdate) {
    const supabase = getSupabase();
    
    // First get existing profile
    const existing = await getUserProfile(userId);
    
    // Merge with new data
    const merged = { ...existing, ...profileUpdate };
    
    const { data, error } = await supabase
        .from('User')
        .update({ profile_data: merged })
        .eq('id', userId)
        .select('profile_data')
        .single();
    
    if (error) {
        console.error('[Supabase] Error updating user profile:', error);
        throw error;
    }
    
    return data?.profile_data || merged;
}

/**
 * Get all memories for a user
 * 
 * @param {string} userId - User ID
 * @param {string} memoryType - Optional filter by memory type
 * @returns {Promise<Array>} User's memories
 */
async function getUserMemories(userId, memoryType = null) {
    const supabase = getSupabase();
    
    let query = supabase
        .from('user_memories')
        .select('id, memory_text, memory_type, confidence_score, reinforcement_count, created_at')
        .eq('user_id', userId)
        .order('reinforcement_count', { ascending: false });
    
    if (memoryType) {
        query = query.eq('memory_type', memoryType);
    }
    
    const { data, error } = await query;
    
    if (error) {
        console.error('[Supabase] Error getting user memories:', error);
        return [];
    }
    
    return data || [];
}

module.exports = {
    getSupabase,
    isSupabaseConfigured,
    searchSimilarMemories,
    retrieveRelevantMemories,
    insertMemory,
    reinforceMemory,
    getUserProfile,
    updateUserProfile,
    getUserMemories,
};
