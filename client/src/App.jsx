import React, { useEffect } from 'react';
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
import CourtroomPage from './pages/CourtroomPageV2';
import HistoryPage from './pages/HistoryPage';
import CaseDetailPage from './pages/CaseDetailPage';
import AppreciationsPage from './pages/AppreciationsPage';
import ProfilesPage from './pages/ProfilesPage';
import CalendarPage from './pages/CalendarPage';
import DashboardPage from './pages/DashboardPage';
import DailyMeowPage from './pages/DailyMeowPage';
import DailyMeowHistoryPage from './pages/DailyMeowHistoryPage';
import EconomyPage from './pages/EconomyPage';

// Components
import PartnerRequestModal from './components/PartnerRequestModal';
import LoadingScreen from './components/LoadingScreen';

// Store
import useAuthStore from './store/useAuthStore';
import { startAuthLifecycle } from './services/authLifecycle';

// Protected Route Component - Now allows access without partner (with restrictions)
const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, isLoading, onboardingComplete } = useAuthStore();
    const location = useLocation();

    if (isLoading) {
        return <LoadingScreen />;
    }

    if (!isAuthenticated) {
        return <Navigate to="/signin" state={{ from: location }} replace />;
    }

    // If authenticated but onboarding not complete, redirect to onboarding
    if (!onboardingComplete && location.pathname !== '/onboarding') {
        return <Navigate to="/onboarding" replace />;
    }

    // Allow access to main app even without partner (features will be restricted)
    return children;
};

// App Routes Component
const AppRoutes = () => {
    const { initialize, isLoading, isAuthenticated, onboardingComplete, profile, pendingRequests, hasPartner } = useAuthStore();
    const [initialized, setInitialized] = React.useState(false);

    useEffect(() => {
        const stop = startAuthLifecycle();
        return () => stop?.();
    }, []);

    useEffect(() => {
        // Only initialize once
        if (initialized) return;

        console.log('[App] Calling initialize...');
        setInitialized(true);
        initialize().then(() => {
            console.log('[App] Initialize completed');
        }).catch((err) => {
            console.error('[App] Initialize failed:', err);
        });
    }, [initialized, initialize]);

    console.log('[App] Render - isLoading:', isLoading, 'isAuthenticated:', isAuthenticated);

    if (isLoading) {
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
                        onboardingComplete ? <Navigate to="/" replace /> : <Navigate to="/onboarding" replace />
                    ) : <SignInPage />
                } />
                <Route path="/signup" element={
                    isAuthenticated ? (
                        onboardingComplete ? <Navigate to="/" replace /> : <Navigate to="/onboarding" replace />
                    ) : <SignUpPage />
                } />
                <Route path="/auth/callback" element={<AuthCallbackPage />} />

                {/* Password Reset Routes */}
                <Route path="/forgot-password" element={
                    isAuthenticated ? <Navigate to="/" replace /> : <ForgotPasswordPage />
                } />
                <Route path="/reset-password" element={<ResetPasswordPage />} />

                {/* Onboarding (requires auth, but not full onboarding) */}
                <Route path="/onboarding" element={
                    !isAuthenticated ? <Navigate to="/signin" replace /> :
                        onboardingComplete ? <Navigate to="/" replace /> :
                            <OnboardingPage />
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
