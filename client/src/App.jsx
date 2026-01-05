import React, { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';

// Layout
import MainLayout from './layouts/MainLayout';

// Auth Pages
import SignInPage from './pages/SignInPage';
import SignUpPage from './pages/SignUpPage';
import OnboardingPage from './pages/OnboardingPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import ConnectPartnerPage from './pages/ConnectPartnerPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

// App Pages
import CourtroomPage from './pages/CourtroomPage';
import HistoryPage from './pages/HistoryPage';
import CaseDetailPage from './pages/CaseDetailPage';
import AppreciationsPage from './pages/AppreciationsPage';
import ProfilesPage from './pages/ProfilesPage';
import CalendarPage from './pages/CalendarPage';
import DashboardPage from './pages/DashboardPage';
import DailyMeowPage from './pages/DailyMeowPage';
import DailyMeowHistoryPage from './pages/DailyMeowHistoryPage';
import EconomyPage from './pages/EconomyPage';
import ChallengesPage from './pages/ChallengesPage';
import MemoriesPage from './pages/MemoriesPage';
import InsightsPage from './pages/InsightsPage';
import SettingsPage from './pages/SettingsPage';
import FeedbackPage from './pages/FeedbackPage';

// Components
import PartnerRequestModal from './components/PartnerRequestModal';
import LoadingScreen from './components/LoadingScreen';

// Store
import useAuthStore from './store/useAuthStore';
import useAppStore from './store/useAppStore';
import useCourtStore from './store/courtStore';
import { startAuthLifecycle } from './services/authLifecycle';

// RevenueCat
import { initializeRevenueCat } from './services/revenuecat';

// Push Notifications
import { initializePushNotifications, removePushListeners } from './services/pushNotifications';

// Protected Route Component - Now allows access without partner (with restrictions)
const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, isLoading, hasCheckedAuth, onboardingComplete } = useAuthStore();
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
    const { initialize, isLoading, hasCheckedAuth, isAuthenticated, onboardingComplete, pendingRequests, hasPartner, refreshPendingRequests } = useAuthStore();
    const initializedRef = useRef(false);

    useEffect(() => {
        const stop = startAuthLifecycle();

        // Initialize RevenueCat SDK (only works on native platforms)
        initializeRevenueCat();

        // Initialize event bus listeners for dependent stores
        console.log('[App] Initializing event bus listeners for stores');
        useAppStore.getState().init();
        useCourtStore.getState().init();

        return () => {
            stop?.();
            // Cleanup all stores (event bus listeners, pending timeouts, subscriptions)
            useAuthStore.getState().cleanup?.();
            useAppStore.getState().cleanup();
            useCourtStore.getState().cleanup();
            // Cleanup push notification listeners
            removePushListeners();
        };
    }, []);

    useEffect(() => {
        if (initializedRef.current) return;
        initializedRef.current = true;

        console.log('[App] Calling initialize...');
        initialize().then(() => {
            console.log('[App] Initialize completed');
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
                console.log('[App] Push notifications initialized');
            }
        }).catch((err) => {
            console.warn('[App] Push notifications initialization failed:', err);
        });
    }, [isAuthenticated]);

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

    console.log('[App] Render - isLoading:', isLoading, 'hasCheckedAuth:', hasCheckedAuth, 'isAuthenticated:', isAuthenticated);

    // Show loading screen until initial auth check completes
    // This prevents the flash of onboarding page on refresh
    if (!hasCheckedAuth || isLoading) {
        return <LoadingScreen />;
    }

    return (
        <>
            {/* Partner Request Modal - shown globally when there are pending requests */}
            {isAuthenticated && pendingRequests?.length > 0 && <PartnerRequestModal />}

            <Routes>
                {/* Public Routes */}
                <Route path="/signin" element={
                    isAuthenticated ? (
                        onboardingComplete ? <Navigate to="/" replace /> : <Navigate to="/welcome" replace />
                    ) : <SignInPage />
                } />
                <Route path="/signup" element={
                    isAuthenticated ? (
                        onboardingComplete ? <Navigate to="/" replace /> : <Navigate to="/welcome" replace />
                    ) : <SignUpPage />
                } />
                <Route path="/auth/callback" element={<AuthCallbackPage />} />
                <Route path="/welcome" element={
                    isAuthenticated
                        ? (onboardingComplete ? <Navigate to="/" replace /> : <OnboardingPage />)
                        : <OnboardingPage />
                } />

                {/* Password Reset Routes */}
                <Route path="/forgot-password" element={
                    isAuthenticated ? <Navigate to="/" replace /> : <ForgotPasswordPage />
                } />
                <Route path="/reset-password" element={<ResetPasswordPage />} />

                {/* Onboarding (requires auth, but not full onboarding) */}
                <Route path="/onboarding" element={
                    <Navigate to="/welcome" replace />
                } />

                {/* Connect Partner (requires auth + onboarding, can access anytime if not connected) */}
                <Route path="/connect" element={
                    !isAuthenticated ? <Navigate to="/signin" replace /> :
                        !onboardingComplete ? <Navigate to="/onboarding" replace /> :
                            hasPartner ? <Navigate to="/" replace /> :
                                <ConnectPartnerPage />
                } />

                {/* Protected App Routes - accessible without partner (features restricted) */}
                <Route path="/" element={
                    <ProtectedRoute>
                        <MainLayout />
                    </ProtectedRoute>
                }>
                    <Route index element={<DashboardPage />} />
                    <Route path="courtroom" element={<CourtroomPage />} />
                    <Route path="history" element={<HistoryPage />} />
                    <Route path="history/:caseId" element={<CaseDetailPage />} />
                    <Route path="appreciations" element={<AppreciationsPage />} />
                    <Route path="profile" element={<ProfilesPage />} />
                    <Route path="calendar" element={<CalendarPage />} />
                    <Route path="daily-meow" element={<DailyMeowPage />} />
                    <Route path="daily-meow/history" element={<DailyMeowHistoryPage />} />
                    <Route path="economy" element={<EconomyPage />} />
                    <Route path="challenges" element={<ChallengesPage />} />
                    <Route path="memories" element={<MemoriesPage />} />
                    <Route path="insights" element={<InsightsPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="feedback" element={<FeedbackPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
            </Routes>
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
