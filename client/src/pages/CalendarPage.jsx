import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    ChevronLeft, ChevronRight, Plus, X, Check, Calendar,
    Heart, Cake, Star, Gift, PartyPopper, Sparkles, Trash2,
    Lightbulb, Wand2, Loader2, AlertTriangle, Lock
} from 'lucide-react';
import useAppStore from '../store/useAppStore';
import useAuthStore from '../store/useAuthStore';
import api from '../services/api';
import { validateDate } from '../utils/helpers';

const EVENT_TYPES = [
    { id: 'birthday', label: 'Birthday', emoji: '🎂', color: 'pink' },
    { id: 'anniversary', label: 'Anniversary', emoji: '💕', color: 'red' },
    { id: 'holiday', label: 'Holiday', emoji: '🎉', color: 'amber' },
    { id: 'date_night', label: 'Date Night', emoji: '🌙', color: 'violet' },
    { id: 'custom', label: 'Custom', emoji: '📅', color: 'blue' },
];

const EMOJI_OPTIONS = ['🎂', '💕', '🎉', '🌙', '📅', '🎁', '💐', '🍰', '🎊', '✨', '🌸', '🌈'];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

// Default holidays that couples typically celebrate
const getDefaultHolidays = (year) => [
    { title: "Valentine's Day", date: `${year}-02-14`, type: 'holiday', emoji: '💕', isRecurring: true, isDefault: true, isSecret: false },
    { title: "International Women's Day", date: `${year}-03-08`, type: 'holiday', emoji: '🌸', isRecurring: true, isDefault: true, isSecret: false },
    { title: "Mother's Day", date: `${year}-05-11`, type: 'holiday', emoji: '💐', isRecurring: true, isDefault: true, isSecret: false },
    { title: "Father's Day", date: `${year}-06-15`, type: 'holiday', emoji: '👔', isRecurring: true, isDefault: true, isSecret: false },
    { title: "Halloween", date: `${year}-10-31`, type: 'holiday', emoji: '🎃', isRecurring: true, isDefault: true, isSecret: false },
    { title: "Thanksgiving", date: `${year}-11-27`, type: 'holiday', emoji: '🦃', isRecurring: true, isDefault: true, isSecret: false },
    { title: "Christmas Eve", date: `${year}-12-24`, type: 'holiday', emoji: '🎄', isRecurring: true, isDefault: true, isSecret: false },
    { title: "Christmas Day", date: `${year}-12-25`, type: 'holiday', emoji: '🎅', isRecurring: true, isDefault: true, isSecret: false },
    { title: "New Year's Eve", date: `${year}-12-31`, type: 'holiday', emoji: '🥂', isRecurring: true, isDefault: true, isSecret: false },
    { title: "New Year's Day", date: `${year + 1}-01-01`, type: 'holiday', emoji: '🎊', isRecurring: true, isDefault: true, isSecret: false },
];

