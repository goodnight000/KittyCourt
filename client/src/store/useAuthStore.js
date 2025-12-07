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

            // Initialize auth state on app load
            initialize: async () => {
                const state = get();
                // Prevent multiple simultaneous initializations if already authenticated
                if (state.isAuthenticated) {
                    console.log('[Auth] Already authenticated, skipping init...');
                    return;
                }

                // Allow initialization to proceed even if isLoading is true (default state)
                // We rely on the timeout and session check to manage state

                set({ isLoading: true });

                // Add a timeout to prevent infinite loading
                const timeoutId = setTimeout(() => {
                    console.error('[Auth] Initialization timed out after 10s');
                    set({
                        isLoading: false,
                        isAuthenticated: false,
                        user: null,
                        session: null,
                        profile: null,
                        initTimeout: null
                    });
                }, 10000);

                set({ initTimeout: timeoutId });

                try {
                    console.log('[Auth] Starting initialization...');
                    const { session, error: sessionError } = await getSession();

                    if (sessionError) {
                        console.error('[Auth] Session error:', sessionError);
                        clearTimeout(timeoutId);
                        set({ isLoading: false, isAuthenticated: false, initTimeout: null });
                        return;
                    }

                    console.log('[Auth] Session:', session ? 'exists' : 'none');

                    if (session?.user) {
                        // Try to get profile (might not exist yet for new OAuth users)
                        let profile = null;
                        try {
                            const { data: profileData } = await getProfile(session.user.id);
                            profile = profileData;
                        } catch (e) {
                            console.warn('Failed to fetch profile:', e);
                        }

                        // Get partner if connected
                        let partner = null;
                        if (profile?.partner_id) {
                            try {
                                const { data: partnerData } = await getPartnerProfile();
                                partner = partnerData;
                            } catch (e) {
                                console.warn('Failed to fetch partner profile:', e);
                            }
                        }

                        // Get pending requests (wrapped in try-catch in case table doesn't exist yet)
                        let requests = [];
                        let sent = null;
                        try {
                            const { data: requestsData } = await getPendingRequests();
                            requests = requestsData || [];
                        } catch (e) {
                            console.warn('Failed to fetch pending requests:', e);
                        }

                        try {
                            const { data: sentData } = await getSentRequest();
                            sent = sentData;
                        } catch (e) {
                            console.warn('Failed to fetch sent request:', e);
                        }

                        clearTimeout(timeoutId);
                        set({
                            user: session.user,
                            session,
                            profile,
                            partner,
                            pendingRequests: requests,
                            sentRequest: sent,
                            hasPartner: !!profile?.partner_id,
                            isAuthenticated: true,
                            onboardingComplete: profile?.onboarding_complete || false,
                            isLoading: false,
                            initTimeout: null
                        });

                        // Set up real-time subscriptions after authentication
                        setTimeout(() => {
                            get().setupRealtimeSubscriptions();
                        }, 100);
                    } else {
                        clearTimeout(timeoutId);
                        set({
                            user: null,
                            session: null,
                            profile: null,
                            partner: null,
                            pendingRequests: [],
                            sentRequest: null,
                            hasPartner: false,
                            isAuthenticated: false,
                            isLoading: false,
                            initTimeout: null
                        });
                    }
                } catch (error) {
                    clearTimeout(timeoutId);
                    console.error('Auth initialization error:', error);
                    // Ensure loading is set to false even on error
                    set({
                        isLoading: false,
                        isAuthenticated: false,
                        user: null,
                        session: null,
                        profile: null,
                        initTimeout: null
                    });
                }
            },

            // Sign in with email/password
            // Note: Does NOT set global isLoading to avoid showing LoadingScreen during auth
            signIn: async (email, password) => {
                try {
                    console.log('[Auth] signIn called with email:', email);
                    const { data, error } = await supabaseSignInWithEmail(email, password);
                    if (error) {
                        console.error('[Auth] Sign in error:', error);
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

                    // Set up real-time subscriptions
                    setTimeout(() => {
                        get().setupRealtimeSubscriptions();
                    }, 100);

                    console.log('[Auth] State set complete, returning success');
                    return { data };
                } catch (e) {
                    console.error('[Auth] Sign in exception:', e);
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

                // Find user by partner code
                const { data: targetUser, error: findError } = await findByPartnerCode(partnerCode);
                if (findError || !targetUser) {
                    return { error: 'Partner code not found. Please check and try again.' };
                }

                // Check if target already has a partner
                if (targetUser.partner_id) {
                    return { error: 'This user is already connected with someone.' };
                }

                // Send the request
                const { data, error } = await sendPartnerRequest(targetUser.id);
                if (error) {
                    return { error: error.message || error };
                }

                set({ sentRequest: { ...data, receiver: targetUser } });
                return { data, receiverName: targetUser.display_name };
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
                // Only persist these fields
                onboardingData: state.onboardingData,
                onboardingStep: state.onboardingStep,
            }),
        }
    )
);

