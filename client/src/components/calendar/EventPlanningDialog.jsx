import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { X, Wand2, Loader2, AlertTriangle, Check, ChevronDown, BookOpen, Clock, Send, StickyNote, Heart, Gift, Lightbulb, Star } from 'lucide-react';
import { useI18n } from '../../i18n';
import { parseLocalDate } from '../../utils/dateFormatters';
import api from '../../services/api';
import useUiStore from '../../store/useUiStore';
import EmojiIcon from '../shared/EmojiIcon';
import ButtonLoader from '../shared/ButtonLoader';
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion';

const STYLE_OPTIONS = [
    { id: 'cozy', labelKey: 'calendar.planning.styles.cozy', descKey: 'calendar.planning.styles.cozyDesc', emoji: '🕯️' },
    { id: 'playful', labelKey: 'calendar.planning.styles.playful', descKey: 'calendar.planning.styles.playfulDesc', emoji: '🎈' },
    { id: 'fancy', labelKey: 'calendar.planning.styles.fancy', descKey: 'calendar.planning.styles.fancyDesc', emoji: '🥂' },
    { id: 'low_key', labelKey: 'calendar.planning.styles.lowKey', descKey: 'calendar.planning.styles.lowKeyDesc', emoji: '🏡' },
];

const LOADING_STEPS = [
    { key: 'memory', Icon: BookOpen, color: 'tan' },
    { key: 'timeline', Icon: Clock, color: 'gold' },
    { key: 'touches', Icon: Heart, color: 'cream' },
];

/**
 * CollapsibleSection Component
 * Collapsible wrapper for plan sections
 */
const CollapsibleSection = ({ title, icon: Icon, isOpen, onToggle, children }) => (
    <div className="rounded-3xl bg-white/70 border border-court-tan/30 shadow-soft overflow-hidden">
        <button onClick={onToggle} className="w-full p-5 flex items-center justify-between hover:bg-court-cream/30 transition-colors">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-court-cream/60 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-court-brownLight" />
                </div>
                <span className="text-sm font-bold text-court-brown">{title}</span>
            </div>
            <Motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown className="w-4 h-4 text-court-brownLight" />
            </Motion.div>
        </button>
        <AnimatePresence initial={false}>
            {isOpen && (
                <Motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden"
                >
                    <div className="px-5 pb-5">{children}</div>
                </Motion.div>
            )}
        </AnimatePresence>
    </div>
);

/**
 * PlanLoadingScreen Component
 * Stepped loading with personality messages
 */