const CalendarPage = () => {
    const navigate = useNavigate();
    const { currentUser } = useAppStore();
    const { user: authUser, profile, partner: connectedPartner, hasPartner } = useAuthStore();

    // Build users array from auth store
    const myId = authUser?.id || currentUser?.id;
    const myDisplayName = profile?.display_name || profile?.name || 'You';
    const partnerId = connectedPartner?.id;
    const partnerDisplayName = connectedPartner?.display_name || connectedPartner?.name || 'Partner';

    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState([]);
    const [selectedDate, setSelectedDate] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEventDetails, setShowEventDetails] = useState(null);
    const [showPlanningModal, setShowPlanningModal] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [plannedEventKeys, setPlannedEventKeys] = useState(() => new Set());

    // Fetch events from API and merge with default holidays and profile dates
    useEffect(() => {
        fetchEvents();
    }, [myId, partnerId, profile, connectedPartner]);

    // Get personal events from auth store profiles
    const getPersonalEvents = () => {
        const personalEvents = [];
        const currentYear = new Date().getFullYear();

        // Build users array from auth store
        const users = [];
        if (profile) {
            users.push({ id: myId, name: myDisplayName, ...profile });
        }
        if (connectedPartner) {
            users.push({ id: partnerId, name: partnerDisplayName, ...connectedPartner });
        }

        users.forEach(user => {
            const displayName = user.display_name || user.name || 'User';

            // Add birthday events (from profile data if available)
            const birthday = user.birthday || user.birth_date;
            if (birthday) {
                const bday = new Date(birthday);
                // This year's birthday
                personalEvents.push({
                    id: `birthday_${user.id}_${currentYear}`,
                    title: `${displayName}'s Birthday`,
                    date: `${currentYear}-${String(bday.getMonth() + 1).padStart(2, '0')}-${String(bday.getDate()).padStart(2, '0')}`,
                    type: 'birthday',
                    emoji: '🎂',
                    isPersonal: true,
                    isSecret: false,
                });
                // Next year's birthday
                personalEvents.push({
                    id: `birthday_${user.id}_${currentYear + 1}`,
                    title: `${displayName}'s Birthday`,
                    date: `${currentYear + 1}-${String(bday.getMonth() + 1).padStart(2, '0')}-${String(bday.getDate()).padStart(2, '0')}`,
                    type: 'birthday',
                    emoji: '🎂',
                    isPersonal: true,
                    isSecret: false,
                });
            }

            // Add anniversary (only from current user's profile to avoid duplicates)
            const anniversaryDate = user.anniversary_date || user.anniversaryDate;
            if (anniversaryDate && user.id === myId) {
                // Parse as local date
                const anniv = anniversaryDate.includes('T')
                    ? new Date(anniversaryDate)
                    : new Date(anniversaryDate + 'T00:00:00');
                personalEvents.push({
                    id: `anniversary_${currentYear}`,
                    title: `Our Anniversary 💕`,
                    date: `${currentYear}-${String(anniv.getMonth() + 1).padStart(2, '0')}-${String(anniv.getDate()).padStart(2, '0')}`,
                    type: 'anniversary',
                    emoji: '💕',
                    isPersonal: true,
                    isSecret: false,
                });
                personalEvents.push({
                    id: `anniversary_${currentYear + 1}`,
                    title: `Our Anniversary 💕`,
                    date: `${currentYear + 1}-${String(anniv.getMonth() + 1).padStart(2, '0')}-${String(anniv.getDate()).padStart(2, '0')}`,
                    type: 'anniversary',
                    emoji: '💕',
                    isPersonal: true,
                    isSecret: false,
                });
            }
        });

        return personalEvents;
    };

    const fetchEvents = async () => {
        try {
            const response = await api.get('/calendar/events');
            const dbEvents = Array.isArray(response.data) ? response.data : [];

            // Get default holidays for current and next year
            const currentYear = new Date().getFullYear();
            const defaultEvents = [
                ...getDefaultHolidays(currentYear),
                ...getDefaultHolidays(currentYear + 1)
            ];

            // Get personal events (birthdays, anniversary) from profiles
            const personalEvents = getPersonalEvents();

            // Check which default holidays are already in the database
            const existingTitles = dbEvents.map(e => e.title);
            const newDefaults = defaultEvents.filter(d => !existingTitles.includes(d.title));

            // Combine all events
            setEvents([
                ...dbEvents,
                ...newDefaults.map(d => ({ ...d, id: `default_${d.title}` })),
                ...personalEvents
            ]);
        } catch (error) {
            console.error('Failed to fetch events:', error);
            // Still show default holidays and personal events even if API fails
            const currentYear = new Date().getFullYear();
            const defaultEvents = getDefaultHolidays(currentYear);
            const personalEvents = getPersonalEvents();
            setEvents([
                ...defaultEvents.map(d => ({ ...d, id: `default_${d.title}` })),
                ...personalEvents
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const addEvent = async (eventData) => {
        try {
            const response = await api.post('/calendar/events', {
                ...eventData
            });
            setEvents([...events, response.data]);
            setShowAddModal(false);
        } catch (error) {
            console.error('Failed to add event:', error);
        }
    };

    const deleteEvent = async (eventId) => {
        try {
            await api.delete(`/calendar/events/${eventId}`);
            setEvents(events.filter(e => e.id !== eventId));
            setShowEventDetails(null);
        } catch (error) {
            console.error('Failed to delete event:', error);
        }
    };

    // Calendar helpers
    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDay = firstDay.getDay();

        const days = [];

        // Previous month days
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = startingDay - 1; i >= 0; i--) {
            days.push({ day: prevMonthLastDay - i, currentMonth: false, date: new Date(year, month - 1, prevMonthLastDay - i) });
        }

        // Current month days
        for (let i = 1; i <= daysInMonth; i++) {
            days.push({ day: i, currentMonth: true, date: new Date(year, month, i) });
        }

        // Next month days
        const remainingDays = 42 - days.length;
        for (let i = 1; i <= remainingDays; i++) {
            days.push({ day: i, currentMonth: false, date: new Date(year, month + 1, i) });
        }

        return days;
    };

    const getEventsForDate = (date) => {
        return events.filter(event => {
            // Parse date string as local date by appending T00:00:00
            // This prevents timezone shift when parsing "YYYY-MM-DD" strings
            const dateStr = event.date;
            const eventDate = dateStr.includes('T')
                ? new Date(dateStr)
                : new Date(dateStr + 'T00:00:00');
            return eventDate.getDate() === date.getDate() &&
                eventDate.getMonth() === date.getMonth() &&
                eventDate.getFullYear() === date.getFullYear();
        });
    };

    const isToday = (date) => {
        const today = new Date();
        return date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();
    };

    const navigateMonth = (direction) => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));
    };

    const days = getDaysInMonth(currentDate);

    // Helper to parse date strings as local dates (not UTC)
    const parseLocalDate = (dateStr) => {
        if (!dateStr) return new Date();
        // Append T00:00:00 to treat as local time, not UTC
        return dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T00:00:00');
    };

    const getEventKey = useCallback((event) => {
        const id = event?.id;
        const isUuid = typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(id);
        if (isUuid) return `db:${id}`;

        const title = String(event?.title || '').trim().toLowerCase();
        const type = String(event?.type || 'custom').trim().toLowerCase();
        const date = String(event?.date || '').trim();
        const emoji = String(event?.emoji || '').trim();
        return `computed:${type}:${date}:${title}:${emoji}`;
    }, []);

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

    // Fetch whether upcoming events already have a saved plan (for "View my plan")
    useEffect(() => {
        const eventKeys = upcomingEvents.slice(0, 20).map(getEventKey);
        if (!eventKeys.length) {
            setPlannedEventKeys(new Set());
            return;
        }

        let cancelled = false;
        (async () => {
            try {
                const response = await api.post('/calendar/event-plans/exists', { eventKeys });
                const exists = response.data?.exists || {};
                if (cancelled) return;
                setPlannedEventKeys(new Set(Object.keys(exists).filter((k) => exists[k])));
            } catch (e) {
                if (cancelled) return;
                setPlannedEventKeys(new Set());
            }
        })();

        return () => { cancelled = true; };
    }, [upcomingEvents, getEventKey]);

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
                <motion.div
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-12 h-12 bg-gradient-to-br from-violet-100 to-pink-100 rounded-2xl flex items-center justify-center shadow-soft"
                >
                    <span className="text-2xl">📅</span>
                </motion.div>
                <div className="flex-1">
                    <h1 className="text-xl font-bold text-gradient">Our Calendar</h1>
                    <p className="text-neutral-500 text-sm">Important dates & memories 💕</p>
                </div>
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                        setSelectedDate(new Date());
                        setShowAddModal(true);
                    }}
                    className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md"
                    style={{ background: 'linear-gradient(135deg, #C9A227 0%, #8B7019 100%)' }}
                >
                    <Plus className="w-5 h-5 text-white" />
                </motion.button>
            </div>

            {/* Month Navigation */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-4"
            >
                <div className="flex items-center justify-between mb-4">
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => navigateMonth(-1)}
                        className="w-10 h-10 bg-white/80 rounded-xl flex items-center justify-center"
                    >
                        <ChevronLeft className="w-5 h-5 text-neutral-600" />
                    </motion.button>
                    <div className="text-center">
                        <h2 className="font-bold text-neutral-800 text-lg">
                            {MONTHS[currentDate.getMonth()]}
                        </h2>
                        <p className="text-neutral-500 text-sm">{currentDate.getFullYear()}</p>
                    </div>
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => navigateMonth(1)}
                        className="w-10 h-10 bg-white/80 rounded-xl flex items-center justify-center"
                    >
                        <ChevronRight className="w-5 h-5 text-neutral-600" />
                    </motion.button>
                </div>

                {/* Day Headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                    {DAYS.map(day => (
                        <div key={day} className="text-center text-xs font-bold text-neutral-400 py-2">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1">
                    {days.map((dayInfo, index) => {
                        const dayEvents = getEventsForDate(dayInfo.date);
                        const hasEvents = dayEvents.length > 0;
                        const hasSecretEvents = dayEvents.some(e => e.isSecret);
                        const today = isToday(dayInfo.date);

                        return (
                            <motion.button
                                key={index}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => {
                                    setSelectedDate(dayInfo.date);
                                    if (hasEvents) {
                                        setShowEventDetails(dayEvents);
                                    } else {
                                        setShowAddModal(true);
                                    }
                                }}
                                className={`
                                    aspect-square rounded-xl flex flex-col items-center justify-center relative
                                    transition-all duration-200
                                    ${dayInfo.currentMonth ? 'text-neutral-700' : 'text-neutral-300'}
                                    ${today ? 'text-white shadow-md' : ''}
                                    ${hasEvents && !today ? (hasSecretEvents ? 'bg-[#1c1c84]/15' : 'bg-pink-50') : ''}
                                    ${!today && !hasEvents ? 'hover:bg-neutral-50' : ''}
                                `}
                                style={today ? { background: 'linear-gradient(135deg, #C9A227 0%, #8B7019 100%)' } : {}}
                            >
                                <span className={`text-sm font-bold ${today ? 'text-white' : ''}`}>
                                    {dayInfo.day}
                                </span>
                                {hasEvents && (
                                    <div className="flex gap-0.5 mt-1 items-center justify-center">
                                        <span className={`w-1.5 h-1.5 rounded-full ${hasSecretEvents ? 'bg-[#1c1c84]' : 'bg-pink-400'}`} />
                                        <span className="text-[8px] text-neutral-400 font-semibold">{dayEvents.length}</span>
                                    </div>
                                )}
                            </motion.button>
                        );
                    })}
                </div>
            </motion.div>

            {/* Upcoming Events */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-4 overflow-hidden"
            >
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-100 via-pink-100 to-violet-100 flex items-center justify-center shadow-soft border border-white/60">
                            <Sparkles className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <h3 className="text-sm font-extrabold text-neutral-700">Upcoming</h3>
                            <p className="text-xs text-neutral-500">Next 7 days</p>
                        </div>
                    </div>
                    <div className="text-xs text-neutral-400 font-medium">
                        {upcomingEvents.length} {upcomingEvents.length === 1 ? 'event' : 'events'}
                    </div>
                </div>

                {upcomingEvents.length === 0 ? (
                    <div className="rounded-2xl bg-white/60 border border-white/50 p-4 text-center">
                        <div className="text-3xl mb-2">📅</div>
                        <p className="text-neutral-600 text-sm font-medium">No upcoming events</p>
                        <p className="text-neutral-400 text-xs mt-1">Tap + to add a special date.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {upcomingEvents.map((event, index) => (
                            (() => {
                                const eventKey = getEventKey(event);
                                const hasSavedPlan = plannedEventKeys.has(eventKey);
                                return (
                            <EventCard
                                key={event.id}
                                event={event}
                                delay={index * 0.05}
                                onClick={() => setShowEventDetails([event])}
                                onPlanClick={(e) => {
                                    e.stopPropagation();
                                    setShowPlanningModal({ event, eventKey });
                                }}
                                showPlanButton={!!partnerId}
                                hasSavedPlan={hasSavedPlan}
                            />
                                );
                            })()
                        ))}
                    </div>
                )}
            </motion.div>

            {/* Add Event Modal */}
            <AnimatePresence>
                {showAddModal && (
                    <AddEventModal
                        selectedDate={selectedDate}
                        onAdd={addEvent}
                        onClose={() => setShowAddModal(false)}
                    />
                )}
            </AnimatePresence>

            {/* AI Planning Modal */}
            <AnimatePresence>
                {showPlanningModal && (
                    <PlanningModal
                        event={showPlanningModal.event}
                        eventKey={showPlanningModal.eventKey}
                        myId={myId}
                        partnerId={partnerId}
                        partnerDisplayName={partnerDisplayName}
                        myDisplayName={myDisplayName}
                        onClose={() => setShowPlanningModal(null)}
                        onSaved={() => {
                            if (!showPlanningModal?.eventKey) return;
                            setPlannedEventKeys((prev) => {
                                const next = new Set(prev);
                                next.add(showPlanningModal.eventKey);
                                return next;
                            });
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Event Details Modal */}
            <AnimatePresence>
                {showEventDetails && (
                    <EventDetailsModal
                        events={showEventDetails}
                        onDelete={deleteEvent}
                        onClose={() => setShowEventDetails(null)}
                        onAddMore={() => {
                            setSelectedDate(showEventDetails[0].date.includes('T')
                                ? new Date(showEventDetails[0].date)
                                : new Date(showEventDetails[0].date + 'T00:00:00'));
                            setShowEventDetails(null);
                            setShowAddModal(true);
                        }}
                        currentUserId={myId}
                        myDisplayName={myDisplayName}
                        partnerDisplayName={partnerDisplayName}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

const EventCard = ({ event, delay, onClick, onPlanClick, showPlanButton, hasSavedPlan }) => {
    const eventType = EVENT_TYPES.find(t => t.id === event.type) || EVENT_TYPES[4];
    // Parse date string as local date to prevent timezone shift
    const dateStr = event.date;
    const eventDate = dateStr?.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventStart = new Date(eventDate);
    eventStart.setHours(0, 0, 0, 0);

    const daysAway = Math.round((eventStart.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    const timingLabel = daysAway === 0
        ? 'Today'
        : daysAway === 1
            ? 'Tomorrow'
            : daysAway > 1
                ? `In ${daysAway} days`
                : null;
    const isToday = daysAway === 0;
    const isSoon = daysAway >= 0 && daysAway <= 7;

    const accent = {
        pink: 'from-pink-300/70 to-rose-300/30',
        red: 'from-red-300/70 to-orange-300/30',
        amber: 'from-amber-300/70 to-yellow-300/30',
        violet: 'from-violet-300/70 to-purple-300/30',
        blue: 'from-blue-300/70 to-cyan-300/30',
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            whileTap={{ scale: 0.995 }}
            onClick={onClick}
            className="group relative w-full rounded-2xl border border-white/50 bg-white/70 backdrop-blur-xl shadow-soft hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
        >
            <div className={`absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b ${accent[eventType.color] || accent.blue}`} />
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/30 rounded-full -translate-y-1/2 translate-x-1/2 blur-xl" />

            <div className="relative z-10 p-3 pl-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-white/70 border border-white/60 shadow-sm flex items-center justify-center text-2xl">
                    {event.emoji}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h4 className="font-bold text-neutral-800 text-sm truncate">{event.title}</h4>
                        {timingLabel && (
                            <span
                                className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${isToday
                                    ? 'bg-gradient-to-r from-amber-400 to-orange-400 text-white shadow-sm'
                                    : 'bg-neutral-100 text-neutral-600'
                                    }`}
                            >
                                {timingLabel}
                            </span>
                        )}
                    </div>

                    <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
                        <span className="truncate">
                            {eventDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                        <span className="text-neutral-300">•</span>
                        <span className="px-2 py-0.5 rounded-full bg-white/70 border border-white/50 text-[10px] font-bold text-neutral-600">
                            {eventType.label}
                        </span>
                        <span className="text-neutral-300">•</span>
                        {event.isSecret ? (
                            <span className="px-2 py-0.5 rounded-full bg-[#1c1c84]/10 text-[#1c1c84] text-[10px] font-extrabold inline-flex items-center gap-1">
                                <Lock className="w-3 h-3" />
                                Secret
                            </span>
                        ) : (
                            <span className="px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 text-[10px] font-extrabold">
                                Shared
                            </span>
                        )}
                    </div>
                </div>

                {showPlanButton && (
                    <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={onPlanClick}
                        className={`shrink-0 h-10 px-3 rounded-full text-xs font-bold flex items-center gap-2 transition-all ${isSoon
                            ? 'text-white shadow-lg'
                            : 'bg-white/70 text-court-brown border border-court-tan/50 shadow-soft hover:bg-white'
                            }`}
                        style={isSoon ? { background: 'linear-gradient(135deg, #C9A227 0%, #722F37 100%)' } : {}}
                    >
                        <Wand2 className="w-4 h-4" />
                        <span>{hasSavedPlan ? 'View my plan' : 'Help me plan'}</span>
                    </motion.button>
                )}
            </div>
        </motion.div>
    );
};

const AddEventModal = ({ selectedDate, onAdd, onClose }) => {
    const [title, setTitle] = useState('');
    const [type, setType] = useState('custom');
    const [emoji, setEmoji] = useState('📅');
    const [isSecret, setIsSecret] = useState(false);

    // Handle date initialization - use local date to avoid timezone shift
    const getInitialDate = () => {
        if (selectedDate) {
            // If selectedDate is already a Date object
            if (selectedDate instanceof Date && !isNaN(selectedDate)) {
                // Use local date format to avoid timezone issues
                const year = selectedDate.getFullYear();
                const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                const day = String(selectedDate.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            }
            // If it's a string, return it as-is if it's in YYYY-MM-DD format
            if (typeof selectedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
                return selectedDate;
            }
            // If it's a different string format, try to parse it
            if (typeof selectedDate === 'string') {
                const parsed = new Date(selectedDate);
                if (!isNaN(parsed)) {
                    const year = parsed.getFullYear();
                    const month = String(parsed.getMonth() + 1).padStart(2, '0');
                    const day = String(parsed.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                }
            }
        }
        // Default to today using local date
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [date, setDate] = useState(getInitialDate);
    const [dateError, setDateError] = useState(null);
    const [isRecurring, setIsRecurring] = useState(false);
    const [notes, setNotes] = useState('');

    const handleDateChange = (value) => {
        setDate(value);
        if (value) {
            // For calendar events, allow future dates
            const validation = validateDate(value, { allowFuture: true });
            setDateError(validation.isValid ? null : validation.error);
        } else {
            setDateError(null);
        }
    };

    const handleSubmit = () => {
        if (!title.trim()) return;
        if (dateError) return; // Don't submit if date is invalid
        onAdd({
            title: title.trim(),
            date,
            type,
            emoji,
            isRecurring,
            isSecret,
            notes: notes.trim() || null
        });
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-end justify-center p-4 pb-20"
            onClick={onClose}
        >
            <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-3xl w-full max-w-md p-5 space-y-4 shadow-xl max-h-[75vh] overflow-y-auto"
            >
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-neutral-800 text-lg">Add Event ✨</h3>
                    <button onClick={onClose} className="w-8 h-8 bg-neutral-100 rounded-full flex items-center justify-center">
                        <X className="w-4 h-4 text-neutral-500" />
                    </button>
                </div>

                {/* Sharing */}
                <div className="space-y-2">
                    <p className="text-xs font-bold text-neutral-500">Visibility</p>
                    <div className="rounded-2xl bg-neutral-50 border-2 border-neutral-100 p-1 flex gap-1">
                        <button
                            type="button"
                            onClick={() => setIsSecret(false)}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${!isSecret
                                ? 'bg-white shadow-sm text-pink-700 border border-pink-100'
                                : 'text-neutral-500 hover:bg-white/60'
                                }`}
                        >
                            <span>🤝</span>
                            Shared
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsSecret(true)}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${isSecret
                                ? 'bg-white shadow-sm text-[#1c1c84] border border-[#1c1c84]/15'
                                : 'text-neutral-500 hover:bg-white/60'
                                }`}
                        >
                            <Lock className="w-4 h-4" />
                            Secret
                        </button>
                    </div>
                    <p className="text-[11px] text-neutral-500">
                        {isSecret ? 'Secret events are only visible to you.' : 'Shared events are visible to you and your partner.'}
                    </p>
                </div>

                {/* Event Type */}
                <div>
                    <label className="text-xs font-bold text-neutral-500 mb-2 block">Event Type</label>
                    <div className="flex flex-wrap gap-2">
                        {EVENT_TYPES.map((t) => (
                            <button
                                key={t.id}
                                onClick={() => {
                                    setType(t.id);
                                    setEmoji(t.emoji);
                                }}
                                className={`px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-1.5 transition-all ${type === t.id
                                    ? 'bg-violet-100 ring-2 ring-violet-400 text-violet-700'
                                    : 'bg-neutral-50 text-neutral-600'
                                    }`}
                            >
                                <span>{t.emoji}</span>
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Title */}
                <div>
                    <label className="text-xs font-bold text-neutral-500 mb-1 block">Event Title</label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g., Our Anniversary 💕"
                        className="w-full bg-neutral-50 border-2 border-neutral-100 rounded-xl p-3 text-neutral-700 focus:ring-2 focus:ring-violet-200 focus:border-violet-300 focus:outline-none text-sm"
                    />
                </div>

                {/* Date */}
                <div>
                    <label className="text-xs font-bold text-neutral-500 mb-1 block">Date</label>
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => handleDateChange(e.target.value)}
                        className={`w-full bg-neutral-50 border-2 rounded-xl p-3 text-neutral-700 focus:ring-2 focus:outline-none text-sm ${dateError
                            ? 'border-red-300 focus:ring-red-200 focus:border-red-300'
                            : 'border-neutral-100 focus:ring-violet-200 focus:border-violet-300'
                            }`}
                    />
                    {dateError && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {dateError}
                        </p>
                    )}
                </div>

                {/* Emoji */}
                <div>
                    <label className="text-xs font-bold text-neutral-500 mb-2 block">Choose Emoji</label>
                    <div className="flex flex-wrap gap-2">
                        {EMOJI_OPTIONS.map((e) => (
                            <button
                                key={e}
                                onClick={() => setEmoji(e)}
                                className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${emoji === e ? 'bg-violet-100 ring-2 ring-violet-400' : 'bg-neutral-50'
                                    }`}
                            >
                                {e}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Recurring */}
                <button
                    onClick={() => setIsRecurring(!isRecurring)}
                    className={`w-full p-3 rounded-xl flex items-center justify-between transition-all ${isRecurring ? 'bg-pink-50 ring-2 ring-pink-300' : 'bg-neutral-50'
                        }`}
                >
                    <span className="text-sm font-medium text-neutral-700">🔄 Repeat yearly</span>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${isRecurring ? 'bg-pink-400' : 'bg-neutral-200'
                        }`}>
                        {isRecurring && <Check className="w-3 h-3 text-white" />}
                    </div>
                </button>

                {/* Notes */}
                <div>
                    <label className="text-xs font-bold text-neutral-500 mb-1 block">Notes (optional)</label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Add any special notes..."
                        rows={2}
                        className="w-full bg-neutral-50 border-2 border-neutral-100 rounded-xl p-3 text-neutral-700 focus:ring-2 focus:ring-violet-200 focus:border-violet-300 focus:outline-none text-sm resize-none"
                    />
                </div>

                <button
                    onClick={handleSubmit}
                    disabled={!title.trim()}
                    className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    <Plus className="w-4 h-4" />
                    Add Event
                </button>
            </motion.div>
        </motion.div>
    );
};

const EventDetailsModal = ({ events, onDelete, onClose, onAddMore, currentUserId, myDisplayName, partnerDisplayName }) => {
    // Parse date string as local date to prevent timezone shift
    const dateStr = events[0].date;
    const eventDate = dateStr?.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T00:00:00');

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-end justify-center p-4 pb-20"
            onClick={onClose}
        >
            <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-3xl w-full max-w-md p-5 space-y-4 shadow-xl max-h-[70vh] overflow-y-auto"
            >
                <div className="flex items-center justify-between sticky top-0 bg-white pb-2">
                    <div>
                        <h3 className="font-bold text-neutral-800 text-lg">
                            {eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </h3>
                        <p className="text-neutral-500 text-xs">
                            {events.length} event{events.length > 1 ? 's' : ''} on this day
                        </p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 bg-neutral-100 rounded-full flex items-center justify-center">
                        <X className="w-4 h-4 text-neutral-500" />
                    </button>
                </div>

                <div className="space-y-3">
                    {events.map((event, index) => {
                        const eventType = EVENT_TYPES.find(t => t.id === event.type) || EVENT_TYPES[4];
                        // Determine who created this event
                        const isCreatedByMe = event.createdBy === currentUserId;
                        const creatorName = isCreatedByMe ? myDisplayName : partnerDisplayName;
                        const canDelete = isCreatedByMe && !event.isDefault && !event.isPersonal;

                        return (
                            <motion.div
                                key={event.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className={`glass-card p-4 bg-gradient-to-r from-${eventType.color}-50/50 to-white`}
                            >
                                <div className="flex items-start gap-3">
                                    <motion.div
                                        animate={{ scale: [1, 1.05, 1] }}
                                        transition={{ duration: 2, repeat: Infinity, delay: index * 0.2 }}
                                        className="text-3xl"
                                    >
                                        {event.emoji}
                                    </motion.div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-neutral-800">{event.title}</h4>
                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-600">
                                                {eventType.label}
                                            </span>
                                            {event.isSecret ? (
                                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#1c1c84]/10 text-[#1c1c84]">
                                                    🔒 Secret
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-pink-100 text-pink-700">
                                                    🤝 Shared
                                                </span>
                                            )}
                                            {event.isRecurring && (
                                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-600">
                                                    🔄 Yearly
                                                </span>
                                            )}
                                            {event.isPersonal && (
                                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-pink-100 text-pink-600">
                                                    💕 Personal
                                                </span>
                                            )}
                                        </div>
                                        {event.notes && (
                                            <p className="text-neutral-500 text-xs mt-2">{event.notes}</p>
                                        )}
                                        <p className="text-neutral-400 text-xs mt-2">
                                            {event.isDefault ? '📅 Default Holiday' :
                                                event.isPersonal ? '💕 From Profile' :
                                                    `Added by ${creatorName || 'Unknown'}`}
                                        </p>
                                    </div>
                                    {canDelete && (
                                        <button
                                            onClick={() => onDelete(event.id)}
                                            className="w-8 h-8 bg-red-50 rounded-full flex items-center justify-center text-red-400 hover:bg-red-100 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                {/* Add More Events Button */}
                <button
                    onClick={onAddMore}
                    className="w-full py-3 bg-gradient-to-r from-court-cream to-court-tan text-court-brown rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Add Another Event
                </button>
            </motion.div>
        </motion.div>
    );
};

// AI Planning Modal - RAG + DeepSeek plan in JSON (for premium UI)
const PlanningModal = ({ event, eventKey, myId, partnerId, partnerDisplayName, myDisplayName, onClose, onSaved }) => {
    const STYLE_OPTIONS = [
        { id: 'cozy', label: 'Cozy', emoji: '🕯️' },
        { id: 'playful', label: 'Playful', emoji: '🎈' },
        { id: 'fancy', label: 'Fancy', emoji: '🥂' },
        { id: 'low_key', label: 'Low-key', emoji: '🏡' },
    ];

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
            } catch (e) {
                if (cancelled) return;
                setPlansByStyle({});
                setPlanIdsByStyle({});
                setChecklistsByStyle({});
            } finally {
                if (cancelled) return;
                setIsLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [eventKey]);

    const generatePlan = useCallback(async () => {
        const requestSeq = ++requestSeqRef.current;
        if (!partnerId) {
            setError('Connect a partner to get personalized planning.');
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
            setError(err?.response?.data?.error || err?.message || 'Failed to generate a plan');
            // Preserve the last successful plan; show error without wiping content.
        } finally {
            if (requestSeq !== requestSeqRef.current) return;
            setIsLoading(false);
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
    }, [style, plansByStyle, generatePlan]);

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
                } catch (_e) {
                    // Best-effort; keep UI responsive even if save fails.
                }
            }, 500);

            return next;
        });
    };

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

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/35 backdrop-blur-sm z-[60] flex items-end justify-center p-4 pb-20"
            onClick={onClose}
        >
            <motion.div
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
                                        Plan {event.title}
                                    </h3>
                                </div>
                                <p className="text-xs text-neutral-500 mt-0.5 truncate">
                                    {eventDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} • for {partnerDisplayName || 'your partner'}
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
                                    {opt.label}
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
                                    <p className="font-bold text-red-700 text-sm">Couldn’t generate a plan</p>
                                    <p className="text-red-600 text-xs mt-1">{error}</p>
                                    <button
                                        onClick={generatePlan}
                                        className="mt-3 px-4 py-2 rounded-full bg-white text-red-700 border border-red-200 text-xs font-bold"
                                    >
                                        Try again
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : plan ? (
                        <>
                            {error && (
                                <div className="rounded-3xl p-3 bg-amber-50 border border-amber-100">
                                    <p className="text-[11px] font-bold text-amber-800">
                                        Planning hiccup — showing your last plan.
                                    </p>
                                    <p className="text-[11px] text-amber-700 mt-1">{error}</p>
                                </div>
                            )}

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
                                    <p className="text-sm font-extrabold text-neutral-800">Prep checklist</p>
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
                                                    <span className="ml-auto text-[10px] font-bold text-neutral-400">Optional</span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-3xl p-4 bg-white/70 border border-white/60 shadow-soft">
                                    <p className="text-sm font-extrabold text-neutral-800 mb-2">Little touches</p>
                                    <div className="space-y-2">
                                        {plan.littleTouches.slice(0, 4).map((t, idx) => (
                                            <div key={idx} className="flex gap-2">
                                                <span className="text-lg">{t.emoji}</span>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-neutral-800">{t.title}</p>
                                                    <p className="text-[11px] text-neutral-500 mt-0.5">{t.details}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="rounded-3xl p-4 bg-white/70 border border-white/60 shadow-soft">
                                    <p className="text-sm font-extrabold text-neutral-800 mb-2">Gift ideas</p>
                                    <div className="space-y-2">
                                        {plan.giftIdeas.slice(0, 4).map((g, idx) => (
                                            <div key={idx} className="flex gap-2">
                                                <span className="text-lg">{g.emoji}</span>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-neutral-800">{g.title}</p>
                                                    <p className="text-[11px] text-neutral-500 mt-0.5">{g.details}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-3xl p-4 bg-white/70 border border-white/60 shadow-soft">
                                <p className="text-sm font-extrabold text-neutral-800 mb-2">Alternatives</p>
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
                                    Backup plan
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
                        Generate a new plan
                    </button>
                    {meta?.rag?.memoriesUsed !== undefined && (
                        <p className="mt-2 text-[11px] text-neutral-400 text-center">
                            Personalized with {meta.rag.memoriesUsed} memory insight{meta.rag.memoriesUsed === 1 ? '' : 's'}.
                        </p>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
};

export default CalendarPage;
