import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { translate } from '../i18n';

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
export function getRandomCatMessage(language) {
    const fallbackMessages = [
        "Purr-fectly acceptable!",
        "The judge approves... for now.",
        "Meow-gnificent work!",
        "You've earned my respect (and maybe some kibble).",
        "The court is pleased!",
        "Excellent submission, human!",
        "*approving purr*",
        "Justice has been served!",
    ];
    const messages = translate(language, 'common.catMessages');
    const options = Array.isArray(messages) && messages.length > 0 ? messages : fallbackMessages;
    return options[Math.floor(Math.random() * options.length)];
}

/**
 * Get mood emoji based on vibe score
 */
export function getVibeEmoji(score) {
    if (score >= 90) return 'excited';
    if (score >= 70) return 'happy';
    if (score >= 50) return 'neutral';
    if (score >= 30) return 'sad';
    return 'worried';
}

/**
 * Get streak message based on days
 */
export function getStreakMessage(days, language) {
    const fallbackMessages = {
        legendary: "Legendary lovers!",
        pawSome: "Paw-some duo!",
        steady: "Keeping the love alive!",
        start: "Great start!",
        new: "Just getting started!",
    };
    const messageSet = translate(language, 'common.streakMessages');
    const resolved = messageSet && typeof messageSet === 'object' && !Array.isArray(messageSet)
        ? messageSet
        : fallbackMessages;
    if (days >= 30) return resolved.legendary || fallbackMessages.legendary;
    if (days >= 14) return resolved.pawSome || fallbackMessages.pawSome;
    if (days >= 7) return resolved.steady || fallbackMessages.steady;
    if (days >= 3) return resolved.start || fallbackMessages.start;
    return resolved.new || fallbackMessages.new;
}

/**
 * Validate a date string or Date object
 * Returns an object with { isValid, error, errorCode, meta }
 * 
 * @param {string|Date} dateInput - The date to validate
 * @param {Object} options - Validation options
 * @param {boolean} options.allowFuture - Whether to allow future dates (default: false)
 * @param {number} options.minYear - Minimum allowed year (default: 1900)
 * @param {number} options.maxYear - Maximum allowed year (default: current year)
 * @returns {{ isValid: boolean, error: string|null, errorCode?: string|null, meta?: Record<string, unknown>, date: Date|null }}
 */
export function validateDate(dateInput, options = {}) {
    const {
        allowFuture = false,
        minYear = 1900,
        maxYear = new Date().getFullYear()
    } = options;

    // Handle null/undefined
    if (!dateInput) {
        return { isValid: false, errorCode: 'DATE_REQUIRED', error: 'Date is required', date: null };
    }

    // Parse the date
    let date;
    if (dateInput instanceof Date) {
        date = dateInput;
    } else if (typeof dateInput === 'string') {
        // Handle YYYY-MM-DD format
        date = new Date(dateInput);
    } else {
        return { isValid: false, errorCode: 'INVALID_DATE_FORMAT', error: 'Invalid date format', date: null };
    }

    // Check if date is valid
    if (isNaN(date.getTime())) {
        return { isValid: false, errorCode: 'INVALID_DATE', error: 'Invalid date', date: null };
    }

    const year = date.getFullYear();
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today

    // Check year range
    if (year < minYear) {
        return {
            isValid: false,
            errorCode: 'YEAR_TOO_EARLY',
            error: `Year must be ${minYear} or later`,
            date: null,
            meta: { minYear }
        };
    }

    if (year > maxYear) {
        return {
            isValid: false,
            errorCode: 'YEAR_TOO_LATE',
            error: `Year must be ${maxYear} or earlier`,
            date: null,
            meta: { maxYear }
        };
    }

    // Check if date is in the future
    if (!allowFuture && date > today) {
        return { isValid: false, errorCode: 'DATE_IN_FUTURE', error: 'Date cannot be in the future', date: null };
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
        return { isValid: false, errorCode: 'AGE_TOO_YOUNG', error: 'You must be at least 13 years old', date: null };
    }

    if (age > 120) {
        return { isValid: false, errorCode: 'AGE_TOO_OLD', error: 'Please enter a valid birth year', date: null };
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

    const { locale, ...formatOptions } = options;
    const defaultOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    };

    const resolvedLocale = locale || 'en-US';
    return date.toLocaleDateString(resolvedLocale, { ...defaultOptions, ...formatOptions });
}

/**
 * Basic email format validation used by auth forms
 */
export function validateEmail(emailInput) {
    const email = (emailInput || '').trim();
    if (!email) {
        return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
