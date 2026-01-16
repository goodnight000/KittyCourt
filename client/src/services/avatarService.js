/**
 * Avatar Service - Handles avatar uploads and URL management
 * 
 * Preset avatars: Stored as path strings (e.g., "/assets/profile-pic/cat.png")
 * Custom uploads: Compressed to 512x512 max, converted to WebP, uploaded to Supabase Storage
 */

import { supabase } from './supabase';

// List of preset avatars with metadata
export const PRESET_AVATARS = [
    { id: 'bear', path: '/assets/profile-pic/bear.png', label: 'Bear', labelKey: 'options.animals.bear' },
    { id: 'bunny', path: '/assets/profile-pic/bunny.png', label: 'Bunny', labelKey: 'options.animals.bunny' },
    { id: 'capybara', path: '/assets/profile-pic/capybara.png', label: 'Capybara', labelKey: 'options.animals.capybara' },
    { id: 'cat', path: '/assets/profile-pic/cat.png', label: 'Cat', labelKey: 'options.animals.cat' },
    { id: 'dog', path: '/assets/profile-pic/dog.png', label: 'Dog', labelKey: 'options.animals.dog' },
    { id: 'fox', path: '/assets/profile-pic/fox.png', label: 'Fox', labelKey: 'options.animals.fox' },
    { id: 'panda', path: '/assets/profile-pic/panda.png', label: 'Panda', labelKey: 'options.animals.panda' },
    { id: 'penguin', path: '/assets/profile-pic/penguin.png', label: 'Penguin', labelKey: 'options.animals.penguin' },
];

// Legacy: Array of just paths for backwards compatibility checks
export const PRESET_AVATAR_PATHS = PRESET_AVATARS.map(a => a.path);

/**
 * Check if a URL is a preset avatar path
 */
export const isPresetAvatar = (url) => {
    if (!url) return false;
    return PRESET_AVATAR_PATHS.includes(url) || url.startsWith('/assets/profile-pic/');
};

/**
 * Check if a URL is a base64 data URL
 */
export const isBase64DataUrl = (url) => {
    if (!url) return false;
    return url.startsWith('data:');
};

/**
 * Compress and resize an image for upload
 * - Max dimensions: 512x512 (maintaining aspect ratio)
 * - Format: WebP for optimal compression
 * - Quality: 0.8
 * 
 * @param {string} base64DataUrl - The base64 data URL of the image
 * @returns {Promise<Blob>} - Compressed image as a Blob
 */
export const compressImage = (base64DataUrl) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            // Calculate new dimensions (max 512x512, maintain aspect ratio)
            const MAX_SIZE = 512;
            let { width, height } = img;

            if (width > height) {
                if (width > MAX_SIZE) {
                    height = Math.round((height * MAX_SIZE) / width);
                    width = MAX_SIZE;
                }
            } else {
                if (height > MAX_SIZE) {
                    width = Math.round((width * MAX_SIZE) / height);
                    height = MAX_SIZE;
                }
            }

            // Create canvas and draw resized image
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Convert to WebP blob
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        if (import.meta.env.DEV) console.log(`[avatarService] Compressed image: ${Math.round(blob.size / 1024)}KB`);
                        resolve(blob);
                    } else {
                        reject(new Error('Failed to compress image'));
                    }
                },
                'image/webp',
                0.8
            );
        };
        img.onerror = () => reject(new Error('Failed to load image for compression'));
        img.src = base64DataUrl;
    });
};

/**
 * Convert a File, Blob, or base64 string to a File object
 * Applies compression for base64 data URLs
 */
const toFile = async (input) => {
    if (input instanceof File) {
        // If it's already a file, check if we should compress it
        if (input.size > 100 * 1024) { // Compress if > 100KB
            const reader = new FileReader();
            const base64 = await new Promise((resolve, reject) => {
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(input);
            });
            const blob = await compressImage(base64);
            return new File([blob], 'avatar.webp', { type: 'image/webp' });
        }
        return input;
    }

    // Convert base64 data URL to compressed File
    if (typeof input === 'string' && input.startsWith('data:')) {
        const blob = await compressImage(input);
        return new File([blob], 'avatar.webp', { type: 'image/webp' });
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
        const file = await toFile(imageData);
        if (!file) {
            return { url: null, error: 'Invalid image data' };
        }

        // Always use .webp extension for compressed uploads
        const filePath = `${userId}/avatar.webp`;

        // Upload to Supabase Storage (upsert)
        const { data, error } = await supabase.storage
            .from('avatars')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: true, // Replace existing avatar
                contentType: 'image/webp',
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

        if (import.meta.env.DEV) console.log('[avatarService] Upload successful:', publicUrl);
        return { url: publicUrl, error: null };

    } catch (err) {
        console.error('[avatarService] Exception:', err);
        return { url: null, error: err.message || 'Upload failed' };
    }
};

/**
 * Process avatar selection - returns the URL to save to database
 * - Preset avatars: Returns the path string as-is
 * - Custom uploads: Compresses and uploads to Storage, returns public URL
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

    // It's a base64 upload - compress and upload to Storage
    return await uploadAvatar(userId, avatarValue);
};

/**
 * Get the display URL for an avatar
 * Handles preset paths, storage URLs, and null values
 * 
 * @param {string|null} avatarUrl - The avatar URL from database
 * @returns {string|null} - The URL to display, or null
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
