import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { quotaSafeLocalStorage } from './quotaSafeStorage';
import {
    supabase,
    signInWithEmail as supabaseSignInWithEmail,
    signUpWithEmail as supabaseSignUpWithEmail,
    signInWithGoogle as supabaseSignInWithGoogle,
    signOut as supabaseSignOut,
    getSession,
    upsertProfile,
    generatePartnerCode
} from '../services/supabase';
import { loadUserContext } from '../services/profileLoader';
import { eventBus, EVENTS } from '../lib/eventBus';
import { readSessionBackup, writeSessionBackup, clearSessionBackup } from '../services/authSessionBackup';
import useSubscriptionStore from './useSubscriptionStore';
import useCacheStore from './useCacheStore';
import { logOutUser as revenueCatLogOut } from '../services/revenuecat';
import { deactivateDeviceToken } from '../services/pushNotifications';
import { DEFAULT_LANGUAGE, normalizeLanguage } from '../i18n/languageConfig';
import api from '../services/api';

const resolvePreferredLanguage = (profile) => (
    normalizeLanguage(profile?.preferred_language) || DEFAULT_LANGUAGE
);

const getInitialLanguage = () => {
    if (typeof navigator === 'undefined') return DEFAULT_LANGUAGE;
    const normalized = normalizeLanguage(navigator.language);
    return normalized || DEFAULT_LANGUAGE;
};

const resolveInitialProfileLanguage = (preferredLanguage) => (
    normalizeLanguage(preferredLanguage) || getInitialLanguage()
);

let initializePromise = null;
let authListenerSubscription = null;
let pendingTimeouts = new Set();
let eventCleanupFns = [];

/**
 * Handler for SIGNED_OUT event
 */
const handleSignedOut = (set, get) => {
    if (import.meta.env.DEV) console.log('[Auth] Handling SIGNED_OUT event');

    // Clear all pending timeouts to prevent memory leaks
    pendingTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    pendingTimeouts.clear();

    // Deactivate push tokens (fire and forget - don't block signout on failure)
    deactivateDeviceToken().catch(err => {
        console.warn('[Auth] Failed to deactivate push tokens:', err);
    });

    useSubscriptionStore.getState().reset();
    revenueCatLogOut();
    useCacheStore.getState().clearAll();
    useCacheStore.getState().clearRegistry();

    // Emit logout event
    eventBus.emit(EVENTS.AUTH_LOGOUT, { userId: null, source: 'auth' });

    set({
        user: null,
        session: null,
        profile: null,
        isAuthenticated: false,
        hasCheckedAuth: true, // Keep true after signout (auth was checked, user is signed out)
        preferredLanguage: DEFAULT_LANGUAGE,
        isLoading: false
    });
};

/**
 * Handler for TOKEN_REFRESHED event
 */
const handleTokenRefreshed = (set, session) => {
    if (import.meta.env.DEV) console.log('[Auth] Handling TOKEN_REFRESHED event');

    if (session) {
        set({ session });
        // Emit session refreshed event
        eventBus.emit(EVENTS.AUTH_SESSION_REFRESHED, {
            userId: session.user?.id,
            session,
            source: 'auth'
        });
    }
};

/**
 * Handler for SIGNED_IN event
 */
