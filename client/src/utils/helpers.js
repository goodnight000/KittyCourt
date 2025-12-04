import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes with clsx and tailwind-merge
 * Handles conditional classes and removes conflicting Tailwind classes
 */
export function cn(...inputs) {
    return twMerge(clsx(inputs));
}

/**
 * Format kibble balance with commas
 */
export function formatKibble(amount) {
    return new Intl.NumberFormat().format(amount);
}

/**
 * Get a random encouraging cat message
 */
export function getRandomCatMessage() {
    const messages = [
        "Purr-fectly acceptable! 🐱",
        "The judge approves... for now. 👁️",
        "Meow-gnificent work! ✨",
        "You've earned my respect (and maybe some kibble) 🪙",
        "The court is pleased! ⚖️",
        "Excellent submission, human! 📜",
        "*approving purr* 😺",
        "Justice has been served! 🎉",
    ];
    return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Get mood emoji based on vibe score
 */
export function getVibeEmoji(score) {
    if (score >= 90) return '😻';
    if (score >= 70) return '😺';
    if (score >= 50) return '🐱';
    if (score >= 30) return '😿';
    return '🙀';
}

/**
 * Get streak message based on days
 */
export function getStreakMessage(days) {
    if (days >= 30) return "Legendary lovers! 👑";
    if (days >= 14) return "Paw-some duo! 🌟";
    if (days >= 7) return "Keeping the love alive! 💕";
    if (days >= 3) return "Great start! 🐾";
    return "Just getting started! ✨";
}

/**
 * Validate a date string or Date object
 * Returns an object with { isValid, error }
 * 
 * @param {string|Date} dateInput - The date to validate
 * @param {Object} options - Validation options
 * @param {boolean} options.allowFuture - Whether to allow future dates (default: false)
 * @param {number} options.minYear - Minimum allowed year (default: 1900)
 * @param {number} options.maxYear - Maximum allowed year (default: current year)
 * @returns {{ isValid: boolean, error: string|null, date: Date|null }}
 */
export function validateDate(dateInput, options = {}) {
    const {
        allowFuture = false,
        minYear = 1900,
        maxYear = new Date().getFullYear()
    } = options;

    // Handle null/undefined
    if (!dateInput) {
        return { isValid: false, error: 'Date is required', date: null };
    }

    // Parse the date
    let date;
    if (dateInput instanceof Date) {
        date = dateInput;
    } else if (typeof dateInput === 'string') {
        // Handle YYYY-MM-DD format
        date = new Date(dateInput);
    } else {
        return { isValid: false, error: 'Invalid date format', date: null };
    }

    // Check if date is valid
    if (isNaN(date.getTime())) {
        return { isValid: false, error: 'Invalid date', date: null };
    }

    const year = date.getFullYear();
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today

    // Check year range
    if (year < minYear) {
        return { isValid: false, error: `Year must be ${minYear} or later`, date: null };
    }

    if (year > maxYear) {
        return { isValid: false, error: `Year must be ${maxYear} or earlier`, date: null };
    }

    // Check if date is in the future
    if (!allowFuture && date > today) {
        return { isValid: false, error: 'Date cannot be in the future', date: null };
    }

    return { isValid: true, error: null, date };
}

/**
 * Validate an anniversary date specifically
 * Must be a valid past date between 1900 and today
 */
export function validateAnniversaryDate(dateInput) {
    return validateDate(dateInput, {
        allowFuture: false,
        minYear: 1900
    });
}

/**
 * Validate a birthday date specifically
 * Must be a valid past date, person must be at least 13 years old
 */
export function validateBirthdayDate(dateInput) {
    const result = validateDate(dateInput, {
        allowFuture: false,
        minYear: 1900
    });

    if (!result.isValid) return result;

    // Check minimum age (13 years)
    const today = new Date();
    const birthDate = result.date;
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

    if (age < 13) {
        return { isValid: false, error: 'You must be at least 13 years old', date: null };
    }

    if (age > 120) {
        return { isValid: false, error: 'Please enter a valid birth year', date: null };
    }

    return result;
}

/**
 * Format a date for display
 */
export function formatDate(dateInput, options = {}) {
    if (!dateInput) return '';
    
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(date.getTime())) return '';

    const defaultOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    };

    return date.toLocaleDateString('en-US', { ...defaultOptions, ...options });
}
