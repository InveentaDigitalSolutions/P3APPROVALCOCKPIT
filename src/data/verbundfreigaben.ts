/**
 * Verbundfreigaben (Swap-Tickets, Thursdays).
 *
 * Source: Dataverse `crf4f_verbundfreigaben` (new schema — one row per
 * SWAP ticket with pipe-separated iLevelNames). Snapshot committed as
 * JSON under `./generated/dataverse/verbundfreigaben.json`; refresh with
 * `npm run dump-dataverse`.
 */

import vfJson from './generated/dataverse/verbundfreigaben.json';

export interface VerbundTicket {
    /** Dataverse primary key */
    id: string;
    /** e.g. "SWAP-29453" */
    collapseId: string;
    /** e.g. "420 HV-L2" — shown on the badge */
    name: string;
    /** Parsed list from pipe-separated source */
    iLevelNames: string[];
    /** Start date in ISO (YYYY-MM-DD) */
    startDate: string;
    /** End date in ISO (YYYY-MM-DD) */
    endDate: string;
    /** ISO week string, e.g. "2026-03" */
    yearWeek: string;
    /** ISO week number */
    kw: number;
}

interface VfJsonRow {
    _id: string;
    crf4f_collapseid?: string;
    crf4f_name?: string;
    crf4f_ilevelnames?: string;
    crf4f_startdate?: string;
    crf4f_enddate?: string;
    crf4f_yearweek?: string;
    crf4f_kw?: string | number;
}

function mmddyyyyToIso(v: string | undefined): string {
    if (!v) return '';
    const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!m) return v;
    const [, mo, d, y] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function parseNum(v: string | number | undefined): number {
    if (typeof v === 'number') return v;
    if (!v) return 0;
    return Number(String(v).replace(/,/g, '')) || 0;
}

function buildTickets(): VerbundTicket[] {
    const rows = vfJson as VfJsonRow[];
    return rows
        .filter(r => r.crf4f_collapseid && r.crf4f_yearweek)
        .map(r => ({
            id: r._id,
            collapseId: r.crf4f_collapseid ?? '',
            name: r.crf4f_name ?? '',
            iLevelNames: (r.crf4f_ilevelnames ?? '').split('|').map(s => s.trim()).filter(Boolean),
            startDate: mmddyyyyToIso(r.crf4f_startdate),
            endDate: mmddyyyyToIso(r.crf4f_enddate),
            yearWeek: r.crf4f_yearweek ?? '',
            kw: parseNum(r.crf4f_kw),
        }));
}

export const VERBUND_TICKETS: VerbundTicket[] = buildTickets();

/** Index by ISO yearWeek for fast lookup */
export const VERBUND_TICKETS_BY_YEARWEEK: Map<string, VerbundTicket[]> = (() => {
    const map = new Map<string, VerbundTicket[]>();
    for (const t of VERBUND_TICKETS) {
        if (!map.has(t.yearWeek)) map.set(t.yearWeek, []);
        map.get(t.yearWeek)!.push(t);
    }
    return map;
})();
