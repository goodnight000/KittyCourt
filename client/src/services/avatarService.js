/**
 * Avatar Service - Handles avatar uploads and URL management
 * 
 * Preset avatars: Stored as path strings (e.g., "/assets/profile-pic/cat.png")
 * Custom uploads: Uploaded to Supabase Storage, stored as public URLs
 */

import { supabase } from './supabase';

// List of preset avatar paths
export const PRESET_AVATARS = [
    '/assets/profile-pic/bear.png',
    '/assets/profile-pic/bunny.png',
    '/assets/profile-pic/capybara.png',
    '/assets/profile-pic/cat.png',
    '/assets/profile-pic/dog.png',
    '/assets/profile-pic/fox.png',
    '/assets/profile-pic/panda.png',
    '/assets/profile-pic/penguin.png',
];

/**
 * Check if a URL is a preset avatar path
 */
export const isPresetAvatar = (url) => {
    if (!url) return false;
    return PRESET_AVATARS.includes(url) || url.startsWith('/assets/profile-pic/');
};

/**
 * Check if a URL is a base64 data URL
 */
export const isBase64DataUrl = (url) => {
    if (!url) return false;
    return url.startsWith('data:');
};

/**
 * Convert a File or base64 string to a File object
 */
const toFile = async (input, userId) => {
    if (input instanceof File) {
        return input;
    }

    // Convert base64 data URL to File
    if (typeof input === 'string' && input.startsWith('data:')) {
        const response = await fetch(input);
        const blob = await response.blob();
        const extension = blob.type.split('/')[1] || 'png';
        return new File([blob], `avatar.${extension}`, { type: blob.type });
    }

    return null;
};

/**
 * Upload an avatar to Supabase Storage
 * @param {string} userId - User's ID
 * @param {File|string} imageData - File object or base64 data URL
 * @returns {Promise<{url: string|null, error: string|null}>}
 */
export const uploadAvatar = async (userId, imageData) => {
    if (!userId) {
        return { url: null, error: 'User ID is required' };
    }

    try {
        const file = await toFile(imageData, userId);
        if (!file) {
            return { url: null, error: 'Invalid image data' };
        }

        // File path in storage: {userId}/avatar.{extension}
        const extension = file.name.split('.').pop() || 'png';
        const filePath = `${userId}/avatar.${extension}`;

        // Upload to Supabase Storage (upsert)
        const { data, error } = await supabase.storage
            .from('avatars')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: true, // Replace existing avatar
            });

        if (error) {
            console.error('[avatarService] Upload error:', error);
            return { url: null, error: error.message };
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);

        // Add cache-busting query param to force refresh
        const publicUrl = urlData?.publicUrl
            ? `${urlData.publicUrl}?t=${Date.now()}`
            : null;

        console.log('[avatarService] Upload successful:', publicUrl);
        return { url: publicUrl, error: null };

    } catch (err) {
        console.error('[avatarService] Exception:', err);
        return { url: null, error: err.message || 'Upload failed' };
    }
};

/**
 * Process avatar selection - returns the URL to save to database
 * - Preset avatars: Returns the path string as-is
 * - Custom uploads: Uploads to Storage and returns public URL
 * 
 * @param {string} userId - User's ID
 * @param {string} avatarValue - Either a preset path or base64 data URL
 * @returns {Promise<{url: string|null, error: string|null}>}
 */
export const processAvatarForSave = async (userId, avatarValue) => {
    if (!avatarValue) {
        return { url: null, error: null };
    }

    // If it's a preset avatar, just return the path
    if (isPresetAvatar(avatarValue)) {
        return { url: avatarValue, error: null };
    }

    // If it's already a storage URL (not base64), return as-is
    if (!isBase64DataUrl(avatarValue)) {
        return { url: avatarValue, error: null };
    }

    // It's a base64 upload - upload to Storage
    return await uploadAvatar(userId, avatarValue);
};

/**
 * Get the display URL for an avatar
 * Handles preset paths, storage URLs, and null values
 */
export const getAvatarDisplayUrl = (avatarUrl) => {
    if (!avatarUrl) {
        return null;
    }
    return avatarUrl;
};

/**
 * Delete user's avatar from storage
 */
export const deleteAvatar = async (userId) => {
    if (!userId) return { error: 'User ID required' };

    try {
        // List files in user's folder
        const { data: files, error: listError } = await supabase.storage
            .from('avatars')
            .list(userId);

        if (listError) {
            return { error: listError.message };
        }

        // Delete all files in user's folder
        if (files && files.length > 0) {
            const filePaths = files.map(f => `${userId}/${f.name}`);
            const { error: deleteError } = await supabase.storage
                .from('avatars')
                .remove(filePaths);

            if (deleteError) {
                return { error: deleteError.message };
            }
        }

        return { error: null };
    } catch (err) {
        return { error: err.message };
    }
};
