import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ProfileCard from './ProfileCard';

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
        t: (key, params) => {
            if (key === 'profilePage.profile.anniversary' && params?.date) {
                return `Anniversary: ${params.date}`;
            }
            if (key === 'profilePage.profile.kicker') return 'Your Profile';
            if (key === 'profilePage.profile.edit') return 'Edit Profile';
            if (key === 'profilePage.profile.signOut') return 'Sign Out';
            if (key === 'profilePage.stats.kibble') return 'Kibble';
            if (key === 'profilePage.stats.appreciations') return 'Appreciations';
            if (key === 'profilePage.stats.cases') return 'Cases';
            if (key === 'profilePage.stats.questions') return 'Questions';
            return key;
        },
        language: 'en',
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

// Mock framer-motion to avoid animation issues in tests
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

describe('ProfileCard', () => {
    const defaultProps = {
        profileData: {
            nickname: 'TestUser',
            birthday: '1990-05-15',
            anniversaryDate: '2020-06-20',
            loveLanguage: 'words',
            avatarUrl: '/assets/profile-pic/cat.png',
        },
        currentUser: {
            name: 'Test User',
            kibbleBalance: 150,
        },
        selectedLoveLanguage: {
            id: 'words',
            label: 'Words of Affirmation',
            emoji: '💬',
        },
        onEditClick: vi.fn(),
        onSignOut: vi.fn(),
        totalCases: 12,
        totalAppreciations: 25,
        questionsAnswered: 8,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    const renderWithRouter = (props = {}) => {
        return render(
            <BrowserRouter>
                <ProfileCard {...defaultProps} {...props} />
            </BrowserRouter>
        );
    };

    describe('Profile Information Display', () => {
        it('should render user nickname', () => {
            renderWithRouter();
            expect(screen.getByText('TestUser')).toBeInTheDocument();
        });

        it('should fallback to currentUser name when nickname is not available', () => {
            renderWithRouter({
                profileData: { ...defaultProps.profileData, nickname: '' },
            });
            expect(screen.getByText('Test User')).toBeInTheDocument();
        });

        it('should render birthday when available', () => {
            renderWithRouter();
            // Birthday is formatted using toLocaleDateString, look for the date element
            const birthdayElement = screen.getByText(/May/i);
            expect(birthdayElement).toBeInTheDocument();
        });

        it('should not render birthday when not available', () => {
            renderWithRouter({
                profileData: { ...defaultProps.profileData, birthday: '' },
            });
            // Check that no Calendar icon is present for birthday
            const calendarIcons = document.querySelectorAll('.lucide-calendar');
            // May still have calendar elsewhere but birthday specific badge should be gone
            expect(screen.queryByText(/May 15/)).not.toBeInTheDocument();
        });

        it('should render anniversary date when available', () => {
            renderWithRouter();
            expect(screen.getByText(/Anniversary:/)).toBeInTheDocument();
        });

        it('should not render anniversary when not available', () => {
            renderWithRouter({
                profileData: { ...defaultProps.profileData, anniversaryDate: '' },
            });
            expect(screen.queryByText(/Anniversary:/)).not.toBeInTheDocument();
        });

        it('should render love language when selected', () => {
            renderWithRouter();
            expect(screen.getByText('Words of Affirmation')).toBeInTheDocument();
            expect(screen.getByText('💬')).toBeInTheDocument();
        });

        it('should not render love language when not selected', () => {
            renderWithRouter({ selectedLoveLanguage: null });
            expect(screen.queryByText('Words of Affirmation')).not.toBeInTheDocument();
        });

        it('should render profile picture with correct props', () => {
            renderWithRouter();
            const profilePic = screen.getByTestId('profile-picture');
            expect(profilePic).toBeInTheDocument();
            expect(profilePic).toHaveAttribute('data-avatar-url', '/assets/profile-pic/cat.png');
            expect(profilePic).toHaveAttribute('data-size', 'xl');
        });
    });

    describe('Stats Display', () => {
        it('should display kibble balance', () => {
            renderWithRouter();
            expect(screen.getByText('150')).toBeInTheDocument();
            expect(screen.getByText('Kibble')).toBeInTheDocument();
        });

        it('should display zero kibble balance when not available', () => {
            renderWithRouter({
                currentUser: { ...defaultProps.currentUser, kibbleBalance: undefined },
            });
            expect(screen.getByText('0')).toBeInTheDocument();
        });

        it('should display total appreciations', () => {
            renderWithRouter();
            expect(screen.getByText('25')).toBeInTheDocument();
            expect(screen.getByText('Appreciations')).toBeInTheDocument();
        });

        it('should display total cases', () => {
            renderWithRouter();
            expect(screen.getByText('12')).toBeInTheDocument();
            expect(screen.getByText('Cases')).toBeInTheDocument();
        });

        it('should display questions answered', () => {
            renderWithRouter();
            expect(screen.getByText('8')).toBeInTheDocument();
            expect(screen.getByText('Questions')).toBeInTheDocument();
        });

        it('should display all four stat cards', () => {
            renderWithRouter();
            expect(screen.getByText('Kibble')).toBeInTheDocument();
            expect(screen.getByText('Appreciations')).toBeInTheDocument();
            expect(screen.getByText('Cases')).toBeInTheDocument();
            expect(screen.getByText('Questions')).toBeInTheDocument();
        });
    });

    describe('Button Interactions', () => {
        it('should call onEditClick when edit button is clicked', () => {
            const onEditClick = vi.fn();
            renderWithRouter({ onEditClick });

            const editButton = screen.getByText('Edit Profile').closest('button');
            fireEvent.click(editButton);

            expect(onEditClick).toHaveBeenCalledTimes(1);
        });

        it('should call onEditClick when profile picture area is clicked', () => {
            const onEditClick = vi.fn();
            renderWithRouter({ onEditClick });

            // Click on the profile picture container (which has onClick={onEditClick})
            const profilePicContainer = screen.getByTestId('profile-picture').parentElement;
            fireEvent.click(profilePicContainer);

            expect(onEditClick).toHaveBeenCalledTimes(1);
        });

        it('should call onSignOut and navigate to signin when sign out is clicked', async () => {
            const onSignOut = vi.fn().mockResolvedValue();
            renderWithRouter({ onSignOut });

            const signOutButton = screen.getByText('Sign Out').closest('button');
            fireEvent.click(signOutButton);

            await waitFor(() => {
                expect(onSignOut).toHaveBeenCalledTimes(1);
            });

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith('/signin');
            });
        });

        it('should handle async onSignOut before navigating', async () => {
            let signOutResolved = false;
            const onSignOut = vi.fn().mockImplementation(() => {
                return new Promise((resolve) => {
                    setTimeout(() => {
                        signOutResolved = true;
                        resolve();
                    }, 50);
                });
            });

            renderWithRouter({ onSignOut });

            const signOutButton = screen.getByText('Sign Out').closest('button');
            fireEvent.click(signOutButton);

            // Navigate should be called after onSignOut resolves
            await waitFor(() => {
                expect(signOutResolved).toBe(true);
            });

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith('/signin');
            });
        });
    });

    describe('Profile Kicker', () => {
        it('should render the profile kicker text', () => {
            renderWithRouter();
            expect(screen.getByText('Your Profile')).toBeInTheDocument();
        });
    });

    describe('Edge Cases', () => {
        it('should handle null currentUser gracefully', () => {
            renderWithRouter({ currentUser: null });
            // Should still render without crashing
            expect(screen.getByText('TestUser')).toBeInTheDocument();
            expect(screen.getByText('0')).toBeInTheDocument(); // kibbleBalance defaults to 0
        });

        it('should handle empty profileData nickname with null currentUser', () => {
            renderWithRouter({
                profileData: { ...defaultProps.profileData, nickname: '' },
                currentUser: null,
            });
            // Component should render without crashing
            expect(screen.getByTestId('profile-picture')).toBeInTheDocument();
        });

        it('should handle zero stats values', () => {
            renderWithRouter({
                totalCases: 0,
                totalAppreciations: 0,
                questionsAnswered: 0,
            });
            // All zeros should display
            const zeros = screen.getAllByText('0');
            expect(zeros.length).toBeGreaterThanOrEqual(3);
        });
    });
});