const handleSignedIn = async (set, get, sessionUser, session) => {
    if (import.meta.env.DEV) console.log('[Auth] Handling SIGNED_IN event for user:', sessionUser?.id);

    const state = get();

    // If we're already authenticated with this user, avoid duplicate work.
    if (state.isAuthenticated && state.user?.id === sessionUser.id) {
        if (session && state.session?.access_token !== session.access_token) {
            set({ session });
        }
        return;
    }

    // Clear any cached data from a different user.
    if (state.profile?.id && state.profile.id !== sessionUser.id) {
        set({
            profile: null,
            preferredLanguage: DEFAULT_LANGUAGE
        });
    }

    const cachedProfile = get().profile;

    // Set auth state atomically to prevent flash of unauthenticated content
    if (cachedProfile?.id === sessionUser.id) {
        // Use cached profile - set all auth state in one atomic update
        const cachedLanguage = resolvePreferredLanguage(cachedProfile);
        set({
            user: sessionUser,
            session,
            isAuthenticated: true,
            hasCheckedAuth: true,
            isLoading: false,
            preferredLanguage: cachedLanguage,
        });

        eventBus.emit(EVENTS.AUTH_LOGIN, {
            userId: sessionUser.id,
            profile: cachedProfile,
            user: sessionUser,
            preferredLanguage: cachedLanguage,
            source: 'auth'
        });

        // Warm cache in background (don't await)
        useCacheStore.getState().warmCache(sessionUser.id, cachedProfile?.partner_id, cachedLanguage);

        const timeoutId = setTimeout(() => {
            pendingTimeouts.delete(timeoutId);
            get().refreshProfile();
        }, 0);
        pendingTimeouts.add(timeoutId);
        return;
    }

    // No cached profile - set basic auth state first
    set({
        user: sessionUser,
        session,
        isAuthenticated: true
    });

    try {
        const { profile, partner, requests, sent } = await loadUserContext(sessionUser, {
            preferredLanguage: resolveInitialProfileLanguage(get().preferredLanguage)
        });

        const stateAfterHydrate = get();
        // Set all auth state atomically to prevent flash
        set({
            profile,
            preferredLanguage: profile ? resolvePreferredLanguage(profile) : stateAfterHydrate.preferredLanguage,
            hasCheckedAuth: true,
            isLoading: false,
        });

        // Emit login event
        eventBus.emit(EVENTS.AUTH_LOGIN, {
            userId: sessionUser.id,
            profile,
            partner,
            requests,
            sent,
            user: sessionUser,
            preferredLanguage: profile ? resolvePreferredLanguage(profile) : get().preferredLanguage,
            source: 'auth'
        });

        // Warm cache in background (don't await)
        const warmLanguage = profile ? resolvePreferredLanguage(profile) : get().preferredLanguage;
        useCacheStore.getState().warmCache(sessionUser.id, partner?.id || profile?.partner_id, warmLanguage);

        // Initialize subscription store after auth
        const timeoutId = setTimeout(() => {
            pendingTimeouts.delete(timeoutId);
            useSubscriptionStore.getState().initialize(sessionUser.id);
        }, 100);
        pendingTimeouts.add(timeoutId);
    } catch (e) {
        console.warn('[Auth] Failed to hydrate user context:', e);
        // Even on error, mark auth as checked so we don't get stuck on loading
        set({ hasCheckedAuth: true, isLoading: false });
    }
};

/**
 * Handler for INITIAL_SESSION event
 */
const handleInitialSession = (set, get, sessionUser, session) => {
    if (import.meta.env.DEV) console.log('[Auth] Handling INITIAL_SESSION event');
    // INITIAL_SESSION uses the same logic as SIGNED_IN
    return handleSignedIn(set, get, sessionUser, session);
};

const startSupabaseAuthListener = () => {
    if (authListenerSubscription) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        // INITIAL_SESSION is handled synchronously by initialize() so we can
        // await profile hydration before rendering routes.
        if (event === 'INITIAL_SESSION') return;

        if (event === 'SIGNED_OUT') {
            clearSessionBackup();
        }

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
            if (session) writeSessionBackup(session);
        }

        useAuthStore.getState().handleSupabaseAuthEvent(event, session);
    });

    authListenerSubscription = subscription;
};

const restoreSessionFromBackup = async () => {
    const backup = readSessionBackup();
    if (!backup?.refresh_token) return null;

    try {
        const { data, error } = await supabase.auth.setSession({
            access_token: backup.access_token,
            refresh_token: backup.refresh_token,
        });
        if (error) throw error;

        if (data?.session) writeSessionBackup(data.session);
        return data?.session || null;
    } catch (e) {
        console.warn('[Auth] Failed to restore session from backup:', e);
        clearSessionBackup();
        return null;
    }
};

/**
 * Authentication store for managing user auth state
 */
