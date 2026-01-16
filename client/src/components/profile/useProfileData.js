import { useState, useEffect, useCallback } from 'react';
import { processAvatarForSave } from '../../services/avatarService';
import useAuthStore from '../../store/useAuthStore';

/**
 * Custom hook for managing profile data and operations
 * Encapsulates profile state, loading, and save logic
 */
const useProfileData = () => {
    const { profile, user: authUser, refreshProfile } = useAuthStore();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const logDebug = (...args) => {
        if (import.meta.env.DEV) console.log(...args);
    };

    // Initialize profile data from store
    const [profileData, setProfileData] = useState(() => ({
        nickname: profile?.display_name || '',
        birthday: profile?.birthday || '',
        loveLanguage: profile?.love_language || '',
        avatarUrl: profile?.avatar_url || null,
        anniversaryDate: profile?.anniversary_date || '',
    }));

    // Update profileData when profile changes (from Supabase only)
    useEffect(() => {
        setProfileData({
            nickname: profile?.display_name || '',
            birthday: profile?.birthday || '',
            loveLanguage: profile?.love_language || '',
            avatarUrl: profile?.avatar_url || null,
            anniversaryDate: profile?.anniversary_date || '',
        });
    }, [profile]);

    /**
     * Save profile data to Supabase
     * Handles avatar upload if needed
     */
    const saveProfile = useCallback(async (newData) => {
        logDebug('[useProfileData] saveProfile called with:', newData);
        logDebug('[useProfileData] authUser?.id:', authUser?.id);

        // Update local state immediately for responsive UI
        setProfileData(newData);
        setIsLoading(true);
        setError(null);

        // Persist to Supabase
        if (authUser?.id) {
            try {
                // Build update object with only the fields we want to change
                const updateData = {
                    display_name: newData.nickname || null,
                    love_language: newData.loveLanguage || null,
                    birthday: newData.birthday || null,
                };

                // Only include anniversary_date if it's being set for the first time
                if (newData.anniversaryDate && !profile?.anniversary_date) {
                    updateData.anniversary_date = newData.anniversaryDate;
                }

                // Process avatar - upload to storage if it's a custom upload (base64)
                if (newData.avatarUrl) {
                    const { url, error: avatarError } = await processAvatarForSave(authUser.id, newData.avatarUrl);
                    if (avatarError) {
                        console.warn('[useProfileData] Avatar upload failed:', avatarError);
                    } else {
                        updateData.avatar_url = url;
                    }
                }

                logDebug('[useProfileData] Updating profile with:', updateData);

                // Use direct Supabase update
                const { supabase } = await import('../../services/supabase');
                const { data, error: updateError } = await supabase
                    .from('profiles')
                    .update(updateData)
                    .eq('id', authUser.id)
                    .select()
                    .single();

                logDebug('[useProfileData] Supabase update response - data:', data, 'error:', updateError);

                if (updateError) {
                    console.error('[useProfileData] Failed to save profile to Supabase:', updateError);
                    setError(updateError.message || 'Failed to save profile');
                } else {
                    logDebug('[useProfileData] Profile saved to Supabase successfully');
                    // Refresh auth store profile to propagate changes throughout the app
                    await refreshProfile();
                }
            } catch (err) {
                console.error('[useProfileData] Exception saving profile:', err);
                setError(err.message || 'An unexpected error occurred');
            } finally {
                setIsLoading(false);
            }
        } else {
            console.warn('[useProfileData] No authUser?.id, skipping Supabase save');
            setIsLoading(false);
        }
    }, [authUser, profile, refreshProfile]);

    return {
        profileData,
        isLoading,
        error,
        saveProfile,
        setProfileData, // Allow direct updates for local state management
    };
};

export default useProfileData;
