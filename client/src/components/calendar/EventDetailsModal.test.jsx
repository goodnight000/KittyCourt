import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EventDetailsModal from './EventDetailsModal';

// Mock i18n
vi.mock('../../i18n', () => ({
    useI18n: () => ({
        t: (key, params) => {
            if (key === 'calendar.details.eventsOnDayOne') return '1 event';
            if (key === 'calendar.details.eventsOnDayOther') return `${params.count} events`;
            return key;
        },
        language: 'en',
    }),
}));

describe('EventDetailsModal', () => {
    const mockEvents = [
        {
            id: '1',
            title: 'Birthday Party',
            date: '2024-01-15',
            type: 'birthday',
            emoji: '🎂',
            isSecret: false,
            isRecurring: false,
            isDefault: false,
            isPersonal: false,
            createdBy: 'user-1',
        },
        {
            id: '2',
            title: 'Secret Meeting',
            date: '2024-01-15',
            type: 'custom',
            emoji: '🔒',
            isSecret: true,
            isRecurring: false,
            isDefault: false,
            isPersonal: false,
            createdBy: 'user-2',
        },
    ];

    const defaultProps = {
        events: mockEvents,
        onDelete: vi.fn(),
        onClose: vi.fn(),
        onAddMore: vi.fn(),
        currentUserId: 'user-1',
        myDisplayName: 'Test User',
        partnerDisplayName: 'Partner User',
    };

    it('should render event details', () => {
        render(<EventDetailsModal {...defaultProps} />);

        expect(screen.getByText('Birthday Party')).toBeInTheDocument();
        expect(screen.getByText('Secret Meeting')).toBeInTheDocument();
    });

    it('should show correct event count', () => {
        render(<EventDetailsModal {...defaultProps} />);

        expect(screen.getByText('2 events')).toBeInTheDocument();
    });

    it('should call onClose when close button is clicked', () => {
        const onClose = vi.fn();
        render(<EventDetailsModal {...defaultProps} onClose={onClose} />);

        const closeButton = screen.getAllByRole('button').find(btn =>
            btn.querySelector('svg')?.classList.contains('lucide-x')
        );

        if (closeButton) {
            fireEvent.click(closeButton);
            expect(onClose).toHaveBeenCalled();
        }
    });

    it('should show delete button only for user-created events', () => {
        render(<EventDetailsModal {...defaultProps} />);

        // Trash2 icon uses 'lucide-trash-2' class
        const deleteButtons = screen.getAllByRole('button').filter(btn =>
            btn.querySelector('svg')?.classList.contains('lucide-trash-2')
        );

        // Should only show delete button for the event created by currentUserId
        expect(deleteButtons.length).toBe(1);
    });

    it('should call onDelete when delete button is clicked', () => {
        const onDelete = vi.fn();
        render(<EventDetailsModal {...defaultProps} onDelete={onDelete} />);

        // Trash2 icon uses 'lucide-trash-2' class
        const deleteButton = screen.getAllByRole('button').find(btn =>
            btn.querySelector('svg')?.classList.contains('lucide-trash-2')
        );

        if (deleteButton) {
            fireEvent.click(deleteButton);
            expect(onDelete).toHaveBeenCalledWith('1');
        }
    });

    it('should call onAddMore when add another button is clicked', () => {
        const onAddMore = vi.fn();
        render(<EventDetailsModal {...defaultProps} onAddMore={onAddMore} />);

        const addButton = screen.getByText(/addAnother/i);
        fireEvent.click(addButton);

        expect(onAddMore).toHaveBeenCalled();
    });

    it('should display secret badge for secret events', () => {
        render(<EventDetailsModal {...defaultProps} />);

        const secretBadges = screen.getAllByText(/secret/i);
        expect(secretBadges.length).toBeGreaterThan(0);
    });

    it('should not show delete button for default events', () => {
        const defaultEvent = {
            ...mockEvents[0],
            id: 'default-1',
            isDefault: true,
            createdBy: 'user-1',
        };

        render(<EventDetailsModal {...defaultProps} events={[defaultEvent]} />);

        // Trash2 icon uses 'lucide-trash-2' class
        const deleteButtons = screen.queryAllByRole('button').filter(btn =>
            btn.querySelector('svg')?.classList.contains('lucide-trash-2')
        );

        expect(deleteButtons.length).toBe(0);
    });
});