// Listen for auth state changes
supabase.auth.onAuthStateChange(async (event, session) => {
    const store = useAuthStore.getState();
    console.log('[Auth] Auth state change:', event, session?.user?.id);

    if (event === 'SIGNED_IN' && session?.user) {
        // If we're already authenticated with this user, skip re-processing
        // This prevents the duplicate loading when signIn() already handled everything
        if (store.isAuthenticated && store.user?.id === session.user.id) {
            console.log('[Auth] Already authenticated with this user, skipping duplicate processing');
            return;
        }

        // Only set loading for OAuth callbacks where we haven't processed yet
        // Don't set isLoading to avoid showing LoadingScreen during transition
        // useAuthStore.setState({ isLoading: true });

        try {
            // Check if profile exists, create one if not (for OAuth)
            let { data: profile } = await getProfile(session.user.id);

            if (!profile) {
                // First time OAuth sign-in, create profile
                const partnerCode = generatePartnerCode();
                const { data: newProfile } = await upsertProfile({
                    id: session.user.id,
                    email: session.user.email,
                    partner_code: partnerCode,
                    onboarding_complete: false,
                    created_at: new Date().toISOString(),
                });
                profile = newProfile;
            }

            // Get partner if connected
            let partner = null;
            if (profile?.partner_id) {
                try {
                    const { data: partnerData } = await getPartnerProfile();
                    partner = partnerData;
                } catch (e) {
                    console.warn('Failed to fetch partner profile:', e);
                }
            }

            // Get pending requests
            let requests = [];
            try {
                const { data: requestsData } = await getPendingRequests();
                requests = requestsData || [];
            } catch (e) {
                console.warn('Failed to fetch pending requests:', e);
            }

            // Get sent request
            let sent = null;
            try {
                const { data: sentData } = await getSentRequest();
                sent = sentData;
            } catch (e) {
                console.warn('Failed to fetch sent request:', e);
            }

            useAuthStore.setState({
                user: session.user,
                session,
                profile,
                partner,
                pendingRequests: requests,
                sentRequest: sent,
                hasPartner: !!profile?.partner_id,
                isAuthenticated: true,
                onboardingComplete: profile?.onboarding_complete || false,
                isLoading: false
            });

            // Set up real-time subscriptions
            setTimeout(() => {
                useAuthStore.getState().setupRealtimeSubscriptions();
            }, 100);
        } catch (error) {
            console.error('[Auth] Error in auth state change:', error);
            // Even on error, set auth true if we have a user
            useAuthStore.setState({
                isLoading: false,
                isAuthenticated: true,
                user: session.user,
                session
            });
        }
    } else if (event === 'SIGNED_OUT') {
        useAuthStore.setState({
            user: null,
            session: null,
            profile: null,
            partner: null,
            pendingRequests: [],
            sentRequest: null,
            hasPartner: false,
            isAuthenticated: false,
            onboardingComplete: false,
            isLoading: false
        });
    } else if (event === 'TOKEN_REFRESHED') {
        // Session was refreshed, update the session in state
        console.log('[Auth] Token refreshed');
        if (session) {
            useAuthStore.setState({ session });
        }
    }
});

export default useAuthStore;
