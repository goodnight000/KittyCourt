/**
 * Date formatting utilities with i18n support
 * Consolidates duplicate date parsing logic from CalendarPage, CaseDetailPage, DailyMeowPage
 */

/**
 * Parses local date string (YYYY-MM-DD) to Date object
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {Date|null} Date object or null if invalid
 */
export const parseLocalDate = (dateString) => {
  if (!dateString || typeof dateString !== 'string') return null;

  const parts = dateString.split('-');
  if (parts.length !== 3) return null;

  const [year, month, day] = parts.map(Number);

  // Validate numbers
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  return new Date(year, month - 1, day);
};

/**
 * Formats Date to local date string (YYYY-MM-DD)
 * @param {Date} date - Date object to format
 * @returns {string} Date string in YYYY-MM-DD format
 */
export const formatLocalDate = (date) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

/**
 * Formats date for display with i18n support
 * @param {Date} date - Date object to format
 * @param {string} locale - Locale code (e.g., 'en', 'zh-Hans')
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export const formatDisplayDate = (date, locale = 'en', options = {}) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';

  const defaultOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...options
  };

  try {
    return new Intl.DateTimeFormat(locale, defaultOptions).format(date);
  } catch (error) {
    // Fallback to English if locale not supported
    return new Intl.DateTimeFormat('en', defaultOptions).format(date);
  }
};

/**
 * Gets relative time string (e.g., "2 days ago", "Today")
 * @param {Date} date - Date to compare
 * @param {string} locale - Locale code
 * @returns {string} Relative time string
 */
export const getRelativeTime = (date, locale = 'en') => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Today
  if (diffDays === 0) {
    return locale === 'zh-Hans' ? '今天' : 'Today';
  }

  // Yesterday
  if (diffDays === 1) {
    return locale === 'zh-Hans' ? '昨天' : 'Yesterday';
  }

  // Within a week
  if (diffDays < 7 && diffDays > 0) {
    return locale === 'zh-Hans' ? `${diffDays}天前` : `${diffDays} days ago`;
  }

  // Within a month
  if (diffDays < 30 && diffDays >= 7) {
    const weeks = Math.floor(diffDays / 7);
    return locale === 'zh-Hans' ? `${weeks}周前` : `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  }

  // Older - show formatted date
  return formatDisplayDate(date, locale);
};

/**
 * Checks if a date is today
 * @param {Date} date - Date to check
 * @returns {boolean} True if date is today
 */
export const isToday = (date) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return false;

  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
};

/**
 * Checks if a date is in the past
 * @param {Date} date - Date to check
 * @returns {boolean} True if date is in the past
 */
export const isPast = (date) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return false;
  return date < new Date();
};

/**
 * Checks if a date is in the future
 * @param {Date} date - Date to check
 * @returns {boolean} True if date is in the future
 */
export const isFuture = (date) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return false;
  return date > new Date();
};

/**
 * Adds days to a date
 * @param {Date} date - Starting date
 * @param {number} days - Number of days to add (can be negative)
 * @returns {Date} New date with days added
 */
export const addDays = (date, days) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return null;

  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

/**
 * Gets the start of day (00:00:00) for a date
 * @param {Date} date - Date to process
 * @returns {Date} Date set to start of day
 */
export const startOfDay = (date) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return null;

  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

/**
 * Gets the end of day (23:59:59.999) for a date
 * @param {Date} date - Date to process
 * @returns {Date} Date set to end of day
 */
export const endOfDay = (date) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return null;

  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
};
