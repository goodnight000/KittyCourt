import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import usePartnerStore from '../store/usePartnerStore';
import { useI18n } from '../i18n';
import { formatDate } from '../utils/helpers';
import {
    ChevronLeft, MessageCircle, Heart, Calendar, Scale,
    AlertTriangle, Zap, Cloud, FileText, Clock, User,
    ChevronDown, ChevronUp, ChevronRight, CheckCircle, Cpu, Target, Activity
} from 'lucide-react';
import api from '../services/api';

/**
 * Judge model configuration
 * Includes legacy keys (fast, logical, best) for backward compatibility with existing cases
 */
const JUDGE_MODELS = {
    // New judge IDs
    classic: { name: 'Judge Mochi', icon: '☕', description: 'The Gentle Thinker' },
    swift: { name: 'Judge Dash', icon: '⚡', description: 'Speed Meets Brilliance' },
    wise: { name: 'Judge Whiskers', icon: '🐱', description: 'The Wise Sage' },
    // Legacy mappings for existing cases
    fast: { name: 'Judge Mochi', icon: '☕', description: 'The Gentle Thinker' },
    logical: { name: 'Judge Dash', icon: '⚡', description: 'Speed Meets Brilliance' },
    best: { name: 'Judge Whiskers', icon: '🐱', description: 'The Wise Sage' },
};

/**
 * Subtle page backdrop with gradient orbs
 */
const PageBackdrop = () => (
    <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-amber-100/20 blur-3xl" />
        <div className="absolute top-1/3 -left-20 h-72 w-72 rounded-full bg-rose-100/15 blur-3xl" />
        <div className="absolute bottom-20 right-10 h-48 w-48 rounded-full bg-violet-100/15 blur-3xl" />
    </div>
);

/**
 * Section header component with kicker style
 */
const SectionHeader = ({ icon: Icon, title, color = 'amber' }) => {
    const colorClasses = {
        amber: { icon: 'text-amber-500', text: 'text-amber-700', line: 'bg-amber-200/50' },
        rose: { icon: 'text-rose-500', text: 'text-rose-700', line: 'bg-rose-200/50' },
        violet: { icon: 'text-violet-500', text: 'text-violet-700', line: 'bg-violet-200/50' },
        green: { icon: 'text-green-500', text: 'text-green-700', line: 'bg-green-200/50' },
    };
    const colors = colorClasses[color] || colorClasses.amber;

    return (
        <div className="flex items-center gap-2">
            <Icon className={`w-4 h-4 ${colors.icon}`} />
            <span className={`text-[11px] font-semibold ${colors.text} uppercase tracking-[0.2em]`}>
                {title}
            </span>
            <div className={`flex-1 h-px ${colors.line}`} />
        </div>
    );
};

