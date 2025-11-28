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
