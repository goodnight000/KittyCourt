import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import useAppStore from '../store/useAppStore';
import { 
    ChevronLeft, MessageCircle, Heart, Calendar, Scale, 
    AlertTriangle, Zap, Cloud, FileText, Clock, User,
    ChevronDown, ChevronUp, ChevronRight, CheckCircle
} from 'lucide-react';
import api from '../services/api';

/**
 * Severity level configuration
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

const CaseDetailPage = () => {
    const navigate = useNavigate();
    const { caseId } = useParams();
    const [caseData, setCaseData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedVerdictIndex, setSelectedVerdictIndex] = useState(0);
    const [openSections, setOpenSections] = useState({
        analysis: true,
        primingA: false,
        primingB: false,
        jointMenu: false,
        resolutions: true,
        verdict: true
    });

    useEffect(() => {
        const fetchCase = async () => {
            try {
                const response = await api.get(`/cases/${caseId}`);
                setCaseData(response.data);
            } catch (error) {
                console.error('Failed to fetch case:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchCase();
    }, [caseId]);

    const parseVerdict = (verdictString) => {
        try {
            return typeof verdictString === 'string' ? JSON.parse(verdictString) : verdictString;
        } catch {
            return { summary: verdictString };
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            weekday: 'short',
            month: 'short', 
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-10 h-10 border-3 border-court-tan border-t-court-gold rounded-full"
                />
            </div>
        );
    }

    if (!caseData) {
        return (
            <div className="space-y-5">
                <div className="flex items-center gap-3">
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate(-1)}
                        className="w-10 h-10 bg-white/80 rounded-xl flex items-center justify-center shadow-soft"
                    >
                        <ChevronLeft className="w-5 h-5 text-neutral-600" />
                    </motion.button>
                    <h1 className="text-xl font-bold text-gradient">Case Not Found</h1>
                </div>
            </div>
        );
    }

    const severity = SEVERITY_CONFIG[caseData.severityLevel] || SEVERITY_CONFIG.friction;
    const SeverityIcon = severity.icon;
    const horseBadgeClass = HORSEMAN_COLORS[caseData.primaryHissTag] || 'bg-neutral-100 text-neutral-600';
    
    // Get all verdicts (sorted by version descending - newest first)
    const allVerdicts = caseData.allVerdicts || [];
    const currentVerdictData = allVerdicts[selectedVerdictIndex];
    const currentVerdict = currentVerdictData ? parseVerdict(currentVerdictData.content) : null;
    const verdictMeta = currentVerdict?._meta || {};
    const analysisEnvelope = verdictMeta.analysis || null;
    const analysisData = analysisEnvelope?.analysis || analysisEnvelope || null;
    const assessedIntensity = verdictMeta.assessedIntensity || analysisEnvelope?.assessedIntensity || null;
    const primingContent = verdictMeta.primingContent || null;
    const jointMenu = verdictMeta.jointMenu || null;
    const resolutionOptions = verdictMeta.resolutions || analysisEnvelope?.resolutions || [];
    const finalResolution = verdictMeta.finalResolution
        || (currentVerdict?.theSentence
            ? {
                title: currentVerdict.theSentence.title,
                description: currentVerdict.theSentence.description,
                rationale: currentVerdict.theSentence.rationale
            }
            : null);

    const toggleSection = (key) => {
        setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <div className="space-y-5 pb-6">
            {/* Header with Back Button */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3"
            >
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                        if (window.history.length > 1) {
                            navigate(-1);
                        } else {
                            navigate('/history', { replace: true });
                        }
                    }}
                    className="w-10 h-10 bg-white/80 rounded-xl flex items-center justify-center shadow-soft"
                >
                    <ChevronLeft className="w-5 h-5 text-neutral-600" />
                </motion.button>
                <div className="flex-1 min-w-0">
                    <h1 className="text-lg font-bold text-gradient truncate">
                        {caseData.caseTitle || 'Case Details'}
                    </h1>
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                        <Calendar className="w-3 h-3" />
                        {formatDate(caseData.createdAt)}
                    </div>
                </div>
            </motion.div>

            {/* Case Summary Card */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-4 space-y-3"
            >
                {/* Badges */}
                <div className="flex flex-wrap gap-2">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${severity.bg} ${severity.text}`}>
                        <SeverityIcon className="w-3.5 h-3.5" />
                        {severity.label}
                    </span>
                    {caseData.primaryHissTag && caseData.primaryHissTag !== 'None' && (
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${horseBadgeClass}`}>
                            {caseData.primaryHissTag}
                        </span>
                    )}
                    {allVerdicts.length > 1 && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-violet-100 text-violet-700">
                            {allVerdicts.length} Verdicts
                        </span>
                    )}
                </div>

                {/* Resolution Summary */}
                {caseData.shortResolution && (
                    <div className="flex items-center gap-2 text-sm text-neutral-600">
                        <span className="text-pink-400">💕</span>
                        <span>{caseData.shortResolution}</span>
                    </div>
                )}
            </motion.div>

            {/* Judging Journey Overview */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="glass-card p-4 space-y-3 bg-gradient-to-br from-court-cream/60 to-white"
            >
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-bold text-neutral-700">Judging Journey</h2>
                        <p className="text-xs text-neutral-500">Evidence → Analysis → Priming → Joint Menu → Resolution</p>
                    </div>
                    <Scale className="w-5 h-5 text-court-gold" />
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-medium">
                    <div className="rounded-xl border border-court-tan/40 bg-white/70 px-3 py-2 text-court-brown">Evidence</div>
                    <div className={`rounded-xl border px-3 py-2 ${analysisData ? 'border-green-400/60 bg-green-50/60 text-green-700' : 'border-court-tan/40 bg-white/70 text-court-brownLight'}`}>
                        Analysis
                    </div>
                    <div className={`rounded-xl border px-3 py-2 ${primingContent ? 'border-green-400/60 bg-green-50/60 text-green-700' : 'border-court-tan/40 bg-white/70 text-court-brownLight'}`}>
                        Priming
                    </div>
                    <div className={`rounded-xl border px-3 py-2 ${jointMenu ? 'border-green-400/60 bg-green-50/60 text-green-700' : 'border-court-tan/40 bg-white/70 text-court-brownLight'}`}>
                        Joint Menu
                    </div>
                    <div className={`rounded-xl border px-3 py-2 col-span-2 ${finalResolution ? 'border-green-400/60 bg-green-50/60 text-green-700' : 'border-court-tan/40 bg-white/70 text-court-brownLight'}`}>
                        Resolution
                    </div>
                </div>
                {!analysisData && !primingContent && !jointMenu && (
                    <p className="text-xs text-neutral-500">
                        Priming and joint menu details were not stored for this case.
                    </p>
                )}
            </motion.div>

            {/* Partner Submissions */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="space-y-3"
            >
                <h2 className="text-sm font-bold text-neutral-700 flex items-center gap-2">
                    <User className="w-4 h-4 text-court-gold" />
                    What Each Partner Said
                </h2>

                {/* Partner A */}
                <div className="glass-card p-4 border-l-4 border-pink-400">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 bg-pink-100 rounded-full flex items-center justify-center overflow-hidden">
                            <img 
                                src="/assets/avatars/judge_whiskers.png" 
                                alt="" 
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <span className="text-sm font-bold text-pink-600">Partner A</span>
                    </div>
                    <div className="space-y-2 pl-10">
                        <div className="flex items-start gap-2">
                            <MessageCircle className="w-4 h-4 text-pink-400 mt-0.5 flex-shrink-0" />
                            <p className="text-neutral-700 text-sm">{caseData.userAInput || 'No input provided'}</p>
                        </div>
                        {caseData.userAFeelings && (
                            <div className="flex items-start gap-2">
                                <Heart className="w-4 h-4 text-pink-400 mt-0.5 flex-shrink-0" />
                                <p className="text-neutral-600 text-sm italic">{caseData.userAFeelings}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Partner B */}
                <div className="glass-card p-4 border-l-4 border-violet-400">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center overflow-hidden">
                            <img 
                                src="/assets/avatars/judge_whiskers.png" 
                                alt="" 
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <span className="text-sm font-bold text-violet-600">Partner B</span>
                    </div>
                    <div className="space-y-2 pl-10">
                        <div className="flex items-start gap-2">
                            <MessageCircle className="w-4 h-4 text-violet-400 mt-0.5 flex-shrink-0" />
                            <p className="text-neutral-700 text-sm">{caseData.userBInput || 'No input provided'}</p>
                        </div>
                        {caseData.userBFeelings && (
                            <div className="flex items-start gap-2">
                                <Heart className="w-4 h-4 text-violet-400 mt-0.5 flex-shrink-0" />
                                <p className="text-neutral-600 text-sm italic">{caseData.userBFeelings}</p>
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>

            {/* Analysis & Intensity */}
            {analysisData && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="space-y-3"
                >
                    <button
                        type="button"
                        onClick={() => toggleSection('analysis')}
                        className="w-full flex items-center justify-between text-sm font-bold text-neutral-700"
                    >
                        <span className="flex items-center gap-2">
                            <Scale className="w-4 h-4 text-court-gold" />
                            Analysis & Intensity
                        </span>
                        {openSections.analysis ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    <AnimatePresence initial={false}>
                        {openSections.analysis && (
                            <motion.div
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                className="space-y-3"
                            >
                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className="glass-card p-3">
                                        <p className="text-[11px] font-bold text-neutral-500 uppercase">Intensity</p>
                                        <p className="text-sm font-semibold text-court-brown capitalize">{assessedIntensity || 'Not assessed'}</p>
                                    </div>
                                    <div className="glass-card p-3">
                                        <p className="text-[11px] font-bold text-neutral-500 uppercase">Dynamic</p>
                                        <p className="text-sm font-semibold text-court-brown">{analysisData.identifiedDynamic || '—'}</p>
                                    </div>
                                    <div className="glass-card p-3 md:col-span-2">
                                        <p className="text-[11px] font-bold text-neutral-500 uppercase">Root Conflict Theme</p>
                                        <p className="text-sm text-neutral-700">{analysisData.rootConflictTheme || '—'}</p>
                                    </div>
                                </div>

                                <div className="glass-card p-3 space-y-3">
                                    <div className="flex items-start gap-3">
                                        <div className="flex-1">
                                            <p className="text-[11px] font-bold text-neutral-500 uppercase">Partner A Vulnerable Emotion</p>
                                            <p className="text-sm text-neutral-700">{analysisData.userA_VulnerableEmotion || '—'}</p>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[11px] font-bold text-neutral-500 uppercase">Partner B Vulnerable Emotion</p>
                                            <p className="text-sm text-neutral-700">{analysisData.userB_VulnerableEmotion || '—'}</p>
                                        </div>
                                    </div>

                                    {(analysisData.userA_Horsemen || analysisData.userB_Horsemen) && (
                                        <div className="grid gap-2 md:grid-cols-2">
                                            <div>
                                                <p className="text-[11px] font-bold text-neutral-500 uppercase mb-1">Partner A Patterns</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {(analysisData.userA_Horsemen || ['None']).map((horse) => (
                                                        <span
                                                            key={`a-${horse}`}
                                                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${HORSEMAN_COLORS[horse] || 'bg-neutral-100 text-neutral-600'}`}
                                                        >
                                                            {horse}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-bold text-neutral-500 uppercase mb-1">Partner B Patterns</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {(analysisData.userB_Horsemen || ['None']).map((horse) => (
                                                        <span
                                                            key={`b-${horse}`}
                                                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${HORSEMAN_COLORS[horse] || 'bg-neutral-100 text-neutral-600'}`}
                                                        >
                                                            {horse}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            )}

            {/* Priming Insights */}
            {primingContent && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.18 }}
                    className="space-y-3"
                >
                    <h2 className="text-sm font-bold text-neutral-700 flex items-center gap-2">
                        <Heart className="w-4 h-4 text-court-gold" />
                        Priming Insights
                    </h2>

                    {(['userA', 'userB']).map((key) => {
                        const content = primingContent[key];
                        if (!content) return null;
                        const sectionKey = key === 'userA' ? 'primingA' : 'primingB';
                        return (
                            <div key={key} className="glass-card p-4 space-y-2">
                                <button
                                    type="button"
                                    onClick={() => toggleSection(sectionKey)}
                                    className="w-full flex items-center justify-between text-sm font-bold text-neutral-700"
                                >
                                    <span>{key === 'userA' ? 'Partner A' : 'Partner B'} Priming</span>
                                    {openSections[sectionKey] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>

                                <AnimatePresence initial={false}>
                                    {openSections[sectionKey] && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -6 }}
                                            className="space-y-3 text-sm text-neutral-700"
                                        >
                                            <div>
                                                <p className="text-[11px] font-bold text-neutral-500 uppercase mb-1">Your Feelings</p>
                                                <p className="text-sm text-neutral-700">{content.yourFeelings}</p>
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-bold text-neutral-500 uppercase mb-1">Partner's Perspective</p>
                                                <p className="text-sm text-neutral-700">{content.partnerPerspective}</p>
                                            </div>
                                            <div className="grid gap-3 md:grid-cols-2">
                                                <div>
                                                    <p className="text-[11px] font-bold text-neutral-500 uppercase mb-1">Reflection Questions</p>
                                                    <ul className="list-disc list-inside text-xs text-neutral-600 space-y-1">
                                                        {content.reflectionQuestions?.map((q, idx) => (
                                                            <li key={`${key}-rq-${idx}`}>{q}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                                <div>
                                                    <p className="text-[11px] font-bold text-neutral-500 uppercase mb-1">Questions for Partner</p>
                                                    <ul className="list-disc list-inside text-xs text-neutral-600 space-y-1">
                                                        {content.questionsForPartner?.map((q, idx) => (
                                                            <li key={`${key}-qp-${idx}`}>{q}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}
                </motion.div>
            )}

            {/* Joint Menu */}
            {jointMenu && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="space-y-3"
                >
                    <button
                        type="button"
                        onClick={() => toggleSection('jointMenu')}
                        className="w-full flex items-center justify-between text-sm font-bold text-neutral-700"
                    >
                        <span className="flex items-center gap-2">
                            <Scale className="w-4 h-4 text-court-gold" />
                            Joint Menu
                        </span>
                        {openSections.jointMenu ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    <AnimatePresence initial={false}>
                        {openSections.jointMenu && (
                            <motion.div
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                className="glass-card p-4 space-y-3"
                            >
                                <div>
                                    <p className="text-[11px] font-bold text-neutral-500 uppercase mb-1">The Real Story</p>
                                    <p className="text-sm text-neutral-700">{jointMenu.theSummary}</p>
                                </div>
                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className="rounded-xl border border-green-200/60 bg-green-50/60 p-3">
                                        <p className="text-[11px] font-bold text-green-700 uppercase mb-1">The Good Stuff</p>
                                        <p className="text-xs text-neutral-700"><strong>Partner A:</strong> {jointMenu.theGoodStuff?.userA}</p>
                                        <p className="text-xs text-neutral-700 mt-1"><strong>Partner B:</strong> {jointMenu.theGoodStuff?.userB}</p>
                                    </div>
                                    <div className="rounded-xl border border-amber-200/60 bg-amber-50/60 p-3">
                                        <p className="text-[11px] font-bold text-amber-700 uppercase mb-1">Growth Edges</p>
                                        <p className="text-xs text-neutral-700"><strong>Partner A:</strong> {jointMenu.theGrowthEdges?.userA}</p>
                                        <p className="text-xs text-neutral-700 mt-1"><strong>Partner B:</strong> {jointMenu.theGrowthEdges?.userB}</p>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold text-neutral-500 uppercase mb-1">Resolution Preview</p>
                                    <p className="text-sm text-neutral-700">{jointMenu.resolutionPreview}</p>
                                </div>
                                {jointMenu.closingWisdom && (
                                    <div className="text-xs text-neutral-500 italic border-t border-neutral-100 pt-3">
                                        "{jointMenu.closingWisdom}"
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            )}

            {/* Resolution Menu */}
            {resolutionOptions?.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.22 }}
                    className="space-y-3"
                >
                    <button
                        type="button"
                        onClick={() => toggleSection('resolutions')}
                        className="w-full flex items-center justify-between text-sm font-bold text-neutral-700"
                    >
                        <span className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            Resolution Menu
                        </span>
                        {openSections.resolutions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    <AnimatePresence initial={false}>
                        {openSections.resolutions && (
                            <motion.div
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                className="space-y-3"
                            >
                                {resolutionOptions.map((option) => {
                                    const isFinal = finalResolution?.title && option.title === finalResolution.title;
                                    return (
                                        <div
                                            key={option.id || option.title}
                                            className={`glass-card p-4 border ${isFinal ? 'border-green-400/70 bg-green-50/60' : 'border-transparent'}`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <p className="text-sm font-bold text-court-brown">{option.title}</p>
                                                    <p className="text-xs text-neutral-500 mt-1">{option.estimatedDuration}</p>
                                                </div>
                                                {isFinal && (
                                                    <span className="text-[10px] font-bold text-green-600 uppercase">Chosen</span>
                                                )}
                                            </div>
                                            <p className="text-sm text-neutral-700 mt-2">{option.combinedDescription}</p>
                                            {option.rationale && (
                                                <p className="text-xs text-neutral-500 italic mt-2">Why: {option.rationale}</p>
                                            )}
                                        </div>
                                    );
                                })}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            )}

            {/* Verdict Section */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-3"
            >
                <button
                    type="button"
                    onClick={() => toggleSection('verdict')}
                    className="w-full flex items-center justify-between text-sm font-bold text-neutral-700"
                >
                    <span className="flex items-center gap-2">
                        <Scale className="w-4 h-4 text-court-gold" />
                        Judge Whiskers' Ruling
                    </span>
                    {openSections.verdict ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {/* Verdict Version Selector (if multiple verdicts) */}
                {openSections.verdict && allVerdicts.length > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-2">
                        {allVerdicts.map((v, idx) => (
                            <motion.button
                                key={v.id || idx}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setSelectedVerdictIndex(idx)}
                                className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                                    selectedVerdictIndex === idx
                                        ? 'bg-court-gold text-white shadow-md'
                                        : 'bg-white/80 text-neutral-600 border border-neutral-200'
                                }`}
                            >
                                <div className="flex items-center gap-1.5">
                                    {v.addendumBy ? (
                                        <>
                                            <FileText className="w-3 h-3" />
                                            <span>Addendum #{v.version}</span>
                                        </>
                                    ) : (
                                        <>
                                            <Scale className="w-3 h-3" />
                                            <span>Original</span>
                                        </>
                                    )}
                                </div>
                            </motion.button>
                        ))}
                    </div>
                )}

                {/* Show Addendum Info if this is an addendum */}
                {openSections.verdict && currentVerdictData?.addendumBy && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="glass-card p-3 bg-violet-50/50 border border-violet-200"
                    >
                        <div className="flex items-start gap-2">
                            <FileText className="w-4 h-4 text-violet-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-violet-600 mb-1">
                                    Addendum by {currentVerdictData.addendumBy === 'userA' ? 'Partner A' : 'Partner B'}
                                </p>
                                <p className="text-sm text-neutral-700 italic">
                                    "{currentVerdictData.addendumText}"
                                </p>
                                <p className="text-[10px] text-neutral-400 mt-1 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatDate(currentVerdictData.createdAt)}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Verdict Content */}
                {openSections.verdict && currentVerdict && (
                    <div className="glass-card p-4 space-y-4 bg-gradient-to-br from-amber-50/50 to-white">
                        {/* Judge Avatar */}
                        <div className="flex items-center gap-3 pb-3 border-b border-neutral-100">
                            <div className="w-12 h-12 rounded-xl overflow-hidden shadow-md border-2 border-court-gold/30">
                                <img 
                                    src="/assets/avatars/judge_whiskers.png" 
                                    alt="Judge Whiskers" 
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div>
                                <p className="font-bold text-court-brown">Judge Whiskers</p>
                                <p className="text-xs text-neutral-500">The Honorable Therapist Cat</p>
                            </div>
                        </div>

                        {/* The Summary */}
                        {(currentVerdict.theSummary || currentVerdict.summary) && (
                            <div>
                                <p className="text-xs font-bold text-violet-500 mb-1.5 flex items-center gap-1">
                                    💬 The Real Story
                                </p>
                                <p className="text-neutral-700 text-sm leading-relaxed">
                                    {currentVerdict.theSummary || currentVerdict.summary}
                                </p>
                            </div>
                        )}

                        {/* The Purr (Validation) */}
                        {currentVerdict.theRuling_ThePurr && (
                            <div>
                                <p className="text-xs font-bold text-green-500 mb-1.5">😻 The Purr (Validation)</p>
                                <div className="space-y-2 pl-2">
                                    <div className="bg-green-50/50 rounded-lg p-2.5">
                                        <p className="text-xs font-medium text-green-600 mb-1">Partner A:</p>
                                        <p className="text-neutral-700 text-sm">{currentVerdict.theRuling_ThePurr.userA}</p>
                                    </div>
                                    <div className="bg-green-50/50 rounded-lg p-2.5">
                                        <p className="text-xs font-medium text-green-600 mb-1">Partner B:</p>
                                        <p className="text-neutral-700 text-sm">{currentVerdict.theRuling_ThePurr.userB}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* The Hiss (Growth Areas) */}
                        {currentVerdict.theRuling_TheHiss && currentVerdict.theRuling_TheHiss.length > 0 && (
                            <div>
                                <p className="text-xs font-bold text-amber-500 mb-1.5">🙀 The Hiss (Growth Areas)</p>
                                <ul className="space-y-1.5 pl-2">
                                    {currentVerdict.theRuling_TheHiss.map((hiss, i) => (
                                        <li key={i} className="text-neutral-700 text-sm flex items-start gap-2">
                                            <span className="text-amber-400 mt-0.5">•</span>
                                            <span>{hiss}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* The Sentence (Repair) */}
                        {currentVerdict.theSentence && (
                            <div className="bg-pink-50/70 rounded-xl p-3.5 border border-pink-100">
                                <p className="text-xs font-bold text-pink-500 mb-1.5">
                                    💕 The Repair: {currentVerdict.theSentence.title}
                                </p>
                                <p className="text-neutral-700 text-sm mb-2">
                                    {currentVerdict.theSentence.description}
                                </p>
                                {currentVerdict.theSentence.rationale && (
                                    <p className="text-neutral-500 text-xs italic">
                                        Why this repair: {currentVerdict.theSentence.rationale}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Closing Statement */}
                        {currentVerdict.closingStatement && (
                            <div className="pt-3 border-t border-neutral-100">
                                <p className="text-neutral-600 text-sm italic text-center">
                                    "{currentVerdict.closingStatement}"
                                </p>
                            </div>
                        )}

                        {/* Legacy format fallbacks */}
                        {!currentVerdict.theSummary && !currentVerdict.theRuling_ThePurr && (
                            <>
                                {currentVerdict.ruling && (
                                    <div>
                                        <p className="text-xs font-bold text-neutral-500 mb-1">⚖️ Ruling</p>
                                        <p className="text-neutral-800 text-sm font-semibold">{currentVerdict.ruling}</p>
                                    </div>
                                )}
                                {currentVerdict.sentence && (
                                    <div>
                                        <p className="text-xs font-bold text-neutral-500 mb-1">📜 Sentence</p>
                                        <p className="text-neutral-700 text-sm">{currentVerdict.sentence}</p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </motion.div>

            {/* All Addendums Timeline (if there are multiple verdicts) */}
            {allVerdicts.length > 1 && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="space-y-3"
                >
                    <h2 className="text-sm font-bold text-neutral-700 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-court-gold" />
                        Case Timeline
                    </h2>
                    
                    <div className="relative pl-4 border-l-2 border-neutral-200 space-y-4">
                        {[...allVerdicts].reverse().map((v, idx) => {
                            const realIndex = allVerdicts.length - 1 - idx;
                            return (
                                <div key={v.id || idx} className="relative">
                                    {/* Timeline dot */}
                                    <div className={`absolute -left-[21px] w-4 h-4 rounded-full border-2 ${
                                        v.addendumBy 
                                            ? 'bg-violet-100 border-violet-400' 
                                            : 'bg-court-gold border-court-goldDark'
                                    }`} />
                                    
                                    <motion.button
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => setSelectedVerdictIndex(realIndex)}
                                        className={`w-full text-left p-3 rounded-xl transition-all ${
                                            selectedVerdictIndex === realIndex
                                                ? 'bg-court-gold/10 border border-court-gold/30'
                                                : 'bg-white/60 hover:bg-white/80'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-medium text-neutral-700">
                                                    {v.addendumBy 
                                                        ? `Addendum by ${v.addendumBy === 'userA' ? 'Partner A' : 'Partner B'}`
                                                        : 'Original Verdict'
                                                    }
                                                </p>
                                                <p className="text-[10px] text-neutral-400 flex items-center gap-1 mt-0.5">
                                                    <Clock className="w-3 h-3" />
                                                    {formatDate(v.createdAt)}
                                                </p>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-neutral-400" />
                                        </div>
                                        {v.addendumText && (
                                            <p className="text-xs text-neutral-500 mt-1.5 line-clamp-2 italic">
                                                "{v.addendumText}"
                                            </p>
                                        )}
                                    </motion.button>
                                </div>
                            );
                        })}
                    </div>
                </motion.div>
            )}
        </div>
    );
};

export default CaseDetailPage;
