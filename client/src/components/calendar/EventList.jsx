import React from 'react';
import { motion as Motion } from 'framer-motion';
import { ChevronRight, Check, Wand2, Lock } from 'lucide-react';
import PropTypes from 'prop-types';
import { useI18n } from '../../i18n';

const EVENT_TYPES = [
    { id: 'birthday', labelKey: 'calendar.eventTypes.birthday', emoji: '🎂', color: 'pink' },
    { id: 'anniversary', labelKey: 'calendar.eventTypes.anniversary', emoji: '💕', color: 'red' },
    { id: 'holiday', labelKey: 'calendar.eventTypes.holiday', emoji: '🎉', color: 'amber' },
    { id: 'date_night', labelKey: 'calendar.eventTypes.dateNight', emoji: '🌙', color: 'violet' },
    { id: 'custom', labelKey: 'calendar.eventTypes.custom', emoji: '📅', color: 'blue' },
];

/**
 * EventCard Component
 * Displays a single event card with plan button
 */
const EventCard = ({ event, delay, onClick, onPlanClick, showPlanButton, hasSavedPlan }) => {
    const { t, language } = useI18n();
    const eventType = EVENT_TYPES.find((item) => item.id === event.type) || EVENT_TYPES[4];

    // Parse date string as local date to prevent timezone shift
    const dateStr = event?.date || '';
    if (!dateStr) return null;

    const eventDate = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventStart = new Date(eventDate);
    eventStart.setHours(0, 0, 0, 0);

    const daysAway = Math.round((eventStart.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    const timingLabel = daysAway === 0
        ? t('calendar.timing.today')
        : daysAway === 1
            ? t('calendar.timing.tomorrow')
            : daysAway > 1
                ? t('calendar.timing.inDays', { count: daysAway })
                : null;
    const isToday = daysAway === 0;
    const isSoon = daysAway >= 0 && daysAway <= 7;

    const monthLabel = eventDate.toLocaleDateString(language, { month: 'short' });
    const weekdayLabel = eventDate.toLocaleDateString(language, { weekday: 'short' });
    const dayNumber = eventDate.getDate();

    const cardFrame = event.isSecret
        ? 'from-indigo-200/65 via-white/35 to-violet-200/55'
        : 'from-rose-200/70 via-white/40 to-amber-200/55';

    const dateFrame = isToday
        ? 'from-court-gold/70 via-rose-200/45 to-court-goldLight/55'
        : event.isSecret
            ? 'from-indigo-200/70 via-white/40 to-violet-200/60'
            : 'from-rose-200/70 via-white/40 to-amber-200/60';

    const planLabel = hasSavedPlan ? t('calendar.plan.view') : t('calendar.plan.help');
    const eventTypeLabel = t(eventType.labelKey);
    const planBorder = isSoon
        ? event.isSecret
            ? 'from-indigo-300/55 via-court-goldLight/35 to-violet-300/55'
            : 'from-rose-300/60 via-amber-300/45 to-pink-300/55'
        : event.isSecret
            ? 'from-indigo-200/55 via-white/40 to-violet-200/55'
            : 'from-rose-200/60 via-white/40 to-amber-200/55';
    const planGlow = isSoon
        ? event.isSecret
            ? 'from-indigo-200/35 via-amber-100/25 to-violet-200/35'
            : 'from-rose-200/35 via-amber-100/25 to-pink-200/35'
        : 'from-transparent via-transparent to-transparent';
    const planFill = hasSavedPlan
        ? 'from-white/80 via-amber-50/65 to-white/75'
        : 'from-white/80 via-rose-50/55 to-amber-50/55';

    return (
        <Motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            whileTap={{ scale: 0.995 }}
            onClick={onClick}
            className={`group relative w-full rounded-3xl p-[1px] bg-gradient-to-br ${cardFrame} shadow-soft hover:shadow-soft-lg transition-all duration-300 cursor-pointer overflow-hidden`}
        >
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-shimmer-gradient bg-[length:900px_100%] animate-shimmer"
            />

            <div className="relative rounded-[23px] bg-white/75 backdrop-blur-xl border border-white/60">
                <div className="p-3">
                    <div className="flex items-start gap-3">
                        <div className={`relative w-14 shrink-0 rounded-2xl p-[1px] bg-gradient-to-br ${dateFrame} ${isToday ? 'shadow-glow-cream' : 'shadow-soft'}`}>
                            <div className={`rounded-[15px] px-2.5 py-2 text-center ${isToday ? 'bg-gradient-to-br from-[#B85C6B] via-[#8B4049] to-[#722F37]' : 'bg-white/85'}`}>
                                <div className={`text-[10px] font-extrabold tracking-wide uppercase ${isToday ? 'text-white/90' : 'text-neutral-500'}`}>
                                    {monthLabel}
                                </div>
                                <div className={`text-xl font-black leading-none tabular-nums ${isToday ? 'text-white' : 'text-neutral-800'}`}>
                                    {dayNumber}
                                </div>
                                <div className={`text-[10px] font-bold ${isToday ? 'text-white/80' : 'text-neutral-400'}`}>
                                    {weekdayLabel}
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-white/80 border border-white/70 shadow-soft flex items-center justify-center text-2xl shrink-0">
                                    {event.emoji}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h4 className="font-extrabold text-neutral-800 text-sm truncate">{event.title}</h4>
                                        {timingLabel && (
                                            <span
                                                className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${isToday
                                                    ? 'bg-white/20 text-white border border-white/30'
                                                    : 'bg-white/70 border border-white/60 text-neutral-600'
                                                    }`}
                                            >
                                                {timingLabel}
                                            </span>
                                        )}
                                    </div>

                                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-neutral-600">
                                        <span className="px-2 py-0.5 rounded-full bg-white/70 border border-white/60 text-[10px] font-extrabold text-neutral-700">
                                            {eventTypeLabel}
                                        </span>
                                        {event.isSecret ? (
                                            <span className="px-2 py-0.5 rounded-full bg-indigo-100/70 text-indigo-800 border border-indigo-200/50 text-[10px] font-extrabold inline-flex items-center gap-1">
                                                <Lock className="w-3 h-3" />
                                                {t('calendar.visibility.secret')}
                                            </span>
                                        ) : (
                                            <span className="px-2 py-0.5 rounded-full bg-rose-100/80 text-rose-800 border border-rose-200/50 text-[10px] font-extrabold">
                                                {t('calendar.visibility.shared')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="shrink-0 pt-1 text-neutral-300 group-hover:text-neutral-500 transition-colors">
                            <ChevronRight className="w-5 h-5" />
                        </div>
                    </div>
                </div>

                {showPlanButton && (
                    <div className="px-3 pb-3">
                        <Motion.button
                            whileHover={{ y: -1 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={onPlanClick}
                            aria-label={planLabel}
                            className={`group/plan relative w-full rounded-full p-[1px] shadow-soft hover:shadow-soft-lg transition-all duration-300 ${hasSavedPlan ? 'ring-1 ring-amber-200/30' : ''}`}
                        >
                            <span aria-hidden="true" className={`absolute inset-0 rounded-full bg-gradient-to-r ${planBorder}`} />
                            <span aria-hidden="true" className={`absolute -inset-2 rounded-full bg-gradient-to-r ${planGlow} blur-xl opacity-60 transition-opacity duration-300 ${isSoon ? 'group-hover/plan:opacity-85' : 'opacity-0'}`} />

                            <span className={`relative z-10 flex items-center justify-between gap-3 w-full h-10 rounded-full px-3.5 bg-gradient-to-r ${planFill} border border-white/70 backdrop-blur-xl`}>
                                <span className="flex items-center gap-2.5 min-w-0">
                                    <span className={`grid place-items-center w-7 h-7 rounded-full border shadow-inner-soft ${hasSavedPlan
                                        ? 'bg-amber-50/70 border-amber-200/60 text-amber-800'
                                        : 'bg-rose-50/70 border-rose-200/60 text-rose-800'
                                        }`}>
                                        {hasSavedPlan ? <Check className="w-4 h-4" /> : <Wand2 className="w-4 h-4" />}
                                    </span>
                                    <span className="text-[12px] font-extrabold tracking-tight text-neutral-800 truncate">
                                        {planLabel}
                                    </span>
                                </span>

                                <span className={`text-[10px] font-extrabold px-2 py-1 rounded-full border shadow-soft tabular-nums ${event.isSecret
                                    ? 'bg-indigo-50/60 text-indigo-800 border-indigo-200/50'
                                    : 'bg-white/60 text-neutral-700 border-white/60'
                                    }`}>
                                    AI
                                </span>
                            </span>
                        </Motion.button>
                    </div>
                )}
            </div>
        </Motion.div>
    );
};

EventCard.propTypes = {
    event: PropTypes.shape({
        id: PropTypes.string.isRequired,
        title: PropTypes.string.isRequired,
        date: PropTypes.string.isRequired,
        type: PropTypes.string.isRequired,
        emoji: PropTypes.string,
        isSecret: PropTypes.bool,
    }).isRequired,
    delay: PropTypes.number,
    onClick: PropTypes.func.isRequired,
    onPlanClick: PropTypes.func,
    showPlanButton: PropTypes.bool,
    hasSavedPlan: PropTypes.bool,
};

EventCard.defaultProps = {
    delay: 0,
    showPlanButton: false,
    hasSavedPlan: false,
};

export default EventCard;
