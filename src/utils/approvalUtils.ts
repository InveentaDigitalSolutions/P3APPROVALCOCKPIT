import type { FreigabeRecord, FreigabeLevel, GanttCell } from '../types';
import { LEVEL_RANK, FORMAL_LEVELS } from '../types';

/** Returns the highest FreigabeLevel from a list of records */
export function getHighestLevel(records: FreigabeRecord[]): FreigabeLevel {
    return records.reduce<FreigabeLevel>((highest, r) => {
        return (LEVEL_RANK[r.freigabeLevelSoll] ?? 0) > (LEVEL_RANK[highest] ?? 0)
            ? r.freigabeLevelSoll
            : highest;
    }, '');
}

/** Returns the highest *formal* level (RTSB, L1–L4) from records, or '' */
export function getHighestFormalLevel(records: FreigabeRecord[]): FreigabeLevel {
    const formal = records.filter(r => FORMAL_LEVELS.includes(r.freigabeLevelSoll));
    if (formal.length === 0) return '';
    return getHighestLevel(formal);
}

/** Builds the 2D Gantt cell matrix: rows = Speicher, cols = KW keys */
export function buildGanttData(
    records: FreigabeRecord[],
    speicherList: string[],
    kwKeys: string[]
): GanttCell[][] {
    return speicherList.map(speicher => {
        return kwKeys.map(kw => {
            const matching = records.filter(
                r => r.speicher === speicher && r.kalenderwoche === kw
            );
            const sample = matching[0];
            return {
                speicher,
                penthouse: sample?.penthouse ?? '—',
                iStufe: sample?.iStufe ?? '—',
                leadStufe: sample?.leadStufe ?? '—',
                meilenstein: sample?.meilenstein ?? '—',
                zieldatumRSTB: sample?.zieldatumRSTB ?? null,
                kalenderwoche: kw,
                highestLevel: getHighestLevel(matching),
                records: matching,
            } satisfies GanttCell;
        });
    });
}

/* ── SOP → Speichertyp → Speicher grouping ────────────────────────── */

export interface SpeichertypGroup {
    speichertyp: string;
    /** Detail rows (one per Speicher) */
    rows: GanttCell[][];
    /** Speicher names in this group (preserving order) */
    speicherNames: string[];
}

export interface SopGroup {
    sop: string;
    /** Distinct I-Stufe values per KW for the SOP header bar */
    iStufeByKW: Record<string, string[]>;
    speichertypGroups: SpeichertypGroup[];
}

/** Builds Gantt data grouped by SOP → Speichertyp → Speicher detail rows */
export function buildSopGroups(
    records: FreigabeRecord[],
    speicherList: string[],
    kwKeys: string[]
): SopGroup[] {
    // Unique SOPs preserving order
    const sopOrder: string[] = [];
    const sopSet = new Set<string>();
    for (const r of records) {
        if (!sopSet.has(r.sop)) { sopSet.add(r.sop); sopOrder.push(r.sop); }
    }

    return sopOrder.map(sop => {
        // Only records belonging to this SOP
        const sopRecords = records.filter(r => r.sop === sop);

        // Compute distinct I-Stufe per KW for this SOP
        const iStufeByKW: Record<string, string[]> = {};
        for (const kw of kwKeys) {
            const kwRecs = sopRecords.filter(r => r.kalenderwoche === kw);
            const stufen = [...new Set(kwRecs.map(r => r.iStufe).filter(Boolean))];
            stufen.sort((a, b) => Number(a) - Number(b));
            iStufeByKW[kw] = stufen;
        }

        // Unique Speichertyps within this SOP, preserving order
        const sopTyps: string[] = [];
        const typSeen = new Set<string>();
        for (const r of sopRecords) {
            if (!typSeen.has(r.speichertyp)) { typSeen.add(r.speichertyp); sopTyps.push(r.speichertyp); }
        }

        const speichertypGroups: SpeichertypGroup[] = sopTyps.map(typ => {
            const typRecords = sopRecords.filter(r => r.speichertyp === typ);
            // Derive speicher list from this SOP+Speichertyp, in the original speicherList order
            const typSpeicherSet = new Set(typRecords.map(r => r.speicher));
            const typSpeicher = speicherList.filter(s => typSpeicherSet.has(s));
            const rows = buildGanttData(typRecords, typSpeicher, kwKeys);
            return { speichertyp: typ, rows, speicherNames: typSpeicher };
        });
        return { sop, iStufeByKW, speichertypGroups };
    });
}

/** Compute summary statistics for a set of records */
export function computeStats(records: FreigabeRecord[]) {
    const total = records.length;
    const approved = records.filter(r => (LEVEL_RANK[r.freigabeLevelSoll] ?? 0) >= LEVEL_RANK['X']).length;
    const formallyApproved = records.filter(r => FORMAL_LEVELS.includes(r.freigabeLevelSoll)).length;
    const notAttended = records.filter(r => r.freigabeLevelSoll === 'Nicht gesetzt' || r.freigabeLevelSoll === '').length;

    const byLevel = {} as Record<FreigabeLevel, number>;
    for (const r of records) {
        byLevel[r.freigabeLevelSoll] = (byLevel[r.freigabeLevelSoll] ?? 0) + 1;
    }

    return {
        total,
        approved,
        formallyApproved,
        notAttended,
        byLevel,
    };
}
