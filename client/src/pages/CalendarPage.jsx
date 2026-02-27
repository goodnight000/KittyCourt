import React, { lazy, Suspense, useEffect, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Loader2, Plus } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import useAuthStore from '../store/useAuthStore';
import usePartnerStore from '../store/usePartnerStore';
import useSubscriptionStore from '../store/useSubscriptionStore';
import Paywall from '../components/Paywall';
import { useI18n } from '../i18n';
import { parseLocalDate } from '../utils/dateFormatters';
import useUiPerfProfile from '../hooks/useUiPerfProfile';
import { isNativeIOS } from '../utils/platform';

// Calendar components
import useCalendarEvents from '../components/calendar/useCalendarEvents';
import CalendarGrid from '../components/calendar/CalendarGrid';

const EventForm = lazy(() => import('../components/calendar/EventForm'));
const EventDetailsModal = lazy(() => import('../components/calendar/EventDetailsModal'));
const EventPlanningDialog = lazy(() => import('../components/calendar/EventPlanningDialog'));
const UpcomingEvents = lazy(() => import('../components/calendar/UpcomingEvents'));

const CalendarPage = () => {
    const currentUser = useAppStore((state) => state.currentUser);
    const authUser = useAuthStore((state) => state.user);
    const profile = useAuthStore((state) => state.profile);
    const connectedPartner = usePartnerStore((state) => state.partner);
    const canUsePlanFeature = useSubscriptionStore((state) => state.canUsePlanFeature);
    const { t, language } = useI18n();
    const { profile: uiPerfProfile, prefersReducedMotion } = useUiPerfProfile();
    const iosNative = isNativeIOS();
    const [deferHeavyCalendarUi, setDeferHeavyCalendarUi] = useState(iosNative && uiPerfProfile === 'full');
    const performanceMode = prefersReducedMotion || uiPerfProfile !== 'full' || deferHeavyCalendarUi;

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
    const [isAddingEvent, setIsAddingEvent] = useState(false);
    const [showUpcomingSection, setShowUpcomingSection] = useState(!performanceMode);

    useEffect(() => {
        if (!(iosNative && uiPerfProfile === 'full')) {
            setDeferHeavyCalendarUi(false);
            return;
        }
        setDeferHeavyCalendarUi(true);
        const timerId = setTimeout(() => {
            setDeferHeavyCalendarUi(false);
        }, 420);
        return () => clearTimeout(timerId);
    }, [iosNative, uiPerfProfile]);

    useEffect(() => {
        if (!performanceMode) {
            setShowUpcomingSection(true);
            return undefined;
        }
        setShowUpcomingSection(false);
        let timerId = null;
        const frameId = requestAnimationFrame(() => {
            timerId = setTimeout(() => {
                setShowUpcomingSection(true);
            }, 220);
        });
        return () => {
            cancelAnimationFrame(frameId);
            if (timerId) {
                clearTimeout(timerId);
            }
        };
    }, [performanceMode]);

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
        if (isAddingEvent) return;
        setIsAddingEvent(true);
        try {
            const result = await addEvent(eventData);
            if (result.success) {
                setShowAddModal(false);
            }
        } finally {
            setIsAddingEvent(false);
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
        <div className={`space-y-5 pb-6 ${performanceMode ? 'calendar-lite' : ''}`} data-calendar-lite={performanceMode ? 'true' : 'false'}>
            {/* Header */}
            <header className="flex items-center gap-3">
                <div className="flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-600">
                        {t('calendar.subtitle')}
                    </p>
                    <h1 className="text-2xl font-display font-bold text-neutral-800">{t('calendar.title')}</h1>
                </div>
                <Motion.button
                    whileTap={performanceMode ? undefined : { scale: 0.97 }}
                    onClick={() => {
                        setSelectedDate(new Date());
                        setShowAddModal(true);
                    }}
                    disabled={isLoading}
                    className="relative grid h-11 w-11 place-items-center rounded-2xl border border-white/80 bg-white/80 shadow-soft"
                    aria-label={t('calendar.addEventAria')}
                >
                    <Plus className={`w-5 h-5 text-neutral-600 transition-opacity ${isLoading ? 'opacity-60' : 'opacity-100'}`} />
                    {isLoading && (
                        <div className="absolute inset-0 grid place-items-center">
                            <Loader2 className="w-5 h-5 text-court-brown animate-spin" />
                        </div>
                    )}
                </Motion.button>
            </header>

            {/* Calendar Grid */}
            <CalendarGrid
                currentDate={currentDate}
                events={events}
                selectedDate={selectedDate}
                onDateSelect={handleDateSelect}
                onMonthNavigate={handleMonthNavigate}
                performanceMode={performanceMode}
            />

            {/* Upcoming Events */}
            {showUpcomingSection ? (
                <Suspense fallback={
                    <div className="rounded-3xl border border-neutral-200 bg-white/92 p-4 shadow-soft">
                        <div className="h-3.5 w-28 rounded bg-neutral-200/70 mb-3" />
                        <div className="h-3 w-40 rounded bg-neutral-200/60 mb-4" />
                        <div className="h-24 rounded-2xl bg-neutral-100/85 border border-neutral-200/80" />
                    </div>
                }>
                    <UpcomingEvents
                        events={events}
                        partnerId={partnerId}
                        onEventClick={handleEventClick}
                        onPlanClick={handlePlanClick}
                        performanceMode={performanceMode}
                    />
                </Suspense>
            ) : (
                <div className="rounded-3xl border border-neutral-200 bg-white/92 p-4 shadow-soft">
                    <div className="h-3.5 w-28 rounded bg-neutral-200/70 mb-3" />
                    <div className="h-3 w-40 rounded bg-neutral-200/60 mb-4" />
                    <div className="h-24 rounded-2xl bg-neutral-100/85 border border-neutral-200/80" />
                </div>
            )}

            {/* Add Event Modal */}
            <AnimatePresence>
                {showAddModal && (
                    <Suspense fallback={null}>
                        <EventForm
                            selectedDate={selectedDate}
                            onAdd={handleAddEvent}
                            isSubmitting={isAddingEvent}
                            onClose={() => setShowAddModal(false)}
                        />
                    </Suspense>
                )}
            </AnimatePresence>

            {/* AI Planning Modal */}
            <AnimatePresence>
                {showPlanningModal && (
                    <Suspense fallback={null}>
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
                    </Suspense>
                )}
            </AnimatePresence>

            {/* Event Details Modal */}
            <AnimatePresence>
                {showEventDetails && (
                    <Suspense fallback={null}>
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
                    </Suspense>
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
