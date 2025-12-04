import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';

const AuthCallbackPage = () => {
    const navigate = useNavigate();
    const { initialize, onboardingComplete } = useAuthStore();

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
                attempts++;

                // If authenticated, we're good to go!
                if (state.isAuthenticated) {
                    clearInterval(checkState);
                    if (state.onboardingComplete) {
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
        <div className="min-h-screen bg-gradient-to-br from-court-cream via-white to-court-tan/30 flex flex-col items-center justify-center">
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="mb-6"
            >
                <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #C9A227 0%, #8B7019 100%)' }}
                >
                    <Sparkles className="w-8 h-8 text-white" />
                </div>
            </motion.div>
            <h2 className="text-xl font-bold text-neutral-700">Signing you in...</h2>
            <p className="text-neutral-500 mt-2">Just a moment! 🐱</p>
        </div>
    );
};

export default AuthCallbackPage;
