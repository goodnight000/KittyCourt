import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import useCalendarEvents from './useCalendarEvents';
import api from '../../services/api';

// Mock dependencies
vi.mock('../../services/api');
vi.mock('../../store/useCacheStore', () => {
    const getCached = vi.fn(() => null);
    const setCache = vi.fn();
    return {
        default: {
            getState: () => ({
                getCached,
                setCache,
            }),
        },
        CACHE_KEYS: { CALENDAR_EVENTS: 'calendar:events' },
        CACHE_TTL: { CALENDAR_EVENTS: 10 * 60 * 1000 },
    };
});
vi.mock('../../store/useAuthStore', () => ({
    default: vi.fn(() => ({
        user: { id: 'user-1' },
        profile: { display_name: 'Test User', id: 'user-1' },
    })),
}));
vi.mock('../../store/usePartnerStore', () => ({
    default: vi.fn(() => ({
        partner: { display_name: 'Partner User', id: 'user-2' },
    })),
}));

describe('useCalendarEvents', () => {
    const mockT = vi.fn((key, params) => {
        if (key === 'common.you') return 'You';
        if (key === 'common.partner') return 'Partner';
        if (key === 'calendar.birthdayFor') return `Birthday: ${params.name}`;
        if (key === 'calendar.anniversaryTitle') return 'Anniversary';
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

        const { result } = renderHook(() => useCalendarEvents(mockT));

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

        const { result } = renderHook(() => useCalendarEvents(mockT));

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

        const { result } = renderHook(() => useCalendarEvents(mockT));

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        const deleteResult = await result.current.deleteEvent('event-1');

        expect(deleteResult.success).toBe(true);
        expect(api.delete).toHaveBeenCalledWith('/calendar/events/event-1');
    });

    it('should handle fetch errors gracefully', async () => {
        api.get.mockRejectedValueOnce(new Error('Network error'));

        const { result } = renderHook(() => useCalendarEvents(mockT));

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        // Should still have default events even on error
        expect(result.current.events.length).toBeGreaterThan(0);
    });
});
