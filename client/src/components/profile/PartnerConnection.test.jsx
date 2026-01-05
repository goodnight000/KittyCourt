import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import PartnerConnection from './PartnerConnection';

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

// Mock i18n
vi.mock('../../i18n', () => ({
    useI18n: () => ({
        t: (key) => {
            const translations = {
                'profilePage.connect.connected': 'Connected',
                'profilePage.connect.title': 'Connect Your Partner',
                'profilePage.connect.subtitle': 'Share your code to link accounts',
                'profilePage.connect.partnerCode': 'Your Partner Code',
                'profilePage.connect.cta': 'Connect Partner',
                'common.yourPartner': 'Your Partner',
            };
            return translations[key] || key;
        },
    }),
}));

// Mock ProfilePicture component
vi.mock('../ProfilePicture', () => ({
    default: ({ avatarUrl, name, size }) => (
        <div data-testid="profile-picture" data-avatar-url={avatarUrl} data-name={name} data-size={size}>
            Profile Picture
        </div>
    ),
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, onClick, whileTap, initial, animate, transition, ...props }) => (
            <div className={className} onClick={onClick} {...props}>
                {children}
            </div>
        ),
        button: ({ children, className, onClick, whileTap, ...props }) => (
            <button className={className} onClick={onClick} {...props}>
                {children}
            </button>
        ),
    },
}));

