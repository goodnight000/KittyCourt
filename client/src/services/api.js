import axios from 'axios';
import { supabase } from './supabase';
import useAuthStore from '../store/useAuthStore';
import useConnectivityStore from '../store/useConnectivityStore';
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
    } catch {
        return trimmed;
    }
};

const API_BASE_URL = normalizeApiBase(ENV_API_URL);
const REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 12_000);
const MAX_GET_RETRIES = Number(import.meta.env.VITE_API_GET_RETRIES || 2);
const RETRY_BASE_DELAY_MS = Number(import.meta.env.VITE_API_RETRY_BASE_DELAY_MS || 300);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const computeRetryDelayMs = (attempt) => {
    const safeAttempt = Math.max(1, Number(attempt || 1));
    const exponential = RETRY_BASE_DELAY_MS * Math.pow(2, safeAttempt - 1);
    const jitter = Math.round(exponential * 0.2 * Math.random());
    return Math.min(exponential + jitter, 4_000);
};

export const isIdempotentMethod = (method) => {
    const normalized = String(method || 'get').toLowerCase();
    return normalized === 'get' || normalized === 'head' || normalized === 'options';
};

const isNetworkError = (error) => (
    error?.code === 'ERR_NETWORK'
    || String(error?.message || '').toLowerCase().includes('network error')
    || (!error?.response && !error?.status)
);

const isTimeoutError = (error) => (
    error?.code === 'ECONNABORTED'
    || String(error?.message || '').toLowerCase().includes('timeout')
);

const isRetryableStatus = (status) => Number.isFinite(status) && (status === 429 || status >= 500);

export const shouldRetryApiRequest = (error, requestConfig = {}) => {
    if (!isIdempotentMethod(requestConfig?.method)) return false;
    if (requestConfig?._retryAuth) return false;

    if (isTimeoutError(error) || isNetworkError(error)) return true;

    const status = error?.response?.status;
    return isRetryableStatus(status);
};

export const normalizeApiError = (error) => {
    const status = error?.response?.status || null;
    const statusText = error?.response?.statusText || '';
    const responseMessage = error?.response?.data?.error || error?.response?.data?.message;
    const timeout = isTimeoutError(error);
    const network = isNetworkError(error);

    let message = responseMessage
        || error?.message
        || (status ? `Request failed (${status})` : 'Request failed');

    if (timeout) {
        message = 'Request timed out. Please try again.';
    } else if (network) {
        message = 'Network unavailable. Check your connection and try again.';
    } else if (status === 503) {
        message = 'Service temporarily unavailable. Please try again.';
    } else if (status >= 500) {
        message = 'Server is unavailable right now. Please try again.';
    } else if (status === 429) {
        message = 'Too many requests. Please wait a moment and retry.';
    }

    return {
        status,
        statusText,
        message,
        code: error?.code || null,
        isNetworkError: network,
        isTimeoutError: timeout,
        isServerError: Number.isFinite(status) && status >= 500,
        originalError: error,
    };
};

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: REQUEST_TIMEOUT_MS,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Attach Supabase auth token so server can enforce per-user access.
api.interceptors.request.use(async (config) => {
    try {
        config.timeout = config.timeout || REQUEST_TIMEOUT_MS;
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
    } catch {
        // Best-effort only.
    }

    config._retryCount = Number(config._retryCount || 0);
    return config;
});

// Response interceptor for 401 handling with token refresh (CRITICAL-008 fix)
api.interceptors.response.use(
    (response) => {
        useConnectivityStore.getState().markBackendHealthy('api_response');
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        // If 401 and not already retrying
        if (error.response?.status === 401 && originalRequest && !originalRequest._retryAuth) {
            originalRequest._retryAuth = true;
            originalRequest._retry = true;

            try {
                // Attempt to refresh session
                const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();

                if (refreshError || !session) {
                    // Refresh failed, trigger logout
                    console.warn('[API] Token refresh failed, logging out');
                    useAuthStore.getState().signOut();
                    useConnectivityStore.getState().markBackendIssue({
                        statusCode: error.response?.status,
                        error: refreshError || error,
                        source: 'auth_refresh',
                    });
                    return Promise.reject(error);
                }

                // Update token and retry
                originalRequest.headers.Authorization = `Bearer ${session.access_token}`;
                return api(originalRequest);
            } catch (refreshError) {
                console.error('[API] Token refresh exception:', refreshError);
                useAuthStore.getState().signOut();
                useConnectivityStore.getState().markBackendIssue({
                    statusCode: error.response?.status,
                    error: refreshError,
                    source: 'auth_refresh_exception',
                });
                return Promise.reject(error);
            }
        }

        const retryCount = Number(originalRequest?._retryCount || 0);
        if (
            originalRequest
            && retryCount < MAX_GET_RETRIES
            && shouldRetryApiRequest(error, originalRequest)
        ) {
            originalRequest._retryCount = retryCount + 1;
            const delayMs = computeRetryDelayMs(originalRequest._retryCount);
            await sleep(delayMs);
            return api(originalRequest);
        }

        useConnectivityStore.getState().markBackendIssue({
            statusCode: error?.response?.status || null,
            error,
            source: 'api_error',
        });

        const normalized = normalizeApiError(error);
        error.normalized = normalized;
        error.message = normalized.message;
        return Promise.reject(error);
    }
);

export default api;
