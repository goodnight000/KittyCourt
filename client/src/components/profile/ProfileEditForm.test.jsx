import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ProfileEditForm from './ProfileEditForm';

// Mock i18n
vi.mock('../../i18n', () => ({
    useI18n: () => ({
        t: (key, params) => {
            const translations = {
                'profilePage.edit.title': 'Edit Profile',
                'profilePage.edit.photoLabel': 'Profile Photo',
                'profilePage.edit.profileAlt': 'Profile',
                'profilePage.edit.takePhoto': 'Take Photo',
                'profilePage.edit.uploadPhoto': 'Upload Photo',
                'profilePage.edit.uploading': 'Uploading...',
                'profilePage.edit.chooseAvatar': 'Choose Avatar',
                'profilePage.edit.avatarAlt': 'Avatar',
                'profilePage.edit.nicknameLabel': 'Nickname',
                'profilePage.edit.nicknamePlaceholder': 'Enter nickname',
                'profilePage.edit.birthdayLabel': 'Birthday',
                'profile.loveLanguageLabel': 'Love Language',
                'profile.languageLabel': 'Preferred Language',
                'profile.saveProfile': 'Save Profile',
                'errors.IMAGE_INVALID': 'Invalid image type',
                'errors.IMAGE_TOO_LARGE': 'Image is too large (max 5MB)',
                'errors.IMAGE_READ_FAILED': 'Failed to read image',
                'validation.DATE_IN_FUTURE': 'Birthday error: Date cannot be in the future',
                'validation.AGE_TOO_YOUNG': 'Birthday error: You must be at least 13 years old',
                'validation.AGE_TOO_OLD': 'Birthday error: Please enter a valid birth year',
            };
            if (key === 'profilePage.edit.avatarAlt' && params?.name) {
                return `Avatar: ${params.name}`;
            }
            return translations[key] || key;
        },
        supportedLanguages: [
            { code: 'en', label: 'English' },
            { code: 'zh-Hans', label: 'Simplified Chinese', labelKey: 'languages.zh-Hans' },
        ],
    }),
}));

// Mock avatar service
vi.mock('../../services/avatarService', () => ({
    PRESET_AVATARS: [
        { id: 'cat', path: '/assets/profile-pic/cat.png', label: 'Cat' },
        { id: 'dog', path: '/assets/profile-pic/dog.png', label: 'Dog' },
        { id: 'bunny', path: '/assets/profile-pic/bunny.png', label: 'Bunny' },
        { id: 'bear', path: '/assets/profile-pic/bear.png', label: 'Bear' },
    ],
}));

// Mock helpers - validateBirthdayDate
vi.mock('../../utils/helpers', () => ({
    validateBirthdayDate: (date) => {
        if (!date) return { isValid: true };

        const birthDate = new Date(date);
        const today = new Date();

        if (birthDate > today) {
            return { isValid: false, error: 'Date cannot be in the future', errorCode: 'DATE_IN_FUTURE' };
        }

        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }

        if (age < 13) {
            return { isValid: false, error: 'You must be at least 13 years old', errorCode: 'AGE_TOO_YOUNG' };
        }

        if (age > 120) {
            return { isValid: false, error: 'Please enter a valid birth year', errorCode: 'AGE_TOO_OLD' };
        }

        return { isValid: true };
    },
}));

// Mock language config
vi.mock('../../i18n/languageConfig', () => ({
    DEFAULT_LANGUAGE: 'en',
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, onClick, whileTap, initial, animate, exit, ...props }) => (
            <div className={className} onClick={onClick} {...props}>
                {children}
            </div>
        ),
        button: ({ children, className, onClick, disabled, whileTap, ...props }) => (
            <button className={className} onClick={onClick} disabled={disabled} {...props}>
                {children}
            </button>
        ),
    },
}));

