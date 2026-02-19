import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion as Motion } from 'framer-motion';
import { X, Plus, Trash2, Wand2, Check, Lock, RotateCcw, Handshake, Heart } from 'lucide-react';
import { useI18n } from '../../i18n';
import { parseLocalDate } from '../../utils/dateFormatters';
import api from '../../services/api';
import EmojiIcon from '../shared/EmojiIcon';
import ButtonLoader from '../shared/ButtonLoader';
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion';

/**
 * Helper to generate event key for plan lookup
 */
const getEventKey = (event) => {
    const id = event?.id;
    const isUuid = typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(id);
    if (isUuid) return `db:${id}`;

    const title = String(event?.title || '').trim().toLowerCase();
    const type = String(event?.type || 'custom').trim().toLowerCase();
    const date = String(event?.date || '').trim();
    const emoji = String(event?.emoji || '').trim();
    return `computed:${type}:${date}:${title}:${emoji}`;
};

const EVENT_TYPES = [
    { id: 'birthday', labelKey: 'calendar.eventTypes.birthday', emoji: '🎂', color: 'pink' },
    { id: 'anniversary', labelKey: 'calendar.eventTypes.anniversary', emoji: '💕', color: 'red' },
    { id: 'holiday', labelKey: 'calendar.eventTypes.holiday', emoji: '🎉', color: 'amber' },
    { id: 'date_night', labelKey: 'calendar.eventTypes.dateNight', emoji: '🌙', color: 'violet' },
    { id: 'milestone', labelKey: 'calendar.eventTypes.milestone', emoji: '🏆', color: 'emerald' },
    { id: 'custom', labelKey: 'calendar.eventTypes.custom', emoji: '📅', color: 'blue' },
];

const EVENT_GRADIENTS = {
    birthday: 'from-pink-50/50',
    anniversary: 'from-red-50/50',
    holiday: 'from-amber-50/50',
    date_night: 'from-violet-50/50',
    milestone: 'from-emerald-50/50',
    custom: 'from-blue-50/50',
};
const EMPTY_EVENTS = [];

/**
 * EventDetailsModal Component
 * Displays details for one or more events on a selected date
 */