describe('PartnerConnection', () => {
    const loveLanguages = [
        { id: 'words', label: 'Words of Affirmation', emoji: '💬' },
        { id: 'time', label: 'Quality Time', emoji: '⏰' },
        { id: 'gifts', label: 'Receiving Gifts', emoji: '🎁' },
        { id: 'acts', label: 'Acts of Service', emoji: '🤝' },
        { id: 'touch', label: 'Physical Touch', emoji: '🤗' },
    ];

    const mockClipboard = {
        writeText: vi.fn().mockResolvedValue(undefined),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();

        // Mock navigator.clipboard
        Object.defineProperty(navigator, 'clipboard', {
            value: mockClipboard,
            writable: true,
            configurable: true,
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const renderWithRouter = (props) => {
        return render(
            <BrowserRouter>
                <PartnerConnection loveLanguages={loveLanguages} {...props} />
            </BrowserRouter>
        );
    };

    describe('Connected Partner State', () => {
        const connectedProps = {
            hasPartner: true,
            profile: { partner_code: 'ABC123' },
            partner: {
                display_name: 'Jane Doe',
                avatar_url: '/assets/profile-pic/bunny.png',
                love_language: 'words',
            },
        };

        it('should render connected partner card when hasPartner is true', () => {
            renderWithRouter(connectedProps);
            expect(screen.getByText('Connected')).toBeInTheDocument();
        });

        it('should display partner name', () => {
            renderWithRouter(connectedProps);
            expect(screen.getByText('Jane Doe')).toBeInTheDocument();
        });

        it('should display partner profile picture', () => {
            renderWithRouter(connectedProps);
            const profilePic = screen.getByTestId('profile-picture');
            expect(profilePic).toHaveAttribute('data-avatar-url', '/assets/profile-pic/bunny.png');
            expect(profilePic).toHaveAttribute('data-name', 'Jane Doe');
            expect(profilePic).toHaveAttribute('data-size', 'lg');
        });

        it('should display partner love language', () => {
            renderWithRouter(connectedProps);
            expect(screen.getByText(/💬/)).toBeInTheDocument();
            expect(screen.getByText(/Words of Affirmation/)).toBeInTheDocument();
        });

        it('should not display love language if partner has none', () => {
            renderWithRouter({
                ...connectedProps,
                partner: { ...connectedProps.partner, love_language: null },
            });
            expect(screen.queryByText('💬')).not.toBeInTheDocument();
        });

        it('should fallback to "Your Partner" when display_name is not available', () => {
            renderWithRouter({
                ...connectedProps,
                partner: { ...connectedProps.partner, display_name: '' },
            });
            expect(screen.getByText('Your Partner')).toBeInTheDocument();
        });

        it('should not show connect button when connected', () => {
            renderWithRouter(connectedProps);
            expect(screen.queryByText('Connect Partner')).not.toBeInTheDocument();
        });

        it('should not show partner code when connected', () => {
            renderWithRouter(connectedProps);
            expect(screen.queryByText('Your Partner Code')).not.toBeInTheDocument();
        });
    });

    describe('Not Connected State', () => {
        const notConnectedProps = {
            hasPartner: false,
            profile: { partner_code: 'XYZ789' },
            partner: null,
        };

        it('should render connection card when not connected', () => {
            renderWithRouter(notConnectedProps);
            expect(screen.getByText('Connect Your Partner')).toBeInTheDocument();
            expect(screen.getByText('Share your code to link accounts')).toBeInTheDocument();
        });

        it('should display partner code', () => {
            renderWithRouter(notConnectedProps);
            expect(screen.getByText('Your Partner Code')).toBeInTheDocument();
            expect(screen.getByText('XYZ789')).toBeInTheDocument();
        });

        it('should display placeholder when partner code is not available', () => {
            renderWithRouter({
                ...notConnectedProps,
                profile: { partner_code: null },
            });
            expect(screen.getByText('------------')).toBeInTheDocument();
        });

        it('should display connect button', () => {
            renderWithRouter(notConnectedProps);
            expect(screen.getByText('Connect Partner')).toBeInTheDocument();
        });

        it('should navigate to connect page when button is clicked', () => {
            renderWithRouter(notConnectedProps);

            const connectButton = screen.getByText('Connect Partner').closest('button');
            fireEvent.click(connectButton);

            expect(mockNavigate).toHaveBeenCalledWith('/connect');
        });
    });

    describe('Copy to Clipboard', () => {
        const notConnectedProps = {
            hasPartner: false,
            profile: { partner_code: 'COPY123' },
            partner: null,
        };

        it('should copy partner code to clipboard when copy button is clicked', async () => {
            renderWithRouter(notConnectedProps);

            // Find the copy button (it's the button next to the code)
            const copyButton = screen.getAllByRole('button').find(btn =>
                btn.querySelector('svg') && !btn.textContent.includes('Connect')
            );

            await act(async () => {
                fireEvent.click(copyButton);
            });

            expect(mockClipboard.writeText).toHaveBeenCalledWith('COPY123');
        });

        it('should show check icon after copying', async () => {
            const { container } = renderWithRouter(notConnectedProps);

            const copyButton = screen.getAllByRole('button').find(btn =>
                btn.querySelector('svg') && !btn.textContent.includes('Connect')
            );

            await act(async () => {
                fireEvent.click(copyButton);
            });

            // After clicking, the Check icon should be shown
            // Check for the emerald-500 color class which is on the Check icon
            expect(container.querySelector('.text-emerald-500')).toBeInTheDocument();
        });

        it('should reset copy state after 2 seconds', async () => {
            const { container } = renderWithRouter(notConnectedProps);

            const copyButton = screen.getAllByRole('button').find(btn =>
                btn.querySelector('svg') && !btn.textContent.includes('Connect')
            );

            await act(async () => {
                fireEvent.click(copyButton);
            });

            // Check icon should be visible
            expect(container.querySelector('.text-emerald-500')).toBeInTheDocument();

            // Fast-forward 2 seconds
            await act(async () => {
                vi.advanceTimersByTime(2000);
            });

            // Copy icon should be back (rose-500 color)
            expect(container.querySelector('.text-rose-500')).toBeInTheDocument();
        });

        it('should not copy if partner code is not available', async () => {
            renderWithRouter({
                hasPartner: false,
                profile: { partner_code: null },
                partner: null,
            });

            const copyButton = screen.getAllByRole('button').find(btn =>
                btn.querySelector('svg') && !btn.textContent.includes('Connect')
            );

            await act(async () => {
                fireEvent.click(copyButton);
            });

            expect(mockClipboard.writeText).not.toHaveBeenCalled();
        });
    });

    describe('Edge Cases', () => {
        it('should handle undefined profile gracefully', () => {
            renderWithRouter({
                hasPartner: false,
                profile: undefined,
                partner: null,
            });

            expect(screen.getByText('------------')).toBeInTheDocument();
        });

        it('should handle hasPartner true but partner undefined', () => {
            // When hasPartner is true but partner is undefined,
            // it should fall through to the not connected state
            renderWithRouter({
                hasPartner: true,
                profile: { partner_code: 'ABC123' },
                partner: undefined,
            });

            // Since partner is falsy, it should show the connection card
            expect(screen.getByText('Connect Your Partner')).toBeInTheDocument();
        });

        it('should handle partner without love_language', () => {
            renderWithRouter({
                hasPartner: true,
                profile: { partner_code: 'ABC123' },
                partner: {
                    display_name: 'Test Partner',
                    avatar_url: null,
                },
            });

            expect(screen.getByText('Test Partner')).toBeInTheDocument();
            // Should not crash without love_language
        });

        it('should handle empty loveLanguages array', () => {
            renderWithRouter({
                hasPartner: true,
                profile: { partner_code: 'ABC123' },
                partner: {
                    display_name: 'Test Partner',
                    love_language: 'words',
                },
                loveLanguages: [],
            });

            // Should render without crashing, love language won't be found
            expect(screen.getByText('Test Partner')).toBeInTheDocument();
        });
    });
});