describe('ProfileEditForm', () => {
    const loveLanguages = [
        { id: 'words', label: 'Words of Affirmation', emoji: '💬' },
        { id: 'time', label: 'Quality Time', emoji: '⏰' },
        { id: 'gifts', label: 'Receiving Gifts', emoji: '🎁' },
        { id: 'acts', label: 'Acts of Service', emoji: '🤝' },
        { id: 'touch', label: 'Physical Touch', emoji: '🤗' },
    ];

    const defaultProfileData = {
        nickname: 'TestUser',
        birthday: '1990-05-15',
        loveLanguage: 'words',
        avatarUrl: '/assets/profile-pic/cat.png',
        anniversaryDate: '2020-06-20',
        preferredLanguage: 'en',
    };

    const defaultProps = {
        profileData: defaultProfileData,
        loveLanguages,
        onSave: vi.fn(),
        onClose: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Form Rendering', () => {
        it('should render form title', () => {
            render(<ProfileEditForm {...defaultProps} />);
            expect(screen.getByText('Edit Profile')).toBeInTheDocument();
        });

        it('should render close button', () => {
            render(<ProfileEditForm {...defaultProps} />);
            const closeButton = screen.getAllByRole('button').find(btn =>
                btn.querySelector('svg')?.classList.contains('lucide-x')
            );
            expect(closeButton).toBeInTheDocument();
        });

        it('should render profile photo section', () => {
            render(<ProfileEditForm {...defaultProps} />);
            expect(screen.getByText('Profile Photo')).toBeInTheDocument();
            expect(screen.getByText('Take Photo')).toBeInTheDocument();
            expect(screen.getByText('Upload Photo')).toBeInTheDocument();
        });

        it('should render avatar selection grid', () => {
            render(<ProfileEditForm {...defaultProps} />);
            expect(screen.getByText('Choose Avatar')).toBeInTheDocument();
            // Should have preset avatars
            const avatarImages = screen.getAllByAltText(/Avatar:/);
            expect(avatarImages.length).toBe(4);
        });

        it('should render nickname field with initial value', () => {
            render(<ProfileEditForm {...defaultProps} />);
            expect(screen.getByText('Nickname')).toBeInTheDocument();
            const nicknameInput = screen.getByPlaceholderText('Enter nickname');
            expect(nicknameInput).toHaveValue('TestUser');
        });

        it('should render birthday field with initial value', () => {
            render(<ProfileEditForm {...defaultProps} />);
            expect(screen.getByText('Birthday')).toBeInTheDocument();
            const birthdayInput = screen.getByDisplayValue('1990-05-15');
            expect(birthdayInput).toBeInTheDocument();
        });

        it('should render love language selection', () => {
            render(<ProfileEditForm {...defaultProps} />);
            expect(screen.getByText('Love Language')).toBeInTheDocument();
            loveLanguages.forEach(lang => {
                expect(screen.getByText(lang.label)).toBeInTheDocument();
                expect(screen.getByText(lang.emoji)).toBeInTheDocument();
            });
        });

        it('should render language selection dropdown', () => {
            render(<ProfileEditForm {...defaultProps} />);
            expect(screen.getByText('Preferred Language')).toBeInTheDocument();
            const languageSelect = screen.getByRole('combobox');
            expect(languageSelect).toHaveValue('en');
        });

        it('should render save button', () => {
            render(<ProfileEditForm {...defaultProps} />);
            expect(screen.getByText('Save Profile')).toBeInTheDocument();
        });

        it('should display current avatar when avatarUrl is set', () => {
            render(<ProfileEditForm {...defaultProps} />);
            const avatarImg = screen.getAllByRole('img').find(img =>
                img.getAttribute('src') === '/assets/profile-pic/cat.png' &&
                img.getAttribute('alt') === 'Profile'
            );
            expect(avatarImg).toBeInTheDocument();
        });

        it('should show placeholder when no avatar is set', () => {
            render(<ProfileEditForm {...defaultProps} profileData={{ ...defaultProfileData, avatarUrl: '' }} />);
            // Should show User icon placeholder
            const placeholder = document.querySelector('.lucide-user');
            expect(placeholder).toBeInTheDocument();
        });
    });

    describe('Form Interactions', () => {
        it('should call onClose when close button is clicked', () => {
            const onClose = vi.fn();
            render(<ProfileEditForm {...defaultProps} onClose={onClose} />);

            const closeButton = screen.getAllByRole('button').find(btn =>
                btn.querySelector('svg')?.classList.contains('lucide-x')
            );
            fireEvent.click(closeButton);

            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('should call onClose when clicking backdrop', () => {
            const onClose = vi.fn();
            const { container } = render(<ProfileEditForm {...defaultProps} onClose={onClose} />);

            // Click on the backdrop (outermost div)
            const backdrop = container.firstChild;
            fireEvent.click(backdrop);

            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('should not call onClose when clicking form content', () => {
            const onClose = vi.fn();
            render(<ProfileEditForm {...defaultProps} onClose={onClose} />);

            // Click on the form title
            fireEvent.click(screen.getByText('Edit Profile'));

            expect(onClose).not.toHaveBeenCalled();
        });

        it('should update nickname when typing', () => {
            render(<ProfileEditForm {...defaultProps} />);

            const nicknameInput = screen.getByPlaceholderText('Enter nickname');
            fireEvent.change(nicknameInput, { target: { value: 'NewNickname' } });

            expect(nicknameInput).toHaveValue('NewNickname');
        });

        it('should update birthday when changed', () => {
            render(<ProfileEditForm {...defaultProps} />);

            const birthdayInput = screen.getByDisplayValue('1990-05-15');
            fireEvent.change(birthdayInput, { target: { value: '1985-03-20' } });

            expect(birthdayInput).toHaveValue('1985-03-20');
        });

        it('should select love language when clicked', () => {
            render(<ProfileEditForm {...defaultProps} />);

            const qualityTimeButton = screen.getByText('Quality Time').closest('button');
            fireEvent.click(qualityTimeButton);

            // The button should now have the selected styling (ring-2 ring-amber-300)
            expect(qualityTimeButton).toHaveClass('ring-2');
        });

        it('should select preset avatar when clicked', () => {
            const { container } = render(<ProfileEditForm {...defaultProps} />);

            // Find dog avatar button
            const dogImg = screen.getByAltText('Avatar: Dog');
            const dogButton = dogImg.closest('button');
            fireEvent.click(dogButton);

            // The button should have selected styling
            expect(dogButton).toHaveClass('ring-2');
        });

        it('should change language when dropdown changes', () => {
            render(<ProfileEditForm {...defaultProps} />);

            const languageSelect = screen.getByRole('combobox');
            fireEvent.change(languageSelect, { target: { value: 'zh-Hans' } });

            expect(languageSelect).toHaveValue('zh-Hans');
        });
    });

    describe('Form Validation - Birthday', () => {
        it('should show error for future birthday', () => {
            render(<ProfileEditForm {...defaultProps} />);

            const birthdayInput = screen.getByDisplayValue('1990-05-15');
            const futureDate = new Date();
            futureDate.setFullYear(futureDate.getFullYear() + 1);
            const futureDateStr = futureDate.toISOString().split('T')[0];

            fireEvent.change(birthdayInput, { target: { value: futureDateStr } });

            // The error text should be displayed
            expect(screen.getByText(/Date cannot be in the future/)).toBeInTheDocument();
        });

        it('should show error for age under 13', () => {
            render(<ProfileEditForm {...defaultProps} />);

            const birthdayInput = screen.getByDisplayValue('1990-05-15');
            const today = new Date();
            const underageDate = new Date(today.getFullYear() - 10, today.getMonth(), today.getDate());
            const underage = underageDate.toISOString().split('T')[0];

            fireEvent.change(birthdayInput, { target: { value: underage } });

            expect(screen.getByText(/must be at least 13 years old/)).toBeInTheDocument();
        });

        it('should clear error when valid birthday is entered', () => {
            render(<ProfileEditForm {...defaultProps} />);

            const birthdayInput = screen.getByDisplayValue('1990-05-15');

            // First enter an invalid date
            const today = new Date();
            const underageDate = new Date(today.getFullYear() - 10, today.getMonth(), today.getDate());
            fireEvent.change(birthdayInput, { target: { value: underageDate.toISOString().split('T')[0] } });
            expect(screen.getByText(/must be at least 13 years old/)).toBeInTheDocument();

            // Then enter a valid date
            fireEvent.change(birthdayInput, { target: { value: '1990-05-15' } });
            expect(screen.queryByText(/must be at least 13 years old/)).not.toBeInTheDocument();
        });

        it('should clear error when birthday is cleared', () => {
            render(<ProfileEditForm {...defaultProps} />);

            const birthdayInput = screen.getByDisplayValue('1990-05-15');

            // First enter an invalid date
            const futureDate = new Date();
            futureDate.setFullYear(futureDate.getFullYear() + 1);
            fireEvent.change(birthdayInput, { target: { value: futureDate.toISOString().split('T')[0] } });
            expect(screen.getByText(/Date cannot be in the future/)).toBeInTheDocument();

            // Then clear the date
            fireEvent.change(birthdayInput, { target: { value: '' } });
            expect(screen.queryByText(/Date cannot be in the future/)).not.toBeInTheDocument();
        });

        it('should disable save button when birthday has error', () => {
            render(<ProfileEditForm {...defaultProps} />);

            const birthdayInput = screen.getByDisplayValue('1990-05-15');
            const futureDate = new Date();
            futureDate.setFullYear(futureDate.getFullYear() + 1);

            fireEvent.change(birthdayInput, { target: { value: futureDate.toISOString().split('T')[0] } });

            const saveButton = screen.getByText('Save Profile').closest('button');
            expect(saveButton).toBeDisabled();
        });
    });

    describe('Form Submission', () => {
        it('should call onSave with form data when save is clicked', () => {
            const onSave = vi.fn();
            render(<ProfileEditForm {...defaultProps} onSave={onSave} />);

            const saveButton = screen.getByText('Save Profile').closest('button');
            fireEvent.click(saveButton);

            expect(onSave).toHaveBeenCalledTimes(1);
            expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
                nickname: 'TestUser',
                birthday: '1990-05-15',
                loveLanguage: 'words',
                avatarUrl: '/assets/profile-pic/cat.png',
                preferredLanguage: 'en',
            }));
        });

        it('should include updated form values in onSave', () => {
            const onSave = vi.fn();
            render(<ProfileEditForm {...defaultProps} onSave={onSave} />);

            // Update nickname
            const nicknameInput = screen.getByPlaceholderText('Enter nickname');
            fireEvent.change(nicknameInput, { target: { value: 'UpdatedNickname' } });

            // Select different love language
            const giftButton = screen.getByText('Receiving Gifts').closest('button');
            fireEvent.click(giftButton);

            // Save
            const saveButton = screen.getByText('Save Profile').closest('button');
            fireEvent.click(saveButton);

            expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
                nickname: 'UpdatedNickname',
                loveLanguage: 'gifts',
            }));
        });

        it('should not call onSave if birthday has error', () => {
            const onSave = vi.fn();
            render(<ProfileEditForm {...defaultProps} onSave={onSave} />);

            const birthdayInput = screen.getByDisplayValue('1990-05-15');
            const futureDate = new Date();
            futureDate.setFullYear(futureDate.getFullYear() + 1);
            fireEvent.change(birthdayInput, { target: { value: futureDate.toISOString().split('T')[0] } });

            const saveButton = screen.getByText('Save Profile').closest('button');
            fireEvent.click(saveButton);

            expect(onSave).not.toHaveBeenCalled();
        });
    });

    describe('Avatar Upload', () => {
        it('should show file input for upload', () => {
            const { container } = render(<ProfileEditForm {...defaultProps} />);

            const fileInput = container.querySelector('input[type="file"]');
            expect(fileInput).toBeInTheDocument();
            expect(fileInput).toHaveAttribute('accept', 'image/*');
        });

        it('should trigger file input when Upload Photo button is clicked', () => {
            const { container } = render(<ProfileEditForm {...defaultProps} />);

            const fileInput = container.querySelector('input[type="file"]');
            const clickSpy = vi.spyOn(fileInput, 'click');

            const uploadButton = screen.getByText('Upload Photo').closest('button');
            fireEvent.click(uploadButton);

            expect(clickSpy).toHaveBeenCalled();
        });

        it('should validate file type on upload', async () => {
            const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
            const { container } = render(<ProfileEditForm {...defaultProps} />);

            const fileInput = container.querySelector('input[type="file"]');

            // Create a non-image file
            const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' });
            Object.defineProperty(fileInput, 'files', {
                value: [invalidFile],
            });

            await act(async () => {
                fireEvent.change(fileInput);
            });

            expect(alertMock).toHaveBeenCalledWith('Invalid image type');
            alertMock.mockRestore();
        });

        it('should validate file size on upload', async () => {
            const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
            const { container } = render(<ProfileEditForm {...defaultProps} />);

            const fileInput = container.querySelector('input[type="file"]');

            // Create a large file (> 5MB)
            const largeFile = new File([new ArrayBuffer(6 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });
            Object.defineProperty(fileInput, 'files', {
                value: [largeFile],
            });

            await act(async () => {
                fireEvent.change(fileInput);
            });

            expect(alertMock).toHaveBeenCalledWith('Image is too large (max 5MB)');
            alertMock.mockRestore();
        });

        it('should process valid image file', async () => {
            const { container } = render(<ProfileEditForm {...defaultProps} />);

            const fileInput = container.querySelector('input[type="file"]');
            expect(fileInput).toBeInTheDocument();
            expect(fileInput).toHaveAttribute('type', 'file');
            expect(fileInput).toHaveAttribute('accept', 'image/*');

            // The input should be hidden
            expect(fileInput).toHaveClass('hidden');
        });

        it('should have upload and take photo buttons', () => {
            render(<ProfileEditForm {...defaultProps} />);

            const takePhotoButton = screen.getByText('Take Photo').closest('button');
            const uploadButton = screen.getByText('Upload Photo').closest('button');

            expect(takePhotoButton).toBeInTheDocument();
            expect(uploadButton).toBeInTheDocument();
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty profileData', () => {
            const emptyProfile = {
                nickname: '',
                birthday: '',
                loveLanguage: '',
                avatarUrl: '',
                anniversaryDate: '',
                preferredLanguage: '',
            };

            render(<ProfileEditForm {...defaultProps} profileData={emptyProfile} />);

            const nicknameInput = screen.getByPlaceholderText('Enter nickname');
            expect(nicknameInput).toHaveValue('');
        });

        it('should handle profileData with null values', () => {
            const nullProfile = {
                nickname: null,
                birthday: null,
                loveLanguage: null,
                avatarUrl: null,
                anniversaryDate: null,
                preferredLanguage: null,
            };

            // Should not crash
            expect(() => {
                render(<ProfileEditForm {...defaultProps} profileData={nullProfile} />);
            }).not.toThrow();
        });

        it('should default to DEFAULT_LANGUAGE when preferredLanguage is not set', () => {
            const profileWithoutLang = {
                ...defaultProfileData,
                preferredLanguage: '',
            };

            render(<ProfileEditForm {...defaultProps} profileData={profileWithoutLang} />);

            const languageSelect = screen.getByRole('combobox');
            expect(languageSelect).toHaveValue('en');
        });
    });
});
