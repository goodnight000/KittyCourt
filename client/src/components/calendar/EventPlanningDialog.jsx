import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion as Motion } from 'framer-motion';
import { X, Wand2, Sparkles, Loader2, AlertTriangle, Check } from 'lucide-react';
import { useI18n } from '../../i18n';
import api from '../../services/api';

const STYLE_OPTIONS = [
    { id: 'cozy', labelKey: 'calendar.planning.styles.cozy', emoji: '🕯️' },
    { id: 'playful', labelKey: 'calendar.planning.styles.playful', emoji: '🎈' },
    { id: 'fancy', labelKey: 'calendar.planning.styles.fancy', emoji: '🥂' },
    { id: 'low_key', labelKey: 'calendar.planning.styles.lowKey', emoji: '🏡' },
];

/**
 * PlanSkeleton Component
 * Loading skeleton for plan content
 */
const PlanSkeleton = () => (
    <div className="space-y-4 animate-pulse">
        <div className="rounded-3xl p-4 bg-white/60 border border-white/50">
            <div className="h-4 w-2/3 bg-neutral-200/70 rounded" />
            <div className="h-3 w-1/2 bg-neutral-200/60 rounded mt-2" />
        </div>
        <div className="rounded-3xl p-4 bg-white/60 border border-white/50 space-y-3">
            <div className="h-4 w-1/3 bg-neutral-200/70 rounded" />
            <div className="h-3 w-full bg-neutral-200/60 rounded" />
            <div className="h-3 w-5/6 bg-neutral-200/60 rounded" />
            <div className="h-3 w-2/3 bg-neutral-200/60 rounded" />
        </div>
    </div>
);

/**
 * EventPlanningDialog Component
 * AI-powered event planning modal with RAG-enhanced suggestions
 */
