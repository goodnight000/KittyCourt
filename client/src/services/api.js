import axios from 'axios';

// Use environment variable if set, otherwise use Render production URL
// Falls back to localhost for local development
const API_BASE_URL = import.meta.env.VITE_API_URL ||
    (import.meta.env.DEV ? 'http://localhost:3000/api' : 'https://kittyjudge.onrender.com/api');

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// --- Judge Engine API ---

/**
 * Submit a dispute for Judge Mittens' verdict
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
