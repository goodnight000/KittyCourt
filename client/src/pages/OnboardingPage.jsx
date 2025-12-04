import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    ArrowRight, ArrowLeft, Sparkles, Heart,
    Calendar, Camera, MessageCircle, Zap,
    Check, User, Gift, Coffee, Moon, Sun,
    AlertTriangle
} from 'lucide-react';
import useAuthStore from '../store/useAuthStore';
import { validateDate } from '../utils/helpers';

// Onboarding Steps Configuration
const ONBOARDING_STEPS = [
    {
        id: 'welcome',
        title: 'Welcome to Pause! 🐱',
        subtitle: "Let's get to know you better so Judge Whiskers can serve you well",
        icon: '✨',
    },
    {
        id: 'name',
        title: "What should we call you?",
        subtitle: "Pick a name that feels like you",
        icon: '👤',
        field: 'displayName',
    },
    {
        id: 'birthday',
        title: "When's your birthday? 🎂",
        subtitle: "We'll remind your partner (once you're connected!)",
        icon: '🎈',
        field: 'birthday',
    },
    {
        id: 'loveLanguage',
        title: "What's your love language?",
        subtitle: "How do you feel most loved?",
        icon: '💕',
        field: 'loveLanguage',
        options: [
            { id: 'words', emoji: '💬', label: 'Words of Affirmation', desc: 'Sweet messages & compliments' },
            { id: 'acts', emoji: '🎁', label: 'Acts of Service', desc: 'Helpful gestures & tasks' },
            { id: 'gifts', emoji: '🎀', label: 'Receiving Gifts', desc: 'Thoughtful presents & surprises' },
            { id: 'time', emoji: '⏰', label: 'Quality Time', desc: 'Undivided attention & presence' },
            { id: 'touch', emoji: '🤗', label: 'Physical Touch', desc: 'Hugs, cuddles & closeness' },
        ],
    },
    {
        id: 'communicationStyle',
        title: "How do you communicate in disagreements?",
        subtitle: "No judgment here! Understanding this helps resolve disputes 🕊️",
        icon: '💭',
        field: 'communicationStyle',
        options: [
            { id: 'direct', emoji: '🎯', label: 'Direct & Honest', desc: 'I say what I mean right away' },
            { id: 'processing', emoji: '🧠', label: 'Need Time to Process', desc: 'I like to think before responding' },
            { id: 'emotional', emoji: '💖', label: 'Emotional Expresser', desc: 'I lead with feelings first' },
            { id: 'logical', emoji: '📊', label: 'Logical Analyzer', desc: 'I focus on facts and solutions' },
            { id: 'avoidant', emoji: '🐢', label: 'Conflict-Avoidant', desc: 'I prefer to keep the peace' },
        ],
    },
    {
        id: 'conflictStyle',
        title: "When upset, you usually...",
        subtitle: "Self-awareness is a superpower! 🦸",
        icon: '⚡',
        field: 'conflictStyle',
        options: [
            { id: 'talk', emoji: '🗣️', label: 'Want to talk it out', desc: 'Right here, right now' },
            { id: 'space', emoji: '🌙', label: 'Need space first', desc: 'I cool down then discuss' },
            { id: 'write', emoji: '✍️', label: 'Express through writing', desc: 'Texts, notes, letters' },
            { id: 'physical', emoji: '🏃', label: 'Get physical energy out', desc: 'Walk, exercise, move' },
            { id: 'distract', emoji: '🎮', label: 'Need a distraction', desc: 'Reset before engaging' },
        ],
    },
    {
        id: 'dateActivities',
        title: "Your ideal date activities?",
        subtitle: "Pick all that apply! 🌟",
        icon: '🎯',
        field: 'favoriteDateActivities',
        multiSelect: true,
        options: [
            { id: 'dining', emoji: '🍽️', label: 'Dining Out' },
            { id: 'cooking', emoji: '👨‍🍳', label: 'Cooking Together' },
            { id: 'movies', emoji: '🎬', label: 'Movies/Shows' },
            { id: 'outdoors', emoji: '🌲', label: 'Outdoor Adventures' },
            { id: 'travel', emoji: '✈️', label: 'Traveling' },
            { id: 'gaming', emoji: '🎮', label: 'Gaming' },
            { id: 'music', emoji: '🎵', label: 'Concerts/Music' },
            { id: 'arts', emoji: '🎨', label: 'Arts & Culture' },
            { id: 'sports', emoji: '⚽', label: 'Sports' },
            { id: 'relaxing', emoji: '🛋️', label: 'Relaxing at Home' },
            { id: 'fitness', emoji: '💪', label: 'Working Out' },
            { id: 'shopping', emoji: '🛍️', label: 'Shopping' },
        ],
        allowCustom: true,
    },
    {
        id: 'petPeeves',
        title: "Any relationship pet peeves?",
        subtitle: "What little things bug you? (It's okay, we all have them!) 😅",
        icon: '🙈',
        field: 'petPeeves',
        multiSelect: true,
        options: [
            { id: 'lateness', emoji: '⏰', label: 'Being late' },
            { id: 'phone', emoji: '📱', label: 'Phone during quality time' },
            { id: 'mess', emoji: '🧹', label: 'Messiness' },
            { id: 'interrupting', emoji: '🤐', label: 'Being interrupted' },
            { id: 'forgetful', emoji: '🤔', label: 'Forgetfulness' },
            { id: 'passive', emoji: '😶', label: 'Passive aggression' },
            { id: 'plans', emoji: '📅', label: 'Last-minute plan changes' },
            { id: 'chewing', emoji: '😬', label: 'Loud chewing' },
            { id: 'dishes', emoji: '🍽️', label: 'Dishes in the sink' },
            { id: 'silent', emoji: '🤫', label: 'Silent treatment' },
        ],
        allowCustom: true,
    },
    {
        id: 'appreciationStyle',
        title: "When you do something nice...",
        subtitle: "What kind of recognition feels best? 🏆",
        icon: '🌟',
        field: 'appreciationStyle',
        options: [
            { id: 'public', emoji: '📢', label: 'Public recognition', desc: 'Tell the world!' },
            { id: 'private', emoji: '💌', label: 'Private thanks', desc: 'Just between us' },
            { id: 'reciprocate', emoji: '🔄', label: 'Reciprocal action', desc: 'Do something nice back' },
            { id: 'none', emoji: '😊', label: "Just knowing is enough", desc: 'No fuss needed' },
        ],
    },
    {
        id: 'complete',
        title: "You're all set! 🎉",
        subtitle: "Your profile is ready. Now let's connect you with your partner!",
        icon: '✅',
    },
];

