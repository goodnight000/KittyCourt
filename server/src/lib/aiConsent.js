/**
 * AI Consent Utilities
 *
 * Centralizes checks for whether a user has granted AI processing consent.
 */

const { isSupabaseConfigured, getSupabase } = require('./supabase');

async function hasAiConsent(userId) {
    if (!userId) return false;

    // Development fallback: if Supabase is unavailable, do not block local testing.
    if (!isSupabaseConfigured()) {
        return true;
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('profiles')
        .select('ai_insights_consent')
        .eq('id', userId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data?.ai_insights_consent === true;
}

module.exports = {
    hasAiConsent,
};
