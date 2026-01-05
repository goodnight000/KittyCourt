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
    getProfile,
    upsertProfile,
    generatePartnerCode,
    findByPartnerCode,
    sendPartnerRequest,
    getPendingRequests,
    getSentRequest,
    acceptPartnerRequest,
    rejectPartnerRequest,
    cancelPartnerRequest,
    getPartnerProfile,
    subscribeToPartnerRequests,
    subscribeToProfileChanges
} from '../services/supabase';
import { loadUserContext } from '../services/profileLoader';
import { eventBus, EVENTS } from '../lib/eventBus';
import { readSessionBackup, writeSessionBackup, clearSessionBackup } from '../services/authSessionBackup';
import useSubscriptionStore from './useSubscriptionStore';
import useCacheStore from './useCacheStore';
import { logOutUser as revenueCatLogOut } from '../services/revenuecat';
import { deactivateDeviceToken } from '../services/pushNotifications';
import { DEFAULT_LANGUAGE, normalizeLanguage } from '../i18n/languageConfig';

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

/**
 * Handler for SIGNED_OUT event
 */
const handleSignedOut = (set, get) => {
    console.log('[Auth] Handling SIGNED_OUT event');

    // Clear all pending timeouts to prevent memory leaks
    pendingTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    pendingTimeouts.clear();

    // Clean up realtime subscriptions
    get().cleanupRealtimeSubscriptions();

    // Deactivate push tokens (fire and forget - don't block signout on failure)
    deactivateDeviceToken().catch(err => {
        console.warn('[Auth] Failed to deactivate push tokens:', err);
    });

    useSubscriptionStore.getState().reset();
    revenueCatLogOut();

    // Emit logout event
    eventBus.emit(EVENTS.AUTH_LOGOUT, { userId: null });

    set({
        user: null,
        session: null,
        profile: null,
        partner: null,
        pendingRequests: [],
        sentRequest: null,
        hasPartner: false,
        isAuthenticated: false,
        hasCheckedAuth: true, // Keep true after signout (auth was checked, user is signed out)
        onboardingComplete: false,
        onboardingStep: 0,
        onboardingData: {},
        preferredLanguage: DEFAULT_LANGUAGE,
        _profileSubscription: null,
        _requestsSubscription: null,
        isLoading: false
    });
};

/**
 * Handler for TOKEN_REFRESHED event
 */
const handleTokenRefreshed = (set, session) => {
    console.log('[Auth] Handling TOKEN_REFRESHED event');

    if (session) {
        set({ session });
        // Emit session refreshed event
        eventBus.emit(EVENTS.AUTH_SESSION_REFRESHED, {
            userId: session.user?.id,
            session
        });
    }
};

/**
 * Handler for SIGNED_IN event
 */
