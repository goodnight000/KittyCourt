import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    Mail, Shield, Bell, Globe, HelpCircle, FileText,
    ChevronRight, AlertTriangle, ExternalLink, Heart, Download, X
} from 'lucide-react';
import useAuthStore from '../store/useAuthStore';
import usePartnerStore from '../store/usePartnerStore';
import { translate, useI18n } from '../i18n';
import { SUPPORTED_LANGUAGE_CONFIG } from '../i18n/languageConfig';
import OptionsStep from '../components/onboarding/OptionsStep';
import api from '../services/api';
import LiquidGlassPopup from '../components/shared/LiquidGlassPopup';
import BackButton from '../components/shared/BackButton';
import StandardButton from '../components/shared/StandardButton';
import ButtonLoader from '../components/shared/ButtonLoader';

const LOVE_LANGUAGE_OPTIONS = [
    { id: 'words', emoji: '💬', labelKey: 'options.loveLanguage.words', descKey: 'options.loveLanguage.wordsDesc' },
    { id: 'acts', emoji: '🎁', labelKey: 'options.loveLanguage.acts', descKey: 'options.loveLanguage.actsDesc' },
    { id: 'gifts', emoji: '🎀', labelKey: 'options.loveLanguage.gifts', descKey: 'options.loveLanguage.giftsDesc' },
    { id: 'time', emoji: '⏰', labelKey: 'options.loveLanguage.time', descKey: 'options.loveLanguage.timeDesc' },
    { id: 'touch', emoji: '🤗', labelKey: 'options.loveLanguage.touch', descKey: 'options.loveLanguage.touchDesc' },
];

const COMMUNICATION_STYLE_OPTIONS = [
    { id: 'direct', emoji: '🎯', labelKey: 'options.communicationStyle.direct', descKey: 'options.communicationStyle.directDesc' },
    { id: 'processing', emoji: '🧠', labelKey: 'options.communicationStyle.processing', descKey: 'options.communicationStyle.processingDesc' },
    { id: 'emotional', emoji: '💖', labelKey: 'options.communicationStyle.emotional', descKey: 'options.communicationStyle.emotionalDesc' },
    { id: 'logical', emoji: '📊', labelKey: 'options.communicationStyle.logical', descKey: 'options.communicationStyle.logicalDesc' },
    { id: 'avoidant', emoji: '🐢', labelKey: 'options.communicationStyle.avoidant', descKey: 'options.communicationStyle.avoidantDesc' },
];

const CONFLICT_STYLE_OPTIONS = [
    { id: 'talk', emoji: '🗣️', labelKey: 'options.conflictStyle.talk', descKey: 'options.conflictStyle.talkDesc' },
    { id: 'space', emoji: '🌙', labelKey: 'options.conflictStyle.space', descKey: 'options.conflictStyle.spaceDesc' },
    { id: 'write', emoji: '✍️', labelKey: 'options.conflictStyle.write', descKey: 'options.conflictStyle.writeDesc' },
    { id: 'physical', emoji: '🏃', labelKey: 'options.conflictStyle.physical', descKey: 'options.conflictStyle.physicalDesc' },
    { id: 'distract', emoji: '🎮', labelKey: 'options.conflictStyle.distract', descKey: 'options.conflictStyle.distractDesc' },
];

const DATE_ACTIVITY_OPTIONS = [
    { id: 'dining', emoji: '🍽️', labelKey: 'options.dateActivities.dining' },
    { id: 'cooking', emoji: '👨‍🍳', labelKey: 'options.dateActivities.cooking' },
    { id: 'movies', emoji: '🎬', labelKey: 'options.dateActivities.movies' },
    { id: 'outdoors', emoji: '🌲', labelKey: 'options.dateActivities.outdoors' },
    { id: 'travel', emoji: '✈️', labelKey: 'options.dateActivities.travel' },
    { id: 'gaming', emoji: '🎮', labelKey: 'options.dateActivities.gaming' },
    { id: 'music', emoji: '🎵', labelKey: 'options.dateActivities.music' },
    { id: 'arts', emoji: '🎨', labelKey: 'options.dateActivities.arts' },
    { id: 'sports', emoji: '⚽', labelKey: 'options.dateActivities.sports' },
    { id: 'relaxing', emoji: '🛋️', labelKey: 'options.dateActivities.relaxing' },
    { id: 'fitness', emoji: '💪', labelKey: 'options.dateActivities.fitness' },
    { id: 'shopping', emoji: '🛍️', labelKey: 'options.dateActivities.shopping' },
];

