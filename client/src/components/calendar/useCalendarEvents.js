import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import useAuthStore from '../../store/useAuthStore';
import usePartnerStore from '../../store/usePartnerStore';
import useCacheStore, { CACHE_KEYS, CACHE_TTL } from '../../store/useCacheStore';
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

// Lunar calendar holiday dates by year (these shift annually)
const LUNAR_DATES = {
    2025: { springFestival: '01-29', lanternFestival: '02-12', qixi: '08-29', midAutumn: '10-06' },
    2026: { springFestival: '02-17', lanternFestival: '03-03', qixi: '08-19', midAutumn: '09-25' },
    2027: { springFestival: '02-06', lanternFestival: '02-20', qixi: '08-08', midAutumn: '09-15' },
};

const getLunarHolidays = (year, t) => {
    const dates = LUNAR_DATES[year];
    if (!dates) return [];

    return [
        { title: t('calendar.holidays.springFestival'), date: `${year}-${dates.springFestival}`, type: 'holiday', emoji: '🧧', isRecurring: false, isDefault: true, isSecret: false },
        { title: t('calendar.holidays.lanternFestival'), date: `${year}-${dates.lanternFestival}`, type: 'holiday', emoji: '🏮', isRecurring: false, isDefault: true, isSecret: false },
        { title: t('calendar.holidays.qixi'), date: `${year}-${dates.qixi}`, type: 'holiday', emoji: '💑', isRecurring: false, isDefault: true, isSecret: false },
        { title: t('calendar.holidays.midAutumn'), date: `${year}-${dates.midAutumn}`, type: 'holiday', emoji: '🥮', isRecurring: false, isDefault: true, isSecret: false },
    ];
};

const getChineseHolidays = (year, t) => [
    // Fixed Gregorian date holidays
    { title: t('calendar.holidays.520'), date: `${year}-05-20`, type: 'holiday', emoji: '💕', isRecurring: true, isDefault: true, isSecret: false },
    { title: t('calendar.holidays.nationalDay'), date: `${year}-10-01`, type: 'holiday', emoji: '🇨🇳', isRecurring: true, isDefault: true, isSecret: false },
    { title: t('calendar.holidays.doubleEleven'), date: `${year}-11-11`, type: 'holiday', emoji: '🛒', isRecurring: true, isDefault: true, isSecret: false },
    // Lunar calendar holidays
    ...getLunarHolidays(year, t),
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
 * @param {Function} t - Translation function from useI18n
 * @param {string} language - Current language code (e.g., 'en', 'zh-Hans')
 * @returns {Object} Calendar events state and operations
 */
export default function useCalendarEvents(t, language = 'en') {
    const { user: authUser, profile } = useAuthStore();
    const { partner: connectedPartner } = usePartnerStore();
    const [dbEvents, setDbEvents] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const isMounted = useRef(true);
    const fetchTimerRef = useRef(null);

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

    const cacheKey = useMemo(() => {
        if (!myId) return null;
        return `${CACHE_KEYS.CALENDAR_EVENTS}:${myId}:${partnerId || 'solo'}`;
    }, [myId, partnerId]);

    const currentYear = new Date().getFullYear();
    const defaultEvents = useMemo(() => {
        const baseHolidays = [
            ...getDefaultHolidays(currentYear, t),
            ...getDefaultHolidays(currentYear + 1, t)
        ];

        // Add Chinese holidays only for Chinese language users
        if (language === 'zh-Hans') {
            baseHolidays.push(
                ...getChineseHolidays(currentYear, t),
                ...getChineseHolidays(currentYear + 1, t)
            );
        }

        return baseHolidays;
    }, [currentYear, t, language]);

    const personalEvents = useMemo(() => getPersonalEvents(
        profile,
        connectedPartner,
        myId,
        partnerId,
        myDisplayName,
        partnerDisplayName,
        t
    ), [profile, connectedPartner, myId, partnerId, myDisplayName, partnerDisplayName, t]);

    const events = useMemo(() => {
        const existingKeys = new Set(dbEvents.map(getEventKey));
        const newDefaults = defaultEvents.filter(d => !existingKeys.has(getEventKey(d)));

        return [
            ...dbEvents,
            ...newDefaults.map(d => ({ ...d, id: `default_${d.title}` })),
            ...personalEvents
        ];
    }, [dbEvents, defaultEvents, personalEvents]);

    const fetchEvents = useCallback(async ({ force = false } = {}) => {
        if (!isMounted.current) return;
        if (!myId) {
            setDbEvents([]);
            setIsLoading(false);
            return;
        }

        const shouldLog = import.meta.env.DEV
            && typeof window !== 'undefined'
            && window.__navDebugTarget === '/calendar';

        if (!force && cacheKey) {
            const cached = useCacheStore.getState().getCached(cacheKey);
            if (cached !== null) {
                if (shouldLog) {
                    console.log('[calendar] cache hit for events');
                }
                setDbEvents(Array.isArray(cached) ? cached : []);
                setIsLoading(false);
                return;
            }
        }

        try {
            setIsLoading(true);
            if (shouldLog) {
                const label = `[calendar] fetch events ${Date.now()}`;
                fetchTimerRef.current = label;
                console.time(label);
            }
            const response = await api.get('/calendar/events');

            if (!isMounted.current) return;

            const nextDbEvents = Array.isArray(response.data) ? response.data : [];
            if (isMounted.current) {
                setDbEvents(nextDbEvents);
                if (cacheKey) {
                    useCacheStore.getState().setCache(cacheKey, nextDbEvents, CACHE_TTL.CALENDAR_EVENTS);
                }
            }
        } catch (error) {
            console.error('Failed to fetch events:', error);
            if (!isMounted.current) return;
            setDbEvents((prev) => prev.length ? prev : []);
        } finally {
            if (shouldLog && fetchTimerRef.current) {
                console.timeEnd(fetchTimerRef.current);
                fetchTimerRef.current = null;
            }
            if (isMounted.current) {
                setIsLoading(false);
            }
        }
    }, [cacheKey, myId]);

    // Fetch on mount and when identity changes
    useEffect(() => {
        isMounted.current = true;

        // Only fetch if we have a user ID
        if (myId) {
            fetchEvents();
        } else {
            setIsLoading(false);
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
            setDbEvents((prev) => {
                const next = [...prev, response.data];
                if (cacheKey) {
                    useCacheStore.getState().setCache(cacheKey, next, CACHE_TTL.CALENDAR_EVENTS);
                }
                return next;
            });
            return { success: true, data: response.data };
        } catch (error) {
            console.error('Failed to add event:', error);
            return { success: false, error };
        }
    }, [cacheKey]);

    const deleteEvent = useCallback(async (eventId) => {
        try {
            await api.delete(`/calendar/events/${eventId}`);
            setDbEvents((prev) => {
                const next = prev.filter(e => e.id !== eventId);
                if (cacheKey) {
                    useCacheStore.getState().setCache(cacheKey, next, CACHE_TTL.CALENDAR_EVENTS);
                }
                return next;
            });
            return { success: true };
        } catch (error) {
            console.error('Failed to delete event:', error);
            return { success: false, error };
        }
    }, [cacheKey]);

    return {
        events,
        isLoading,
        addEvent,
        deleteEvent,
        refetchEvents: fetchEvents,
    };
}
