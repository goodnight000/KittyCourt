import React, { useEffect, useMemo, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    ArrowRight, ArrowLeft, Sparkles, Heart,
    Calendar, Check, User, Camera, Upload,
    AlertTriangle, Mail, Lock, Eye, EyeOff
} from 'lucide-react';
import useAuthStore from '../store/useAuthStore';
import { validateDate } from '../utils/helpers';
import Paywall from '../components/Paywall';
import { PRESET_AVATARS } from '../services/avatarService';
import { useI18n } from '../i18n';
import { DEFAULT_LANGUAGE, normalizeLanguage } from '../i18n/languageConfig';

// Note: PRESET_AVATARS is now imported from avatarService

// Onboarding Steps Configuration
const ONBOARDING_STEPS = [
    {
        id: 'language',
        titleKey: 'onboarding.language.title',
        subtitleKey: 'onboarding.language.subtitle',
        icon: '🌍',
        field: 'preferredLanguage',
    },
    {
        id: 'welcome',
        titleKey: 'onboarding.steps.welcome.title',
        subtitleKey: 'onboarding.steps.welcome.subtitle',
        icon: null,
    },
    {
        id: 'auth',
        titleKey: 'onboarding.steps.auth.title',
        subtitleKey: 'onboarding.steps.auth.subtitle',
        icon: null,
    },
    {
        id: 'name',
        titleKey: 'onboarding.steps.name.title',
        subtitleKey: 'onboarding.steps.name.subtitle',
        icon: '👤',
        field: 'displayName',
    },
    {
        id: 'avatar',
        titleKey: 'onboarding.steps.avatar.title',
        subtitleKey: 'onboarding.steps.avatar.subtitle',
        icon: '📸',
        field: 'avatarUrl',
    },
    {
        id: 'birthday',
        titleKey: 'onboarding.steps.birthday.title',
        subtitleKey: 'onboarding.steps.birthday.subtitle',
        icon: '🎈',
        field: 'birthday',
    },
    {
        id: 'loveLanguage',
        titleKey: 'onboarding.steps.loveLanguage.title',
        subtitleKey: 'onboarding.steps.loveLanguage.subtitle',
        icon: '💕',
        field: 'loveLanguage',
        options: [
            { id: 'words', emoji: '💬', labelKey: 'options.loveLanguage.words', descKey: 'options.loveLanguage.wordsDesc' },
            { id: 'acts', emoji: '🎁', labelKey: 'options.loveLanguage.acts', descKey: 'options.loveLanguage.actsDesc' },
            { id: 'gifts', emoji: '🎀', labelKey: 'options.loveLanguage.gifts', descKey: 'options.loveLanguage.giftsDesc' },
            { id: 'time', emoji: '⏰', labelKey: 'options.loveLanguage.time', descKey: 'options.loveLanguage.timeDesc' },
            { id: 'touch', emoji: '🤗', labelKey: 'options.loveLanguage.touch', descKey: 'options.loveLanguage.touchDesc' },
        ],
    },
    {
        id: 'communicationStyle',
        titleKey: 'onboarding.steps.communicationStyle.title',
        subtitleKey: 'onboarding.steps.communicationStyle.subtitle',
        icon: '💭',
        field: 'communicationStyle',
        options: [
            { id: 'direct', emoji: '🎯', labelKey: 'options.communicationStyle.direct', descKey: 'options.communicationStyle.directDesc' },
            { id: 'processing', emoji: '🧠', labelKey: 'options.communicationStyle.processing', descKey: 'options.communicationStyle.processingDesc' },
            { id: 'emotional', emoji: '💖', labelKey: 'options.communicationStyle.emotional', descKey: 'options.communicationStyle.emotionalDesc' },
            { id: 'logical', emoji: '📊', labelKey: 'options.communicationStyle.logical', descKey: 'options.communicationStyle.logicalDesc' },
            { id: 'avoidant', emoji: '🐢', labelKey: 'options.communicationStyle.avoidant', descKey: 'options.communicationStyle.avoidantDesc' },
        ],
    },
    {
        id: 'conflictStyle',
        titleKey: 'onboarding.steps.conflictStyle.title',
        subtitleKey: 'onboarding.steps.conflictStyle.subtitle',
        icon: '⚡',
        field: 'conflictStyle',
        options: [
            { id: 'talk', emoji: '🗣️', labelKey: 'options.conflictStyle.talk', descKey: 'options.conflictStyle.talkDesc' },
            { id: 'space', emoji: '🌙', labelKey: 'options.conflictStyle.space', descKey: 'options.conflictStyle.spaceDesc' },
            { id: 'write', emoji: '✍️', labelKey: 'options.conflictStyle.write', descKey: 'options.conflictStyle.writeDesc' },
            { id: 'physical', emoji: '🏃', labelKey: 'options.conflictStyle.physical', descKey: 'options.conflictStyle.physicalDesc' },
            { id: 'distract', emoji: '🎮', labelKey: 'options.conflictStyle.distract', descKey: 'options.conflictStyle.distractDesc' },
        ],
    },
    {
        id: 'dateActivities',
        titleKey: 'onboarding.steps.dateActivities.title',
        subtitleKey: 'onboarding.steps.dateActivities.subtitle',
        icon: '🎯',
        field: 'favoriteDateActivities',
        multiSelect: true,
        options: [
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
        ],
        allowCustom: true,
    },
    {
        id: 'petPeeves',
        titleKey: 'onboarding.steps.petPeeves.title',
        subtitleKey: 'onboarding.steps.petPeeves.subtitle',
        icon: '🙈',
        field: 'petPeeves',
        multiSelect: true,
        options: [
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
        ],
        allowCustom: true,
    },
    {
        id: 'appreciationStyle',
        titleKey: 'onboarding.steps.appreciationStyle.title',
        subtitleKey: 'onboarding.steps.appreciationStyle.subtitle',
        icon: '🌟',
        field: 'appreciationStyle',
        options: [
            { id: 'public', emoji: '📢', labelKey: 'options.appreciationStyle.public', descKey: 'options.appreciationStyle.publicDesc' },
            { id: 'private', emoji: '💌', labelKey: 'options.appreciationStyle.private', descKey: 'options.appreciationStyle.privateDesc' },
            { id: 'reciprocate', emoji: '🔄', labelKey: 'options.appreciationStyle.reciprocate', descKey: 'options.appreciationStyle.reciprocateDesc' },
            { id: 'none', emoji: '😊', labelKey: 'options.appreciationStyle.none', descKey: 'options.appreciationStyle.noneDesc' },
        ],
    },
    {
        id: 'complete',
        titleKey: 'onboarding.steps.complete.title',
        subtitleKey: 'onboarding.steps.complete.subtitle',
        icon: '✅',
    },
];

