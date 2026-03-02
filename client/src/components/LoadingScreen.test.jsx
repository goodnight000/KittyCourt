import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';

vi.mock('../i18n', () => ({
    useI18n: () => ({
        t: (key) => {
            if (key === 'loadingScreen.messages') return [];
            if (key === 'loadingScreen.reset') return 'Reset';
            return key;
        },
    }),
}));

vi.mock('../hooks/usePrefersReducedMotion', () => ({
    default: () => true,
}));

vi.mock('./shared/EmojiIcon', () => ({
    default: ({ emoji, className }) => <span className={className}>{emoji}</span>,
}));

vi.mock('framer-motion', () => ({
    motion: new Proxy({}, {
        get: (_, tag) => {
            const Component = React.forwardRef(({ children, ...props }, ref) => {
                const filtered = {};
                for (const [k, v] of Object.entries(props)) {
                    if (!['animate', 'initial', 'exit', 'transition', 'whileHover', 'whileTap', 'variants', 'layout'].includes(k)) {
                        filtered[k] = v;
                    }
                }
                return React.createElement(tag, { ...filtered, ref }, children);
            });
            Component.displayName = `motion.${tag}`;
            return Component;
        },
    }),
    AnimatePresence: ({ children }) => <>{children}</>,
}));

import LoadingScreen from './LoadingScreen';

describe('LoadingScreen', () => {
    it('renders Judge Whiskers SVG', () => {
        render(<LoadingScreen />);
        expect(screen.getByTestId('judge-whiskers-svg')).toBeInTheDocument();
    });

    it('does not render the old CatFace SVG', () => {
        const { container } = render(<LoadingScreen />);
        // Old CatFace had a viewBox of "0 0 120 100"
        const svgs = container.querySelectorAll('svg[viewBox="0 0 120 100"]');
        // The only SVGs with that viewBox should not be in the main content area
        // More specifically, there should be no element with class containing "w-32 h-32"
        const oldCat = container.querySelector('.w-32.h-32');
        expect(oldCat).toBeNull();
    });

    it('does not render an icon below the message text', () => {
        const { container } = render(<LoadingScreen />);
        // The old design had a currentMessage.Icon component rendered in a flex div below the h2
        // The new design should only have the h2 text, no icon sibling in the message area
        const messageH2 = container.querySelector('h2');
        expect(messageH2).toBeInTheDocument();
        // The parent space-y-3 div should only contain the h2, not an icon div
        const messageContainer = messageH2.parentElement;
        const childDivs = messageContainer.querySelectorAll('div');
        expect(childDivs.length).toBe(0);
    });

    it('renders message text', () => {
        render(<LoadingScreen message="Loading test..." />);
        expect(screen.getByText('Loading test...')).toBeInTheDocument();
    });

    it('shows reset button after 5 seconds', () => {
        vi.useFakeTimers();
        render(<LoadingScreen />);

        // Initially no reset button
        expect(screen.queryByText('Reset')).toBeNull();

        // Advance 5 seconds
        act(() => {
            vi.advanceTimersByTime(5000);
        });

        expect(screen.getByText('Reset')).toBeInTheDocument();
        vi.useRealTimers();
    });
});
