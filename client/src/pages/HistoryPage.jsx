import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import useAppStore from '../store/useAppStore';
import useAuthStore from '../store/useAuthStore';
import usePartnerStore from '../store/usePartnerStore';
import RequirePartner from '../components/RequirePartner';
import { Scale, ChevronRight, Calendar, AlertTriangle, Zap, Cloud, FileText } from 'lucide-react';
import BackButton from '../components/shared/BackButton';
import { useI18n } from '../i18n';
import { formatDate } from '../utils/helpers';

/**
 * Severity level configuration for the colored stripe and icon
 */
const SEVERITY_CONFIG = {
    high_tension: {
        stripe: 'bg-red-400',
        bg: 'bg-red-50',
        text: 'text-red-600',
        icon: AlertTriangle,
        labelKey: 'cases.severity.highTension'
    },
    friction: {
        stripe: 'bg-amber-400',
        bg: 'bg-amber-50',
        text: 'text-amber-600',
        icon: Zap,
        labelKey: 'cases.severity.friction'
    },
    disconnection: {
        stripe: 'bg-blue-400',
        bg: 'bg-blue-50',
        text: 'text-blue-600',
        icon: Cloud,
        labelKey: 'cases.severity.disconnection'
    }
};

/**
 * Horseman badge colors
 */
const HORSEMAN_COLORS = {
    'Criticism': 'bg-pink-100 text-pink-700',
    'Contempt': 'bg-red-100 text-red-700',
    'Defensiveness': 'bg-amber-100 text-amber-700',
    'Stonewalling': 'bg-slate-100 text-slate-700',
};
const HORSEMAN_LABELS = {
    'Criticism': 'cases.horsemen.criticism',
    'Contempt': 'cases.horsemen.contempt',
    'Defensiveness': 'cases.horsemen.defensiveness',
    'Stonewalling': 'cases.horsemen.stonewalling'
};

