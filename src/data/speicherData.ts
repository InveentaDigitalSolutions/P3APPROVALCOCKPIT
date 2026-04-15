/**
 * Static HVS (Hochvoltspeicher) reference data.
 * Each entry represents a single HVS row in the overview grid.
 * Rows can be grouped into "Verbund" for joint processing (MIA, etc.).
 *
 * The composite HVS-ID for Stücklisten is: Projektnummer + Musterphase + Bezeichnung
 * e.g. "B6GE0-001_VS1_D1_Muster"
 */

export interface HvsEntry {
    /** Vehicle reference, e.g. "NA05" */
    brv: string;
    /** HVS identifier (elektr_reichweite), e.g. "B6ROO" */
    hvs: string;
    /** Speicher number, e.g. "P-114758" */
    speicher: string;
    /** WBS type classification, e.g. "VS_I" */
    wbsType: string;
    /** Muster/prototype stage, e.g. "D 1", "C 1", "B 2" */
    muster: string;
    /** Composite key: speicher-wbsType, e.g. "P-114758-VS_I" */
    key: string;
    /** Penthouse designation (derived from muster), e.g. "D1" */
    penthouse: string;
    /** Default Verbund group ID (null = ungrouped) */
    verbundId: string | null;
    /** Whether this HVS is active (default from data, user can toggle) */
    defaultActive: boolean;
}

/** Build penthouse string from muster (remove space) */
function pth(muster: string): string {
    return muster.replace(/\s+/g, '') || '';
}

export const HVS_DATA: HvsEntry[] = [
    { brv: 'NA05', hvs: 'B6ROO', speicher: 'P-114758', wbsType: 'VS_I', muster: 'D 1', key: 'P-114758-VS_I', penthouse: pth('D 1'), verbundId: null, defaultActive: true },
    { brv: 'NA05', hvs: 'B6ROO', speicher: 'P-114758', wbsType: 'VS1_I', muster: 'D 1.2', key: 'P-114758-VS1_I', penthouse: pth('D 1.2'), verbundId: null, defaultActive: true },
    { brv: 'NA05', hvs: 'B6ROO', speicher: 'P-114758', wbsType: 'EBG_I', muster: 'A 1', key: 'P-114758-EBG_I', penthouse: pth('A 1'), verbundId: null, defaultActive: false },
    { brv: 'NA05', hvs: 'B6ROO', speicher: 'P-114758', wbsType: 'PVL_I', muster: 'C 1', key: 'P-114758-PVL_I', penthouse: pth('C 1'), verbundId: null, defaultActive: true },
    { brv: 'NA05', hvs: 'B6ROO', speicher: 'P-114758', wbsType: 'BBG_II', muster: 'B 2', key: 'P-114758-BBG_II', penthouse: pth('B 2'), verbundId: null, defaultActive: true },
    { brv: 'NA05', hvs: 'B6ROO', speicher: 'P-114758', wbsType: 'BBG_I', muster: 'B 1', key: 'P-114758-BBG_I', penthouse: pth('B 1'), verbundId: null, defaultActive: false },
    { brv: 'NA05', hvs: 'B6ROO', speicher: 'P-114758', wbsType: 'KSP_I', muster: '', key: 'P-114758-KSP_I', penthouse: '', verbundId: null, defaultActive: false },
];

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
    offset: string
): string {
    const pthDisplay = penthouse ? `${penthouse[0]}/${penthouse[0]}` : '—';
    return `${hvs} ${pthDisplay} ${level} ${istufe.replace('NA05-', '')} ${offset}`;
}
