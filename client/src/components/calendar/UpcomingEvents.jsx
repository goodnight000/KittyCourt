import React, { useMemo, useState, useEffect, useCallback, useRef, memo } from 'react';
import { motion as Motion } from 'framer-motion';
import { Calendar } from 'lucide-react';
import { useI18n } from '../../i18n';
import EventCard from './EventList';
import api from '../../services/api';

/**
 * Helper to parse date strings as local dates (not UTC)
 */
const parseLocalDate = (dateStr) => {
    if (!dateStr) return new Date();
    return dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T00:00:00');
};

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

/**
 * UpcomingEvents Component
 * Displays upcoming events in the next 7 days with plan buttons
 * Wrapped with React.memo to prevent unnecessary re-renders
 */
const UpcomingEvents = memo(({
    events,
    partnerId = null,
    isGold = false,
    onEventClick,
    onPlanClick,
}) => {
    const { t } = useI18n();
    const [plannedEventKeys, setPlannedEventKeys] = useState(() => new Set());
    const debounceTimerRef = useRef(null);

    // Get upcoming events (next 7 days)
    const upcomingEvents = useMemo(() => events
        .filter(event => {
            const eventDate = parseLocalDate(event.date);
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Start of today
            const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
            return eventDate >= today && eventDate <= weekFromNow;
        })
        .sort((a, b) => parseLocalDate(a.date) - parseLocalDate(b.date)), [events]);

    // Create a stable key from upcoming event IDs to prevent excessive API calls
    // This only changes when the actual event composition changes, not on every render
    const upcomingEventKeysString = useMemo(() =>
        upcomingEvents.slice(0, 20).map(getEventKey).join('|'),
        [upcomingEvents]
    );

    const upcomingCountLabel = upcomingEvents.length === 1
        ? t('calendar.upcoming.countOne')
        : t('calendar.upcoming.countOther', { count: upcomingEvents.length });

    // Fetch whether upcoming events already have a saved plan (for "View my plan")
    // Uses debouncing and stable dependency to prevent API thrashing
    useEffect(() => {
        // Clear any pending debounce timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        const eventKeys = upcomingEventKeysString ? upcomingEventKeysString.split('|') : [];
        if (!eventKeys.length || !eventKeys[0]) {
            setPlannedEventKeys(new Set());
            return;
        }

        let cancelled = false;

        // Debounce API calls by 150ms to prevent rapid re-fetching
        debounceTimerRef.current = setTimeout(async () => {
            try {
                const response = await api.post('/calendar/event-plans/exists', { eventKeys });
                const exists = response.data?.exists || {};
                if (cancelled) return;
                setPlannedEventKeys(new Set(Object.keys(exists).filter((k) => exists[k])));
            } catch {
                if (cancelled) return;
                setPlannedEventKeys(new Set());
            }
        }, 150);

        return () => {
            cancelled = true;
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [upcomingEventKeysString]);

    const handleSavedPlan = useCallback((eventKey) => {
        setPlannedEventKeys((prev) => {
            const next = new Set(prev);
            next.add(eventKey);
            return next;
        });
    }, []);

    return (
        <Motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-4 overflow-hidden relative"
        >
            {/* Decorative background */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-gradient-to-br from-amber-200/25 via-white/15 to-pink-200/20 blur-3xl opacity-70" />
                <div className="absolute -bottom-16 -left-14 w-56 h-56 rounded-full bg-gradient-to-br from-sky-100/25 via-white/15 to-violet-200/20 blur-3xl opacity-70" />
            </div>

            <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-100/80 via-white/70 to-amber-50/60 border border-white/70 shadow-soft flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-[#B85C6B]" />
                        </div>
                        <div>
                            <h3 className="text-lg font-extrabold text-neutral-700">{t('calendar.upcoming.title')}</h3>
                            <p className="text-sm text-neutral-500">{t('calendar.upcoming.subtitle')}</p>
                        </div>
                    </div>
                    <div className="px-2.5 py-1 rounded-full bg-white/70 border border-white/60 shadow-soft text-[11px] font-extrabold text-neutral-600 tabular-nums">
                        {upcomingCountLabel}
                    </div>
                </div>

                {upcomingEvents.length === 0 ? (
                    <div className="rounded-3xl p-[1px] bg-gradient-to-br from-white/80 via-amber-100/40 to-rose-100/50">
                        <div className="rounded-[23px] bg-white/65 border border-white/60 p-5 text-center">
                            <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-br from-violet-100/70 to-pink-100/70 border border-white/70 shadow-soft flex items-center justify-center text-3xl">
                                📅
                            </div>
                            <p className="text-neutral-700 text-sm font-extrabold mt-3">{t('calendar.upcoming.emptyTitle')}</p>
                            <p className="text-neutral-500 text-xs mt-1">{t('calendar.upcoming.emptyHint')}</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {upcomingEvents.map((event, index) => {
                            const eventKey = getEventKey(event);
                            const hasSavedPlan = plannedEventKeys.has(eventKey);
                            return (
                                <EventCard
                                    key={event.id}
                                    event={event}
                                    delay={index * 0.05}
                                    onClick={() => onEventClick(event)}
                                    onPlanClick={(e) => {
                                        e.stopPropagation();
                                        onPlanClick(event, eventKey, handleSavedPlan);
                                    }}
                                    showPlanButton={!!partnerId}
                                    hasSavedPlan={hasSavedPlan}
                                />
                            );
                        })}
                    </div>
                )}
            </div>
        </Motion.div>
    );
});

UpcomingEvents.displayName = 'UpcomingEvents';

export default UpcomingEvents;
