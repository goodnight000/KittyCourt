import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import useProfileData from './useProfileData';

// Mock dependencies
const mockRefreshProfile = vi.fn().mockResolvedValue(undefined);
const mockUser = { id: 'user-123' };
const mockProfile = {
    id: 'user-123',
    display_name: 'Test User',
    birthday: '1990-05-15',
    love_language: 'words',
    avatar_url: '/assets/profile-pic/cat.png',
    anniversary_date: '2020-06-20',
    preferred_language: 'en',
};

vi.mock('../../store/useAuthStore', () => ({
    default: vi.fn(() => ({
        user: mockUser,
        profile: mockProfile,
        refreshProfile: mockRefreshProfile,
    })),
}));

// Mock language config
vi.mock('../../i18n/languageConfig', () => ({
    normalizeLanguage: (lang) => lang || 'en',
    DEFAULT_LANGUAGE: 'en',
}));

// Mock avatar service
const mockProcessAvatarForSave = vi.fn();
vi.mock('../../services/avatarService', () => ({
    processAvatarForSave: (...args) => mockProcessAvatarForSave(...args),
}));

// Mock Supabase
const mockSupabaseUpdate = vi.fn();
const mockSupabaseEq = vi.fn();
const mockSupabaseSelect = vi.fn();
const mockSupabaseSingle = vi.fn();

vi.mock('../../services/supabase', () => ({
    supabase: {
        from: vi.fn(() => ({
            update: mockSupabaseUpdate,
        })),
    },
}));

