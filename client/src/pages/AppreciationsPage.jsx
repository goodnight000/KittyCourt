import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Heart, Calendar, Sparkles } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import useAuthStore from '../store/useAuthStore';
import RequirePartner from '../components/RequirePartner';
import { useI18n } from '../i18n';

const AppreciationsPage = () => {
    const navigate = useNavigate();
    const { appreciations, fetchAppreciations } = useAppStore();
    const { hasPartner, partner: connectedPartner } = useAuthStore();
    const { t, language } = useI18n();
    
    // Get partner info from auth store
    const partnerName = connectedPartner?.display_name || connectedPartner?.name || t('appreciations.partnerFallback');

    useEffect(() => {
        fetchAppreciations();
    }, [fetchAppreciations, language]);

    // Require partner for appreciations
    if (!hasPartner) {
        return (
            <RequirePartner
                feature={t('appreciations.feature')}
                description={t('appreciations.requirePartnerDescription')}
            >
                {/* Preview content */}
                <div className="space-y-4">
                    <div className="glass-card p-5 text-center">
                        <Heart className="w-12 h-12 mx-auto text-rose-500 mb-3" />
                        <h2 className="text-lg font-bold text-neutral-800">{t('appreciations.preview.title')}</h2>
                        <p className="text-sm text-neutral-500">{t('appreciations.preview.subtitle')}</p>
                    </div>
                </div>
            </RequirePartner>
        );
    }

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 1) return t('common.justNow');
        if (diffMins < 60) return t('common.minutesAgo', { count: diffMins });
        if (diffHours < 24) return t('common.hoursAgo', { count: diffHours });
        if (diffDays < 7) return t('common.daysAgo', { count: diffDays });
        
        return date.toLocaleDateString(language, { 
            month: 'short', 
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    const formatFullDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString(language, { 
            weekday: 'short',
            month: 'short', 
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    // Group appreciations by date
    const groupByDate = (items) => {
        const groups = {};
        items.forEach(item => {
            const date = new Date(item.createdAt).toDateString();
            if (!groups[date]) groups[date] = [];
            groups[date].push(item);
        });
        return groups;
    };

    const groupedAppreciations = groupByDate(appreciations);
    const dateGroups = Object.keys(groupedAppreciations).sort((a, b) => new Date(b) - new Date(a));

    const formatGroupDate = (dateString) => {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return t('common.today');
        if (date.toDateString() === yesterday.toDateString()) return t('common.yesterday');
        return date.toLocaleDateString(language, { weekday: 'long', month: 'short', day: 'numeric' });
    };

    return (
        <div className="relative min-h-screen overflow-hidden pb-6">
            <AppreciationBackdrop />
            <div className="relative space-y-6">
            {/* Header */}
            <div className="flex items-start gap-3">
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate(-1)}
                    className="rounded-2xl border border-white/80 bg-white/80 p-2 shadow-soft"
                >
                    <ChevronLeft className="w-5 h-5 text-neutral-600" />
                </motion.button>
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-600">
                        {t('appreciations.header.kicker')}
                    </p>
                    <h1 className="text-2xl font-display font-bold text-neutral-800">{t('appreciations.header.title')}</h1>
                    <p className="text-neutral-500 text-sm">
                        {t('appreciations.header.subtitle', { name: partnerName })}
                    </p>
                </div>
            </div>

            {/* Summary Card */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card relative overflow-hidden p-5"
            >
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute -top-10 -right-8 h-24 w-24 rounded-full bg-rose-200/35 blur-2xl" />
                    <div className="absolute -bottom-12 -left-8 h-28 w-28 rounded-full bg-amber-200/35 blur-3xl" />
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-neutral-400 mb-1">
                            {t('appreciations.summary.title')}
                        </p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-display font-bold text-neutral-800">{appreciations.length}</span>
                            <span className="text-neutral-500 text-lg">💕</span>
                        </div>
                        <p className="text-xs text-neutral-500 mt-1">
                            {t('appreciations.summary.from', { name: partnerName })}
                        </p>
                    </div>
                    <motion.div 
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="text-5xl"
                    >
                        🥰
                    </motion.div>
                </div>
            </motion.div>

            {/* Appreciations List */}
            <div className="space-y-4">
                {appreciations.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-card p-8 text-center"
                    >
                        <motion.div
                            animate={{ y: [0, -5, 0] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="w-20 h-20 bg-gradient-to-br from-rose-100 to-amber-100 rounded-3xl flex items-center justify-center mx-auto mb-4"
                        >
                            <Heart className="w-10 h-10 text-rose-400" />
                        </motion.div>
                        <h3 className="font-bold text-neutral-700 mb-2">{t('appreciations.empty.title')}</h3>
                        <p className="text-neutral-500 text-sm mb-1">
                            {t('appreciations.empty.line1', { name: partnerName })}
                        </p>
                        <p className="text-neutral-500 text-sm">
                            {t('appreciations.empty.line2')}
                        </p>
                    </motion.div>
                ) : (
                    dateGroups.map((dateKey, groupIndex) => (
                        <div key={dateKey} className="space-y-2">
                            {/* Date Header */}
                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: groupIndex * 0.05 }}
                                className="flex items-center gap-2 px-1"
                            >
                                <Calendar className="w-3.5 h-3.5 text-amber-500" />
                                <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-[0.3em]">
                                    {formatGroupDate(dateKey)}
                                </span>
                                <div className="flex-1 h-px bg-amber-100/80" />
                            </motion.div>

                            {/* Appreciations for this date */}
                            <div className="space-y-2">
                                {groupedAppreciations[dateKey].map((appreciation, index) => (
                                    <motion.div
                                        key={appreciation.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: (groupIndex * 0.05) + (index * 0.03) }}
                                        className="glass-card relative overflow-hidden p-4"
                                    >
                                        <div className="absolute inset-0 pointer-events-none">
                                            <div className="absolute -top-8 -right-6 h-16 w-16 rounded-full bg-rose-200/30 blur-2xl" />
                                        </div>
                                        <div className="flex items-start gap-3">
                                            {/* Heart Icon */}
                                            <div className="w-10 h-10 bg-rose-100/80 border border-rose-200/70 rounded-2xl flex items-center justify-center flex-shrink-0">
                                                <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
                                            </div>
                                            
                                            <div className="flex-1 min-w-0">
                                                {/* Message */}
                                                <p className="text-neutral-800 text-sm font-medium leading-relaxed">
                                                    "{appreciation.message}"
                                                </p>
                                                
                                                {/* Footer */}
                                                <div className="flex items-center gap-3 mt-2">
                                                    <span className="text-xs text-neutral-400">
                                                        {formatDate(appreciation.createdAt)}
                                                    </span>
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-100/70 text-amber-700 rounded-full text-[10px] font-bold border border-amber-200/70">
                                                        <Sparkles className="w-3 h-3" />
                                                        {t('appreciations.kibbleReward', { count: appreciation.kibbleAmount })}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
            </div>
        </div>
    );
};

const AppreciationBackdrop = () => (
    <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -right-16 h-56 w-56 rounded-full bg-amber-200/30 blur-3xl" />
        <div className="absolute top-16 -left-20 h-60 w-60 rounded-full bg-rose-200/25 blur-3xl" />
        <div className="absolute bottom-6 right-8 h-64 w-64 rounded-full bg-amber-100/40 blur-3xl" />
        <div
            className="absolute inset-0 opacity-45"
            style={{
                backgroundImage:
                    'radial-gradient(circle at 18% 20%, rgba(255,255,255,0.75) 0%, transparent 55%), radial-gradient(circle at 80% 10%, rgba(255,235,210,0.8) 0%, transparent 60%)'
            }}
        />
    </div>
);

export default AppreciationsPage;
