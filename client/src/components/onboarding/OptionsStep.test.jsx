import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import OptionsStep from './OptionsStep';

// Mock i18n
vi.mock('../../i18n', () => ({
    useI18n: () => ({
        t: (key) => key,
    }),
}));

const mockOptions = [
    { id: 'option1', emoji: '😀', labelKey: 'label.option1', descKey: 'desc.option1' },
    { id: 'option2', emoji: '😎', labelKey: 'label.option2', descKey: 'desc.option2' },
];

const renderWithRouter = (component) => {
    return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('OptionsStep', () => {
    it('renders all options', () => {
        const mockOnSelect = vi.fn();
        renderWithRouter(
            <OptionsStep
                options={mockOptions}
                selectedValue={null}
                onOptionSelect={mockOnSelect}
            />
        );

        expect(screen.getByText('😀')).toBeInTheDocument();
        expect(screen.getByText('😎')).toBeInTheDocument();
    });

    it('highlights selected option in single select mode', () => {
        const mockOnSelect = vi.fn();
        const { container } = renderWithRouter(
            <OptionsStep
                options={mockOptions}
                selectedValue="option1"
                onOptionSelect={mockOnSelect}
                multiSelect={false}
            />
        );

        const buttons = container.querySelectorAll('button');
        expect(buttons[0]).toHaveClass('border-[#D2BC76]');
    });

    it('highlights multiple selected options in multi-select mode', () => {
        const mockOnSelect = vi.fn();
        const { container } = renderWithRouter(
            <OptionsStep
                options={mockOptions}
                selectedValue={['option1', 'option2']}
                onOptionSelect={mockOnSelect}
                multiSelect={true}
            />
        );

        const buttons = container.querySelectorAll('button');
        expect(buttons[0]).toHaveClass('border-[#D2BC76]');
        expect(buttons[1]).toHaveClass('border-[#D2BC76]');
    });

    it('calls onOptionSelect when option is clicked', () => {
        const mockOnSelect = vi.fn();
        renderWithRouter(
            <OptionsStep
                options={mockOptions}
                selectedValue={null}
                onOptionSelect={mockOnSelect}
            />
        );

        const firstOption = screen.getByText('😀').closest('button');
        fireEvent.click(firstOption);

        expect(mockOnSelect).toHaveBeenCalledWith('option1');
    });

    it('shows custom input when allowCustom is true', () => {
        const mockOnSelect = vi.fn();
        renderWithRouter(
            <OptionsStep
                options={mockOptions}
                selectedValue={null}
                onOptionSelect={mockOnSelect}
                allowCustom={true}
            />
        );

        const customInput = screen.getByPlaceholderText('onboarding.customOptionPlaceholder');
        expect(customInput).toBeInTheDocument();
    });

    it('does not show custom input when allowCustom is false', () => {
        const mockOnSelect = vi.fn();
        renderWithRouter(
            <OptionsStep
                options={mockOptions}
                selectedValue={null}
                onOptionSelect={mockOnSelect}
                allowCustom={false}
            />
        );

        const customInput = screen.queryByPlaceholderText('onboarding.customOptionPlaceholder');
        expect(customInput).not.toBeInTheDocument();
    });
});
