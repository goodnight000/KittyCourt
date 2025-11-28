import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import useAppStore from '../store/useAppStore';
import { ChevronLeft, Scale, ChevronDown, ChevronUp, MessageCircle, Heart, Award, Calendar, Scroll } from 'lucide-react';

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
                        const verdict = parseVerdict(caseItem.verdict);
                        const isExpanded = expandedCase === caseItem.id;

                        return (
                            <motion.div
                                key={caseItem.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="glass-card overflow-hidden"
                            >
                                {/* Case Header - Always Visible */}
                                <motion.button
                                    onClick={() => setExpandedCase(isExpanded ? null : caseItem.id)}
                                    className="w-full p-4 flex items-center justify-between text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gradient-to-br from-amber-100 to-amber-50 rounded-xl flex items-center justify-center">
                                            <Award className="w-5 h-5 text-amber-500" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-neutral-800 text-sm">Case #{index + 1}</p>
                                            <div className="flex items-center gap-1 text-xs text-neutral-500">
                                                <Calendar className="w-3 h-3" />
                                                {formatDate(caseItem.createdAt)}
                                            </div>
                                        </div>
                                    </div>
                                    <motion.div
                                        animate={{ rotate: isExpanded ? 180 : 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <ChevronDown className="w-5 h-5 text-neutral-400" />
                                    </motion.div>
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
                                                            <span className="text-xs">👑</span>
                                                        </div>
                                                        <span className="text-xs font-bold text-amber-600">Judge Whiskers ruled:</span>
                                                    </div>
                                                    <div className="bg-gradient-to-br from-amber-50/80 to-white rounded-xl p-3 space-y-3">
                                                        {verdict.summary && (
                                                            <div>
                                                                <p className="text-xs font-bold text-neutral-500 mb-1 flex items-center gap-1">
                                                                    <Scroll className="w-3 h-3" /> Summary
                                                                </p>
                                                                <p className="text-neutral-700 text-sm">{verdict.summary}</p>
                                                            </div>
                                                        )}
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
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default HistoryPage;
