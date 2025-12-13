import axios from 'axios';
import { supabase } from './supabase';

// API base URL
// - Prefer same-origin (/api) so dev uses the local server by default.
// - Allow override via VITE_API_URL when explicitly set (e.g. pointing at Render).
const ENV_API_URL = import.meta.env.VITE_API_URL;
const API_BASE_URL = ENV_API_URL && ENV_API_URL.trim().length > 0 ? ENV_API_URL : '/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Attach Supabase auth token so server can enforce per-user access.
api.interceptors.request.use(async (config) => {
    try {
        const { data } = await supabase.auth.getSession();
        const token = data?.session?.access_token;
        if (token) {
            config.headers = config.headers || {};
            config.headers.Authorization = `Bearer ${token}`;
        }
    } catch (_err) {
        // Best-effort only.
    }
    return config;
});

// --- Judge Engine API ---

/**
 * Submit a dispute for Judge Whiskers' verdict
 * 
 * @param {object} payload - The deliberation payload
 * @param {object} payload.participants - { userA: {name, id}, userB: {name, id} }
 * @param {object} payload.submissions - Submissions from both users
 * @returns {Promise<object>} The verdict response
 */
export const submitForDeliberation = async (payload) => {
    const response = await api.post('/judge/deliberate', payload);
    return response.data;
};

/**
 * Check Judge Engine health status
 * @returns {Promise<object>} Health status
 */
export const getJudgeHealth = async () => {
    const response = await api.get('/judge/health');
    return response.data;
};

export default api;
