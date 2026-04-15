/**
 * I-Stufe (Integration Level) reference data.
 * Source: I-Stufenübersicht Excel — unpivoted rows per ATS offset week.
 *
 * Each I-Stufe is identified by BRV-SE_TERMIN-REIFE (e.g., NA05-26-07-160).
 * An I-Stufe is "active" from its ATS WEEK through its SAB WEEK.
 * Offset positions: ATS WEEK (week 0), ATS+1 … ATS+7, SAB WEEK (last week).
 */

export interface IStufeMaster {
    /** Composite key: BRV-SE_TERMIN-REIFE, e.g. "NA05-26-07-160" */
    istufe: string;
    brv: string;
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

/** Raw unpivoted rows from the Excel */
interface RawRow {
    istufe: string;
    brv: string;
    seTermin: string;
    reife: number;
    ats: string;
    sab: string;
    offset: string;
    week: string;
}

const RAW_ROWS: RawRow[] = [
    // ══════════════════════════════════════════════════════
    // SE_TERMIN 26-07 — active I-Stufen around current date
    // ══════════════════════════════════════════════════════

    // ── REIFE 460: ATS=KW08, SAB=KW16 (Feb 16 – Apr 13 2026) ──
    { istufe: 'NA05-26-07-460', brv: 'NA05', seTermin: '26-07', reife: 460, ats: '2026-02-16', sab: '2026-04-13', offset: 'ATS WEEK', week: '2026-08' },
    { istufe: 'NA05-26-07-460', brv: 'NA05', seTermin: '26-07', reife: 460, ats: '2026-02-16', sab: '2026-04-13', offset: 'ATS+1', week: '2026-09' },
    { istufe: 'NA05-26-07-460', brv: 'NA05', seTermin: '26-07', reife: 460, ats: '2026-02-16', sab: '2026-04-13', offset: 'ATS+2', week: '2026-10' },
    { istufe: 'NA05-26-07-460', brv: 'NA05', seTermin: '26-07', reife: 460, ats: '2026-02-16', sab: '2026-04-13', offset: 'ATS+3', week: '2026-11' },
    { istufe: 'NA05-26-07-460', brv: 'NA05', seTermin: '26-07', reife: 460, ats: '2026-02-16', sab: '2026-04-13', offset: 'ATS+4', week: '2026-12' },
    { istufe: 'NA05-26-07-460', brv: 'NA05', seTermin: '26-07', reife: 460, ats: '2026-02-16', sab: '2026-04-13', offset: 'ATS+5', week: '2026-13' },
    { istufe: 'NA05-26-07-460', brv: 'NA05', seTermin: '26-07', reife: 460, ats: '2026-02-16', sab: '2026-04-13', offset: 'ATS+6', week: '2026-14' },
    { istufe: 'NA05-26-07-460', brv: 'NA05', seTermin: '26-07', reife: 460, ats: '2026-02-16', sab: '2026-04-13', offset: 'ATS+7', week: '2026-15' },
    { istufe: 'NA05-26-07-460', brv: 'NA05', seTermin: '26-07', reife: 460, ats: '2026-02-16', sab: '2026-04-13', offset: 'SAB WEEK', week: '2026-16' },

    // ── REIFE 480: ATS=KW13, SAB=KW21 (Mar 23 – May 18 2026) ──
    { istufe: 'NA05-26-07-480', brv: 'NA05', seTermin: '26-07', reife: 480, ats: '2026-03-23', sab: '2026-05-18', offset: 'ATS WEEK', week: '2026-13' },
    { istufe: 'NA05-26-07-480', brv: 'NA05', seTermin: '26-07', reife: 480, ats: '2026-03-23', sab: '2026-05-18', offset: 'ATS+1', week: '2026-14' },
    { istufe: 'NA05-26-07-480', brv: 'NA05', seTermin: '26-07', reife: 480, ats: '2026-03-23', sab: '2026-05-18', offset: 'ATS+2', week: '2026-15' },
    { istufe: 'NA05-26-07-480', brv: 'NA05', seTermin: '26-07', reife: 480, ats: '2026-03-23', sab: '2026-05-18', offset: 'ATS+3', week: '2026-16' },
    { istufe: 'NA05-26-07-480', brv: 'NA05', seTermin: '26-07', reife: 480, ats: '2026-03-23', sab: '2026-05-18', offset: 'ATS+4', week: '2026-17' },
    { istufe: 'NA05-26-07-480', brv: 'NA05', seTermin: '26-07', reife: 480, ats: '2026-03-23', sab: '2026-05-18', offset: 'ATS+5', week: '2026-18' },
    { istufe: 'NA05-26-07-480', brv: 'NA05', seTermin: '26-07', reife: 480, ats: '2026-03-23', sab: '2026-05-18', offset: 'ATS+6', week: '2026-19' },
    { istufe: 'NA05-26-07-480', brv: 'NA05', seTermin: '26-07', reife: 480, ats: '2026-03-23', sab: '2026-05-18', offset: 'ATS+7', week: '2026-20' },
    { istufe: 'NA05-26-07-480', brv: 'NA05', seTermin: '26-07', reife: 480, ats: '2026-03-23', sab: '2026-05-18', offset: 'SAB WEEK', week: '2026-21' },

    // ── REIFE 500 (Serienreife): ATS=KW18, SAB=KW26 (Apr 27 – Jun 22 2026) ──
    { istufe: 'NA05-26-07-500', brv: 'NA05', seTermin: '26-07', reife: 500, ats: '2026-04-27', sab: '2026-06-22', offset: 'ATS WEEK', week: '2026-18' },
    { istufe: 'NA05-26-07-500', brv: 'NA05', seTermin: '26-07', reife: 500, ats: '2026-04-27', sab: '2026-06-22', offset: 'ATS+1', week: '2026-19' },
    { istufe: 'NA05-26-07-500', brv: 'NA05', seTermin: '26-07', reife: 500, ats: '2026-04-27', sab: '2026-06-22', offset: 'ATS+2', week: '2026-20' },
    { istufe: 'NA05-26-07-500', brv: 'NA05', seTermin: '26-07', reife: 500, ats: '2026-04-27', sab: '2026-06-22', offset: 'ATS+3', week: '2026-21' },
    { istufe: 'NA05-26-07-500', brv: 'NA05', seTermin: '26-07', reife: 500, ats: '2026-04-27', sab: '2026-06-22', offset: 'ATS+4', week: '2026-22' },
    { istufe: 'NA05-26-07-500', brv: 'NA05', seTermin: '26-07', reife: 500, ats: '2026-04-27', sab: '2026-06-22', offset: 'ATS+5', week: '2026-23' },
    { istufe: 'NA05-26-07-500', brv: 'NA05', seTermin: '26-07', reife: 500, ats: '2026-04-27', sab: '2026-06-22', offset: 'ATS+6', week: '2026-24' },
    { istufe: 'NA05-26-07-500', brv: 'NA05', seTermin: '26-07', reife: 500, ats: '2026-04-27', sab: '2026-06-22', offset: 'ATS+7', week: '2026-25' },
    { istufe: 'NA05-26-07-500', brv: 'NA05', seTermin: '26-07', reife: 500, ats: '2026-04-27', sab: '2026-06-22', offset: 'SAB WEEK', week: '2026-26' },

    // ══════════════════════════════════════════════════════
    // SE_TERMIN 26-11 — overlapping delivery cycle
    // ══════════════════════════════════════════════════════

    // ── REIFE 420: ATS=KW10, SAB=KW18 (Mar 2 – Apr 27 2026) ──
    { istufe: 'NA05-26-11-420', brv: 'NA05', seTermin: '26-11', reife: 420, ats: '2026-03-02', sab: '2026-04-27', offset: 'ATS WEEK', week: '2026-10' },
    { istufe: 'NA05-26-11-420', brv: 'NA05', seTermin: '26-11', reife: 420, ats: '2026-03-02', sab: '2026-04-27', offset: 'ATS+1', week: '2026-11' },
    { istufe: 'NA05-26-11-420', brv: 'NA05', seTermin: '26-11', reife: 420, ats: '2026-03-02', sab: '2026-04-27', offset: 'ATS+2', week: '2026-12' },
    { istufe: 'NA05-26-11-420', brv: 'NA05', seTermin: '26-11', reife: 420, ats: '2026-03-02', sab: '2026-04-27', offset: 'ATS+3', week: '2026-13' },
    { istufe: 'NA05-26-11-420', brv: 'NA05', seTermin: '26-11', reife: 420, ats: '2026-03-02', sab: '2026-04-27', offset: 'ATS+4', week: '2026-14' },
    { istufe: 'NA05-26-11-420', brv: 'NA05', seTermin: '26-11', reife: 420, ats: '2026-03-02', sab: '2026-04-27', offset: 'ATS+5', week: '2026-15' },
    { istufe: 'NA05-26-11-420', brv: 'NA05', seTermin: '26-11', reife: 420, ats: '2026-03-02', sab: '2026-04-27', offset: 'ATS+6', week: '2026-16' },
    { istufe: 'NA05-26-11-420', brv: 'NA05', seTermin: '26-11', reife: 420, ats: '2026-03-02', sab: '2026-04-27', offset: 'ATS+7', week: '2026-17' },
    { istufe: 'NA05-26-11-420', brv: 'NA05', seTermin: '26-11', reife: 420, ats: '2026-03-02', sab: '2026-04-27', offset: 'SAB WEEK', week: '2026-18' },

    // ── REIFE 440: ATS=KW15, SAB=KW23 (Apr 6 – Jun 1 2026) ──
    { istufe: 'NA05-26-11-440', brv: 'NA05', seTermin: '26-11', reife: 440, ats: '2026-04-06', sab: '2026-06-01', offset: 'ATS WEEK', week: '2026-15' },
    { istufe: 'NA05-26-11-440', brv: 'NA05', seTermin: '26-11', reife: 440, ats: '2026-04-06', sab: '2026-06-01', offset: 'ATS+1', week: '2026-16' },
    { istufe: 'NA05-26-11-440', brv: 'NA05', seTermin: '26-11', reife: 440, ats: '2026-04-06', sab: '2026-06-01', offset: 'ATS+2', week: '2026-17' },
    { istufe: 'NA05-26-11-440', brv: 'NA05', seTermin: '26-11', reife: 440, ats: '2026-04-06', sab: '2026-06-01', offset: 'ATS+3', week: '2026-18' },
    { istufe: 'NA05-26-11-440', brv: 'NA05', seTermin: '26-11', reife: 440, ats: '2026-04-06', sab: '2026-06-01', offset: 'ATS+4', week: '2026-19' },
    { istufe: 'NA05-26-11-440', brv: 'NA05', seTermin: '26-11', reife: 440, ats: '2026-04-06', sab: '2026-06-01', offset: 'ATS+5', week: '2026-20' },
    { istufe: 'NA05-26-11-440', brv: 'NA05', seTermin: '26-11', reife: 440, ats: '2026-04-06', sab: '2026-06-01', offset: 'ATS+6', week: '2026-21' },
    { istufe: 'NA05-26-11-440', brv: 'NA05', seTermin: '26-11', reife: 440, ats: '2026-04-06', sab: '2026-06-01', offset: 'ATS+7', week: '2026-22' },
    { istufe: 'NA05-26-11-440', brv: 'NA05', seTermin: '26-11', reife: 440, ats: '2026-04-06', sab: '2026-06-01', offset: 'SAB WEEK', week: '2026-23' },

    // ── REIFE 460: ATS=KW20, SAB=KW28 (May 11 – Jul 6 2026) ──
    { istufe: 'NA05-26-11-460', brv: 'NA05', seTermin: '26-11', reife: 460, ats: '2026-05-11', sab: '2026-07-06', offset: 'ATS WEEK', week: '2026-20' },
    { istufe: 'NA05-26-11-460', brv: 'NA05', seTermin: '26-11', reife: 460, ats: '2026-05-11', sab: '2026-07-06', offset: 'ATS+1', week: '2026-21' },
    { istufe: 'NA05-26-11-460', brv: 'NA05', seTermin: '26-11', reife: 460, ats: '2026-05-11', sab: '2026-07-06', offset: 'ATS+2', week: '2026-22' },
    { istufe: 'NA05-26-11-460', brv: 'NA05', seTermin: '26-11', reife: 460, ats: '2026-05-11', sab: '2026-07-06', offset: 'ATS+3', week: '2026-23' },
    { istufe: 'NA05-26-11-460', brv: 'NA05', seTermin: '26-11', reife: 460, ats: '2026-05-11', sab: '2026-07-06', offset: 'ATS+4', week: '2026-24' },
    { istufe: 'NA05-26-11-460', brv: 'NA05', seTermin: '26-11', reife: 460, ats: '2026-05-11', sab: '2026-07-06', offset: 'ATS+5', week: '2026-25' },
    { istufe: 'NA05-26-11-460', brv: 'NA05', seTermin: '26-11', reife: 460, ats: '2026-05-11', sab: '2026-07-06', offset: 'ATS+6', week: '2026-26' },
    { istufe: 'NA05-26-11-460', brv: 'NA05', seTermin: '26-11', reife: 460, ats: '2026-05-11', sab: '2026-07-06', offset: 'ATS+7', week: '2026-27' },
    { istufe: 'NA05-26-11-460', brv: 'NA05', seTermin: '26-11', reife: 460, ats: '2026-05-11', sab: '2026-07-06', offset: 'SAB WEEK', week: '2026-28' },
];

/**
 * Build master I-Stufe records by aggregating offset rows.
 */
function buildMasters(): IStufeMaster[] {
    const map = new Map<string, IStufeMaster>();

    for (const r of RAW_ROWS) {
        if (!map.has(r.istufe)) {
            map.set(r.istufe, {
                istufe: r.istufe,
                brv: r.brv,
                seTermin: r.seTermin,
                reife: r.reife,
                ats: r.ats,
                sab: r.sab,
                atsWeek: '',
                sabWeek: '',
                offsetWeeks: [],
            });
        }
        const master = map.get(r.istufe)!;
        master.offsetWeeks.push({ offset: r.offset, week: r.week });
        if (r.offset === 'ATS WEEK') master.atsWeek = r.week;
        if (r.offset === 'SAB WEEK') master.sabWeek = r.week;
    }

    // Sort offset weeks within each master
    const offsetOrder = ['ATS WEEK', 'ATS+1', 'ATS+2', 'ATS+3', 'ATS+4', 'ATS+5', 'ATS+6', 'ATS+7', 'SAB WEEK'];
    for (const m of map.values()) {
        m.offsetWeeks.sort((a, b) => offsetOrder.indexOf(a.offset) - offsetOrder.indexOf(b.offset));
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

/** Unique BRV values */
export const BRV_LIST = [...new Set(ISTUFE_MASTERS.map(m => m.brv))];