const OnboardingPage = () => {
    const navigate = useNavigate();
    const {
        onboardingStep,
        setOnboardingStep,
        onboardingData,
        updateOnboardingData,
        completeOnboarding,
        profile
    } = useAuthStore();

    const [customInputs, setCustomInputs] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showConnectChoice, setShowConnectChoice] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [birthdayError, setBirthdayError] = useState(null);

    const currentStepData = ONBOARDING_STEPS[onboardingStep];
    const totalSteps = ONBOARDING_STEPS.length;
    const progress = ((onboardingStep + 1) / totalSteps) * 100;

    const handleNext = async () => {
        // Clear any previous error
        setSaveError(null);

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
                    setBirthdayError(validation.error);
                    return;
                }
            }
        }

        if (onboardingStep === totalSteps - 1) {
            // Complete onboarding
            console.log('[OnboardingPage] Starting save profile...');
            setIsSubmitting(true);
            try {
                console.log('[OnboardingPage] Calling completeOnboarding...');
                const result = await completeOnboarding();
                console.log('[OnboardingPage] completeOnboarding returned:', result);

                if (result.error) {
                    console.error('[OnboardingPage] Error:', result.error);
                    setSaveError(typeof result.error === 'string' ? result.error : 'Failed to save profile. Please try again.');
                    // Don't set isSubmitting to false here, let the finally block handle it
                    return;
                }

                // Success - show connect choice
                console.log('[OnboardingPage] Success! Showing connect choice...');
                setShowConnectChoice(true);
            } catch (err) {
                console.error('[OnboardingPage] Unexpected error:', err);
                setSaveError('An unexpected error occurred. Please try again.');
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

    const handleConnectNow = () => {
        navigate('/connect');
    };

    const handleConnectLater = () => {
        // Go to app with limited features
        navigate('/');
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

    const canProceed = () => {
        if (!currentStepData.field) return true;
        const value = onboardingData[currentStepData.field];
        if (currentStepData.multiSelect) {
            // Pet peeves are optional
            if (currentStepData.field === 'petPeeves') return true;
            return value && value.length > 0;
        }
        return !!value;
    };

    const renderStepContent = () => {
        switch (currentStepData.id) {
            case 'welcome':
                return (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center space-y-6"
                    >
                        <motion.div
                            animate={{ y: [0, -10, 0], rotate: [0, 5, -5, 0] }}
                            transition={{ duration: 3, repeat: Infinity }}
                            className="text-8xl"
                        >
                            🐱
                        </motion.div>
                        <div className="space-y-4">
                            <p className="text-neutral-600">
                                Pause is your playful space for resolving relationship
                                disputes with humor and love.
                            </p>
                            <div className="flex flex-wrap justify-center gap-2">
                                {['⚖️ Fair Judgments', '💕 Strengthen Bonds', '😹 Have Fun'].map((item, i) => (
                                    <motion.span
                                        key={i}
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: 0.5 + i * 0.2 }}
                                        className="px-3 py-1.5 bg-court-cream rounded-full text-sm text-court-brown"
                                    >
                                        {item}
                                    </motion.span>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                );

            case 'name':
                return (
                    <motion.div
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
                                placeholder="Your name or nickname"
                                className="w-full pl-12 pr-4 py-4 bg-white border-2 border-neutral-200 rounded-2xl text-neutral-700 text-lg placeholder:text-neutral-400 focus:outline-none focus:border-court-gold focus:ring-2 focus:ring-court-gold/20 transition-all"
                                autoFocus
                            />
                        </div>
                        <p className="text-sm text-neutral-400 text-center">
                            This is how you'll appear to your partner 💕
                        </p>
                    </motion.div>
                );

            case 'birthday':
                return (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                    >
                        <div className="relative">
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
                                        setBirthdayError(validation.isValid ? null : validation.error);
                                    } else {
                                        setBirthdayError(null);
                                    }
                                }}
                                className={`w-full pl-12 pr-4 py-4 bg-white border-2 rounded-2xl text-neutral-700 text-lg focus:outline-none focus:ring-2 transition-all ${birthdayError
                                        ? 'border-red-300 focus:border-red-400 focus:ring-red-200'
                                        : 'border-neutral-200 focus:border-court-gold focus:ring-court-gold/20'
                                    }`}
                            />
                        </div>
                        {birthdayError && (
                            <p className="text-sm text-red-500 text-center flex items-center justify-center gap-1">
                                <AlertTriangle className="w-4 h-4" />
                                {birthdayError}
                            </p>
                        )}
                        <p className="text-sm text-neutral-400 text-center">
                            Your partner will be reminded to wish you a happy birthday! 🎈
                        </p>
                    </motion.div>
                );

            case 'complete':
                // Show connect choice after profile is saved
                if (showConnectChoice) {
                    return (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center space-y-6"
                        >
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', delay: 0.1 }}
                                className="w-20 h-20 mx-auto rounded-full flex items-center justify-center shadow-lg bg-gradient-to-br from-pink-400 to-pink-500"
                            >
                                <Heart className="w-10 h-10 text-white" />
                            </motion.div>

                            <div>
                                <h3 className="text-xl font-bold text-neutral-800 mb-2">
                                    Ready to connect with your partner? 💕
                                </h3>
                                <p className="text-neutral-500 text-sm">
                                    You can share your unique code or enter theirs to link your accounts.
                                </p>
                            </div>

                            {/* Partner Code Display */}
                            {profile?.partner_code && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                    className="bg-court-cream/60 rounded-2xl p-4 border border-court-tan"
                                >
                                    <p className="text-xs text-neutral-500 mb-1">Your Partner Code</p>
                                    <p className="text-xl font-mono font-bold text-court-brown tracking-widest">
                                        {profile.partner_code}
                                    </p>
                                </motion.div>
                            )}

                            {/* Connect Now Button */}
                            <motion.button
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={handleConnectNow}
                                className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 shadow-lg"
                                style={{ background: 'linear-gradient(135deg, #C9A227 0%, #8B7019 100%)' }}
                            >
                                <Heart className="w-5 h-5" />
                                Connect with Partner Now
                            </motion.button>

                            {/* Connect Later Button */}
                            <motion.button
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.5 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={handleConnectLater}
                                className="w-full py-3 rounded-2xl font-medium text-neutral-500 bg-neutral-100 hover:bg-neutral-200 transition-colors"
                            >
                                I'll connect later
                            </motion.button>

                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.6 }}
                                className="text-xs text-neutral-400"
                            >
                                Note: Some features like Court & Daily Questions require a partner connection.
                            </motion.p>
                        </motion.div>
                    );
                }

                // Initial complete state (before save)
                return (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center space-y-6"
                    >
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', delay: 0.2 }}
                            className="w-24 h-24 mx-auto rounded-full flex items-center justify-center shadow-lg"
                            style={{ background: 'linear-gradient(135deg, #C9A227 0%, #8B7019 100%)' }}
                        >
                            <Check className="w-12 h-12 text-white" />
                        </motion.div>

                        <div className="flex flex-wrap justify-center gap-3">
                            <div className="px-4 py-2 bg-white rounded-xl shadow-sm">
                                <p className="text-xs text-neutral-400">Name</p>
                                <p className="font-bold text-neutral-700">{onboardingData.displayName}</p>
                            </div>
                            <div className="px-4 py-2 bg-white rounded-xl shadow-sm">
                                <p className="text-xs text-neutral-400">Love Language</p>
                                <p className="font-bold text-neutral-700">
                                    {ONBOARDING_STEPS.find(s => s.id === 'loveLanguage')?.options.find(o => o.id === onboardingData.loveLanguage)?.emoji}{' '}
                                    {ONBOARDING_STEPS.find(s => s.id === 'loveLanguage')?.options.find(o => o.id === onboardingData.loveLanguage)?.label}
                                </p>
                            </div>
                        </div>

                        {/* Error message */}
                        {saveError && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-4 bg-red-50 border border-red-200 rounded-xl"
                            >
                                <p className="text-sm text-red-600 font-medium flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4" />
                                    {saveError}
                                </p>
                            </motion.div>
                        )}
                    </motion.div>
                );

            default:
                // Options-based steps
                if (currentStepData.options) {
                    return (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-3"
                        >
                            <div className={`grid gap-3 ${currentStepData.multiSelect ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                {currentStepData.options.map((option, index) => (
                                    <motion.button
                                        key={option.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        whileTap={{ scale: 0.97 }}
                                        onClick={() => handleOptionSelect(option.id)}
                                        className={`p-4 rounded-2xl text-left transition-all border-2 ${isOptionSelected(option.id)
                                            ? 'border-court-gold bg-court-cream/50 shadow-md'
                                            : 'border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-sm'
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <span className="text-2xl">{option.emoji}</span>
                                            <div className="flex-1">
                                                <p className={`font-bold ${isOptionSelected(option.id) ? 'text-court-brown' : 'text-neutral-700'}`}>
                                                    {option.label}
                                                </p>
                                                {option.desc && (
                                                    <p className="text-xs text-neutral-400 mt-0.5">{option.desc}</p>
                                                )}
                                            </div>
                                            {isOptionSelected(option.id) && (
                                                <motion.div
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    className="w-5 h-5 rounded-full flex items-center justify-center"
                                                    style={{ background: 'linear-gradient(135deg, #C9A227 0%, #8B7019 100%)' }}
                                                >
                                                    <Check className="w-3 h-3 text-white" />
                                                </motion.div>
                                            )}
                                        </div>
                                    </motion.button>
                                ))}
                            </div>

                            {/* Custom input for multi-select */}
                            {currentStepData.allowCustom && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.3 }}
                                    className="mt-4"
                                >
                                    <input
                                        type="text"
                                        placeholder="+ Add your own..."
                                        value={customInputs[currentStepData.field] || ''}
                                        onChange={(e) => setCustomInputs({ ...customInputs, [currentStepData.field]: e.target.value })}
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter' && e.target.value.trim()) {
                                                const customId = `custom_${e.target.value.trim().toLowerCase().replace(/\s+/g, '_')}`;
                                                handleOptionSelect(customId);
                                                setCustomInputs({ ...customInputs, [currentStepData.field]: '' });
                                            }
                                        }}
                                        className="w-full px-4 py-3 bg-neutral-50 border border-dashed border-neutral-300 rounded-xl text-neutral-600 placeholder:text-neutral-400 focus:outline-none focus:border-court-gold transition-all"
                                    />
                                </motion.div>
                            )}
                        </motion.div>
                    );
                }
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-court-cream via-white to-court-tan/30 flex flex-col">
            {/* Progress Bar */}
            <div className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-neutral-100">
                <div className="max-w-lg mx-auto px-6 py-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-neutral-400">
                            Step {onboardingStep + 1} of {totalSteps}
                        </span>
                        <span className="text-xs font-bold text-court-gold">
                            {Math.round(progress)}%
                        </span>
                    </div>
                    <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                            className="h-full rounded-full"
                            style={{ background: 'linear-gradient(135deg, #C9A227 0%, #8B7019 100%)' }}
                        />
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col max-w-lg mx-auto w-full px-6 pt-24 pb-32">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentStepData.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                        className="flex-1 flex flex-col"
                    >
                        {/* Step Header */}
                        <div className="text-center mb-8">
                            <motion.div
                                animate={{ y: [0, -5, 0] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="text-5xl mb-4"
                            >
                                {currentStepData.icon}
                            </motion.div>
                            <h2 className="text-2xl font-bold text-neutral-800 mb-2">
                                {showConnectChoice ? "One more thing..." : currentStepData.title}
                            </h2>
                            <p className="text-neutral-500">
                                {showConnectChoice ? "Your profile is saved! 🎉" : currentStepData.subtitle}
                            </p>
                        </div>

                        {/* Step Content */}
                        <div className="flex-1">
                            {renderStepContent()}
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Navigation Buttons - Hide when showing connect choice */}
            {!showConnectChoice && (
                <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-neutral-100">
                    <div className="max-w-lg mx-auto px-6 py-4 flex items-center gap-3">
                        {onboardingStep > 0 && (
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={handleBack}
                                className="p-3.5 rounded-2xl bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition-all"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </motion.button>
                        )}

                        <motion.button
                            whileTap={{ scale: 0.97 }}
                            onClick={handleNext}
                            disabled={!canProceed() || isSubmitting}
                            className={`flex-1 py-3.5 rounded-2xl font-bold text-white flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50`}
                            style={{ background: 'linear-gradient(135deg, #C9A227 0%, #8B7019 100%)' }}
                        >
                            {isSubmitting ? (
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                >
                                    <Sparkles className="w-5 h-5" />
                                </motion.div>
                            ) : onboardingStep === totalSteps - 1 ? (
                                <>
                                    Save Profile
                                    <Check className="w-5 h-5" />
                                </>
                            ) : (
                                <>
                                    Continue
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </motion.button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OnboardingPage;
