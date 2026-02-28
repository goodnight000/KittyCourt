import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import useCalendarEvents from './useCalendarEvents';
import api from '../../services/api';

// Mock dependencies
vi.mock('../../services/api');
vi.mock('../../store/useCacheStore', () => {
    const getOrFetch = vi.fn(async ({ fetcher }) => ({ data: await fetcher(), promise: null }));
    const fetchAndCache = vi.fn(async () => []);
    const setCache = vi.fn();
    const getCached = vi.fn(() => undefined);
    return {
        default: {
            getState: () => ({
                getOrFetch,
                fetchAndCache,
                setCache,
                getCached,
                subscribeKey: vi.fn(() => vi.fn()),
            }),
        },
        CACHE_POLICY: { CALENDAR_EVENTS: { ttlMs: 10 * 60 * 1000, staleMs: 2 * 60 * 1000 } },
        cacheKey: { calendarEvents: vi.fn(() => 'calendar:events:user') },
    };
});
vi.mock('../../store/useAuthStore', () => {
    const state = {
        user: { id: 'user-1' },
        profile: { display_name: 'Test User', id: 'user-1' },
    };
    return {
        default: vi.fn((selector) => (typeof selector === 'function' ? selector(state) : state)),
    };
});
vi.mock('../../store/usePartnerStore', () => {
    const state = {
        partner: { display_name: 'Partner User', id: 'user-2' },
    };
    return {
        default: vi.fn((selector) => (typeof selector === 'function' ? selector(state) : state)),
    };
});

describe('useCalendarEvents', () => {
    const mockT = vi.fn((key, params) => {
        if (key === 'common.you') return 'You';
        if (key === 'common.partner') return 'Partner';
        if (key === 'calendar.birthdayFor') return `Birthday: ${params.name}`;
        if (key === 'calendar.anniversaryTitle') return 'Anniversary';
        if (key === 'calendar.holidays.springFestival') return 'Chinese New Year';
        if (key === 'calendar.holidays.qixi') return 'Qixi Festival';
        if (key === 'calendar.holidays.midAutumn') return 'Mid-Autumn Festival';
        if (key === 'calendar.holidays.520') return '520 Love Day';
        return key;
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should fetch events on mount', async () => {
        const mockEvents = [
            {
                id: '1',
                title: 'Test Event',
                date: '2024-01-15',
                type: 'custom',
                emoji: '📅',
            },
        ];

        api.get.mockResolvedValueOnce({ data: mockEvents });

        const { result } = renderHook(() => useCalendarEvents(mockT, 'en'));

        expect(result.current.isLoading).toBe(true);

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(api.get).toHaveBeenCalledWith('/calendar/events');
        expect(result.current.events.length).toBeGreaterThan(0);
    });

    it('should add event successfully', async () => {
        api.get.mockResolvedValueOnce({ data: [] });
        const newEvent = {
            id: '2',
            title: 'New Event',
            date: '2024-02-01',
            type: 'birthday',
            emoji: '🎂',
        };
        api.post.mockResolvedValueOnce({ data: newEvent });

        const { result } = renderHook(() => useCalendarEvents(mockT, 'en'));

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        const addResult = await result.current.addEvent({
            title: 'New Event',
            date: '2024-02-01',
            type: 'birthday',
        });

        expect(addResult.success).toBe(true);
        expect(api.post).toHaveBeenCalledWith('/calendar/events', expect.any(Object));
    });

    it('should delete event successfully', async () => {
        api.get.mockResolvedValueOnce({ data: [] });
        api.delete.mockResolvedValueOnce({});

        const { result } = renderHook(() => useCalendarEvents(mockT, 'en'));

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        const deleteResult = await result.current.deleteEvent('event-1');

        expect(deleteResult.success).toBe(true);
        expect(api.delete).toHaveBeenCalledWith('/calendar/events/event-1');
    });

    it('should handle fetch errors gracefully', async () => {
        api.get.mockRejectedValueOnce(new Error('Network error'));

        const { result } = renderHook(() => useCalendarEvents(mockT, 'en'));

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        // Should still have default events even on error
        expect(result.current.events.length).toBeGreaterThan(0);
    });

    it('should include Chinese holidays when language is zh-Hans', async () => {
        api.get.mockResolvedValueOnce({ data: [] });

        const { result } = renderHook(() => useCalendarEvents(mockT, 'zh-Hans'));

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        // Should include Chinese holidays
        const eventTitles = result.current.events.map(e => e.title);
        expect(eventTitles).toContain('520 Love Day');
    });

    it('should NOT include Chinese holidays when language is en', async () => {
        api.get.mockResolvedValueOnce({ data: [] });

        const { result } = renderHook(() => useCalendarEvents(mockT, 'en'));

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        // Should NOT include Chinese holidays
        const eventTitles = result.current.events.map(e => e.title);
        expect(eventTitles).not.toContain('520 Love Day');
        expect(eventTitles).not.toContain('Chinese New Year');
    });
});
