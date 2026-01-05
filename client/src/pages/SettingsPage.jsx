import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Mail, Shield, Bell, Globe, HelpCircle, FileText,
    ChevronRight, AlertTriangle, Scale, ExternalLink
} from 'lucide-react';
import useAuthStore from '../store/useAuthStore';
import { useI18n } from '../i18n';
import { SUPPORTED_LANGUAGE_CONFIG } from '../i18n/languageConfig';
import api from '../services/api';

const SettingsPage = () => {
    const navigate = useNavigate();
    const { t, language, setLanguage, supportedLanguages } = useI18n();
    const { user, hasPartner } = useAuthStore();

    const [showDisconnectModal, setShowDisconnectModal] = useState(false);
    const [showLanguagePicker, setShowLanguagePicker] = useState(false);

    // Notification toggles (connected to API)
    const [notifications, setNotifications] = useState({
        dailyQuestions: true,
        eventReminders: true,
        partnerActivity: true,
    });
    const [loadingPrefs, setLoadingPrefs] = useState(true);

    // Load notification preferences on mount
    useEffect(() => {
        const loadPreferences = async () => {
            try {
                const response = await api.get('/notifications/preferences');
                setNotifications({
                    dailyQuestions: response.data.dailyQuestions ?? true,
                    eventReminders: response.data.eventReminders ?? true,
                    partnerActivity: response.data.partnerActivity ?? true,
                });
            } catch (error) {
                console.error('Failed to load notification preferences:', error);
            } finally {
                setLoadingPrefs(false);
            }
        };
        loadPreferences();
    }, []);

    // Derive login method from Supabase user
    const getLoginMethod = () => {
        const provider = user?.app_metadata?.provider;
        if (provider === 'google') return 'google';
        return 'email';
    };

    const loginMethod = getLoginMethod();

    const handleNotificationToggle = async (key) => {
        const newValue = !notifications[key];
        setNotifications(prev => ({ ...prev, [key]: newValue }));

        try {
            await api.put('/notifications/preferences', {
                [key]: newValue
            });
        } catch (error) {
            // Revert on error
            setNotifications(prev => ({ ...prev, [key]: !newValue }));
            console.error('Failed to save notification preference:', error);
        }
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
                        { key: 'dailyQuestions', label: t('settings.notifications.dailyMeow') },
                        { key: 'eventReminders', label: t('settings.notifications.eventReminders') },
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

                    <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => navigate('/feedback')}
                        className="w-full flex items-center justify-between py-3 px-3 rounded-2xl border border-white/80 bg-white/70"
                    >
                        <span className="text-sm text-neutral-700">{t('settings.support.sendFeedback')}</span>
                        <ChevronRight className="w-4 h-4 text-neutral-400" />
                    </motion.button>
                </section>

                {/* Legal Section */}
                <section className="glass-card p-4 space-y-3">
                    <h2 className="text-sm font-bold text-neutral-700 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-amber-600" />
                        {t('settings.legal.title')}
                    </h2>

                    {[
                        { key: 'terms', label: t('settings.legal.terms'), href: '/terms-of-service.html' },
                        { key: 'privacy', label: t('settings.legal.privacy'), href: '/privacy-policy.html' },
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

            {/* Language Picker Modal - Premium Centered Design */}
            <AnimatePresence>
                {showLanguagePicker && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4"
                        onClick={() => setShowLanguagePicker(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            onClick={(e) => e.stopPropagation()}
                            className="relative w-full max-w-sm overflow-hidden"
                        >
                            {/* Decorative background glow */}
                            <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-amber-300/30 blur-3xl pointer-events-none" />
                            <div className="absolute -bottom-20 -left-20 w-40 h-40 rounded-full bg-rose-300/20 blur-3xl pointer-events-none" />

                            {/* Card content */}
                            <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl p-6 shadow-2xl border border-white/80">
                                {/* Header */}
                                <div className="text-center mb-6">
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                                        className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-100 to-rose-100 flex items-center justify-center mx-auto mb-3 shadow-soft"
                                    >
                                        <Globe className="w-7 h-7 text-amber-600" />
                                    </motion.div>
                                    <h3 className="text-xl font-display font-bold text-neutral-800">
                                        {t('settings.preferences.language')}
                                    </h3>
                                    <p className="text-sm text-neutral-500 mt-1">
                                        Choose your preferred language
                                    </p>
                                </div>

                                {/* Language options with staggered animation */}
                                <div className="space-y-3">
                                    {(supportedLanguages || SUPPORTED_LANGUAGE_CONFIG).map((lang, index) => {
                                        const isSelected = language === lang.code;
                                        const flagEmoji = lang.code === 'en' ? '🇺🇸' : lang.code === 'zh-Hans' ? '🇨🇳' : '🌐';

                                        return (
                                            <motion.button
                                                key={lang.code}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: 0.15 + index * 0.05 }}
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                                onClick={() => handleLanguageChange(lang.code)}
                                                className={`w-full flex items-center gap-4 py-4 px-4 rounded-2xl border-2 transition-all ${isSelected
                                                        ? 'border-amber-400 bg-gradient-to-r from-amber-50 to-rose-50/50 shadow-soft'
                                                        : 'border-neutral-100 bg-white hover:border-amber-200 hover:bg-amber-50/30'
                                                    }`}
                                            >
                                                {/* Flag emoji */}
                                                <span className="text-2xl">{flagEmoji}</span>

                                                {/* Language names */}
                                                <div className="flex-1 text-left">
                                                    <p className={`font-semibold ${isSelected ? 'text-amber-700' : 'text-neutral-800'}`}>
                                                        {lang.nativeLabel}
                                                    </p>
                                                    <p className="text-xs text-neutral-500">{lang.label}</p>
                                                </div>

                                                {/* Checkmark with animation */}
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${isSelected
                                                        ? 'bg-gradient-to-br from-amber-400 to-[#8B7019]'
                                                        : 'bg-neutral-100'
                                                    }`}>
                                                    {isSelected && (
                                                        <motion.svg
                                                            initial={{ scale: 0 }}
                                                            animate={{ scale: 1 }}
                                                            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                                            className="w-3.5 h-3.5 text-white"
                                                            fill="none"
                                                            viewBox="0 0 24 24"
                                                            stroke="currentColor"
                                                            strokeWidth={3}
                                                        >
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                        </motion.svg>
                                                    )}
                                                </div>
                                            </motion.button>
                                        );
                                    })}
                                </div>

                                {/* Close hint */}
                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.4 }}
                                    className="text-center text-xs text-neutral-400 mt-5"
                                >
                                    Tap outside to close
                                </motion.p>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SettingsPage;
