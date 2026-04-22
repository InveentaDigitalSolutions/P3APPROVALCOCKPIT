/**
 * I-Stufe (Integration Level) master data.
 *
 * Source: Dataverse `crf4f_ilevels_1` (the post-Power-Query exploded form,
 * one row per iLevel × week offset). The current snapshot is committed as
 * JSON under `./generated/dataverse/ilevels.json`; refresh it by running
 * `node scripts/dump-dataverse.mjs`.
 *
 * Each I-Stufe is identified by SE_TERMIN-REIFE (e.g., "26-07-480").
 * An I-Stufe is "active" from its ATS WEEK through its SAB WEEK.
 * Offset positions: ATS WEEK (week 0), ATS+1 … ATS+7, SAB WEEK (last week).
 */

import ilevelsJson from './generated/dataverse/ilevels.json';

export interface IStufeMaster {
    /** Composite key: SE_TERMIN-REIFE, e.g. "26-07-480" */
    istufe: string;
    /** Delivery cycle, e.g. "26-07" */
    seTermin: string;
    /** Maturity level (integer). 500 = Serienreife */
    reife: number;
    /** ATS date (Software test start) */
    ats: string;
    /** SAB date (Software delivery deadline) */
    sab: string;
    /** ATS calendar week as "YYYY-WW" */
    atsWeek: string;
    /** SAB calendar week as "YYYY-WW" */
    sabWeek: string;
    /** All offset weeks: ATS WEEK, ATS+1 … ATS+7, SAB WEEK */
    offsetWeeks: { offset: string; week: string }[];
}

interface DvILevelJson {
    ilevel: string;
    number: number;
    ats: string;
    sab: string;
    offset: string;
    week: string;
}

/** Power Query emits "ATS" / "SAB"; app convention is "ATS WEEK" / "SAB WEEK". */
function normalizeOffset(o: string): string {
    if (o === 'ATS') return 'ATS WEEK';
    if (o === 'SAB') return 'SAB WEEK';
    return o;
}

function buildMasters(): IStufeMaster[] {
    const rows = ilevelsJson as DvILevelJson[];
    const map = new Map<string, IStufeMaster>();

    for (const r of rows) {
        if (!r.ilevel) continue;
        if (!map.has(r.ilevel)) {
            const parts = r.ilevel.split('-');
            const seTermin = parts.length >= 3 ? `${parts[0]}-${parts[1]}` : r.ilevel;
            const reife = Number(parts[parts.length - 1]) || r.number || 0;
            map.set(r.ilevel, {
                istufe: r.ilevel,
                seTermin,
                reife,
                ats: r.ats,
                sab: r.sab,
                atsWeek: '',
                sabWeek: '',
                offsetWeeks: [],
            });
        }
        const master = map.get(r.ilevel)!;
        const offset = normalizeOffset(r.offset);
        master.offsetWeeks.push({ offset, week: r.week });
        if (offset === 'ATS WEEK') master.atsWeek = r.week;
        if (offset === 'SAB WEEK') master.sabWeek = r.week;
    }

    const offsetOrder = ['ATS WEEK', 'ATS+1', 'ATS+2', 'ATS+3', 'ATS+4', 'ATS+5', 'ATS+6', 'ATS+7', 'SAB WEEK'];
    for (const m of map.values()) {
        m.offsetWeeks.sort((a, b) => {
            const ai = offsetOrder.indexOf(a.offset);
            const bi = offsetOrder.indexOf(b.offset);
            if (ai >= 0 && bi >= 0) return ai - bi;
            return a.week.localeCompare(b.week);
        });
    }

    return [...map.values()].sort((a, b) => {
        if (a.seTermin !== b.seTermin) return a.seTermin.localeCompare(b.seTermin);
        return a.reife - b.reife;
    });
}

/** All I-Stufe master records */
export const ISTUFE_MASTERS: IStufeMaster[] = buildMasters();

/** Parse "YYYY-WW" to numeric index for comparison */
export function weekToIndex(yw: string): number {
    const m = yw.match(/^(\d{4})-(\d{1,2})$/);
    if (!m) return 0;
    return parseInt(m[1]) * 100 + parseInt(m[2]);
}

/** Find all I-Stufen active in a given week (YYYY-WW format) */
export function getActiveIStufen(week: string): IStufeMaster[] {
    const idx = weekToIndex(week);
    return ISTUFE_MASTERS.filter(m => {
        const atsIdx = weekToIndex(m.atsWeek);
        const sabIdx = weekToIndex(m.sabWeek);
        return atsIdx <= idx && idx <= sabIdx;
    });
}

/** Get the offset label (ATS WEEK, ATS+1, etc.) for an I-Stufe in a given week */
export function getOffsetForWeek(master: IStufeMaster, week: string): string | null {
    const found = master.offsetWeeks.find(ow => ow.week === week);
    return found?.offset ?? null;
}

/** Unique SE_TERMIN values */
export const SE_TERMIN_LIST = [...new Set(ISTUFE_MASTERS.map(m => m.seTermin))];
