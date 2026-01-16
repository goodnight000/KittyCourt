import React, { useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Sparkles, AlertCircle, UserX } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';
import { useI18n } from '../i18n';

// Helper to get user-friendly error messages
const getErrorMessage = (error, t) => {
    const message = error?.message?.toLowerCase() || '';

    // Supabase returns "Invalid login credentials" for both wrong password AND non-existent user
    // This is intentional for security (prevents user enumeration)
    if (message.includes('invalid login credentials') || message.includes('invalid password') || message.includes('invalid email')) {
        return {
            type: 'invalid_credentials',
            title: t('signIn.errors.invalid.title'),
            message: t('signIn.errors.invalid.message'),
            icon: Lock
        };
    }

    if (message.includes('user not found') || message.includes('no user found')) {
        return {
            type: 'no_account',
            title: t('signIn.errors.noAccount.title'),
            message: t('signIn.errors.noAccount.message'),
            icon: UserX
        };
    }

    if (message.includes('email not confirmed')) {
        return {
            type: 'unconfirmed',
            title: t('signIn.errors.unconfirmed.title'),
            message: t('signIn.errors.unconfirmed.message'),
            icon: Mail
        };
    }

    if (message.includes('too many requests') || message.includes('rate limit')) {
        return {
            type: 'rate_limit',
            title: t('signIn.errors.rateLimit.title'),
            message: t('signIn.errors.rateLimit.message'),
            icon: AlertCircle
        };
    }

    // Log unknown errors for debugging
    console.error('[SignIn] Unknown error:', error);

    return {
        type: 'generic',
        title: t('signIn.errors.generic.title'),
        message: t('signIn.errors.generic.message'),
        icon: AlertCircle
    };
};