const EventDetailsModal = ({ events, onDelete, onClose, onAddMore, onPlanClick, partnerId, currentUserId, myDisplayName, partnerDisplayName }) => {
    const { t, language } = useI18n();
    const prefersReducedMotion = usePrefersReducedMotion();
    const [plannedEventKeys, setPlannedEventKeys] = useState(() => new Set());
    const [deletingId, setDeletingId] = useState(null);

    // Check which events already have saved plans
    useEffect(() => {
        if (!events?.length || !partnerId) {
            setPlannedEventKeys(new Set());
            return;
        }

        const eventKeys = events.map(getEventKey).filter(Boolean);
        if (!eventKeys.length) return;

        let cancelled = false;
        (async () => {
            try {
                const response = await api.post('/calendar/event-plans/exists', { eventKeys });
                const exists = response.data?.exists || {};
                if (cancelled) return;
                setPlannedEventKeys(new Set(Object.keys(exists).filter((k) => exists[k])));
            } catch {
                // Intentionally ignored: plan check is optional
                if (cancelled) return;
                setPlannedEventKeys(new Set());
            }
        })();

        return () => { cancelled = true; };
    }, [events, partnerId]);

    // Callback to update state when a plan is saved
    const handleSavedPlan = useCallback((eventKey) => {
        setPlannedEventKeys((prev) => {
            const next = new Set(prev);
            next.add(eventKey);
            return next;
        });
    }, []);

    const handleDelete = useCallback(async (eventId) => {
        if (!eventId || deletingId) return;
        setDeletingId(eventId);
        try {
            await onDelete(eventId);
        } finally {
            setDeletingId(null);
        }
    }, [deletingId, onDelete]);
    const eventList = events || EMPTY_EVENTS;
    const eventCards = useMemo(() => eventList.map((event) => {
        const eventType = EVENT_TYPES.find((item) => item.id === event.type)
            || EVENT_TYPES.find((item) => item.id === 'custom')
            || EVENT_TYPES[0];
        const isCreatedByMe = event.createdBy === currentUserId;

        return {
            event,
            eventType,
            eventTypeLabel: t(eventType.labelKey),
            gradientFrom: EVENT_GRADIENTS[eventType.id] || EVENT_GRADIENTS.custom,
            canDelete: isCreatedByMe && !event.isDefault && !event.isPersonal,
            creatorName: isCreatedByMe ? myDisplayName : partnerDisplayName,
            eventKey: getEventKey(event)
        };
    }), [eventList, currentUserId, myDisplayName, partnerDisplayName, t]);

    // Guard against empty events array
    if (!eventList.length) {
        return null;
    }

    // Parse date string as local date to prevent timezone shift
    const dateStr = eventList[0].date;
    const eventDate = parseLocalDate(dateStr) || new Date();
    const eventCountLabel = eventList.length === 1
        ? t('calendar.details.eventsOnDayOne')
        : t('calendar.details.eventsOnDayOther', { count: eventList.length });

    return (
        <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 bg-black/40 z-[60] flex items-end justify-center p-4 pb-20 ${prefersReducedMotion ? '' : 'fx-modal-backdrop-soft'}`}
            onClick={onClose}
        >
            <Motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-3xl w-full max-w-md p-5 space-y-4 shadow-xl max-h-[70vh] overflow-y-auto"
            >
                <div className="flex items-center justify-between sticky top-0 bg-white pb-2">
                    <div>
                        <h3 className="font-bold text-neutral-800 text-lg">
                            {eventDate.toLocaleDateString(language, { month: 'short', day: 'numeric' })}
                        </h3>
                        <p className="text-neutral-500 text-xs">
                            {eventCountLabel}
                        </p>
                    </div>
                    <button onClick={onClose} aria-label="Close modal" className="w-8 h-8 bg-neutral-100 rounded-full flex items-center justify-center">
                        <X className="w-4 h-4 text-neutral-500" />
                    </button>
                </div>

                <div className="space-y-3">
                    {eventCards.map(({ event, eventType, eventTypeLabel, gradientFrom, canDelete, creatorName, eventKey }, index) => {
                        const hasSavedPlan = plannedEventKeys.has(eventKey);
                        const isSecret = event.isSecret;
                        const planBorder = isSecret
                            ? 'from-indigo-300/55 via-court-goldLight/35 to-violet-300/55'
                            : 'from-rose-300/60 via-amber-300/45 to-pink-300/55';
                        const planFill = hasSavedPlan
                            ? 'from-white/80 via-amber-50/65 to-white/75'
                            : 'from-white/80 via-rose-50/55 to-amber-50/55';
                        const iconStyle = hasSavedPlan
                            ? 'bg-amber-50/70 border-amber-200/60 text-amber-800'
                            : 'bg-rose-50/70 border-rose-200/60 text-rose-800';
                        const aiBadgeStyle = isSecret
                            ? 'bg-indigo-50/60 text-indigo-800 border-indigo-200/50'
                            : 'bg-white/60 text-neutral-700 border-white/60';

                        return (
                            <Motion.div
                                key={event.id}
                                initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={prefersReducedMotion ? { duration: 0.14 } : { delay: index * 0.04, duration: 0.22 }}
                                className={`glass-card p-4 bg-gradient-to-r ${gradientFrom} to-white perf-content-auto contain-paint`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="flex items-center justify-center">
                                        <EmojiIcon
                                            emoji={event.emoji || eventType.emoji}
                                            className="w-7 h-7 text-amber-600"
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-neutral-800">{event.title}</h4>
                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-600">
                                                {eventTypeLabel}
                                            </span>
                                            {event.isSecret ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#1c1c84]/10 text-[#1c1c84]">
                                                    <Lock className="w-3 h-3" />
                                                    {t('calendar.visibility.secret')}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-pink-100 text-pink-700">
                                                    <Handshake className="w-3 h-3" />
                                                    {t('calendar.visibility.shared')}
                                                </span>
                                            )}
                                            {event.isRecurring && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-600">
                                                    <RotateCcw className="w-3 h-3" />
                                                    {t('calendar.details.yearly')}
                                                </span>
                                            )}
                                            {event.isPersonal && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-pink-100 text-pink-600">
                                                    <Heart className="w-3 h-3" />
                                                    {t('calendar.details.personal')}
                                                </span>
                                            )}
                                        </div>
                                        {event.notes && (
                                            <p className="text-neutral-500 text-xs mt-2">{event.notes}</p>
                                        )}
                                        <p className="text-neutral-500 text-xs mt-2">
                                            {event.isDefault
                                                ? t('calendar.details.defaultHoliday')
                                                : event.isPersonal
                                                    ? t('calendar.details.fromProfile')
                                                    : t('calendar.details.addedBy', { name: creatorName || t('common.unknown') })}
                                        </p>
                                    </div>
                                    {canDelete && (
                                        <button
                                            onClick={() => handleDelete(event.id)}
                                            aria-label="Delete event"
                                            disabled={deletingId === event.id}
                                            className="w-8 h-8 bg-red-50 rounded-full flex items-center justify-center text-red-400 hover:bg-red-100 transition-colors disabled:opacity-60"
                                        >
                                            {deletingId === event.id ? (
                                                <ButtonLoader size="sm" tone="rose" variant="dots" />
                                            ) : (
                                                <Trash2 className="w-4 h-4" />
                                            )}
                                        </button>
                                    )}
                                </div>

                                {/* Help me plan / View my plan button */}
                                {partnerId && event.date && onPlanClick && (
                                    <Motion.button
                                        whileTap={{ scale: 0.98 }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onPlanClick(event, eventKey, handleSavedPlan);
                                        }}
                                        className={`relative w-full mt-3 rounded-full p-[1px] shadow-soft hover:shadow-soft-lg transition-shadow duration-200 ${hasSavedPlan ? 'ring-1 ring-amber-200/30' : ''}`}
                                    >
                                        <span aria-hidden="true" className={`absolute inset-0 rounded-full bg-gradient-to-r ${planBorder}`} />

                                        <span className={`relative z-10 flex items-center justify-between gap-3 w-full h-10 rounded-full px-3.5 bg-gradient-to-r ${planFill} border border-white/70`}>
                                            <span className="flex items-center gap-2.5 min-w-0">
                                                <span className={`grid place-items-center w-7 h-7 rounded-full border shadow-inner-soft ${iconStyle}`}>
                                                    {hasSavedPlan ? <Check className="w-4 h-4" /> : <Wand2 className="w-4 h-4" />}
                                                </span>
                                                <span className="text-[12px] font-extrabold tracking-tight text-neutral-800 truncate">
                                                    {hasSavedPlan ? t('calendar.plan.view') : t('calendar.plan.help')}
                                                </span>
                                            </span>

                                            <span className={`text-[10px] font-extrabold px-2 py-1 rounded-full border shadow-soft ${aiBadgeStyle}`}>
                                                AI
                                            </span>
                                        </span>
                                    </Motion.button>
                                )}
                            </Motion.div>
                        );
                    })}
                </div>

                {/* Add More Events Button */}
                <button
                    onClick={onAddMore}
                    className="w-full py-3 bg-gradient-to-r from-court-cream to-court-tan text-court-brown rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    {t('calendar.details.addAnother')}
                </button>
            </Motion.div>
        </Motion.div>
    );
};

export default EventDetailsModal;