const useAuthStore = create(
    persist(
        (set, get) => ({
            // Auth state
            user: null,
            session: null,
            profile: null,
            isLoading: true,
            isAuthenticated: false,
            hasCheckedAuth: false, // Tracks if initial auth check completed (not persisted)
            preferredLanguage: DEFAULT_LANGUAGE,

            handleSupabaseAuthEvent: async (event, session) => {
                const sessionUser = session?.user || null;
                if (import.meta.env.DEV) console.log('[Auth] Auth state change:', event, sessionUser?.id);

                if (event === 'SIGNED_OUT') {
                    return handleSignedOut(set, get);
                }

                if (event === 'TOKEN_REFRESHED') {
                    return handleTokenRefreshed(set, session);
                }

                if (event === 'SIGNED_IN' && sessionUser) {
                    return handleSignedIn(set, get, sessionUser, session);
                }

                if (event === 'INITIAL_SESSION' && sessionUser) {
                    return handleInitialSession(set, get, sessionUser, session);
                }
            },

            // Initialize auth state on app load
            initialize: async () => {
                if (initializePromise) return initializePromise;

                initializePromise = (async () => {
                    set({ isLoading: true });

                    if (useAuthStore.persist?.hasHydrated && !useAuthStore.persist.hasHydrated()) {
                        await new Promise((resolve) => {
                            const unsub = useAuthStore.persist.onFinishHydration(() => {
                                unsub();
                                resolve();
                            });
                        });
                    }

                    startSupabaseAuthListener();

                    const { session: rawSession, error: rawSessionError } = await getSession();
                    if (rawSessionError) {
                        console.warn('[Auth] getSession error:', rawSessionError);
                    } else {
                        // Keep backup warm even if Supabase persistence is flaky on some webviews.
                        if (rawSession) writeSessionBackup(rawSession);
                    }

                    let session = rawSession;
                    if (!session?.user) {
                        session = await restoreSessionFromBackup();
                    }

                    if (session?.user) {
                        // handleSignedIn sets hasCheckedAuth and isLoading atomically
                        await get().handleSupabaseAuthEvent('INITIAL_SESSION', session);
                    } else {
                        // No session - set all state atomically including hasCheckedAuth
                        set({
                            user: null,
                            session: null,
                            profile: null,
                            isAuthenticated: false,
                            hasCheckedAuth: true,
                            preferredLanguage: DEFAULT_LANGUAGE,
                            isLoading: false
                        });
                    }
                })().catch((error) => {
                    console.error('[Auth] Initialization error:', error);
                    initializePromise = null; // Reset to allow retry (CRITICAL-009 fix)
                    set({ isLoading: false, hasCheckedAuth: true });
                });

                return initializePromise;
            },

            // Initialize event bus listeners (for external profile updates)
            init: () => {
                eventCleanupFns.forEach(fn => fn());
                eventCleanupFns = [];

                const unsubProfile = eventBus.on(EVENTS.PROFILE_UPDATED, (payload) => {
                    if (!payload?.profile || payload?.source === 'auth') return;

                    const currentUserId = get().user?.id;
                    if (currentUserId && payload.userId && payload.userId !== currentUserId) return;

                    set({
                        profile: payload.profile,
                        preferredLanguage: resolvePreferredLanguage(payload.profile) || get().preferredLanguage,
                    });
                });

                eventCleanupFns.push(unsubProfile);
            },

            // Sign in with email/password
            // Note: Set global isLoading during auth to avoid routing "flashes" before profile is hydrated.
            signIn: async (email, password) => {
                try {
                    set({ isLoading: true });
                    if (import.meta.env.DEV) console.log('[Auth] signIn called with email:', email);
                    const { data, error } = await supabaseSignInWithEmail(email, password);
                    if (error) {
                        console.error('[Auth] Sign in error:', error);
                        set({ isLoading: false });
                        return { error };
                    }

                    if (import.meta.env.DEV) console.log('[Auth] Sign in successful, user:', data.user?.id);

                    // Load user context using profile loader service
                    let profile = null;
                    let partner = null;
                    let requests = [];
                    let sent = null;
                    try {
                        if (import.meta.env.DEV) console.log('[Auth] Loading user context for user:', data.user.id);

                        const {
                            profile: loadedProfile,
                            partner: loadedPartner,
                            requests: loadedRequests,
                            sent: loadedSent
                        } = await loadUserContext(data.user, {
                            preferredLanguage: resolveInitialProfileLanguage(get().preferredLanguage),
                            profileTimeout: 5000
                        });

                        profile = loadedProfile;
                        partner = loadedPartner;
                        requests = loadedRequests || [];
                        sent = loadedSent || null;

                        if (import.meta.env.DEV) {
                            console.log('[Auth] User context loaded:', {
                                hasProfile: !!profile
                            });
                        }
                    } catch (e) {
                        console.warn('[Auth] Profile fetch exception:', e);
                    }

                    if (import.meta.env.DEV) {
                        console.log('[Auth] Setting state after sign-in:', {
                            userId: data.user?.id,
                            hasProfile: !!profile
                        });
                    }

                    set({
                        user: data.user,
                        session: data.session,
                        profile,
                        isAuthenticated: true,
                        preferredLanguage: profile ? resolvePreferredLanguage(profile) : DEFAULT_LANGUAGE,
                        isLoading: false
                    });

                    // Emit login event
                    eventBus.emit(EVENTS.AUTH_LOGIN, {
                        userId: data.user.id,
                        profile,
                        partner,
                        requests,
                        sent,
                        user: data.user,
                        preferredLanguage: profile ? resolvePreferredLanguage(profile) : get().preferredLanguage,
                        source: 'auth'
                    });

                    // Warm cache in background (don't await)
                    const warmLanguage = profile ? resolvePreferredLanguage(profile) : get().preferredLanguage;
                    useCacheStore.getState().warmCache(data.user.id, partner?.id || profile?.partner_id, warmLanguage);

                    // Set up real-time subscriptions and initialize subscription store
                    const timeoutId = setTimeout(() => {
                        pendingTimeouts.delete(timeoutId);
                        useSubscriptionStore.getState().initialize(data.user.id);
                    }, 100);
                    pendingTimeouts.add(timeoutId);

                    if (import.meta.env.DEV) console.log('[Auth] State set complete, returning success');
                    return { data };
                } catch (e) {
                    console.error('[Auth] Sign in exception:', e);
                    set({ isLoading: false });
                    return { error: { message: 'An unexpected error occurred' } };
                }
            },

            // Sign up with email/password
            // Note: Does NOT set global isLoading to avoid showing LoadingScreen during auth
            signUp: async (email, password) => {
                const { data, error } = await supabaseSignUpWithEmail(email, password);
                if (error) {
                    return { error };
                }

                // Check if email confirmation is required (session will be null when confirmation needed)
                const needsEmailConfirmation = data.user && !data.session;

                // Create initial profile with partner code (even if confirmation needed)
                if (data.user) {
                    const partnerCode = generatePartnerCode();
                    await upsertProfile({
                        id: data.user.id,
                        email: data.user.email,
                        partner_code: partnerCode,
                        onboarding_complete: false,
                        created_at: new Date().toISOString(),
                        preferred_language: resolveInitialProfileLanguage(get().preferredLanguage),
                    });
                }

                // Only set authenticated if we have a valid session
                if (needsEmailConfirmation) {
                    // Email confirmation required - don't set authenticated
                    if (import.meta.env.DEV) console.log('[Auth] Sign up successful, email confirmation required');
                    return {
                        data,
                        needsEmailConfirmation: true,
                        email: email
                    };
                }

                // Session exists - fully authenticated
                set({
                    user: data.user,
                    session: data.session,
                    isAuthenticated: true,
                    preferredLanguage: DEFAULT_LANGUAGE,
                    isLoading: false
                });
                return { data };
            },

            // Sign in with Google
            // Note: Does NOT set global isLoading - OAuth redirects handle their own flow
            signInWithGoogle: async () => {
                const { data, error } = await supabaseSignInWithGoogle();
                if (error) {
                    return { error };
                }
                // OAuth redirects, so we don't set state here
                return { data };
            },

            // Sign out
            signOut: async () => {
                const { user } = get();
                set({ isLoading: true });

                // Clear all pending timeouts to prevent memory leaks
                pendingTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
                pendingTimeouts.clear();

                // Deactivate push notification tokens
                await deactivateDeviceToken();

                useSubscriptionStore.getState().reset();
                revenueCatLogOut();
                await supabaseSignOut();

                // Emit logout event
                eventBus.emit(EVENTS.AUTH_LOGOUT, { userId: user?.id, source: 'auth' });

                set({
                    user: null,
                    session: null,
                    profile: null,
                    isAuthenticated: false,
                    hasCheckedAuth: true, // Keep true after signout (auth was checked, user is signed out)
                    preferredLanguage: DEFAULT_LANGUAGE,
                    isLoading: false
                });
            },

            setProfile: (profile) => {
                const current = get();
                set({
                    profile,
                    preferredLanguage: profile
                        ? resolvePreferredLanguage(profile)
                        : current.preferredLanguage,
                });

                if (profile?.id || current.user?.id) {
                    eventBus.emit(EVENTS.PROFILE_UPDATED, {
                        userId: profile?.id || current.user?.id,
                        changes: profile,
                        profile,
                        source: 'auth'
                    });
                }
            },

            // Refresh profile from database
            refreshProfile: async () => {
                const { user } = get();
                if (!user) return;

                try {
                    // Use profileLoader to load user context
                    const { profile, partner, requests, sent } = await loadUserContext(user, {
                        preferredLanguage: get().preferredLanguage,
                        profileTimeout: 5000
                    });

                    set({
                        profile,
                        preferredLanguage: resolvePreferredLanguage(profile),
                    });

                    // Emit profile updated event
                    eventBus.emit(EVENTS.PROFILE_UPDATED, {
                        userId: user.id,
                        changes: profile,
                        profile,
                        partner,
                        requests,
                        sent,
                        source: 'auth'
                    });
                } catch (e) {
                    console.warn('[Auth] Failed to refresh profile:', e);
                }
            },

            setPreferredLanguage: async (language) => {
                const normalizedLanguage = normalizeLanguage(language) || DEFAULT_LANGUAGE;
                const { user, profile, preferredLanguage: currentLanguage } = get();
                const shouldInvalidateCache = normalizedLanguage !== currentLanguage;

                if (profile) {
                    set({
                        preferredLanguage: normalizedLanguage,
                        profile: { ...profile, preferred_language: normalizedLanguage },
                    });
                } else {
                    set({ preferredLanguage: normalizedLanguage });
                }

                // Emit language changed event
                if (shouldInvalidateCache) {
                    eventBus.emit(EVENTS.LANGUAGE_CHANGED, {
                        language: normalizedLanguage,
                        previousLanguage: currentLanguage,
                        userId: user?.id || null,
                        source: 'auth'
                    });
                }

                if (!user) {
                    if (shouldInvalidateCache) {
                        useCacheStore.getState().clearAll();
                    }
                    return;
                }

                try {
                    const timestamp = new Date().toISOString();
                    const { error } = await supabase
                        .from('profiles')
                        .update({
                            preferred_language: normalizedLanguage,
                            updated_at: timestamp,
                        })
                        .eq('id', user.id)
                        .select()
                        .single();

                    if (error?.code === 'PGRST116') {
                        const partnerCode = generatePartnerCode();
                        const { error: createError } = await upsertProfile({
                            id: user.id,
                            email: user.email,
                            partner_code: partnerCode,
                            onboarding_complete: false,
                            created_at: timestamp,
                            preferred_language: normalizedLanguage,
                            updated_at: timestamp,
                        });

                        if (createError) {
                            console.warn('[Auth] Failed to create profile while updating language:', createError);
                            return;
                        }
                    } else if (error) {
                        console.warn('[Auth] Failed to update language:', error);
                        return;
                    }

                    await get().refreshProfile();
                } catch (err) {
                    console.warn('[Auth] Failed to persist language:', err);
                } finally {
                    if (shouldInvalidateCache) {
                        useCacheStore.getState().clearAll();
                        // Re-warm cache after clearing
                        const { profile: updatedProfile } = get();
                        useCacheStore.getState().warmCache(user.id, updatedProfile?.partner_id, normalizedLanguage);
                    }
                }
            },

            // Delete account (required for App Store compliance)
            deleteAccount: async () => {
                try {
                    set({ isLoading: true });
                    const response = await api.delete('/account');
                    if (response.data?.success) {
                        // Clear all local state by signing out
                        await get().signOut();
                        return { success: true };
                    }
                    set({ isLoading: false });
                    return { error: 'Failed to delete account' };
                } catch (error) {
                    console.error('[Auth] Delete account failed:', error);
                    set({ isLoading: false });
                    return { error: error.response?.data?.error || error.message };
                }
            },

            // Clean up all resources (called on app unmount)
            cleanup: () => {
                if (import.meta.env.DEV) console.log('[Auth] Cleaning up all resources');

                eventCleanupFns.forEach(fn => fn());
                eventCleanupFns = [];

                // Clear all pending timeouts
                pendingTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
                pendingTimeouts.clear();
            },
        }),
        {
            name: 'catjudge-auth',
            storage: quotaSafeLocalStorage,
            partialize: (state) => ({
                // Persist non-secret UI state to avoid blocking on network at boot.
                // Strip large avatar_url/data URLs to prevent localStorage quota issues.
                // Exclude subscription refs (_profileSubscription, _requestsSubscription) from persistence.
                profile: state.profile
                    ? {
                        ...state.profile,
                        avatar_url:
                            typeof state.profile.avatar_url === 'string' &&
                                (state.profile.avatar_url.startsWith('data:') || state.profile.avatar_url.length > 2048)
                                ? undefined
                                : state.profile.avatar_url,
                    }
                    : null,
                preferredLanguage: state.preferredLanguage,
                // Note: realtime subscription refs are intentionally excluded
            }),
        }
    )
);

export default useAuthStore;
