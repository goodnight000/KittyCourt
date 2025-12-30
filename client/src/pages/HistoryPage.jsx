import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import useAppStore from '../store/useAppStore';
import useAuthStore from '../store/useAuthStore';
import RequirePartner from '../components/RequirePartner';
import { ChevronLeft, Scale, ChevronRight, Calendar, AlertTriangle, Zap, Cloud, FileText } from 'lucide-react';

/**
 * Severity level configuration for the colored stripe and icon
 */
const SEVERITY_CONFIG = {
    high_tension: {
        stripe: 'bg-red-400',
        bg: 'bg-red-50',
        text: 'text-red-600',
        icon: AlertTriangle,
        label: 'High Tension'
    },
    friction: {
        stripe: 'bg-amber-400',
        bg: 'bg-amber-50',
        text: 'text-amber-600',
        icon: Zap,
        label: 'Friction'
    },
    disconnection: {
        stripe: 'bg-blue-400',
        bg: 'bg-blue-50',
        text: 'text-blue-600',
        icon: Cloud,
        label: 'Disconnection'
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

const HistoryPage = () => {
    const navigate = useNavigate();
    const { caseHistory, fetchCaseHistory } = useAppStore();
    const { hasPartner } = useAuthStore();

    useEffect(() => {
        if (hasPartner) {
            fetchCaseHistory();
        }
    }, [fetchCaseHistory, hasPartner]);

    // Require partner for case history
    if (!hasPartner) {
        return (
            <RequirePartner
                feature="Trial History"
                description="View past verdicts from Judge Whiskers! Your case history will appear here once you connect with your partner and file your first case together."
            >
                {/* Preview content */}
                <div className="space-y-4">
                    <div className="glass-card p-8 text-center">
                        <Scale className="w-12 h-12 mx-auto text-amber-500 mb-3" />
                        <h2 className="text-lg font-bold text-neutral-800">Trial History</h2>
                        <p className="text-sm text-neutral-500">Past verdicts from Judge Whiskers</p>
                    </div>
                </div>
            </RequirePartner>
        );
    }

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

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
        <div className="relative min-h-screen overflow-hidden pb-24">
            <HistoryBackdrop />
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
                        Trial ledger
                    </p>
                    <h1 className="text-2xl font-display font-bold text-neutral-800">Trial History</h1>
                    <p className="text-neutral-500 text-sm">Past verdicts from Judge Whiskers</p>
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
                        <h3 className="font-bold text-neutral-700 mb-2">No Cases Yet</h3>
                        <p className="text-neutral-500 text-sm mb-4">Your trial history will appear here once you file your first case.</p>
                        <motion.button
                            whileTap={{ scale: 0.98 }}
                            onClick={() => navigate('/courtroom')}
                            className="rounded-2xl border border-amber-200/70 bg-white/90 px-5 py-3 text-sm font-bold text-amber-700 shadow-soft"
                        >
                            File First Case
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
                        const resolutionTitle = sentence?.title || caseItem.shortResolution || 'Resolution';
                        const resolutionDescription = sentence?.description || caseItem.shortResolution || 'A plan for both partners.';
                        const summary = verdictContent?.theSummary || verdictContent?.translationSummary || '';

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
                                            {caseItem.caseTitle || `Case #${index + 1}`}
                                        </h3>
                                        <div className="flex items-center gap-1 text-[10px] text-neutral-400 mt-1">
                                            <Calendar className="w-3 h-3" />
                                            {formatDate(caseItem.createdAt)}
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-neutral-400 mt-1" />
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${severity.bg} ${severity.text}`}>
                                        <SeverityIcon className="w-3 h-3" />
                                        {severity.label}
                                    </span>
                                    {caseItem.primaryHissTag && caseItem.primaryHissTag !== 'None' && (
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${HORSEMAN_COLORS[caseItem.primaryHissTag] || 'bg-neutral-100 text-neutral-600'}`}>
                                            {caseItem.primaryHissTag}
                                        </span>
                                    )}
                                    {hasAddendums && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-200/70">
                                            <FileText className="w-3 h-3" />
                                            {verdictCount - 1} Addendum{verdictCount > 2 ? 's' : ''}
                                        </span>
                                    )}
                                </div>

                                <div className="rounded-2xl border border-green-200/70 bg-green-50/70 p-3 space-y-1">
                                    <div className="text-[10px] uppercase font-bold text-green-700 tracking-[0.2em]">
                                        Resolution chosen
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
                                    <span className="px-2 py-0.5 rounded-full bg-court-cream/60 border border-court-tan/30">Analyze</span>
                                    <span className="px-2 py-0.5 rounded-full bg-court-cream/60 border border-court-tan/30">Prime</span>
                                    <span className="px-2 py-0.5 rounded-full bg-court-cream/60 border border-court-tan/30">Resolve</span>
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

export default HistoryPage;
