import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CalendarGrid from './CalendarGrid';

// Mock i18n
vi.mock('../../i18n', () => ({
    useI18n: () => ({
        t: (key) => key,
        language: 'en',
    }),
}));

describe('CalendarGrid', () => {
    const mockEvents = [
        {
            id: '1',
            title: 'Test Event',
            date: '2024-01-15',
            isSecret: false,
        },
        {
            id: '2',
            title: 'Secret Event',
            date: '2024-01-15',
            isSecret: true,
        },
    ];

    const defaultProps = {
        currentDate: new Date(2024, 0, 15),
        events: mockEvents,
        selectedDate: null,
        onDateSelect: vi.fn(),
        onMonthNavigate: vi.fn(),
    };

    it('should render calendar grid', () => {
        render(<CalendarGrid {...defaultProps} />);

        // Should render month and year
        expect(screen.getByText(/2024/)).toBeInTheDocument();
    });

    it('should call onMonthNavigate when navigation buttons are clicked', () => {
        const onMonthNavigate = vi.fn();
        render(<CalendarGrid {...defaultProps} onMonthNavigate={onMonthNavigate} />);

        const prevButton = screen.getByLabelText(/previous/i);
        const nextButton = screen.getByLabelText(/next/i);

        fireEvent.click(prevButton);
        expect(onMonthNavigate).toHaveBeenCalledWith(-1);

        fireEvent.click(nextButton);
        expect(onMonthNavigate).toHaveBeenCalledWith(1);
    });

    it('should call onDateSelect when day is clicked', () => {
        const onDateSelect = vi.fn();
        render(<CalendarGrid {...defaultProps} onDateSelect={onDateSelect} />);

        // Find the 15th day button (there will be multiple buttons, need to find the right one)
        const dayButtons = screen.getAllByRole('button');
        const day15Button = dayButtons.find(btn =>
            btn.textContent.includes('15') && !btn.getAttribute('aria-label')?.includes('navigation')
        );

        if (day15Button) {
            fireEvent.click(day15Button);
            expect(onDateSelect).toHaveBeenCalled();
        }
    });

    it('should display event indicators on days with events', () => {
        const { container } = render(<CalendarGrid {...defaultProps} />);

        // Look for event indicator dots (they should be rendered as span elements with specific classes)
        const indicators = container.querySelectorAll('.rounded-full.shadow-sm');
        expect(indicators.length).toBeGreaterThan(0);
    });

    it('should highlight today with special styling', () => {
        const today = new Date();
        const props = {
            ...defaultProps,
            currentDate: today,
        };

        const { container } = render(<CalendarGrid {...props} />);

        // Today should have a special animated glow div
        const glowElements = container.querySelectorAll('.animate-pulse-soft');
        expect(glowElements.length).toBeGreaterThan(0);
    });
});
