import type { KalenderwocheInfo } from '../types';

/** Returns ISO 8601 week number (Mon=start of week) */
export function getISOWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay() || 7; // Mon=1 … Sun=7
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Returns the year of the ISO week (may differ from calendar year near year boundaries) */
export function getISOWeekYear(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    return d.getUTCFullYear();
}

/** Returns the Monday of the given ISO week / year */
export function getMonday(week: number, year: number): Date {
    // Jan 4th is always in week 1
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const dayOfJan4 = jan4.getUTCDay() || 7;
    const weekOneMonday = new Date(jan4);
    weekOneMonday.setUTCDate(jan4.getUTCDate() - (dayOfJan4 - 1));
    const monday = new Date(weekOneMonday);
    monday.setUTCDate(weekOneMonday.getUTCDate() + (week - 1) * 7);
    return monday;
}

/** Formats a week/year pair as the internal key "KW10_2026" */
export function toKWKey(week: number, year: number): string {
    const w = String(week).padStart(2, '0');
    return `KW${w}_${year}`;
}

/** Parses "KW10_2026" or "10_2026" or "04_2026" to { week, year } */
export function parseKWKey(key: string): { week: number; year: number } | null {
    // Support both "KW10_2026" and "04_2026" (from Excel)
    const match = key.match(/(?:KW)?(\d{1,2})_(\d{4})/);
    if (!match) return null;
    return { week: parseInt(match[1], 10), year: parseInt(match[2], 10) };
}

/** Returns full KalenderwocheInfo for a given week/year */
export function getKWInfo(week: number, year: number): KalenderwocheInfo {
    const startDate = getMonday(week, year);
    const endDate = new Date(startDate);
    endDate.setUTCDate(startDate.getUTCDate() + 6);
    const w = String(week).padStart(2, '0');
    return {
        key: toKWKey(week, year),
        label: `KW ${w} / ${year}`,
        week,
        year,
        startDate,
        endDate,
    };
}

/** Returns KW info for relative weeks from today: -1 = last, 0 = current, +1 = next */
export function getRelativeKW(offset: number): KalenderwocheInfo {
    const today = new Date();
    const current = new Date(today);
    current.setUTCDate(today.getUTCDate() + offset * 7);
    const week = getISOWeek(current);
    const year = getISOWeekYear(current);
    return getKWInfo(week, year);
}

/** Returns the three weeks: last, current, next */
export function getDefaultWeeks(): KalenderwocheInfo[] {
    return [getRelativeKW(-1), getRelativeKW(0), getRelativeKW(1)];
}

/** Returns 3 weeks centered around the given week/year: [week-1, week, week+1] */
export function getWeeksAround(week: number, year: number): KalenderwocheInfo[] {
    const center = getMonday(week, year);

    const prevDate = new Date(center);
    prevDate.setUTCDate(center.getUTCDate() - 7);
    const prevW = getISOWeek(prevDate);
    const prevY = getISOWeekYear(prevDate);

    const nextDate = new Date(center);
    nextDate.setUTCDate(center.getUTCDate() + 7);
    const nextW = getISOWeek(nextDate);
    const nextY = getISOWeekYear(nextDate);

    return [
        getKWInfo(prevW, prevY),
        getKWInfo(week, year),
        getKWInfo(nextW, nextY),
    ];
}

/** Normalizes Excel KW keys like "04_2026" to internal "KW04_2026" */
export function normalizeKWKey(raw: string): string {
    if (!raw) return '';
    if (raw.startsWith('KW')) return raw;
    const parsed = parseKWKey(raw);
    if (!parsed) return raw;
    return toKWKey(parsed.week, parsed.year);
}

/** Formats a date string or Date as "DD.MM.YYYY" (German locale) */
export function formatDate(d: string | Date | null | undefined): string {
    if (!d) return '—';
    const date = typeof d === 'string' ? new Date(d) : d;
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
