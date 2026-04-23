/**
 * HVS (Hochvoltspeicher) reference data.
 *
 * Source: Dataverse `cr9b2_hvs` ⋈ `cr9b2_wbs_type_mapping`. Current snapshot
 * is committed as JSON under `./generated/dataverse/hvs.json`; refresh it by
 * running `node scripts/dump-dataverse.mjs`.
 */

import hvsJson from './generated/dataverse/hvs.json';

export interface HvsEntry {
    /** Vehicle reference, e.g. "NA05" */
    brv: string;
    /** HVS identifier (derived from Speichertyp short code) */
    hvs: string;
    /** Speicher number, e.g. "P-114758" */
    speicher: string;
    /** WBS type classification, e.g. "VS_I" */
    wbsType: string;
    /** Muster/prototype stage, e.g. "D1.0" */
    muster: string;
    /** Composite key: speicher + "-" + wbsType */
    key: string;
    /** Penthouse designation (from HVS table) */
    penthouse: string;
    /** Default Verbund group ID (null = ungrouped) */
    verbundId: string | null;
    /** Whether this HVS is active (default from data, user can toggle) */
    defaultActive: boolean;
}

interface DvHvsJson {
    key: string;
    speichertyp: string;
    pnummer: string;
    wbsType: string;
    muster: string;
    penthouse: string;
    bauphase: string;
    monatjahr: string;
}

/** Derive the HVS short code from the Speichertyp string, e.g. "B6RO0 -001 | RR XL | HP-PH" → "B6RO0". */
function deriveHvsCode(speichertyp: string): string {
    if (!speichertyp) return '';
    return speichertyp.split(/\s+/)[0] ?? '';
}

function buildHvsData(): HvsEntry[] {
    const rows = hvsJson as DvHvsJson[];
    return rows.map(r => ({
        // TODO: BRV is hardcoded to NA05 per the current PQ filter (P-114758 → NA05).
        // Source dynamically once multiple BRVs are in scope — see `cr9b2_brv` table.
        brv: 'NA05',
        hvs: deriveHvsCode(r.speichertyp),
        speicher: r.pnummer,
        wbsType: r.wbsType,
        muster: r.muster,
        key: r.key,
        penthouse: (r.penthouse ?? '').replace(/\s+/g, ''),
        verbundId: null,
        defaultActive: true,
    }));
}

export const HVS_DATA: HvsEntry[] = buildHvsData();

/** Unique BRV values */
export const BRV_LIST = [...new Set(HVS_DATA.map(s => s.brv))];

/** Unique HVS values */
export const HVS_LIST = [...new Set(HVS_DATA.map(s => s.hvs))];

/** Unique WBS_TYPE values */
export const WBS_TYPE_LIST = [...new Set(HVS_DATA.map(s => s.wbsType))];

/** Unique Muster values (non-empty) */
export const MUSTER_LIST = [...new Set(HVS_DATA.map(s => s.muster).filter(Boolean))];

/** Unique Penthouse values (non-empty) */
export const PENTHOUSE_LIST = [...new Set(HVS_DATA.map(s => s.penthouse).filter(Boolean))];

/**
 * Build MIA Bewertungsprozess name.
 * Format: HVS MUSTER LEVEL ISTUFE OFFSET
 * Example: "B6YJ0 D/D L2 26-7-480 ATS+3"
 */
export function buildMiaName(
    hvs: string,
    penthouse: string,
    level: string,
    istufe: string,
    offset: string,
): string {
    const pthDisplay = penthouse ? `${penthouse[0]}/${penthouse[0]}` : '—';
    return `${hvs} ${pthDisplay} ${level} ${istufe} ${offset}`;
}
