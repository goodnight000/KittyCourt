import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Bug, Lightbulb, Send, Check } from 'lucide-react';
import { useI18n } from '../i18n';
import useAuthStore from '../store/useAuthStore';
import api from '../services/api';

const FEEDBACK_TYPES = [
    { id: 'contact', icon: MessageCircle, color: 'amber' },
    { id: 'bug', icon: Bug, color: 'rose' },
    { id: 'feature', icon: Lightbulb, color: 'emerald' },
];

const FeedbackPage = () => {
    const navigate = useNavigate();
    const { t } = useI18n();
    const { user } = useAuthStore();

    const [selectedType, setSelectedType] = useState(null);
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async () => {
        // Validate
        if (!selectedType) {
            setError(t('feedback.errors.reasonRequired'));
            return;
        }
        if (!message.trim()) {
            setError(t('feedback.errors.messageRequired'));
            return;
        }

        setError(null);
        setIsSubmitting(true);

        try {
            await api.post('/feedback', {
                type: selectedType,
                message: message.trim(),
                deviceInfo: {
                    userAgent: navigator.userAgent,
                    platform: navigator.platform,
                    timestamp: new Date().toISOString(),
                }
            });

            setIsSuccess(true);

            // Navigate back after showing success
            setTimeout(() => {
                navigate(-1);
            }, 2000);
        } catch (err) {
            console.error('[Feedback] Submit error:', err);
            setError(t('feedback.errors.submitFailed'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const getColorClasses = (color, isSelected) => {
        const colors = {
            amber: isSelected
                ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-200'
                : 'bg-white/70 border-white/80 hover:border-amber-200',
            rose: isSelected
                ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-200'
                : 'bg-white/70 border-white/80 hover:border-rose-200',
            emerald: isSelected
                ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-200'
                : 'bg-white/70 border-white/80 hover:border-emerald-200',
        };
        return colors[color];
    };

    const getIconColorClasses = (color, isSelected) => {
        const colors = {
            amber: isSelected ? 'text-amber-600' : 'text-amber-500',
            rose: isSelected ? 'text-rose-600' : 'text-rose-500',
            emerald: isSelected ? 'text-emerald-600' : 'text-emerald-500',
        };
        return colors[color];
    };

    if (isSuccess) {
        return (
            <div className="relative min-h-screen pb-6 overflow-hidden flex items-center justify-center">
                {/* Background gradient */}
                <div className="fixed inset-0 pointer-events-none">
                    <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-amber-200/30 blur-3xl" />
                    <div className="absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-rose-200/25 blur-3xl" />
                </div>

                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="glass-card p-8 text-center space-y-4 max-w-sm mx-4"
                >
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                        className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-100 to-rose-100 flex items-center justify-center mx-auto"
                    >
                        <Check className="w-8 h-8 text-amber-600" />
                    </motion.div>
                    <h2 className="text-xl font-display font-bold text-neutral-800">
                        {t('feedback.success')}
                    </h2>
                </motion.div>
            </div>
        );
    }

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
                            {t('settings.support.title')}
                        </p>
                        <h1 className="text-2xl font-display font-bold text-neutral-800">
                            {t('feedback.title')}
                        </h1>
                    </div>
                </header>

                {/* Subtitle */}
                <p className="text-sm text-neutral-500">
                    {t('feedback.subtitle')}
                </p>

                {/* Reason Selector */}
                <section className="glass-card p-4 space-y-3">
                    <h2 className="text-sm font-bold text-neutral-700">
                        {t('feedback.reasonLabel')}
                    </h2>
                    <div className="grid grid-cols-3 gap-3">
                        {FEEDBACK_TYPES.map(({ id, icon: Icon, color }) => (
                            <motion.button
                                key={id}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => {
                                    setSelectedType(id);
                                    setError(null);
                                }}
                                className={`relative p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${getColorClasses(color, selectedType === id)}`}
                            >
                                <Icon className={`w-6 h-6 ${getIconColorClasses(color, selectedType === id)}`} />
                                <span className="text-xs font-medium text-neutral-700 text-center">
                                    {t(`feedback.reasons.${id}`)}
                                </span>
                                {selectedType === id && (
                                    <motion.div
                                        layoutId="feedback-check"
                                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center"
                                    >
                                        <Check className="w-3 h-3 text-white" />
                                    </motion.div>
                                )}
                            </motion.button>
                        ))}
                    </div>
                </section>

                {/* Message Input */}
                <section className="glass-card p-4 space-y-3">
                    <h2 className="text-sm font-bold text-neutral-700">
                        {t('feedback.messageLabel')}
                    </h2>
                    <textarea
                        value={message}
                        onChange={(e) => {
                            setMessage(e.target.value);
                            setError(null);
                        }}
                        placeholder={t('feedback.messagePlaceholder')}
                        rows={6}
                        className="w-full bg-white/70 border-2 border-neutral-100 rounded-2xl p-4 text-neutral-700 placeholder:text-neutral-400 focus:ring-2 focus:ring-amber-200 focus:border-amber-300 focus:outline-none text-sm resize-none"
                    />
                </section>

                {/* Error Display */}
                {error && (
                    <motion.p
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-sm text-rose-600 text-center bg-rose-50/80 py-2 px-4 rounded-xl"
                    >
                        {error}
                    </motion.p>
                )}

                {/* Submit Button */}
                <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className={`w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 shadow-soft transition-all ${isSubmitting
                        ? 'bg-neutral-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-[#C9A227] to-[#8B7019] hover:shadow-md'
                        }`}
                >
                    <Send className="w-4 h-4" />
                    {isSubmitting ? '...' : t('feedback.submit')}
                </motion.button>
            </div>
        </div>
    );
};

export default FeedbackPage;
