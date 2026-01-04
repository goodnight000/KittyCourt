import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import OnboardingStep from './OnboardingStep';

// Mock i18n
vi.mock('../../i18n', () => ({
    useI18n: () => ({
        t: (key) => key,
    }),
}));

const mockStepData = {
    id: 'test',
    titleKey: 'onboarding.test.title',
    subtitleKey: 'onboarding.test.subtitle',
    icon: '🎉',
};

const renderWithRouter = (component) => {
    return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('OnboardingStep', () => {
    it('renders step header with icon', () => {
        renderWithRouter(
            <OnboardingStep stepData={mockStepData} stepBadgeLabel="Step 1 of 5">
                <div>Test content</div>
            </OnboardingStep>
        );

        expect(screen.getByText('🎉')).toBeInTheDocument();
        expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
    });

    it('renders children content', () => {
        renderWithRouter(
            <OnboardingStep stepData={mockStepData} stepBadgeLabel="Step 1">
                <div>Test content</div>
            </OnboardingStep>
        );

        expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('shows connect choice title when showConnectChoice is true', () => {
        renderWithRouter(
            <OnboardingStep
                stepData={mockStepData}
                stepBadgeLabel="Step 1"
                showConnectChoice={true}
            >
                <div>Test content</div>
            </OnboardingStep>
        );

        expect(screen.getByText('onboarding.complete.oneMoreThing')).toBeInTheDocument();
    });

    it('shows normal title when showConnectChoice is false', () => {
        renderWithRouter(
            <OnboardingStep
                stepData={mockStepData}
                stepBadgeLabel="Step 1"
                showConnectChoice={false}
            >
                <div>Test content</div>
            </OnboardingStep>
        );

        expect(screen.getByText('onboarding.test.title')).toBeInTheDocument();
    });
});
