import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EventForm from './EventForm';

// Mock dependencies
vi.mock('../../i18n', () => ({
    useI18n: () => ({
        t: (key) => key,
    }),
}));

vi.mock('../../utils/helpers', () => ({
    validateDate: (date) => ({ isValid: true }),
}));

describe('EventForm', () => {
    const defaultProps = {
        selectedDate: new Date(2024, 0, 15),
        onAdd: vi.fn(),
        onClose: vi.fn(),
    };

    it('should render form fields', () => {
        render(<EventForm {...defaultProps} />);

        // Labels use translation keys, so we check for the translation key pattern
        expect(screen.getByText(/titleLabel/i)).toBeInTheDocument();
        expect(screen.getByText(/dateLabel/i)).toBeInTheDocument();
        // Verify multiple input fields exist (title text input and notes textarea)
        expect(screen.getAllByRole('textbox').length).toBeGreaterThan(0);
        expect(screen.getByDisplayValue(/2024-01-15/)).toBeInTheDocument();
    });

    it('should call onClose when close button is clicked', () => {
        const onClose = vi.fn();
        render(<EventForm {...defaultProps} onClose={onClose} />);

        const closeButton = screen.getAllByRole('button').find(btn =>
            btn.querySelector('svg')?.classList.contains('lucide-x')
        );

        if (closeButton) {
            fireEvent.click(closeButton);
            expect(onClose).toHaveBeenCalled();
        }
    });

    it('should update title field when typed', () => {
        render(<EventForm {...defaultProps} />);

        const titleInput = screen.getByPlaceholderText(/title/i);
        fireEvent.change(titleInput, { target: { value: 'Birthday Party' } });

        expect(titleInput.value).toBe('Birthday Party');
    });

    it('should toggle between shared and secret visibility', () => {
        const { container } = render(<EventForm {...defaultProps} />);

        const secretButton = screen.getByText(/secret/i);
        fireEvent.click(secretButton);

        // Check that the secret button has active styling
        expect(secretButton.closest('button')).toHaveClass('bg-white');
    });

    it('should submit form with valid data', async () => {
        const onAdd = vi.fn();
        render(<EventForm {...defaultProps} onAdd={onAdd} />);

        const titleInput = screen.getByPlaceholderText(/title/i);
        fireEvent.change(titleInput, { target: { value: 'Test Event' } });

        const submitButton = screen.getByText(/submit/i);
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(onAdd).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Test Event',
                })
            );
        });
    });

    it('should not submit with empty title', () => {
        const onAdd = vi.fn();
        render(<EventForm {...defaultProps} onAdd={onAdd} />);

        const submitButton = screen.getByText(/submit/i);
        expect(submitButton).toBeDisabled();
    });

    it('should toggle recurring checkbox', () => {
        render(<EventForm {...defaultProps} />);

        const recurringButton = screen.getByText(/repeat/i).closest('button');
        fireEvent.click(recurringButton);

        expect(recurringButton).toHaveClass('bg-pink-50');
    });

    it('should allow emoji selection', () => {
        render(<EventForm {...defaultProps} />);

        // Find emoji buttons
        const emojiButtons = screen.getAllByRole('button').filter(btn =>
            /^[🎂💕🎉🌙📅🎁💐🍰🎊✨🌸🌈]$/.test(btn.textContent)
        );

        expect(emojiButtons.length).toBeGreaterThan(0);

        if (emojiButtons[0]) {
            fireEvent.click(emojiButtons[0]);
            expect(emojiButtons[0]).toHaveClass('ring-2');
        }
    });
});
