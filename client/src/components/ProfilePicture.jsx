import React, { useEffect, useState } from 'react';
import { User } from 'lucide-react';

/**
 * ProfilePicture - Centralized component for displaying profile pictures
 * 
 * Uses a vertical rectangle (portrait) aspect ratio to match the preset
 * avatar dimensions in /assets/profile-pic/
 * 
 * @param {string|null} avatarUrl - The avatar URL from database
 * @param {string} name - User's name for fallback initial display
 * @param {string} size - Size variant: 'sm' | 'md' | 'lg' | 'xl'
 * @param {string} className - Additional CSS classes
 * @param {boolean} rounded - Whether to use rounded corners (default: true)
 */

const SIZE_CLASSES = {
    sm: 'w-8 h-10',      // 32x40
    md: 'w-12 h-14',     // 48x56
    lg: 'w-16 h-20',     // 64x80
    xl: 'w-20 h-24',     // 80x96
};

const INITIAL_SIZE_CLASSES = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-lg',
    xl: 'text-xl',
};

const ProfilePicture = ({
    avatarUrl,
    name = '',
    size = 'md',
    className = '',
    rounded = true
}) => {
    const [imageError, setImageError] = useState(false);

    // Get the first letter of the name for fallback display
    const initial = name?.charAt(0)?.toUpperCase() || '?';

    // Determine if we should show the image or fallback
    const showImage = avatarUrl && !imageError;

    // Size classes
    const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
    const initialSizeClass = INITIAL_SIZE_CLASSES[size] || INITIAL_SIZE_CLASSES.md;
    const roundedClass = rounded ? 'rounded-2xl' : '';

    const handleImageError = () => {
        setImageError(true);
    };

    useEffect(() => {
        setImageError(false);
    }, [avatarUrl]);

    if (showImage) {
        return (
            <div
                className={`${sizeClass} ${roundedClass} overflow-hidden bg-gradient-to-br from-violet-100 to-pink-100 flex-shrink-0 ${className}`}
            >
                <img
                    src={avatarUrl}
                    alt={name || 'Profile'}
                    className="w-full h-full object-cover"
                    onError={handleImageError}
                />
            </div>
        );
    }

    // Fallback: Show initial or user icon
    return (
        <div
            className={`${sizeClass} ${roundedClass} bg-gradient-to-br from-violet-100 to-pink-100 flex items-center justify-center flex-shrink-0 ${className}`}
        >
            {name ? (
                <span className={`font-bold text-violet-500 ${initialSizeClass}`}>
                    {initial}
                </span>
            ) : (
                <User className="w-1/2 h-1/2 text-violet-400" />
            )}
        </div>
    );
};

export default ProfilePicture;