const SignInPage = () => {
    const navigate = useNavigate();
    const { t } = useI18n();
    const { signIn, signInWithGoogle } = useAuthStore();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleEmailSignIn = async (e) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        if (!email || !password) {
            setError({
                type: 'validation',
                title: t('signIn.errors.validation.title'),
                message: t('signIn.errors.validation.message')
            });
            setIsSubmitting(false);
            return;
        }

        if (import.meta.env.DEV) console.log('[SignInPage] Calling signIn...');
        const result = await signIn(email, password);
        if (import.meta.env.DEV) console.log('[SignInPage] signIn result:', result);
        setIsSubmitting(false);

        if (result.error) {
            console.error('[SignInPage] Error:', result.error);
            setError(getErrorMessage(result.error, t));
        } else {
            if (import.meta.env.DEV) console.log('[SignInPage] Success! Navigating to /');
            // Small delay to ensure state is fully propagated before navigation
            setTimeout(() => {
                if (import.meta.env.DEV) console.log('[SignInPage] Executing navigate...');
                navigate('/');
            }, 100);
        }
    };

    const handleGoogleSignIn = async () => {
        setError(null);
        setIsSubmitting(true);
        const { error } = await signInWithGoogle();
        setIsSubmitting(false);
        if (error) {
            setError(getErrorMessage(error, t));
        }
    };

    const ErrorIcon = error?.icon || AlertCircle;

    return (
        <div className="min-h-screen bg-gradient-to-br from-court-cream via-white to-court-tan/30 flex flex-col items-center justify-center p-6 safe-top">
            {/* Background Decorations */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <Motion.div
                    animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
                    transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-20 left-10 text-4xl opacity-20"
                >
                    🐱
                </Motion.div>
                <Motion.div
                    animate={{ y: [0, 15, 0], rotate: [0, -5, 0] }}
                    transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                    className="absolute top-40 right-16 text-3xl opacity-20"
                >
                    ⚖️
                </Motion.div>
                <Motion.div
                    animate={{ y: [0, 10, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                    className="absolute bottom-40 left-20 text-3xl opacity-20"
                >
                    💕
                </Motion.div>
            </div>

            {/* Logo & Header */}
            <Motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-8"
            >
                <Motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #C9A227 0%, #8B7019 100%)' }}
                >
                    <span className="text-4xl">🐱</span>
                </Motion.div>
                <h1 className="text-3xl font-bold text-gradient font-display">{t('signIn.brand')}</h1>
                <p className="text-neutral-500 mt-2">{t('signIn.subtitle')}</p>
            </Motion.div>

            {/* Sign In Card */}
            <Motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="w-full max-w-md"
            >
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-white/50">
                    {/* Error Message */}
                    {error && (
                        <Motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl"
                        >
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-red-100 rounded-xl shrink-0">
                                    <ErrorIcon className="w-5 h-5 text-red-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-semibold text-red-700 text-sm">{error.title}</p>
                                    <p className="text-red-600 text-sm mt-0.5">{error.message}</p>
                                    {error.type === 'no_account' && (
                                        <Link
                                            to="/signup"
                                            className="inline-flex items-center gap-1 text-sm font-medium text-court-brown hover:text-court-gold mt-2 transition-colors"
                                        >
                                            {t('signIn.actions.createAccount')} <ArrowRight className="w-3.5 h-3.5" />
                                        </Link>
                                    )}
                                    {error.type === 'invalid_credentials' && (
                                        <div className="flex flex-wrap gap-3 mt-2">
                                            <Link
                                                to="/forgot-password"
                                                className="inline-flex items-center gap-1 text-sm font-medium text-court-brown hover:text-court-gold transition-colors"
                                            >
                                                {t('signIn.actions.resetPassword')} <ArrowRight className="w-3.5 h-3.5" />
                                            </Link>
                                            <Link
                                                to="/signup"
                                                className="inline-flex items-center gap-1 text-sm font-medium text-court-brown hover:text-court-gold transition-colors"
                                            >
                                                {t('signIn.actions.createAccountShort')} <ArrowRight className="w-3.5 h-3.5" />
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Motion.div>
                    )}

                    {/* Google Sign In */}
                    <Motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleGoogleSignIn}
                        disabled={isSubmitting}
                        className="w-full py-3.5 bg-white border-2 border-neutral-200 rounded-2xl font-bold text-neutral-700 flex items-center justify-center gap-3 hover:bg-neutral-50 hover:border-neutral-300 transition-all disabled:opacity-50"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        {t('signIn.google')}
                    </Motion.button>

                    {/* Divider */}
                    <div className="flex items-center gap-4 my-6">
                        <div className="flex-1 h-px bg-neutral-200"></div>
                        <span className="text-neutral-500 text-sm">{t('common.or')}</span>
                        <div className="flex-1 h-px bg-neutral-200"></div>
                    </div>

                    {/* Email Form */}
                    <form onSubmit={handleEmailSignIn} className="space-y-4">
                        {/* Email Input */}
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder={t('signIn.emailPlaceholder')}
                                className="w-full pl-12 pr-4 py-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl text-neutral-700 placeholder:text-neutral-500 focus:outline-none focus:border-court-gold focus:ring-2 focus:ring-court-gold/20 transition-all"
                            />
                        </div>

                        {/* Password Input */}
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={t('signIn.passwordPlaceholder')}
                                className="w-full pl-12 pr-12 py-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl text-neutral-700 placeholder:text-neutral-500 focus:outline-none focus:border-court-gold focus:ring-2 focus:ring-court-gold/20 transition-all"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-600"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>

                        {/* Submit Button */}
                        <Motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-3.5 rounded-2xl font-bold text-white flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 transition-all"
                            style={{ background: 'linear-gradient(135deg, #C9A227 0%, #8B7019 100%)' }}
                        >
                            {isSubmitting ? (
                                <Motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                >
                                    <Sparkles className="w-5 h-5" />
                                </Motion.div>
                            ) : (
                                <>
                                    {t('signIn.submit')}
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </Motion.button>
                    </form>

                    {/* Forgot Password */}
                    <div className="mt-4 text-center">
                        <Link
                            to="/forgot-password"
                            className="text-sm text-court-gold hover:text-court-goldDark transition-colors"
                        >
                            {t('signIn.forgotPassword')}
                        </Link>
                    </div>
                </div>

                {/* Sign Up Link */}
                <Motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                className="mt-6 text-center text-neutral-600"
            >
                {t('signIn.newHere')}{' '}
                <Link
                    to="/signup"
                    className="font-bold text-court-gold hover:text-court-goldDark transition-colors"
                >
                    {t('signIn.actions.createAccount')}
                </Link>
            </Motion.p>
            </Motion.div>

            {/* Footer */}
            <Motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
            className="mt-8 text-neutral-500 text-sm"
        >
            {t('signIn.footer')}
        </Motion.p>
        </div>
    );
};

export default SignInPage;