const HistoryPage = () => {
    const navigate = useNavigate();
    const { caseHistory, fetchCaseHistory } = useAppStore();
    const { hasPartner } = usePartnerStore();
    const { t, language } = useI18n();

    useEffect(() => {
        if (hasPartner) {
            fetchCaseHistory();
        }
    }, [fetchCaseHistory, hasPartner, language]);

    // Require partner for case history
    if (!hasPartner) {
        return (
            <RequirePartner
                feature={t('cases.feature')}
                description={t('cases.requirePartnerDescription')}
            >
                {/* Preview content */}
                <div className="space-y-4">
                    <div className="glass-card p-8 text-center">
                        <Scale className="w-12 h-12 mx-auto text-amber-500 mb-3" />
                        <h2 className="text-lg font-bold text-neutral-800">{t('cases.preview.title')}</h2>
                        <p className="text-sm text-neutral-500">{t('cases.preview.subtitle')}</p>
                    </div>
                </div>
            </RequirePartner>
        );
    }

    const safeParse = (value) => {
        if (!value) return null;
        try {
            return typeof value === 'string' ? JSON.parse(value) : value;
        } catch (_err) {
            return null;
        }
    };

    const getVerdictContent = (caseItem) => {
        if (!caseItem) return null;
        const raw = caseItem.verdict || caseItem.allVerdicts?.[0]?.content || null;
        return safeParse(raw);
    };

    return (
        <div className="relative min-h-screen overflow-hidden pb-6">
            {/* Background gradient */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-amber-200/30 blur-3xl" />
                <div className="absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-rose-200/25 blur-3xl" />
            </div>
            <div className="relative space-y-6">
            {/* Header */}
            <div className="flex items-start gap-3">
                <BackButton onClick={() => navigate(-1)} ariaLabel={t('common.back')} />
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-600">
                        {t('cases.history.kicker')}
                    </p>
                    <h1 className="text-2xl font-display font-bold text-neutral-800">{t('cases.history.title')}</h1>
                    <p className="text-neutral-500 text-sm">{t('cases.history.subtitle')}</p>
                </div>
            </div>

            {/* Cases List */}
            <div className="space-y-3">
                {caseHistory.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-card p-8 text-center"
                    >
                        <motion.div
                            animate={{ y: [0, -5, 0] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="w-20 h-20 bg-gradient-to-br from-amber-100 to-rose-100 rounded-3xl flex items-center justify-center mx-auto mb-4"
                        >
                            <Scale className="w-10 h-10 text-amber-600" />
                        </motion.div>
                        <h3 className="font-bold text-neutral-700 mb-2">{t('cases.history.empty.title')}</h3>
                        <p className="text-neutral-500 text-sm mb-4">{t('cases.history.empty.subtitle')}</p>
                        <motion.button
                            whileTap={{ scale: 0.98 }}
                            onClick={() => navigate('/courtroom')}
                            className="rounded-2xl border border-amber-200/70 bg-white/90 px-5 py-3 text-sm font-bold text-amber-700 shadow-soft"
                        >
                            {t('cases.history.empty.cta')}
                        </motion.button>
                    </motion.div>
                ) : (
                    caseHistory.map((caseItem, index) => {
                        // Get severity config (fallback to friction if not set)
                        const severity = SEVERITY_CONFIG[caseItem.severityLevel] || SEVERITY_CONFIG.friction;
                        const SeverityIcon = severity.icon;

                        // Count verdicts/addendums
                        const verdictCount = caseItem.allVerdicts?.length || 1;
                        const hasAddendums = verdictCount > 1;

                        const verdictContent = getVerdictContent(caseItem);
                        const sentence = verdictContent?.theSentence || verdictContent?.theSentence_RepairAttempt || null;
                        const resolutionTitle = sentence?.title || caseItem.shortResolution || t('cases.history.resolutionFallback');
                        const resolutionDescription = sentence?.description || caseItem.shortResolution || t('cases.history.resolutionDescriptionFallback');
                        const summary = verdictContent?.theSummary || verdictContent?.translationSummary || '';
                        const horseLabel = HORSEMAN_LABELS[caseItem.primaryHissTag]
                            ? t(HORSEMAN_LABELS[caseItem.primaryHissTag])
                            : caseItem.primaryHissTag;

                        return (
                            <motion.button
                                key={caseItem.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => navigate(`/history/${caseItem.id}`)}
                                className="w-full glass-card relative overflow-hidden text-left p-4 space-y-3"
                            >
                                <div className="absolute inset-0 pointer-events-none">
                                    <div className="absolute -top-8 -right-6 h-16 w-16 rounded-full bg-amber-200/30 blur-2xl" />
                                </div>
                                <div className="absolute inset-x-6 top-0 h-0.5 bg-gradient-to-r from-transparent via-amber-200/70 to-transparent" />
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-neutral-800 text-sm leading-snug line-clamp-2">
                                            {caseItem.caseTitle || t('cases.history.caseNumber', { number: index + 1 })}
                                        </h3>
                                        <div className="flex items-center gap-1 text-[10px] text-neutral-500 mt-1">
                                            <Calendar className="w-3 h-3" />
                                            {formatDate(caseItem.createdAt, {
                                                locale: language,
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-neutral-500 mt-1" />
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${severity.bg} ${severity.text}`}>
                                        <SeverityIcon className="w-3 h-3" />
                                        {t(severity.labelKey)}
                                    </span>
                                    {caseItem.primaryHissTag && caseItem.primaryHissTag !== 'None' && (
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${HORSEMAN_COLORS[caseItem.primaryHissTag] || 'bg-neutral-100 text-neutral-600'}`}>
                                            {horseLabel}
                                        </span>
                                    )}
                                    {hasAddendums && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-200/70">
                                            <FileText className="w-3 h-3" />
                                            {verdictCount - 1 === 1
                                                ? t('cases.history.addendumOne')
                                                : t('cases.history.addendumOther', { count: verdictCount - 1 })}
                                        </span>
                                    )}
                                </div>

                                <div className="rounded-2xl border border-green-200/70 bg-green-50/70 p-3 space-y-1">
                                    <div className="text-[10px] uppercase font-bold text-green-700 tracking-[0.2em]">
                                        {t('cases.history.resolutionChosen')}
                                    </div>
                                    <div className="text-sm font-bold text-court-brown">
                                        {resolutionTitle}
                                    </div>
                                    <p className="text-xs text-court-brownLight line-clamp-2">
                                        {resolutionDescription}
                                    </p>
                                </div>

                                {summary && (
                                    <p className="text-xs text-neutral-500 line-clamp-2">
                                        {summary}
                                    </p>
                                )}

                                <div className="flex items-center gap-2 text-[10px] text-court-brownLight">
                                    <span className="px-2 py-0.5 rounded-full bg-court-cream/60 border border-court-tan/30">{t('cases.history.flow.analyze')}</span>
                                    <span className="px-2 py-0.5 rounded-full bg-court-cream/60 border border-court-tan/30">{t('cases.history.flow.prime')}</span>
                                    <span className="px-2 py-0.5 rounded-full bg-court-cream/60 border border-court-tan/30">{t('cases.history.flow.resolve')}</span>
                                </div>
                            </motion.button>
                        );
                    })
                )}
            </div>
            </div>
        </div>
    );
};

const HistoryBackdrop = () => (
    <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-amber-200/30 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-rose-200/25 blur-3xl" />
    </div>
);

export default HistoryPage;
