import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock chainable Supabase methods
const mockSupabaseChain = {
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: {}, error: null })
};

vi.mock('../services/supabase', () => ({
    supabase: {
        auth: {
            onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
            setSession: vi.fn()
        },
        removeChannel: vi.fn(),
        from: vi.fn(() => ({
            update: vi.fn(() => mockSupabaseChain)
        }))
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
            clearAll: vi.fn(),
            clearRegistry: vi.fn(),
            warmCache: vi.fn()
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
    SUPPORTED_LANGUAGES: ['en', 'zh-Hans'],
    normalizeLanguage: vi.fn((lang) => lang === 'zh-Hans' || lang === 'en' ? lang : null)
}));

describe('useAuthStore - offline handling', () => {
    let useAuthStore;
    let supabaseMocks;
    let backupMocks;

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.resetModules();

        const eventBusModule = await import('../lib/eventBus');
        eventBusModule.eventBus.clear();

        supabaseMocks = await import('../services/supabase');
        backupMocks = await import('../services/authSessionBackup');
        const storeModule = await import('./useAuthStore');
        useAuthStore = storeModule.default;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('initialize() sets isAuthenticated=true with persisted profile when network fails', async () => {
        // Simulate persisted profile from previous session
        useAuthStore.setState({
            profile: { id: 'user-123', display_name: 'Test User', onboarding_complete: true },
        });

        // Simulate network failure: getSession returns no session
        supabaseMocks.getSession.mockResolvedValue({ session: null, error: { message: 'Network error' } });
        // restoreSessionFromBackup also fails (no backup)
        backupMocks.readSessionBackup.mockReturnValue(null);

        await useAuthStore.getState().initialize();

        const state = useAuthStore.getState();
        expect(state.isAuthenticated).toBe(true);
        expect(state.isDegradedAuth).toBe(true);
        expect(state.hasCheckedAuth).toBe(true);
        expect(state.isLoading).toBe(false);
    });

    it('initialize() sets isAuthenticated=false when network fails AND no persisted profile', async () => {
        // No persisted profile
        useAuthStore.setState({ profile: null });

        // Simulate network failure
        supabaseMocks.getSession.mockResolvedValue({ session: null, error: { message: 'Network error' } });
        backupMocks.readSessionBackup.mockReturnValue(null);

        await useAuthStore.getState().initialize();

        const state = useAuthStore.getState();
        expect(state.isAuthenticated).toBe(false);
        expect(state.isDegradedAuth).toBe(false);
        expect(state.hasCheckedAuth).toBe(true);
        expect(state.isLoading).toBe(false);
    });

    it('isDegradedAuth is cleared when a real session is later established', async () => {
        vi.useRealTimers();

        // Start in degraded auth state
        useAuthStore.setState({
            profile: { id: 'user-123', display_name: 'Test', onboarding_complete: true },
            isAuthenticated: true,
            isDegradedAuth: true,
            hasCheckedAuth: true,
        });

        const mockUser = { id: 'user-123', email: 'test@example.com' };
        const mockSession = { access_token: 'token', user: mockUser };

        const profileLoaderMocks = await import('../services/profileLoader');
        profileLoaderMocks.loadUserContext.mockResolvedValue({
            profile: { id: 'user-123', display_name: 'Test', onboarding_complete: true, preferred_language: 'en' },
            partner: null,
            requests: [],
            sent: null,
        });

        // Simulate a real session coming in (e.g., network restored)
        await useAuthStore.getState().handleSupabaseAuthEvent('SIGNED_IN', mockSession);

        const state = useAuthStore.getState();
        expect(state.isAuthenticated).toBe(true);
        expect(state.isDegradedAuth).toBe(false);
    });

    it('signOut() clears isDegradedAuth', async () => {
        vi.useRealTimers();

        useAuthStore.setState({
            user: { id: 'user-123' },
            isAuthenticated: true,
            isDegradedAuth: true,
        });

        supabaseMocks.signOut.mockResolvedValue({ error: null });

        await useAuthStore.getState().signOut();

        const state = useAuthStore.getState();
        expect(state.isDegradedAuth).toBe(false);
        expect(state.isAuthenticated).toBe(false);
    });
});
