import React, { useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import useAuthStore from '../store/useAuthStore';
import usePartnerStore from '../store/usePartnerStore';
import useSubscriptionStore from '../store/useSubscriptionStore';
import Paywall from '../components/Paywall';
import { useI18n } from '../i18n';
import { parseLocalDate } from '../utils/dateFormatters';

// Calendar components
import useCalendarEvents from '../components/calendar/useCalendarEvents';
import CalendarGrid from '../components/calendar/CalendarGrid';
import UpcomingEvents from '../components/calendar/UpcomingEvents';
import EventForm from '../components/calendar/EventForm';
import EventDetailsModal from '../components/calendar/EventDetailsModal';
import EventPlanningDialog from '../components/calendar/EventPlanningDialog';

const CalendarPage = () => {
    const { currentUser } = useAppStore();
    const { user: authUser, profile } = useAuthStore();
    const { partner: connectedPartner } = usePartnerStore();
    const { canUsePlanFeature, isGold } = useSubscriptionStore();
    const { t, language } = useI18n();

    // Build users from auth store
    const myId = authUser?.id || currentUser?.id;
    const myDisplayName = profile?.display_name || profile?.name || t('common.you');
    const partnerId = connectedPartner?.id;
    const partnerDisplayName = connectedPartner?.display_name || connectedPartner?.name || t('common.partner');

    // Calendar data hook
    const { events, isLoading, addEvent, deleteEvent } = useCalendarEvents(t, language);

    // Local UI state
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEventDetails, setShowEventDetails] = useState(null);
    const [showPlanningModal, setShowPlanningModal] = useState(null);
    const [showPaywall, setShowPaywall] = useState(false);

    const handleMonthNavigate = (direction) => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));
    };

    const handleDateSelect = (date, dayEvents) => {
        setSelectedDate(date);
        if (dayEvents.length > 0) {
            setShowEventDetails(dayEvents);
        } else {
            setShowAddModal(true);
        }
    };

    const handleAddEvent = async (eventData) => {
        const result = await addEvent(eventData);
        if (result.success) {
            setShowAddModal(false);
        }
    };

    const handleDeleteEvent = async (eventId) => {
        const result = await deleteEvent(eventId);
        if (result.success) {
            setShowEventDetails(null);
        }
    };

    const handleEventClick = (event) => {
        setShowEventDetails([event]);
    };

    const handlePlanClick = (event, eventKey, onSavedCallback) => {
        // Check subscription before showing planning modal
        const { allowed } = canUsePlanFeature();
        if (!allowed) {
            setShowPaywall(true);
            return;
        }
        setShowPlanningModal({ event, eventKey, onSavedCallback });
    };

    return (
        <div className="space-y-5 pb-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <img
                    src="/assets/icons/calendar.png"
                    alt={t('calendar.iconAlt')}
                    className="w-12 h-12 object-contain drop-shadow-sm"
                    draggable={false}
                />
                <div className="flex-1">
                    <h1 className="text-xl font-bold text-gradient">{t('calendar.title')}</h1>
                    <p className="text-neutral-500 text-sm">{t('calendar.subtitle')}</p>
                </div>
                <Motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                        setSelectedDate(new Date());
                        setShowAddModal(true);
                    }}
                    disabled={isLoading}
                    className="w-12 h-12 relative"
                    aria-label={t('calendar.addEventAria')}
                >
                    <img
                        src="/assets/icons/plus.png"
                        alt=""
                        className={`w-12 h-12 object-contain drop-shadow-sm transition-opacity ${isLoading ? 'opacity-60' : 'opacity-100'}`}
                        draggable={false}
                    />
                    {isLoading && (
                        <div className="absolute inset-0 grid place-items-center">
                            <Loader2 className="w-5 h-5 text-court-brown animate-spin" />
                        </div>
                    )}
                </Motion.button>
            </div>

            {/* Calendar Grid */}
            <CalendarGrid
                currentDate={currentDate}
                events={events}
                selectedDate={selectedDate}
                onDateSelect={handleDateSelect}
                onMonthNavigate={handleMonthNavigate}
            />

            {/* Upcoming Events */}
            <UpcomingEvents
                events={events}
                partnerId={partnerId}
                isGold={isGold}
                onEventClick={handleEventClick}
                onPlanClick={handlePlanClick}
            />

            {/* Add Event Modal */}
            <AnimatePresence>
                {showAddModal && (
                    <EventForm
                        selectedDate={selectedDate}
                        onAdd={handleAddEvent}
                        onClose={() => setShowAddModal(false)}
                    />
                )}
            </AnimatePresence>

            {/* AI Planning Modal */}
            <AnimatePresence>
                {showPlanningModal && (
                    <EventPlanningDialog
                        event={showPlanningModal.event}
                        eventKey={showPlanningModal.eventKey}
                        myId={myId}
                        partnerId={partnerId}
                        partnerDisplayName={partnerDisplayName}
                        myDisplayName={myDisplayName}
                        onClose={() => setShowPlanningModal(null)}
                        onSaved={() => {
                            if (showPlanningModal?.onSavedCallback) {
                                showPlanningModal.onSavedCallback(showPlanningModal.eventKey);
                            }
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Event Details Modal */}
            <AnimatePresence>
                {showEventDetails && (
                    <EventDetailsModal
                        events={showEventDetails}
                        onDelete={handleDeleteEvent}
                        onClose={() => setShowEventDetails(null)}
                        onAddMore={() => {
                            const parsed = parseLocalDate(showEventDetails[0].date);
                            setSelectedDate(parsed || new Date());
                            setShowEventDetails(null);
                            setShowAddModal(true);
                        }}
                        onPlanClick={(event, eventKey, onSavedCallback) => {
                            setShowEventDetails(null);
                            handlePlanClick(event, eventKey, onSavedCallback);
                        }}
                        partnerId={partnerId}
                        currentUserId={myId}
                        myDisplayName={myDisplayName}
                        partnerDisplayName={partnerDisplayName}
                    />
                )}
            </AnimatePresence>

            {/* Paywall Modal */}
            <Paywall
                isOpen={showPaywall}
                onClose={() => setShowPaywall(false)}
                triggerReason={t('calendar.paywall.planFeature')}
            />
        </div>
    );
};

export default CalendarPage;
