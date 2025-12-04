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
                        <Scale className="w-12 h-12 mx-auto text-violet-400 mb-3" />
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

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate(-1)}
                    className="w-10 h-10 bg-white/80 rounded-xl flex items-center justify-center shadow-soft"
                >
                    <ChevronLeft className="w-5 h-5 text-neutral-600" />
                </motion.button>
                <div>
                    <h1 className="text-xl font-bold text-gradient">Trial History</h1>
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
                            className="w-20 h-20 bg-gradient-to-br from-violet-100 to-pink-100 rounded-3xl flex items-center justify-center mx-auto mb-4"
                        >
                            <Scale className="w-10 h-10 text-violet-400" />
                        </motion.div>
                        <h3 className="font-bold text-neutral-700 mb-2">No Cases Yet</h3>
                        <p className="text-neutral-500 text-sm mb-4">Your trial history will appear here once you file your first case.</p>
                        <motion.button
                            whileTap={{ scale: 0.98 }}
                            onClick={() => navigate('/courtroom')}
                            className="btn-primary"
                        >
                            File First Case
                        </motion.button>
                    </motion.div>
                ) : (
                    caseHistory.map((caseItem, index) => {
                        // Get severity config (fallback to friction if not set)
                        const severity = SEVERITY_CONFIG[caseItem.severityLevel] || SEVERITY_CONFIG.friction;
                        const SeverityIcon = severity.icon;
                        
                        // Get the primary Horseman badge color
                        const horseBadgeClass = HORSEMAN_COLORS[caseItem.primaryHissTag] || 'bg-neutral-100 text-neutral-600';
                        
                        // Count verdicts/addendums
                        const verdictCount = caseItem.allVerdicts?.length || 1;
                        const hasAddendums = verdictCount > 1;

                        return (
                            <motion.button
                                key={caseItem.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => navigate(`/history/${caseItem.id}`)}
                                className="w-full glass-card overflow-hidden flex text-left"
                            >
                                {/* Colored Severity Stripe */}
                                <div className={`w-1.5 ${severity.stripe} flex-shrink-0`} />
                                
                                <div className="flex-1 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            {/* Case Title */}
                                            <h3 className="font-bold text-neutral-800 text-sm leading-snug mb-1.5 line-clamp-2">
                                                {caseItem.caseTitle || `Case #${index + 1}`}
                                            </h3>
                                            
                                            {/* Badges Row */}
                                            <div className="flex flex-wrap items-center gap-1.5 mb-2">
                                                {/* Severity Badge */}
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${severity.bg} ${severity.text}`}>
                                                    <SeverityIcon className="w-3 h-3" />
                                                    {severity.label}
                                                </span>
                                                
                                                {/* Primary Horseman Badge */}
                                                {caseItem.primaryHissTag && caseItem.primaryHissTag !== 'None' && (
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${horseBadgeClass}`}>
                                                        {caseItem.primaryHissTag}
                                                    </span>
                                                )}
                                                
                                                {/* Addendum Badge */}
                                                {hasAddendums && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-violet-100 text-violet-700">
                                                        <FileText className="w-3 h-3" />
                                                        {verdictCount - 1} Addendum{verdictCount > 2 ? 's' : ''}
                                                    </span>
                                                )}
                                            </div>
                                            
                                            {/* Short Resolution */}
                                            {caseItem.shortResolution && (
                                                <p className="text-xs text-neutral-500 flex items-center gap-1">
                                                    <span className="text-pink-400">💕</span>
                                                    {caseItem.shortResolution}
                                                </p>
                                            )}
                                            
                                            {/* Date */}
                                            <div className="flex items-center gap-1 text-[10px] text-neutral-400 mt-2">
                                                <Calendar className="w-3 h-3" />
                                                {formatDate(caseItem.createdAt)}
                                            </div>
                                        </div>
                                        
                                        {/* Arrow Icon */}
                                        <div className="flex-shrink-0 mt-1">
                                            <ChevronRight className="w-5 h-5 text-neutral-400" />
                                        </div>
                                    </div>
                                </div>
                            </motion.button>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default HistoryPage;
