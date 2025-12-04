import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
    ChevronLeft, ChevronRight, Plus, X, Check, Calendar,
    Heart, Cake, Star, Gift, PartyPopper, Sparkles, Trash2,
    Lightbulb, Wand2, Loader2, AlertTriangle
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
    { title: "Valentine's Day", date: `${year}-02-14`, type: 'holiday', emoji: '💕', isRecurring: true, isDefault: true },
    { title: "International Women's Day", date: `${year}-03-08`, type: 'holiday', emoji: '🌸', isRecurring: true, isDefault: true },
    { title: "Mother's Day", date: `${year}-05-11`, type: 'holiday', emoji: '💐', isRecurring: true, isDefault: true },
    { title: "Father's Day", date: `${year}-06-15`, type: 'holiday', emoji: '👔', isRecurring: true, isDefault: true },
    { title: "Halloween", date: `${year}-10-31`, type: 'holiday', emoji: '🎃', isRecurring: true, isDefault: true },
    { title: "Thanksgiving", date: `${year}-11-27`, type: 'holiday', emoji: '🦃', isRecurring: true, isDefault: true },
    { title: "Christmas Eve", date: `${year}-12-24`, type: 'holiday', emoji: '🎄', isRecurring: true, isDefault: true },
    { title: "Christmas Day", date: `${year}-12-25`, type: 'holiday', emoji: '🎅', isRecurring: true, isDefault: true },
    { title: "New Year's Eve", date: `${year}-12-31`, type: 'holiday', emoji: '🥂', isRecurring: true, isDefault: true },
    { title: "New Year's Day", date: `${year + 1}-01-01`, type: 'holiday', emoji: '🎊', isRecurring: true, isDefault: true },
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
                });
                // Next year's birthday
                personalEvents.push({
                    id: `birthday_${user.id}_${currentYear + 1}`,
                    title: `${displayName}'s Birthday`,
                    date: `${currentYear + 1}-${String(bday.getMonth() + 1).padStart(2, '0')}-${String(bday.getDate()).padStart(2, '0')}`,
                    type: 'birthday',
                    emoji: '🎂',
                    isPersonal: true,
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
                });
                personalEvents.push({
                    id: `anniversary_${currentYear + 1}`,
                    title: `Our Anniversary 💕`,
                    date: `${currentYear + 1}-${String(anniv.getMonth() + 1).padStart(2, '0')}-${String(anniv.getDate()).padStart(2, '0')}`,
                    type: 'anniversary',
                    emoji: '💕',
                    isPersonal: true,
                });
            }
        });
        
        return personalEvents;
    };

    const fetchEvents = async () => {
        try {
            const response = await api.get('/calendar/events');
            const dbEvents = response.data;
            
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
                ...eventData,
                createdBy: myId
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

    // Get upcoming events (next 7 days)
    const upcomingEvents = events
        .filter(event => {
            const eventDate = parseLocalDate(event.date);
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Start of today
            const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
            return eventDate >= today && eventDate <= weekFromNow;
        })
        .sort((a, b) => parseLocalDate(a.date) - parseLocalDate(b.date));

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
                                    ${hasEvents && !today ? 'bg-pink-50' : ''}
                                    ${!today && !hasEvents ? 'hover:bg-neutral-50' : ''}
                                `}
                                style={today ? { background: 'linear-gradient(135deg, #C9A227 0%, #8B7019 100%)' } : {}}
                            >
                                <span className={`text-sm font-bold ${today ? 'text-white' : ''}`}>
                                    {dayInfo.day}
                                </span>
                                {hasEvents && (
                                    <div className="flex gap-0.5 mt-0.5">
                                        {dayEvents.slice(0, 3).map((event, i) => (
                                            <span key={i} className="text-[8px]">{event.emoji}</span>
                                        ))}
                                    </div>
                                )}
                            </motion.button>
                        );
                    })}
                </div>
            </motion.div>

            {/* Upcoming Events */}
            <div className="space-y-3">
                <h3 className="text-sm font-bold text-neutral-600 flex items-center gap-2 px-1">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    Upcoming Events
                </h3>
                
                {upcomingEvents.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="glass-card p-6 text-center"
                    >
                        <motion.div
                            animate={{ y: [0, -5, 0] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="text-4xl mb-3"
                        >
                            📅
                        </motion.div>
                        <p className="text-neutral-600 text-sm font-medium">No upcoming events</p>
                        <p className="text-neutral-400 text-xs mt-1">Tap + to add a special date!</p>
                    </motion.div>
                ) : (
                    <div className="space-y-2">
                        {upcomingEvents.map((event, index) => (
                            <EventCard 
                                key={event.id} 
                                event={event} 
                                delay={index * 0.05}
                                onClick={() => setShowEventDetails([event])}
                                onPlanClick={(e) => {
                                    e.stopPropagation();
                                    setShowPlanningModal(event);
                                }}
                                showPlanButton={true}
                            />
                        ))}
                    </div>
                )}
            </div>

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
                        event={showPlanningModal}
                        partnerId={partnerId}
                        partnerDisplayName={partnerDisplayName}
                        myDisplayName={myDisplayName}
                        onClose={() => setShowPlanningModal(null)}
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

const EventCard = ({ event, delay, onClick, onPlanClick, showPlanButton }) => {
    const eventType = EVENT_TYPES.find(t => t.id === event.type) || EVENT_TYPES[4];
    // Parse date string as local date to prevent timezone shift
    const dateStr = event.date;
    const eventDate = dateStr?.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T00:00:00');
    const isToday = new Date().toDateString() === eventDate.toDateString();
    const isSoon = eventDate.getTime() - new Date().getTime() < 7 * 24 * 60 * 60 * 1000;
    
    const colorClasses = {
        pink: 'from-pink-50 to-pink-100/50 border-pink-200',
        red: 'from-red-50 to-red-100/50 border-red-200',
        amber: 'from-amber-50 to-amber-100/50 border-amber-200',
        violet: 'from-violet-50 to-violet-100/50 border-violet-200',
        blue: 'from-blue-50 to-blue-100/50 border-blue-200',
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className={`w-full glass-card p-4 bg-gradient-to-r ${colorClasses[eventType.color]} border`}
        >
            <div className="flex items-center gap-3">
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={onClick}
                    className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-2xl shadow-soft"
                >
                    {event.emoji}
                </motion.button>
                <div className="flex-1 min-w-0" onClick={onClick}>
                    <h4 className="font-bold text-neutral-800 text-sm truncate">{event.title}</h4>
                    <p className="text-neutral-500 text-xs">
                        {isToday ? '🎉 Today!' : eventDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                </div>
                {isToday && (
                    <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                        className="text-xl"
                    >
                        ✨
                    </motion.div>
                )}
            </div>
            
            {/* Plan Button - show for all upcoming events */}
            {showPlanButton && (
                <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={onPlanClick}
                    className={`w-full mt-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 ${
                        isSoon 
                            ? 'text-white shadow-md' 
                            : 'bg-white/80 text-court-brown border border-court-tan shadow-soft'
                    }`}
                    style={isSoon ? { background: 'linear-gradient(135deg, #C9A227 0%, #8B7019 100%)' } : {}}
                >
                    <Wand2 className="w-4 h-4" />
                    {isSoon ? 'Help Me Plan This! ✨' : 'Plan Ahead 📝'}
                </motion.button>
            )}
        </motion.div>
    );
};

const AddEventModal = ({ selectedDate, onAdd, onClose }) => {
    const [title, setTitle] = useState('');
    const [type, setType] = useState('custom');
    const [emoji, setEmoji] = useState('📅');
    
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
                                className={`px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-1.5 transition-all ${
                                    type === t.id
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
                        className={`w-full bg-neutral-50 border-2 rounded-xl p-3 text-neutral-700 focus:ring-2 focus:outline-none text-sm ${
                            dateError 
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
                                className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${
                                    emoji === e ? 'bg-violet-100 ring-2 ring-violet-400' : 'bg-neutral-50'
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
                    className={`w-full p-3 rounded-xl flex items-center justify-between transition-all ${
                        isRecurring ? 'bg-pink-50 ring-2 ring-pink-300' : 'bg-neutral-50'
                    }`}
                >
                    <span className="text-sm font-medium text-neutral-700">🔄 Repeat yearly</span>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                        isRecurring ? 'bg-pink-400' : 'bg-neutral-200'
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

// AI Planning Modal - uses RAG to get partner info and suggest ideas
const PlanningModal = ({ event, partnerId, partnerDisplayName, myDisplayName, onClose }) => {
    const [suggestions, setSuggestions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        generateSuggestions();
    }, []);

    const generateSuggestions = async () => {
        setIsLoading(true);
        setError(null);
        
        try {
            // Try to get partner profile info from localStorage
            const partnerProfileKey = `catjudge_profile_${partnerId}`;
            const partnerProfile = localStorage.getItem(partnerProfileKey);
            const parsedProfile = partnerProfile ? JSON.parse(partnerProfile) : {};
            
            // Get appreciation history for context
            let appreciations = [];
            try {
                const appreciationRes = await api.get(`/appreciations/${partnerId}`);
                appreciations = appreciationRes.data.slice(0, 5); // Last 5 appreciations
            } catch (e) {
                console.log('Could not fetch appreciations');
            }

            // Build context about the partner
            const partnerContext = {
                name: partnerDisplayName || 'your partner',
                loveLanguage: parsedProfile.loveLanguage || 'unknown',
                nickname: parsedProfile.nickname || partnerDisplayName,
                recentAppreciations: appreciations.map(a => a.message),
            };

            // Call the AI planning endpoint
            const response = await api.post('/calendar/plan-event', {
                eventTitle: event.title,
                eventType: event.type,
                eventDate: event.date,
                partnerContext,
                currentUserName: myDisplayName,
            });

            setSuggestions(response.data.suggestions || []);
        } catch (err) {
            console.error('Failed to generate suggestions:', err);
            // Fallback to local suggestions if API fails
            setSuggestions(getLocalSuggestions(event, partnerDisplayName));
        } finally {
            setIsLoading(false);
        }
    };

    // Fallback local suggestions based on event type
    const getLocalSuggestions = (event, partnerName) => {
        const name = partnerName || 'your partner';
        const eventType = event.type || 'holiday';
        
        const suggestions = {
            birthday: [
                { emoji: '🎂', title: 'Bake a Homemade Cake', description: `Surprise ${name} with their favorite cake flavor` },
                { emoji: '📝', title: 'Love Letter Box', description: 'Write 10 reasons why you love them, one for each year' },
                { emoji: '🎁', title: 'Experience Gift', description: 'Plan a surprise adventure - escape room, pottery class, or cooking lesson' },
            ],
            anniversary: [
                { emoji: '💕', title: 'Memory Lane Date', description: 'Revisit your first date spot or recreate your first meal together' },
                { emoji: '📷', title: 'Photo Book', description: 'Create a photo album of your favorite moments this year' },
                { emoji: '✉️', title: 'Future Letter', description: 'Write letters to open on your next anniversary' },
            ],
            holiday: [
                { emoji: '🌟', title: 'Cozy Night In', description: `Set up a movie marathon with ${name}'s favorite snacks` },
                { emoji: '🎄', title: 'DIY Gift Exchange', description: 'Make handmade gifts for each other with a budget limit' },
                { emoji: '🍳', title: 'Cook Together', description: 'Try a new recipe together - make it a fun cooking date' },
            ],
            date_night: [
                { emoji: '🌙', title: 'Stargazing Picnic', description: 'Pack blankets and snacks for a romantic evening under the stars' },
                { emoji: '🎮', title: 'Game Night', description: 'Play your favorite board games or video games together' },
                { emoji: '💆', title: 'Spa Night', description: 'Set up a home spa with face masks, massages, and relaxation' },
            ],
            custom: [
                { emoji: '💐', title: 'Surprise Flowers', description: `Get ${name}'s favorite flowers delivered` },
                { emoji: '🍽️', title: 'Fancy Dinner', description: 'Cook an elaborate meal or book their favorite restaurant' },
                { emoji: '🎵', title: 'Playlist Gift', description: 'Create a playlist of songs that remind you of them' },
            ],
        };

        return suggestions[eventType] || suggestions.custom;
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
                    <div className="flex items-center gap-2">
                        <Wand2 className="w-5 h-5 text-violet-500" />
                        <h3 className="font-bold text-neutral-800 text-lg">Plan {event.title}</h3>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 bg-neutral-100 rounded-full flex items-center justify-center">
                        <X className="w-4 h-4 text-neutral-500" />
                    </button>
                </div>

                <p className="text-neutral-500 text-sm">
                    ✨ Here are some ideas to make this day special for {partnerDisplayName || 'your partner'}!
                </p>

                {isLoading ? (
                    <div className="py-8 text-center">
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-10 h-10 mx-auto mb-3"
                        >
                            <Loader2 className="w-10 h-10 text-violet-400" />
                        </motion.div>
                        <p className="text-neutral-500 text-sm">Thinking of ideas...</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {suggestions.map((suggestion, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="glass-card p-4 bg-gradient-to-r from-violet-50/50 to-pink-50/50"
                            >
                                <div className="flex items-start gap-3">
                                    <span className="text-2xl">{suggestion.emoji}</span>
                                    <div>
                                        <h4 className="font-bold text-neutral-800 text-sm">{suggestion.title}</h4>
                                        <p className="text-neutral-500 text-xs mt-1">{suggestion.description}</p>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}

                <button
                    onClick={generateSuggestions}
                    disabled={isLoading}
                    className="w-full py-3 bg-neutral-100 text-neutral-600 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                >
                    <Sparkles className="w-4 h-4" />
                    Get New Ideas
                </button>
            </motion.div>
        </motion.div>
    );
};

export default CalendarPage;
