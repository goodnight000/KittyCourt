import React, { useEffect, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Heart, Calendar, HeartHandshake } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import useAuthStore from '../store/useAuthStore';
import usePartnerStore from '../store/usePartnerStore';
import useCacheStore, { CACHE_POLICY, cacheKey } from '../store/useCacheStore';
import RequirePartner from '../components/RequirePartner';
import api from '../services/api';
import { useI18n } from '../i18n';
import BackButton from '../components/shared/BackButton';
import useUiPerfProfile from '../hooks/useUiPerfProfile';
import useStagedMount from '../hooks/useStagedMount';
import { isNativeIOS } from '../utils/platform';

const AppreciationsPage = () => {
    const navigate = useNavigate();
    const appreciations = useAppStore((state) => state.appreciations);
    const fetchAppreciations = useAppStore((state) => state.fetchAppreciations);
    const authUser = useAuthStore((state) => state.user);
    const hasPartner = usePartnerStore((state) => state.hasPartner);
    const connectedPartner = usePartnerStore((state) => state.partner);
    const { t, language } = useI18n();
    const [totalAppreciations, setTotalAppreciations] = useState(null);
    const { prefersReducedMotion } = useUiPerfProfile();
    const shouldReduceFx = prefersReducedMotion;
    const showAppreciationList = useStagedMount({
        enabled: isNativeIOS() && !prefersReducedMotion && appreciations.length > 0,
        delay: 220
    });
    
    // Get partner info from auth store
    const partnerName = connectedPartner?.display_name || connectedPartner?.name || t('appreciations.partnerFallback');

    useEffect(() => {
        fetchAppreciations();
    }, [fetchAppreciations, language]);

    // Fetch unified stats for count display (single source of truth)
    useEffect(() => {
        const fetchStats = async () => {
            if (!authUser?.id) return;

            try {
                const cacheStore = useCacheStore.getState();
                const key = cacheKey.stats(authUser.id);
                const applyStats = (stats) => {
                    setTotalAppreciations(stats?.appreciations_received ?? 0);
                };

                const { data, promise } = await cacheStore.getOrFetch({
                    key,
                    fetcher: async () => {
                        const response = await api.get('/stats');
                        return response.data || null;
                    },
                    ...CACHE_POLICY.STATS,
                    revalidateOnInterval: true,
                });

                applyStats(data);

                if (promise) {
                    promise.then((fresh) => applyStats(fresh)).catch(() => {});
                }
            } catch (err) {
                console.error('Failed to fetch stats:', err);
                // Fallback to appreciations array length if stats fail
                setTotalAppreciations(appreciations.length);
            }
        };
        fetchStats();
    }, [authUser?.id, appreciations.length]);

    useEffect(() => {
        if (!authUser?.id) return;
        const cacheStore = useCacheStore.getState();
        const key = cacheKey.stats(authUser.id);
        const unsubscribe = cacheStore.subscribeKey(key, (stats) => {
            setTotalAppreciations(stats?.appreciations_received ?? appreciations.length);
        });
        return unsubscribe;
    }, [authUser?.id, appreciations.length]);

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
    const shouldAnimateRows = !shouldReduceFx && appreciations.length <= 16;

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
            <AppreciationBackdrop reduceFx={shouldReduceFx} />
            <div className="relative space-y-6">
            {/* Header */}
            <div className="flex items-start gap-3">
                <BackButton onClick={() => navigate(-1)} ariaLabel={t('common.back')} />
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
            <Motion.div
                initial={shouldReduceFx ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card relative overflow-hidden p-5"
            >
                <div className="absolute inset-0 pointer-events-none">
                    <div className={`absolute -top-10 -right-8 h-24 w-24 rounded-full bg-rose-200/35 ${shouldReduceFx ? 'blur-lg' : 'blur-2xl'}`} />
                    <div className={`absolute -bottom-12 -left-8 h-28 w-28 rounded-full bg-amber-200/35 ${shouldReduceFx ? 'blur-xl' : 'blur-3xl'}`} />
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-neutral-500 mb-1">
                            {t('appreciations.summary.title')}
                        </p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-display font-bold text-neutral-800">{totalAppreciations ?? appreciations.length}</span>
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-rose-100/80 border border-rose-200/70 shadow-inner-soft">
                                <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                            </span>
                        </div>
                        <p className="text-xs text-neutral-500 mt-1">
                            {t('appreciations.summary.from', { name: partnerName })}
                        </p>
                    </div>
                    <Motion.div
                        animate={shouldReduceFx ? undefined : { scale: [1, 1.1, 1] }}
                        transition={shouldReduceFx ? undefined : { duration: 2, repeat: Infinity }}
                        className="relative"
                    >
                        <div className="absolute -inset-2 rounded-[28px] bg-gradient-to-br from-rose-200/35 via-white/40 to-amber-200/35 blur-xl opacity-70" />
                        <div className="relative h-16 w-16 rounded-[22px] bg-gradient-to-br from-rose-50 via-white to-amber-50 border border-white/80 shadow-soft grid place-items-center">
                            <HeartHandshake className="w-8 h-8 text-rose-500" />
                        </div>
                    </Motion.div>
                </div>
            </Motion.div>

            {/* Appreciations List */}
            <div className="space-y-4">
                {!showAppreciationList && appreciations.length > 0 ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map((item) => (
                            <div key={item} className="glass-card p-4 border border-white/80 animate-pulse">
                                <div className="h-3 w-28 rounded-full bg-neutral-200/70 mb-2" />
                                <div className="h-4 w-52 rounded-full bg-neutral-200/70 mb-3" />
                                <div className="h-16 rounded-2xl bg-neutral-100/80 border border-neutral-200/80" />
                            </div>
                        ))}
                    </div>
                ) : appreciations.length === 0 ? (
                    <Motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-card p-8 text-center"
                    >
                        <Motion.div
                            animate={prefersReducedMotion ? undefined : { y: [0, -5, 0] }}
                            transition={prefersReducedMotion ? undefined : { duration: 2, repeat: Infinity }}
                            className="w-20 h-20 bg-gradient-to-br from-rose-100 to-amber-100 rounded-3xl flex items-center justify-center mx-auto mb-4"
                        >
                            <Heart className="w-10 h-10 text-rose-400" />
                        </Motion.div>
                        <h3 className="font-bold text-neutral-700 mb-2">{t('appreciations.empty.title')}</h3>
                        <p className="text-neutral-500 text-sm mb-1">
                            {t('appreciations.empty.line1', { name: partnerName })}
                        </p>
                        <p className="text-neutral-500 text-sm">
                            {t('appreciations.empty.line2')}
                        </p>
                    </Motion.div>
                ) : (
                    dateGroups.map((dateKey, groupIndex) => (
                        <div key={dateKey} className="space-y-2">
                            {/* Date Header */}
                            <Motion.div
                                initial={shouldAnimateRows ? { opacity: 0, x: -10 } : false}
                                animate={{ opacity: 1, x: 0 }}
                                transition={shouldAnimateRows ? { delay: Math.min(groupIndex * 0.03, 0.15) } : { duration: 0.1 }}
                                className="flex items-center gap-2 px-1"
                            >
                                <Calendar className="w-3.5 h-3.5 text-amber-500" />
                                <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-[0.3em]">
                                    {formatGroupDate(dateKey)}
                                </span>
                                <div className="flex-1 h-px bg-amber-100/80" />
                            </Motion.div>

                            {/* Appreciations for this date */}
                            <div className="space-y-2">
                                {groupedAppreciations[dateKey].map((appreciation, index) => (
                                    <Motion.div
                                        key={appreciation.id}
                                        initial={shouldAnimateRows ? { opacity: 0, y: 10 } : false}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={shouldAnimateRows ? { delay: Math.min((groupIndex * 0.03) + (index * 0.02), 0.2) } : { duration: 0.1 }}
                                        className="glass-card relative overflow-hidden p-4 perf-content-auto-compact contain-paint"
                                    >
                                        <div className="absolute inset-0 pointer-events-none">
                                            <div className={`absolute -top-8 -right-6 h-16 w-16 rounded-full bg-rose-200/30 ${shouldReduceFx ? 'blur-lg' : 'blur-2xl'}`} />
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
                                                    <span className="text-xs text-neutral-500">
                                                        {formatDate(appreciation.createdAt)}
                                                    </span>
                                                    <span className="inline-flex items-center px-2.5 py-0.5 bg-amber-100/70 text-amber-700 rounded-full text-[10px] font-bold border border-amber-200/70">
                                                        {t('appreciations.kibbleReward', { count: appreciation.kibbleAmount })}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </Motion.div>
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

const AppreciationBackdrop = ({ reduceFx }) => (
    <div className="fixed inset-0 pointer-events-none">
        <div className={`absolute -top-20 -right-20 h-64 w-64 rounded-full bg-amber-200/30 ${reduceFx ? 'blur-xl' : 'blur-3xl'}`} />
        <div className={`absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-rose-200/25 ${reduceFx ? 'blur-xl' : 'blur-3xl'}`} />
    </div>
);

export default AppreciationsPage;
