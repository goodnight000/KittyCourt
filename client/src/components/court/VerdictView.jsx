import React from 'react';
import { motion } from 'framer-motion';
import {
    Gavel, Star, Quote, AlertTriangle, HeartHandshake,
    Plus, Check, ChevronRight, Heart, Lightbulb, Clock
} from 'lucide-react';
import { useI18n } from '../../i18n';

/**
 * VerdictView - Displays the selected judge's verdict
 * Shows summary, purr (validation), hiss (accountability), sentence (repair), and actions
 */
const HORSEMAN_LABELS = {
    Criticism: 'cases.horsemen.criticism',
    Contempt: 'cases.horsemen.contempt',
    Defensiveness: 'cases.horsemen.defensiveness',
    Stonewalling: 'cases.horsemen.stonewalling',
};

const VerdictView = ({
    activeCase, verdict, analysis, allVerdicts, selectedVerdictVersion,
    setSelectedVerdictVersion, userAName, userBName, setShowAddendumModal,
    resetCase, currentUser, onAcceptVerdict, isInitiator,
    addendumRemaining = null,
    addendumLimit = null,
    judgeAvatar,
    judgeName
}) => {
    const { t } = useI18n();
    const resolvedJudgeName = judgeName || t('court.judges.swift.name');
    const avatarSrc = judgeAvatar || '/assets/avatars/judge_whiskers.png';
    const isUserA = isInitiator;
    const hasAccepted = isUserA ? activeCase.userAAccepted : activeCase.userBAccepted;
    const partnerHasAccepted = isUserA ? activeCase.userBAccepted : activeCase.userAAccepted;
    const partnerName = isUserA ? userBName : userAName;
    const addendumDisabled = addendumRemaining !== null && addendumRemaining <= 0;
    const addendumStatus = addendumLimit !== null && addendumRemaining !== null
        ? t('court.verdict.addendumStatus', { remaining: addendumRemaining, limit: addendumLimit })
        : null;

    return (
        <div className="space-y-4 pb-4">
            {/* Header */}
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="glass-card p-5 text-center bg-gradient-to-br from-court-ivory via-white/95 to-court-tan/30 border border-court-gold/15"
            >
                {/* Courtroom Banner */}
                <div className="bg-gradient-to-r from-court-gold to-court-goldDark text-white text-xs font-bold py-1.5 px-4 rounded-full inline-flex items-center gap-1.5 mb-4">
                    <Gavel className="w-3 h-3" />
                    {t('court.verdict.banner')}
                </div>

                <motion.div
                    animate={{ rotate: [-3, 3, -3] }}
                    transition={{ duration: 2.4, repeat: Infinity }}
                    className="w-28 h-28 rounded-[2rem] mx-auto mb-2 shadow-2xl overflow-hidden border-4 border-court-gold"
                >
                    <img
                        src={avatarSrc}
                        alt={t('court.verdict.judgeAlt', { judgeName: resolvedJudgeName })}
                        className="w-full h-full object-cover"
                    />
                </motion.div>

                <h2 className="text-xl font-bold text-court-brown mb-1">
                    {t('court.verdict.title', { judgeName: resolvedJudgeName })}
                </h2>
                <p className="text-xs text-court-brownLight">{t('court.verdict.subtitle')}</p>

                {/* Verdict Version Selector */}
                {allVerdicts.length > 1 && (
                    <div className="mt-4 flex items-center justify-center gap-2">
                        <span className="text-xs text-court-brownLight">{t('court.verdict.versionLabel')}</span>
                        <div className="flex gap-1">
                            {allVerdicts.map((v, idx) => (
                                <button
                                    key={v.version}
                                    onClick={() => setSelectedVerdictVersion(v.version)}
                                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${(selectedVerdictVersion === 0 && idx === 0) || selectedVerdictVersion === v.version
                                        ? 'bg-court-gold text-white shadow-soft'
                                        : 'bg-white/80 text-court-brown border border-court-tan/40 hover:bg-court-cream'
                                        }`}
                                >
                                    {v.addendumBy ? `+${v.version}` : `#${v.version}`}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Dynamic Badge */}
                {analysis?.identifiedDynamic && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="mt-3 inline-flex items-center gap-1.5 bg-court-gold/20 text-court-goldDark text-xs font-bold px-3 py-1.5 rounded-full"
                    >
                        <Star className="w-3 h-3" />
                        {t('court.verdict.patternDetected', { pattern: analysis.identifiedDynamic })}
                    </motion.div>
                )}
            </motion.div>

            {/* The Summary - Translation */}
            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="glass-card p-4 space-y-3 bg-white/85 border border-court-tan/30"
            >
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-court-gold/20 to-court-tan rounded-xl flex items-center justify-center">
                        <Quote className="w-4 h-4 text-court-gold" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-court-gold">{t('court.verdict.sections.summary.title')}</h3>
                        <p className="text-[10px] text-court-brownLight">{t('court.verdict.sections.summary.subtitle')}</p>
                    </div>
                </div>
                <p className="text-court-brown text-sm leading-relaxed pl-10">
                    {verdict.theSummary || verdict.summary}
                </p>
            </motion.div>

            {/* The Purr - Validation */}
            {verdict.theRuling_ThePurr && (
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="glass-card p-4 space-y-4 bg-gradient-to-br from-green-50/70 to-emerald-50/70 border border-green-100/60"
                >
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-green-100 to-green-50 rounded-xl flex items-center justify-center">
                            <Heart className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-green-700">{t('court.verdict.sections.purr.title')}</h3>
                            <p className="text-[10px] text-green-600/70">{t('court.verdict.sections.purr.subtitle')}</p>
                        </div>
                    </div>

                    <div className="space-y-3 pl-2">
                        <div className="border-l-2 border-green-200 pl-3">
                            <p className="text-xs font-bold text-green-700 mb-1">{userAName}</p>
                            <p className="text-court-brown text-sm leading-relaxed">
                                {verdict.theRuling_ThePurr.userA}
                            </p>
                        </div>

                        <div className="border-l-2 border-green-200 pl-3">
                            <p className="text-xs font-bold text-green-700 mb-1">{userBName}</p>
                            <p className="text-court-brown text-sm leading-relaxed">
                                {verdict.theRuling_ThePurr.userB}
                            </p>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* The Hiss - Accountability */}
            {verdict.theRuling_TheHiss && verdict.theRuling_TheHiss.length > 0 && (
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="glass-card p-4 space-y-3 bg-gradient-to-br from-court-gold/10 to-court-tan/30 border border-court-gold/15"
                >
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-court-gold/30 to-court-tan rounded-xl flex items-center justify-center">
                            <AlertTriangle className="w-5 h-5 text-court-goldDark" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-court-goldDark">{t('court.verdict.sections.hiss.title')}</h3>
                            <p className="text-[10px] text-court-brownLight">{t('court.verdict.sections.hiss.subtitle')}</p>
                        </div>
                    </div>

                    <div className="space-y-2 pl-2">
                        {verdict.theRuling_TheHiss.map((hiss, index) => (
                            <div key={index} className="flex items-start gap-2 text-sm text-court-brown">
                                <AlertTriangle className="w-4 h-4 text-court-gold mt-0.5 flex-shrink-0" />
                                <p className="leading-relaxed">{hiss}</p>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* The Sentence - Repair Attempt */}
            {verdict.theSentence && (
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="glass-card p-4 space-y-3 bg-gradient-to-br from-court-maroon/10 to-court-maroonLight/10 border-2 border-court-maroon/25"
                >
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-court-maroon/20 to-court-maroonLight/20 rounded-xl flex items-center justify-center">
                            <HeartHandshake className="w-4 h-4 text-court-maroon" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-court-maroon">{t('court.verdict.sections.repair.title')}</h3>
                            <p className="text-[10px] text-court-maroonLight">{t('court.verdict.sections.repair.subtitle')}</p>
                        </div>
                    </div>

                    <div className="bg-white/60 rounded-xl p-4 space-y-2">
                        <h4 className="font-bold text-court-brown">
                            {verdict.theSentence.title}
                        </h4>
                        <p className="text-court-brown text-sm leading-relaxed">
                            {verdict.theSentence.description}
                        </p>
                        {verdict.theSentence.rationale && (
                            <p className="text-xs text-court-maroon italic mt-2 pt-2 border-t border-court-maroon/20 flex items-start gap-1.5">
                                <Lightbulb className="w-3.5 h-3.5 text-court-maroon mt-0.5" />
                                <span>{verdict.theSentence.rationale}</span>
                            </p>
                        )}
                    </div>
                </motion.div>
            )}

            {/* Closing Statement */}
            {verdict.closingStatement && (
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-center px-4 py-3"
                >
                    <p className="text-court-brownLight text-sm italic leading-relaxed">
                        "{verdict.closingStatement}"
                    </p>
                    <p className="text-court-tan text-xs mt-2">
                        {t('court.verdict.signature', { judgeName: resolvedJudgeName })}
                    </p>
                </motion.div>
            )}

            {/* Four Horsemen Detected */}
            {analysis && (analysis.userA_Horsemen?.length > 0 || analysis.userB_Horsemen?.length > 0) && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="glass-card p-3 bg-white/80 border border-court-tan/30"
                >
                    <p className="text-xs text-court-brownLight text-center mb-2">{t('court.verdict.horsemenTitle')}</p>
                    <div className="flex flex-wrap justify-center gap-1.5">
                        {[...new Set([...(analysis.userA_Horsemen || []), ...(analysis.userB_Horsemen || [])])].filter(h => h !== 'None').map((horseman, i) => (
                            <span key={i} className={`text-xs px-2 py-1 rounded-full ${horseman === 'Contempt' || horseman === 'Stonewalling'
                                ? 'bg-court-maroon/20 text-court-maroon'
                                : 'bg-court-gold/20 text-court-goldDark'
                                }`}>
                                {HORSEMAN_LABELS[horseman] ? t(HORSEMAN_LABELS[horseman]) : horseman}
                            </span>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Actions */}
            <div className="space-y-3 pt-2">
                {/* Addendum Button */}
                <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowAddendumModal(true)}
                    disabled={addendumDisabled}
                    className={`glass-card w-full p-4 flex items-center justify-between transition-colors border border-court-gold/15 bg-white/85 ${
                        addendumDisabled ? 'opacity-60 cursor-not-allowed' : 'hover:bg-court-cream/80'
                    }`}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-court-gold/20 rounded-xl flex items-center justify-center">
                            <Plus className="w-5 h-5 text-court-gold" />
                        </div>
                        <div className="text-left">
                            <p className="font-bold text-court-brown text-sm">{t('court.verdict.addendumTitle')}</p>
                            <p className="text-xs text-court-brownLight">
                                {addendumDisabled ? t('court.verdict.addendumLimitReached') : t('court.verdict.addendumHint')}
                            </p>
                            {addendumStatus && (
                                <p className="text-[10px] text-court-brownLight mt-1">
                                    {addendumStatus}
                                </p>
                            )}
                        </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-court-brownLight" />
                </motion.button>

                <div>
                    {/* Accept Verdict Button */}
                    {!hasAccepted ? (
                        <motion.button
                            whileTap={{ scale: 0.98 }}
                            onClick={onAcceptVerdict}
                            className="court-btn-primary w-full"
                        >
                            <Check className="w-5 h-5" />
                            {t('court.verdict.accept')}
                        </motion.button>
                    ) : !partnerHasAccepted ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="glass-card p-4 bg-gradient-to-br from-amber-50 to-white text-center border border-amber-100/60"
                        >
                            <motion.div
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                                className="flex items-center justify-center mb-2"
                            >
                                <Clock className="w-5 h-5 text-court-gold" />
                            </motion.div>
                            <p className="text-sm font-medium text-court-brown">{t('court.verdict.accepted')}</p>
                            <p className="text-xs text-court-brownLight">{t('court.verdict.waitingForPartner', { name: partnerName })}</p>
                        </motion.div>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

export default VerdictView;
