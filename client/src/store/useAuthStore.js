import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
    supabase, 
    signInWithEmail, 
    signUpWithEmail, 
    signInWithGoogle, 
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
    subscribeToPartnerRequests
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
                // Prevent multiple simultaneous initializations
                if (get().isLoading === false) {
                    console.log('[Auth] Already initialized, skipping...');
                    return;
                }
                
                set({ isLoading: true });
                
                // Add a timeout to prevent infinite loading
                const timeoutId = setTimeout(() => {
                    console.error('[Auth] Initialization timed out after 10s');
                    set({ 
                        isLoading: false, 
                        isAuthenticated: false,
                        user: null,
                        session: null,
                        profile: null
                    });
                }, 10000);
                
                try {
                    console.log('[Auth] Starting initialization...');
                    const { session, error: sessionError } = await getSession();
                    
                    clearTimeout(timeoutId);
                    
                    if (sessionError) {
                        console.error('[Auth] Session error:', sessionError);
                        set({ isLoading: false, isAuthenticated: false });
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
                            isLoading: false 
                        });
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
                            isLoading: false 
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
                        profile: null
                    });
                }
            },

            // Sign in with email/password
            signIn: async (email, password) => {
                set({ isLoading: true });
                const { data, error } = await signInWithEmail(email, password);
                if (error) {
                    set({ isLoading: false });
                    return { error };
                }
                
                const { data: profile } = await getProfile(data.user.id);
                set({ 
                    user: data.user, 
                    session: data.session,
                    profile,
                    isAuthenticated: true,
                    onboardingComplete: profile?.onboarding_complete || false,
                    isLoading: false 
                });
                return { data };
            },

            // Sign up with email/password
            signUp: async (email, password) => {
                set({ isLoading: true });
                const { data, error } = await signUpWithEmail(email, password);
                if (error) {
                    set({ isLoading: false });
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
            signInWithGoogle: async () => {
                set({ isLoading: true });
                const { data, error } = await signInWithGoogle();
                if (error) {
                    set({ isLoading: false });
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
            acceptRequest: async (requestId) => {
                const { data: profile, error } = await acceptPartnerRequest(requestId);
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

            // Refresh profile from database
            refreshProfile: async () => {
                const { user } = get();
                if (!user) return;
                
                const { data: profile } = await getProfile(user.id);
                set({ 
                    profile,
                    onboardingComplete: profile?.onboarding_complete || false
                });
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
    
    if (event === 'SIGNED_IN' && session?.user) {
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
            const { data: partnerData } = await getPartnerProfile();
            partner = partnerData;
        }

        // Get pending requests
        const { data: requests } = await getPendingRequests();
        
        // Get sent request
        const { data: sent } = await getSentRequest();
        
        useAuthStore.setState({ 
            user: session.user, 
            session,
            profile,
            partner,
            pendingRequests: requests || [],
            sentRequest: sent,
            hasPartner: !!profile?.partner_id,
            isAuthenticated: true,
            onboardingComplete: profile?.onboarding_complete || false,
            isLoading: false
        });
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
    }
});

export default useAuthStore;
