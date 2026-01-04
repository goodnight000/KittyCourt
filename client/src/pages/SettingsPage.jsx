import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Mail, Shield, Bell, Globe, HelpCircle, FileText,
    ChevronRight, AlertTriangle, Scale, ExternalLink
} from 'lucide-react';
import useAuthStore from '../store/useAuthStore';
import { useI18n } from '../i18n';
import { SUPPORTED_LANGUAGE_CONFIG } from '../i18n/languageConfig';

const SettingsPage = () => {
    const navigate = useNavigate();
    const { t, language, setLanguage, supportedLanguages } = useI18n();
    const { user, hasPartner } = useAuthStore();

    const [showDisconnectModal, setShowDisconnectModal] = useState(false);
    const [showLanguagePicker, setShowLanguagePicker] = useState(false);

    // Notification toggles (local state for now - can be persisted later)
    const [notifications, setNotifications] = useState({
        dailyMeow: true,
        verdicts: true,
        partnerActivity: true,
    });

    // Derive login method from Supabase user
    const getLoginMethod = () => {
        const provider = user?.app_metadata?.provider;
        if (provider === 'google') return 'google';
        return 'email';
    };

    const loginMethod = getLoginMethod();

    const handleNotificationToggle = (key) => {
        setNotifications((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

    const handleLanguageChange = (langCode) => {
        setLanguage(langCode);
        setShowLanguagePicker(false);
    };

    const currentLanguageLabel = supportedLanguages?.find(l => l.code === language)?.nativeLabel || 'English';

    return (
        <div className="relative min-h-screen pb-6 overflow-hidden">
            {/* Background gradient */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-amber-200/30 blur-3xl" />
                <div className="absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-rose-200/25 blur-3xl" />
            </div>

            <div className="relative space-y-6">
                {/* Header */}
                <header className="flex items-center gap-3">
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate(-1)}
                        className="rounded-2xl border border-white/80 bg-white/80 p-2 shadow-soft"
                        aria-label={t('common.back')}
                    >
                        <ArrowLeft className="w-5 h-5 text-neutral-600" />
                    </motion.button>
                    <div className="flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-600">
                            {t('nav.profile')}
                        </p>
                        <h1 className="text-2xl font-display font-bold text-neutral-800">
                            {t('settings.title')}
                        </h1>
                    </div>
                </header>

                {/* Account Section */}
                <section className="glass-card p-4 space-y-3">
                    <h2 className="text-sm font-bold text-neutral-700 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-amber-600" />
                        {t('settings.account.title')}
                    </h2>

                    {/* Login Method */}
                    <div className="flex items-center justify-between py-2">
                        <span className="text-sm text-neutral-600">{t('settings.account.loginMethod')}</span>
                        <span className="text-sm font-medium text-neutral-800 flex items-center gap-2">
                            {loginMethod === 'google' && (
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                </svg>
                            )}
                            {loginMethod === 'email' && <Mail className="w-4 h-4 text-neutral-500" />}
                            {t(`settings.account.${loginMethod}`)}
                        </span>
                    </div>

                    {/* Change Password - only for email users */}
                    {loginMethod === 'email' && (
                        <motion.button
                            whileTap={{ scale: 0.98 }}
                            onClick={() => navigate('/forgot-password')}
                            className="w-full flex items-center justify-between py-3 px-3 rounded-2xl border border-white/80 bg-white/70"
                        >
                            <span className="text-sm text-neutral-700">{t('settings.account.changePassword')}</span>
                            <ChevronRight className="w-4 h-4 text-neutral-400" />
                        </motion.button>
                    )}

                    {/* Disconnect from Couple */}
                    {hasPartner && (
                        <motion.button
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setShowDisconnectModal(true)}
                            className="w-full flex items-center justify-between py-3 px-3 rounded-2xl border border-rose-200/70 bg-rose-50/50"
                        >
                            <span className="text-sm text-rose-600 font-medium">{t('settings.account.disconnectCouple')}</span>
                            <AlertTriangle className="w-4 h-4 text-rose-500" />
                        </motion.button>
                    )}
                </section>

                {/* Notifications Section */}
                <section className="glass-card p-4 space-y-3">
                    <h2 className="text-sm font-bold text-neutral-700 flex items-center gap-2">
                        <Bell className="w-4 h-4 text-amber-600" />
                        {t('settings.notifications.title')}
                    </h2>

                    {[
                        { key: 'dailyMeow', label: t('settings.notifications.dailyMeow') },
                        { key: 'verdicts', label: t('settings.notifications.verdicts') },
                        { key: 'partnerActivity', label: t('settings.notifications.partnerActivity') },
                    ].map(({ key, label }) => (
                        <div key={key} className="flex items-center justify-between py-2">
                            <span className="text-sm text-neutral-600">{label}</span>
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleNotificationToggle(key)}
                                className={`relative w-12 h-7 rounded-full transition-colors ${notifications[key]
                                        ? 'bg-gradient-to-r from-[#C9A227] to-[#8B7019]'
                                        : 'bg-neutral-200'
                                    }`}
                            >
                                <motion.div
                                    layout
                                    className="absolute top-1 w-5 h-5 rounded-full bg-white shadow-soft"
                                    style={{ left: notifications[key] ? 'calc(100% - 24px)' : '4px' }}
                                />
                            </motion.button>
                        </div>
                    ))}
                </section>

                {/* Preferences Section */}
                <section className="glass-card p-4 space-y-3">
                    <h2 className="text-sm font-bold text-neutral-700 flex items-center gap-2">
                        <Globe className="w-4 h-4 text-amber-600" />
                        {t('settings.preferences.title')}
                    </h2>

                    <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowLanguagePicker(true)}
                        className="w-full flex items-center justify-between py-3 px-3 rounded-2xl border border-white/80 bg-white/70"
                    >
                        <span className="text-sm text-neutral-700">{t('settings.preferences.language')}</span>
                        <span className="text-sm font-medium text-neutral-500 flex items-center gap-1">
                            {currentLanguageLabel}
                            <ChevronRight className="w-4 h-4 text-neutral-400" />
                        </span>
                    </motion.button>
                </section>

                {/* Support Section */}
                <section className="glass-card p-4 space-y-3">
                    <h2 className="text-sm font-bold text-neutral-700 flex items-center gap-2">
                        <HelpCircle className="w-4 h-4 text-amber-600" />
                        {t('settings.support.title')}
                    </h2>

                    {[
                        { key: 'contact', label: t('settings.support.contact'), href: 'mailto:support@pauseapp.com' },
                        { key: 'bug', label: t('settings.support.bug'), href: 'mailto:bugs@pauseapp.com?subject=Bug Report' },
                        { key: 'feature', label: t('settings.support.feature'), href: 'mailto:feedback@pauseapp.com?subject=Feature Suggestion' },
                    ].map(({ key, label, href }) => (
                        <a
                            key={key}
                            href={href}
                            className="w-full flex items-center justify-between py-3 px-3 rounded-2xl border border-white/80 bg-white/70"
                        >
                            <span className="text-sm text-neutral-700">{label}</span>
                            <ExternalLink className="w-4 h-4 text-neutral-400" />
                        </a>
                    ))}
                </section>

                {/* Legal Section */}
                <section className="glass-card p-4 space-y-3">
                    <h2 className="text-sm font-bold text-neutral-700 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-amber-600" />
                        {t('settings.legal.title')}
                    </h2>

                    {[
                        { key: 'terms', label: t('settings.legal.terms'), href: 'https://pauseapp.com/terms' },
                        { key: 'privacy', label: t('settings.legal.privacy'), href: 'https://pauseapp.com/privacy' },
                    ].map(({ key, label, href }) => (
                        <a
                            key={key}
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full flex items-center justify-between py-3 px-3 rounded-2xl border border-white/80 bg-white/70"
                        >
                            <span className="text-sm text-neutral-700">{label}</span>
                            <ExternalLink className="w-4 h-4 text-neutral-400" />
                        </a>
                    ))}

                    <div className="flex items-center justify-between py-2 px-3">
                        <span className="text-sm text-neutral-600">{t('settings.legal.version')}</span>
                        <span className="text-sm font-mono text-neutral-400">1.0.0</span>
                    </div>
                </section>

                {/* How It Works Section */}
                <section className="glass-card p-4 space-y-3 relative overflow-hidden">
                    <div className="absolute -top-8 -right-8 h-20 w-20 rounded-full bg-amber-200/35 blur-2xl" />
                    <h2 className="text-sm font-bold text-neutral-700 flex items-center gap-2 relative">
                        <Scale className="w-4 h-4 text-amber-600" />
                        {t('settings.howItWorks.title')}
                    </h2>
                    <p className="text-sm text-neutral-600 leading-relaxed relative">
                        {t('settings.howItWorks.description')}
                    </p>
                </section>
            </div>

            {/* Disconnect Modal */}
            <AnimatePresence>
                {showDisconnectModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
                        onClick={() => setShowDisconnectModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="glass-card p-6 max-w-sm w-full space-y-4"
                        >
                            <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100/80 border border-rose-200/70">
                                    <AlertTriangle className="w-6 h-6 text-rose-600" />
                                </div>
                                <h3 className="font-display font-bold text-neutral-800">
                                    {t('settings.account.disconnectCouple')}
                                </h3>
                            </div>
                            <p className="text-sm text-neutral-600">
                                {t('settings.account.disconnectWarning')}
                            </p>
                            <div className="flex gap-3">
                                <motion.button
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setShowDisconnectModal(false)}
                                    className="flex-1 py-3 rounded-2xl border border-white/80 bg-white/90 text-sm font-bold text-neutral-600"
                                >
                                    {t('settings.account.disconnectCancel')}
                                </motion.button>
                                <motion.button
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => {
                                        // Logic will be implemented by user
                                        setShowDisconnectModal(false);
                                    }}
                                    className="flex-1 py-3 rounded-2xl bg-rose-500 text-sm font-bold text-white shadow-soft"
                                >
                                    {t('settings.account.disconnectConfirm')}
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Language Picker Modal */}
            <AnimatePresence>
                {showLanguagePicker && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
                        onClick={() => setShowLanguagePicker(false)}
                    >
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            onClick={(e) => e.stopPropagation()}
                            className="glass-card w-full max-w-lg rounded-b-none p-6 space-y-4"
                        >
                            <h3 className="font-display font-bold text-neutral-800 text-center">
                                {t('settings.preferences.language')}
                            </h3>
                            <div className="space-y-2">
                                {(supportedLanguages || SUPPORTED_LANGUAGE_CONFIG).map((lang) => (
                                    <motion.button
                                        key={lang.code}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => handleLanguageChange(lang.code)}
                                        className={`w-full flex items-center justify-between py-4 px-4 rounded-2xl border transition-colors ${language === lang.code
                                                ? 'border-amber-300 bg-amber-50/70'
                                                : 'border-white/80 bg-white/70'
                                            }`}
                                    >
                                        <span className="text-sm font-medium text-neutral-800">{lang.nativeLabel}</span>
                                        <span className="text-xs text-neutral-500">{lang.label}</span>
                                    </motion.button>
                                ))}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SettingsPage;
