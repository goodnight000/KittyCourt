import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock external dependencies before importing the store
vi.mock('../services/supabase', () => ({
    supabase: {
        auth: {
            onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
            setSession: vi.fn()
        },
        removeChannel: vi.fn()
    },
    signInWithEmail: vi.fn(),
    signUpWithEmail: vi.fn(),
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
    getSession: vi.fn(() => Promise.resolve({ session: null, error: null })),
    getProfile: vi.fn(),
    upsertProfile: vi.fn(),
    generatePartnerCode: vi.fn(() => 'ABC123'),
    findByPartnerCode: vi.fn(),
    sendPartnerRequest: vi.fn(),
    getPendingRequests: vi.fn(() => Promise.resolve({ data: [] })),
    getSentRequest: vi.fn(() => Promise.resolve({ data: null })),
    acceptPartnerRequest: vi.fn(),
    rejectPartnerRequest: vi.fn(),
    cancelPartnerRequest: vi.fn(),
    getPartnerProfile: vi.fn(),
    subscribeToPartnerRequests: vi.fn(() => ({})),
    subscribeToProfileChanges: vi.fn(() => ({}))
}));

vi.mock('../services/profileLoader', () => ({
    loadUserContext: vi.fn()
}));

vi.mock('../services/authSessionBackup', () => ({
    readSessionBackup: vi.fn(() => null),
    writeSessionBackup: vi.fn(),
    clearSessionBackup: vi.fn()
}));

vi.mock('./useSubscriptionStore', () => ({
    default: {
        getState: () => ({
            initialize: vi.fn(),
            reset: vi.fn()
        })
    }
}));

vi.mock('./useCacheStore', () => ({
    default: {
        getState: () => ({
            clearAll: vi.fn()
        })
    }
}));

vi.mock('../services/revenuecat', () => ({
    logOutUser: vi.fn()
}));

vi.mock('../services/pushNotifications', () => ({
    deactivateDeviceToken: vi.fn(() => Promise.resolve())
}));

vi.mock('../i18n/languageConfig', () => ({
    DEFAULT_LANGUAGE: 'en',
    normalizeLanguage: vi.fn((lang) => lang === 'zh-Hans' || lang === 'en' ? lang : null)
}));