const PET_PEEVES_OPTIONS = [
    { id: 'lateness', emoji: '⏰', labelKey: 'options.petPeeves.lateness' },
    { id: 'phone', emoji: '📱', labelKey: 'options.petPeeves.phone' },
    { id: 'mess', emoji: '🧹', labelKey: 'options.petPeeves.mess' },
    { id: 'interrupting', emoji: '🤐', labelKey: 'options.petPeeves.interrupting' },
    { id: 'forgetful', emoji: '🤔', labelKey: 'options.petPeeves.forgetful' },
    { id: 'passive', emoji: '😶', labelKey: 'options.petPeeves.passive' },
    { id: 'plans', emoji: '📅', labelKey: 'options.petPeeves.plans' },
    { id: 'chewing', emoji: '😬', labelKey: 'options.petPeeves.chewing' },
    { id: 'dishes', emoji: '🍽️', labelKey: 'options.petPeeves.dishes' },
    { id: 'silent', emoji: '🤫', labelKey: 'options.petPeeves.silent' },
];

const APPRECIATION_STYLE_OPTIONS = [
    { id: 'public', emoji: '📢', labelKey: 'options.appreciationStyle.public', descKey: 'options.appreciationStyle.publicDesc' },
    { id: 'private', emoji: '💌', labelKey: 'options.appreciationStyle.private', descKey: 'options.appreciationStyle.privateDesc' },
    { id: 'reciprocate', emoji: '🔄', labelKey: 'options.appreciationStyle.reciprocate', descKey: 'options.appreciationStyle.reciprocateDesc' },
    { id: 'none', emoji: '😊', labelKey: 'options.appreciationStyle.none', descKey: 'options.appreciationStyle.noneDesc' },
];

const formatCustomOptionLabel = (value) => {
    const trimmed = String(value || '').replace(/^custom_/, '').replace(/_/g, ' ').trim();
    if (!trimmed) return value;
    return trimmed.replace(/\b\w/g, (char) => char.toUpperCase());
};

