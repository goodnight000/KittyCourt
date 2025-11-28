import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import useAppStore from '../store/useAppStore';
import { ChevronLeft, Scale, ChevronDown, ChevronUp, MessageCircle, Heart, Award, Calendar, Scroll, AlertTriangle, Zap, Cloud } from 'lucide-react';

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
    const [expandedCase, setExpandedCase] = useState(null);

    useEffect(() => {
        fetchCaseHistory();
    }, [fetchCaseHistory]);

    const parseVerdict = (verdictString) => {
        try {
            return typeof verdictString === 'string' ? JSON.parse(verdictString) : verdictString;
        } catch {
            return { summary: verdictString, ruling: '', sentence: '' };
        }
    };

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
                    <p className="text-neutral-500 text-sm">Past verdicts from Judge Mittens</p>
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
                        const verdict = parseVerdict(caseItem.verdict);
                        const isExpanded = expandedCase === caseItem.id;
                        
                        // Get severity config (fallback to friction if not set)
                        const severity = SEVERITY_CONFIG[caseItem.severityLevel] || SEVERITY_CONFIG.friction;
                        const SeverityIcon = severity.icon;
                        
                        // Get the primary Horseman badge color
                        const horseBadgeClass = HORSEMAN_COLORS[caseItem.primaryHissTag] || 'bg-neutral-100 text-neutral-600';

                        return (
                            <motion.div
                                key={caseItem.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="glass-card overflow-hidden flex"
                            >
                                {/* Colored Severity Stripe */}
                                <div className={`w-1.5 ${severity.stripe} flex-shrink-0`} />
                                
                                <div className="flex-1">
                                    {/* Smart Summary Card Header */}
                                    <motion.button
                                        onClick={() => setExpandedCase(isExpanded ? null : caseItem.id)}
                                        className="w-full p-4 text-left"
                                    >
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
                                            
                                            {/* Expand/Collapse Chevron */}
                                            <motion.div
                                                animate={{ rotate: isExpanded ? 180 : 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="flex-shrink-0 mt-1"
                                            >
                                                <ChevronDown className="w-5 h-5 text-neutral-400" />
                                            </motion.div>
                                        </div>
                                    </motion.button>

                                {/* Expanded Content */}
                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.3 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="px-4 pb-4 space-y-4">
                                                {/* Divider */}
                                                <div className="h-px bg-neutral-100" />

                                                {/* Partner A's Input */}
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 bg-pink-100 rounded-full flex items-center justify-center">
                                                            <span className="text-xs">🐱</span>
                                                        </div>
                                                        <span className="text-xs font-bold text-pink-600">Partner A said:</span>
                                                    </div>
                                                    <div className="bg-pink-50/50 rounded-xl p-3">
                                                        <div className="flex items-start gap-2 mb-2">
                                                            <MessageCircle className="w-3.5 h-3.5 text-pink-400 mt-0.5" />
                                                            <p className="text-neutral-700 text-sm">{caseItem.userAInput || 'No input provided'}</p>
                                                        </div>
                                                        {caseItem.userAFeelings && (
                                                            <div className="flex items-start gap-2">
                                                                <Heart className="w-3.5 h-3.5 text-pink-400 mt-0.5" />
                                                                <p className="text-neutral-600 text-xs italic">{caseItem.userAFeelings}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Partner B's Input */}
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 bg-violet-100 rounded-full flex items-center justify-center">
                                                            <span className="text-xs">🐱</span>
                                                        </div>
                                                        <span className="text-xs font-bold text-violet-600">Partner B said:</span>
                                                    </div>
                                                    <div className="bg-violet-50/50 rounded-xl p-3">
                                                        <div className="flex items-start gap-2 mb-2">
                                                            <MessageCircle className="w-3.5 h-3.5 text-violet-400 mt-0.5" />
                                                            <p className="text-neutral-700 text-sm">{caseItem.userBInput || 'No input provided'}</p>
                                                        </div>
                                                        {caseItem.userBFeelings && (
                                                            <div className="flex items-start gap-2">
                                                                <Heart className="w-3.5 h-3.5 text-violet-400 mt-0.5" />
                                                                <p className="text-neutral-600 text-xs italic">{caseItem.userBFeelings}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Judge's Verdict */}
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center">
                                                            <span className="text-xs">🐱</span>
                                                        </div>
                                                        <span className="text-xs font-bold text-amber-600">Judge Mittens ruled:</span>
                                                    </div>
                                                    <div className="bg-gradient-to-br from-amber-50/80 to-white rounded-xl p-3 space-y-3">
                                                        {/* New format: theSummary */}
                                                        {(verdict.theSummary || verdict.summary) && (
                                                            <div>
                                                                <p className="text-xs font-bold text-violet-500 mb-1 flex items-center gap-1">
                                                                    💬 The Real Story
                                                                </p>
                                                                <p className="text-neutral-700 text-sm">{verdict.theSummary || verdict.summary}</p>
                                                            </div>
                                                        )}
                                                        
                                                        {/* New format: theRuling_ThePurr */}
                                                        {verdict.theRuling_ThePurr && (
                                                            <div>
                                                                <p className="text-xs font-bold text-green-500 mb-1">😻 The Purr (Validation)</p>
                                                                <div className="space-y-1.5 pl-2">
                                                                    <p className="text-neutral-600 text-xs"><span className="font-medium">Partner A:</span> {verdict.theRuling_ThePurr.userA}</p>
                                                                    <p className="text-neutral-600 text-xs"><span className="font-medium">Partner B:</span> {verdict.theRuling_ThePurr.userB}</p>
                                                                </div>
                                                            </div>
                                                        )}
                                                        
                                                        {/* New format: theRuling_TheHiss */}
                                                        {verdict.theRuling_TheHiss && verdict.theRuling_TheHiss.length > 0 && (
                                                            <div>
                                                                <p className="text-xs font-bold text-amber-500 mb-1">🙀 The Hiss (Growth Areas)</p>
                                                                <ul className="space-y-1 pl-2">
                                                                    {verdict.theRuling_TheHiss.map((hiss, i) => (
                                                                        <li key={i} className="text-neutral-600 text-xs">• {hiss}</li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}
                                                        
                                                        {/* New format: theSentence */}
                                                        {verdict.theSentence && (
                                                            <div className="bg-pink-50/50 rounded-lg p-2.5">
                                                                <p className="text-xs font-bold text-pink-500 mb-1">💕 The Repair: {verdict.theSentence.title}</p>
                                                                <p className="text-neutral-700 text-xs">{verdict.theSentence.description}</p>
                                                            </div>
                                                        )}
                                                        
                                                        {/* Legacy format fallbacks */}
                                                        {!verdict.theSummary && !verdict.theRuling_ThePurr && (
                                                            <>
                                                                {verdict.ruling && (
                                                                    <div>
                                                                        <p className="text-xs font-bold text-neutral-500 mb-1">⚖️ Ruling</p>
                                                                        <p className="text-neutral-800 text-sm font-semibold">{verdict.ruling}</p>
                                                                    </div>
                                                                )}
                                                                {verdict.sentence && (
                                                                    <div>
                                                                        <p className="text-xs font-bold text-neutral-500 mb-1">📜 Sentence</p>
                                                                        <p className="text-neutral-700 text-sm">{verdict.sentence}</p>
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                                </div>
                            </motion.div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default HistoryPage;
