import {
    getProfile,
    upsertProfile,
    generatePartnerCode,
    getPendingRequests,
    getSentRequest
} from './supabase';

/**
 * Default timeout for profile and partner loading operations
 */
const DEFAULT_PROFILE_TIMEOUT_MS = 5000;
const DEFAULT_REQUESTS_TIMEOUT_MS = 5000;

/**
 * Wraps a promise with a timeout to prevent hanging indefinitely
 * @param {Promise} promise - The promise to wrap
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} label - Label for error messages
 * @returns {Promise} Promise that rejects if timeout is exceeded
 */
const withTimeout = (promise, timeoutMs, label) => {
    if (!timeoutMs) return promise;
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`[ProfileLoader] ${label} timed out after ${timeoutMs}ms`)), timeoutMs)
        )
    ]);
};

/**
 * Loads the complete user context including profile, partner, and pending requests
 * This consolidates the profile loading logic used across auth flows
 *
 * @param {Object} user - Supabase user object (must have .id and .email)
 * @param {Object} options - Optional configuration
 * @param {string} options.preferredLanguage - Preferred language for new profiles
 * @param {number} options.profileTimeout - Timeout for profile operations (default: 5000ms)
 * @param {number} options.requestsTimeout - Timeout for request operations (default: 5000ms)
 * @returns {Promise<Object>} Object containing { profile, partner, requests, sent }
 *
 * @example
 * const { profile, partner, requests, sent } = await loadUserContext(user, {
 *   preferredLanguage: 'en',
 *   profileTimeout: 5000
 * });
 */
export const loadUserContext = async (user, options = {}) => {
    const {
        preferredLanguage = null,
        profileTimeout = DEFAULT_PROFILE_TIMEOUT_MS,
        requestsTimeout = DEFAULT_REQUESTS_TIMEOUT_MS
    } = options;

    // Validate user object
    if (!user || !user.id) {
        console.warn('[ProfileLoader] No valid user provided to loadUserContext');
        return { profile: null, partner: null, requests: [], sent: null };
    }

    // Load user profile with timeout
    let profile = null;
    try {
        const profileResult = await withTimeout(
            getProfile(user.id),
            profileTimeout,
            'getProfile'
        );
        const { data: profileData, error: profileError } = profileResult || {};

        if (profileData) {
            profile = profileData;
        } else if (profileError?.code === 'PGRST116') {
            // Profile not found - create a new one
            console.log('[ProfileLoader] Profile not found (PGRST116), creating new profile');
            const partnerCode = generatePartnerCode();
            const { data: newProfile, error: createError } = await upsertProfile({
                id: user.id,
                email: user.email,
                partner_code: partnerCode,
                onboarding_complete: false,
                created_at: new Date().toISOString(),
                preferred_language: preferredLanguage || null,
            });

            if (!createError && newProfile) {
                profile = newProfile;
                console.log('[ProfileLoader] Created new profile successfully');
            } else {
                console.error('[ProfileLoader] Failed to create profile:', createError);
            }
        } else if (profileError) {
            console.warn('[ProfileLoader] Profile fetch error:', profileError);
        }
    } catch (e) {
        console.warn('[ProfileLoader] Failed to load profile:', e.message || e);
    }

    // Load partner profile if connected
    let partner = null;
    if (profile?.partner_id) {
        try {
            const partnerResult = await withTimeout(
                getProfile(profile.partner_id),
                profileTimeout,
                'getPartnerProfile'
            );
            partner = partnerResult?.data || null;

            if (!partner) {
                console.warn('[ProfileLoader] Failed to load partner profile');
            }
        } catch (e) {
            console.warn('[ProfileLoader] Failed to load partner profile:', e.message || e);
        }
    }

    // Load pending partner requests (non-critical, ignore failures)
    let requests = [];
    try {
        const pendingResult = await withTimeout(
            getPendingRequests(),
            requestsTimeout,
            'getPendingRequests'
        );
        requests = pendingResult?.data || [];
    } catch (e) {
        // Non-critical on boot; ignore silently
        console.debug('[ProfileLoader] Failed to load pending requests (non-critical):', e.message || e);
    }

    // Load sent partner request (non-critical, ignore failures)
    let sent = null;
    try {
        const sentResult = await withTimeout(
            getSentRequest(),
            requestsTimeout,
            'getSentRequest'
        );
        sent = sentResult?.data || null;
    } catch (e) {
        // Non-critical on boot; ignore silently
        console.debug('[ProfileLoader] Failed to load sent request (non-critical):', e.message || e);
    }

    return { profile, partner, requests, sent };
};

/**
 * Loads just the user profile, creating one if it doesn't exist
 * Simplified version of loadUserContext for cases where only profile is needed
 *
 * @param {Object} user - Supabase user object (must have .id and .email)
 * @param {Object} options - Optional configuration
 * @param {string} options.preferredLanguage - Preferred language for new profiles
 * @param {number} options.timeout - Timeout for profile operations (default: 5000ms)
 * @returns {Promise<Object|null>} Profile object or null on failure
 *
 * @example
 * const profile = await loadProfile(user, { preferredLanguage: 'en' });
 */
export const loadProfile = async (user, options = {}) => {
    const {
        preferredLanguage = null,
        timeout = DEFAULT_PROFILE_TIMEOUT_MS
    } = options;

    if (!user || !user.id) {
        console.warn('[ProfileLoader] No valid user provided to loadProfile');
        return null;
    }

    try {
        const profileResult = await withTimeout(
            getProfile(user.id),
            timeout,
            'getProfile'
        );
        const { data: profileData, error: profileError } = profileResult || {};

        if (profileData) {
            return profileData;
        }

        if (profileError?.code === 'PGRST116') {
            // Profile not found - create a new one
            console.log('[ProfileLoader] Profile not found, creating new profile');
            const partnerCode = generatePartnerCode();
            const { data: newProfile, error: createError } = await upsertProfile({
                id: user.id,
                email: user.email,
                partner_code: partnerCode,
                onboarding_complete: false,
                created_at: new Date().toISOString(),
                preferred_language: preferredLanguage || null,
            });

            if (!createError && newProfile) {
                return newProfile;
            } else {
                console.error('[ProfileLoader] Failed to create profile:', createError);
                return null;
            }
        }

        console.warn('[ProfileLoader] Profile fetch error:', profileError);
        return null;
    } catch (e) {
        console.warn('[ProfileLoader] Failed to load profile:', e.message || e);
        return null;
    }
};

/**
 * Loads just the partner profile if the user has a partner connected
 *
 * @param {Object} profile - User's profile object (must have .partner_id)
 * @param {number} timeout - Timeout for profile operation (default: 5000ms)
 * @returns {Promise<Object|null>} Partner profile object or null if not connected/failed
 *
 * @example
 * const partner = await loadPartner(currentProfile);
 */
export const loadPartner = async (profile, timeout = DEFAULT_PROFILE_TIMEOUT_MS) => {
    if (!profile?.partner_id) {
        return null;
    }

    try {
        const partnerResult = await withTimeout(
            getProfile(profile.partner_id),
            timeout,
            'getPartnerProfile'
        );
        return partnerResult?.data || null;
    } catch (e) {
        console.warn('[ProfileLoader] Failed to load partner profile:', e.message || e);
        return null;
    }
};

/**
 * Export timeout utilities for use by other modules
 */
export { withTimeout };
