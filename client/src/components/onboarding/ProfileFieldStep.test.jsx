import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ProfileFieldStep from './ProfileFieldStep';

// Mock i18n
vi.mock('../../i18n', () => ({
    useI18n: () => ({
        t: (key, params) => {
            if (params?.name) return `${key} ${params.name}`;
            return key;
        },
    }),
}));

// Mock avatarService
vi.mock('../../services/avatarService', () => ({
    PRESET_AVATARS: [
        { id: '1', path: '/avatars/1.png', label: 'Avatar 1' },
        { id: '2', path: '/avatars/2.png', label: 'Avatar 2' },
    ],
}));

const renderWithRouter = (component) => {
    return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('ProfileFieldStep', () => {
    describe('name field', () => {
        it('renders name input field', () => {
            const mockOnChange = vi.fn();
            renderWithRouter(
                <ProfileFieldStep
                    fieldType="name"
                    value=""
                    onChange={mockOnChange}
                />
            );

            const input = screen.getByPlaceholderText('onboarding.name.placeholder');
            expect(input).toBeInTheDocument();
            expect(input).toHaveAttribute('type', 'text');
        });

        it('calls onChange when name is typed', () => {
            const mockOnChange = vi.fn();
            renderWithRouter(
                <ProfileFieldStep
                    fieldType="name"
                    value=""
                    onChange={mockOnChange}
                />
            );

            const input = screen.getByPlaceholderText('onboarding.name.placeholder');
            fireEvent.change(input, { target: { value: 'John Doe' } });

            expect(mockOnChange).toHaveBeenCalledWith('John Doe');
        });
    });

    describe('birthday field', () => {
        it('renders birthday date input', () => {
            const mockOnChange = vi.fn();
            renderWithRouter(
                <ProfileFieldStep
                    fieldType="birthday"
                    value=""
                    onChange={mockOnChange}
                />
            );

            const input = screen.getByDisplayValue('');
            expect(input).toBeInTheDocument();
            expect(input).toHaveAttribute('type', 'date');
        });

        it('displays error message when provided', () => {
            const mockOnChange = vi.fn();
            renderWithRouter(
                <ProfileFieldStep
                    fieldType="birthday"
                    value="2025-01-01"
                    onChange={mockOnChange}
                    error="Invalid date"
                />
            );

            expect(screen.getByText('Invalid date')).toBeInTheDocument();
        });
    });

    describe('avatar field', () => {
        it('renders preset avatar grid', () => {
            const mockOnChange = vi.fn();
            renderWithRouter(
                <ProfileFieldStep
                    fieldType="avatar"
                    value=""
                    onChange={mockOnChange}
                />
            );

            const avatars = screen.getAllByRole('button');
            // Should have 2 preset avatars + 2 upload buttons
            expect(avatars.length).toBeGreaterThanOrEqual(2);
        });

        it('calls onChange when preset avatar is clicked', () => {
            const mockOnChange = vi.fn();
            renderWithRouter(
                <ProfileFieldStep
                    fieldType="avatar"
                    value=""
                    onChange={mockOnChange}
                />
            );

            const avatarButtons = screen.getAllByRole('button');
            fireEvent.click(avatarButtons[0]);

            expect(mockOnChange).toHaveBeenCalledWith('/avatars/1.png');
        });
    });
});
