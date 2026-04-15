/**
 * Freigabe schedule data — defines which approval level (Freigabelev)
 * each Speicher/WBS_TYPE combination must achieve by which week (START WEEK).
 * Source: Freigabe schedule table provided by user.
 */

export interface FreigabeScheduleEntry {
    bv: string;
    elektrReichweite: string;
    name: string;
    wbsType: string;
    muster: string;
    key: string;
    freigabeLevel: string;
    startWeek: string;
}

export const FREIGABE_SCHEDULE: FreigabeScheduleEntry[] = [
    // VS_I — D 1
    { bv: 'NA05', elektrReichweite: 'B6ROO', name: 'P-114758', wbsType: 'VS_I', muster: 'D 1', key: 'P-114758-VS_I', freigabeLevel: 'L4', startWeek: '2027-16' },
    { bv: 'NA05', elektrReichweite: 'B6ROO', name: 'P-114758', wbsType: 'VS_I', muster: 'D 1', key: 'P-114758-VS_I', freigabeLevel: 'RSTB', startWeek: '2026-46' },
    { bv: 'NA05', elektrReichweite: 'B6ROO', name: 'P-114758', wbsType: 'VS_I', muster: 'D 1', key: 'P-114758-VS_I', freigabeLevel: 'L3', startWeek: '2026-51' },
    { bv: 'NA05', elektrReichweite: 'B6ROO', name: 'P-114758', wbsType: 'VS_I', muster: 'D 1', key: 'P-114758-VS_I', freigabeLevel: 'L4', startWeek: '2027-16' },
    { bv: 'NA05', elektrReichweite: 'B6ROO', name: 'P-114758', wbsType: 'VS_I', muster: 'D 1', key: 'P-114758-VS_I', freigabeLevel: 'RSTB', startWeek: '2026-46' },
    { bv: 'NA05', elektrReichweite: 'B6ROO', name: 'P-114758', wbsType: 'VS_I', muster: 'D 1', key: 'P-114758-VS_I', freigabeLevel: 'L4', startWeek: '2027-16' },
    { bv: 'NA05', elektrReichweite: 'B6ROO', name: 'P-114758', wbsType: 'VS_I', muster: 'D 1', key: 'P-114758-VS_I', freigabeLevel: 'RSTB', startWeek: '2026-46' },
    { bv: 'NA05', elektrReichweite: 'B6ROO', name: 'P-114758', wbsType: 'VS_I', muster: 'D 1', key: 'P-114758-VS_I', freigabeLevel: 'L3', startWeek: '2026-51' },
    // VS1_I
    { bv: 'NA05', elektrReichweite: 'B6ROO', name: 'P-114758', wbsType: 'VS1_I', muster: '', key: 'P-114758-VS1_I', freigabeLevel: 'L2', startWeek: '2025-13' },
    // EBG_I
    { bv: 'NA05', elektrReichweite: 'B6ROO', name: 'P-114758', wbsType: 'EBG_I', muster: '', key: 'P-114758-EBG_I', freigabeLevel: 'RSTB', startWeek: '2025-13' },
    // PVL_I — C 1
    { bv: 'NA05', elektrReichweite: 'B6ROO', name: 'P-114758', wbsType: 'PVL_I', muster: 'C 1', key: 'P-114758-PVL_I', freigabeLevel: 'RSTB', startWeek: '2026-15' },
    { bv: 'NA05', elektrReichweite: 'B6ROO', name: 'P-114758', wbsType: 'PVL_I', muster: 'C 1', key: 'P-114758-PVL_I', freigabeLevel: 'L2', startWeek: '2026-21' },
    { bv: 'NA05', elektrReichweite: 'B6ROO', name: 'P-114758', wbsType: 'PVL_I', muster: 'C 1', key: 'P-114758-PVL_I', freigabeLevel: 'L1', startWeek: '2026-17' },
    { bv: 'NA05', elektrReichweite: 'B6ROO', name: 'P-114758', wbsType: 'PVL_I', muster: 'C 1', key: 'P-114758-PVL_I', freigabeLevel: 'L3', startWeek: '2026-27' },
    { bv: 'NA05', elektrReichweite: 'B6ROO', name: 'P-114758', wbsType: 'PVL_I', muster: 'C 1', key: 'P-114758-PVL_I', freigabeLevel: 'RSTB', startWeek: '2026-15' },
    { bv: 'NA05', elektrReichweite: 'B6ROO', name: 'P-114758', wbsType: 'PVL_I', muster: 'C 1', key: 'P-114758-PVL_I', freigabeLevel: 'L2', startWeek: '2026-21' },
    { bv: 'NA05', elektrReichweite: 'B6ROO', name: 'P-114758', wbsType: 'PVL_I', muster: 'C 1', key: 'P-114758-PVL_I', freigabeLevel: 'L1', startWeek: '2026-17' },
    { bv: 'NA05', elektrReichweite: 'B6ROO', name: 'P-114758', wbsType: 'PVL_I', muster: 'C 1', key: 'P-114758-PVL_I', freigabeLevel: 'L3', startWeek: '2026-27' },
    { bv: 'NA05', elektrReichweite: 'B6ROO', name: 'P-114758', wbsType: 'PVL_I', muster: 'C 1', key: 'P-114758-PVL_I', freigabeLevel: 'RSTB', startWeek: '2026-15' },
    { bv: 'NA05', elektrReichweite: 'B6ROO', name: 'P-114758', wbsType: 'PVL_I', muster: 'C 1', key: 'P-114758-PVL_I', freigabeLevel: 'L2', startWeek: '2026-21' },
    { bv: 'NA05', elektrReichweite: 'B6ROO', name: 'P-114758', wbsType: 'PVL_I', muster: 'C 1', key: 'P-114758-PVL_I', freigabeLevel: 'L1', startWeek: '2026-17' },
    { bv: 'NA05', elektrReichweite: 'B6ROO', name: 'P-114758', wbsType: 'PVL_I', muster: 'C 1', key: 'P-114758-PVL_I', freigabeLevel: 'L3', startWeek: '2026-27' },
    { bv: 'NA05', elektrReichweite: 'B6ROO', name: 'P-114758', wbsType: 'PVL_I', muster: 'C 1', key: 'P-114758-PVL_I', freigabeLevel: 'RSTB', startWeek: '2026-15' },
    { bv: 'NA05', elektrReichweite: 'B6ROO', name: 'P-114758', wbsType: 'PVL_I', muster: 'C 1', key: 'P-114758-PVL_I', freigabeLevel: 'L2', startWeek: '2026-21' },
    { bv: 'NA05', elektrReichweite: 'B6ROO', name: 'P-114758', wbsType: 'PVL_I', muster: 'C 1', key: 'P-114758-PVL_I', freigabeLevel: 'L1', startWeek: '2026-17' },
    { bv: 'NA05', elektrReichweite: 'B6ROO', name: 'P-114758', wbsType: 'PVL_I', muster: 'C 1', key: 'P-114758-PVL_I', freigabeLevel: 'L3', startWeek: '2026-27' },
    // BBG_II — B 2
    { bv: 'NA05', elektrReichweite: 'B6ROO', name: 'P-114758', wbsType: 'BBG_II', muster: 'B 2', key: 'P-114758-BBG_II', freigabeLevel: 'RSTB', startWeek: '2025-31' },
    { bv: 'NA05', elektrReichweite: 'B6ROO', name: 'P-114758', wbsType: 'BBG_II', muster: 'B 2', key: 'P-114758-BBG_II', freigabeLevel: 'RSTB', startWeek: '2025-31' },
    { bv: 'NA05', elektrReichweite: 'B6ROO', name: 'P-114758', wbsType: 'BBG_II', muster: 'B 2', key: 'P-114758-BBG_II', freigabeLevel: 'L2', startWeek: '2025-35' },
    { bv: 'NA05', elektrReichweite: 'B6ROO', name: 'P-114758', wbsType: 'BBG_II', muster: 'B 2', key: 'P-114758-BBG_II', freigabeLevel: 'RSTB', startWeek: '2025-21' },
    // BBG_I — B 1
    { bv: 'NA05', elektrReichweite: 'B6ROO', name: 'P-114758', wbsType: 'BBG_I', muster: 'B 1', key: 'P-114758-BBG_I', freigabeLevel: 'L1', startWeek: '2025-27' },
    { bv: 'NA05', elektrReichweite: 'B6ROO', name: 'P-114758', wbsType: 'BBG_I', muster: 'B 1', key: 'P-114758-BBG_I', freigabeLevel: 'RSTB', startWeek: '2025-21' },
    { bv: 'NA05', elektrReichweite: 'B6ROO', name: 'P-114758', wbsType: 'BBG_I', muster: 'B 1', key: 'P-114758-BBG_I', freigabeLevel: 'L2', startWeek: '2025-27' },
    // KSP_I
    { bv: 'NA05', elektrReichweite: 'B6ROO', name: 'P-114758', wbsType: 'KSP_I', muster: '', key: 'P-114758-KSP_I', freigabeLevel: 'RSTB', startWeek: '2025-19' },
];

/**
 * Deduplicated schedule: unique combinations of key + freigabeLevel + startWeek.
 */
export const FREIGABE_SCHEDULE_UNIQUE = (() => {
    const seen = new Set<string>();
    return FREIGABE_SCHEDULE.filter(e => {
        const k = `${e.key}|${e.freigabeLevel}|${e.startWeek}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
    });
})();

/** Get schedule entries for a specific WBS_TYPE key */
export function getScheduleByKey(key: string): FreigabeScheduleEntry[] {
    return FREIGABE_SCHEDULE_UNIQUE.filter(e => e.key === key);
}

/** Get all schedule entries grouped by key */
export function getScheduleGroupedByKey(): Map<string, FreigabeScheduleEntry[]> {
    const map = new Map<string, FreigabeScheduleEntry[]>();
    for (const e of FREIGABE_SCHEDULE_UNIQUE) {
        if (!map.has(e.key)) map.set(e.key, []);
        map.get(e.key)!.push(e);
    }
    return map;
}
