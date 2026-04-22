/**
 * Freigabe schedule data — SOLL approval milestones per (Speicher × WBS_TYPE).
 *
 * Source: Dataverse `crf4f_ip3_freigaben` (HVS ⋈ CDH_IP3 join). Current snapshot
 * is committed as JSON under `./generated/dataverse/ip3_freigaben.json`;
 * refresh by running `node scripts/dump-dataverse.mjs`.
 */

import ip3FreigabenJson from './generated/dataverse/ip3_freigaben.json';

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

interface DvIp3FreigabenJson {
    key: string;
    sollFreigabe: string;
    startWeek: string;
    wbsType: string;
    monatjahr: string;
    sop: string;
    penthouse: string;
}

function buildSchedule(): FreigabeScheduleEntry[] {
    const rows = ip3FreigabenJson as DvIp3FreigabenJson[];
    return rows
        .filter(r => r.key && r.sollFreigabe && r.startWeek)
        .map(r => {
            // key format: "P-114758-VS_I" → name = "P-114758", wbsType = suffix after first "-"
            const firstDash = r.key.indexOf('-');
            const name = firstDash > 0 ? r.key.slice(0, firstDash) : r.key;
            return {
                // TODO: BRV hardcoded — see TODO in speicherData.ts; applies the same way here
                bv: 'NA05',
                elektrReichweite: '',
                name,
                wbsType: r.wbsType,
                muster: '',
                key: r.key,
                freigabeLevel: r.sollFreigabe,
                startWeek: r.startWeek,
            };
        });
}

export const FREIGABE_SCHEDULE: FreigabeScheduleEntry[] = buildSchedule();

/** Deduplicated schedule: unique combinations of key + freigabeLevel + startWeek. */
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
