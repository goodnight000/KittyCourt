import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
import { readSessionBackup, writeSessionBackup, clearSessionBackup } from '../services/authSessionBackup';
import useSubscriptionStore from './useSubscriptionStore';
import { logOutUser as revenueCatLogOut } from '../services/revenuecat';

const AUTH_PROFILE_TIMEOUT_MS = 5000;
const AUTH_REQUESTS_TIMEOUT_MS = 5000;

let initializePromise = null;
let authListenerSubscription = null;

const withTimeout = (promise, timeoutMs, label) => {
    if (!timeoutMs) return promise;
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`[Auth] ${label} timed out after ${timeoutMs}ms`)), timeoutMs)
        )
    ]);
};

const loadAuthContext = async (user) => {
    let profile = null;
    try {
        const profileResult = await withTimeout(getProfile(user.id), AUTH_PROFILE_TIMEOUT_MS, 'getProfile');
        const { data: profileData, error: profileError } = profileResult || {};

        if (profileData) {
            profile = profileData;
        } else if (profileError?.code === 'PGRST116') {
            const partnerCode = generatePartnerCode();
            const { data: newProfile, error: createError } = await upsertProfile({
                id: user.id,
                email: user.email,
                partner_code: partnerCode,
                onboarding_complete: false,
                created_at: new Date().toISOString(),
            });

            if (!createError) {
                profile = newProfile;
            }
        }
    } catch (e) {
        console.warn('[Auth] Failed to load profile:', e);
    }

    let partner = null;
    if (profile?.partner_id) {
        try {
            const partnerResult = await withTimeout(getProfile(profile.partner_id), AUTH_PROFILE_TIMEOUT_MS, 'getPartnerProfile');
            partner = partnerResult?.data || null;
        } catch (e) {
            console.warn('[Auth] Failed to load partner profile:', e);
        }
    }

    let requests = [];
    let sent = null;
    try {
        const pendingResult = await withTimeout(getPendingRequests(), AUTH_REQUESTS_TIMEOUT_MS, 'getPendingRequests');
        requests = pendingResult?.data || [];
    } catch {
        // Non-critical on boot; ignore.
    }

    try {
        const sentResult = await withTimeout(getSentRequest(), AUTH_REQUESTS_TIMEOUT_MS, 'getSentRequest');
        sent = sentResult?.data || null;
    } catch {
        // Non-critical on boot; ignore.
    }

    return { profile, partner, requests, sent };
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

            // Partner state
            partner: null,
            pendingRequests: [],
            sentRequest: null,
            hasPartner: false,

            // Onboarding state
            onboardingComplete: false,
            onboardingStep: 0,
            onboardingData: {},

            handleSupabaseAuthEvent: async (event, session) => {
                const sessionUser = session?.user || null;
                console.log('[Auth] Auth state change:', event, sessionUser?.id);

                if (event === 'SIGNED_OUT') {
                    useSubscriptionStore.getState().reset();
                    revenueCatLogOut();
                    set({
                        user: null,
                        session: null,
                        profile: null,
                        partner: null,
                        pendingRequests: [],
                        sentRequest: null,
                        hasPartner: false,
                        isAuthenticated: false,
                        onboardingComplete: false,
                        onboardingStep: 0,
                        onboardingData: {},
                        isLoading: false
                    });
                    return;
                }

                if (event === 'TOKEN_REFRESHED') {
                    if (session) set({ session });
                    return;
                }

                if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && sessionUser) {
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
                            onboardingData: {}
                        });
                    }

                    set({
                        user: sessionUser,
                        session,
                        isAuthenticated: true
                    });

                    const cachedProfile = get().profile;
                    if (cachedProfile?.id === sessionUser.id) {
                        set({
                            hasPartner: !!cachedProfile.partner_id,
                            onboardingComplete: !!cachedProfile.onboarding_complete,
                        });

                        setTimeout(() => {
                            get().refreshProfile();
                            get().refreshPendingRequests();
                            get().setupRealtimeSubscriptions();
                        }, 0);
                        return;
                    }

                    try {
                        const { profile, partner, requests, sent } = await loadAuthContext(sessionUser);
                        const stateAfterHydrate = get();
                        set({
                            profile,
                            partner,
                            pendingRequests: requests,
                            sentRequest: sent,
                            hasPartner: profile ? !!profile.partner_id : stateAfterHydrate.hasPartner,
                            onboardingComplete: profile ? !!profile.onboarding_complete : stateAfterHydrate.onboardingComplete,
                        });

                        // Initialize subscription store after auth
                        setTimeout(() => {
                            useSubscriptionStore.getState().initialize(sessionUser.id);
                            get().setupRealtimeSubscriptions();
                        }, 100);
                    } catch (e) {
                        console.warn('[Auth] Failed to hydrate user context:', e);
                    }
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
                        await get().handleSupabaseAuthEvent('INITIAL_SESSION', session);
                    } else {
                        set({
                            user: null,
                            session: null,
                            profile: null,
                            partner: null,
                            pendingRequests: [],
                            sentRequest: null,
                            hasPartner: false,
                            isAuthenticated: false,
                            onboardingComplete: false,
                            onboardingStep: 0,
                            onboardingData: {},
                            isLoading: false
                        });
                    }

                    set({ isLoading: false });
                })().catch((error) => {
                    console.error('[Auth] Initialization error:', error);
                    set({ isLoading: false });
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

                    // Fetch profile - don't fail sign-in if profile fetch fails
                    let profile = null;
                    let partner = null;
                    try {
                        console.log('[Auth] Fetching profile for user:', data.user.id);

                        // Add timeout to prevent hanging if Supabase is slow
                        const timeoutPromise = new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
                        );

                        const profileResult = await Promise.race([
                            getProfile(data.user.id),
                            timeoutPromise
                        ]).catch(err => {
                            console.warn('[Auth] Profile fetch timed out or failed:', err.message);
                            return { data: null, error: err };
                        });

                        const { data: profileData, error: profileError } = profileResult;
                        console.log('[Auth] Profile fetch result:', { profileData, profileError });

                        if (profileError) {
                            console.warn('[Auth] Failed to fetch profile:', profileError);
                            // If profile doesn't exist, create one
                            if (profileError.code === 'PGRST116') {
                                console.log('[Auth] No profile found, creating one...');
                                const partnerCode = generatePartnerCode();
                                const { data: newProfile, error: createError } = await upsertProfile({
                                    id: data.user.id,
                                    email: data.user.email,
                                    partner_code: partnerCode,
                                    onboarding_complete: false,
                                    created_at: new Date().toISOString(),
                                });
                                if (createError) {
                                    console.error('[Auth] Failed to create profile:', createError);
                                } else {
                                    profile = newProfile;
                                    console.log('[Auth] Created new profile:', profile);
                                }
                            }
                        } else {
                            profile = profileData;
                        }

                        // Get partner if connected
                        if (profile?.partner_id) {
                            try {
                                const { data: partnerData } = await getPartnerProfile();
                                partner = partnerData;
                            } catch (e) {
                                console.warn('[Auth] Failed to fetch partner profile:', e);
                            }
                        }
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
                        isLoading: false
                    });

                    // Set up real-time subscriptions and initialize subscription store
                    setTimeout(() => {
                        useSubscriptionStore.getState().initialize(data.user.id);
                        get().setupRealtimeSubscriptions();
                    }, 100);

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
                    });
                }

                set({
                    user: data.user,
                    session: data.session,
                    isAuthenticated: true,
                    onboardingComplete: false,
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
                set({ isLoading: true });
                useSubscriptionStore.getState().reset();
                revenueCatLogOut();
                await supabaseSignOut();
                set({
                    user: null,
                    session: null,
                    profile: null,
                    partner: null,
                    pendingRequests: [],
                    sentRequest: null,
                    hasPartner: false,
                    isAuthenticated: false,
                    onboardingComplete: false,
                    onboardingStep: 0,
                    onboardingData: {},
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

                    const profileData = {
                        id: user.id,
                        email: user.email,
                        partner_code: partnerCode,
                        display_name: onboardingData.displayName,
                        birthday: onboardingData.birthday,
                        avatar_url: onboardingData.avatarUrl || null,
                        love_language: onboardingData.loveLanguage,
                        communication_style: onboardingData.communicationStyle,
                        conflict_style: onboardingData.conflictStyle,
                        favorite_date_activities: onboardingData.favoriteDateActivities || [],
                        pet_peeves: onboardingData.petPeeves || [],
                        appreciation_style: onboardingData.appreciationStyle,
                        bio: onboardingData.bio || null,
                        onboarding_complete: true,
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
                        onboardingData: {}
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
                    const { data: profile } = await getProfile(user.id);

                    // Check if partner was just connected
                    let partner = null;
                    if (profile?.partner_id) {
                        const { data: partnerData } = await getPartnerProfile();
                        partner = partnerData;
                    }

                    set({
                        profile,
                        partner,
                        hasPartner: !!profile?.partner_id,
                        onboardingComplete: profile?.onboarding_complete || false,
                        sentRequest: profile?.partner_id ? null : get().sentRequest // Clear sent request if connected
                    });

                    console.log('[Auth] Profile refreshed, hasPartner:', !!profile?.partner_id);
                } catch (e) {
                    console.warn('[Auth] Failed to refresh profile:', e);
                }
            },

            // Set up real-time subscriptions for partner connection updates
            setupRealtimeSubscriptions: () => {
                const { user } = get();
                if (!user) return null;

                console.log('[Auth] Setting up realtime subscriptions for user:', user.id);

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

                return { profileSub, requestsSub };
            },
        }),
        {
            name: 'catjudge-auth',
            partialize: (state) => ({
                // Persist non-secret UI state to avoid blocking on network at boot.
                profile: state.profile,
                partner: state.partner,
                hasPartner: state.hasPartner,
                onboardingComplete: state.onboardingComplete,
                onboardingData: state.onboardingData,
                onboardingStep: state.onboardingStep,
            }),
        }
    )
);

export default useAuthStore;