const SettingsPage = () => {
    const navigate = useNavigate();
    const { t, language, setLanguage, supportedLanguages } = useI18n();
    const { user, profile, refreshProfile } = useAuthStore();
    const { hasPartner } = usePartnerStore();

    const [showDisconnectModal, setShowDisconnectModal] = useState(false);
    const [showLanguagePicker, setShowLanguagePicker] = useState(false);
    const [showDisconnectRequiredModal, setShowDisconnectRequiredModal] = useState(false);
    const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
    const [showRelationshipModal, setShowRelationshipModal] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDisconnecting, setIsDisconnecting] = useState(false);
    const [pendingLanguage, setPendingLanguage] = useState(language);
    const [relationshipSaving, setRelationshipSaving] = useState(false);
    const [relationshipError, setRelationshipError] = useState(null);
    const [relationshipForm, setRelationshipForm] = useState(() => ({
        loveLanguage: profile?.love_language || '',
        communicationStyle: profile?.communication_style || '',
        conflictStyle: profile?.conflict_style || '',
        favoriteDateActivities: profile?.favorite_date_activities || [],
        petPeeves: profile?.pet_peeves || [],
        appreciationStyle: profile?.appreciation_style || '',
        bio: profile?.bio || '',
    }));
    const [exportEmail, setExportEmail] = useState(() => profile?.email || user?.email || '');
    const [exportRequest, setExportRequest] = useState(null);
    const [exportError, setExportError] = useState(null);
    const [exportNotice, setExportNotice] = useState(null);
    const [exportLoading, setExportLoading] = useState(true);
    const [exportSubmitting, setExportSubmitting] = useState(false);
    const [notificationSaving, setNotificationSaving] = useState({});

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

    useEffect(() => {
        if (showLanguagePicker) {
            setPendingLanguage(language);
        }
    }, [showLanguagePicker, language]);

    useEffect(() => {
        if (!showRelationshipModal) {
            setRelationshipForm({
                loveLanguage: profile?.love_language || '',
                communicationStyle: profile?.communication_style || '',
                conflictStyle: profile?.conflict_style || '',
                favoriteDateActivities: profile?.favorite_date_activities || [],
                petPeeves: profile?.pet_peeves || [],
                appreciationStyle: profile?.appreciation_style || '',
                bio: profile?.bio || '',
            });
        }
        setExportEmail((current) => current || profile?.email || user?.email || '');
    }, [profile, user?.email, showRelationshipModal]);

    useEffect(() => {
        const loadExportStatus = async () => {
            setExportLoading(true);
            setExportError(null);
            try {
                const response = await api.get('/exports', { params: { limit: 1 } });
                const latest = response.data?.requests?.[0] || null;
                setExportRequest(latest);
            } catch (error) {
                console.error('Failed to load export status:', error);
                setExportError(t('settings.export.loadError', 'Failed to load export status'));
            } finally {
                setExportLoading(false);
            }
        };
        loadExportStatus();
    }, [t]);

    const mergeCustomOptions = useMemo(() => (options, selections) => {
        const selectedValues = Array.isArray(selections) ? selections : [];
        const optionIds = new Set(options.map((opt) => opt.id));
        const customItems = selectedValues
            .filter((value) => !optionIds.has(value))
            .map((value) => ({
                id: value,
                emoji: '✨',
                label: formatCustomOptionLabel(value),
            }));
        return options.concat(customItems);
    }, []);

    const dateActivityOptions = useMemo(
        () => mergeCustomOptions(DATE_ACTIVITY_OPTIONS, relationshipForm.favoriteDateActivities),
        [mergeCustomOptions, relationshipForm.favoriteDateActivities]
    );

    const petPeeveOptions = useMemo(
        () => mergeCustomOptions(PET_PEEVES_OPTIONS, relationshipForm.petPeeves),
        [mergeCustomOptions, relationshipForm.petPeeves]
    );

    // Derive login method from Supabase user
    const getLoginMethod = () => {
        const provider = user?.app_metadata?.provider;
        if (provider === 'google') return 'google';
        return 'email';
    };

    const loginMethod = getLoginMethod();

    const handleNotificationToggle = async (key) => {
        if (notificationSaving[key]) return;
        setNotificationSaving((prev) => ({ ...prev, [key]: true }));
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
        } finally {
            setNotificationSaving((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
        }
    };

    const handleLanguageChange = (langCode) => {
        setPendingLanguage(langCode);
    };

    const handleLanguageConfirm = () => {
        if (pendingLanguage && pendingLanguage !== language) {
            setLanguage(pendingLanguage);
        }
        setShowLanguagePicker(false);
    };

    const currentLanguageLabel = supportedLanguages?.find(l => l.code === language)?.nativeLabel || 'English';
    const hasLanguageChange = pendingLanguage && pendingLanguage !== language;
    const exportEmailValid = exportEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(exportEmail);
    const exportStatusLabels = {
        queued: t('settings.export.statusQueued', 'Queued'),
        processing: t('settings.export.statusProcessing', 'Processing'),
        ready: t('settings.export.statusReady', 'Ready to email'),
        failed: t('settings.export.statusFailed', 'Failed'),
    };
    const emailStatusLabels = {
        pending: t('settings.export.emailStatusPending', 'Email pending'),
        stubbed: t('settings.export.emailStatusStubbed', 'Email delivery not configured'),
        sent: t('settings.export.emailStatusSent', 'Email sent'),
        failed: t('settings.export.emailStatusFailed', 'Email failed'),
    };

    const handleRelationshipToggle = (field, optionId) => {
        setRelationshipForm((prev) => {
            const current = Array.isArray(prev[field]) ? prev[field] : [];
            const next = current.includes(optionId)
                ? current.filter((id) => id !== optionId)
                : [...current, optionId];
            return { ...prev, [field]: next };
        });
    };

    const handleRelationshipSave = async () => {
        setRelationshipSaving(true);
        setRelationshipError(null);
        try {
            const payload = {
                loveLanguage: relationshipForm.loveLanguage || null,
                communicationStyle: relationshipForm.communicationStyle || null,
                conflictStyle: relationshipForm.conflictStyle || null,
                favoriteDateActivities: relationshipForm.favoriteDateActivities || [],
                petPeeves: relationshipForm.petPeeves || [],
                appreciationStyle: relationshipForm.appreciationStyle || null,
                bio: relationshipForm.bio || null,
            };
            await api.patch('/profile/preferences', payload);
            await refreshProfile();
            setShowRelationshipModal(false);
        } catch (error) {
            console.error('Failed to save relationship preferences:', error);
            setRelationshipError(t('settings.relationship.saveError', 'Could not save preferences'));
        } finally {
            setRelationshipSaving(false);
        }
    };

    const handleExportRequest = async () => {
        setExportError(null);
        setExportNotice(null);
        if (!exportEmailValid) {
            setExportError(t('settings.export.invalidEmail', 'Enter a valid email address.'));
            return;
        }
        setExportSubmitting(true);
        try {
            const response = await api.post('/exports', { email: exportEmail });
            const request = response.data?.request || null;
            if (request) {
                setExportRequest(request);
            }
            setExportNotice(t('settings.export.success', 'Export requested. We will email you when it is ready.'));
        } catch (error) {
            console.error('Failed to request export:', error);
            setExportError(error?.response?.data?.error || t('settings.export.requestError', 'Failed to request export'));
        } finally {
            setExportSubmitting(false);
        }
    };

    return (
        <div className="relative min-h-screen pb-6">
            <div className="relative space-y-6">
                {/* Header */}
                <header className="flex items-center gap-3">
                    <BackButton onClick={() => navigate(-1)} ariaLabel={t('common.back')} />
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
                            <ChevronRight className="w-4 h-4 text-neutral-500" />
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
                    ].map(({ key, label }) => {
                        const isSaving = !!notificationSaving[key];
                        return (
                            <div key={key} className="flex items-center justify-between py-1.5">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-neutral-600">{label}</span>
                                    {isSaving && <ButtonLoader size="sm" tone="amber" variant="dots" />}
                                </div>
                                <motion.button
                                    type="button"
                                    whileTap={{ scale: isSaving ? 1 : 0.95 }}
                                    onClick={() => handleNotificationToggle(key)}
                                    role="switch"
                                    aria-checked={!!notifications[key]}
                                    disabled={isSaving}
                                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center bg-transparent p-0 disabled:opacity-60"
                                >
                                    <span
                                        className={`relative inline-flex h-6 w-11 items-center overflow-hidden rounded-full p-[3px] transition-colors ${notifications[key]
                                            ? 'bg-gradient-to-r from-[#C9A227] to-[#8B7019]'
                                            : 'bg-neutral-200'
                                            }`}
                                    >
                                        <motion.span
                                            animate={{ x: notifications[key] ? 20 : 0 }}
                                            transition={{ type: 'spring', stiffness: 520, damping: 34 }}
                                            className="h-[18px] w-[18px] rounded-full bg-white shadow-soft"
                                        />
                                    </span>
                                </motion.button>
                            </div>
                        );
                    })}
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
                        <span className="text-sm text-neutral-700">{currentLanguageLabel}</span>
                        <ChevronRight className="w-4 h-4 text-neutral-500" />
                    </motion.button>
                </section>

                {/* Relationship Preferences Section */}
                <section className="glass-card p-4 space-y-3">
                    <h2 className="text-sm font-bold text-neutral-700 flex items-center gap-2">
                        <Heart className="w-4 h-4 text-amber-600" />
                        {t('settings.relationship.title', 'Relationship Preferences')}
                    </h2>
                    <p className="text-xs text-neutral-500">
                        {t('settings.relationship.description', 'Tune how we personalize prompts, insights, and suggestions.')}
                    </p>
                    <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowRelationshipModal(true)}
                        className="w-full flex items-center justify-between py-3 px-3 rounded-2xl border border-white/80 bg-white/70"
                    >
                        <span className="text-sm text-neutral-700">{t('settings.relationship.edit', 'Edit preferences')}</span>
                        <ChevronRight className="w-4 h-4 text-neutral-500" />
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
                        <ChevronRight className="w-4 h-4 text-neutral-500" />
                    </motion.button>
                </section>

                {/* Data Export Section */}
                <section className="glass-card p-4 space-y-3">
                    <h2 className="text-sm font-bold text-neutral-700 flex items-center gap-2">
                        <Download className="w-4 h-4 text-amber-600" />
                        {t('settings.export.title', 'Data Export')}
                    </h2>
                    <p className="text-xs text-neutral-500">
                        {t('settings.export.description', 'Request a copy of your data and we will email you a download link.')}
                    </p>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-neutral-500">
                            {t('settings.export.emailLabel', 'Send to email')}
                        </label>
                        <input
                            type="email"
                            value={exportEmail}
                            onChange={(e) => setExportEmail(e.target.value)}
                            placeholder={t('settings.export.emailPlaceholder', 'you@example.com')}
                            className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white/80 text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-amber-200"
                        />
                    </div>

                    {exportError && (
                        <p className="text-xs text-rose-600">{exportError}</p>
                    )}
                    {exportNotice && (
                        <p className="text-xs text-emerald-600">{exportNotice}</p>
                    )}

                    {exportLoading ? (
                        <p className="text-xs text-neutral-500">{t('common.loading', 'Loading...')}</p>
                    ) : exportRequest ? (
                        <div className="rounded-2xl border border-white/80 bg-white/80 px-3 py-2 text-xs text-neutral-600 space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="font-semibold text-neutral-700">
                                    {t('settings.export.statusLabel', 'Latest export')}
                                </span>
                                <span className="text-neutral-500">
                                    {exportStatusLabels[exportRequest.status] || exportRequest.status}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-neutral-500">
                                    {t('settings.export.emailStatusLabel', 'Email status')}
                                </span>
                                <span className="text-neutral-500">
                                    {emailStatusLabels[exportRequest.emailStatus] || exportRequest.emailStatus || t('settings.export.emailStatusPending', 'Email pending')}
                                </span>
                            </div>
                            {exportRequest.requestedAt && (
                                <div className="text-[11px] text-neutral-500">
                                    {t('settings.export.requestedAt', {
                                        date: new Date(exportRequest.requestedAt).toLocaleDateString(language, { month: 'short', day: 'numeric', year: 'numeric' }),
                                    })}
                                </div>
                            )}
                            {exportRequest.error && (
                                <div className="text-[11px] text-rose-500">
                                    {exportRequest.error}
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-xs text-neutral-500">
                            {t('settings.export.emptyState', 'No exports requested yet.')}
                        </p>
                    )}

                    <StandardButton
                        size="lg"
                        whileTap={{ scale: exportEmailValid && !exportSubmitting ? 0.98 : 1 }}
                        onClick={handleExportRequest}
                        disabled={!exportEmailValid || exportSubmitting}
                        className="w-full py-3"
                    >
                        {exportSubmitting ? (
                            <ButtonLoader size="sm" tone="amber" />
                        ) : (
                            t('settings.export.cta', 'Request export')
                        )}
                    </StandardButton>
                </section>

                {/* Legal Section */}
                <section className="glass-card p-4 space-y-3">
                    <h2 className="text-sm font-bold text-neutral-700 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-amber-600" />
                        {t('settings.legal.title')}
                    </h2>

                    {[
                        { key: 'terms', label: t('settings.legal.terms'), href: 'https://midnightstudio.app/apps/pause/terms' },
                        { key: 'privacy', label: t('settings.legal.privacy'), href: 'https://midnightstudio.app/apps/pause/privacy' },
                    ].map(({ key, label, href }) => (
                        <a
                            key={key}
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full flex items-center justify-between py-3 px-3 rounded-2xl border border-white/80 bg-white/70"
                        >
                            <span className="text-sm text-neutral-700">{label}</span>
                            <ExternalLink className="w-4 h-4 text-neutral-500" />
                        </a>
                    ))}

                    <div className="flex items-center justify-between py-2 px-3">
                        <span className="text-sm text-neutral-600">{t('settings.legal.version')}</span>
                        <span className="text-sm font-mono text-neutral-500">1.0.0</span>
                    </div>
                </section>

                {/* Danger Zone */}
                <section className="glass-card p-4 space-y-3 border border-rose-200/50">
                    <h2 className="text-sm font-bold text-rose-700 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        {t('settings.danger.title', 'Danger Zone')}
                    </h2>

                    {hasPartner && (
                        <>
                            <p className="text-xs text-neutral-600">
                                {t('settings.account.disconnectWarning')}
                            </p>
                            <motion.button
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setShowDisconnectModal(true)}
                                className="w-full py-3 rounded-2xl bg-rose-50 border border-rose-200 text-sm font-medium text-rose-600"
                            >
                                {t('settings.account.disconnectCouple')}
                            </motion.button>
                        </>
                    )}

                    <p className="text-xs text-neutral-600">
                        {t('settings.danger.description', 'Permanently delete your account and all data. This cannot be undone.')}
                    </p>
                    <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                            if (hasPartner) {
                                setShowDisconnectRequiredModal(true);
                                return;
                            }
                            setShowDeleteAccountModal(true);
                        }}
                        className="w-full py-3 rounded-2xl bg-rose-50 border border-rose-200 text-sm font-medium text-rose-600"
                    >
                        {t('settings.danger.deleteAccount', 'Delete Account')}
                    </motion.button>
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
                                    onClick={async () => {
                                        if (isDisconnecting) return;
                                        setIsDisconnecting(true);
                                        const { error } = await usePartnerStore.getState().disconnectPartner();
                                        if (error) {
                                            console.error('Disconnect failed:', error);
                                            // Could add toast notification here
                                            setIsDisconnecting(false);
                                            return;
                                        }
                                        setShowDisconnectModal(false);
                                        setIsDisconnecting(false);
                                    }}
                                    disabled={isDisconnecting}
                                    className="flex-1 py-3 rounded-2xl bg-rose-500 text-sm font-bold text-white shadow-soft disabled:opacity-60"
                                >
                                    {isDisconnecting ? (
                                        <ButtonLoader size="sm" tone="white" />
                                    ) : (
                                        t('settings.account.disconnectConfirm')
                                    )}
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
                                        {t('settings.language.chooseLanguage')}
                                    </p>
                                </div>

                                {/* Language options with staggered animation */}
                                <div className="space-y-3">
                                    {(supportedLanguages || SUPPORTED_LANGUAGE_CONFIG).map((lang, index) => {
                                        const isSelected = pendingLanguage === lang.code;
                                        const languageFlag = lang.code === 'en'
                                            ? '🇺🇸'
                                            : lang.code === 'zh-Hans'
                                                ? '🇨🇳'
                                                : '🏳️';

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
                                                        ? 'border-court-gold/40 bg-court-cream/70 shadow-soft'
                                                        : 'border-white/80 bg-white/90 hover:border-court-gold/20 hover:bg-court-cream/40'
                                                    }`}
                                            >
                                                <div className="h-10 w-10 rounded-2xl border border-white/80 bg-white/90 flex items-center justify-center shadow-inner-soft">
                                                    <span className="text-xl" aria-hidden="true">{languageFlag}</span>
                                                </div>

                                                {/* Language names */}
                                                <div className="flex-1 text-left">
                                                    <p className={`font-semibold ${isSelected ? 'text-court-brown' : 'text-neutral-800'}`}>
                                                        {lang.nativeLabel}
                                                    </p>
                                                    <p className="text-xs text-neutral-500">{lang.label}</p>
                                                </div>

                                                {/* Checkmark with animation */}
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all border ${isSelected
                                                        ? 'border-court-goldDark/60 bg-gradient-to-br from-court-gold to-court-goldDark shadow-soft ring-2 ring-court-gold/30'
                                                        : 'border-neutral-300 bg-white'
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

                                <div className="mt-6 space-y-3">
                                    <StandardButton
                                        size="lg"
                                        onClick={handleLanguageConfirm}
                                        disabled={!hasLanguageChange}
                                        className="w-full py-3"
                                    >
                                        {t('settings.preferences.confirmLanguage', 'Confirm language')}
                                    </StandardButton>
                                </div>

                                {/* Close hint */}
                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.4 }}
                                    className="text-center text-xs text-neutral-500 mt-5"
                                >
                                    {translate(pendingLanguage, 'common.tapToClose')}
                                </motion.p>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Relationship Preferences Modal */}
            <AnimatePresence>
                {showRelationshipModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
                        onClick={() => {
                            if (!relationshipSaving) setShowRelationshipModal(false);
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="glass-card p-6 max-w-md w-full space-y-4 max-h-[80vh] overflow-y-auto"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-display font-bold text-neutral-800">
                                        {t('settings.relationship.modalTitle', 'Relationship preferences')}
                                    </h3>
                                    <p className="text-xs text-neutral-500">
                                        {t('settings.relationship.modalSubtitle', 'Update how we personalize your experience.')}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowRelationshipModal(false)}
                                    className="w-9 h-9 bg-white/80 border border-white/70 rounded-full flex items-center justify-center"
                                    aria-label={t('common.close', 'Close')}
                                >
                                    <X className="w-4 h-4 text-neutral-500" />
                                </button>
                            </div>

                            <div className="space-y-5">
                                <div className="space-y-2">
                                    <div className="text-xs font-semibold text-neutral-500">
                                        {t('settings.relationship.loveLanguage', 'Love language')}
                                    </div>
                                    <OptionsStep
                                        iconMode="icon"
                                        options={LOVE_LANGUAGE_OPTIONS}
                                        selectedValue={relationshipForm.loveLanguage}
                                        onOptionSelect={(value) => setRelationshipForm((prev) => ({ ...prev, loveLanguage: value }))}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="text-xs font-semibold text-neutral-500">
                                        {t('settings.relationship.communicationStyle', 'Communication style')}
                                    </div>
                                    <OptionsStep
                                        iconMode="icon"
                                        options={COMMUNICATION_STYLE_OPTIONS}
                                        selectedValue={relationshipForm.communicationStyle}
                                        onOptionSelect={(value) => setRelationshipForm((prev) => ({ ...prev, communicationStyle: value }))}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="text-xs font-semibold text-neutral-500">
                                        {t('settings.relationship.conflictStyle', 'Conflict style')}
                                    </div>
                                    <OptionsStep
                                        iconMode="icon"
                                        options={CONFLICT_STYLE_OPTIONS}
                                        selectedValue={relationshipForm.conflictStyle}
                                        onOptionSelect={(value) => setRelationshipForm((prev) => ({ ...prev, conflictStyle: value }))}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="text-xs font-semibold text-neutral-500">
                                        {t('settings.relationship.dateActivities', 'Favorite date activities')}
                                    </div>
                                    <OptionsStep
                                        iconMode="icon"
                                        options={dateActivityOptions}
                                        selectedValue={relationshipForm.favoriteDateActivities}
                                        onOptionSelect={(value) => handleRelationshipToggle('favoriteDateActivities', value)}
                                        multiSelect
                                        allowCustom
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="text-xs font-semibold text-neutral-500">
                                        {t('settings.relationship.petPeeves', 'Pet peeves')}
                                    </div>
                                    <OptionsStep
                                        iconMode="icon"
                                        options={petPeeveOptions}
                                        selectedValue={relationshipForm.petPeeves}
                                        onOptionSelect={(value) => handleRelationshipToggle('petPeeves', value)}
                                        multiSelect
                                        allowCustom
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="text-xs font-semibold text-neutral-500">
                                        {t('settings.relationship.appreciationStyle', 'Appreciation style')}
                                    </div>
                                    <OptionsStep
                                        iconMode="icon"
                                        options={APPRECIATION_STYLE_OPTIONS}
                                        selectedValue={relationshipForm.appreciationStyle}
                                        onOptionSelect={(value) => setRelationshipForm((prev) => ({ ...prev, appreciationStyle: value }))}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="text-xs font-semibold text-neutral-500">
                                        {t('settings.relationship.bio', 'About you')}
                                    </div>
                                    <textarea
                                        value={relationshipForm.bio}
                                        onChange={(e) => setRelationshipForm((prev) => ({ ...prev, bio: e.target.value }))}
                                        placeholder={t('settings.relationship.bioPlaceholder', 'Share a short note about what makes you feel supported')}
                                        className="w-full min-h-[96px] rounded-2xl border border-neutral-200 bg-white/80 p-3 text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-amber-200"
                                    />
                                </div>
                            </div>

                            {relationshipError && (
                                <p className="text-xs text-rose-600">{relationshipError}</p>
                            )}

                            <div className="flex gap-3 pt-2">
                                <motion.button
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setShowRelationshipModal(false)}
                                    disabled={relationshipSaving}
                                    className="flex-1 py-3 rounded-2xl border border-white/80 bg-white/90 text-sm font-bold text-neutral-600"
                                >
                                    {t('common.cancel', 'Cancel')}
                                </motion.button>
                                <StandardButton
                                    size="lg"
                                    onClick={handleRelationshipSave}
                                    disabled={relationshipSaving}
                                    className="flex-1 py-3"
                                >
                                    {relationshipSaving ? (
                                        <ButtonLoader size="sm" tone="amber" />
                                    ) : (
                                        t('settings.relationship.save', 'Save preferences')
                                    )}
                                </StandardButton>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Disconnect Required Modal (before deleting account) */}
            <AnimatePresence>
                {showDisconnectRequiredModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
                        onClick={() => setShowDisconnectRequiredModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="glass-card p-6 max-w-sm w-full space-y-4"
                        >
                            <div className="text-center">
                                <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
                                <h3 className="text-lg font-bold text-rose-700">
                                    {t('settings.danger.disconnectRequiredTitle', 'Disconnect Required')}
                                </h3>
                                <p className="text-sm text-neutral-600 mt-2">
                                    {t('settings.danger.disconnectRequiredMessage', 'You must disconnect from your partner before deleting your account.')}
                                </p>
                            </div>

                            <div className="flex gap-3">
                                <motion.button
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setShowDisconnectRequiredModal(false)}
                                    className="flex-1 py-3 rounded-2xl bg-neutral-100 text-sm font-medium text-neutral-700"
                                >
                                    {t('common.ok', 'OK')}
                                </motion.button>
                                <motion.button
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => {
                                        setShowDisconnectRequiredModal(false);
                                        setShowDisconnectModal(true);
                                    }}
                                    className="flex-1 py-3 rounded-2xl bg-rose-500 text-sm font-bold text-white shadow-soft"
                                >
                                    {t('settings.account.disconnectCouple')}
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Delete Account Modal */}
            <AnimatePresence>
                {showDeleteAccountModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
                        onClick={() => setShowDeleteAccountModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="glass-card p-6 max-w-sm w-full space-y-4"
                        >
                            <div className="text-center">
                                <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
                                <h3 className="text-lg font-bold text-rose-700">
                                    {t('settings.danger.deleteModalTitle', 'Delete Your Account?')}
                                </h3>
                                <p className="text-sm text-neutral-600 mt-2">
                                    {t('settings.danger.deleteModalMessage', 'This will permanently delete your account and remove your personal data. This cannot be undone.')}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs text-neutral-600">
                                    {t('settings.danger.confirmLabel', 'Type DELETE to confirm')}
                                </label>
                                <input
                                    type="text"
                                    value={deleteConfirmText}
                                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                                    placeholder="DELETE"
                                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white/50 text-sm"
                                />
                            </div>

                            <div className="flex gap-3">
                                <motion.button
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => {
                                        setShowDeleteAccountModal(false);
                                        setDeleteConfirmText('');
                                    }}
                                    className="flex-1 py-3 rounded-2xl bg-neutral-100 text-sm font-medium text-neutral-700"
                                >
                                    {t('common.cancel', 'Cancel')}
                                </motion.button>
                                <motion.button
                                    whileTap={{ scale: 0.98 }}
                                    onClick={async () => {
                                        if (deleteConfirmText !== 'DELETE') return;
                                        setIsDeleting(true);
                                        const { error } = await useAuthStore.getState().deleteAccount();
                                        setIsDeleting(false);
                                        if (error) {
                                            console.error('Delete failed:', error);
                                            // Could add toast notification here
                                        }
                                        // signOut will redirect automatically
                                    }}
                                    disabled={deleteConfirmText !== 'DELETE' || isDeleting}
                                    className="flex-1 py-3 rounded-2xl bg-rose-500 text-sm font-bold text-white disabled:opacity-50"
                                >
                                    {isDeleting ? (
                                        <ButtonLoader size="sm" tone="white" />
                                    ) : (
                                        t('settings.danger.confirmDelete', 'Delete Account')
                                    )}
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SettingsPage;
