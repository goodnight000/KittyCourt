import React, { useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Cat, Check, Eye, EyeOff, Loader2, Lock, Mail, Star } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';
import { useI18n } from '../i18n';
import StandardButton from '../components/shared/StandardButton';
import ButtonLoader from '../components/shared/ButtonLoader';
import { validateEmail } from '../utils/helpers';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion';

const SignUpPage = () => {
    const navigate = useNavigate();
    const { t } = useI18n();
    const { signUp, signInWithGoogle } = useAuthStore();
    const prefersReducedMotion = usePrefersReducedMotion();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [emailConfirmationPending, setEmailConfirmationPending] = useState(null);

    const passwordRequirements = [
        { text: t('signUp.requirements.length'), met: password.length >= 8 },
    ];

    const allRequirementsMet = passwordRequirements.every(req => req.met);

    const handleEmailSignUp = async (e) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);
        const trimmedEmail = email.trim();

        if (!trimmedEmail || !password || !confirmPassword) {
            setError(t('signUp.errors.missingFields'));
            setIsSubmitting(false);
            return;
        }

        if (!validateEmail(trimmedEmail)) {
            setError(t('signUp.errors.invalidEmail'));
            setIsSubmitting(false);
            return;
        }

        if (password !== confirmPassword) {
            setError(t('signUp.errors.mismatch'));
            setIsSubmitting(false);
            return;
        }

        if (!allRequirementsMet) {
            setError(t('signUp.errors.requirements'));
            setIsSubmitting(false);
            return;
        }

        const { error, needsEmailConfirmation, email: signUpEmail } = await signUp(trimmedEmail, password);
        setIsSubmitting(false);
        if (error) {
            if (error.message.includes('already registered') || error.status === 422) {
                setError(t('signUp.errors.alreadyRegistered'));
            } else {
                setError(error.message || t('signUp.errors.generic'));
            }
            return;
        }

        if (needsEmailConfirmation) {
            // Show email confirmation pending UI
            setEmailConfirmationPending(signUpEmail);
            return;
        }

        setSuccess(true);
        // Force navigation to onboarding immediately to avoid any state race conditions
        navigate('/welcome');
    };

    const handleGoogleSignUp = async () => {
        setError('');
        setIsSubmitting(true);
        const { error } = await signInWithGoogle();
        setIsSubmitting(false);
        if (error) {
            setError(error.message || t('signUp.errors.generic'));
        }
    };

    // Show email confirmation pending UI
    if (emailConfirmationPending) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 safe-top">
                <Motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={prefersReducedMotion ? { duration: 0.1 } : undefined}
                    className="text-center max-w-md"
                >
                    <Motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={prefersReducedMotion ? { duration: 0.1 } : { type: 'spring', delay: 0.2 }}
                        className="w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, #C9A227 0%, #8B7019 100%)' }}
                    >
                        <Mail className="w-12 h-12 text-white" />
                    </Motion.div>
                    <h2 className="text-2xl font-bold text-neutral-800 mb-2">
                        {t('signUp.emailConfirmation.title')}
                    </h2>
                    <p className="text-neutral-600 mb-4">
                        {t('signUp.emailConfirmation.message', { email: emailConfirmationPending })}
                    </p>
                    <div className={`${prefersReducedMotion ? 'bg-white/95' : 'bg-white/82 backdrop-blur-md'} rounded-2xl p-4 border border-white/50 mb-6`}>
                        <p className="text-sm text-neutral-500">
                            {t('signUp.emailConfirmation.hint')}
                        </p>
                    </div>
                    <button
                        onClick={() => setEmailConfirmationPending(null)}
                        className="inline-flex items-center gap-2 text-sm font-semibold text-court-gold hover:text-court-goldDark transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        {t('signUp.emailConfirmation.tryDifferent')}
                    </button>
                </Motion.div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 safe-top">
                <Motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={prefersReducedMotion ? { duration: 0.1 } : undefined}
                    className="text-center"
                >
                    <Motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={prefersReducedMotion ? { duration: 0.1 } : { type: 'spring', delay: 0.2 }}
                        className="w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, #C9A227 0%, #8B7019 100%)' }}
                    >
                        <Check className="w-12 h-12 text-white" />
                    </Motion.div>
                    <h2 className="text-2xl font-bold text-neutral-800 mb-2">{t('signUp.success.title')}</h2>
                    <p className="text-neutral-500">{t('signUp.success.subtitle')}</p>
                    <Motion.div
                        animate={prefersReducedMotion ? undefined : { rotate: 360 }}
                        transition={prefersReducedMotion ? undefined : { duration: 2, repeat: Infinity, ease: "linear" }}
                        className="mt-6"
                    >
                        <Star className="w-6 h-6 text-court-gold mx-auto" />
                    </Motion.div>
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
                    className="absolute top-20 right-10 opacity-20"
                >
                    <Star className="w-9 h-9 text-amber-500" />
                </Motion.div>
                <Motion.div
                    animate={prefersReducedMotion ? undefined : { y: [0, 15, 0], rotate: [0, -5, 0] }}
                    transition={prefersReducedMotion ? undefined : { duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                    className="absolute bottom-32 left-16 opacity-20"
                >
                    <Cat className="w-8 h-8 text-amber-600" />
                </Motion.div>
            </div>

            {/* Logo & Header */}
            <Motion.div
                initial={{ opacity: 0, y: prefersReducedMotion ? 0 : -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={prefersReducedMotion ? { duration: 0.1 } : undefined}
                className="text-center mb-6"
            >
                <Motion.div
                    animate={prefersReducedMotion ? undefined : { y: [0, -8, 0] }}
                    transition={prefersReducedMotion ? undefined : { duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #C9A227 0%, #8B7019 100%)' }}
                >
                    <Cat className="w-10 h-10 text-white" />
                </Motion.div>
                <h1 className="text-3xl font-bold text-gradient font-display">{t('signUp.header.title')}</h1>
                <p className="text-neutral-500 mt-2">{t('signUp.header.subtitle')}</p>
            </Motion.div>

            {/* Sign Up Card */}
            <Motion.div
                initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={prefersReducedMotion ? { duration: 0.1 } : { delay: 0.1 }}
                className="w-full max-w-md"
            >
                <div className={`${prefersReducedMotion ? 'bg-white/95' : 'bg-white/82 backdrop-blur-md'} rounded-3xl p-8 shadow-xl border border-white/50`}>
                    {/* Error Message */}
                    {error && (
                        <Motion.div
                            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={prefersReducedMotion ? { duration: 0.1 } : undefined}
                            role="alert"
                            className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl"
                        >
                            <p className="text-red-600 text-sm text-center">{error}</p>
                        </Motion.div>
                    )}

                    {/* Google Sign Up */}
                    <Motion.button
                        whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
                        whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                        onClick={handleGoogleSignUp}
                        disabled={isSubmitting}
                        className="w-full py-3.5 bg-white border-2 border-neutral-200 rounded-2xl font-bold text-neutral-700 flex items-center justify-center gap-3 hover:bg-neutral-50 hover:border-neutral-300 transition-all disabled:opacity-50"
                    >
                        {isSubmitting ? (
                            <ButtonLoader size="sm" tone="neutral" />
                        ) : (
                            <>
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                {t('signUp.google')}
                            </>
                        )}
                    </Motion.button>

                    {/* Divider */}
                    <div className="flex items-center gap-4 my-6">
                        <div className="flex-1 h-px bg-neutral-200"></div>
                        <span className="text-neutral-500 text-sm">{t('common.or')}</span>
                        <div className="flex-1 h-px bg-neutral-200"></div>
                    </div>

                    {/* Email Form */}
                    <form onSubmit={handleEmailSignUp} noValidate className="space-y-4">
                        {/* Email Input */}
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder={t('signUp.emailPlaceholder')}
                                autoComplete="email"
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
                                placeholder={t('signUp.passwordPlaceholder')}
                                autoComplete="new-password"
                                className="w-full pl-12 pr-12 py-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl text-neutral-700 placeholder:text-neutral-500 focus:outline-none focus:border-court-gold focus:ring-2 focus:ring-court-gold/20 transition-all"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? t('common.hidePassword') : t('common.showPassword')}
                                title={showPassword ? t('common.hidePassword') : t('common.showPassword')}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-600"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>

                        {/* Password Requirements */}
                        {password && (
                            <Motion.div
                                initial={{ opacity: 0, y: prefersReducedMotion ? 0 : -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={prefersReducedMotion ? { duration: 0.1 } : { duration: 0.18, ease: 'easeOut' }}
                                className="space-y-1.5 pl-1"
                            >
                                {passwordRequirements.map((req, i) => (
                                    <div key={i} className="flex items-center gap-2 text-xs">
                                        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${req.met ? 'bg-green-500' : 'bg-neutral-200'}`}>
                                            {req.met && <Check className="w-2.5 h-2.5 text-white" />}
                                        </div>
                                        <span className={req.met ? 'text-green-600' : 'text-neutral-500'}>{req.text}</span>
                                    </div>
                                ))}
                            </Motion.div>
                        )}

                        {/* Confirm Password Input */}
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder={t('signUp.confirmPlaceholder')}
                                autoComplete="new-password"
                                className={`w-full pl-12 pr-4 py-3.5 bg-neutral-50 border rounded-2xl text-neutral-700 placeholder:text-neutral-500 focus:outline-none focus:ring-2 transition-all ${confirmPassword && password !== confirmPassword
                                    ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                                    : 'border-neutral-200 focus:border-court-gold focus:ring-court-gold/20'
                                    }`}
                            />
                        </div>

                        {/* Submit Button */}
                        <StandardButton
                            size="lg"
                            type="submit"
                            disabled={isSubmitting || !allRequirementsMet}
                            className="w-full py-3.5"
                        >
                            {isSubmitting ? (
                                <Motion.div
                                    animate={prefersReducedMotion ? undefined : { rotate: 360 }}
                                    transition={prefersReducedMotion ? undefined : { duration: 1, repeat: Infinity, ease: "linear" }}
                                >
                                    <Loader2 className="w-5 h-5" />
                                </Motion.div>
                            ) : (
                                <>
                                    {t('signUp.submit')}
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </StandardButton>
                    </form>

                    {/* Terms */}
                    <p className="mt-4 text-xs text-neutral-500 text-center">
                        {t('signUp.terms')}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500 text-center">
                        <a
                            href="/terms-of-service.html"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-court-gold hover:text-court-goldDark transition-colors"
                        >
                            {t('settings.legal.terms')}
                        </a>
                        {' · '}
                        <a
                            href="/privacy-policy.html"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-court-gold hover:text-court-goldDark transition-colors"
                        >
                            {t('settings.legal.privacy')}
                        </a>
                    </p>
                </div>

                {/* Sign In Link */}
                <Motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                className="mt-6 text-center text-neutral-600"
            >
                {t('signUp.alreadyHave')}{' '}
                <Link
                    to="/signin"
                    className="font-bold text-court-gold hover:text-court-goldDark transition-colors"
                >
                    {t('signUp.signIn')}
                </Link>
            </Motion.p>
            </Motion.div>
        </div>
    );
};

export default SignUpPage;
