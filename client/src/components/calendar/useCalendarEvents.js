import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import useAuthStore from '../../store/useAuthStore';
import api from '../../services/api';

const getDefaultHolidays = (year, t) => [
    { title: t('calendar.holidays.valentinesDay'), date: `${year}-02-14`, type: 'holiday', emoji: '💕', isRecurring: true, isDefault: true, isSecret: false },
    { title: t('calendar.holidays.internationalWomensDay'), date: `${year}-03-08`, type: 'holiday', emoji: '🌸', isRecurring: true, isDefault: true, isSecret: false },
    { title: t('calendar.holidays.mothersDay'), date: `${year}-05-11`, type: 'holiday', emoji: '💐', isRecurring: true, isDefault: true, isSecret: false },
    { title: t('calendar.holidays.fathersDay'), date: `${year}-06-15`, type: 'holiday', emoji: '👔', isRecurring: true, isDefault: true, isSecret: false },
    { title: t('calendar.holidays.halloween'), date: `${year}-10-31`, type: 'holiday', emoji: '🎃', isRecurring: true, isDefault: true, isSecret: false },
    { title: t('calendar.holidays.thanksgiving'), date: `${year}-11-27`, type: 'holiday', emoji: '🦃', isRecurring: true, isDefault: true, isSecret: false },
    { title: t('calendar.holidays.christmasEve'), date: `${year}-12-24`, type: 'holiday', emoji: '🎄', isRecurring: true, isDefault: true, isSecret: false },
    { title: t('calendar.holidays.christmasDay'), date: `${year}-12-25`, type: 'holiday', emoji: '🎅', isRecurring: true, isDefault: true, isSecret: false },
    { title: t('calendar.holidays.newYearsEve'), date: `${year}-12-31`, type: 'holiday', emoji: '🥂', isRecurring: true, isDefault: true, isSecret: false },
    { title: t('calendar.holidays.newYearsDay'), date: `${year + 1}-01-01`, type: 'holiday', emoji: '🎊', isRecurring: true, isDefault: true, isSecret: false },
];

const getEventKey = (event) => `${event?.title || ''}::${event?.date || ''}`;

const getPersonalEvents = (profile, connectedPartner, myId, partnerId, myDisplayName, partnerDisplayName, t) => {
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
        const displayName = user.display_name || user.name || t('common.user');

        // Add birthday events (from profile data if available)
        const birthday = user.birthday || user.birth_date;
        if (birthday) {
            const bday = new Date(birthday);
            // This year's birthday
            personalEvents.push({
                id: `birthday_${user.id}_${currentYear}`,
                title: t('calendar.birthdayFor', { name: displayName }),
                date: `${currentYear}-${String(bday.getMonth() + 1).padStart(2, '0')}-${String(bday.getDate()).padStart(2, '0')}`,
                type: 'birthday',
                emoji: '🎂',
                isPersonal: true,
                isSecret: false,
            });
            // Next year's birthday
            personalEvents.push({
                id: `birthday_${user.id}_${currentYear + 1}`,
                title: t('calendar.birthdayFor', { name: displayName }),
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
                title: t('calendar.anniversaryTitle'),
                date: `${currentYear}-${String(anniv.getMonth() + 1).padStart(2, '0')}-${String(anniv.getDate()).padStart(2, '0')}`,
                type: 'anniversary',
                emoji: '💕',
                isPersonal: true,
                isSecret: false,
            });
            personalEvents.push({
                id: `anniversary_${currentYear + 1}`,
                title: t('calendar.anniversaryTitle'),
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

/**
 * Custom hook for managing calendar events data and operations
 * @param {Object} t - Translation function from useI18n
 * @returns {Object} Calendar events state and operations
 */
export default function useCalendarEvents(t) {
    const { user: authUser, profile, partner: connectedPartner } = useAuthStore();
    const [events, setEvents] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const isMounted = useRef(true);
    const hasFetched = useRef(false);

    // Build stable user IDs (only change when actual IDs change)
    const myId = authUser?.id;
    const partnerId = connectedPartner?.id;

    // Memoize display names to prevent unnecessary recalculations
    const myDisplayName = useMemo(
        () => profile?.display_name || profile?.name || t('common.you'),
        [profile?.display_name, profile?.name, t]
    );
    const partnerDisplayName = useMemo(
        () => connectedPartner?.display_name || connectedPartner?.name || t('common.partner'),
        [connectedPartner?.display_name, connectedPartner?.name, t]
    );

    // Memoize profile data that matters for personal events (birthdays, anniversaries)
    const profileBirthday = profile?.birthday || profile?.birth_date;
    const profileAnniversary = profile?.anniversary_date || profile?.anniversaryDate;
    const partnerBirthday = connectedPartner?.birthday || connectedPartner?.birth_date;

    const fetchEvents = useCallback(async () => {
        if (!isMounted.current) return;

        try {
            setIsLoading(true);
            const response = await api.get('/calendar/events');

            if (!isMounted.current) return;

            const dbEvents = Array.isArray(response.data) ? response.data : [];

            const currentYear = new Date().getFullYear();
            const defaultEvents = [
                ...getDefaultHolidays(currentYear, t),
                ...getDefaultHolidays(currentYear + 1, t)
            ];

            const personalEvents = getPersonalEvents(
                profile,
                connectedPartner,
                myId,
                partnerId,
                myDisplayName,
                partnerDisplayName,
                t
            );

            const existingKeys = new Set(dbEvents.map(getEventKey));
            const newDefaults = defaultEvents.filter(d => !existingKeys.has(getEventKey(d)));

            if (isMounted.current) {
                setEvents([
                    ...dbEvents,
                    ...newDefaults.map(d => ({ ...d, id: `default_${d.title}` })),
                    ...personalEvents
                ]);
            }
        } catch (error) {
            console.error('Failed to fetch events:', error);
            if (!isMounted.current) return;

            const currentYear = new Date().getFullYear();
            const defaultEvents = getDefaultHolidays(currentYear, t);
            const personalEvents = getPersonalEvents(
                profile,
                connectedPartner,
                myId,
                partnerId,
                myDisplayName,
                partnerDisplayName,
                t
            );
            setEvents([
                ...defaultEvents.map(d => ({ ...d, id: `default_${d.title}` })),
                ...personalEvents
            ]);
        } finally {
            if (isMounted.current) {
                setIsLoading(false);
            }
        }
    // Use stable primitive dependencies instead of objects
    }, [myId, partnerId, profileBirthday, profileAnniversary, partnerBirthday, myDisplayName, partnerDisplayName, t]);

    // Fetch on mount and when key profile data changes
    useEffect(() => {
        isMounted.current = true;

        // Only fetch if we have a user ID
        if (myId) {
            fetchEvents();
            hasFetched.current = true;
        }

        return () => {
            isMounted.current = false;
        };
    }, [fetchEvents, myId]);

    const addEvent = useCallback(async (eventData) => {
        try {
            const response = await api.post('/calendar/events', {
                ...eventData
            });
            setEvents(prev => [...prev, response.data]);
            return { success: true, data: response.data };
        } catch (error) {
            console.error('Failed to add event:', error);
            return { success: false, error };
        }
    }, []);

    const deleteEvent = useCallback(async (eventId) => {
        try {
            await api.delete(`/calendar/events/${eventId}`);
            setEvents(prev => prev.filter(e => e.id !== eventId));
            return { success: true };
        } catch (error) {
            console.error('Failed to delete event:', error);
            return { success: false, error };
        }
    }, []);

    return {
        events,
        isLoading,
        addEvent,
        deleteEvent,
        refetchEvents: fetchEvents,
    };
}
