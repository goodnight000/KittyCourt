/**
 * Date/Time Utilities
 *
 * Consolidated ET (America/New_York) timezone utilities for consistent
 * date handling across the application.
 *
 * All functions use Intl.DateTimeFormat for accurate timezone conversion
 * and handle DST transitions automatically.
 */

/**
 * Get ET date string in YYYY-MM-DD format
 * @param {Date} date - Date to convert (defaults to now)
 * @returns {string} Date string in YYYY-MM-DD format
 */
function getEtDateString(date = new Date()) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    const parts = formatter.formatToParts(date);
    const values = {};
    for (const part of parts) {
        if (part.type !== 'literal') {
            values[part.type] = part.value;
        }
    }
    return `${values.year}-${values.month}-${values.day}`;
}

/**
 * Get ET weekday index (0=Sunday, 6=Saturday)
 * @param {Date} date - Date to check (defaults to now)
 * @returns {number} Weekday index
 */
function getEtWeekdayIndex(date = new Date()) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        weekday: 'short',
    });
    const label = formatter.format(date);
    const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return map[label] ?? 0;
}

/**
 * Add days to a date string in YYYY-MM-DD format
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @param {number} days - Number of days to add (can be negative)
 * @returns {string} New date string in YYYY-MM-DD format
 */
function addDaysToDateString(dateString, days) {
    const [year, month, day] = String(dateString).split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

/**
 * Get period range (daily or weekly) in ET
 * @param {string} cadence - 'daily' or 'weekly'
 * @param {Date} now - Reference date (defaults to now)
 * @returns {object} { startDate, endDate } in YYYY-MM-DD format
 */
function getPeriodRange(cadence, now = new Date()) {
    const today = getEtDateString(now);

    if (cadence === 'daily') {
        return {
            startDate: today,
            endDate: addDaysToDateString(today, 1),
        };
    }

    // Weekly: Monday to Monday
    const weekdayIndex = getEtWeekdayIndex(now);
    const daysSinceMonday = (weekdayIndex + 6) % 7;
    const startDate = addDaysToDateString(today, -daysSinceMonday);

    return {
        startDate,
        endDate: addDaysToDateString(startDate, 7),
    };
}

/**
 * Get timezone offset in minutes for a specific date and timezone
 * @param {Date} date - Date to check
 * @param {string} timeZone - IANA timezone name
 * @returns {number} Offset in minutes
 */
function getTimeZoneOffsetMinutes(date, timeZone) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
    const parts = formatter.formatToParts(date);
    const values = {};
    for (const part of parts) {
        if (part.type !== 'literal') {
            values[part.type] = part.value;
        }
    }
    const asUtc = Date.UTC(
        Number(values.year),
        Number(values.month) - 1,
        Number(values.day),
        Number(values.hour),
        Number(values.minute),
        Number(values.second)
    );

    return (asUtc - date.getTime()) / 60000;
}

/**
 * Get ET midnight ISO string for a given date string
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {string} ISO string representing midnight ET for that date
 */
function getEtMidnightIso(dateString) {
    const [year, month, day] = String(dateString).split('-').map(Number);
    const utcMidnight = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    const offsetMinutes = getTimeZoneOffsetMinutes(utcMidnight, 'America/New_York');
    return new Date(utcMidnight.getTime() - offsetMinutes * 60000).toISOString();
}

/**
 * Get ET date parts (year, month, day, hour) for formatting
 * @param {Date} date - Date to parse
 * @returns {object} { year, month, day, hour } as strings
 */
function getEtParts(date) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const values = {};
    for (const part of parts) {
        if (part.type !== 'literal') {
            values[part.type] = part.value;
        }
    }
    return values;
}

/**
 * Get streak day in ET (rolls over at 2am ET for grace period)
 * Times before 2am ET count toward previous day for streak purposes.
 *
 * @param {Date} date - Date to check (defaults to now)
 * @returns {string} Date string in YYYY-MM-DD format
 */
function getStreakDayEt(date = new Date()) {
    const parts = getEtParts(date);
    const hour = Number(parts.hour);
    const dayString = `${parts.year}-${parts.month}-${parts.day}`;

    // If it's 2am or later, use current day
    if (Number.isNaN(hour) || hour >= 2) {
        return dayString;
    }

    // Before 2am, count as previous day
    const fallback = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
    fallback.setUTCDate(fallback.getUTCDate() - 1);
    return fallback.toISOString().slice(0, 10);
}

/**
 * Get ET date parts with numeric values for calculations
 * @param {Date} date - Date to parse (defaults to now)
 * @returns {object} { year, month, day } as numbers
 */
function getEtDateParts(date = new Date()) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    const parts = formatter.formatToParts(date);
    const values = {};
    for (const part of parts) {
        if (part.type !== 'literal') {
            values[part.type] = part.value;
        }
    }

    return {
        year: Number(values.year),
        month: Number(values.month),
        day: Number(values.day),
    };
}

/**
 * Get ET day range for database queries
 * Returns start/end ISO timestamps and date string for a given ET date.
 *
 * @param {Date} date - Date to check (defaults to now)
 * @returns {object} { startIso, endIso, dateString }
 */
function getEtDayRange(date = new Date()) {
    const { year, month, day } = getEtDateParts(date);
    const utcMidnight = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    const offsetMinutes = getTimeZoneOffsetMinutes(utcMidnight, 'America/New_York');
    const start = new Date(utcMidnight.getTime() - offsetMinutes * 60000);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    const dateString = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    return {
        startIso: start.toISOString(),
        endIso: end.toISOString(),
        dateString,
    };
}

module.exports = {
    getEtDateString,
    getEtWeekdayIndex,
    addDaysToDateString,
    getPeriodRange,
    getTimeZoneOffsetMinutes,
    getEtMidnightIso,
    getEtParts,
    getStreakDayEt,
    getEtDateParts,
    getEtDayRange,
};
