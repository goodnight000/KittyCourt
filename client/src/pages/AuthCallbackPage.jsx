import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import useOnboardingStore from '../store/useOnboardingStore';
import LoadingScreen from '../components/LoadingScreen';
import { useI18n } from '../i18n';

const AuthCallbackPage = () => {
    const navigate = useNavigate();
    const { initialize } = useAuthStore();
    const { onboardingComplete } = useOnboardingStore();
    const { t } = useI18n();

    useEffect(() => {
        const handleCallback = async () => {
            // Wait for Supabase to process the OAuth callback
            // We DON'T call initialize() here because App.jsx already does it
            // We just wait for the store to update

            // We need to wait for the store to update and loading to finish
            // Poll for a few seconds if needed
            let attempts = 0;
            const maxAttempts = 20; // 10 seconds

            const checkState = setInterval(() => {
                const state = useAuthStore.getState();
                const onboardingState = useOnboardingStore.getState();
                attempts++;

                // If authenticated, we're good to go!
                if (state.isAuthenticated) {
                    clearInterval(checkState);
                    if (onboardingState.onboardingComplete) {
                        navigate('/');
                    } else {
                        navigate('/onboarding');
                    }
                    return;
                }

                // If not authenticated yet, we keep waiting even if isLoading is false
                // This handles the race condition where initialize() finishes (no session found yet)
                // BEFORE the OAuth callback is processed by onAuthStateChange

                // Only give up after the max attempts (10 seconds)
                if (attempts >= maxAttempts) {
                    clearInterval(checkState);
                    console.error('Auth callback timed out - no session found');
                    navigate('/signin');
                }
            }, 500);
        };

        // Small delay to ensure Supabase has processed the callback
        setTimeout(handleCallback, 500);
    }, []);

    return (
        <LoadingScreen
            message={t('authCallback.signingIn')}
            showResetButton={false}
        />
    );
};

export default AuthCallbackPage;