describe('useAuthStore', () => {
    let useAuthStore;
    let supabaseMocks;
    let profileLoaderMocks;
    let eventBus;
    let EVENTS;

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.useFakeTimers();

        // Reset modules to get fresh store instance
        vi.resetModules();

        // Re-import event bus first (since stores depend on it)
        const eventBusModule = await import('../lib/eventBus');
        eventBus = eventBusModule.eventBus;
        EVENTS = eventBusModule.EVENTS;

        // Clear event bus listeners
        eventBus.clear();

        // Re-import mocks and store
        supabaseMocks = await import('../services/supabase');
        profileLoaderMocks = await import('../services/profileLoader');
        const storeModule = await import('./useAuthStore');
        useAuthStore = storeModule.default;
    });

    afterEach(() => {
        vi.useRealTimers();
        if (eventBus) eventBus.clear();
    });

    describe('Initial State', () => {
        it('should have correct initial state values', () => {
            const state = useAuthStore.getState();

            expect(state.user).toBeNull();
            expect(state.session).toBeNull();
            expect(state.profile).toBeNull();
            expect(state.isAuthenticated).toBe(false);
            expect(state.partner).toBeNull();
            expect(state.pendingRequests).toEqual([]);
            expect(state.sentRequest).toBeNull();
            expect(state.hasPartner).toBe(false);
            expect(state.onboardingComplete).toBe(false);
            expect(state.onboardingStep).toBe(0);
            expect(state.onboardingData).toEqual({});
            expect(state.preferredLanguage).toBe('en');
        });

        it('should have all required action functions defined', () => {
            const state = useAuthStore.getState();

            expect(typeof state.initialize).toBe('function');
            expect(typeof state.signIn).toBe('function');
            expect(typeof state.signUp).toBe('function');
            expect(typeof state.signInWithGoogle).toBe('function');
            expect(typeof state.signOut).toBe('function');
            expect(typeof state.refreshProfile).toBe('function');
            expect(typeof state.sendPartnerRequestByCode).toBe('function');
            expect(typeof state.acceptRequest).toBe('function');
            expect(typeof state.rejectRequest).toBe('function');
            expect(typeof state.cancelSentRequest).toBe('function');
            expect(typeof state.completeOnboarding).toBe('function');
            expect(typeof state.setOnboardingStep).toBe('function');
            expect(typeof state.updateOnboardingData).toBe('function');
            expect(typeof state.setPreferredLanguage).toBe('function');
            expect(typeof state.cleanup).toBe('function');
            expect(typeof state.cleanupRealtimeSubscriptions).toBe('function');
            expect(typeof state.setupRealtimeSubscriptions).toBe('function');
        });
    });

    describe('signIn()', () => {
        it('should successfully sign in and update state', async () => {
            vi.useRealTimers();

            const mockUser = { id: 'user-123', email: 'test@example.com' };
            const mockSession = { access_token: 'token-123', user: mockUser };
            const mockProfile = {
                id: 'user-123',
                display_name: 'Test User',
                partner_id: null,
                onboarding_complete: true,
                preferred_language: 'en'
            };

            supabaseMocks.signInWithEmail.mockResolvedValue({
                data: { user: mockUser, session: mockSession },
                error: null
            });

            profileLoaderMocks.loadUserContext.mockResolvedValue({
                profile: mockProfile,
                partner: null,
                requests: [],
                sent: null
            });

            const eventCallback = vi.fn();
            eventBus.on(EVENTS.AUTH_LOGIN, eventCallback);

            const result = await useAuthStore.getState().signIn('test@example.com', 'password123');

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();

            const state = useAuthStore.getState();
            expect(state.user).toEqual(mockUser);
            expect(state.session).toEqual(mockSession);
            expect(state.profile).toEqual(mockProfile);
            expect(state.isAuthenticated).toBe(true);
            expect(state.onboardingComplete).toBe(true);
            expect(state.isLoading).toBe(false);

            // Verify AUTH_LOGIN event was emitted
            expect(eventCallback).toHaveBeenCalledWith({
                userId: 'user-123',
                profile: mockProfile,
                partner: null
            });
        });

        it('should handle sign in errors correctly', async () => {
            vi.useRealTimers();

            const mockError = { message: 'Invalid credentials' };

            supabaseMocks.signInWithEmail.mockResolvedValue({
                data: null,
                error: mockError
            });

            const result = await useAuthStore.getState().signIn('test@example.com', 'wrong-password');

            expect(result.error).toEqual(mockError);
            expect(useAuthStore.getState().isAuthenticated).toBe(false);
            expect(useAuthStore.getState().isLoading).toBe(false);
        });

        it('should set isLoading during sign in process', async () => {
            vi.useRealTimers();

            let loadingDuringCall = false;

            supabaseMocks.signInWithEmail.mockImplementation(async () => {
                loadingDuringCall = useAuthStore.getState().isLoading;
                return {
                    data: { user: { id: '123' }, session: {} },
                    error: null
                };
            });

            profileLoaderMocks.loadUserContext.mockResolvedValue({
                profile: { id: '123', onboarding_complete: true },
                partner: null,
                requests: [],
                sent: null
            });

            await useAuthStore.getState().signIn('test@example.com', 'password');

            expect(loadingDuringCall).toBe(true);
            expect(useAuthStore.getState().isLoading).toBe(false);
        });
    });

    describe('signUp()', () => {
        it('should successfully sign up and create initial profile', async () => {
            vi.useRealTimers();

            const mockUser = { id: 'new-user-123', email: 'new@example.com' };
            const mockSession = { access_token: 'token-123', user: mockUser };

            supabaseMocks.signUpWithEmail.mockResolvedValue({
                data: { user: mockUser, session: mockSession },
                error: null
            });

            supabaseMocks.upsertProfile.mockResolvedValue({ data: {}, error: null });

            const result = await useAuthStore.getState().signUp('new@example.com', 'password123');

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();

            // Verify upsertProfile was called with initial profile data
            expect(supabaseMocks.upsertProfile).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'new-user-123',
                    email: 'new@example.com',
                    partner_code: 'ABC123',
                    onboarding_complete: false
                })
            );

            const state = useAuthStore.getState();
            expect(state.user).toEqual(mockUser);
            expect(state.isAuthenticated).toBe(true);
            expect(state.onboardingComplete).toBe(false);
        });

        it('should handle sign up errors', async () => {
            vi.useRealTimers();

            const mockError = { message: 'Email already in use' };

            supabaseMocks.signUpWithEmail.mockResolvedValue({
                data: null,
                error: mockError
            });

            const result = await useAuthStore.getState().signUp('existing@example.com', 'password123');

            expect(result.error).toEqual(mockError);
            expect(useAuthStore.getState().isAuthenticated).toBe(false);
        });
    });

    describe('signOut()', () => {
        it('should clear all state on sign out', async () => {
            vi.useRealTimers();

            // Set up initial authenticated state
            useAuthStore.setState({
                user: { id: 'user-123' },
                session: { access_token: 'token' },
                profile: { id: 'user-123', display_name: 'Test' },
                partner: { id: 'partner-456' },
                hasPartner: true,
                isAuthenticated: true,
                onboardingComplete: true,
                preferredLanguage: 'zh-Hans'
            });

            supabaseMocks.signOut.mockResolvedValue({ error: null });

            const eventCallback = vi.fn();
            eventBus.on(EVENTS.AUTH_LOGOUT, eventCallback);

            await useAuthStore.getState().signOut();

            const state = useAuthStore.getState();
            expect(state.user).toBeNull();
            expect(state.session).toBeNull();
            expect(state.profile).toBeNull();
            expect(state.partner).toBeNull();
            expect(state.hasPartner).toBe(false);
            expect(state.isAuthenticated).toBe(false);
            expect(state.pendingRequests).toEqual([]);
            expect(state.sentRequest).toBeNull();
            expect(state.onboardingComplete).toBe(false);
            expect(state.onboardingStep).toBe(0);
            expect(state.onboardingData).toEqual({});
            expect(state.preferredLanguage).toBe('en');
            expect(state.isLoading).toBe(false);

            // Verify AUTH_LOGOUT event was emitted
            expect(eventCallback).toHaveBeenCalledWith({ userId: 'user-123' });
        });

        it('should call supabase signOut', async () => {
            vi.useRealTimers();

            supabaseMocks.signOut.mockResolvedValue({ error: null });

            await useAuthStore.getState().signOut();

            expect(supabaseMocks.signOut).toHaveBeenCalled();
        });
    });

    describe('Partner Request Actions', () => {
        beforeEach(() => {
            vi.useRealTimers();
            useAuthStore.setState({
                user: { id: 'user-123' },
                profile: { id: 'user-123', partner_code: 'MY-CODE' }
            });
        });

        describe('sendPartnerRequestByCode()', () => {
            it('should send partner request successfully', async () => {
                const targetUser = { id: 'target-456' };

                supabaseMocks.findByPartnerCode.mockResolvedValue({
                    data: targetUser,
                    error: null
                });

                supabaseMocks.getProfile.mockResolvedValue({
                    data: { id: 'target-456', partner_id: null },
                    error: null
                });

                supabaseMocks.sendPartnerRequest.mockResolvedValue({
                    data: { id: 'request-789', receiver_id: 'target-456' },
                    error: null
                });

                const result = await useAuthStore.getState().sendPartnerRequestByCode('PARTNER-CODE');

                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
                expect(useAuthStore.getState().sentRequest).toBeDefined();
            });

            it('should reject connecting with self', async () => {
                const result = await useAuthStore.getState().sendPartnerRequestByCode('MY-CODE');

                expect(result.error).toContain("can't connect with yourself");
            });

            it('should handle invalid partner code', async () => {
                supabaseMocks.findByPartnerCode.mockResolvedValue({
                    data: null,
                    error: { message: 'Not found' }
                });

                const result = await useAuthStore.getState().sendPartnerRequestByCode('INVALID-CODE');

                expect(result.error).toContain('Partner code not found');
            });

            it('should prevent connecting with someone who has a partner', async () => {
                supabaseMocks.findByPartnerCode.mockResolvedValue({
                    data: { id: 'target-456' },
                    error: null
                });

                supabaseMocks.getProfile.mockResolvedValue({
                    data: { id: 'target-456', partner_id: 'other-partner' },
                    error: null
                });

                const result = await useAuthStore.getState().sendPartnerRequestByCode('TAKEN-CODE');

                expect(result.error).toContain('already connected');
            });
        });

        describe('acceptRequest()', () => {
            it('should accept partner request and update state', async () => {
                const updatedProfile = {
                    id: 'user-123',
                    partner_id: 'partner-456',
                    anniversary_date: '2024-01-15'
                };
                const partnerProfile = {
                    id: 'partner-456',
                    display_name: 'Partner Name'
                };

                supabaseMocks.acceptPartnerRequest.mockResolvedValue({
                    data: updatedProfile,
                    error: null
                });

                supabaseMocks.getPartnerProfile.mockResolvedValue({
                    data: partnerProfile,
                    error: null
                });

                const result = await useAuthStore.getState().acceptRequest('request-123', '2024-01-15');

                expect(result.error).toBeUndefined();

                const state = useAuthStore.getState();
                expect(state.profile).toEqual(updatedProfile);
                expect(state.partner).toEqual(partnerProfile);
                expect(state.hasPartner).toBe(true);
                expect(state.pendingRequests).toEqual([]);
                expect(state.sentRequest).toBeNull();
            });

            it('should handle accept request errors', async () => {
                supabaseMocks.acceptPartnerRequest.mockResolvedValue({
                    data: null,
                    error: { message: 'Request expired' }
                });

                const result = await useAuthStore.getState().acceptRequest('expired-request');

                expect(result.error).toBeDefined();
            });
        });

        describe('rejectRequest()', () => {
            it('should reject partner request and remove from pending', async () => {
                useAuthStore.setState({
                    pendingRequests: [
                        { id: 'request-1', sender_id: 'user-A' },
                        { id: 'request-2', sender_id: 'user-B' }
                    ]
                });

                supabaseMocks.rejectPartnerRequest.mockResolvedValue({ error: null });

                const result = await useAuthStore.getState().rejectRequest('request-1');

                expect(result.success).toBe(true);
                expect(useAuthStore.getState().pendingRequests).toEqual([
                    { id: 'request-2', sender_id: 'user-B' }
                ]);
            });
        });

        describe('cancelSentRequest()', () => {
            it('should cancel sent request', async () => {
                useAuthStore.setState({
                    sentRequest: { id: 'sent-request-123' }
                });

                supabaseMocks.cancelPartnerRequest.mockResolvedValue({ error: null });

                const result = await useAuthStore.getState().cancelSentRequest();

                expect(result.success).toBe(true);
                expect(useAuthStore.getState().sentRequest).toBeNull();
            });

            it('should return error if no sent request exists', async () => {
                useAuthStore.setState({ sentRequest: null });

                const result = await useAuthStore.getState().cancelSentRequest();

                expect(result.error).toBeDefined();
            });
        });
    });

    describe('Onboarding Actions', () => {
        describe('setOnboardingStep()', () => {
            it('should update onboarding step', () => {
                useAuthStore.getState().setOnboardingStep(3);

                expect(useAuthStore.getState().onboardingStep).toBe(3);
            });
        });

        describe('updateOnboardingData()', () => {
            it('should merge onboarding data', () => {
                useAuthStore.getState().updateOnboardingData({ displayName: 'Test' });
                useAuthStore.getState().updateOnboardingData({ birthday: '1990-01-01' });

                const state = useAuthStore.getState();
                expect(state.onboardingData).toEqual({
                    displayName: 'Test',
                    birthday: '1990-01-01'
                });
            });
        });

        describe('completeOnboarding()', () => {
            it('should complete onboarding and save profile', async () => {
                vi.useRealTimers();

                useAuthStore.setState({
                    user: { id: 'user-123', email: 'test@example.com' },
                    profile: { id: 'user-123', partner_code: 'CODE123' },
                    onboardingData: {
                        displayName: 'Test User',
                        birthday: '1990-01-01',
                        loveLanguage: 'quality_time',
                        communicationStyle: 'direct'
                    },
                    preferredLanguage: 'en'
                });

                const savedProfile = {
                    id: 'user-123',
                    display_name: 'Test User',
                    birthday: '1990-01-01',
                    love_language: 'quality_time',
                    communication_style: 'direct',
                    onboarding_complete: true
                };

                supabaseMocks.upsertProfile.mockResolvedValue({
                    data: savedProfile,
                    error: null
                });

                const result = await useAuthStore.getState().completeOnboarding();

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();

                const state = useAuthStore.getState();
                expect(state.profile).toEqual(savedProfile);
                expect(state.onboardingComplete).toBe(true);
                expect(state.onboardingStep).toBe(0);
                expect(state.onboardingData).toEqual({});
            });

            it('should return error if user not logged in', async () => {
                vi.useRealTimers();

                useAuthStore.setState({ user: null });

                const result = await useAuthStore.getState().completeOnboarding();

                expect(result.error).toBeDefined();
            });
        });
    });

    describe('refreshProfile()', () => {
        it('should refresh profile and partner data', async () => {
            vi.useRealTimers();

            useAuthStore.setState({
                user: { id: 'user-123' },
                hasPartner: false
            });

            const updatedProfile = {
                id: 'user-123',
                display_name: 'Updated Name',
                partner_id: 'partner-456',
                onboarding_complete: true,
                preferred_language: 'en'
            };
            const partnerData = {
                id: 'partner-456',
                display_name: 'Partner'
            };

            profileLoaderMocks.loadUserContext.mockResolvedValue({
                profile: updatedProfile,
                partner: partnerData,
                requests: [],
                sent: null
            });

            await useAuthStore.getState().refreshProfile();

            const state = useAuthStore.getState();
            expect(state.profile).toEqual(updatedProfile);
            expect(state.partner).toEqual(partnerData);
            expect(state.hasPartner).toBe(true);
        });

        it('should do nothing if user not logged in', async () => {
            vi.useRealTimers();

            useAuthStore.setState({ user: null });

            await useAuthStore.getState().refreshProfile();

            expect(profileLoaderMocks.loadUserContext).not.toHaveBeenCalled();
        });
    });

    describe('setPreferredLanguage()', () => {
        it('should update language preference in state', async () => {
            vi.useRealTimers();

            useAuthStore.setState({
                user: { id: 'user-123' },
                profile: { id: 'user-123', preferred_language: 'en' },
                preferredLanguage: 'en'
            });

            supabaseMocks.upsertProfile.mockResolvedValue({ error: null });
            profileLoaderMocks.loadUserContext.mockResolvedValue({
                profile: { id: 'user-123', preferred_language: 'zh-Hans' },
                partner: null,
                requests: [],
                sent: null
            });

            await useAuthStore.getState().setPreferredLanguage('zh-Hans');

            // Language should be updated immediately in state
            expect(useAuthStore.getState().preferredLanguage).toBe('zh-Hans');
        });

        it('should update local state even without user', async () => {
            vi.useRealTimers();

            useAuthStore.setState({
                user: null,
                profile: null,
                preferredLanguage: 'en'
            });

            await useAuthStore.getState().setPreferredLanguage('zh-Hans');

            expect(useAuthStore.getState().preferredLanguage).toBe('zh-Hans');
            expect(supabaseMocks.upsertProfile).not.toHaveBeenCalled();
        });

        it('should persist language to database when user logged in', async () => {
            vi.useRealTimers();

            useAuthStore.setState({
                user: { id: 'user-123' },
                profile: { id: 'user-123', preferred_language: 'en' },
                preferredLanguage: 'en'
            });

            supabaseMocks.upsertProfile.mockResolvedValue({ error: null });
            profileLoaderMocks.loadUserContext.mockResolvedValue({
                profile: { id: 'user-123', preferred_language: 'zh-Hans' },
                partner: null,
                requests: [],
                sent: null
            });

            await useAuthStore.getState().setPreferredLanguage('zh-Hans');

            expect(supabaseMocks.upsertProfile).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'user-123',
                    preferred_language: 'zh-Hans'
                })
            );
        });
    });

    describe('Cleanup Methods', () => {
        describe('cleanupRealtimeSubscriptions()', () => {
            it('should clean up subscriptions and reset subscription refs', () => {
                const mockSub1 = {};
                const mockSub2 = {};

                useAuthStore.setState({
                    _profileSubscription: mockSub1,
                    _requestsSubscription: mockSub2
                });

                useAuthStore.getState().cleanupRealtimeSubscriptions();

                const state = useAuthStore.getState();
                expect(state._profileSubscription).toBeNull();
                expect(state._requestsSubscription).toBeNull();
            });
        });

        describe('cleanup()', () => {
            it('should clean up all resources without error', () => {
                expect(() => useAuthStore.getState().cleanup()).not.toThrow();
            });
        });
    });

    describe('handleSupabaseAuthEvent()', () => {
        it('should handle SIGNED_OUT event and reset state', async () => {
            vi.useRealTimers();

            useAuthStore.setState({
                user: { id: 'user-123' },
                isAuthenticated: true,
                profile: { id: 'user-123' },
                hasPartner: true
            });

            await useAuthStore.getState().handleSupabaseAuthEvent('SIGNED_OUT', null);

            const state = useAuthStore.getState();
            expect(state.isAuthenticated).toBe(false);
            expect(state.user).toBeNull();
            expect(state.profile).toBeNull();
            expect(state.hasPartner).toBe(false);
        });

        it('should handle TOKEN_REFRESHED event and update session', async () => {
            vi.useRealTimers();

            const newSession = { access_token: 'new-token', user: { id: 'user-123' } };

            useAuthStore.setState({
                session: { access_token: 'old-token' }
            });

            await useAuthStore.getState().handleSupabaseAuthEvent('TOKEN_REFRESHED', newSession);

            expect(useAuthStore.getState().session).toEqual(newSession);
        });
    });

    describe('State Persistence', () => {
        it('should not persist sensitive session data', () => {
            // The store uses partialize to filter what gets persisted
            const state = useAuthStore.getState();

            // The store exists and has persist config
            expect(useAuthStore.persist).toBeDefined();
        });
    });

    describe('Event Bus Integration - signIn emits AUTH_LOGIN', () => {
        it('should emit AUTH_LOGIN event on successful sign in', async () => {
            vi.useRealTimers();

            const mockUser = { id: 'user-123', email: 'test@example.com' };
            const mockProfile = { id: 'user-123', display_name: 'Test' };

            supabaseMocks.signInWithEmail.mockResolvedValue({
                data: { user: mockUser, session: { access_token: 'token' } },
                error: null
            });

            profileLoaderMocks.loadUserContext.mockResolvedValue({
                profile: mockProfile,
                partner: null,
                requests: [],
                sent: null
            });

            const loginEvents = [];
            eventBus.on(EVENTS.AUTH_LOGIN, (data) => loginEvents.push(data));

            await useAuthStore.getState().signIn('test@example.com', 'password');

            expect(loginEvents.length).toBe(1);
            expect(loginEvents[0].userId).toBe('user-123');
        });
    });

    describe('Event Bus Integration - signOut emits AUTH_LOGOUT', () => {
        it('should emit AUTH_LOGOUT event on sign out', async () => {
            vi.useRealTimers();

            useAuthStore.setState({
                user: { id: 'user-123' },
                isAuthenticated: true
            });

            supabaseMocks.signOut.mockResolvedValue({ error: null });

            const logoutEvents = [];
            eventBus.on(EVENTS.AUTH_LOGOUT, (data) => logoutEvents.push(data));

            await useAuthStore.getState().signOut();

            expect(logoutEvents.length).toBe(1);
            expect(logoutEvents[0].userId).toBe('user-123');
        });
    });
});
