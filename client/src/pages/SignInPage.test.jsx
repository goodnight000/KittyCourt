import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock dependencies
vi.mock('react-router-dom', () => ({
    Link: ({ children, ...props }) => <a {...props}>{children}</a>,
    useNavigate: () => vi.fn(),
}));

vi.mock('../store/useAuthStore', () => ({
    default: () => ({
        signIn: vi.fn(),
        signInWithGoogle: vi.fn(),
    }),
}));

vi.mock('../i18n', () => ({
    useI18n: () => ({
        t: (key) => key,
    }),
}));

vi.mock('../hooks/usePrefersReducedMotion', () => ({
    default: () => true,
}));

vi.mock('../components/shared/StandardButton', () => ({
    default: ({ children, ...props }) => <button {...props}>{children}</button>,
}));

vi.mock('../components/shared/ButtonLoader', () => ({
    default: () => <span>loading</span>,
}));

vi.mock('../utils/helpers', () => ({
    validateEmail: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
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
}));

import SignInPage from './SignInPage';

describe('SignInPage', () => {
    it('renders app logo image, not the generic Cat icon', () => {
        render(<SignInPage />);
        const logo = screen.getByAltText('Pause logo');
        expect(logo).toBeInTheDocument();
        expect(logo.tagName).toBe('IMG');
        expect(logo.getAttribute('src')).toBe('/assets/logo.png');
    });

    it('logo image has correct src and alt text', () => {
        render(<SignInPage />);
        const logo = screen.getByAltText('Pause logo');
        expect(logo).toHaveAttribute('src', '/assets/logo.png');
        expect(logo).toHaveAttribute('alt', 'Pause logo');
    });
});