const PlanLoadingScreen = ({ stepIndex, t }) => {
    const prefersReducedMotion = usePrefersReducedMotion();
    const step = LOADING_STEPS[stepIndex] || LOADING_STEPS[0];
    const colorClasses = {
        gold: { bg: 'from-court-gold/20 to-court-cream', text: 'text-court-gold' },
        tan: { bg: 'from-court-tan/40 to-court-cream', text: 'text-court-brown' },
        cream: { bg: 'from-court-cream to-white', text: 'text-court-brownLight' },
    };
    const colors = colorClasses[step.color] || colorClasses.gold;

    return (
        <div className="flex flex-col items-center justify-center py-12 space-y-6">
            <AnimatePresence mode="wait">
                <Motion.div
                    key={stepIndex}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col items-center"
                >
                    <Motion.div
                        animate={prefersReducedMotion ? undefined : { y: [0, -6, 0] }}
                        transition={prefersReducedMotion ? undefined : { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                        className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${colors.bg} flex items-center justify-center shadow-soft border border-white/60`}
                    >
                        <step.Icon className={`w-8 h-8 ${colors.text}`} />
                    </Motion.div>
                    <p className="text-sm font-bold text-court-brown mt-4">
                        {t(`calendar.planning.loading.${step.key}`)}
                    </p>
                </Motion.div>
            </AnimatePresence>

            <div className="flex gap-2">
                {LOADING_STEPS.map((_, i) => (
                    <Motion.div
                        key={i}
                        animate={{ scale: i === stepIndex ? 1.2 : 1, opacity: i === stepIndex ? 1 : 0.4 }}
                        transition={{ duration: 0.2 }}
                        className="w-2 h-2 rounded-full bg-court-gold"
                    />
                ))}
            </div>
        </div>
    );
};

/**
 * EventPlanningDialog Component
 * AI-powered event planning modal with RAG-enhanced suggestions
 */
const EventPlanningDialog = ({ event, eventKey, myId, partnerId, partnerDisplayName, myDisplayName, onClose, onSaved }) => {
    const { t, language } = useI18n();
    const dateStr = event?.date;
    const eventDate = parseLocalDate(dateStr) || new Date();
    const hideDock = useUiStore((state) => state.hideDock);
    const showDock = useUiStore((state) => state.showDock);

    const [style, setStyle] = useState('cozy');
    const [plan, setPlan] = useState(null);
    const [meta, setMeta] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isHydrating, setIsHydrating] = useState(true); // Track initial hydration state
    const [error, setError] = useState(null);
    const requestSeqRef = useRef(0);
    const checklistSaveTimerRef = useRef(null);
    const notesSaveTimerRef = useRef(null);
    const [plansByStyle, setPlansByStyle] = useState(() => ({}));
    const [planIdsByStyle, setPlanIdsByStyle] = useState(() => ({}));
    const [checklistsByStyle, setChecklistsByStyle] = useState(() => ({}));

    // New states for improvements
    const [loadingStepIndex, setLoadingStepIndex] = useState(0);
    const [showSaveToast, setShowSaveToast] = useState(false);
    const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
    const [openSections, setOpenSections] = useState({
        littleTouches: false,
        giftIdeas: false,
        alternatives: false,
    });
    const [notes, setNotes] = useState('');
    const [notesByStyle, setNotesByStyle] = useState(() => ({}));
    const [isSharing, setIsSharing] = useState(false);
    const [shareSuccess, setShareSuccess] = useState(false);
    const checked = checklistsByStyle[style] || {};

    useEffect(() => {
        hideDock();
        return () => showDock();
    }, [hideDock, showDock]);

    // Loading step cycle animation
    useEffect(() => {
        if (!isLoading) {
            setLoadingStepIndex(0);
            return;
        }
        const timer = setInterval(() => {
            setLoadingStepIndex((prev) => (prev + 1) % LOADING_STEPS.length);
        }, 2500);
        return () => clearInterval(timer);
    }, [isLoading]);

    // Hydrate any previously-saved plans for this event (all styles).
    useEffect(() => {
        if (!eventKey) {
            setIsHydrating(false);
            return;
        }

        let cancelled = false;
        (async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await api.get('/calendar/event-plans', { params: { eventKey } });
                const rows = response.data?.plans || [];

                if (cancelled) return;

                const nextPlans = {};
                const nextPlanIds = {};
                const nextChecklists = {};
                const nextNotes = {};

                for (const row of rows) {
                    if (!row?.style || !row?.plan) continue;
                    nextPlans[row.style] = row.plan;
                    nextPlanIds[row.style] = row.id;
                    nextChecklists[row.style] = row.checklistState || {};
                    nextNotes[row.style] = row.notes || '';
                }

                setPlansByStyle(nextPlans);
                setPlanIdsByStyle(nextPlanIds);
                setChecklistsByStyle(nextChecklists);
                setNotesByStyle(nextNotes);

                const initialStyle = nextPlans.cozy ? 'cozy' : Object.keys(nextPlans)[0] || 'cozy';
                const initialPlan = nextPlans[initialStyle] || null;
                setStyle(initialStyle);
                setPlan(initialPlan);
                setNotes(nextNotes[initialStyle] || '');
            } catch {
                // Intentionally ignored: hydration failure is handled by generating new plan
                if (cancelled) return;
                setPlansByStyle({});
                setPlanIdsByStyle({});
                setChecklistsByStyle({});
                setNotesByStyle({});
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                    setIsHydrating(false); // Mark hydration as complete
                }
            }
        })();

        return () => { cancelled = true; };
    }, [eventKey]);

    const generatePlan = useCallback(async () => {
        const requestSeq = ++requestSeqRef.current;
        if (!partnerId) {
            setError(t('calendar.planning.errors.partnerRequired'));
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await api.post('/calendar/plan-event', {
                eventKey,
                event: {
                    title: event.title,
                    type: event.type,
                    date: event.date,
                    emoji: event.emoji,
                    isSecret: !!event.isSecret,
                    notes: event.notes || '',
                },
                partnerId,
                partnerDisplayName,
                currentUserName: myDisplayName,
                style,
            });

            if (requestSeq !== requestSeqRef.current) return;

            const nextPlan = response.data.plan || null;
            const nextMeta = response.data.meta || null;
            const planId = nextMeta?.planId || null;

            setPlan(nextPlan);
            setMeta(nextMeta);
            setPlansByStyle((prev) => ({ ...prev, [style]: nextPlan }));
            setPlanIdsByStyle((prev) => ({ ...prev, [style]: planId }));
            setChecklistsByStyle((prev) => ({ ...prev, [style]: {} }));

            onSaved?.();
        } catch (err) {
            console.error('Failed to generate plan:', err);
            if (requestSeq !== requestSeqRef.current) return;
            setError(err?.response?.data?.error || err?.message || t('calendar.planning.errors.generateFailed'));
            // Preserve the last successful plan; show error without wiping content.
        } finally {
            if (requestSeq === requestSeqRef.current) setIsLoading(false);
        }
    }, [
        eventKey,
        partnerId,
        myId,
        partnerDisplayName,
        myDisplayName,
        style,
        event.title,
        event.type,
        event.date,
        event.emoji,
        event.notes,
        event.isSecret,
        onSaved,
        t,
    ]);

    useEffect(() => {
        // Wait for initial hydration to complete before deciding to generate
        if (isHydrating) return;

        // If we already have a cached plan for this style, just show it.
        const cached = plansByStyle[style];
        if (cached) {
            setPlan(cached);
            setError(null);
            setNotes(notesByStyle[style] || '');
            return;
        }

        // Otherwise, generate and persist.
        generatePlan();
    }, [isHydrating, style, plansByStyle, generatePlan, checklistsByStyle, notesByStyle]);

    // Cleanup debounced save timers on unmount
    useEffect(() => {
        return () => {
            if (checklistSaveTimerRef.current) {
                clearTimeout(checklistSaveTimerRef.current);
            }
            if (notesSaveTimerRef.current) {
                clearTimeout(notesSaveTimerRef.current);
            }
        };
    }, []);

    // Handle regenerate button click (with confirmation if plan exists)
    const handleRegenerateClick = useCallback(() => {
        if (plan) {
            setShowRegenerateConfirm(true);
        } else {
            generatePlan();
        }
    }, [plan, generatePlan]);

    // Handle notes change with debounced save
    const handleNotesChange = useCallback((value) => {
        setNotes(value);
        setNotesByStyle((prev) => ({ ...prev, [style]: value }));

        const planId = planIdsByStyle[style];
        if (!planId) return;

        if (notesSaveTimerRef.current) clearTimeout(notesSaveTimerRef.current);
        notesSaveTimerRef.current = setTimeout(async () => {
            try {
                await api.patch(`/calendar/event-plans/${planId}`, { notes: value });
                setShowSaveToast(true);
                setTimeout(() => setShowSaveToast(false), 1500);
            } catch {
                // Intentionally ignored: notes auto-save is best-effort
            }
        }, 800);
    }, [style, planIdsByStyle]);

    // Handle share with partner
    const handleShare = useCallback(async () => {
        const planId = planIdsByStyle[style];
        if (!planId || !partnerId) return;

        setIsSharing(true);
        try {
            await api.post(`/calendar/event-plans/${planId}/share`);
            setShareSuccess(true);
            setTimeout(() => setShareSuccess(false), 2500);
        } catch {
            // Intentionally ignored: share failure is handled by UI state
        } finally {
            setIsSharing(false);
        }
    }, [style, planIdsByStyle, partnerId]);

    const toggleChecklistItem = (key) => {
        const next = { ...checked, [key]: !checked[key] };
        setChecklistsByStyle((current) => ({ ...current, [style]: next }));

        const planId = planIdsByStyle[style];
        if (!planId) return;

        if (checklistSaveTimerRef.current) clearTimeout(checklistSaveTimerRef.current);
        checklistSaveTimerRef.current = setTimeout(async () => {
            try {
                await api.patch(`/calendar/event-plans/${planId}`, { checklistState: next });
                setShowSaveToast(true);
                setTimeout(() => setShowSaveToast(false), 1500);
            } catch {
                // Intentionally ignored: checklist auto-save is best-effort
            }
        }, 500);
    };

    return (
        <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/35 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            onClick={onClose}
        >
            <Motion.div
                initial={{ y: 120, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 120, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md max-h-[90dvh] overflow-hidden rounded-3xl bg-white/85 backdrop-blur-xl border border-court-tan/30 shadow-2xl flex flex-col relative"
            >
                {/* Decorative background */}
                <div className="absolute -top-16 -right-12 w-40 h-40 rounded-full bg-court-gold/10 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-20 -left-16 w-48 h-48 rounded-full bg-court-tan/15 blur-3xl pointer-events-none" />
                {/* Header */}
                <div className="p-6 pb-5 border-b border-court-tan/30 relative z-10">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-12 h-12 rounded-3xl bg-gradient-to-br from-court-cream to-court-tan flex items-center justify-center shadow-soft border border-court-tan/30 shrink-0">
                                {event.emoji
                                    ? <EmojiIcon emoji={event.emoji} className="w-6 h-6 text-court-gold" />
                                    : <Star className="w-6 h-6 text-court-gold" />}
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <Wand2 className="w-4 h-4 text-court-gold" />
                                    <h3 className="font-extrabold text-court-brown text-lg truncate">
                                        {t('calendar.planning.title', { title: event.title })}
                                    </h3>
                                </div>
                                <p className="text-xs text-court-brownLight mt-0.5 truncate">
                                    {t('calendar.planning.subtitle', {
                                        date: eventDate.toLocaleDateString(language, { weekday: 'short', month: 'short', day: 'numeric' }),
                                        name: partnerDisplayName || t('common.partner')
                                    })}
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="w-10 h-10 bg-white/80 border border-court-tan/30 rounded-full flex items-center justify-center shadow-soft hover:bg-court-cream/50 transition-colors shrink-0">
                            <X className="w-4 h-4 text-court-brownLight" />
                        </button>
                    </div>

                    {/* Style Toggle */}
                    <div className="mt-4">
                        <div className="flex gap-3 overflow-x-auto pb-1">
                            {STYLE_OPTIONS.map((opt) => {
                                const active = style === opt.id;
                                return (
                                    <button
                                        key={opt.id}
                                        onClick={() => setStyle(opt.id)}
                                        className={`shrink-0 px-4 py-2.5 rounded-full text-xs font-bold border transition-all ${active
                                            ? 'bg-court-cream text-court-brown border-court-gold/40 shadow-soft'
                                            : 'bg-white/60 text-court-brownLight border-court-tan/30 hover:bg-white/80'
                                            }`}
                                    >
                                        <EmojiIcon emoji={opt.emoji} className="w-4 h-4 text-court-gold" />
                                        {t(opt.labelKey)}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 pt-5 overflow-y-auto space-y-6 relative z-10">
                    {/* Auto-save toast */}
                    <AnimatePresence>
                        {showSaveToast && (
                            <Motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="absolute top-4 right-4 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-soft z-10"
                            >
                                <Check className="w-3 h-3" />
                                {t('calendar.planning.toast.saved')}
                            </Motion.div>
                        )}
                    </AnimatePresence>

                    {error && !plan ? (
                        <div className="rounded-3xl p-4 bg-red-50 border border-red-100">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center">
                                    <AlertTriangle className="w-5 h-5 text-red-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-bold text-red-700 text-sm">{t('calendar.planning.errors.generateFailedTitle')}</p>
                                    <p className="text-red-600 text-xs mt-1">{error}</p>
                                    <button
                                        onClick={generatePlan}
                                        disabled={isLoading}
                                        className="mt-3 px-4 py-2 rounded-full bg-white text-red-700 border border-red-200 text-xs font-bold disabled:opacity-60"
                                    >
                                        {isLoading ? (
                                            <ButtonLoader size="sm" tone="rose" />
                                        ) : (
                                            t('common.tryAgain')
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : plan ? (
                        <>
                            {error && (
                                <div className="rounded-3xl p-3 bg-amber-50 border border-amber-100">
                                    <p className="text-[11px] font-bold text-amber-800">
                                        {t('calendar.planning.errors.showingCached')}
                                    </p>
                                    <p className="text-[11px] text-amber-700 mt-1">{error}</p>
                                </div>
                            )}

                            {/* AI-generated content from trusted backend API - not user input, no XSS risk */}
                            <div className="rounded-3xl p-5 bg-gradient-to-br from-court-cream/80 via-white/90 to-court-tan/50 border border-court-gold/20 shadow-soft relative overflow-hidden">
                                <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-court-gold/30 to-transparent" />
                                <p className="text-base font-bold text-court-brown leading-relaxed">{plan.oneLiner}</p>
                                <p className="text-sm text-court-brownLight mt-2">{plan.vibe}</p>
                            </div>

                            {Array.isArray(plan.memoryHighlights) && plan.memoryHighlights.length > 0 && (
                                <div className="flex gap-2 overflow-x-auto pb-1">
                                    {plan.memoryHighlights.slice(0, 8).map((h, idx) => (
                                        <div
                                            key={idx}
                                            className="shrink-0 px-3 py-2 rounded-full bg-court-cream/60 border border-court-tan/30 shadow-soft text-xs text-court-brown font-medium flex items-center gap-2"
                                            title={h.source}
                                        >
                                            <EmojiIcon emoji={h.emoji} className="w-4 h-4 text-court-gold" />
                                            <span className="whitespace-nowrap">{h.text}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="rounded-3xl p-5 bg-white/80 border border-court-tan/25 shadow-soft relative overflow-hidden">
                                <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-court-gold/30 to-transparent" />
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <h4 className="font-extrabold text-court-brown text-base">{plan.mainPlan.title}</h4>
                                        <p className="text-sm text-court-brown mt-1">{plan.mainPlan.whyItFits}</p>
                                    </div>
                                    <div className="shrink-0 px-2.5 py-1 rounded-full bg-court-gold/20 text-court-gold text-[10px] font-extrabold">
                                        {String(plan.mainPlan.budgetTier || '').toUpperCase()}
                                    </div>
                                </div>
                                <p className="text-xs text-court-brownLight mt-2">{plan.mainPlan.budgetNote}</p>

                                <div className="mt-4 space-y-3">
                                    {plan.mainPlan.timeline.map((step, idx) => (
                                        <div key={idx} className="flex gap-3">
                                            <div className="w-20 shrink-0 text-xs font-bold text-court-brownLight">
                                                {step.time}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-court-brown">{step.title}</p>
                                                <p className="text-xs text-court-brownLight mt-1">{step.details}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-3xl p-5 bg-white/80 border border-court-tan/25 shadow-soft">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-extrabold text-court-brown">{t('calendar.planning.sections.prepChecklist')}</p>
                                    <span className="text-[11px] text-court-brownLight">{Object.values(checked).filter(Boolean).length}/{plan.mainPlan.prepChecklist.length}</span>
                                </div>
                                <div className="mt-3 space-y-2">
                                    {plan.mainPlan.prepChecklist.map((item, idx) => {
                                        const key = `${idx}-${item.item}`;
                                        const isChecked = !!checked[key];
                                        return (
                                            <button
                                                key={key}
                                                onClick={() => toggleChecklistItem(key)}
                                                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-court-cream/40 border border-court-tan/20 text-left hover:bg-court-cream/60 transition-colors"
                                            >
                                                <span className={`w-6 h-6 rounded-full flex items-center justify-center border ${isChecked
                                                    ? 'bg-court-gold border-court-gold'
                                                    : 'bg-white border-court-tan/40'
                                                    }`}
                                                >
                                                    <Check className={`w-4 h-4 ${isChecked ? 'text-white' : 'text-transparent'}`} />
                                                </span>
                                                <span className="text-sm font-semibold text-court-brown">{item.item}</span>
                                                {item.optional && (
                                                    <span className="ml-auto text-[10px] font-bold text-court-brownLight">{t('calendar.planning.optional')}</span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Collapsible: Little Touches */}
                            <CollapsibleSection
                                title={t('calendar.planning.sections.littleTouches')}
                                icon={Heart}
                                isOpen={openSections.littleTouches}
                                onToggle={() => setOpenSections((s) => ({ ...s, littleTouches: !s.littleTouches }))}
                            >
                                <div className="space-y-3">
                                    {plan.littleTouches.slice(0, 4).map((touch, idx) => (
                                        <div key={idx} className="flex gap-3">
                                            <EmojiIcon emoji={touch.emoji} className="w-5 h-5 text-court-gold" />
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold text-court-brown">{touch.title}</p>
                                                <p className="text-[11px] text-court-brownLight mt-0.5">{touch.details}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CollapsibleSection>

                            {/* Collapsible: Gift Ideas */}
                            <CollapsibleSection
                                title={t('calendar.planning.sections.giftIdeas')}
                                icon={Gift}
                                isOpen={openSections.giftIdeas}
                                onToggle={() => setOpenSections((s) => ({ ...s, giftIdeas: !s.giftIdeas }))}
                            >
                                <div className="space-y-3">
                                    {plan.giftIdeas.slice(0, 4).map((gift, idx) => (
                                        <div key={idx} className="flex gap-3">
                                            <EmojiIcon emoji={gift.emoji} className="w-5 h-5 text-court-gold" />
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold text-court-brown">{gift.title}</p>
                                                <p className="text-[11px] text-court-brownLight mt-0.5">{gift.details}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CollapsibleSection>

                            {/* Collapsible: Alternatives */}
                            <CollapsibleSection
                                title={t('calendar.planning.sections.alternatives')}
                                icon={Lightbulb}
                                isOpen={openSections.alternatives}
                                onToggle={() => setOpenSections((s) => ({ ...s, alternatives: !s.alternatives }))}
                            >
                                <div className="flex gap-3 overflow-x-auto pb-1">
                                    {plan.alternatives.map((alt, idx) => (
                                        <div key={idx} className="shrink-0 w-60 rounded-3xl bg-gradient-to-br from-court-cream/70 via-white/80 to-court-tan/40 border border-court-tan/30 p-4 shadow-soft">
                                            <div className="flex items-center gap-2">
                                                <EmojiIcon emoji={alt.emoji} className="w-5 h-5 text-court-gold" />
                                                <p className="text-sm font-extrabold text-court-brown truncate">{alt.title}</p>
                                            </div>
                                            <p className="text-xs text-court-brown mt-2">{alt.oneLiner}</p>
                                        </div>
                                    ))}
                                </div>
                            </CollapsibleSection>

                            {/* Backup Plan (already uses details/summary) */}
                            <details className="rounded-3xl p-5 bg-white/80 border border-court-tan/25 shadow-soft">
                                <summary className="text-sm font-extrabold text-court-brown cursor-pointer select-none">
                                    {t('calendar.planning.sections.backupPlan')}
                                </summary>
                                <div className="mt-3 space-y-2">
                                    {plan.backupPlan.steps.map((s, idx) => (
                                        <div key={idx} className="rounded-2xl bg-court-cream/40 border border-court-tan/20 p-3">
                                            <p className="text-xs font-extrabold text-court-brown">{s.title}</p>
                                            <p className="text-[11px] text-court-brownLight mt-1">{s.details}</p>
                                        </div>
                                    ))}
                                </div>
                            </details>

                            {/* Notes section */}
                            <div className="rounded-3xl p-5 bg-white/80 border border-court-tan/25 shadow-soft">
                                <div className="flex items-center gap-2 mb-3">
                                    <StickyNote className="w-4 h-4 text-court-brownLight" />
                                    <span className="text-sm font-extrabold text-court-brown">{t('calendar.planning.notes.title')}</span>
                                </div>
                                <textarea
                                    value={notes}
                                    onChange={(e) => handleNotesChange(e.target.value)}
                                    placeholder={t('calendar.planning.notes.placeholder')}
                                    className="w-full h-24 bg-court-cream/30 rounded-2xl p-4 text-sm text-court-brown border border-court-tan/30 resize-none focus:outline-none focus:ring-2 focus:ring-court-gold/40 focus:border-court-gold placeholder:text-court-brownLight/60"
                                    maxLength={500}
                                />
                                <p className="text-[11px] text-court-brownLight text-right mt-1">{notes.length}/500</p>
                            </div>
                        </>
                    ) : isLoading ? (
                        <PlanLoadingScreen stepIndex={loadingStepIndex} t={t} />
                    ) : null}
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-court-tan/30 bg-white/80 backdrop-blur-xl space-y-4 relative z-10">
                    <div className="flex gap-3">
                        {/* Share button (only when plan exists and partner connected) */}
                        {partnerId && plan && (
                            <button
                                onClick={handleShare}
                                disabled={isSharing || shareSuccess}
                                className="shrink-0 px-4 py-3.5 bg-white/80 hover:bg-court-cream/60 rounded-2xl text-court-brown font-bold text-sm flex items-center justify-center gap-2 border border-court-tan/40 shadow-soft transition-colors disabled:opacity-50"
                            >
                                {shareSuccess ? (
                                    <>
                                        <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                                        <span className="truncate max-w-[100px]">{t('calendar.planning.share.success')}</span>
                                    </>
                                ) : isSharing ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <>
                                        <Send className="w-4 h-4 shrink-0" />
                                        <span className="truncate max-w-[100px]">{t('calendar.planning.share.button', { name: partnerDisplayName })}</span>
                                    </>
                                )}
                            </button>
                        )}

                        {/* Regenerate button */}
                        <button
                            onClick={handleRegenerateClick}
                            disabled={isLoading}
                            className="flex-1 min-w-0 btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Wand2 className="w-4 h-4" />
                            )}
                            {t('calendar.planning.regenerate.button')}
                        </button>
                    </div>

                    {meta?.rag?.memoriesUsed !== undefined && (
                        <p className="text-[11px] text-court-brownLight text-center">
                            {meta.rag.memoriesUsed === 1
                                ? t('calendar.planning.memoriesOne')
                                : t('calendar.planning.memoriesOther', { count: meta.rag.memoriesUsed })}
                        </p>
                    )}
                </div>

                {/* Regenerate Confirmation Modal */}
                <AnimatePresence>
                    {showRegenerateConfirm && (
                        <Motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/30 backdrop-blur-sm z-20 flex items-center justify-center p-4 rounded-3xl"
                            onClick={() => setShowRegenerateConfirm(false)}
                        >
                            <Motion.div
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.95, opacity: 0 }}
                                onClick={(e) => e.stopPropagation()}
                                className="glass-card p-5 max-w-xs text-center"
                            >
                                <div className="w-12 h-12 mx-auto rounded-full bg-amber-100 flex items-center justify-center">
                                    <AlertTriangle className="w-6 h-6 text-amber-500" />
                                </div>
                                <h3 className="font-bold text-court-brown mt-3">{t('calendar.planning.regenerate.title')}</h3>
                                <p className="text-sm text-court-brownLight mt-2">{t('calendar.planning.regenerate.warning')}</p>
                                <div className="flex gap-3 mt-4">
                                    <button
                                        onClick={() => setShowRegenerateConfirm(false)}
                                        className="flex-1 py-2.5 bg-court-cream/60 rounded-xl text-court-brown font-bold text-sm"
                                    >
                                        {t('common.cancel')}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowRegenerateConfirm(false);
                                            generatePlan();
                                        }}
                                        className="flex-1 py-2.5 bg-amber-500 rounded-xl text-white font-bold text-sm"
                                    >
                                        {t('calendar.planning.regenerate.confirm')}
                                    </button>
                                </div>
                            </Motion.div>
                        </Motion.div>
                    )}
                </AnimatePresence>
            </Motion.div>
        </Motion.div>
    );
};

export default EventPlanningDialog;
