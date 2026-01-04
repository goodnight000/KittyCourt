import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import LanguageStep from './LanguageStep';

// Mock i18n
vi.mock('../../i18n', () => ({
    useI18n: () => ({
        t: (key) => key,
    }),
}));

const mockLanguages = [
    { code: 'en', label: 'English', nativeLabel: 'English' },
    { code: 'zh-Hans', label: 'Chinese', nativeLabel: '简体中文' },
];

const renderWithRouter = (component) => {
    return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('LanguageStep', () => {
    it('renders all supported languages', () => {
        const mockOnSelect = vi.fn();
        renderWithRouter(
            <LanguageStep
                supportedLanguages={mockLanguages}
                selectedLanguage={null}
                onLanguageSelect={mockOnSelect}
            />
        );

        expect(screen.getByText('English')).toBeInTheDocument();
        expect(screen.getByText('简体中文')).toBeInTheDocument();
    });

    it('highlights selected language', () => {
        const mockOnSelect = vi.fn();
        const { container } = renderWithRouter(
            <LanguageStep
                supportedLanguages={mockLanguages}
                selectedLanguage="en"
                onLanguageSelect={mockOnSelect}
            />
        );

        const buttons = container.querySelectorAll('button');
        expect(buttons[0]).toHaveClass('border-[#D2BC76]');
    });

    it('calls onLanguageSelect when language is clicked', () => {
        const mockOnSelect = vi.fn();
        renderWithRouter(
            <LanguageStep
                supportedLanguages={mockLanguages}
                selectedLanguage={null}
                onLanguageSelect={mockOnSelect}
            />
        );

        const englishButton = screen.getByText('English').closest('button');
        fireEvent.click(englishButton);

        expect(mockOnSelect).toHaveBeenCalledWith('en');
    });
});
