/* ============================================================
   src/types/index.ts
   Data model for COAP Freigabecockpit
   Derived from Freigabecockpit.xlsx column structure
   ============================================================ */

export type FreigabeLevel =
    | 'N/A'
    | 'Nicht gesetzt'
    | 'RTSB geplant'
    | 'RTSB freigegeben'
    | 'X'
    | 'L1 Erstfreigabe geplant'
    | 'L1 Erstfreigabe'
    | 'L1 geplant'
    | 'L1 freigegeben'
    | 'L2 Erstfreigabe geplant'
    | 'L2 Erstfreigabe'
    | 'L2 geplant'
    | 'L2 freigegeben'
    | 'L3 Erstfreigabe geplant'
    | 'L3 Erstfreigabe'
    | 'L3 geplant'
    | 'L3 freigegeben'
    | 'L4 Erstfreigabe geplant'
    | 'L4 Erstfreigabe'
    | 'L4 geplant'
    | 'L4 freigegeben'
    | '';

/** True approval values assignable by the user in the app */
export type FreigabeAssignValue =
    | ''
    | 'X'
    | 'L1 Erstfreigabe'
    | 'L2 Erstfreigabe'
    | 'L3 Erstfreigabe'
    | 'L4 Erstfreigabe';

/** A single Freigabe record — one row in the Excel / Dataverse table */
export interface FreigabeRecord {
    id: string;
    zeile: number;
    /** e.g. "NCARKF1" */
    hvsCluster: string;
    /** e.g. "BZGG0-001" */
    speichertyp: string;
    /** Software build variant, e.g. "C0.8", "D1.0" */
    speicher: string;
    /** Umbrella software package, e.g. "C0.9", "C2", "D" */
    penthouse: string;
    /** Vehicle build phase variant, e.g. "N/A", "VS1.0 & VS0.2 CHN" */
    bauphase: string;
    /** Iteration level / maturity, e.g. "460", "480" */
    iStufe: string;
    /** Lead iteration target, e.g. "26-07" */
    leadStufe: string;
    /** Start of Production target, e.g. "26-07" */
    sop: string;
    /** META master number */
    metaMaster: number;
    /** Software status, e.g. "ATS+3" */
    swStand: string;
    /** Milestone marker, e.g. "SAB+4" */
    meilenstein: string;
    /** Calendar week string, e.g. "KW10_2026" */
    kalenderwoche: string;
    /** Target date for RSTB/Verbund */
    zieldatumRSTB: string | null;
    /** SWL-C Upload date */
    swlcUpload: string | null;
    /** WMM link URL */
    wmmLink: string;
    /** Target (Soll) Freigabe Level — read-only from Excel */
    freigabeLevelSoll: FreigabeLevel;
    /** Confirmed Freigabe Level — editable by the user */
    confirmedLevel: FreigabeLevel;
}

/* ── Speichertyp master data record ── */
export interface SpeichertypRecord {
    id: string;
    speichertyp: string;   // e.g. "BZGG0-001"
    speicher: string;       // e.g. "C0.8"
    hvsCluster: string;     // e.g. "NCARKF1"
    penthouse: string;      // e.g. "C0.9"
    bauphase: string;       // e.g. "N/A", "VS1.0 & VS0.2 CHN"
}

/* ── I-Stufe master data record ── */
export interface IStufeRecord {
    id: string;
    iStufe: string;         // e.g. "460", "480"
    leadStufe: string;      // e.g. "26-07"
    sop: string;            // e.g. "26-07"
    atsDate: string | null; // ATS date (ISO string)
    sabDate: string | null; // SAB date (ISO string)
}

/* ── Freigabe Level master data record ── */
export interface FreigabeLevelRecord {
    id: string;
    name: string;           // e.g. "L1 Erstfreigabe"
    rank: number;           // ordering / severity (higher = more approved)
    category: string;       // grouping: "RTSB", "X", "L1", "L2", "L3", "L4", "Sonstige"
    color: string;          // hex color for badge display
    bgColor: string;        // hex background color for badge
}