const OnboardingPage = () => {
    const navigate = useNavigate();
    const { t, supportedLanguages } = useI18n();
    const {
        isAuthenticated,
        onboardingStep,
        setOnboardingStep,
        onboardingData,
        updateOnboardingData,
        completeOnboarding,
        profile,
        signUp,
        signInWithGoogle,
        preferredLanguage,
        setPreferredLanguage
    } = useAuthStore();

    const [customInputs, setCustomInputs] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showConnectChoice, setShowConnectChoice] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [birthdayError, setBirthdayError] = useState(null);
    const [showPaywall, setShowPaywall] = useState(false);
    const [postPaywallPath, setPostPaywallPath] = useState(null);

    const [authEmail, setAuthEmail] = useState('');
    const [authPassword, setAuthPassword] = useState('');
    const [authConfirmPassword, setAuthConfirmPassword] = useState('');
    const [authShowPassword, setAuthShowPassword] = useState(false);
    const [authError, setAuthError] = useState(null);
    const [authSubmitting, setAuthSubmitting] = useState(false);
    const goldButtonBase =
        'relative overflow-hidden border border-[#E3D098] bg-gradient-to-br from-[#C9A227] via-[#B9911F] to-[#8B7019] shadow-[0_12px_24px_rgba(201,162,39,0.22)] hover:brightness-105';
    const goldButtonShineStyle = {
        background: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.65), transparent 55%)'
    };
    const welcomeHighlights = [
        'onboarding.welcome.highlights.fair',
        'onboarding.welcome.highlights.dailyCloseness',
        'onboarding.welcome.highlights.calmerVibe'
    ];
    const translateValidationError = (validation) => {
        if (!validation?.error) return null;
        if (validation.errorCode) {
            return t(`validation.${validation.errorCode}`, validation.meta);
        }
        return validation.error;
    };

    const steps = useMemo(() => (
        isAuthenticated
            ? ONBOARDING_STEPS.filter((s) => s.id !== 'auth')
            : ONBOARDING_STEPS
    ), [isAuthenticated]);

    useEffect(() => {
        if (onboardingStep < 0) return;
        if (onboardingStep >= steps.length) setOnboardingStep(0);
    }, [onboardingStep, steps.length, setOnboardingStep]);

    const currentStepData = steps[onboardingStep];
    const totalSteps = steps.length;
    const progress = ((onboardingStep + 1) / totalSteps) * 100;
    const stepBadgeLabel = showConnectChoice
        ? t('onboarding.badge.saved')
        : t('onboarding.badge.step', { current: onboardingStep + 1 });
    const loveLanguageOption = ONBOARDING_STEPS
        .find((step) => step.id === 'loveLanguage')
        ?.options
        .find((option) => option.id === onboardingData.loveLanguage);

    useEffect(() => {
        if (currentStepData?.id !== 'language') return;
        if (!supportedLanguages?.length) return;
        const firstLanguage = supportedLanguages[0];

        if (supportedLanguages.length === 1 && firstLanguage?.code) {
            if (onboardingData.preferredLanguage !== firstLanguage.code) {
                updateOnboardingData({ preferredLanguage: firstLanguage.code });
            }
            if (preferredLanguage !== firstLanguage.code) {
                setPreferredLanguage(firstLanguage.code);
            }
            setOnboardingStep(onboardingStep + 1);
            return;
        }

        const profileLanguage = normalizeLanguage(profile?.preferred_language);
        const storeLanguage = normalizeLanguage(preferredLanguage);
        const hasProfileLanguage = !!profile?.preferred_language;
        const hasStoredLanguage = storeLanguage && (hasProfileLanguage || storeLanguage !== DEFAULT_LANGUAGE);

        if (!onboardingData.preferredLanguage) {
            if (hasProfileLanguage && profileLanguage) {
                updateOnboardingData({ preferredLanguage: profileLanguage });
                return;
            }
            if (hasStoredLanguage) {
                updateOnboardingData({ preferredLanguage: storeLanguage });
                return;
            }
            const navigatorLanguage = typeof navigator === 'undefined' ? null : navigator.language;
            const initialLanguage = normalizeLanguage(navigatorLanguage) || firstLanguage?.code || DEFAULT_LANGUAGE;
            updateOnboardingData({ preferredLanguage: initialLanguage });
            if (preferredLanguage !== initialLanguage) {
                setPreferredLanguage(initialLanguage);
            }
            return;
        }

        if (onboardingData.preferredLanguage !== preferredLanguage) {
            setPreferredLanguage(onboardingData.preferredLanguage);
        }
    }, [
        currentStepData?.id,
        supportedLanguages,
        onboardingData.preferredLanguage,
        preferredLanguage,
        profile?.preferred_language,
        updateOnboardingData,
        setPreferredLanguage,
        onboardingStep,
        setOnboardingStep,
    ]);

    const handleNext = async () => {
        // Clear any previous error
        setSaveError(null);
        setAuthError(null);

        if (currentStepData?.id === 'auth') return;

        // Validation
        if (currentStepData.field) {
            const value = onboardingData[currentStepData.field];
            if (!value || (Array.isArray(value) && value.length === 0)) {
                // Allow skipping optional fields
                if (!['petPeeves'].includes(currentStepData.field)) {
                    return; // Required field is empty
                }
            }

            // Validate birthday date
            if (currentStepData.field === 'birthday' && value) {
                const validation = validateDate(value);
                if (!validation.isValid) {
                    setBirthdayError(translateValidationError(validation));
                    return;
                }
            }
        }

        if (currentStepData?.id === 'complete') {
            // Complete onboarding
            console.log('[OnboardingPage] Starting save profile...');
            setIsSubmitting(true);
            try {
                console.log('[OnboardingPage] Calling completeOnboarding...');
                const result = await completeOnboarding();
                console.log('[OnboardingPage] completeOnboarding returned:', result);

                if (result.error) {
                    console.error('[OnboardingPage] Error:', result.error);
                    setSaveError(t('onboarding.errors.saveFailed'));
                    // Don't set isSubmitting to false here, let the finally block handle it
                    return;
                }

                // Success - show connect choice
                console.log('[OnboardingPage] Success! Showing connect choice...');
                setShowConnectChoice(true);
            } catch (err) {
                console.error('[OnboardingPage] Unexpected error:', err);
                setSaveError(t('onboarding.errors.unexpected'));
            } finally {
                // Only stop submitting if we encountered an error
                // If success (showConnectChoice is true), we want to keep the "success" state or transition smoothly
                // But if we're showing the choice, we're technically done "submitting"
                setIsSubmitting(false);
            }
        } else {
            setOnboardingStep(onboardingStep + 1);
        }
    };

    const beginPaywallThenNavigate = (path) => {
        setPostPaywallPath(path);
        setShowPaywall(true);
    };

    const handleConnectNow = () => {
        beginPaywallThenNavigate('/connect');
    };

    const handleConnectLater = () => {
        beginPaywallThenNavigate('/');
    };

    const handlePaywallClose = () => {
        setShowPaywall(false);
        if (postPaywallPath) {
            navigate(postPaywallPath);
        }
    };

    const handleGoogleSignUp = async () => {
        setAuthError(null);
        setAuthSubmitting(true);
        const result = await signInWithGoogle();
        setAuthSubmitting(false);
        if (result?.error) {
            setAuthError(t('onboarding.errors.googleFailed'));
        }
    };

    const handleEmailSignUp = async (e) => {
        e?.preventDefault?.();
        setAuthError(null);
        setAuthSubmitting(true);

        const email = authEmail.trim();
        if (!email || !authPassword || !authConfirmPassword) {
            setAuthError(t('onboarding.errors.missingFields'));
            setAuthSubmitting(false);
            return;
        }

        if (authPassword !== authConfirmPassword) {
            setAuthError(t('onboarding.errors.passwordsMismatch'));
            setAuthSubmitting(false);
            return;
        }

        if (authPassword.length < 8) {
            setAuthError(t('onboarding.errors.passwordTooShort'));
            setAuthSubmitting(false);
            return;
        }

        const { error } = await signUp(email, authPassword);
        setAuthSubmitting(false);
        if (error) {
            setAuthError(t('onboarding.errors.signUpFailed'));
            return;
        }
        // After sign-up, `isAuthenticated` becomes true and the auth step is removed.
        // Keeping the same `onboardingStep` naturally advances to the next step.
    };

    const handleBack = () => {
        if (onboardingStep > 0) {
            setOnboardingStep(onboardingStep - 1);
        }
    };

    const handleOptionSelect = (optionId) => {
        if (currentStepData.multiSelect) {
            const current = onboardingData[currentStepData.field] || [];
            const updated = current.includes(optionId)
                ? current.filter(id => id !== optionId)
                : [...current, optionId];
            updateOnboardingData({ [currentStepData.field]: updated });
        } else {
            updateOnboardingData({ [currentStepData.field]: optionId });
        }
    };

    const isOptionSelected = (optionId) => {
        const value = onboardingData[currentStepData.field];
        if (currentStepData.multiSelect) {
            return (value || []).includes(optionId);
        }
        return value === optionId;
    };

    const handleLanguageSelect = (languageCode) => {
        updateOnboardingData({ preferredLanguage: languageCode });
        setPreferredLanguage(languageCode);
    };

    const handleAvatarFile = (file) => {
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert(t('onboarding.errors.invalidImage'));
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            alert(t('onboarding.errors.imageTooLarge'));
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const result = event.target?.result;
            if (typeof result !== 'string') {
                alert(t('onboarding.errors.imageReadFailed'));
                return;
            }
            updateOnboardingData({ avatarUrl: result });
        };
        reader.onerror = () => alert(t('onboarding.errors.imageReadFailed'));
        reader.readAsDataURL(file);
    };

    const canProceed = () => {
        if (!currentStepData.field) return true;
        const value = onboardingData[currentStepData.field];
        if (currentStepData.multiSelect) {
            // Pet peeves are optional
            if (currentStepData.field === 'petPeeves') return true;
            return value && value.length > 0;
        }
        // Avatar is REQUIRED - users must select a profile picture
        // No special case for avatarUrl - it follows the standard required check
        return !!value;
    };

    const renderStepContent = () => {
        switch (currentStepData.id) {
            case 'language':
                return (
                    <Motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                    >
                        <div className={`grid gap-3 ${supportedLanguages.length > 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                            {supportedLanguages.map((languageOption, index) => {
                                const label = languageOption.labelKey
                                    ? t(languageOption.labelKey)
                                    : (languageOption.label || languageOption.code);
                                const nativeLabel = languageOption.nativeLabel;
                                const isSelected = onboardingData.preferredLanguage === languageOption.code;
                                const showNativeLabel = nativeLabel && nativeLabel !== label;
                                return (
                                    <Motion.button
                                        key={languageOption.code}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        whileTap={{ scale: 0.97 }}
                                        onClick={() => handleLanguageSelect(languageOption.code)}
                                        className={`p-4 rounded-2xl text-left transition-all border ${isSelected
                                            ? 'border-[#D2BC76] bg-[#FBF6E8] shadow-soft'
                                            : 'border-white/80 bg-white/80 hover:bg-white'
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-[0.2em] ${isSelected
                                                ? 'bg-white/80 text-[#8B7019]'
                                                : 'bg-white/70 text-neutral-400'
                                                }`}
                                            >
                                                {languageOption.code}
                                            </div>
                                            <div className="flex-1">
                                                <p className={`font-bold ${isSelected ? 'text-court-brown' : 'text-neutral-700'}`}>
                                                    {label}
                                                </p>
                                                {showNativeLabel && (
                                                    <p className="text-xs text-neutral-400 mt-0.5">{nativeLabel}</p>
                                                )}
                                            </div>
                                            {isSelected && (
                                                <Motion.div
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    className="w-5 h-5 rounded-full flex items-center justify-center bg-gradient-to-br from-[#C9A227] to-[#8B7019]"
                                                >
                                                    <Check className="w-3 h-3 text-white" />
                                                </Motion.div>
                                            )}
                                        </div>
                                    </Motion.button>
                                );
                            })}
                        </div>
                        <p className="text-xs text-neutral-400 text-center">
                            {t('onboarding.language.helper')}
                        </p>
                    </Motion.div>
                );

            case 'welcome':
                return (
                    <Motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center space-y-6"
                    >
                        <div className="glass-card p-6">
                            <div className="w-20 h-20 mx-auto rounded-3xl overflow-hidden shadow-soft border border-white/80 bg-white/80">
                                <img
                                    src="/assets/avatars/judge_whiskers.png"
                                    alt={t('onboarding.welcome.judgeAlt')}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <p className="text-neutral-700 mt-4 leading-relaxed">
                                {t('onboarding.welcome.description')}
                            </p>
                            <div className="flex flex-wrap justify-center gap-2 mt-4">
                                {welcomeHighlights.map((item, i) => (
                                    <span
                                        key={i}
                                        className="px-3 py-1.5 bg-white/80 border border-white/80 rounded-full text-sm text-court-brown shadow-soft"
                                    >
                                        {t(item)}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/signin')}
                            className="text-sm font-semibold text-court-brown hover:text-[#8B7019] transition-colors"
                        >
                            {t('onboarding.welcome.signInPrompt')}
                        </button>
                        <div className="space-y-4">
                            <p className="text-xs text-neutral-400">
                                {t('onboarding.welcome.upgradeNote')}
                            </p>
                        </div>
                    </Motion.div>
                );

            case 'auth':
                return (
                    <Motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                    >
                        {authError && (
                            <div className="glass-card p-4 border border-[#E2D6C7] text-[#6B4F3C] text-sm">
                                {authError}
                            </div>
                        )}

                        <Motion.button
                            whileTap={{ scale: 0.98 }}
                            onClick={handleGoogleSignUp}
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
                            <span className="text-neutral-400 text-sm">{t('common.or')}</span>
                            <div className="flex-1 h-px bg-neutral-200" />
                        </div>

                        <form onSubmit={handleEmailSignUp} className="space-y-4">
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                                <input
                                    type="email"
                                    value={authEmail}
                                    onChange={(e) => setAuthEmail(e.target.value)}
                                    placeholder={t('onboarding.auth.emailPlaceholder')}
                                    className="w-full pl-12 pr-4 py-4 bg-white/90 border border-white/80 rounded-2xl text-neutral-700 text-base placeholder:text-neutral-400 focus:outline-none focus:border-[#D2BC76] focus:ring-2 focus:ring-[#F1E3B6] transition-all shadow-inner-soft"
                                    autoFocus
                                />
                            </div>

                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                                <input
                                    type={authShowPassword ? 'text' : 'password'}
                                    value={authPassword}
                                    onChange={(e) => setAuthPassword(e.target.value)}
                                    placeholder={t('onboarding.auth.passwordPlaceholder')}
                                    className="w-full pl-12 pr-12 py-4 bg-white/90 border border-white/80 rounded-2xl text-neutral-700 text-base placeholder:text-neutral-400 focus:outline-none focus:border-[#D2BC76] focus:ring-2 focus:ring-[#F1E3B6] transition-all shadow-inner-soft"
                                />
                                <button
                                    type="button"
                                    onClick={() => setAuthShowPassword(!authShowPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                                >
                                    {authShowPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>

                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                                <input
                                    type={authShowPassword ? 'text' : 'password'}
                                    value={authConfirmPassword}
                                    onChange={(e) => setAuthConfirmPassword(e.target.value)}
                                    placeholder={t('onboarding.auth.confirmPasswordPlaceholder')}
                                    className="w-full pl-12 pr-4 py-4 bg-white/90 border border-white/80 rounded-2xl text-neutral-700 text-base placeholder:text-neutral-400 focus:outline-none focus:border-[#D2BC76] focus:ring-2 focus:ring-[#F1E3B6] transition-all shadow-inner-soft"
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
                                    {authSubmitting ? t('onboarding.auth.creating') : t('onboarding.auth.createAccount')}
                                    <ArrowRight className="w-5 h-5" />
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

            case 'name':
                return (
                    <Motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                    >
                        <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                            <input
                                type="text"
                                value={onboardingData.displayName || ''}
                                onChange={(e) => updateOnboardingData({ displayName: e.target.value })}
                                placeholder={t('onboarding.name.placeholder')}
                                className="w-full pl-12 pr-4 py-4 bg-white/90 border border-white/80 rounded-2xl text-neutral-700 text-lg placeholder:text-neutral-400 focus:outline-none focus:border-[#D2BC76] focus:ring-2 focus:ring-[#F1E3B6] transition-all shadow-inner-soft"
                                autoFocus
                            />
                        </div>
                        <p className="text-sm text-neutral-400 text-center">
                            {t('onboarding.name.helper')}
                        </p>
                    </Motion.div>
                );

            case 'birthday':
                return (
                    <Motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                    >
                        <div className="relative w-full">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                            <input
                                type="date"
                                value={onboardingData.birthday || ''}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    updateOnboardingData({ birthday: value });

                                    // Validate the date
                                    if (value) {
                                        const validation = validateDate(value);
                                        setBirthdayError(validation.isValid ? null : translateValidationError(validation));
                                    } else {
                                        setBirthdayError(null);
                                    }
                                }}
                                className={`w-full min-w-0 max-w-full box-border pl-12 pr-4 py-4 bg-white/90 border rounded-2xl text-neutral-700 text-lg focus:outline-none focus:ring-2 transition-all shadow-inner-soft ${birthdayError
                                    ? 'border-[#D2BC76] focus:border-[#B9911F] focus:ring-[#F1E3B6]'
                                    : 'border-white/80 focus:border-[#D2BC76] focus:ring-[#F1E3B6]'
                                    }`}
                            />
                        </div>
                        {birthdayError && (
                            <p className="text-sm text-[#6B4F3C] text-center flex items-center justify-center gap-1">
                                <AlertTriangle className="w-4 h-4" />
                                {birthdayError}
                            </p>
                        )}
                        <p className="text-sm text-neutral-400 text-center">
                            {t('onboarding.birthday.helper')}
                        </p>
                    </Motion.div>
                );

            case 'avatar':
                return (
                    <Motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                    >
                        {/* Current selection preview */}
                        <div className="flex flex-col items-center">
                            <div className={`w-20 h-24 rounded-2xl overflow-hidden border-4 shadow-soft bg-white transition-all ${onboardingData.avatarUrl ? 'border-[#D2BC76]' : 'border-neutral-200'}`}>
                                {onboardingData.avatarUrl ? (
                                    <img
                                        src={onboardingData.avatarUrl}
                                        alt={t('onboarding.avatar.selectedAlt')}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-neutral-100 text-neutral-400">
                                        <User className="w-12 h-12" />
                                    </div>
                                )}
                            </div>
                            <p className={`text-sm mt-2 ${onboardingData.avatarUrl ? 'text-neutral-500' : 'text-[#6B4F3C] font-medium'}`}>
                                {onboardingData.avatarUrl ? t('onboarding.avatar.selectedHint') : t('onboarding.avatar.requiredHint')}
                            </p>
                        </div>

                        {/* Preset avatars grid */}
                        <div>
                            <p className="text-xs text-neutral-400 uppercase tracking-wider mb-3 text-center">{t('onboarding.avatar.presetLabel')}</p>
                            <div className="grid grid-cols-4 gap-3">
                                {PRESET_AVATARS.map((avatar, index) => (
                                    <Motion.button
                                        key={avatar.id}
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: index * 0.05 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => updateOnboardingData({ avatarUrl: avatar.path })}
                                        className={`aspect-square rounded-2xl overflow-hidden border-3 transition-all ${onboardingData.avatarUrl === avatar.path
                                            ? 'border-[#D2BC76] ring-2 ring-[#F1E3B6]/60 shadow-soft'
                                            : 'border-white/80 hover:border-neutral-200'
                                            }`}
                                    >
                                        <img
                                            src={avatar.path}
                                            alt={t('onboarding.avatar.presetAlt', {
                                                name: avatar.labelKey ? t(avatar.labelKey) : avatar.label
                                            })}
                                            className="w-full h-full object-cover"
                                        />
                                    </Motion.button>
                                ))}
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="flex items-center gap-4">
                            <div className="flex-1 h-px bg-neutral-200" />
                            <span className="text-neutral-400 text-xs">{t('common.or')}</span>
                            <div className="flex-1 h-px bg-neutral-200" />
                        </div>

                        {/* Upload options */}
                        <div className="flex gap-3">
                            <label className="flex-1 cursor-pointer">
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        handleAvatarFile(file);
                                    }}
                                />
                                <div className="flex items-center justify-center gap-2 py-3 px-4 bg-white/90 border border-white/80 rounded-xl hover:bg-white transition-all shadow-soft">
                                    <Upload className="w-5 h-5 text-neutral-500" />
                                    <span className="font-medium text-neutral-700">{t('onboarding.avatar.upload')}</span>
                                </div>
                            </label>

                            <label className="flex-1 cursor-pointer">
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="user"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        handleAvatarFile(file);
                                    }}
                                />
                                <div className="flex items-center justify-center gap-2 py-3 px-4 bg-white/90 border border-white/80 rounded-xl hover:bg-white transition-all shadow-soft">
                                    <Camera className="w-5 h-5 text-neutral-500" />
                                    <span className="font-medium text-neutral-700">{t('onboarding.avatar.camera')}</span>
                                </div>
                            </label>
                        </div>

                        {/* Note about changing later */}
                        <p className="text-xs text-neutral-400 text-center">
                            {t('onboarding.avatar.changeLater')}
                        </p>
                    </Motion.div>
                );

            case 'complete':
                // Show connect choice after profile is saved
                if (showConnectChoice) {
                    return (
                        <Motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center space-y-6"
                        >
                            <Motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', delay: 0.1 }}
                                className="w-20 h-20 mx-auto rounded-full flex items-center justify-center shadow-soft border border-[#E3D098] bg-gradient-to-br from-[#C9A227] via-[#B9911F] to-[#8B7019]"
                            >
                                <Heart className="w-10 h-10 text-white" />
                            </Motion.div>

                            <div>
                                <h3 className="text-xl font-display font-bold text-neutral-800 mb-2">
                                    {t('onboarding.complete.connectTitle')}
                                </h3>
                                <p className="text-neutral-500 text-sm">
                                    {t('onboarding.complete.connectSubtitle')}
                                </p>
                            </div>

                            {/* Partner Code Display */}
                            {profile?.partner_code && (
                                <Motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                    className="bg-white/80 rounded-2xl p-4 border border-[#E0D2C4] shadow-inner-soft"
                                >
                                    <p className="text-xs text-neutral-500 mb-1">{t('onboarding.complete.partnerCodeLabel')}</p>
                                    <p className="text-xl font-mono font-bold text-court-brown tracking-widest">
                                        {profile.partner_code}
                                    </p>
                                </Motion.div>
                            )}

                            {/* Connect Now Button */}
                            <Motion.button
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={handleConnectNow}
                                className={`w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 ${goldButtonBase}`}
                            >
                                <span aria-hidden="true" className="absolute inset-0 opacity-60" style={goldButtonShineStyle} />
                                <span className="relative z-10 flex items-center gap-2">
                                <Heart className="w-5 h-5" />
                                {t('onboarding.complete.connectNow')}
                                </span>
                            </Motion.button>

                            {/* Connect Later Button */}
                            <Motion.button
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.5 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={handleConnectLater}
                                className="w-full py-3 rounded-2xl font-medium text-neutral-500 bg-white/80 border border-neutral-200/70 hover:bg-white transition-colors shadow-soft"
                            >
                                {t('onboarding.complete.connectLater')}
                            </Motion.button>

                            <Motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.6 }}
                                className="text-xs text-neutral-400"
                            >
                                {t('onboarding.complete.connectNote')}
                            </Motion.p>
                        </Motion.div>
                    );
                }

                // Initial complete state (before save)
                return (
                    <Motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center space-y-6"
                    >
                        <Motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', delay: 0.2 }}
                            className="w-24 h-24 mx-auto rounded-full flex items-center justify-center shadow-soft border border-[#E3D098] bg-gradient-to-br from-[#C9A227] via-[#B9911F] to-[#8B7019]"
                        >
                            <Check className="w-12 h-12 text-white" />
                        </Motion.div>

                        <div className="flex flex-wrap justify-center gap-3">
                            <div className="px-4 py-2 bg-white/80 rounded-xl shadow-soft border border-white/80">
                                <p className="text-xs text-neutral-400">{t('onboarding.complete.summaryName')}</p>
                                <p className="font-bold text-neutral-700">{onboardingData.displayName}</p>
                            </div>
                            <div className="px-4 py-2 bg-white/80 rounded-xl shadow-soft border border-white/80">
                                <p className="text-xs text-neutral-400">{t('onboarding.complete.summaryLoveLanguage')}</p>
                                <p className="font-bold text-neutral-700">
                                    {loveLanguageOption?.emoji}{' '}
                                    {loveLanguageOption ? t(loveLanguageOption.labelKey) : (onboardingData.loveLanguage || t('common.unknown'))}
                                </p>
                            </div>
                        </div>

                        {/* Error message */}
                        {saveError && (
                            <Motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-4 bg-[#F7F1EA] border border-[#E2D6C7] rounded-xl"
                            >
                                <p className="text-sm text-[#6B4F3C] font-medium flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4" />
                                    {saveError}
                                </p>
                            </Motion.div>
                        )}
                    </Motion.div>
                );

            default:
                // Options-based steps
                if (currentStepData.options) {
                    return (
                        <Motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-3"
                        >
                            <div className={`grid gap-3 ${currentStepData.multiSelect ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                {currentStepData.options.map((option, index) => {
                                    const optionLabel = option.labelKey ? t(option.labelKey) : option.label;
                                    const optionDesc = option.descKey ? t(option.descKey) : option.desc;
                                    return (
                                    <Motion.button
                                        key={option.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        whileTap={{ scale: 0.97 }}
                                        onClick={() => handleOptionSelect(option.id)}
                                        className={`p-4 rounded-2xl text-left transition-all border ${isOptionSelected(option.id)
                                            ? 'border-[#D2BC76] bg-[#FBF6E8] shadow-soft'
                                            : 'border-white/80 bg-white/80 hover:bg-white'
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <span className="text-2xl">{option.emoji}</span>
                                            <div className="flex-1">
                                                <p className={`font-bold ${isOptionSelected(option.id) ? 'text-court-brown' : 'text-neutral-700'}`}>
                                                    {optionLabel}
                                                </p>
                                                {optionDesc && (
                                                    <p className="text-xs text-neutral-400 mt-0.5">{optionDesc}</p>
                                                )}
                                            </div>
                                            {isOptionSelected(option.id) && (
                                                <Motion.div
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    className="w-5 h-5 rounded-full flex items-center justify-center bg-gradient-to-br from-[#C9A227] to-[#8B7019]"
                                                >
                                                    <Check className="w-3 h-3 text-white" />
                                                </Motion.div>
                                            )}
                                        </div>
                                    </Motion.button>
                                );
                                })}
                            </div>

                            {/* Custom input for multi-select */}
                            {currentStepData.allowCustom && (
                                <Motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.3 }}
                                    className="mt-4"
                                >
                                    <input
                                        type="text"
                                        placeholder={t('onboarding.customOptionPlaceholder')}
                                        value={customInputs[currentStepData.field] || ''}
                                        onChange={(e) => setCustomInputs({ ...customInputs, [currentStepData.field]: e.target.value })}
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter' && e.target.value.trim()) {
                                                const customId = `custom_${e.target.value.trim().toLowerCase().replace(/\s+/g, '_')}`;
                                                handleOptionSelect(customId);
                                                setCustomInputs({ ...customInputs, [currentStepData.field]: '' });
                                            }
                                        }}
                                        className="w-full px-4 py-3 bg-white/80 border border-dashed border-neutral-200 rounded-xl text-neutral-600 placeholder:text-neutral-400 focus:outline-none focus:border-[#D2BC76] transition-all"
                                    />
                                </Motion.div>
                            )}
                        </Motion.div>
                    );
                }
                return null;
        }
    };

    return (
        <div className="relative min-h-screen overflow-hidden">
            <OnboardingBackdrop />
            <div className="relative min-h-screen flex flex-col">
                <Paywall
                    isOpen={showPaywall}
                    onClose={handlePaywallClose}
                    triggerReason={t('onboarding.paywall.reason')}
                />

                {/* Progress Bar */}
                <div
                    className="fixed top-0 left-0 right-0 z-50"
                    style={{ paddingTop: 'var(--app-safe-top)' }}
                >
                    <div className="max-w-lg mx-auto px-6 pt-4 pb-3">
                        <div className="glass-card relative overflow-hidden px-4 py-3">
                            <div className="absolute -top-6 -right-4 h-16 w-16 rounded-full bg-[#E8DED1]/35 blur-2xl" />
                            <div className="absolute -bottom-6 -left-4 h-16 w-16 rounded-full bg-[#E8DED1]/25 blur-2xl" />
                            <div className="relative">
                                <div className="flex items-center justify-between mb-2 text-[11px] font-semibold text-neutral-500">
                                    <span>{t('onboarding.progress', { current: onboardingStep + 1, total: totalSteps })}</span>
                                    <span className="text-[#8B7019]">{Math.round(progress)}%</span>
                                </div>
                                <div className="h-2 bg-white/80 rounded-full overflow-hidden shadow-inner-soft">
                                        <Motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${progress}%` }}
                                            transition={{ duration: 0.5, ease: "easeOut" }}
                                            className="h-full rounded-full bg-gradient-to-r from-[#C9A227] via-[#B9911F] to-[#8B7019] shadow-[0_0_8px_rgba(201,162,39,0.35)]"
                                        />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div
                    className="flex-1 flex flex-col max-w-lg mx-auto w-full px-6 pb-32"
                    style={{ paddingTop: 'calc(6.5rem + var(--app-safe-top))' }}
                >
                    <AnimatePresence mode="wait">
                        <Motion.div
                            key={currentStepData.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                            className="flex-1 flex flex-col"
                        >
                            <div className="glass-card relative overflow-hidden p-6 flex-1 flex flex-col">
                                <div className="absolute -top-10 -right-6 h-20 w-20 rounded-full bg-[#E8DED1]/30 blur-3xl" />
                                <div className="absolute -bottom-12 -left-8 h-24 w-24 rounded-full bg-[#E8DED1]/25 blur-3xl" />
                                <div className="relative flex-1 flex flex-col">
                                    {/* Step Header */}
                                    <div className="text-center mb-6">
                                        {currentStepData.icon && (
                                            <Motion.div
                                                animate={{ y: [0, -5, 0] }}
                                                transition={{ duration: 2, repeat: Infinity }}
                                                className="text-5xl mb-3"
                                            >
                                                {currentStepData.icon}
                                            </Motion.div>
                                        )}
                                        <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-400">
                                            {stepBadgeLabel}
                                        </div>
                                        <h2 className="text-2xl font-display font-bold text-neutral-800 mt-3 mb-2">
                                            {showConnectChoice ? t('onboarding.complete.oneMoreThing') : t(currentStepData.titleKey)}
                                        </h2>
                                        <p className="text-neutral-500">
                                            {showConnectChoice ? t('onboarding.complete.savedNotice') : t(currentStepData.subtitleKey)}
                                        </p>
                                    </div>

                                    {/* Step Content */}
                                    <div className="flex-1">
                                        {renderStepContent()}
                                    </div>
                                </div>
                            </div>
                        </Motion.div>
                    </AnimatePresence>
                </div>

                {/* Navigation Buttons */}
                {!showConnectChoice && currentStepData.id !== 'auth' && (
                    <div className="fixed bottom-0 left-0 right-0 backdrop-blur-xl border-t border-white/60 bg-white/80">
                        <div className="max-w-lg mx-auto px-6 py-4 flex items-center gap-3">
                            {onboardingStep > 0 && (
                                <Motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleBack}
                                    className="p-3.5 rounded-2xl bg-white/80 text-neutral-600 border border-white/70 shadow-soft"
                                >
                                    <ArrowLeft className="w-5 h-5" />
                                </Motion.button>
                            )}

                            <Motion.button
                                whileTap={{ scale: 0.97 }}
                                onClick={handleNext}
                                disabled={!canProceed() || isSubmitting}
                                className={`flex-1 py-3.5 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50 ${goldButtonBase}`}
                            >
                                <span aria-hidden="true" className="absolute inset-0 opacity-60" style={goldButtonShineStyle} />
                                <span className="relative z-10 flex items-center gap-2">
                                {isSubmitting ? (
                                    <Motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                    >
                                        <Sparkles className="w-5 h-5" />
                                    </Motion.div>
                                ) : currentStepData.id === 'complete' ? (
                                    <>
                                        {t('onboarding.actions.saveProfile')}
                                        <Check className="w-5 h-5" />
                                    </>
                                ) : currentStepData.id === 'language' ? (
                                    <>
                                        {t('onboarding.language.cta')}
                                        <ArrowRight className="w-5 h-5" />
                                    </>
                                ) : (
                                    <>
                                        {t('common.continue')}
                                        <ArrowRight className="w-5 h-5" />
                                    </>
                                )}
                                </span>
                            </Motion.button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const OnboardingBackdrop = () => (
    <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -right-16 h-56 w-56 rounded-full bg-[#E8DED1]/25 blur-3xl" />
        <div className="absolute top-20 -left-20 h-60 w-60 rounded-full bg-[#E8DED1]/25 blur-3xl" />
        <div className="absolute bottom-12 right-8 h-64 w-64 rounded-full bg-[#F2E9DF]/35 blur-3xl" />
        <div
            className="absolute inset-0 opacity-45"
            style={{
                backgroundImage:
                    'radial-gradient(circle at 18% 20%, rgba(255,255,255,0.75) 0%, transparent 55%), radial-gradient(circle at 80% 10%, rgba(248,242,233,0.85) 0%, transparent 60%)'
            }}
        />
    </div>
);

export default OnboardingPage;
