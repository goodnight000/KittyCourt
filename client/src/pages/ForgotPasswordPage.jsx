import React, { useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Cat, CheckCircle, Key, Lock, Mail, Send } from 'lucide-react';
import { resetPassword } from '../services/supabase';
import { useI18n } from '../i18n';
import StandardButton from '../components/shared/StandardButton';
import { validateEmail } from '../utils/helpers';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion';

const ForgotPasswordPage = () => {
    const { t } = useI18n();
    const prefersReducedMotion = usePrefersReducedMotion();
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!email) {
            setError(t('forgotPassword.errors.emailRequired'));
            return;
        }

        if (!validateEmail(email)) {
            setError(t('forgotPassword.errors.emailInvalid'));
            return;
        }

        setIsLoading(true);

        try {
            const { error } = await resetPassword(email);
            if (error) {
                // Don't reveal if email exists or not for security
                if (error.message?.includes('rate limit')) {
                    setError(t('forgotPassword.errors.rateLimit'));
                } else {
                    // Show success even if email doesn't exist (security best practice)
                    setSuccess(true);
                }
            } else {
                setSuccess(true);
            }
        } catch {
            setError(t('forgotPassword.errors.generic'));
        } finally {
            setIsLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 safe-top">
                {/* Background Decorations */}
                <div className="fixed inset-0 pointer-events-none overflow-hidden">
                    <Motion.div
                        animate={prefersReducedMotion ? undefined : { y: [0, -20, 0], rotate: [0, 5, 0] }}
                        transition={prefersReducedMotion ? undefined : { duration: 6, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute top-20 left-10 opacity-20"
                    >
                        <Mail className="w-10 h-10 text-amber-500" />
                    </Motion.div>
                    <Motion.div
                        animate={prefersReducedMotion ? undefined : { y: [0, 15, 0], rotate: [0, -5, 0] }}
                        transition={prefersReducedMotion ? undefined : { duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                        className="absolute top-40 right-16 opacity-20"
                    >
                        <Key className="w-8 h-8 text-amber-500" />
                    </Motion.div>
                </div>

                <Motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={prefersReducedMotion ? { duration: 0.1 } : undefined}
                    className="w-full max-w-md"
                >
                    <div className={`${prefersReducedMotion ? 'bg-white/95' : 'bg-white/82 backdrop-blur-md'} rounded-3xl p-8 shadow-xl border border-white/50 text-center`}>
                        <Motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={prefersReducedMotion ? { duration: 0.1 } : { type: "spring", delay: 0.2 }}
                            className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center"
                        >
                            <CheckCircle className="w-10 h-10 text-green-600" />
                        </Motion.div>

                        <h1 className="text-2xl font-bold text-neutral-800 mb-3">{t('forgotPassword.success.title')}</h1>
                        <p className="text-neutral-600 mb-2">
                            {t('forgotPassword.success.subtitle')}
                        </p>
                        <p className="text-court-brown font-medium mb-6">{email}</p>

                        <div className="bg-court-cream/50 rounded-2xl p-4 mb-6 text-left">
                            <p className="text-sm text-neutral-600 mb-2">
                                <strong>{t('forgotPassword.success.nextStepsTitle')}</strong>
                            </p>
                            <ol className="text-sm text-neutral-600 space-y-1 list-decimal list-inside">
                                <li>{t('forgotPassword.success.step1')}</li>
                                <li>{t('forgotPassword.success.step2')}</li>
                                <li>{t('forgotPassword.success.step3')}</li>
                            </ol>
                        </div>

                        <p className="text-xs text-neutral-500 mb-6">
                            {t('forgotPassword.success.resendPrompt')}{' '}
                            <button 
                                onClick={() => setSuccess(false)} 
                                className="text-court-brown hover:text-court-gold transition-colors font-medium"
                            >
                                {t('forgotPassword.success.resendLink')}
                            </button>
                        </p>

                        <Link
                            to="/signin"
                            className="inline-flex items-center gap-2 text-court-brown hover:text-court-gold transition-colors font-medium"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            {t('forgotPassword.success.backToSignIn')}
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
                    <Cat className="w-10 h-10 text-amber-600" />
                </Motion.div>
                <Motion.div
                    animate={prefersReducedMotion ? undefined : { y: [0, 15, 0], rotate: [0, -5, 0] }}
                    transition={prefersReducedMotion ? undefined : { duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                    className="absolute top-40 right-16 opacity-20"
                >
                    <Key className="w-8 h-8 text-amber-600" />
                </Motion.div>
            </div>

            {/* Back Button */}
            <Motion.div
                initial={{ opacity: 0, x: prefersReducedMotion ? 0 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={prefersReducedMotion ? { duration: 0.1 } : undefined}
                className="absolute top-6 left-6"
            >
                <Link
                    to="/signin"
                    className="flex items-center gap-2 text-neutral-600 hover:text-court-brown transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                    <span className="font-medium">{t('common.back')}</span>
                </Link>
            </Motion.div>

            {/* Header */}
            <Motion.div
                initial={{ opacity: 0, y: prefersReducedMotion ? 0 : -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={prefersReducedMotion ? { duration: 0.1 } : undefined}
                className="text-center mb-8"
            >
                <Motion.div
                    animate={prefersReducedMotion ? undefined : { y: [0, -8, 0] }}
                    transition={prefersReducedMotion ? undefined : { duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #C9A227 0%, #8B7019 100%)' }}
                >
                    <Lock className="w-10 h-10 text-white" />
                </Motion.div>
                <h1 className="text-3xl font-bold text-gradient font-display">{t('forgotPassword.title')}</h1>
                <p className="text-neutral-500 mt-2">{t('forgotPassword.subtitle')}</p>
            </Motion.div>

            {/* Reset Form */}
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
                            <div className="flex items-center gap-3">
                                <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                                <p className="text-red-600 text-sm">{error}</p>
                            </div>
                        </Motion.div>
                    )}

                    <p className="text-neutral-600 text-sm mb-6 text-center">
                        {t('forgotPassword.description')}
                    </p>

                    <form onSubmit={handleSubmit} noValidate className="space-y-4">
                        {/* Email Field */}
                        <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-2">
                                {t('forgotPassword.emailLabel')}
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder={t('forgotPassword.emailPlaceholder')}
                                    className="w-full pl-12 pr-4 py-3.5 bg-neutral-50 border-2 border-neutral-200 rounded-2xl focus:border-court-gold focus:bg-white transition-all outline-none"
                                    autoComplete="email"
                                    aria-invalid={error === t('forgotPassword.errors.emailInvalid') ? 'true' : 'false'}
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Submit Button */}
                        <StandardButton
                            size="xl"
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-4"
                        >
                            {isLoading ? (
                                <>
                                    <Motion.div
                                        animate={prefersReducedMotion ? undefined : { rotate: 360 }}
                                        transition={prefersReducedMotion ? undefined : { duration: 1, repeat: Infinity, ease: "linear" }}
                                        className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                                    />
                                    {t('forgotPassword.sending')}
                                </>
                            ) : (
                                <>
                                    <Send className="w-5 h-5" />
                                    {t('forgotPassword.submit')}
                                </>
                            )}
                        </StandardButton>
                    </form>

                    {/* Remember password? */}
                    <p className="text-center text-neutral-600 mt-6">
                        {t('forgotPassword.remember')}{' '}
                        <Link to="/signin" className="text-court-brown hover:text-court-gold transition-colors font-medium">
                            {t('forgotPassword.signIn')}
                        </Link>
                    </p>
                </div>
            </Motion.div>
        </div>
    );
};

export default ForgotPasswordPage;