/**
 * Severity level configuration
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
    const { t, language } = useI18n();
    const { profile } = useAuthStore();
    const { partner } = usePartnerStore();

    // Determine partner A and B based on case data
    const isUserA = caseData?.userAId === profile?.id;
    const partnerA = isUserA ? profile : partner;
    const partnerB = isUserA ? partner : profile;
    const partnerAName = partnerA?.display_name || t('cases.detail.partnerStatements.partnerA');
    const partnerBName = partnerB?.display_name || t('cases.detail.partnerStatements.partnerB');

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
                    <h1 className="text-xl font-bold text-gradient">{t('cases.detail.notFound')}</h1>
                </div>
            </div>
        );
    }

    const severity = SEVERITY_CONFIG[caseData.severityLevel] || SEVERITY_CONFIG.friction;
    const SeverityIcon = severity.icon;
    const horseBadgeClass = HORSEMAN_COLORS[caseData.primaryHissTag] || 'bg-neutral-100 text-neutral-600';
    const horseLabel = HORSEMAN_LABELS[caseData.primaryHissTag]
        ? t(HORSEMAN_LABELS[caseData.primaryHissTag])
        : caseData.primaryHissTag;
    
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

    // Resolution picks - when users chose different options
    const userAResolutionPick = verdictMeta.userAResolutionPick || null;
    const userBResolutionPick = verdictMeta.userBResolutionPick || null;
    const hybridResolution = verdictMeta.hybridResolution || null;
    const isHybridCase = verdictMeta.isHybrid || false;

    // Determine if this was a mismatch case (users picked different resolutions)
    const hadMismatch = userAResolutionPick && userBResolutionPick
        && userAResolutionPick.id !== userBResolutionPick.id;

    const toggleSection = (key) => {
        setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    // Get judge model info (fallback to swift/Dash as default)
    const judgeModel = JUDGE_MODELS[caseData.judgeModel] || JUDGE_MODELS.swift;

    return (
        <div className="space-y-5 pb-6">
            <PageBackdrop />

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
                        {caseData.caseTitle || t('cases.detail.titleFallback')}
                    </h1>
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                        <Calendar className="w-3 h-3" />
                        {formatDate(caseData.createdAt, {
                            locale: language,
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </div>
                </div>
            </motion.div>

            {/* Case Meta Card */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-4 space-y-3"
            >
                {/* Primary Badges Row */}
                <div className="flex flex-wrap gap-2">
                    {/* Severity Badge */}
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${severity.bg} ${severity.text} border-current/20`}>
                        <SeverityIcon className="w-3.5 h-3.5" />
                        {t(severity.labelKey)}
                    </span>

                    {/* Intensity Badge */}
                    {assessedIntensity && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                            <Activity className="w-3.5 h-3.5" />
                            {assessedIntensity}
                        </span>
                    )}

                    {/* Horseman Pattern Badge */}
                    {caseData.primaryHissTag && caseData.primaryHissTag !== 'None' && (
                        <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${horseBadgeClass} border-current/20`}>
                            {horseLabel}
                        </span>
                    )}

                    {/* Multiple Verdicts Badge */}
                    {allVerdicts.length > 1 && (
                        <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200">
                            {t('cases.detail.verdicts.other', { count: allVerdicts.length })}
                        </span>
                    )}
                </div>

                {/* Dynamic Type - if available */}
                {analysisData?.identifiedDynamic && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-sky-50/60 rounded-lg border border-sky-200/50">
                        <Scale className="w-4 h-4 text-sky-500" />
                        <span className="text-xs text-sky-700">
                            <span className="font-semibold">{t('cases.detail.analysis.dynamic')}:</span>{' '}
                            {analysisData.identifiedDynamic}
                        </span>
                    </div>
                )}

                {/* Root Conflict Theme - if available */}
                {analysisData?.rootConflictTheme && (
                    <div className="px-3 py-2 bg-amber-50/60 rounded-lg border border-amber-200/50">
                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide mb-1">
                            {t('cases.detail.analysis.rootConflict')}
                        </p>
                        <p className="text-sm text-amber-800 font-medium">
                            {analysisData.rootConflictTheme}
                        </p>
                    </div>
                )}

                {/* Judge Model Indicator */}
                <div className="flex items-center gap-2 pt-2 border-t border-neutral-100">
                    <Cpu className="w-4 h-4 text-neutral-400" />
                    <span className="text-xs text-neutral-500">
                        {t('cases.detail.judgedBy')}:{' '}
                        <span className="font-semibold text-neutral-700">
                            {judgeModel.icon} {judgeModel.name}
                        </span>
                    </span>
                </div>
            </motion.div>

            {/* Partner Perspectives */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="space-y-4"
            >
                <SectionHeader icon={MessageCircle} title={t('cases.detail.partnerStatements.title')} color="amber" />

                {/* Partner A Card */}
                <div className="glass-card p-4 border-l-4 border-rose-400 space-y-4">
                    {/* Header with profile */}
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-100 to-pink-100 border-2 border-white shadow-sm flex items-center justify-center overflow-hidden">
                            {partnerA?.avatar_url ? (
                                <img src={partnerA.avatar_url} alt={partnerAName} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-sm font-bold text-rose-500">
                                    {partnerAName?.charAt(0) || 'A'}
                                </span>
                            )}
                        </div>
                        <div>
                            <p className="font-semibold text-neutral-800">{partnerAName}</p>
                            <p className="text-[10px] text-rose-400 uppercase tracking-wide">
                                {t('cases.detail.partnerStatements.theirPerspective')}
                            </p>
                        </div>
                    </div>

                    {/* What happened (Facts) */}
                    <div className="space-y-1.5">
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide flex items-center gap-1.5">
                            <FileText className="w-3 h-3" />
                            {t('cases.detail.partnerStatements.fact')}
                        </p>
                        <p className="text-sm text-neutral-700 leading-relaxed bg-rose-50/50 rounded-lg p-3">
                            {caseData.userAInput || t('cases.detail.partnerStatements.noInput')}
                        </p>
                    </div>

                    {/* How they felt (Feelings) */}
                    {caseData.userAFeelings && (
                        <div className="space-y-1.5">
                            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide flex items-center gap-1.5">
                                <Heart className="w-3 h-3" />
                                {t('cases.detail.partnerStatements.feelings')}
                            </p>
                            <p className="text-sm text-neutral-600 italic pl-3 border-l-2 border-rose-200">
                                {caseData.userAFeelings}
                            </p>
                        </div>
                    )}

                    {/* What they need (Needs - from analysis if available) */}
                    {(caseData.userANeeds || analysisData?.userA_UnderlyingNeed) && (
                        <div className="space-y-1.5">
                            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide flex items-center gap-1.5">
                                <Target className="w-3 h-3" />
                                {t('cases.detail.partnerStatements.needs')}
                            </p>
                            <p className="text-sm text-neutral-600 bg-rose-50/30 rounded-lg p-3 border-l-2 border-rose-200">
                                {caseData.userANeeds || analysisData?.userA_UnderlyingNeed}
                            </p>
                        </div>
                    )}
                </div>

                {/* Partner B Card */}
                <div className="glass-card p-4 border-l-4 border-violet-400 space-y-4">
                    {/* Header with profile */}
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 border-2 border-white shadow-sm flex items-center justify-center overflow-hidden">
                            {partnerB?.avatar_url ? (
                                <img src={partnerB.avatar_url} alt={partnerBName} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-sm font-bold text-violet-500">
                                    {partnerBName?.charAt(0) || 'B'}
                                </span>
                            )}
                        </div>
                        <div>
                            <p className="font-semibold text-neutral-800">{partnerBName}</p>
                            <p className="text-[10px] text-violet-400 uppercase tracking-wide">
                                {t('cases.detail.partnerStatements.theirPerspective')}
                            </p>
                        </div>
                    </div>

                    {/* What happened (Facts) */}
                    <div className="space-y-1.5">
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide flex items-center gap-1.5">
                            <FileText className="w-3 h-3" />
                            {t('cases.detail.partnerStatements.fact')}
                        </p>
                        <p className="text-sm text-neutral-700 leading-relaxed bg-violet-50/50 rounded-lg p-3">
                            {caseData.userBInput || t('cases.detail.partnerStatements.noInput')}
                        </p>
                    </div>

                    {/* How they felt (Feelings) */}
                    {caseData.userBFeelings && (
                        <div className="space-y-1.5">
                            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide flex items-center gap-1.5">
                                <Heart className="w-3 h-3" />
                                {t('cases.detail.partnerStatements.feelings')}
                            </p>
                            <p className="text-sm text-neutral-600 italic pl-3 border-l-2 border-violet-200">
                                {caseData.userBFeelings}
                            </p>
                        </div>
                    )}

                    {/* What they need (Needs - from analysis if available) */}
                    {(caseData.userBNeeds || analysisData?.userB_UnderlyingNeed) && (
                        <div className="space-y-1.5">
                            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide flex items-center gap-1.5">
                                <Target className="w-3 h-3" />
                                {t('cases.detail.partnerStatements.needs')}
                            </p>
                            <p className="text-sm text-neutral-600 bg-violet-50/30 rounded-lg p-3 border-l-2 border-violet-200">
                                {caseData.userBNeeds || analysisData?.userB_UnderlyingNeed}
                            </p>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Emotional Analysis - Partner-focused */}
            {analysisData && (analysisData.userA_VulnerableEmotion || analysisData.userB_VulnerableEmotion || analysisData.userA_Horsemen || analysisData.userB_Horsemen) && (
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
                            <Heart className="w-4 h-4 text-rose-400" />
                            {t('cases.detail.analysis.emotionalInsights')}
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
                                {/* Partner A Analysis Card */}
                                <div className="rounded-xl border-2 border-rose-200 bg-gradient-to-br from-rose-50/80 to-white p-4 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center">
                                            <span className="text-xs font-bold text-rose-500">
                                                {partnerAName?.charAt(0) || 'A'}
                                            </span>
                                        </div>
                                        <span className="text-sm font-semibold text-rose-700">{partnerAName}</span>
                                    </div>

                                    {analysisData.userA_VulnerableEmotion && (
                                        <div>
                                            <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wide mb-1">
                                                {t('cases.detail.analysis.vulnerableEmotion')}
                                            </p>
                                            <p className="text-sm text-neutral-700 leading-relaxed">
                                                {analysisData.userA_VulnerableEmotion}
                                            </p>
                                        </div>
                                    )}

                                    {analysisData.userA_Horsemen && analysisData.userA_Horsemen.length > 0 && analysisData.userA_Horsemen[0] !== 'None' && (
                                        <div>
                                            <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wide mb-1.5">
                                                {t('cases.detail.analysis.patterns')}
                                            </p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {analysisData.userA_Horsemen.map((horse) => (
                                                    <span
                                                        key={`a-${horse}`}
                                                        className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${HORSEMAN_COLORS[horse] || 'bg-neutral-100 text-neutral-600'}`}
                                                    >
                                                        {HORSEMAN_LABELS[horse]
                                                            ? t(HORSEMAN_LABELS[horse])
                                                            : horse}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Partner B Analysis Card */}
                                <div className="rounded-xl border-2 border-violet-200 bg-gradient-to-br from-violet-50/80 to-white p-4 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center">
                                            <span className="text-xs font-bold text-violet-500">
                                                {partnerBName?.charAt(0) || 'B'}
                                            </span>
                                        </div>
                                        <span className="text-sm font-semibold text-violet-700">{partnerBName}</span>
                                    </div>

                                    {analysisData.userB_VulnerableEmotion && (
                                        <div>
                                            <p className="text-[10px] font-bold text-violet-400 uppercase tracking-wide mb-1">
                                                {t('cases.detail.analysis.vulnerableEmotion')}
                                            </p>
                                            <p className="text-sm text-neutral-700 leading-relaxed">
                                                {analysisData.userB_VulnerableEmotion}
                                            </p>
                                        </div>
                                    )}

                                    {analysisData.userB_Horsemen && analysisData.userB_Horsemen.length > 0 && analysisData.userB_Horsemen[0] !== 'None' && (
                                        <div>
                                            <p className="text-[10px] font-bold text-violet-400 uppercase tracking-wide mb-1.5">
                                                {t('cases.detail.analysis.patterns')}
                                            </p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {analysisData.userB_Horsemen.map((horse) => (
                                                    <span
                                                        key={`b-${horse}`}
                                                        className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${HORSEMAN_COLORS[horse] || 'bg-neutral-100 text-neutral-600'}`}
                                                    >
                                                        {HORSEMAN_LABELS[horse]
                                                            ? t(HORSEMAN_LABELS[horse])
                                                            : horse}
                                                    </span>
                                                ))}
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
                        {t('cases.detail.priming.title')}
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
                                    <span>
                                        {key === 'userA'
                                            ? t('cases.detail.priming.partnerA')
                                            : t('cases.detail.priming.partnerB')}
                                    </span>
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
                                                <p className="text-[11px] font-bold text-neutral-500 uppercase mb-1">{t('cases.detail.priming.yourFeelings')}</p>
                                                <p className="text-sm text-neutral-700">{content.yourFeelings}</p>
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-bold text-neutral-500 uppercase mb-1">{t('cases.detail.priming.partnerPerspective')}</p>
                                                <p className="text-sm text-neutral-700">{content.partnerPerspective}</p>
                                            </div>
                                            <div className="grid gap-3 md:grid-cols-2">
                                                <div>
                                                    <p className="text-[11px] font-bold text-neutral-500 uppercase mb-1">{t('cases.detail.priming.reflectionQuestions')}</p>
                                                    <ul className="list-disc list-inside text-xs text-neutral-600 space-y-1">
                                                        {content.reflectionQuestions?.map((q, idx) => (
                                                            <li key={`${key}-rq-${idx}`}>{q}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                                <div>
                                                    <p className="text-[11px] font-bold text-neutral-500 uppercase mb-1">{t('cases.detail.priming.questionsForPartner')}</p>
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
                            {t('cases.detail.jointMenu.title')}
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
                                    <p className="text-[11px] font-bold text-neutral-500 uppercase mb-1">{t('cases.detail.jointMenu.summary')}</p>
                                    <p className="text-sm text-neutral-700">{jointMenu.theSummary}</p>
                                </div>
                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className="rounded-xl border border-green-200/60 bg-green-50/60 p-3">
                                        <p className="text-[11px] font-bold text-green-700 uppercase mb-1">{t('cases.detail.jointMenu.goodStuff')}</p>
                                        <p className="text-xs text-neutral-700"><strong>{t('cases.detail.partnerStatements.partnerA')}:</strong> {jointMenu.theGoodStuff?.userA}</p>
                                        <p className="text-xs text-neutral-700 mt-1"><strong>{t('cases.detail.partnerStatements.partnerB')}:</strong> {jointMenu.theGoodStuff?.userB}</p>
                                    </div>
                                    <div className="rounded-xl border border-amber-200/60 bg-amber-50/60 p-3">
                                        <p className="text-[11px] font-bold text-amber-700 uppercase mb-1">{t('cases.detail.jointMenu.growthEdges')}</p>
                                        <p className="text-xs text-neutral-700"><strong>{t('cases.detail.partnerStatements.partnerA')}:</strong> {jointMenu.theGrowthEdges?.userA}</p>
                                        <p className="text-xs text-neutral-700 mt-1"><strong>{t('cases.detail.partnerStatements.partnerB')}:</strong> {jointMenu.theGrowthEdges?.userB}</p>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold text-neutral-500 uppercase mb-1">{t('cases.detail.jointMenu.resolutionPreview')}</p>
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
            {(resolutionOptions?.length > 0 || hadMismatch) && (
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
                            {t('cases.detail.resolutions.title')}
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
                                {/* Mismatch Case: Show individual picks + merged resolution */}
                                {hadMismatch ? (
                                    <>
                                        {/* Partner Picks Header */}
                                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">
                                            {t('cases.detail.resolutions.partnerPicks')}
                                        </p>

                                        {/* Partner A's Pick */}
                                        <div className="rounded-xl border-2 border-rose-200 bg-gradient-to-br from-rose-50/60 to-white p-4">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center">
                                                        <span className="text-xs font-bold text-rose-500">
                                                            {partnerAName?.charAt(0) || 'A'}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-rose-700">{userAResolutionPick.title}</p>
                                                        <p className="text-[10px] text-rose-400">{partnerAName}{t('cases.detail.resolutions.chose')}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <p className="text-sm text-neutral-600 mt-2 pl-8">
                                                {userAResolutionPick.combinedDescription || userAResolutionPick.description}
                                            </p>
                                        </div>

                                        {/* Partner B's Pick */}
                                        <div className="rounded-xl border-2 border-violet-200 bg-gradient-to-br from-violet-50/60 to-white p-4">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center">
                                                        <span className="text-xs font-bold text-violet-500">
                                                            {partnerBName?.charAt(0) || 'B'}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-violet-700">{userBResolutionPick.title}</p>
                                                        <p className="text-[10px] text-violet-400">{partnerBName}{t('cases.detail.resolutions.chose')}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <p className="text-sm text-neutral-600 mt-2 pl-8">
                                                {userBResolutionPick.combinedDescription || userBResolutionPick.description}
                                            </p>
                                        </div>

                                        {/* Merged Resolution Header */}
                                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide pt-2">
                                            {t('cases.detail.resolutions.mergedResolution')}
                                        </p>

                                        {/* The Final Merged Resolution */}
                                        <div className="animate-glow-green rounded-xl bg-gradient-to-br from-green-50/80 to-emerald-50/60 p-4">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <p className="text-sm font-bold text-green-700">
                                                        {finalResolution?.title || hybridResolution?.title}
                                                    </p>
                                                    <p className="text-xs text-green-500 mt-0.5">
                                                        {finalResolution?.estimatedDuration || hybridResolution?.estimatedDuration}
                                                    </p>
                                                </div>
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-[10px] font-bold text-green-700 uppercase">
                                                    <CheckCircle className="w-3 h-3" />
                                                    {t('cases.detail.resolutions.chosen')}
                                                </span>
                                            </div>
                                            <p className="text-sm text-neutral-700 mt-2">
                                                {finalResolution?.combinedDescription || finalResolution?.description || hybridResolution?.combinedDescription || hybridResolution?.description}
                                            </p>
                                            {(finalResolution?.rationale || hybridResolution?.rationale) && (
                                                <p className="text-xs text-neutral-500 italic mt-2">
                                                    {t('cases.detail.resolutions.why', { reason: finalResolution?.rationale || hybridResolution?.rationale })}
                                                </p>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    /* Normal Case: Show all resolution options */
                                    resolutionOptions.map((option) => {
                                        const isFinal = finalResolution?.title && option.title === finalResolution.title;
                                        return (
                                            <div
                                                key={option.id || option.title}
                                                className={`glass-card p-4 rounded-xl transition-all ${
                                                    isFinal
                                                        ? 'animate-glow-green bg-gradient-to-br from-green-50/80 to-emerald-50/60'
                                                        : 'border border-neutral-200/50'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <p className={`text-sm font-bold ${isFinal ? 'text-green-700' : 'text-court-brown'}`}>
                                                            {option.title}
                                                        </p>
                                                        <p className="text-xs text-neutral-500 mt-1">{option.estimatedDuration}</p>
                                                    </div>
                                                    {isFinal && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-[10px] font-bold text-green-700 uppercase">
                                                            <CheckCircle className="w-3 h-3" />
                                                            {t('cases.detail.resolutions.chosen')}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-neutral-700 mt-2">{option.combinedDescription}</p>
                                                {option.rationale && (
                                                    <p className="text-xs text-neutral-500 italic mt-2">
                                                        {t('cases.detail.resolutions.why', { reason: option.rationale })}
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
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
                        {t('cases.detail.verdict.title')}
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
                                            <span>{t('cases.detail.verdict.addendumLabel', { number: v.version })}</span>
                                        </>
                                    ) : (
                                        <>
                                            <Scale className="w-3 h-3" />
                                            <span>{t('cases.detail.verdict.originalLabel')}</span>
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
                                    {t('cases.detail.verdict.addendumBy', {
                                        name: currentVerdictData.addendumBy === 'userA'
                                            ? t('cases.detail.partnerStatements.partnerA')
                                            : t('cases.detail.partnerStatements.partnerB')
                                    })}
                                </p>
                                <p className="text-sm text-neutral-700 italic">
                                    "{currentVerdictData.addendumText}"
                                </p>
                                <p className="text-[10px] text-neutral-400 mt-1 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatDate(currentVerdictData.createdAt, {
                                        locale: language,
                                        weekday: 'short',
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Verdict Content */}
                {openSections.verdict && currentVerdict && (
                    <div className="glass-card p-5 space-y-5">
                        {/* The Summary */}
                        {(currentVerdict.theSummary || currentVerdict.summary) && (
                            <div>
                                <p className="text-xs font-bold text-violet-500 uppercase tracking-wide mb-2">
                                    {t('court.verdict.sections.summary.title')}
                                </p>
                                <p className="text-neutral-700 leading-relaxed">
                                    {currentVerdict.theSummary || currentVerdict.summary}
                                </p>
                            </div>
                        )}

                        {/* The Purr (Validation) */}
                        {currentVerdict.theRuling_ThePurr && (
                            <div className="space-y-3">
                                <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide">
                                    {t('court.verdict.sections.purr.title')}
                                </p>
                                <div className="grid gap-2">
                                    <div className="bg-emerald-50/60 rounded-xl p-3 border-l-3 border-emerald-400">
                                        <p className="text-[10px] font-semibold text-emerald-600 mb-1">{partnerAName}</p>
                                        <p className="text-sm text-neutral-700">{currentVerdict.theRuling_ThePurr.userA}</p>
                                    </div>
                                    <div className="bg-emerald-50/60 rounded-xl p-3 border-l-3 border-emerald-400">
                                        <p className="text-[10px] font-semibold text-emerald-600 mb-1">{partnerBName}</p>
                                        <p className="text-sm text-neutral-700">{currentVerdict.theRuling_ThePurr.userB}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* The Hiss (Growth Areas) */}
                        {currentVerdict.theRuling_TheHiss && currentVerdict.theRuling_TheHiss.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-xs font-bold text-amber-600 uppercase tracking-wide">
                                    {t('court.verdict.sections.hiss.title')}
                                </p>
                                <div className="bg-amber-50/50 rounded-xl p-4">
                                    <ul className="space-y-2">
                                        {currentVerdict.theRuling_TheHiss.map((hiss, i) => (
                                            <li key={i} className="text-sm text-neutral-700 flex items-start gap-2">
                                                <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                                                    {i + 1}
                                                </span>
                                                <span>{hiss}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}

                        {/* The Sentence (Repair) */}
                        {currentVerdict.theSentence && (
                            <div className="bg-rose-50/60 rounded-xl p-4 border border-rose-200/50 space-y-2">
                                <p className="text-xs font-bold text-rose-600 uppercase tracking-wide">
                                    {t('court.verdict.sections.repair.title')}
                                </p>
                                <p className="font-semibold text-neutral-800">{currentVerdict.theSentence.title}</p>
                                <p className="text-sm text-neutral-700">{currentVerdict.theSentence.description}</p>
                                {currentVerdict.theSentence.rationale && (
                                    <p className="text-xs text-neutral-500 italic pt-2 border-t border-rose-100">
                                        {t('cases.detail.verdict.repairWhy', { reason: currentVerdict.theSentence.rationale })}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Closing Statement */}
                        {currentVerdict.closingStatement && (
                            <div className="pt-4 border-t border-neutral-100 text-center">
                                <p className="text-neutral-500 text-sm italic">
                                    "{currentVerdict.closingStatement}"
                                </p>
                            </div>
                        )}

                        {/* Legacy format fallbacks */}
                        {!currentVerdict.theSummary && !currentVerdict.theRuling_ThePurr && (
                            <>
                                {currentVerdict.ruling && (
                                    <div>
                                        <p className="text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1">{t('cases.detail.verdict.legacyRuling')}</p>
                                        <p className="text-neutral-800 text-sm font-semibold">{currentVerdict.ruling}</p>
                                    </div>
                                )}
                                {currentVerdict.sentence && (
                                    <div>
                                        <p className="text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1">{t('cases.detail.verdict.legacySentence')}</p>
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
                        {t('cases.detail.timeline.title')}
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
                                                        ? t('cases.detail.timeline.addendumBy', {
                                                            name: v.addendumBy === 'userA'
                                                                ? t('cases.detail.partnerStatements.partnerA')
                                                                : t('cases.detail.partnerStatements.partnerB')
                                                        })
                                                        : t('cases.detail.timeline.originalVerdict')}
                                                </p>
                                                <p className="text-[10px] text-neutral-400 flex items-center gap-1 mt-0.5">
                                                    <Clock className="w-3 h-3" />
                                                    {formatDate(v.createdAt, {
                                                        locale: language,
                                                        weekday: 'short',
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
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