const EventPlanningDialog = ({ event, eventKey, myId, partnerId, partnerDisplayName, myDisplayName, onClose, onSaved }) => {
    const { t, language } = useI18n();
    const dateStr = event?.date;
    const eventDate = dateStr?.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T00:00:00');

    const [style, setStyle] = useState('cozy');
    const [plan, setPlan] = useState(null);
    const [meta, setMeta] = useState(null);
    const [checked, setChecked] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const requestSeqRef = useRef(0);
    const checklistSaveTimerRef = useRef(null);
    const [plansByStyle, setPlansByStyle] = useState(() => ({}));
    const [planIdsByStyle, setPlanIdsByStyle] = useState(() => ({}));
    const [checklistsByStyle, setChecklistsByStyle] = useState(() => ({}));

    useEffect(() => {
        setChecked({});
    }, [plan?.mainPlan?.title]);

    // Hydrate any previously-saved plans for this event (all styles).
    useEffect(() => {
        if (!eventKey) return;

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

                for (const row of rows) {
                    if (!row?.style || !row?.plan) continue;
                    nextPlans[row.style] = row.plan;
                    nextPlanIds[row.style] = row.id;
                    nextChecklists[row.style] = row.checklistState || {};
                }

                setPlansByStyle(nextPlans);
                setPlanIdsByStyle(nextPlanIds);
                setChecklistsByStyle(nextChecklists);

                const initialStyle = nextPlans.cozy ? 'cozy' : Object.keys(nextPlans)[0] || 'cozy';
                const initialPlan = nextPlans[initialStyle] || null;
                setStyle(initialStyle);
                setPlan(initialPlan);
                setChecked(nextChecklists[initialStyle] || {});
            } catch {
                if (cancelled) return;
                setPlansByStyle({});
                setPlanIdsByStyle({});
                setChecklistsByStyle({});
            } finally {
                if (!cancelled) setIsLoading(false);
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
            setChecked({});

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
        // If we already have a cached plan for this style, just show it.
        const cached = plansByStyle[style];
        if (cached) {
            setPlan(cached);
            setError(null);
            setChecked(checklistsByStyle[style] || {});
            return;
        }

        // Otherwise, generate and persist.
        generatePlan();
    }, [style, plansByStyle, generatePlan, checklistsByStyle]);

    // Cleanup debounced checklist save timer on unmount
    useEffect(() => {
        return () => {
            if (checklistSaveTimerRef.current) {
                clearTimeout(checklistSaveTimerRef.current);
            }
        };
    }, []);

    const toggleChecklistItem = (key) => {
        setChecked((prev) => {
            const next = { ...prev, [key]: !prev[key] };
            setChecklistsByStyle((current) => ({ ...current, [style]: next }));

            const planId = planIdsByStyle[style];
            if (!planId) return next;

            if (checklistSaveTimerRef.current) clearTimeout(checklistSaveTimerRef.current);
            checklistSaveTimerRef.current = setTimeout(async () => {
                try {
                    await api.patch(`/calendar/event-plans/${planId}`, { checklistState: next });
                } catch {
                    // Best-effort; keep UI responsive even if save fails.
                }
            }, 500);

            return next;
        });
    };

    return (
        <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/35 backdrop-blur-sm z-[60] flex items-end justify-center p-4 pb-20"
            onClick={onClose}
        >
            <Motion.div
                initial={{ y: 120, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 120, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md max-h-[80vh] overflow-hidden rounded-3xl bg-white/80 backdrop-blur-xl border border-white/60 shadow-2xl flex flex-col"
            >
                {/* Header */}
                <div className="p-5 pb-4 border-b border-white/50">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-12 h-12 rounded-3xl bg-gradient-to-br from-violet-100 to-amber-100 flex items-center justify-center text-2xl shadow-soft border border-white/60 shrink-0">
                                {event.emoji || '✨'}
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <Wand2 className="w-4 h-4 text-violet-500" />
                                    <h3 className="font-extrabold text-neutral-800 text-lg truncate">
                                        {t('calendar.planning.title', { title: event.title })}
                                    </h3>
                                </div>
                                <p className="text-xs text-neutral-500 mt-0.5 truncate">
                                    {t('calendar.planning.subtitle', {
                                        date: eventDate.toLocaleDateString(language, { weekday: 'short', month: 'short', day: 'numeric' }),
                                        name: partnerDisplayName || t('common.partner')
                                    })}
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="w-9 h-9 bg-white/70 border border-white/60 rounded-full flex items-center justify-center shadow-sm shrink-0">
                            <X className="w-4 h-4 text-neutral-500" />
                        </button>
                    </div>

                    {/* Style Toggle */}
                    <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                        {STYLE_OPTIONS.map((opt) => {
                            const active = style === opt.id;
                            return (
                                <button
                                    key={opt.id}
                                    onClick={() => setStyle(opt.id)}
                                    className={`shrink-0 px-3 py-2 rounded-full text-xs font-bold border transition-all ${active
                                        ? 'bg-white text-court-brown border-court-tan/60 shadow-soft'
                                        : 'bg-white/50 text-neutral-500 border-white/60 hover:bg-white/70'
                                        }`}
                                >
                                    <span className="mr-1">{opt.emoji}</span>
                                    {t(opt.labelKey)}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Body */}
                <div className="p-5 pt-4 overflow-y-auto space-y-4">
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
                                        className="mt-3 px-4 py-2 rounded-full bg-white text-red-700 border border-red-200 text-xs font-bold"
                                    >
                                        {t('common.tryAgain')}
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
                            <div className="rounded-3xl p-4 bg-gradient-to-br from-court-cream/60 via-white/70 to-amber-50/60 border border-white/60 shadow-soft">
                                <p className="text-sm font-bold text-neutral-800">{plan.oneLiner}</p>
                                <p className="text-xs text-neutral-500 mt-1">{plan.vibe}</p>
                            </div>

                            {Array.isArray(plan.memoryHighlights) && plan.memoryHighlights.length > 0 && (
                                <div className="flex gap-2 overflow-x-auto pb-1">
                                    {plan.memoryHighlights.slice(0, 8).map((h, idx) => (
                                        <div
                                            key={idx}
                                            className="shrink-0 px-3 py-2 rounded-full bg-white/70 border border-white/60 shadow-sm text-xs text-neutral-700 flex items-center gap-2"
                                            title={h.source}
                                        >
                                            <span>{h.emoji}</span>
                                            <span className="whitespace-nowrap">{h.text}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="rounded-3xl p-4 bg-white/70 border border-white/60 shadow-soft">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <h4 className="font-extrabold text-neutral-800 text-base">{plan.mainPlan.title}</h4>
                                        <p className="text-sm text-neutral-600 mt-1">{plan.mainPlan.whyItFits}</p>
                                    </div>
                                    <div className="shrink-0 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-extrabold">
                                        {String(plan.mainPlan.budgetTier || '').toUpperCase()}
                                    </div>
                                </div>
                                <p className="text-xs text-neutral-500 mt-2">{plan.mainPlan.budgetNote}</p>

                                <div className="mt-4 space-y-3">
                                    {plan.mainPlan.timeline.map((step, idx) => (
                                        <div key={idx} className="flex gap-3">
                                            <div className="w-20 shrink-0 text-[11px] font-bold text-neutral-500">
                                                {step.time}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-neutral-800">{step.title}</p>
                                                <p className="text-xs text-neutral-500 mt-0.5">{step.details}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-3xl p-4 bg-white/70 border border-white/60 shadow-soft">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-extrabold text-neutral-800">{t('calendar.planning.sections.prepChecklist')}</p>
                                    <span className="text-[11px] text-neutral-400">{Object.values(checked).filter(Boolean).length}/{plan.mainPlan.prepChecklist.length}</span>
                                </div>
                                <div className="mt-3 space-y-2">
                                    {plan.mainPlan.prepChecklist.map((item, idx) => {
                                        const key = `${idx}-${item.item}`;
                                        const isChecked = !!checked[key];
                                        return (
                                            <button
                                                key={key}
                                                onClick={() => toggleChecklistItem(key)}
                                                className="w-full flex items-center gap-3 px-3 py-2 rounded-2xl bg-neutral-50/70 border border-neutral-100 text-left"
                                            >
                                                <span className={`w-6 h-6 rounded-full flex items-center justify-center border ${isChecked
                                                    ? 'bg-green-500 border-green-500'
                                                    : 'bg-white border-neutral-200'
                                                    }`}
                                                >
                                                    <Check className={`w-4 h-4 ${isChecked ? 'text-white' : 'text-transparent'}`} />
                                                </span>
                                                <span className="text-sm font-semibold text-neutral-700">{item.item}</span>
                                                {item.optional && (
                                                    <span className="ml-auto text-[10px] font-bold text-neutral-400">{t('calendar.planning.optional')}</span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-3xl p-4 bg-white/70 border border-white/60 shadow-soft">
                                    <p className="text-sm font-extrabold text-neutral-800 mb-2">{t('calendar.planning.sections.littleTouches')}</p>
                                    <div className="space-y-2">
                                        {plan.littleTouches.slice(0, 4).map((touch, idx) => (
                                            <div key={idx} className="flex gap-2">
                                                <span className="text-lg">{touch.emoji}</span>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-neutral-800">{touch.title}</p>
                                                    <p className="text-[11px] text-neutral-500 mt-0.5">{touch.details}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="rounded-3xl p-4 bg-white/70 border border-white/60 shadow-soft">
                                    <p className="text-sm font-extrabold text-neutral-800 mb-2">{t('calendar.planning.sections.giftIdeas')}</p>
                                    <div className="space-y-2">
                                        {plan.giftIdeas.slice(0, 4).map((gift, idx) => (
                                            <div key={idx} className="flex gap-2">
                                                <span className="text-lg">{gift.emoji}</span>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-neutral-800">{gift.title}</p>
                                                    <p className="text-[11px] text-neutral-500 mt-0.5">{gift.details}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-3xl p-4 bg-white/70 border border-white/60 shadow-soft">
                                <p className="text-sm font-extrabold text-neutral-800 mb-2">{t('calendar.planning.sections.alternatives')}</p>
                                <div className="flex gap-2 overflow-x-auto pb-1">
                                    {plan.alternatives.map((alt, idx) => (
                                        <div key={idx} className="shrink-0 w-56 rounded-3xl bg-gradient-to-br from-violet-50/70 via-white/70 to-amber-50/50 border border-white/60 p-3 shadow-soft">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl">{alt.emoji}</span>
                                                <p className="text-sm font-extrabold text-neutral-800 truncate">{alt.title}</p>
                                            </div>
                                            <p className="text-xs text-neutral-600 mt-2">{alt.oneLiner}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <details className="rounded-3xl p-4 bg-white/70 border border-white/60 shadow-soft">
                                <summary className="text-sm font-extrabold text-neutral-800 cursor-pointer select-none">
                                    {t('calendar.planning.sections.backupPlan')}
                                </summary>
                                <div className="mt-3 space-y-2">
                                    {plan.backupPlan.steps.map((s, idx) => (
                                        <div key={idx} className="rounded-2xl bg-neutral-50/70 border border-neutral-100 p-3">
                                            <p className="text-xs font-extrabold text-neutral-700">{s.title}</p>
                                            <p className="text-[11px] text-neutral-500 mt-1">{s.details}</p>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        </>
                    ) : isLoading ? (
                        <PlanSkeleton />
                    ) : null}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/50 bg-white/70 backdrop-blur-xl">
                    <button
                        onClick={generatePlan}
                        disabled={isLoading}
                        className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Sparkles className="w-4 h-4" />
                        )}
                        {t('calendar.planning.generateNew')}
                    </button>
                    {meta?.rag?.memoriesUsed !== undefined && (
                        <p className="mt-2 text-[11px] text-neutral-400 text-center">
                            {meta.rag.memoriesUsed === 1
                                ? t('calendar.planning.memoriesOne')
                                : t('calendar.planning.memoriesOther', { count: meta.rag.memoriesUsed })}
                        </p>
                    )}
                </div>
            </Motion.div>
        </Motion.div>
    );
};

export default EventPlanningDialog;
