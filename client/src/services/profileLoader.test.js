import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    loadUserContext,
    loadProfile,
    loadPartner,
    withTimeout
} from './profileLoader';
import * as supabaseService from './supabase';

// Mock the supabase service
vi.mock('./supabase');

describe('profileLoader', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset console spies
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'debug').mockImplementation(() => {});
    });

    describe('withTimeout', () => {
        it('should resolve when promise completes before timeout', async () => {
            const promise = Promise.resolve({ data: 'test' });
            const result = await withTimeout(promise, 1000, 'test operation');
            expect(result).toEqual({ data: 'test' });
        });

        it('should reject when timeout occurs before promise', async () => {
            const promise = new Promise((resolve) => setTimeout(() => resolve('done'), 100));

            await expect(
                withTimeout(promise, 10, 'slow operation')
            ).rejects.toThrow('[ProfileLoader] slow operation timed out after 10ms');
        });

        it('should use correct label in timeout error', async () => {
            const promise = new Promise((resolve) => setTimeout(() => resolve('done'), 100));

            await expect(
                withTimeout(promise, 10, 'custom label')
            ).rejects.toThrow('[ProfileLoader] custom label timed out after 10ms');
        });

        it('should return original promise if no timeout is provided', async () => {
            const promise = Promise.resolve({ data: 'test' });
            const result = await withTimeout(promise, null, 'no timeout');
            expect(result).toEqual({ data: 'test' });
        });

        it('should return original promise if timeout is 0', async () => {
            const promise = Promise.resolve({ data: 'test' });
            const result = await withTimeout(promise, 0, 'zero timeout');
            expect(result).toEqual({ data: 'test' });
        });
    });

    describe('loadProfile', () => {
        const mockUser = {
            id: 'user-123',
            email: 'test@example.com'
        };

        it('should successfully load existing profile', async () => {
            const mockProfile = {
                id: 'user-123',
                email: 'test@example.com',
                display_name: 'Test User',
                onboarding_complete: true
            };

            supabaseService.getProfile.mockResolvedValue({
                data: mockProfile,
                error: null
            });

            const result = await loadProfile(mockUser);

            expect(supabaseService.getProfile).toHaveBeenCalledWith('user-123');
            expect(result).toEqual(mockProfile);
        });

        it('should handle missing user ID', async () => {
            const result = await loadProfile(null);

            expect(console.warn).toHaveBeenCalledWith('[ProfileLoader] No valid user provided to loadProfile');
            expect(result).toBeNull();
            expect(supabaseService.getProfile).not.toHaveBeenCalled();
        });

        it('should handle user without ID', async () => {
            const result = await loadProfile({ email: 'test@example.com' });

            expect(console.warn).toHaveBeenCalledWith('[ProfileLoader] No valid user provided to loadProfile');
            expect(result).toBeNull();
            expect(supabaseService.getProfile).not.toHaveBeenCalled();
        });

        it('should create new profile when PGRST116 error occurs', async () => {
            const mockNewProfile = {
                id: 'user-123',
                email: 'test@example.com',
                partner_code: 'ABC123DEF456',
                onboarding_complete: false,
                preferred_language: 'en'
            };

            supabaseService.getProfile.mockResolvedValue({
                data: null,
                error: { code: 'PGRST116', message: 'Not found' }
            });

            supabaseService.generatePartnerCode.mockReturnValue('ABC123DEF456');

            supabaseService.upsertProfile.mockResolvedValue({
                data: mockNewProfile,
                error: null
            });

            const result = await loadProfile(mockUser, { preferredLanguage: 'en' });

            expect(console.log).toHaveBeenCalledWith('[ProfileLoader] Profile not found, creating new profile');
            expect(supabaseService.generatePartnerCode).toHaveBeenCalled();
            expect(supabaseService.upsertProfile).toHaveBeenCalledWith({
                id: 'user-123',
                email: 'test@example.com',
                partner_code: 'ABC123DEF456',
                onboarding_complete: false,
                created_at: expect.any(String),
                preferred_language: 'en'
            });
            expect(result).toEqual(mockNewProfile);
        });

        it('should handle profile creation failure', async () => {
            supabaseService.getProfile.mockResolvedValue({
                data: null,
                error: { code: 'PGRST116', message: 'Not found' }
            });

            supabaseService.generatePartnerCode.mockReturnValue('ABC123DEF456');

            supabaseService.upsertProfile.mockResolvedValue({
                data: null,
                error: { message: 'Database error' }
            });

            const result = await loadProfile(mockUser);

            expect(console.error).toHaveBeenCalledWith('[ProfileLoader] Failed to create profile:', { message: 'Database error' });
            expect(result).toBeNull();
        });

        it('should handle generic profile fetch error', async () => {
            supabaseService.getProfile.mockResolvedValue({
                data: null,
                error: { code: 'OTHER_ERROR', message: 'Some error' }
            });

            const result = await loadProfile(mockUser);

            expect(console.warn).toHaveBeenCalledWith('[ProfileLoader] Profile fetch error:', { code: 'OTHER_ERROR', message: 'Some error' });
            expect(result).toBeNull();
        });

        it('should handle timeout error', async () => {
            supabaseService.getProfile.mockImplementation(() =>
                new Promise((resolve) => setTimeout(() => resolve({ data: null }), 10000))
            );

            const result = await loadProfile(mockUser, { timeout: 10 });

            expect(console.warn).toHaveBeenCalledWith('[ProfileLoader] Failed to load profile:', expect.stringContaining('timed out'));
            expect(result).toBeNull();
        });

        it('should use preferredLanguage option when creating profile', async () => {
            supabaseService.getProfile.mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' }
            });

            supabaseService.generatePartnerCode.mockReturnValue('ABC123DEF456');

            supabaseService.upsertProfile.mockResolvedValue({
                data: { id: 'user-123' },
                error: null
            });

            await loadProfile(mockUser, { preferredLanguage: 'zh-Hans' });

            expect(supabaseService.upsertProfile).toHaveBeenCalledWith(
                expect.objectContaining({
                    preferred_language: 'zh-Hans'
                })
            );
        });

        it('should set preferredLanguage to null when not provided', async () => {
            supabaseService.getProfile.mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' }
            });

            supabaseService.generatePartnerCode.mockReturnValue('ABC123DEF456');

            supabaseService.upsertProfile.mockResolvedValue({
                data: { id: 'user-123' },
                error: null
            });

            await loadProfile(mockUser);

            expect(supabaseService.upsertProfile).toHaveBeenCalledWith(
                expect.objectContaining({
                    preferred_language: null
                })
            );
        });
    });

    describe('loadPartner', () => {
        const mockProfile = {
            id: 'user-123',
            partner_id: 'partner-456'
        };

        it('should successfully load partner profile', async () => {
            const mockPartner = {
                id: 'partner-456',
                display_name: 'Partner User',
                email: 'partner@example.com'
            };

            supabaseService.getProfile.mockResolvedValue({
                data: mockPartner,
                error: null
            });

            const result = await loadPartner(mockProfile);

            expect(supabaseService.getProfile).toHaveBeenCalledWith('partner-456');
            expect(result).toEqual(mockPartner);
        });

        it('should return null when profile has no partner_id', async () => {
            const profileWithoutPartner = {
                id: 'user-123',
                partner_id: null
            };

            const result = await loadPartner(profileWithoutPartner);

            expect(result).toBeNull();
            expect(supabaseService.getProfile).not.toHaveBeenCalled();
        });

        it('should return null when profile is null', async () => {
            const result = await loadPartner(null);

            expect(result).toBeNull();
            expect(supabaseService.getProfile).not.toHaveBeenCalled();
        });

        it('should return null when profile is undefined', async () => {
            const result = await loadPartner(undefined);

            expect(result).toBeNull();
            expect(supabaseService.getProfile).not.toHaveBeenCalled();
        });

        it('should handle partner not found', async () => {
            supabaseService.getProfile.mockResolvedValue({
                data: null,
                error: { message: 'Not found' }
            });

            const result = await loadPartner(mockProfile);

            // loadPartner returns null when data is null, without logging
            expect(result).toBeNull();
        });

        it('should handle partner load error', async () => {
            supabaseService.getProfile.mockRejectedValue(new Error('Database error'));

            const result = await loadPartner(mockProfile);

            expect(console.warn).toHaveBeenCalledWith('[ProfileLoader] Failed to load partner profile:', 'Database error');
            expect(result).toBeNull();
        });

        it('should handle timeout', async () => {
            supabaseService.getProfile.mockImplementation(() =>
                new Promise((resolve) => setTimeout(() => resolve({ data: null }), 10000))
            );

            const result = await loadPartner(mockProfile, 10);

            expect(console.warn).toHaveBeenCalledWith('[ProfileLoader] Failed to load partner profile:', expect.stringContaining('timed out'));
            expect(result).toBeNull();
        });

        it('should use custom timeout value', async () => {
            const mockPartner = { id: 'partner-456' };
            supabaseService.getProfile.mockResolvedValue({ data: mockPartner, error: null });

            await loadPartner(mockProfile, 3000);

            // Verify the function completes successfully with custom timeout
            expect(supabaseService.getProfile).toHaveBeenCalled();
        });
    });

    describe('loadUserContext', () => {
        const mockUser = {
            id: 'user-123',
            email: 'test@example.com'
        };

        it('should successfully load complete user context', async () => {
            const mockProfile = {
                id: 'user-123',
                email: 'test@example.com',
                display_name: 'Test User',
                partner_id: 'partner-456'
            };

            const mockPartner = {
                id: 'partner-456',
                display_name: 'Partner User'
            };

            const mockRequests = [
                { id: 'req-1', sender_id: 'other-user' }
            ];

            const mockSentRequest = {
                id: 'req-2',
                receiver_id: 'another-user'
            };

            supabaseService.getProfile
                .mockResolvedValueOnce({ data: mockProfile, error: null }) // For user profile
                .mockResolvedValueOnce({ data: mockPartner, error: null }); // For partner profile

            supabaseService.getPendingRequests.mockResolvedValue({
                data: mockRequests,
                error: null
            });

            supabaseService.getSentRequest.mockResolvedValue({
                data: mockSentRequest,
                error: null
            });

            const result = await loadUserContext(mockUser);

            expect(result).toEqual({
                profile: mockProfile,
                partner: mockPartner,
                requests: mockRequests,
                sent: mockSentRequest
            });
        });

        it('should handle missing user ID', async () => {
            const result = await loadUserContext(null);

            expect(console.warn).toHaveBeenCalledWith('[ProfileLoader] No valid user provided to loadUserContext');
            expect(result).toEqual({
                profile: null,
                partner: null,
                requests: [],
                sent: null
            });
        });

        it('should handle user without ID', async () => {
            const result = await loadUserContext({ email: 'test@example.com' });

            expect(console.warn).toHaveBeenCalledWith('[ProfileLoader] No valid user provided to loadUserContext');
            expect(result).toEqual({
                profile: null,
                partner: null,
                requests: [],
                sent: null
            });
        });

        it('should create new profile when PGRST116 error occurs', async () => {
            const mockNewProfile = {
                id: 'user-123',
                email: 'test@example.com',
                partner_code: 'ABC123DEF456',
                onboarding_complete: false
            };

            supabaseService.getProfile.mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' }
            });

            supabaseService.generatePartnerCode.mockReturnValue('ABC123DEF456');

            supabaseService.upsertProfile.mockResolvedValue({
                data: mockNewProfile,
                error: null
            });

            supabaseService.getPendingRequests.mockResolvedValue({
                data: [],
                error: null
            });

            supabaseService.getSentRequest.mockResolvedValue({
                data: null,
                error: null
            });

            const result = await loadUserContext(mockUser, { preferredLanguage: 'en' });

            expect(console.log).toHaveBeenCalledWith('[ProfileLoader] Profile not found (PGRST116), creating new profile');
            expect(result.profile).toEqual(mockNewProfile);
        });

        it('should handle partner not connected scenario', async () => {
            const mockProfile = {
                id: 'user-123',
                email: 'test@example.com',
                partner_id: null
            };

            supabaseService.getProfile.mockResolvedValue({
                data: mockProfile,
                error: null
            });

            supabaseService.getPendingRequests.mockResolvedValue({
                data: [],
                error: null
            });

            supabaseService.getSentRequest.mockResolvedValue({
                data: null,
                error: null
            });

            const result = await loadUserContext(mockUser);

            expect(result).toEqual({
                profile: mockProfile,
                partner: null,
                requests: [],
                sent: null
            });
        });

        it('should handle profile timeout', async () => {
            supabaseService.getProfile.mockImplementation(() =>
                new Promise((resolve) => setTimeout(() => resolve({ data: null }), 10000))
            );

            const result = await loadUserContext(mockUser, { profileTimeout: 10 });

            expect(console.warn).toHaveBeenCalledWith('[ProfileLoader] Failed to load profile:', expect.stringContaining('timed out'));
            expect(result.profile).toBeNull();
        });

        it('should handle partner load failure gracefully', async () => {
            const mockProfile = {
                id: 'user-123',
                partner_id: 'partner-456'
            };

            supabaseService.getProfile
                .mockResolvedValueOnce({ data: mockProfile, error: null })
                .mockResolvedValueOnce({ data: null, error: { message: 'Partner not found' } });

            supabaseService.getPendingRequests.mockResolvedValue({
                data: [],
                error: null
            });

            supabaseService.getSentRequest.mockResolvedValue({
                data: null,
                error: null
            });

            const result = await loadUserContext(mockUser);

            expect(console.warn).toHaveBeenCalledWith('[ProfileLoader] Failed to load partner profile');
            expect(result.partner).toBeNull();
            expect(result.profile).toEqual(mockProfile);
        });

        it('should handle pending requests failure gracefully', async () => {
            const mockProfile = { id: 'user-123' };

            supabaseService.getProfile.mockResolvedValue({
                data: mockProfile,
                error: null
            });

            supabaseService.getPendingRequests.mockRejectedValue(new Error('Database error'));

            supabaseService.getSentRequest.mockResolvedValue({
                data: null,
                error: null
            });

            const result = await loadUserContext(mockUser);

            expect(console.debug).toHaveBeenCalledWith('[ProfileLoader] Failed to load pending requests (non-critical):', 'Database error');
            expect(result.requests).toEqual([]);
            expect(result.profile).toEqual(mockProfile);
        });

        it('should handle sent request failure gracefully', async () => {
            const mockProfile = { id: 'user-123' };

            supabaseService.getProfile.mockResolvedValue({
                data: mockProfile,
                error: null
            });

            supabaseService.getPendingRequests.mockResolvedValue({
                data: [],
                error: null
            });

            supabaseService.getSentRequest.mockRejectedValue(new Error('Database error'));

            const result = await loadUserContext(mockUser);

            expect(console.debug).toHaveBeenCalledWith('[ProfileLoader] Failed to load sent request (non-critical):', 'Database error');
            expect(result.sent).toBeNull();
            expect(result.profile).toEqual(mockProfile);
        });

        it('should handle database errors gracefully', async () => {
            supabaseService.getProfile.mockResolvedValue({
                data: null,
                error: { code: 'DATABASE_ERROR', message: 'Connection failed' }
            });

            const result = await loadUserContext(mockUser);

            expect(console.warn).toHaveBeenCalledWith('[ProfileLoader] Profile fetch error:', expect.objectContaining({
                code: 'DATABASE_ERROR'
            }));
            expect(result.profile).toBeNull();
        });

        it('should use custom timeout values', async () => {
            const mockProfile = { id: 'user-123' };

            supabaseService.getProfile.mockResolvedValue({
                data: mockProfile,
                error: null
            });

            supabaseService.getPendingRequests.mockResolvedValue({
                data: [],
                error: null
            });

            supabaseService.getSentRequest.mockResolvedValue({
                data: null,
                error: null
            });

            await loadUserContext(mockUser, {
                profileTimeout: 3000,
                requestsTimeout: 2000
            });

            // Verify the function completes successfully
            expect(supabaseService.getProfile).toHaveBeenCalled();
        });

        it('should handle requests timeout gracefully', async () => {
            const mockProfile = { id: 'user-123' };

            supabaseService.getProfile.mockResolvedValue({
                data: mockProfile,
                error: null
            });

            supabaseService.getPendingRequests.mockImplementation(() =>
                new Promise((resolve) => setTimeout(() => resolve({ data: [] }), 10000))
            );

            supabaseService.getSentRequest.mockResolvedValue({
                data: null,
                error: null
            });

            const result = await loadUserContext(mockUser, { requestsTimeout: 10 });

            expect(result.requests).toEqual([]);
            expect(result.profile).toEqual(mockProfile);
        });

        it('should handle profile creation failure', async () => {
            supabaseService.getProfile.mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' }
            });

            supabaseService.generatePartnerCode.mockReturnValue('ABC123DEF456');

            supabaseService.upsertProfile.mockResolvedValue({
                data: null,
                error: { message: 'Database error' }
            });

            // Mock the requests functions that are called after profile loading
            supabaseService.getPendingRequests.mockResolvedValue({
                data: [],
                error: null
            });

            supabaseService.getSentRequest.mockResolvedValue({
                data: null,
                error: null
            });

            const result = await loadUserContext(mockUser);

            expect(console.error).toHaveBeenCalledWith('[ProfileLoader] Failed to create profile:', { message: 'Database error' });
            expect(result.profile).toBeNull();
        });

        it('should pass preferredLanguage to new profile creation', async () => {
            supabaseService.getProfile.mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' }
            });

            supabaseService.generatePartnerCode.mockReturnValue('ABC123DEF456');

            supabaseService.upsertProfile.mockResolvedValue({
                data: { id: 'user-123' },
                error: null
            });

            supabaseService.getPendingRequests.mockResolvedValue({
                data: [],
                error: null
            });

            supabaseService.getSentRequest.mockResolvedValue({
                data: null,
                error: null
            });

            await loadUserContext(mockUser, { preferredLanguage: 'zh-Hans' });

            expect(supabaseService.upsertProfile).toHaveBeenCalledWith(
                expect.objectContaining({
                    preferred_language: 'zh-Hans'
                })
            );
        });

        it('should handle null responses from requests gracefully', async () => {
            const mockProfile = { id: 'user-123' };

            supabaseService.getProfile.mockResolvedValue({
                data: mockProfile,
                error: null
            });

            supabaseService.getPendingRequests.mockResolvedValue({
                data: null,
                error: null
            });

            supabaseService.getSentRequest.mockResolvedValue({
                data: null,
                error: null
            });

            const result = await loadUserContext(mockUser);

            expect(result.requests).toEqual([]);
            expect(result.sent).toBeNull();
        });

        it('should handle partner timeout gracefully', async () => {
            const mockProfile = {
                id: 'user-123',
                partner_id: 'partner-456'
            };

            supabaseService.getProfile
                .mockResolvedValueOnce({ data: mockProfile, error: null })
                .mockImplementation(() =>
                    new Promise((resolve) => setTimeout(() => resolve({ data: null }), 10000))
                );

            supabaseService.getPendingRequests.mockResolvedValue({
                data: [],
                error: null
            });

            supabaseService.getSentRequest.mockResolvedValue({
                data: null,
                error: null
            });

            const result = await loadUserContext(mockUser, { profileTimeout: 10 });

            expect(console.warn).toHaveBeenCalledWith('[ProfileLoader] Failed to load partner profile:', expect.stringContaining('timed out'));
            expect(result.partner).toBeNull();
            expect(result.profile).toEqual(mockProfile);
        });
    });

    describe('integration scenarios', () => {
        it('should handle complete first-time user flow', async () => {
            const newUser = {
                id: 'new-user-123',
                email: 'newuser@example.com'
            };

            const newProfile = {
                id: 'new-user-123',
                email: 'newuser@example.com',
                partner_code: 'NEWCODE12345',
                onboarding_complete: false,
                preferred_language: 'en'
            };

            supabaseService.getProfile.mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' }
            });

            supabaseService.generatePartnerCode.mockReturnValue('NEWCODE12345');

            supabaseService.upsertProfile.mockResolvedValue({
                data: newProfile,
                error: null
            });

            supabaseService.getPendingRequests.mockResolvedValue({
                data: [],
                error: null
            });

            supabaseService.getSentRequest.mockResolvedValue({
                data: null,
                error: null
            });

            const result = await loadUserContext(newUser, { preferredLanguage: 'en' });

            expect(result).toEqual({
                profile: newProfile,
                partner: null,
                requests: [],
                sent: null
            });
        });

        it('should handle returning user with partner flow', async () => {
            const returningUser = {
                id: 'user-123',
                email: 'user@example.com'
            };

            const profile = {
                id: 'user-123',
                email: 'user@example.com',
                partner_id: 'partner-456',
                onboarding_complete: true
            };

            const partner = {
                id: 'partner-456',
                display_name: 'Partner Name'
            };

            supabaseService.getProfile
                .mockResolvedValueOnce({ data: profile, error: null })
                .mockResolvedValueOnce({ data: partner, error: null });

            supabaseService.getPendingRequests.mockResolvedValue({
                data: [],
                error: null
            });

            supabaseService.getSentRequest.mockResolvedValue({
                data: null,
                error: null
            });

            const result = await loadUserContext(returningUser);

            expect(result).toEqual({
                profile,
                partner,
                requests: [],
                sent: null
            });
        });

        it('should handle user with pending connection request', async () => {
            const user = {
                id: 'user-123',
                email: 'user@example.com'
            };

            const profile = {
                id: 'user-123',
                email: 'user@example.com',
                partner_id: null
            };

            const pendingRequest = {
                id: 'req-1',
                sender_id: 'other-user',
                receiver_id: 'user-123',
                status: 'pending'
            };

            supabaseService.getProfile.mockResolvedValue({
                data: profile,
                error: null
            });

            supabaseService.getPendingRequests.mockResolvedValue({
                data: [pendingRequest],
                error: null
            });

            supabaseService.getSentRequest.mockResolvedValue({
                data: null,
                error: null
            });

            const result = await loadUserContext(user);

            expect(result).toEqual({
                profile,
                partner: null,
                requests: [pendingRequest],
                sent: null
            });
        });
    });
});
