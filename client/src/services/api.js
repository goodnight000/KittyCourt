import axios from 'axios';
import { supabase } from './supabase';
import useAuthStore from '../store/useAuthStore';
import { normalizeLanguage } from '../i18n';

// API base URL
// - Prefer same-origin (/api) so dev uses the local server by default.
// - Allow override via VITE_API_URL when explicitly set (e.g. pointing at Render).
const ENV_API_URL = import.meta.env.VITE_API_URL;

const normalizeApiBase = (value) => {
    if (!value) return '/api';
    const trimmed = String(value).trim();
    if (!trimmed) return '/api';
    if (trimmed.startsWith('/')) {
        return trimmed === '/' ? '/api' : trimmed;
    }
    try {
        const url = new URL(trimmed);
        if (!url.pathname || url.pathname === '/') {
            url.pathname = '/api';
        }
        return url.toString().replace(/\/$/, '');
    } catch (_err) {
        return trimmed;
    }
};

const API_BASE_URL = normalizeApiBase(ENV_API_URL);

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
        } else {
            // Session missing - try to refresh before giving up
            const { data: refreshData } = await supabase.auth.refreshSession();
            const refreshedToken = refreshData?.session?.access_token;
            if (refreshedToken) {
                config.headers = config.headers || {};
                config.headers.Authorization = `Bearer ${refreshedToken}`;
            }
        }
        const state = useAuthStore.getState();
        const preferred = normalizeLanguage(state.preferredLanguage || state.profile?.preferred_language);
        if (preferred) {
            config.headers = config.headers || {};
            config.headers['Accept-Language'] = preferred;
        }
    } catch (_err) {
        // Best-effort only.
    }
    return config;
});

// Response interceptor for 401 handling with token refresh (CRITICAL-008 fix)
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // If 401 and not already retrying
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                // Attempt to refresh session
                const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();

                if (refreshError || !session) {
                    // Refresh failed, trigger logout
                    console.warn('[API] Token refresh failed, logging out');
                    useAuthStore.getState().signOut();
                    return Promise.reject(error);
                }

                // Update token and retry
                originalRequest.headers.Authorization = `Bearer ${session.access_token}`;
                return api(originalRequest);
            } catch (refreshError) {
                console.error('[API] Token refresh exception:', refreshError);
                useAuthStore.getState().signOut();
                return Promise.reject(error);
            }
        }

        return Promise.reject(error);
    }
);

export default api;
