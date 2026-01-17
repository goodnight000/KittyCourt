import React, { useEffect, useRef, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';

// Layout
import MainLayout from './layouts/MainLayout';

// Auth Pages (lazy)
const SignInPage = lazy(() => import('./pages/SignInPage'));
const SignUpPage = lazy(() => import('./pages/SignUpPage'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage'));
const ConnectPartnerPage = lazy(() => import('./pages/ConnectPartnerPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));

// App Pages (lazy)
const CourtroomPage = lazy(() => import('./pages/CourtroomPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const CaseDetailPage = lazy(() => import('./pages/CaseDetailPage'));
const AppreciationsPage = lazy(() => import('./pages/AppreciationsPage'));
const ProfilesPage = lazy(() => import('./pages/ProfilesPage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const DailyMeowPage = lazy(() => import('./pages/DailyMeowPage'));
const DailyMeowHistoryPage = lazy(() => import('./pages/DailyMeowHistoryPage'));
const EconomyPage = lazy(() => import('./pages/EconomyPage'));
const ChallengesPage = lazy(() => import('./pages/ChallengesPage'));
const MemoriesPage = lazy(() => import('./pages/MemoriesPage'));
const InsightsPage = lazy(() => import('./pages/InsightsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const FeedbackPage = lazy(() => import('./pages/FeedbackPage'));

// Components
import PartnerRequestModal from './components/PartnerRequestModal';
import GoldWelcomeModal from './components/GoldWelcomeModal';
import LoadingScreen from './components/LoadingScreen';
import ErrorBoundary from './components/ErrorBoundary';

// Store
import useAuthStore from './store/useAuthStore';
import useAppStore from './store/useAppStore';
import useCourtStore from './store/useCourtStore';
import usePartnerStore from './store/usePartnerStore';
import useOnboardingStore from './store/useOnboardingStore';
import useLevelStore from './store/useLevelStore';
import useChallengeStore from './store/useChallengeStore';
import useInsightsStore from './store/useInsightsStore';
import useMemoryStore from './store/useMemoryStore';
import useUpsellStore from './store/useUpsellStore';
import useSubscriptionStore from './store/useSubscriptionStore';
import { startAuthLifecycle } from './services/authLifecycle';
import { startCacheLifecycle } from './services/cacheLifecycle';
import { eventBus, EVENTS } from './lib/eventBus';

// RevenueCat
import { initializeRevenueCat } from './services/revenuecat';

// Push Notifications
import { initializePushNotifications, removePushListeners } from './services/pushNotifications';

// Protected Route Component - Now allows access without partner (with restrictions)
const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, isLoading, hasCheckedAuth } = useAuthStore();
    const { onboardingComplete } = useOnboardingStore();
    const location = useLocation();

    // Show loading until auth check completes
    if (!hasCheckedAuth || isLoading) {
        return <LoadingScreen />;
    }

    if (!isAuthenticated) {
        return <Navigate to="/welcome" state={{ from: location }} replace />;
    }

    // If authenticated but onboarding not complete, redirect to onboarding
    if (!onboardingComplete && location.pathname !== '/welcome' && location.pathname !== '/onboarding') {
        return <Navigate to="/welcome" replace />;
    }

    // Allow access to main app even without partner (features will be restricted)
    return children;
};

// App Routes Component
const AppRoutes = () => {
    const { initialize, isLoading, hasCheckedAuth, isAuthenticated } = useAuthStore();
    const { onboardingComplete } = useOnboardingStore();
    const { pendingRequests, hasPartner, refreshPendingRequests } = usePartnerStore();
    const { checkEntitlement } = useSubscriptionStore();
    const {
        goldWelcomeOpen,
        goldWelcomeMeta,
        openGoldWelcome,
        closeGoldWelcome,
    } = useUpsellStore();
    const initializedRef = useRef(false);
    const wrap = (element, message) => (
        <ErrorBoundary message={message}>
            {element}
        </ErrorBoundary>
    );

    useEffect(() => {
        const stop = startAuthLifecycle();
        const stopCache = startCacheLifecycle();

        // Initialize RevenueCat SDK (only works on native platforms)
        initializeRevenueCat();

        // Initialize event bus listeners for dependent stores
        if (import.meta.env.DEV) console.log('[App] Initializing event bus listeners for stores');
        useAuthStore.getState().init?.();
        useAppStore.getState().init();
        useCourtStore.getState().init();
        usePartnerStore.getState().init();
        useOnboardingStore.getState().init();
        useLevelStore.getState().init();
        useChallengeStore.getState().init();
        useInsightsStore.getState().init();
        useMemoryStore.getState().init();

        return () => {
            stop?.();
            stopCache?.();
            // Cleanup all stores (event bus listeners, pending timeouts, subscriptions)
            useAuthStore.getState().cleanup?.();
            usePartnerStore.getState().cleanup?.();
            useAppStore.getState().cleanup();
            useCourtStore.getState().cleanup();
            useOnboardingStore.getState().cleanup?.();
            useLevelStore.getState().cleanup?.();
            useChallengeStore.getState().cleanup?.();
            useInsightsStore.getState().cleanup?.();
            useMemoryStore.getState().cleanup?.();
            // Cleanup push notification listeners
            removePushListeners();
        };
    }, []);

    useEffect(() => {
        if (initializedRef.current) return;
        initializedRef.current = true;

        if (import.meta.env.DEV) console.log('[App] Calling initialize...');
        initialize().then(() => {
            if (import.meta.env.DEV) console.log('[App] Initialize completed');
        }).catch((err) => {
            console.error('[App] Initialize failed:', err);
        });
    }, [initialize]);

    // Initialize push notifications when user is authenticated
    useEffect(() => {
        if (!isAuthenticated) return;

        // Initialize push notifications after user is authenticated
        initializePushNotifications().then((success) => {
            if (success) {
                if (import.meta.env.DEV) console.log('[App] Push notifications initialized');
            }
        }).catch((err) => {
            console.warn('[App] Push notifications initialization failed:', err);
        });
    }, [isAuthenticated]);

    useEffect(() => {
        if (!isAuthenticated) return;
        checkEntitlement();
    }, [checkEntitlement, hasPartner, isAuthenticated]);

    useEffect(() => {
        const unsubscribe = eventBus.on(EVENTS.SUBSCRIPTION_GOLD_UNLOCKED, (payload) => {
            openGoldWelcome(payload || null);
        });

        return () => unsubscribe();
    }, [openGoldWelcome]);

    // Global polling for pending partner requests (fallback for realtime)
    useEffect(() => {
        if (!isAuthenticated || hasPartner) return;

        // Initial fetch
        refreshPendingRequests();

        // Poll every 10 seconds for new requests
        const interval = setInterval(() => {
            refreshPendingRequests();
        }, 10000);

        return () => clearInterval(interval);
    }, [isAuthenticated, hasPartner, refreshPendingRequests]);

    if (import.meta.env.DEV) console.log('[App] Render - isLoading:', isLoading, 'hasCheckedAuth:', hasCheckedAuth, 'isAuthenticated:', isAuthenticated);

    // Show loading screen until initial auth check completes
    // This prevents the flash of onboarding page on refresh
    if (!hasCheckedAuth || isLoading) {
        return <LoadingScreen />;
    }

    return (
        <>
            {/* Partner Request Modal - shown globally when there are pending requests */}
            {isAuthenticated && pendingRequests?.length > 0 && <PartnerRequestModal />}
            <GoldWelcomeModal
                isOpen={goldWelcomeOpen}
                onClose={closeGoldWelcome}
                meta={goldWelcomeMeta}
            />

            <Suspense fallback={<LoadingScreen />}>
                <Routes>
                {/* Public Routes */}
                <Route path="/signin" element={
                    isAuthenticated ? (
                        onboardingComplete ? <Navigate to="/" replace /> : <Navigate to="/welcome" replace />
                    ) : wrap(<SignInPage />, 'Unable to load sign-in')
                } />
                <Route path="/signup" element={
                    isAuthenticated ? (
                        onboardingComplete ? <Navigate to="/" replace /> : <Navigate to="/welcome" replace />
                    ) : wrap(<SignUpPage />, 'Unable to load sign-up')
                } />
                <Route path="/auth/callback" element={wrap(<AuthCallbackPage />, 'Unable to complete authentication')} />
                <Route path="/welcome" element={
                    isAuthenticated
                        ? (onboardingComplete ? <Navigate to="/" replace /> : wrap(<OnboardingPage />, 'Unable to load onboarding'))
                        : wrap(<OnboardingPage />, 'Unable to load onboarding')
                } />

                {/* Password Reset Routes */}
                <Route path="/forgot-password" element={
                    isAuthenticated ? <Navigate to="/" replace /> : wrap(<ForgotPasswordPage />, 'Unable to load password reset')
                } />
                <Route path="/reset-password" element={wrap(<ResetPasswordPage />, 'Unable to load reset password')} />

                {/* Onboarding (requires auth, but not full onboarding) */}
                <Route path="/onboarding" element={
                    <Navigate to="/welcome" replace />
                } />

                {/* Connect Partner (requires auth + onboarding, can access anytime if not connected) */}
                <Route path="/connect" element={
                    !isAuthenticated ? <Navigate to="/signin" replace /> :
                        !onboardingComplete ? <Navigate to="/onboarding" replace /> :
                            hasPartner ? <Navigate to="/" replace /> :
                                wrap(<ConnectPartnerPage />, 'Unable to load partner connection')
                } />

                {/* Protected App Routes - accessible without partner (features restricted) */}
                <Route path="/" element={
                    <ProtectedRoute>
                        {wrap(<MainLayout />, 'Unable to load the app')}
                    </ProtectedRoute>
                }>
                    <Route index element={wrap(<DashboardPage />, 'Unable to load dashboard')} />
                    <Route path="courtroom" element={wrap(<CourtroomPage />, 'Unable to load court')} />
                    <Route path="history" element={wrap(<HistoryPage />, 'Unable to load history')} />
                    <Route path="history/:caseId" element={wrap(<CaseDetailPage />, 'Unable to load case details')} />
                    <Route path="appreciations" element={wrap(<AppreciationsPage />, 'Unable to load appreciations')} />
                    <Route path="profile" element={wrap(<ProfilesPage />, 'Unable to load profile')} />
                    <Route path="calendar" element={wrap(<CalendarPage />, 'Unable to load calendar')} />
                    <Route path="daily-meow" element={wrap(<DailyMeowPage />, 'Unable to load Daily Meow')} />
                    <Route path="daily-meow/history" element={wrap(<DailyMeowHistoryPage />, 'Unable to load Daily Meow history')} />
                    <Route path="economy" element={wrap(<EconomyPage />, 'Unable to load economy')} />
                    <Route path="challenges" element={wrap(<ChallengesPage />, 'Unable to load challenges')} />
                    <Route path="memories" element={wrap(<MemoriesPage />, 'Unable to load memories')} />
                    <Route path="insights" element={wrap(<InsightsPage />, 'Unable to load insights')} />
                    <Route path="settings" element={wrap(<SettingsPage />, 'Unable to load settings')} />
                    <Route path="feedback" element={wrap(<FeedbackPage />, 'Unable to load feedback')} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
                </Routes>
            </Suspense>
        </>
    );
};

function App() {
    return (
        <BrowserRouter>
            <AppRoutes />
        </BrowserRouter>
    );
}

export default App;
