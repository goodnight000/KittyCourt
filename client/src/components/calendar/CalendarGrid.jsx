import React, { useMemo, memo } from 'react';
import { motion as Motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import PropTypes from 'prop-types';
import { useI18n } from '../../i18n';

/**
 * Helper to format date as YYYY-MM-DD for map lookup
 */
const formatDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * CalendarGrid Component
 * Renders the main calendar grid with month navigation and day cells
 * Wrapped with React.memo to prevent unnecessary re-renders
 */
const CalendarGrid = memo(({
    currentDate,
    events,
    onDateSelect,
    onMonthNavigate,
}) => {
    const { t, language } = useI18n();

    // Generate weekday labels starting from Sunday (day 0)
    // Using local dates (not UTC) to avoid timezone offset issues
    const weekdayLabels = useMemo(() => {
        const formatter = new Intl.DateTimeFormat(language, { weekday: 'short' });
        // January 1, 2023 was a Sunday - use local time, not UTC
        return Array.from({ length: 7 }, (_, idx) => (
            formatter.format(new Date(2023, 0, 1 + idx))
        ));
    }, [language]);

    // Generate month labels
    // Using local dates (not UTC) to avoid timezone offset issues
    const monthLabels = useMemo(() => {
        const formatter = new Intl.DateTimeFormat(language, { month: 'long' });
        return Array.from({ length: 12 }, (_, idx) => (
            formatter.format(new Date(2023, idx, 15)) // Use 15th to avoid any edge cases
        ));
    }, [language]);

    // Memoize days array - only recalculate when month/year changes
    const days = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDay = firstDay.getDay();

        const result = [];

        // Previous month days
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = startingDay - 1; i >= 0; i--) {
            result.push({ day: prevMonthLastDay - i, currentMonth: false, date: new Date(year, month - 1, prevMonthLastDay - i) });
        }

        // Current month days
        for (let i = 1; i <= daysInMonth; i++) {
            result.push({ day: i, currentMonth: true, date: new Date(year, month, i) });
        }

        // Next month days
        const remainingDays = 42 - result.length;
        for (let i = 1; i <= remainingDays; i++) {
            result.push({ day: i, currentMonth: false, date: new Date(year, month + 1, i) });
        }

        return result;
    }, [currentDate]);

    // Pre-compute event lookup map - O(N) once instead of O(42*N) per render
    const eventsByDate = useMemo(() => {
        const map = new Map();
        for (const event of events) {
            const dateStr = event.date;
            let key;
            if (dateStr.includes('T')) {
                const d = new Date(dateStr);
                key = formatDateKey(d);
            } else {
                key = dateStr;
            }
            if (!map.has(key)) {
                map.set(key, []);
            }
            map.get(key).push(event);
        }
        return map;
    }, [events]);

    // Compute today's date key once (not 42 times)
    const todayKey = useMemo(() => formatDateKey(new Date()), []);

    return (
        <Motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-4 relative overflow-hidden"
        >
            {/* Decorative background */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                <div className="absolute -top-16 -left-14 w-56 h-56 rounded-full bg-gradient-to-br from-pink-200/40 via-white/20 to-amber-100/20 blur-3xl opacity-60" />
                <div className="absolute -bottom-20 -right-16 w-64 h-64 rounded-full bg-gradient-to-br from-violet-200/30 via-white/15 to-sky-100/20 blur-3xl opacity-60" />
            </div>

            <div className="relative z-10">
                {/* Month Navigation */}
                <div className="flex items-center justify-between mb-4">
                    <Motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => onMonthNavigate(-1)}
                        className="w-10 h-10 rounded-2xl bg-white/90 border border-white/70 shadow-soft flex items-center justify-center hover:bg-white transition-colors"
                        aria-label={t('calendar.navigation.previousMonth')}
                    >
                        <ChevronLeft className="w-5 h-5 text-neutral-600" />
                    </Motion.button>
                    <div className="text-center">
                        <h2 className="font-extrabold text-neutral-800 text-lg tracking-tight">
                            {monthLabels[currentDate.getMonth()]}
                        </h2>
                        <p className="text-neutral-500 text-sm">{currentDate.getFullYear()}</p>
                    </div>
                    <Motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => onMonthNavigate(1)}
                        className="w-10 h-10 rounded-2xl bg-white/90 border border-white/70 shadow-soft flex items-center justify-center hover:bg-white transition-colors"
                        aria-label={t('calendar.navigation.nextMonth')}
                    >
                        <ChevronRight className="w-5 h-5 text-neutral-600" />
                    </Motion.button>
                </div>

                {/* Day Headers */}
                <div className="grid grid-cols-7 gap-2 mb-2 px-0.5">
                    {weekdayLabels.map(day => (
                        <div
                            key={day}
                            className="text-center text-[11px] font-extrabold text-neutral-500 py-1.5 rounded-xl bg-white/45 border border-white/50 shadow-inner-soft"
                        >
                            {day}
                        </div>
                    ))}
                </div>

                {/* Calendar Grid - contain-paint enables CSS containment for performance */}
                <div className="grid grid-cols-7 gap-2 contain-paint">
                    {days.map((dayInfo, index) => {
                        const dateKey = formatDateKey(dayInfo.date);
                        const dayEvents = eventsByDate.get(dateKey) || [];
                        const sharedCount = dayEvents.filter(e => !e.isSecret).length;
                        const secretCount = dayEvents.filter(e => e.isSecret).length;
                        const hasEvents = dayEvents.length > 0;
                        const hasSharedEvents = sharedCount > 0;
                        const hasSecretEvents = secretCount > 0;
                        const today = dateKey === todayKey;
                        const isOutsideMonth = !dayInfo.currentMonth;
                        const dateLabel = dayInfo.date.toLocaleDateString(language, {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric'
                        });
                        const eventCountLabel = dayEvents.length === 1
                            ? t('calendar.eventCount.one')
                            : t('calendar.eventCount.other', { count: dayEvents.length });

                        // Frame class with gradients and shadows
                        const frameClass = today
                            ? 'bg-gradient-to-br from-court-gold/60 via-rose-200/40 to-court-goldLight/50 shadow-soft'
                            : hasSharedEvents && hasSecretEvents
                                ? 'bg-gradient-to-br from-rose-200/70 via-white/30 to-indigo-200/55 shadow-soft'
                                : hasSharedEvents
                                    ? 'bg-gradient-to-br from-rose-200/75 via-white/30 to-amber-100/40 shadow-soft'
                                    : hasSecretEvents
                                        ? 'bg-gradient-to-br from-indigo-200/65 via-white/30 to-violet-200/50 shadow-soft'
                                        : 'bg-white/35 shadow-inner-soft';

                        // Inner class with gradients
                        const innerClass = today
                            ? 'bg-gradient-to-br from-[#B85C6B] via-[#8B4049] to-[#722F37]'
                            : hasSharedEvents && hasSecretEvents
                                ? 'bg-gradient-to-br from-white/80 via-pink-50/50 to-violet-50/50'
                                : hasSharedEvents
                                    ? 'bg-gradient-to-br from-white/85 via-pink-50/60 to-amber-50/50'
                                    : hasSecretEvents
                                        ? 'bg-gradient-to-br from-white/85 via-indigo-50/55 to-violet-50/45'
                                        : 'bg-white/75';

                        return (
                            <Motion.button
                                key={index}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => onDateSelect(dayInfo.date, dayEvents)}
                                className={`group relative aspect-square rounded-2xl p-[2px] transition-transform duration-150 active:scale-[0.98] ${frameClass} ${isOutsideMonth ? 'opacity-55' : ''}`}
                                aria-label={`${dateLabel}${hasEvents ? `, ${eventCountLabel}` : ''}`}
                            >
                                {/* Day cell content */}
                                <div
                                    className={`relative w-full h-full rounded-[18px] border border-white/70 flex flex-col items-center justify-center transition-shadow duration-150 ${innerClass} ${today ? 'shadow-soft-lg' : 'shadow-inner-soft'} ${!today && !hasEvents ? 'group-hover:bg-white/90' : ''}`}
                                >
                                    <span
                                        className={`text-sm font-black tabular-nums ${today
                                            ? 'text-white'
                                            : isOutsideMonth
                                                ? 'text-neutral-500'
                                                : 'text-neutral-800'
                                            }`}
                                    >
                                        {dayInfo.day}
                                    </span>

                                    {/* Event indicators - hidden on today's date for cleaner look */}
                                    {!today && (hasSharedEvents || hasSecretEvents) && (
                                        <div className="mt-1 flex items-center justify-center gap-1.5">
                                            {hasSharedEvents && (
                                                <span className="w-1.5 h-1.5 rounded-full shadow-sm bg-gradient-to-br from-pink-500 to-rose-600" />
                                            )}
                                            {hasSecretEvents && (
                                                <span className="w-1.5 h-1.5 rounded-full shadow-sm bg-gradient-to-br from-indigo-600 to-violet-700" />
                                            )}
                                            {dayEvents.length > 1 && (
                                                <span className="text-[10px] font-extrabold tabular-nums text-neutral-500">
                                                    {dayEvents.length}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </Motion.button>
                        );
                    })}
                </div>
            </div>
        </Motion.div>
    );
});

CalendarGrid.displayName = 'CalendarGrid';

CalendarGrid.propTypes = {
    currentDate: PropTypes.instanceOf(Date).isRequired,
    events: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string.isRequired,
        title: PropTypes.string.isRequired,
        date: PropTypes.string.isRequired,
        isSecret: PropTypes.bool,
    })).isRequired,
    onDateSelect: PropTypes.func.isRequired,
    onMonthNavigate: PropTypes.func.isRequired,
};

export default CalendarGrid;