const handleSignedIn = async (set, get, sessionUser, session) => {
    console.log('[Auth] Handling SIGNED_IN event for user:', sessionUser?.id);

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
            partner: null,
            pendingRequests: [],
            sentRequest: null,
            hasPartner: false,
            onboardingComplete: false,
            onboardingStep: 0,
            onboardingData: {},
            preferredLanguage: DEFAULT_LANGUAGE
        });
    }

    const cachedProfile = get().profile;

    // Set auth state atomically to prevent flash of unauthenticated content
    if (cachedProfile?.id === sessionUser.id) {
        // Use cached profile - set all auth state in one atomic update
        set({
            user: sessionUser,
            session,
            isAuthenticated: true,
            hasCheckedAuth: true,
            isLoading: false,
            hasPartner: !!cachedProfile.partner_id,
            onboardingComplete: !!cachedProfile.onboarding_complete,
            preferredLanguage: resolvePreferredLanguage(cachedProfile),
        });

        const timeoutId = setTimeout(() => {
            pendingTimeouts.delete(timeoutId);
            get().refreshProfile();
            get().refreshPendingRequests();
            get().setupRealtimeSubscriptions();
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
            partner,
            pendingRequests: requests,
            sentRequest: sent,
            hasPartner: profile ? !!profile.partner_id : stateAfterHydrate.hasPartner,
            onboardingComplete: profile ? !!profile.onboarding_complete : stateAfterHydrate.onboardingComplete,
            preferredLanguage: profile ? resolvePreferredLanguage(profile) : stateAfterHydrate.preferredLanguage,
            hasCheckedAuth: true,
            isLoading: false,
        });

        // Emit login event
        eventBus.emit(EVENTS.AUTH_LOGIN, {
            userId: sessionUser.id,
            profile,
            partner
        });

        // Initialize subscription store after auth
        const timeoutId = setTimeout(() => {
            pendingTimeouts.delete(timeoutId);
            useSubscriptionStore.getState().initialize(sessionUser.id);
            get().setupRealtimeSubscriptions();
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
    console.log('[Auth] Handling INITIAL_SESSION event');
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

            // Partner state
            partner: null,
            pendingRequests: [],
            sentRequest: null,
            hasPartner: false,

            // Onboarding state
            onboardingComplete: false,
            onboardingStep: 0,
            onboardingData: {},
            preferredLanguage: DEFAULT_LANGUAGE,

            // Realtime subscription refs (not persisted)
            _profileSubscription: null,
            _requestsSubscription: null,

            handleSupabaseAuthEvent: async (event, session) => {
                const sessionUser = session?.user || null;
                console.log('[Auth] Auth state change:', event, sessionUser?.id);

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
                            partner: null,
                            pendingRequests: [],
                            sentRequest: null,
                            hasPartner: false,
                            isAuthenticated: false,
                            hasCheckedAuth: true,
                            onboardingComplete: false,
                            onboardingStep: 0,
                            onboardingData: {},
                            preferredLanguage: DEFAULT_LANGUAGE,
                            isLoading: false
                        });
                    }
                })().catch((error) => {
                    console.error('[Auth] Initialization error:', error);
                    set({ isLoading: false, hasCheckedAuth: true });
                });

                return initializePromise;
            },

            // Sign in with email/password
            // Note: Set global isLoading during auth to avoid routing "flashes" before profile is hydrated.
            signIn: async (email, password) => {
                try {
                    set({ isLoading: true });
                    console.log('[Auth] signIn called with email:', email);
                    const { data, error } = await supabaseSignInWithEmail(email, password);
                    if (error) {
                        console.error('[Auth] Sign in error:', error);
                        set({ isLoading: false });
                        return { error };
                    }

                    console.log('[Auth] Sign in successful, user:', data.user?.id);

                    // Load user context using profile loader service
                    let profile = null;
                    let partner = null;
                    try {
                        console.log('[Auth] Loading user context for user:', data.user.id);

                        const { profile: loadedProfile, partner: loadedPartner } = await loadUserContext(data.user, {
                            preferredLanguage: resolveInitialProfileLanguage(get().preferredLanguage),
                            profileTimeout: 5000
                        });

                        profile = loadedProfile;
                        partner = loadedPartner;

                        console.log('[Auth] User context loaded:', {
                            hasProfile: !!profile,
                            hasPartner: !!partner
                        });
                    } catch (e) {
                        console.warn('[Auth] Profile fetch exception:', e);
                    }

                    console.log('[Auth] Setting state after sign-in:', {
                        userId: data.user?.id,
                        hasProfile: !!profile,
                        onboardingComplete: profile?.onboarding_complete || false,
                        hasPartner: !!profile?.partner_id
                    });

                    set({
                        user: data.user,
                        session: data.session,
                        profile,
                        partner,
                        hasPartner: !!profile?.partner_id,
                        isAuthenticated: true,
                        onboardingComplete: profile?.onboarding_complete || false,
                        preferredLanguage: profile ? resolvePreferredLanguage(profile) : DEFAULT_LANGUAGE,
                        isLoading: false
                    });

                    // Emit login event
                    eventBus.emit(EVENTS.AUTH_LOGIN, {
                        userId: data.user.id,
                        profile,
                        partner
                    });

                    // Set up real-time subscriptions and initialize subscription store
                    const timeoutId = setTimeout(() => {
                        pendingTimeouts.delete(timeoutId);
                        useSubscriptionStore.getState().initialize(data.user.id);
                        get().setupRealtimeSubscriptions();
                    }, 100);
                    pendingTimeouts.add(timeoutId);

                    console.log('[Auth] State set complete, returning success');
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

                // Create initial profile with partner code
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

                set({
                    user: data.user,
                    session: data.session,
                    isAuthenticated: true,
                    onboardingComplete: false,
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

                // Clean up realtime subscriptions
                get().cleanupRealtimeSubscriptions();

                // Deactivate push notification tokens
                await deactivateDeviceToken();

                useSubscriptionStore.getState().reset();
                revenueCatLogOut();
                await supabaseSignOut();

                // Emit logout event
                eventBus.emit(EVENTS.AUTH_LOGOUT, { userId: user?.id });

                set({
                    user: null,
                    session: null,
                    profile: null,
                    partner: null,
                    pendingRequests: [],
                    sentRequest: null,
                    hasPartner: false,
                    isAuthenticated: false,
                    hasCheckedAuth: true, // Keep true after signout (auth was checked, user is signed out)
                    onboardingComplete: false,
                    onboardingStep: 0,
                    onboardingData: {},
                    preferredLanguage: DEFAULT_LANGUAGE,
                    _profileSubscription: null,
                    _requestsSubscription: null,
                    isLoading: false
                });
            },

            // ============================================
            // PARTNER CONNECTION ACTIONS
            // ============================================

            // Send a partner request by partner code
            sendPartnerRequestByCode: async (partnerCode) => {
                const { user, profile } = get();
                if (!user) return { error: 'Not authenticated' };

                // Check if trying to connect with self
                if (profile?.partner_code === partnerCode) {
                    return { error: "You can't connect with yourself! 😹" };
                }

                // Find user ID by partner code (secure lookup - only returns ID)
                const { data: targetUserLookup, error: findError } = await findByPartnerCode(partnerCode);
                if (findError || !targetUserLookup) {
                    return { error: 'Partner code not found. Please check and try again.' };
                }

                // Now fetch the target user's profile to check partner status
                // This uses RLS which allows viewing your own profile and partner's profile
                // For connection requests, we need to verify they don't already have a partner
                const { data: targetUser, error: profileError } = await getProfile(targetUserLookup.id);

                if (profileError) {
                    // Expected - can't view their profile if not connected yet (RLS restricts access)
                    // This is fine - we can still send the request and let them decide
                    console.log('[Auth] Cannot view target profile (RLS restriction) - proceeding with request');
                }

                // If we could view their profile and they have a partner, reject
                if (targetUser?.partner_id) {
                    return { error: 'This user is already connected with someone.' };
                }

                // Send the request using just the ID
                const { data, error } = await sendPartnerRequest(targetUserLookup.id);
                if (error) {
                    return { error: error.message || error };
                }

                // Set sent request - use ID since we may not have full profile access
                set({ sentRequest: { ...data, receiver: targetUser || { id: targetUserLookup.id } } });
                return { data, receiverName: targetUser?.display_name || 'your partner' };
            },

            // Refresh pending requests
            refreshPendingRequests: async () => {
                try {
                    const { data: requests } = await getPendingRequests();
                    const { data: sent } = await getSentRequest();
                    set({
                        pendingRequests: requests || [],
                        sentRequest: sent
                    });
                } catch (e) {
                    console.warn('Failed to refresh pending requests:', e);
                }
            },

            // Accept a partner request
            acceptRequest: async (requestId, anniversaryDate = null) => {
                const { user } = get();
                const { data: profile, error } = await acceptPartnerRequest(requestId, anniversaryDate);
                if (error) {
                    return { error };
                }

                // Get partner data
                const { data: partner } = await getPartnerProfile();

                set({
                    profile,
                    partner,
                    hasPartner: true,
                    pendingRequests: [],
                    sentRequest: null
                });

                // Emit partner connected event
                eventBus.emit(EVENTS.PARTNER_CONNECTED, {
                    userId: user?.id,
                    partnerId: profile?.partner_id,
                    partnerProfile: partner,
                    anniversary_date: profile?.anniversary_date
                });

                return { data: profile };
            },

            // Reject a partner request
            rejectRequest: async (requestId) => {
                const { error } = await rejectPartnerRequest(requestId);
                if (error) {
                    return { error };
                }

                // Remove from pending requests
                set((state) => ({
                    pendingRequests: state.pendingRequests.filter(r => r.id !== requestId)
                }));
                return { success: true };
            },

            // Cancel sent request
            cancelSentRequest: async () => {
                const { sentRequest } = get();
                if (!sentRequest) return { error: 'No sent request to cancel' };

                const { error } = await cancelPartnerRequest(sentRequest.id);
                if (error) {
                    return { error };
                }

                set({ sentRequest: null });
                return { success: true };
            },

            // Skip partner connection for now
            skipPartnerConnection: () => {
                // Just allow them to proceed without partner
                // Features will be restricted
            },

            // ============================================
            // ONBOARDING ACTIONS
            // ============================================
            setOnboardingStep: (step) => set({ onboardingStep: step }),

            updateOnboardingData: (data) => set((state) => ({
                onboardingData: { ...state.onboardingData, ...data }
            })),

            completeOnboarding: async () => {
                const { user, profile: existingProfile, onboardingData } = get();
                console.log('[completeOnboarding] Starting...', { user: user?.id, existingProfile: existingProfile?.id });

                if (!user) {
                    console.error('[completeOnboarding] No user logged in');
                    return { error: 'No user logged in' };
                }

                try {
                    // Use existing partner_code if profile exists, otherwise generate new one
                    const partnerCode = existingProfile?.partner_code || generatePartnerCode();
                    console.log('[completeOnboarding] Using partner code:', partnerCode);

                    // Process avatar - upload to storage if it's a custom upload
                    let avatarUrl = onboardingData.avatarUrl || null;
                    if (avatarUrl && avatarUrl.startsWith('data:')) {
                        // It's a base64 upload - need to upload to Supabase Storage
                        try {
                            const { processAvatarForSave } = await import('../services/avatarService');
                            const { url, error: avatarError } = await processAvatarForSave(user.id, avatarUrl);
                            if (avatarError) {
                                console.warn('[completeOnboarding] Avatar upload failed:', avatarError);
                                // Continue without avatar rather than failing onboarding
                                avatarUrl = null;
                            } else {
                                avatarUrl = url;
                            }
                        } catch (e) {
                            console.warn('[completeOnboarding] Avatar processing exception:', e);
                            avatarUrl = null;
                        }
                    }

                    const profileData = {
                        id: user.id,
                        email: user.email,
                        partner_code: partnerCode,
                        display_name: onboardingData.displayName,
                        birthday: onboardingData.birthday,
                        avatar_url: avatarUrl,
                        love_language: onboardingData.loveLanguage,
                        communication_style: onboardingData.communicationStyle,
                        conflict_style: onboardingData.conflictStyle,
                        favorite_date_activities: onboardingData.favoriteDateActivities || [],
                        pet_peeves: onboardingData.petPeeves || [],
                        appreciation_style: onboardingData.appreciationStyle,
                        bio: onboardingData.bio || null,
                        onboarding_complete: true,
                        preferred_language: get().preferredLanguage || DEFAULT_LANGUAGE,
                        updated_at: new Date().toISOString(),
                    };

                    console.log('[completeOnboarding] Profile data to save:', profileData);
                    console.log('[completeOnboarding] Calling upsertProfile...');

                    const { data, error } = await upsertProfile(profileData);

                    console.log('[completeOnboarding] upsertProfile returned:', { data, error });

                    if (error) {
                        console.error('[completeOnboarding] Error:', error);
                        return { error: error.message || 'Failed to save profile' };
                    }

                    if (!data) {
                        console.error('[completeOnboarding] No data returned');
                        return { error: 'Failed to save profile - no data returned' };
                    }

                    console.log('[completeOnboarding] Success! Setting state...');
                    set({
                        profile: data,
                        onboardingComplete: true,
                        onboardingStep: 0,
                        onboardingData: {},
                        preferredLanguage: resolvePreferredLanguage(data)
                    });
                    console.log('[completeOnboarding] State set, returning data');
                    return { data };
                } catch (err) {
                    console.error('Exception in completeOnboarding:', err);
                    return { error: err.message || 'An unexpected error occurred' };
                }
            },

            // Refresh profile from database (including partner state)
            refreshProfile: async () => {
                const { user } = get();
                if (!user) return;

                try {
                    // Use profileLoader to load user context
                    const { profile, partner, requests, sent } = await loadUserContext(user, {
                        preferredLanguage: get().preferredLanguage,
                        profileTimeout: 5000
                    });

                    const previousHasPartner = get().hasPartner;

                    set({
                        profile,
                        partner,
                        pendingRequests: requests,
                        sentRequest: profile?.partner_id ? null : sent,
                        hasPartner: !!profile?.partner_id,
                        onboardingComplete: profile?.onboarding_complete || false,
                        preferredLanguage: resolvePreferredLanguage(profile),
                    });

                    // Emit profile updated event
                    eventBus.emit(EVENTS.PROFILE_UPDATED, {
                        userId: user.id,
                        changes: profile
                    });

                    // If partner was just connected, emit partner connected event
                    if (profile?.partner_id && !previousHasPartner) {
                        const partnerProfile = get().partner; // Partner should be loaded by now
                        eventBus.emit(EVENTS.PARTNER_CONNECTED, {
                            userId: user.id,
                            partnerId: profile.partner_id,
                            partnerProfile,
                            anniversary_date: profile.anniversary_date
                        });
                    }

                    console.log('[Auth] Profile refreshed, hasPartner:', !!profile?.partner_id);
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
                        previousLanguage: currentLanguage
                    });
                }

                if (!user) {
                    if (shouldInvalidateCache) {
                        useCacheStore.getState().clearAll();
                    }
                    return;
                }

                try {
                    const { error } = await upsertProfile({
                        id: user.id,
                        preferred_language: normalizedLanguage,
                        updated_at: new Date().toISOString(),
                    });
                    if (error) {
                        console.warn('[Auth] Failed to update language:', error);
                        return;
                    }
                    await get().refreshProfile();
                } catch (err) {
                    console.warn('[Auth] Failed to persist language:', err);
                } finally {
                    if (shouldInvalidateCache) {
                        useCacheStore.getState().clearAll();
                    }
                }
            },

            // Clean up real-time subscriptions
            cleanupRealtimeSubscriptions: () => {
                const { _profileSubscription, _requestsSubscription } = get();

                try {
                    if (_profileSubscription) {
                        console.log('[Auth] Unsubscribing from profile changes');
                        supabase.removeChannel(_profileSubscription);
                    }
                    if (_requestsSubscription) {
                        console.log('[Auth] Unsubscribing from partner requests');
                        supabase.removeChannel(_requestsSubscription);
                    }
                } catch (error) {
                    console.warn('[Auth] Error cleaning up subscriptions:', error);
                }

                set({
                    _profileSubscription: null,
                    _requestsSubscription: null
                });
            },

            // Set up real-time subscriptions for partner connection updates
            setupRealtimeSubscriptions: () => {
                const { user } = get();
                if (!user) return null;

                console.log('[Auth] Setting up realtime subscriptions for user:', user.id);

                // Clean up any existing subscriptions first to prevent memory leaks
                get().cleanupRealtimeSubscriptions();

                try {
                    // Subscribe to profile changes (to detect when partner accepts)
                    const profileSub = subscribeToProfileChanges(user.id, (payload) => {
                        console.log('[Auth] Profile changed:', payload);
                        const newProfile = payload.new;

                        // If partner_id just became set, refresh to get partner details
                        if (newProfile?.partner_id && !get().hasPartner) {
                            console.log('[Auth] Partner connected! Refreshing profile...');
                            get().refreshProfile();
                        }
                    });

                    // Subscribe to partner requests (to detect new incoming requests)
                    const requestsSub = subscribeToPartnerRequests(user.id, (payload) => {
                        console.log('[Auth] Partner request changed:', payload);
                        get().refreshPendingRequests();
                    });

                    // Store subscription references in state for cleanup
                    set({
                        _profileSubscription: profileSub,
                        _requestsSubscription: requestsSub
                    });

                    console.log('[Auth] Realtime subscriptions established');
                    return { profileSub, requestsSub };
                } catch (error) {
                    console.error('[Auth] Error setting up realtime subscriptions:', error);
                    return null;
                }
            },

            // Clean up all resources (called on app unmount)
            cleanup: () => {
                console.log('[Auth] Cleaning up all resources');

                // Clear all pending timeouts
                pendingTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
                pendingTimeouts.clear();

                // Clean up realtime subscriptions
                get().cleanupRealtimeSubscriptions();
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
                partner: state.partner
                    ? {
                        ...state.partner,
                        avatar_url:
                            typeof state.partner.avatar_url === 'string' &&
                                (state.partner.avatar_url.startsWith('data:') || state.partner.avatar_url.length > 2048)
                                ? undefined
                                : state.partner.avatar_url,
                    }
                    : null,
                hasPartner: state.hasPartner,
                onboardingComplete: state.onboardingComplete,
                // Onboarding data sometimes contains avatarUrl (base64). Persist only small bits.
                onboardingData: state.onboardingData
                    ? {
                        ...state.onboardingData,
                        avatarUrl:
                            typeof state.onboardingData.avatarUrl === 'string' &&
                                (state.onboardingData.avatarUrl.startsWith('data:') || state.onboardingData.avatarUrl.length > 2048)
                                ? undefined
                                : state.onboardingData.avatarUrl,
                    }
                    : {},
                onboardingStep: state.onboardingStep,
                preferredLanguage: state.preferredLanguage,
                // Note: _profileSubscription and _requestsSubscription are intentionally excluded
            }),
        }
    )
);

export default useAuthStore;