describe('useProfileData', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Reset Supabase mock chain
        mockSupabaseUpdate.mockReturnValue({ eq: mockSupabaseEq });
        mockSupabaseEq.mockReturnValue({ select: mockSupabaseSelect });
        mockSupabaseSelect.mockReturnValue({ single: mockSupabaseSingle });
        mockSupabaseSingle.mockResolvedValue({ data: mockProfile, error: null });

        // Reset avatar service mock
        mockProcessAvatarForSave.mockResolvedValue({ url: '/assets/profile-pic/cat.png', error: null });
    });

    describe('Initial State', () => {
        it('should initialize profileData from auth store profile', () => {
            const { result } = renderHook(() => useProfileData());

            expect(result.current.profileData).toEqual({
                nickname: 'Test User',
                birthday: '1990-05-15',
                loveLanguage: 'words',
                avatarUrl: '/assets/profile-pic/cat.png',
                anniversaryDate: '2020-06-20',
            });
        });

        it('should have isLoading false initially', () => {
            const { result } = renderHook(() => useProfileData());
            expect(result.current.isLoading).toBe(false);
        });

        it('should have no error initially', () => {
            const { result } = renderHook(() => useProfileData());
            expect(result.current.error).toBeNull();
        });

        it('should provide saveProfile function', () => {
            const { result } = renderHook(() => useProfileData());
            expect(typeof result.current.saveProfile).toBe('function');
        });

        it('should provide setProfileData function', () => {
            const { result } = renderHook(() => useProfileData());
            expect(typeof result.current.setProfileData).toBe('function');
        });
    });

    describe('Profile Data with Missing Fields', () => {
        it('should handle null profile fields with defaults', async () => {
            const useAuthStore = (await import('../../store/useAuthStore')).default;
            useAuthStore.mockReturnValue({
                user: mockUser,
                profile: {
                    id: 'user-123',
                    display_name: null,
                    birthday: null,
                    love_language: null,
                    avatar_url: null,
                    anniversary_date: null,
                    preferred_language: null,
                },
                refreshProfile: mockRefreshProfile,
            });

            const { result } = renderHook(() => useProfileData());

            expect(result.current.profileData).toEqual({
                nickname: '',
                birthday: '',
                loveLanguage: '',
                avatarUrl: null,
                anniversaryDate: '',
            });
        });

        it('should handle undefined profile', async () => {
            const useAuthStore = (await import('../../store/useAuthStore')).default;
            useAuthStore.mockReturnValue({
                user: mockUser,
                profile: undefined,
                refreshProfile: mockRefreshProfile,
            });

            const { result } = renderHook(() => useProfileData());

            expect(result.current.profileData).toEqual({
                nickname: '',
                birthday: '',
                loveLanguage: '',
                avatarUrl: null,
                anniversaryDate: '',
            });
        });
    });

    describe('saveProfile', () => {
        beforeEach(async () => {
            // Reset auth store to default mock
            const useAuthStore = (await import('../../store/useAuthStore')).default;
            useAuthStore.mockReturnValue({
                user: mockUser,
                profile: mockProfile,
                refreshProfile: mockRefreshProfile,
            });
        });

        it('should update local state immediately', async () => {
            const { result } = renderHook(() => useProfileData());

            const newData = {
                nickname: 'New Name',
                birthday: '1985-03-20',
                loveLanguage: 'gifts',
                avatarUrl: '/assets/profile-pic/dog.png',
                anniversaryDate: '2020-06-20',
            };

            act(() => {
                result.current.saveProfile(newData);
            });

            // Should update immediately
            expect(result.current.profileData.nickname).toBe('New Name');
            expect(result.current.profileData.birthday).toBe('1985-03-20');
            expect(result.current.profileData.loveLanguage).toBe('gifts');
        });

        it('should set isLoading to true while saving', async () => {
            // Create a delayed mock to ensure we can observe the loading state
            let resolvePromise;
            const delayedPromise = new Promise((resolve) => {
                resolvePromise = resolve;
            });
            mockSupabaseSingle.mockReturnValue(delayedPromise);

            const { result } = renderHook(() => useProfileData());

            act(() => {
                result.current.saveProfile({
                    nickname: 'New Name',
                    birthday: '1990-05-15',
                    loveLanguage: 'words',
                    avatarUrl: '/assets/profile-pic/cat.png',
                });
            });

            // isLoading should be true while awaiting
            expect(result.current.isLoading).toBe(true);

            // Now resolve the promise
            await act(async () => {
                resolvePromise({ data: mockProfile, error: null });
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });
        });

        it('should call processAvatarForSave with avatar URL', async () => {
            const { result } = renderHook(() => useProfileData());

            await act(async () => {
                await result.current.saveProfile({
                    nickname: 'Test',
                    birthday: '1990-05-15',
                    loveLanguage: 'words',
                    avatarUrl: 'data:image/png;base64,test',
                });
            });

            expect(mockProcessAvatarForSave).toHaveBeenCalledWith('user-123', 'data:image/png;base64,test');
        });

        it('should call Supabase update with correct data', async () => {
            const { result } = renderHook(() => useProfileData());

            await act(async () => {
                await result.current.saveProfile({
                    nickname: 'Updated Name',
                    birthday: '1990-05-15',
                    loveLanguage: 'time',
                    avatarUrl: '/assets/profile-pic/cat.png',
                });
            });

            expect(mockSupabaseUpdate).toHaveBeenCalledWith(expect.objectContaining({
                display_name: 'Updated Name',
                birthday: '1990-05-15',
                love_language: 'time',
            }));
            expect(mockSupabaseUpdate).toHaveBeenCalledWith(
                expect.not.objectContaining({
                    preferred_language: expect.anything(),
                })
            );
        });

        it('should call refreshProfile after successful save', async () => {
            const { result } = renderHook(() => useProfileData());

            await act(async () => {
                await result.current.saveProfile({
                    nickname: 'Test',
                    birthday: '1990-05-15',
                    loveLanguage: 'words',
                    avatarUrl: '/assets/profile-pic/cat.png',
                });
            });

            expect(mockRefreshProfile).toHaveBeenCalled();
        });

        it('should not include anniversary_date if already set on profile', async () => {
            const { result } = renderHook(() => useProfileData());

            await act(async () => {
                await result.current.saveProfile({
                    nickname: 'Test',
                    birthday: '1990-05-15',
                    loveLanguage: 'words',
                    avatarUrl: '/assets/profile-pic/cat.png',
                    anniversaryDate: '2021-01-01', // Try to change anniversary
                });
            });

            // Should not include anniversary_date since profile already has one
            expect(mockSupabaseUpdate).toHaveBeenCalledWith(
                expect.not.objectContaining({
                    anniversary_date: expect.anything(),
                })
            );
        });

        it('should include anniversary_date if not set on profile', async () => {
            const useAuthStore = (await import('../../store/useAuthStore')).default;
            useAuthStore.mockReturnValue({
                user: mockUser,
                profile: { ...mockProfile, anniversary_date: null },
                refreshProfile: mockRefreshProfile,
            });

            const { result } = renderHook(() => useProfileData());

            await act(async () => {
                await result.current.saveProfile({
                    nickname: 'Test',
                    birthday: '1990-05-15',
                    loveLanguage: 'words',
                    avatarUrl: '/assets/profile-pic/cat.png',
                    anniversaryDate: '2021-01-01',
                });
            });

            expect(mockSupabaseUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    anniversary_date: '2021-01-01',
                })
            );
        });
    });

    describe('Error Handling', () => {
        beforeEach(async () => {
            const useAuthStore = (await import('../../store/useAuthStore')).default;
            useAuthStore.mockReturnValue({
                user: mockUser,
                profile: mockProfile,
                refreshProfile: mockRefreshProfile,
            });
        });

        it('should set error on Supabase update failure', async () => {
            mockSupabaseSingle.mockResolvedValue({
                data: null,
                error: { message: 'Database error' },
            });

            const { result } = renderHook(() => useProfileData());

            await act(async () => {
                await result.current.saveProfile({
                    nickname: 'Test',
                    birthday: '1990-05-15',
                    loveLanguage: 'words',
                    avatarUrl: '/assets/profile-pic/cat.png',
                });
            });

            expect(result.current.error).toBe('Database error');
            expect(result.current.isLoading).toBe(false);
        });

        it('should set error on exception during save', async () => {
            mockSupabaseUpdate.mockImplementation(() => {
                throw new Error('Unexpected error');
            });

            const { result } = renderHook(() => useProfileData());

            await act(async () => {
                await result.current.saveProfile({
                    nickname: 'Test',
                    birthday: '1990-05-15',
                    loveLanguage: 'words',
                    avatarUrl: '/assets/profile-pic/cat.png',
                });
            });

            expect(result.current.error).toBe('Unexpected error');
            expect(result.current.isLoading).toBe(false);
        });

        it('should continue save even if avatar upload fails', async () => {
            mockProcessAvatarForSave.mockResolvedValue({
                url: null,
                error: 'Upload failed',
            });

            const { result } = renderHook(() => useProfileData());

            await act(async () => {
                await result.current.saveProfile({
                    nickname: 'Test',
                    birthday: '1990-05-15',
                    loveLanguage: 'words',
                    avatarUrl: 'data:image/png;base64,test',
                });
            });

            // Should still try to update, just without avatar_url
            expect(mockSupabaseUpdate).toHaveBeenCalled();
        });

        it('should skip Supabase save when user is not authenticated', async () => {
            const useAuthStore = (await import('../../store/useAuthStore')).default;
            useAuthStore.mockReturnValue({
                user: null,
                profile: mockProfile,
                refreshProfile: mockRefreshProfile,
            });

            const { result } = renderHook(() => useProfileData());

            await act(async () => {
                await result.current.saveProfile({
                    nickname: 'Test',
                    birthday: '1990-05-15',
                    loveLanguage: 'words',
                    avatarUrl: '/assets/profile-pic/cat.png',
                });
            });

            // Supabase should not be called
            expect(mockSupabaseUpdate).not.toHaveBeenCalled();
            expect(result.current.isLoading).toBe(false);
        });
    });

    describe('setProfileData', () => {
        it('should allow direct updates to profileData', () => {
            const { result } = renderHook(() => useProfileData());

            act(() => {
                result.current.setProfileData({
                    nickname: 'Direct Update',
                    birthday: '1995-01-01',
                    loveLanguage: 'touch',
                    avatarUrl: '/assets/profile-pic/bunny.png',
                    anniversaryDate: '2022-01-01',
                });
            });

            expect(result.current.profileData.nickname).toBe('Direct Update');
            expect(result.current.profileData.loveLanguage).toBe('touch');
        });

        it('should not trigger Supabase save when using setProfileData', () => {
            const { result } = renderHook(() => useProfileData());

            act(() => {
                result.current.setProfileData({
                    nickname: 'Local Only',
                    birthday: '1990-05-15',
                    loveLanguage: 'words',
                    avatarUrl: '/assets/profile-pic/cat.png',
                    anniversaryDate: '2020-06-20',
                });
            });

            expect(mockSupabaseUpdate).not.toHaveBeenCalled();
        });
    });

    describe('Profile Updates from Store', () => {
        it('should update profileData when profile in store changes', async () => {
            const useAuthStore = (await import('../../store/useAuthStore')).default;

            // Initial render with original profile
            useAuthStore.mockReturnValue({
                user: mockUser,
                profile: mockProfile,
                refreshProfile: mockRefreshProfile,
            });

            const { result, rerender } = renderHook(() => useProfileData());

            expect(result.current.profileData.nickname).toBe('Test User');

            // Update the mock to return new profile
            useAuthStore.mockReturnValue({
                user: mockUser,
                profile: {
                    ...mockProfile,
                    display_name: 'Updated From Store',
                },
                refreshProfile: mockRefreshProfile,
            });

            // Re-render to trigger useEffect
            rerender();

            await waitFor(() => {
                expect(result.current.profileData.nickname).toBe('Updated From Store');
            });
        });
    });

    describe('Null/Empty Value Handling', () => {
        it('should handle null nickname gracefully', async () => {
            const { result } = renderHook(() => useProfileData());

            await act(async () => {
                await result.current.saveProfile({
                    nickname: '',
                    birthday: '1990-05-15',
                    loveLanguage: 'words',
                    avatarUrl: '/assets/profile-pic/cat.png',
                });
            });

            expect(mockSupabaseUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    display_name: null,
                })
            );
        });

        it('should handle null birthday gracefully', async () => {
            const { result } = renderHook(() => useProfileData());

            await act(async () => {
                await result.current.saveProfile({
                    nickname: 'Test',
                    birthday: '',
                    loveLanguage: 'words',
                    avatarUrl: '/assets/profile-pic/cat.png',
                });
            });

            expect(mockSupabaseUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    birthday: null,
                })
            );
        });

    });
});
