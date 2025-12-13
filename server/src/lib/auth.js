const { getSupabase, isSupabaseConfigured } = require('./supabase');

const requireSupabase = () => {
    if (!isSupabaseConfigured()) {
        const error = new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.');
        error.statusCode = 503;
        throw error;
    }
    return getSupabase();
};

// Supabase JWT via Authorization: Bearer <token>
const requireAuthUserId = async (req) => {
    const header = req.headers.authorization || req.headers.Authorization || '';
    const match = typeof header === 'string' ? header.match(/^Bearer\s+(.+)$/i) : null;
    const token = match?.[1];

    if (!token) {
        const error = new Error('Missing Authorization bearer token');
        error.statusCode = 401;
        throw error;
    }

    const supabase = requireSupabase();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user?.id) {
        const err = new Error('Invalid or expired session');
        err.statusCode = 401;
        throw err;
    }

    return data.user.id;
};

const getPartnerIdForUser = async (supabase, userId) => {
    const { data, error } = await supabase
        .from('profiles')
        .select('partner_id')
        .eq('id', userId)
        .single();

    if (error) throw error;
    return data?.partner_id || null;
};

module.exports = {
    requireSupabase,
    requireAuthUserId,
    getPartnerIdForUser
};

