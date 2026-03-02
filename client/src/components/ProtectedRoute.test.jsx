import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import React from 'react';

// Mock stores
const mockAuthState = {
    isAuthenticated: false,
    isLoading: false,
    hasCheckedAuth: true,
};

const mockOnboardingState = {
    onboardingComplete: false,
};

vi.mock('../store/useAuthStore', () => ({
    default: () => mockAuthState,
}));

vi.mock('../store/useOnboardingStore', () => ({
    default: () => mockOnboardingState,
}));

vi.mock('./LoadingScreen', () => ({
    default: () => <div data-testid="loading-screen">Loading</div>,
}));

// Import the ProtectedRoute from App.jsx indirectly by extracting the logic
// Since ProtectedRoute is not exported, we recreate it with the same logic
import useAuthStore from '../store/useAuthStore';
import useOnboardingStore from '../store/useOnboardingStore';
import { Navigate, useLocation } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, isLoading, hasCheckedAuth } = useAuthStore();
    const { onboardingComplete } = useOnboardingStore();
    const location = useLocation();

    if (!hasCheckedAuth || isLoading) {
        return <div data-testid="loading-screen">Loading</div>;
    }

    if (!isAuthenticated) {
        return <Navigate to={onboardingComplete ? '/signin' : '/welcome'} state={{ from: location }} replace />;
    }

    if (!onboardingComplete && location.pathname !== '/welcome' && location.pathname !== '/onboarding') {
        return <Navigate to="/welcome" replace />;
    }

    return children;
};

const renderWithRouter = (initialPath, authState, onboardingState) => {
    Object.assign(mockAuthState, {
        isAuthenticated: false,
        isLoading: false,
        hasCheckedAuth: true,
        ...authState,
    });
    Object.assign(mockOnboardingState, {
        onboardingComplete: false,
        ...onboardingState,
    });

    return render(
        <MemoryRouter initialEntries={[initialPath]}>
            <Routes>
                <Route
                    path="/"
                    element={
                        <ProtectedRoute>
                            <div data-testid="protected-content">Protected Content</div>
                        </ProtectedRoute>
                    }
                />
                <Route path="/signin" element={<div data-testid="signin-page">Sign In</div>} />
                <Route path="/welcome" element={<div data-testid="welcome-page">Welcome</div>} />
            </Routes>
        </MemoryRouter>
    );
};

describe('ProtectedRoute', () => {
    it('redirects unauthenticated + onboardingComplete=true to /signin', () => {
        renderWithRouter('/', { isAuthenticated: false }, { onboardingComplete: true });
        expect(screen.getByTestId('signin-page')).toBeInTheDocument();
    });

    it('redirects unauthenticated + onboardingComplete=false to /welcome', () => {
        renderWithRouter('/', { isAuthenticated: false }, { onboardingComplete: false });
        expect(screen.getByTestId('welcome-page')).toBeInTheDocument();
    });

    it('renders children when authenticated + onboarding complete', () => {
        renderWithRouter('/', { isAuthenticated: true }, { onboardingComplete: true });
        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });
});