/* ── I-Stufe → HVS/Penthouse fixed assignment ──
   Once a software maturity (I-Stufe) is locked to an HVS + Penthouse,
   all subsequent approvals for that I-Stufe automatically target this HVS. */
export interface IStufeHvsZuordnung {
    id: string;
    /** SE_TERMIN delivery cycle, e.g. "26-07", "26-11" */
    seTermin: string;
    /** HVS entry key, e.g. "P-114758-VS_I" */
    hvsKey: string;
    /** When this assignment was fixed (ISO date) */
    fixedAt: string;
    /** Optional note */
    note: string;
}

/** Parsed calendar week info */
export interface KalenderwocheInfo {
    /** Display label, e.g. "KW 10 / 2026" */
    label: string;
    /** Key string, e.g. "KW10_2026" */
    key: string;
    week: number;
    year: number;
    /** Start date (Monday) */
    startDate: Date;
    /** End date (Sunday) */
    endDate: Date;
}

/** Aggregated approval status for one Speicher variant across a KW */
export interface GanttCell {
    speicher: string;
    penthouse: string;
    iStufe: string;
    leadStufe: string;
    meilenstein: string;
    zieldatumRSTB: string | null;
    kalenderwoche: string;
    /** Highest formal Freigabe Level for this Speicher/KW */
    highestLevel: FreigabeLevel;
    /** All individual records for this Speicher/KW */
    records: FreigabeRecord[];
}

/** Level ranking for comparison logic (1–22 per user spec) */
export const LEVEL_RANK: Record<FreigabeLevel, number> = {
    '': 0,
    'N/A': 1,
    'Nicht gesetzt': 2,
    'RTSB geplant': 3,
    'RTSB freigegeben': 4,
    'X': 5,
    'L1 Erstfreigabe geplant': 7,
    'L1 Erstfreigabe': 8,
    'L1 geplant': 9,
    'L1 freigegeben': 10,
    'L2 Erstfreigabe geplant': 11,
    'L2 Erstfreigabe': 12,
    'L2 geplant': 13,
    'L2 freigegeben': 14,
    'L3 Erstfreigabe geplant': 15,
    'L3 Erstfreigabe': 16,
    'L3 geplant': 17,
    'L3 freigegeben': 18,
    'L4 Erstfreigabe geplant': 19,
    'L4 Erstfreigabe': 20,
    'L4 geplant': 21,
    'L4 freigegeben': 22,
};

/** Formal approval levels used for "highest level" overview filtering */
export const FORMAL_LEVELS: FreigabeLevel[] = [
    'RTSB freigegeben',
    'L1 freigegeben',
    'L2 freigegeben',
    'L3 freigegeben',
    'L4 freigegeben',
];

/** All selectable Freigabe Level options for the assignment dropdown */
export const ASSIGN_OPTIONS: { value: FreigabeAssignValue; label: string }[] = [
    { value: '', label: '— Nicht gesetzt —' },
    { value: 'X', label: 'X' },
    { value: 'L1 Erstfreigabe', label: 'L1 Erstfreigabe' },
    { value: 'L2 Erstfreigabe', label: 'L2 Erstfreigabe' },
    { value: 'L3 Erstfreigabe', label: 'L3 Erstfreigabe' },
    { value: 'L4 Erstfreigabe', label: 'L4 Erstfreigabe' },
];

/** Map assign shorthand to FreigabeLevel string */
export const ASSIGN_TO_LEVEL: Record<FreigabeAssignValue, FreigabeLevel> = {
    '': '',
    'X': 'X',
    'L1 Erstfreigabe': 'L1 Erstfreigabe',
    'L2 Erstfreigabe': 'L2 Erstfreigabe',
    'L3 Erstfreigabe': 'L3 Erstfreigabe',
    'L4 Erstfreigabe': 'L4 Erstfreigabe',
};
