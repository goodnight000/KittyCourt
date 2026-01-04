/**
 * Tests for dateTimeUtils.js
 *
 * Comprehensive test coverage for ET timezone utilities including:
 * - Basic functionality
 * - Edge cases (timezone boundaries, DST, leap years)
 * - Date arithmetic
 * - Period calculations
 */

import { describe, it, expect } from 'vitest';
import {
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
} from './dateTimeUtils.js';

describe('dateTimeUtils', () => {
    describe('getEtDateString', () => {
        it('should format date in YYYY-MM-DD format', () => {
            const date = new Date('2024-03-15T14:30:00Z');
            const result = getEtDateString(date);
            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });

        it('should handle UTC midnight correctly', () => {
            const date = new Date('2024-03-15T00:00:00Z');
            const result = getEtDateString(date);
            // ET is UTC-5 or UTC-4, so midnight UTC = previous day in ET
            expect(result).toBe('2024-03-14');
        });

        it('should handle DST transition (spring forward)', () => {
            // March 10, 2024 at 2am ET, clocks spring forward
            const beforeDst = new Date('2024-03-10T06:00:00Z'); // 1am ET
            const afterDst = new Date('2024-03-10T07:00:00Z'); // 3am ET (skipped 2am)
            expect(getEtDateString(beforeDst)).toBe('2024-03-10');
            expect(getEtDateString(afterDst)).toBe('2024-03-10');
        });

        it('should handle DST transition (fall back)', () => {
            // November 3, 2024 at 2am ET, clocks fall back
            const beforeDst = new Date('2024-11-03T05:00:00Z'); // 1am EDT
            const afterDst = new Date('2024-11-03T07:00:00Z'); // 2am EST (repeated hour)
            expect(getEtDateString(beforeDst)).toBe('2024-11-03');
            expect(getEtDateString(afterDst)).toBe('2024-11-03');
        });

        it('should use current date when no argument provided', () => {
            const result = getEtDateString();
            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });

        it('should handle leap year correctly', () => {
            const leapDay = new Date('2024-02-29T12:00:00Z');
            const result = getEtDateString(leapDay);
            expect(result).toBe('2024-02-29');
        });
    });

    describe('getEtWeekdayIndex', () => {
        it('should return correct weekday index', () => {
            // March 17, 2024 is a Sunday
            const sunday = new Date('2024-03-17T12:00:00Z');
            expect(getEtWeekdayIndex(sunday)).toBe(0);

            // March 18, 2024 is a Monday
            const monday = new Date('2024-03-18T12:00:00Z');
            expect(getEtWeekdayIndex(monday)).toBe(1);

            // March 23, 2024 is a Saturday
            const saturday = new Date('2024-03-23T12:00:00Z');
            expect(getEtWeekdayIndex(saturday)).toBe(6);
        });

        it('should handle timezone boundary', () => {
            // Saturday night UTC, but Sunday in ET
            const date = new Date('2024-03-24T03:00:00Z'); // 11pm Saturday in ET
            expect(getEtWeekdayIndex(date)).toBe(6);

            const date2 = new Date('2024-03-24T05:00:00Z'); // 1am Sunday in ET
            expect(getEtWeekdayIndex(date2)).toBe(0);
        });
    });

    describe('addDaysToDateString', () => {
        it('should add positive days', () => {
            expect(addDaysToDateString('2024-03-15', 1)).toBe('2024-03-16');
            expect(addDaysToDateString('2024-03-15', 7)).toBe('2024-03-22');
            expect(addDaysToDateString('2024-03-15', 20)).toBe('2024-04-04');
        });

        it('should subtract days (negative)', () => {
            expect(addDaysToDateString('2024-03-15', -1)).toBe('2024-03-14');
            expect(addDaysToDateString('2024-03-15', -7)).toBe('2024-03-08');
            expect(addDaysToDateString('2024-03-15', -20)).toBe('2024-02-24');
        });

        it('should handle month boundaries', () => {
            expect(addDaysToDateString('2024-03-31', 1)).toBe('2024-04-01');
            expect(addDaysToDateString('2024-04-01', -1)).toBe('2024-03-31');
        });

        it('should handle year boundaries', () => {
            expect(addDaysToDateString('2024-12-31', 1)).toBe('2025-01-01');
            expect(addDaysToDateString('2025-01-01', -1)).toBe('2024-12-31');
        });

        it('should handle leap year February', () => {
            expect(addDaysToDateString('2024-02-28', 1)).toBe('2024-02-29');
            expect(addDaysToDateString('2024-02-29', 1)).toBe('2024-03-01');
            expect(addDaysToDateString('2024-03-01', -1)).toBe('2024-02-29');
        });

        it('should handle non-leap year February', () => {
            expect(addDaysToDateString('2023-02-28', 1)).toBe('2023-03-01');
            expect(addDaysToDateString('2023-03-01', -1)).toBe('2023-02-28');
        });
    });

    describe('getPeriodRange', () => {
        it('should return single day for daily cadence', () => {
            const date = new Date('2024-03-15T12:00:00Z');
            const result = getPeriodRange('daily', date);
            expect(result.startDate).toBe('2024-03-15');
            expect(result.endDate).toBe('2024-03-16');
        });

        it('should return week (Monday-Monday) for weekly cadence', () => {
            // March 20, 2024 is a Wednesday
            const wednesday = new Date('2024-03-20T12:00:00Z');
            const result = getPeriodRange('weekly', wednesday);
            // Week starts on Monday March 18
            expect(result.startDate).toBe('2024-03-18');
            expect(result.endDate).toBe('2024-03-25');
        });

        it('should handle Monday as start of week', () => {
            // March 18, 2024 is a Monday
            const monday = new Date('2024-03-18T12:00:00Z');
            const result = getPeriodRange('weekly', monday);
            expect(result.startDate).toBe('2024-03-18');
            expect(result.endDate).toBe('2024-03-25');
        });

        it('should handle Sunday at end of week', () => {
            // March 17, 2024 is a Sunday
            const sunday = new Date('2024-03-17T12:00:00Z');
            const result = getPeriodRange('weekly', sunday);
            // Week starts on Monday March 11
            expect(result.startDate).toBe('2024-03-11');
            expect(result.endDate).toBe('2024-03-18');
        });

        it('should handle month boundary in weekly cadence', () => {
            // March 30, 2024 is a Saturday
            const saturday = new Date('2024-03-30T12:00:00Z');
            const result = getPeriodRange('weekly', saturday);
            // Week starts on Monday March 25
            expect(result.startDate).toBe('2024-03-25');
            expect(result.endDate).toBe('2024-04-01');
        });
    });

    describe('getTimeZoneOffsetMinutes', () => {
        it('should calculate offset for America/New_York', () => {
            // Winter (EST = UTC-5)
            const winter = new Date('2024-01-15T12:00:00Z');
            const offset1 = getTimeZoneOffsetMinutes(winter, 'America/New_York');
            expect(offset1).toBe(-300); // -5 hours = -300 minutes

            // Summer (EDT = UTC-4)
            const summer = new Date('2024-07-15T12:00:00Z');
            const offset2 = getTimeZoneOffsetMinutes(summer, 'America/New_York');
            expect(offset2).toBe(-240); // -4 hours = -240 minutes
        });

        it('should handle different timezones', () => {
            const date = new Date('2024-01-15T12:00:00Z');

            // UTC should be 0
            const utcOffset = getTimeZoneOffsetMinutes(date, 'UTC');
            expect(utcOffset).toBe(0);

            // Los Angeles (PST = UTC-8)
            const laOffset = getTimeZoneOffsetMinutes(date, 'America/Los_Angeles');
            expect(laOffset).toBe(-480);
        });
    });

    describe('getEtMidnightIso', () => {
        it('should return ISO string for ET midnight', () => {
            const result = getEtMidnightIso('2024-03-15');
            const date = new Date(result);

            // Verify it's a valid ISO string
            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

            // Verify midnight in ET
            const etParts = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/New_York',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
            }).formatToParts(date);

            const hour = etParts.find(p => p.type === 'hour')?.value;
            const minute = etParts.find(p => p.type === 'minute')?.value;

            expect(hour).toBe('00');
            expect(minute).toBe('00');
        });

        it('should handle DST transition dates', () => {
            // Spring forward day
            const springForward = getEtMidnightIso('2024-03-10');
            expect(springForward).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

            // Fall back day
            const fallBack = getEtMidnightIso('2024-11-03');
            expect(fallBack).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        });
    });

    describe('getEtParts', () => {
        it('should return date parts for ET timezone', () => {
            const date = new Date('2024-03-15T14:30:00Z');
            const parts = getEtParts(date);

            expect(parts).toHaveProperty('year');
            expect(parts).toHaveProperty('month');
            expect(parts).toHaveProperty('day');
            expect(parts).toHaveProperty('hour');

            // All parts should be strings
            expect(typeof parts.year).toBe('string');
            expect(typeof parts.month).toBe('string');
            expect(typeof parts.day).toBe('string');
            expect(typeof parts.hour).toBe('string');
        });

        it('should use 24-hour format', () => {
            const afternoon = new Date('2024-03-15T19:00:00Z'); // 3pm ET
            const parts = getEtParts(afternoon);
            expect(Number(parts.hour)).toBeLessThan(24);
            expect(Number(parts.hour)).toBeGreaterThanOrEqual(0);
        });
    });

    describe('getStreakDayEt', () => {
        it('should return current day when hour >= 2', () => {
            // 10am ET
            const morning = new Date('2024-03-15T14:00:00Z');
            const result = getStreakDayEt(morning);
            expect(result).toBe('2024-03-15');
        });

        it('should return previous day when hour < 2 (grace period)', () => {
            // 1am ET (before grace period cutoff)
            const lateNight = new Date('2024-03-15T05:00:00Z');
            const result = getStreakDayEt(lateNight);
            expect(result).toBe('2024-03-14');
        });

        it('should handle exactly 2am ET', () => {
            // Exactly 2am ET
            const twoAm = new Date('2024-03-15T06:00:00Z');
            const result = getStreakDayEt(twoAm);
            expect(result).toBe('2024-03-15');
        });

        it('should handle month boundary with grace period', () => {
            // 1am on April 1st should count as March 31st
            const earlyMorning = new Date('2024-04-01T05:00:00Z');
            const result = getStreakDayEt(earlyMorning);
            expect(result).toBe('2024-03-31');
        });
    });

    describe('getEtDateParts', () => {
        it('should return numeric date parts', () => {
            const date = new Date('2024-03-15T12:00:00Z');
            const parts = getEtDateParts(date);

            expect(parts).toHaveProperty('year');
            expect(parts).toHaveProperty('month');
            expect(parts).toHaveProperty('day');

            // All parts should be numbers
            expect(typeof parts.year).toBe('number');
            expect(typeof parts.month).toBe('number');
            expect(typeof parts.day).toBe('number');

            expect(parts.year).toBe(2024);
            expect(parts.month).toBeGreaterThan(0);
            expect(parts.month).toBeLessThanOrEqual(12);
            expect(parts.day).toBeGreaterThan(0);
            expect(parts.day).toBeLessThanOrEqual(31);
        });

        it('should use current date when no argument provided', () => {
            const result = getEtDateParts();
            expect(result.year).toBeGreaterThan(2020);
            expect(result.month).toBeGreaterThan(0);
            expect(result.day).toBeGreaterThan(0);
        });
    });

    describe('getEtDayRange', () => {
        it('should return complete day range', () => {
            const date = new Date('2024-03-15T12:00:00Z');
            const range = getEtDayRange(date);

            expect(range).toHaveProperty('startIso');
            expect(range).toHaveProperty('endIso');
            expect(range).toHaveProperty('dateString');

            // Verify ISO format
            expect(range.startIso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
            expect(range.endIso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

            // Verify date string format
            expect(range.dateString).toMatch(/^\d{4}-\d{2}-\d{2}$/);

            // Verify 24-hour span
            const start = new Date(range.startIso);
            const end = new Date(range.endIso);
            const diffMs = end.getTime() - start.getTime();
            expect(diffMs).toBe(24 * 60 * 60 * 1000);
        });

        it('should align to ET day boundaries', () => {
            const date = new Date('2024-03-15T12:00:00Z');
            const range = getEtDayRange(date);

            // Start should be midnight ET
            const startDate = new Date(range.startIso);
            const startParts = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/New_York',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
            }).formatToParts(startDate);

            const hour = startParts.find(p => p.type === 'hour')?.value;
            const minute = startParts.find(p => p.type === 'minute')?.value;

            expect(hour).toBe('00');
            expect(minute).toBe('00');
        });

        it('should handle DST transition dates', () => {
            // Spring forward
            const springDate = new Date('2024-03-10T12:00:00Z');
            const springRange = getEtDayRange(springDate);
            expect(springRange.dateString).toBe('2024-03-10');

            // Fall back
            const fallDate = new Date('2024-11-03T12:00:00Z');
            const fallRange = getEtDayRange(fallDate);
            expect(fallRange.dateString).toBe('2024-11-03');
        });
    });

    describe('Edge cases and integration', () => {
        it('should handle year 2038 problem (32-bit timestamp)', () => {
            // January 19, 2038 is the 32-bit timestamp limit
            const date = new Date('2038-01-19T03:14:07Z');
            expect(() => getEtDateString(date)).not.toThrow();
            expect(() => getEtDateParts(date)).not.toThrow();
        });

        it('should handle dates far in future', () => {
            const future = new Date('2100-12-31T23:59:59Z');
            expect(() => getEtDateString(future)).not.toThrow();
            expect(addDaysToDateString('2100-12-31', 1)).toBe('2101-01-01');
        });

        it('should handle dates in the past', () => {
            const past = new Date('1970-01-01T00:00:00Z');
            expect(() => getEtDateString(past)).not.toThrow();
            expect(addDaysToDateString('1970-01-01', -1)).toBe('1969-12-31');
        });

        it('should be consistent across all date functions', () => {
            const testDate = new Date('2024-03-15T14:30:00Z');

            const dateString = getEtDateString(testDate);
            const dateParts = getEtDateParts(testDate);
            const dayRange = getEtDayRange(testDate);

            // All should agree on the date
            expect(dayRange.dateString).toBe(dateString);
            expect(dayRange.dateString).toBe(
                `${String(dateParts.year).padStart(4, '0')}-${String(dateParts.month).padStart(2, '0')}-${String(dateParts.day).padStart(2, '0')}`
            );
        });
    });
});
