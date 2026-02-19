import React, { useState, useEffect } from 'react';
import { motion as Motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Cat, CheckCircle, Eye, EyeOff, Lock, Shield } from 'lucide-react';
import { updatePassword, supabase } from '../services/supabase';
import { useI18n } from '../i18n';
import StandardButton from '../components/shared/StandardButton';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion';

const ResetPasswordPage = () => {
    const navigate = useNavigate();
    const { t } = useI18n();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [isValidSession, setIsValidSession] = useState(false);
    const [checkingSession, setCheckingSession] = useState(true);
    const prefersReducedMotion = usePrefersReducedMotion();

    // Check if user has a valid recovery session
    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            // User should have a session from the reset link
            if (session) {
                setIsValidSession(true);
            }
            setCheckingSession(false);
        };

        // Listen for auth state changes (recovery token handling)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
            if (event === 'PASSWORD_RECOVERY') {
                setIsValidSession(true);
                setCheckingSession(false);
            }
        });

        checkSession();

        return () => subscription.unsubscribe();
    }, []);

    const validatePassword = (pwd) => {
        if (pwd.length < 8) {
            return t('resetPassword.errors.tooShort');
        }
        return null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Validate password
        const passwordError = validatePassword(password);
        if (passwordError) {
            setError(passwordError);
            return;
        }

        // Check passwords match
        if (password !== confirmPassword) {
            setError(t('resetPassword.errors.mismatch'));
            return;
        }

        setIsLoading(true);

        try {
            const { error } = await updatePassword(password);
            if (error) {
                if (error.message?.includes('same as')) {
                    setError(t('resetPassword.errors.sameAsCurrent'));
                } else {
                    setError(error.message || t('resetPassword.errors.updateFailed'));
                }
            } else {
                setSuccess(true);
                // Redirect to sign in after a short delay
                setTimeout(() => {
                    navigate('/signin');
                }, 3000);
            }
        } catch {
            setError(t('resetPassword.errors.generic'));
        } finally {
            setIsLoading(false);
        }
    };

    if (checkingSession) {
        return (
            <div className="min-h-screen flex items-center justify-center safe-top">
                <Motion.div
                    animate={prefersReducedMotion ? undefined : { rotate: 360 }}
                    transition={prefersReducedMotion ? undefined : { duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-8 h-8 border-3 border-court-gold/30 border-t-court-gold rounded-full"
                />
            </div>
        );
    }

    if (!isValidSession) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 safe-top">
                <Motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full max-w-md"
                >
                    <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-white/50 text-center">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-amber-100 flex items-center justify-center">
                            <AlertCircle className="w-10 h-10 text-amber-600" />
                        </div>

                        <h1 className="text-2xl font-bold text-neutral-800 mb-3">{t('resetPassword.invalid.title')}</h1>
                        <p className="text-neutral-600 mb-6">
                            {t('resetPassword.invalid.subtitle')}
                        </p>

                        <StandardButton
                            size="lg"
                            onClick={() => navigate('/forgot-password')}
                            className="w-full py-3"
                        >
                            {t('resetPassword.invalid.requestNew')}
                        </StandardButton>

                        <Link
                            to="/signin"
                            className="inline-flex items-center justify-center gap-2 text-court-brown hover:text-court-gold transition-colors font-medium mt-4"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            {t('resetPassword.invalid.backToSignIn')}
                        </Link>
                    </div>
                </Motion.div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 safe-top">
                <Motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full max-w-md"
                >
                    <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-white/50 text-center">
                        <Motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", delay: 0.2 }}
                            className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center"
                        >
                            <CheckCircle className="w-10 h-10 text-green-600" />
                        </Motion.div>

                        <h1 className="text-2xl font-bold text-neutral-800 mb-3">{t('resetPassword.success.title')}</h1>
                        <p className="text-neutral-600 mb-6">
                            {t('resetPassword.success.subtitle')}
                        </p>

                        <div className="h-1 bg-court-gold/30 rounded-full overflow-hidden">
                            <Motion.div
                                initial={false}
                                animate={{ scaleX: 0 }}
                                transition={{ duration: 3, ease: "linear" }}
                                style={{ transformOrigin: 'left center' }}
                                className="h-full bg-court-gold rounded-full"
                            />
                        </div>

                        <Link
                            to="/signin"
                            className="inline-flex items-center justify-center gap-2 text-court-brown hover:text-court-gold transition-colors font-medium mt-6"
                        >
                            {t('resetPassword.success.signInNow')}
                        </Link>
                    </div>
                </Motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 safe-top">
            {/* Background Decorations */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <Motion.div
                    animate={prefersReducedMotion ? undefined : { y: [0, -20, 0], rotate: [0, 5, 0] }}
                    transition={prefersReducedMotion ? undefined : { duration: 6, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-20 left-10 opacity-20"
                >
                    <Lock className="w-10 h-10 text-amber-500" />
                </Motion.div>
                <Motion.div
                    animate={prefersReducedMotion ? undefined : { y: [0, 15, 0], rotate: [0, -5, 0] }}
                    transition={prefersReducedMotion ? undefined : { duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                    className="absolute top-40 right-16 opacity-20"
                >
                    <Cat className="w-8 h-8 text-amber-600" />
                </Motion.div>
            </div>

            {/* Header */}
            <Motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-8"
            >
                <Motion.div
                    animate={prefersReducedMotion ? undefined : { y: [0, -8, 0] }}
                    transition={prefersReducedMotion ? undefined : { duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #C9A227 0%, #8B7019 100%)' }}
                >
                    <Shield className="w-10 h-10 text-white" />
                </Motion.div>
                <h1 className="text-3xl font-bold text-gradient font-display">{t('resetPassword.header.title')}</h1>
                <p className="text-neutral-500 mt-2">{t('resetPassword.header.subtitle')}</p>
            </Motion.div>

            {/* Reset Form */}
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
                            role="alert"
                            className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl"
                        >
                            <div className="flex items-center gap-3">
                                <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                                <p className="text-red-600 text-sm">{error}</p>
                            </div>
                        </Motion.div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* New Password Field */}
                        <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-2">
                                {t('resetPassword.form.passwordLabel')}
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder={t('resetPassword.form.passwordPlaceholder')}
                                    className="w-full pl-12 pr-12 py-3.5 bg-neutral-50 border-2 border-neutral-200 rounded-2xl focus:border-court-gold focus:bg-white transition-colors outline-none"
                                    autoComplete="new-password"
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? t('common.hidePassword') : t('common.showPassword')}
                                    title={showPassword ? t('common.hidePassword') : t('common.showPassword')}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                            <p className="text-xs text-neutral-500 mt-1.5">
                                {t('resetPassword.form.passwordHint')}
                            </p>
                        </div>

                        {/* Confirm Password Field */}
                        <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-2">
                                {t('resetPassword.form.confirmLabel')}
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
                                <input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder={t('resetPassword.form.confirmPlaceholder')}
                                    className="w-full pl-12 pr-12 py-3.5 bg-neutral-50 border-2 border-neutral-200 rounded-2xl focus:border-court-gold focus:bg-white transition-colors outline-none"
                                    autoComplete="new-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    aria-label={showConfirmPassword ? t('common.hidePassword') : t('common.showPassword')}
                                    title={showConfirmPassword ? t('common.hidePassword') : t('common.showPassword')}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-600 transition-colors"
                                >
                                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <StandardButton
                            size="xl"
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-4 mt-6"
                        >
                            {isLoading ? (
                                <>
                                    <Motion.div
                                        animate={prefersReducedMotion ? undefined : { rotate: 360 }}
                                        transition={prefersReducedMotion ? undefined : { duration: 1, repeat: Infinity, ease: "linear" }}
                                        className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                                    />
                                    {t('resetPassword.form.updating')}
                                </>
                            ) : (
                                <>
                                    <Shield className="w-5 h-5" />
                                    {t('resetPassword.form.submit')}
                                </>
                            )}
                        </StandardButton>
                    </form>
                </div>
            </Motion.div>
        </div>
    );
};

export default ResetPasswordPage;
