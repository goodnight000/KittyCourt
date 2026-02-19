import React, { useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useI18n } from '../../i18n';
import ButtonLoader from '../shared/ButtonLoader';

const AuthStep = ({
    onGoogleSignUp,
    onEmailSignUp,
    authError = null,
    authSubmitting = false
}) => {
    const { t } = useI18n();
    const navigate = useNavigate();
    const [authEmail, setAuthEmail] = useState('');
    const [authPassword, setAuthPassword] = useState('');
    const [authConfirmPassword, setAuthConfirmPassword] = useState('');
    const [authShowPassword, setAuthShowPassword] = useState(false);

    const goldButtonBase =
        'relative overflow-hidden border border-[#E3D098] bg-gradient-to-br from-[#C9A227] via-[#B9911F] to-[#8B7019] shadow-[0_12px_24px_rgba(201,162,39,0.22)] hover:brightness-105';
    const goldButtonShineStyle = {
        background: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.65), transparent 55%)'
    };

    const handleEmailSubmit = (e) => {
        e?.preventDefault?.();
        onEmailSignUp(authEmail, authPassword, authConfirmPassword);
    };

    return (
        <Motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            {authError && (
                <div role="alert" className="glass-card p-4 border border-[#E2D6C7] text-[#6B4F3C] text-sm">
                    {authError}
                </div>
            )}

            <Motion.button
                whileTap={{ scale: 0.98 }}
                onClick={onGoogleSignUp}
                disabled={authSubmitting}
                className="w-full py-4 bg-white/90 border border-white/80 rounded-2xl font-bold text-neutral-700 flex items-center justify-center gap-3 hover:bg-white transition-all disabled:opacity-50 shadow-soft"
            >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                {t('onboarding.auth.continueWithGoogle')}
            </Motion.button>

            <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-neutral-200" />
                <span className="text-neutral-500 text-sm">{t('common.or')}</span>
                <div className="flex-1 h-px bg-neutral-200" />
            </div>

            <form onSubmit={handleEmailSubmit} noValidate className="space-y-4">
                <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
                    <input
                        type="email"
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        placeholder={t('onboarding.auth.emailPlaceholder')}
                        className="w-full pl-12 pr-4 py-4 bg-white/90 border border-white/80 rounded-2xl text-neutral-700 text-base placeholder:text-neutral-500 focus:outline-none focus:border-[#D2BC76] focus:ring-2 focus:ring-[#F1E3B6] transition-all shadow-inner-soft"
                        autoComplete="email"
                        autoFocus
                    />
                </div>

                <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
                    <input
                        type={authShowPassword ? 'text' : 'password'}
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        placeholder={t('onboarding.auth.passwordPlaceholder')}
                        className="w-full pl-12 pr-12 py-4 bg-white/90 border border-white/80 rounded-2xl text-neutral-700 text-base placeholder:text-neutral-500 focus:outline-none focus:border-[#D2BC76] focus:ring-2 focus:ring-[#F1E3B6] transition-all shadow-inner-soft"
                        autoComplete="new-password"
                    />
                    <button
                        type="button"
                        onClick={() => setAuthShowPassword(!authShowPassword)}
                        aria-label={authShowPassword ? t('common.hidePassword') : t('common.showPassword')}
                        title={authShowPassword ? t('common.hidePassword') : t('common.showPassword')}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-600"
                    >
                        {authShowPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                </div>

                <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
                    <input
                        type={authShowPassword ? 'text' : 'password'}
                        value={authConfirmPassword}
                        onChange={(e) => setAuthConfirmPassword(e.target.value)}
                        placeholder={t('onboarding.auth.confirmPasswordPlaceholder')}
                        className="w-full pl-12 pr-4 py-4 bg-white/90 border border-white/80 rounded-2xl text-neutral-700 text-base placeholder:text-neutral-500 focus:outline-none focus:border-[#D2BC76] focus:ring-2 focus:ring-[#F1E3B6] transition-all shadow-inner-soft"
                        autoComplete="new-password"
                    />
                </div>

                <Motion.button
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={authSubmitting}
                    className={`w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50 ${goldButtonBase}`}
                >
                    <span aria-hidden="true" className="absolute inset-0 opacity-60" style={goldButtonShineStyle} />
                    <span className="relative z-10 flex items-center gap-2">
                        {authSubmitting ? (
                            <ButtonLoader
                                size="sm"
                                tone="white"
                            />
                        ) : (
                            <>
                                {t('onboarding.auth.createAccount')}
                                <ArrowRight className="w-5 h-5" />
                            </>
                        )}
                    </span>
                </Motion.button>
            </form>

            <button
                onClick={() => navigate('/signin')}
                className="w-full text-center text-sm font-semibold text-court-brown hover:text-[#8B7019] transition-colors"
            >
                {t('onboarding.welcome.signInPrompt')}
            </button>
        </Motion.div>
    );
};

export default AuthStep;
