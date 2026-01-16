import React, { useEffect, useMemo, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Sparkles, Check, Mail } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';
import useOnboardingStore from '../store/useOnboardingStore';
import { validateDate } from '../utils/helpers';
import Paywall from '../components/Paywall';
import { useI18n } from '../i18n';
import { DEFAULT_LANGUAGE, normalizeLanguage } from '../i18n/languageConfig';
import OnboardingStep from '../components/onboarding/OnboardingStep';
import LanguageStep from '../components/onboarding/LanguageStep';
import WelcomeStep from '../components/onboarding/WelcomeStep';
import AuthStep from '../components/onboarding/AuthStep';
import ProfileFieldStep from '../components/onboarding/ProfileFieldStep';
import OptionsStep from '../components/onboarding/OptionsStep';
import CompleteStep from '../components/onboarding/CompleteStep';

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
        profile,
        signUp,
        signInWithGoogle,
        preferredLanguage,
        setPreferredLanguage
    } = useAuthStore();
    const {
        onboardingStep,
        setOnboardingStep,
        onboardingData,
        updateOnboardingData,
        completeOnboarding
    } = useOnboardingStore();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showConnectChoice, setShowConnectChoice] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [birthdayError, setBirthdayError] = useState(null);
    const [showPaywall, setShowPaywall] = useState(false);
    const [postPaywallPath, setPostPaywallPath] = useState(null);
    const [authError, setAuthError] = useState(null);
    const [authSubmitting, setAuthSubmitting] = useState(false);
    const [emailConfirmationPending, setEmailConfirmationPending] = useState(null);
    const logDebug = (...args) => {
        if (import.meta.env.DEV) console.log(...args);
    };

    const goldButtonBase =
        'relative overflow-hidden border border-[#E3D098] bg-gradient-to-br from-[#C9A227] via-[#B9911F] to-[#8B7019] shadow-[0_12px_24px_rgba(201,162,39,0.22)] hover:brightness-105';
    const goldButtonShineStyle = {
        background: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.65), transparent 55%)'
    };

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
            logDebug('[OnboardingPage] Starting save profile...');
            setIsSubmitting(true);
            try {
                logDebug('[OnboardingPage] Calling completeOnboarding...');
                const result = await completeOnboarding();
                logDebug('[OnboardingPage] completeOnboarding returned:', result);

                if (result.error) {
                    console.error('[OnboardingPage] Error:', result.error);
                    setSaveError(t('onboarding.errors.saveFailed'));
                    // Don't set isSubmitting to false here, let the finally block handle it
                    return;
                }

                // Success - show connect choice
                logDebug('[OnboardingPage] Success! Showing connect choice...');
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

    const handleEmailSignUp = async (email, password, confirmPassword) => {
        setAuthError(null);
        setAuthSubmitting(true);

        const trimmedEmail = email.trim();
        if (!trimmedEmail || !password || !confirmPassword) {
            setAuthError(t('onboarding.errors.missingFields'));
            setAuthSubmitting(false);
            return;
        }

        if (password !== confirmPassword) {
            setAuthError(t('onboarding.errors.passwordsMismatch'));
            setAuthSubmitting(false);
            return;
        }

        if (password.length < 8) {
            setAuthError(t('onboarding.errors.passwordTooShort'));
            setAuthSubmitting(false);
            return;
        }

        const { error, needsEmailConfirmation, email: signUpEmail } = await signUp(trimmedEmail, password);
        setAuthSubmitting(false);

        if (error) {
            setAuthError(t('onboarding.errors.signUpFailed'));
            return;
        }

        if (needsEmailConfirmation) {
            // Show email confirmation pending UI instead of proceeding
            setEmailConfirmationPending(signUpEmail);
            return;
        }
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
                    <LanguageStep
                        supportedLanguages={supportedLanguages}
                        selectedLanguage={onboardingData.preferredLanguage}
                        onLanguageSelect={handleLanguageSelect}
                    />
                );

            case 'welcome':
                return <WelcomeStep />;

            case 'auth':
                // Show email confirmation pending UI if user needs to verify email
                if (emailConfirmationPending) {
                    return (
                        <Motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-center space-y-6"
                        >
                            <Motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', delay: 0.2 }}
                                className="w-20 h-20 mx-auto rounded-full flex items-center justify-center"
                                style={{ background: 'linear-gradient(135deg, #C9A227 0%, #8B7019 100%)' }}
                            >
                                <Mail className="w-10 h-10 text-white" />
                            </Motion.div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-bold text-neutral-800">
                                    {t('onboarding.auth.emailConfirmation.title')}
                                </h3>
                                <p className="text-neutral-600">
                                    {t('onboarding.auth.emailConfirmation.message', { email: emailConfirmationPending })}
                                </p>
                            </div>
                            <div className="glass-card p-4 border border-[#E2D6C7]">
                                <p className="text-sm text-neutral-500">
                                    {t('onboarding.auth.emailConfirmation.hint')}
                                </p>
                            </div>
                            <button
                                onClick={() => setEmailConfirmationPending(null)}
                                className="text-sm font-semibold text-court-brown hover:text-[#8B7019] transition-colors"
                            >
                                {t('onboarding.auth.emailConfirmation.tryDifferent')}
                            </button>
                        </Motion.div>
                    );
                }
                return (
                    <AuthStep
                        onGoogleSignUp={handleGoogleSignUp}
                        onEmailSignUp={handleEmailSignUp}
                        authError={authError}
                        authSubmitting={authSubmitting}
                    />
                );

            case 'name':
                return (
                    <ProfileFieldStep
                        fieldType="name"
                        value={onboardingData.displayName}
                        onChange={(value) => updateOnboardingData({ displayName: value })}
                    />
                );

            case 'birthday':
                return (
                    <ProfileFieldStep
                        fieldType="birthday"
                        value={onboardingData.birthday}
                        onChange={(value) => {
                            updateOnboardingData({ birthday: value });
                            if (value) {
                                const validation = validateDate(value);
                                setBirthdayError(validation.isValid ? null : translateValidationError(validation));
                            } else {
                                setBirthdayError(null);
                            }
                        }}
                        error={birthdayError}
                    />
                );

            case 'avatar':
                return (
                    <ProfileFieldStep
                        fieldType="avatar"
                        value={onboardingData.avatarUrl}
                        onChange={(value) => updateOnboardingData({ avatarUrl: value })}
                    />
                );

            case 'complete':
                return (
                    <CompleteStep
                        onboardingData={onboardingData}
                        loveLanguageOption={loveLanguageOption}
                        showConnectChoice={showConnectChoice}
                        partnerCode={profile?.partner_code}
                        saveError={saveError}
                        onConnectNow={handleConnectNow}
                        onConnectLater={handleConnectLater}
                    />
                );

            default:
                // Options-based steps
                if (currentStepData.options) {
                    return (
                        <OptionsStep
                            options={currentStepData.options}
                            selectedValue={onboardingData[currentStepData.field]}
                            onOptionSelect={handleOptionSelect}
                            multiSelect={currentStepData.multiSelect}
                            allowCustom={currentStepData.allowCustom}
                            fieldName={currentStepData.field}
                        />
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
                            <OnboardingStep
                                stepData={currentStepData}
                                stepBadgeLabel={stepBadgeLabel}
                                showConnectChoice={showConnectChoice}
                            >
                                {renderStepContent()}
                            </OnboardingStep>
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
    <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-amber-200/30 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-rose-200/25 blur-3xl" />
    </div>
);

export default OnboardingPage;
