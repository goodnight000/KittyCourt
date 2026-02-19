import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, History, Gavel, ChevronRight, Heart, Star } from 'lucide-react';
import JudgeSelection from './JudgeSelection';
import { useI18n } from '../../i18n';
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion';

/**
 * CourtAtRest - Premium Court Idle Experience V2
 * One-pager design with multi-color accents and compact layout
 */
const FALLBACK_PHRASES = [
    'Zzz... dreaming of justice...',
    '*purrs softly*',
    'No disputes? Purrfect...'
];

const CourtAtRest = ({ onServe, navigate }) => {
    const [catPhase, setCatPhase] = useState(0);
    const [showJudgeSelection, setShowJudgeSelection] = useState(false);
    const [displayText, setDisplayText] = useState('');
    const { t } = useI18n();
    const prefersReducedMotion = usePrefersReducedMotion();

    const localizedPhrases = t('court.atRest.sleepingPhrases');
    const sleepingPhrases = Array.isArray(localizedPhrases) && localizedPhrases.length
        ? localizedPhrases
        : FALLBACK_PHRASES;

    // Cycle through phrases
    useEffect(() => {
        const interval = setInterval(() => {
            setCatPhase(prev => (prev + 1) % 3);
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    // Typewriter effect
    useEffect(() => {
        const phrase = sleepingPhrases[catPhase];
        setDisplayText('');
        let i = 0;
        const typeInterval = setInterval(() => {
            if (i < phrase.length) {
                setDisplayText(phrase.slice(0, i + 1));
                i++;
            } else {
                clearInterval(typeInterval);
            }
        }, 40);
        return () => clearInterval(typeInterval);
    }, [catPhase]);

    const handleServeWithJudge = (judgeType) => {
        setShowJudgeSelection(false);
        onServe(judgeType);
    };

    // Floating element configs - positioned relative to the scene container
    const floatingElements = [
        // Gold stars (brand primary)
        { Icon: Star, color: 'text-court-gold', size: 'w-3.5 h-3.5', left: '5%', top: '10%', delay: 0 },
        { Icon: Star, color: 'text-court-gold', size: 'w-3 h-3', left: '88%', top: '15%', delay: 1.2 },
        { Icon: Star, color: 'text-court-goldLight', size: 'w-4 h-4', left: '85%', top: '45%', delay: 0.5 },
        // Lavender stars (dreamy, complements gold)
        { Icon: Star, color: 'text-lavender-300', size: 'w-3.5 h-3.5', left: '8%', top: '35%', delay: 0.8 },
        { Icon: Star, color: 'text-lavender-400', size: 'w-3 h-3', left: '90%', top: '60%', delay: 1.5 },
        // Blush hearts (love theme)
        { Icon: Heart, color: 'text-blush-300', size: 'w-3 h-3', left: '6%', top: '55%', delay: 2.0 },
        { Icon: Heart, color: 'text-blush-400', size: 'w-3.5 h-3.5', left: '92%', top: '30%', delay: 0.3 },
        // Moon (sleepy vibe)
        { Icon: Moon, color: 'text-lavender-300', size: 'w-4 h-4', left: '88%', top: '5%', delay: 1.8 },
    ];

    return (
        <div className="relative min-h-[calc(100dvh-100px)] flex flex-col items-center justify-start px-4 pt-20 pb-32 overflow-hidden">
            {/* Judge Selection Modal */}
            <JudgeSelection
                isOpen={showJudgeSelection}
                onClose={() => setShowJudgeSelection(false)}
                onServe={handleServeWithJudge}
            />

            {/* Floating Decorative Elements - Inside this container */}
            {floatingElements.map((el, i) => (
                <motion.span
                    key={i}
                    animate={{
                        y: [0, -12, 0],
                        opacity: [0.4, 0.8, 0.4],
                        scale: [0.9, 1.1, 0.9],
                    }}
                    transition={{
                        duration: 3 + Math.random() * 2,
                        delay: el.delay,
                        repeat: prefersReducedMotion ? 0 : Infinity,
                        ease: "easeInOut",
                    }}
                    className={`absolute ${el.color} drop-shadow-sm pointer-events-none`}
                    style={{ left: el.left, top: el.top }}
                >
                    <el.Icon className={el.size} />
                </motion.span>
            ))}

            {/* Main Scene - Compact */}
            <div className="relative z-10 flex flex-col items-center w-full max-w-sm">
                {/* Sleeping Judge */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative"
                >
                    {/* Avatar with gentle breathing */}
                    <motion.div
                        animate={prefersReducedMotion ? undefined : {
                            y: [0, -4, 0],
                            rotate: [-1, 1, -1]
                        }}
                        transition={prefersReducedMotion ? undefined : {
                            duration: 4,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                        className="relative"
                    >
                        {/* Outer glow - multi-color */}
                        <motion.div
                            animate={prefersReducedMotion ? undefined : {
                                scale: [1, 1.05, 1],
                                opacity: [0.3, 0.5, 0.3]
                            }}
                            transition={prefersReducedMotion ? undefined : { duration: 3, repeat: Infinity }}
                            className="absolute -inset-3 bg-gradient-to-br from-court-gold/20 via-lavender-200/15 to-blush-200/20 rounded-full blur-xl"
                        />

                        {/* Avatar - slightly smaller */}
                        <div className="relative w-36 h-36 rounded-full mx-auto overflow-hidden shadow-xl border-4 border-white/50">
                            <img
                                src="/assets/avatars/sleeping_judge_whiskers.png"
                                alt={t('court.atRest.avatarAlt')}
                                className="w-full h-full object-cover"
                            />
                        </div>

                        {/* Floating Zzz */}
                        <div className="absolute right-0 top-1">
                            {['z', 'Z', 'Z'].map((letter, i) => (
                                <motion.span
                                    key={i}
                                    animate={prefersReducedMotion ? undefined : {
                                        opacity: [0, 1, 0],
                                        x: [0, 8 + i * 3, 16 + i * 5],
                                        y: [0, -10 - i * 5, -24 - i * 8]
                                    }}
                                    transition={prefersReducedMotion ? undefined : {
                                        duration: 2.5,
                                        delay: i * 0.5,
                                        repeat: Infinity,
                                        ease: "easeOut"
                                    }}
                                    className="absolute text-court-gold font-bold drop-shadow-sm"
                                    style={{ fontSize: `${10 + i * 4}px` }}
                                >
                                    {letter}
                                </motion.span>
                            ))}
                        </div>
                    </motion.div>
                </motion.div>

                {/* Speech Bubble - tighter spacing */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={catPhase}
                        initial={{ opacity: 0, y: 6, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.95 }}
                        className="mt-9 backdrop-blur-sm bg-white/60 px-4 py-2 rounded-2xl shadow-md border border-white/40"
                    >
                        <p className="text-court-brownLight text-sm italic min-h-[1.25rem]">
                            {displayText}
                            <motion.span
                                animate={prefersReducedMotion ? undefined : { opacity: [1, 0] }}
                                transition={prefersReducedMotion ? undefined : { duration: 0.5, repeat: Infinity }}
                                className="ml-0.5 text-court-gold"
                            >
                                |
                            </motion.span>
                        </p>
                    </motion.div>
                </AnimatePresence>

                {/* Status Badge - tighter spacing */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="mt-16 text-center"
                >
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full
                        bg-gradient-to-r from-court-gold/10 via-lavender-100/30 to-blush-100/20
                        border border-court-gold/20 shadow-sm"
                    >
                        <motion.div
                            animate={prefersReducedMotion ? undefined : { rotate: 360 }}
                            transition={prefersReducedMotion ? undefined : { duration: 20, repeat: Infinity, ease: "linear" }}
                        >
                            <Moon className="w-3.5 h-3.5 text-lavender-400" />
                        </motion.div>
                        <span className="text-sm font-semibold text-court-brown">{t('court.atRest.statusTitle')}</span>
                    </div>
                    <p className="text-xs text-court-brownLight mt-1 max-w-[200px] mx-auto">
                        {t('court.atRest.statusSubtitle')}
                    </p>
                </motion.div>

                {/* Action Buttons - Premium stack */}
                <div className="w-full mt-16">
                    <div className="space-y-3">
                        {/* Primary CTA - New Case */}
                        <motion.button
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setShowJudgeSelection(true)}
                            className="group relative w-full overflow-hidden rounded-[28px] border border-amber-200/70 bg-white/85 px-4 py-4 text-left shadow-soft-lg"
                        >
                            <span className="absolute inset-x-6 top-0 h-0.5 bg-gradient-to-r from-transparent via-amber-200/80 to-transparent" />
                            <span className="absolute -top-8 -right-6 h-16 w-16 rounded-full bg-amber-200/35 blur-2xl" />
                            <div className="relative flex items-center gap-3">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-200/70 bg-amber-100/80">
                                    <Gavel className="w-5 h-5 text-amber-700" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-500">
                                        {t('court.atRest.cta.kicker')}
                                    </div>
                                    <div className="text-base font-bold text-court-brown">{t('court.atRest.cta.title')}</div>
                                    <div className="text-xs text-court-brownLight">{t('court.atRest.cta.subtitle')}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="rounded-full border border-amber-200/70 bg-amber-100/70 px-3 py-1 text-xs font-bold text-amber-700">
                                        {t('court.atRest.cta.action')}
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-amber-600" />
                                </div>
                            </div>
                        </motion.button>

                        {/* Secondary - Past Cases */}
                        <motion.button
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => navigate('/history')}
                            className="w-full rounded-[24px] border border-white/80 bg-white/75 px-4 py-3 text-left shadow-soft"
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-rose-200/70 bg-rose-100/70">
                                        <History className="w-4 h-4 text-rose-600" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-semibold text-court-brown">{t('court.atRest.history.title')}</div>
                                        <div className="text-xs text-court-brownLight">{t('court.atRest.history.subtitle')}</div>
                                    </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-neutral-500" />
                            </div>
                        </motion.button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CourtAtRest;
