/**
 * Planned Component Approvals (Penthouse-Tickets, Tuesdays due-date).
 *
 * Source: Dataverse `crf4f_planned_component_approvals`. Current snapshot
 * is committed as JSON under `./generated/dataverse/planned_component_approvals.json`;
 * refresh by running `npm run dump-dataverse`.
 *
 * NOTE — cleanup rules from domain brief NOT YET applied:
 *   - filter to `name ∈ {L1, L2}` only
 *   - drop Ticket Resolution in {Won't Do, Duplicate, …}
 *   - 10-week window
 * See memory: project_ticket_cleanup.md. Apply when confirmed.
 */

import pcaJson from './generated/dataverse/planned_component_approvals.json';

export interface PenthouseTicket {
    /** Dataverse primary key */
    id: string;
    /** e.g. "PTH-173142" */
    jiraKey: string;
    /** full Jira URL */
    jiraUrl: string;
    /** e.g. "FB", "L2_HV", "L1" */
    name: string;
    /** Due date in ISO (YYYY-MM-DD) */
    dueDate: string;
    /** I-Stufe names the ticket applies to */
    iLevelNames: string[];
    /** e.g. "PTH-173141" */
    parentJiraIssue: string;
    /** e.g. ["PTH-06"] */
    parentBranches: string[];
    /** ISO week string, e.g. "2026-10" */
    yearWeek: string;
    /** ISO week number 1-53 */
    kw: number;
    /** Year */
    year: number;
}

interface PcaJsonRow {
    _id: string;
    crf4f_jirakey?: string;
    crf4f_jiraurl?: string;
    crf4f_name?: string;
    crf4f_duedate?: string;
    crf4f_ilevelnames?: string;
    crf4f_parentjiraissue?: string;
    crf4f_parentbranches?: string;
    crf4f_kw?: string | number;
    crf4f_year?: string | number;
    crf4f_yearweek?: string;
}

function parseJsonArray(s: string | undefined): string[] {
    if (!s) return [];
    try {
        const v = JSON.parse(s);
        return Array.isArray(v) ? v.map(String) : [];
    } catch {
        return [];
    }
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
    // Handles formats like "2,026" (pac tabular output commas)
    return Number(String(v).replace(/,/g, '')) || 0;
}

function buildTickets(): PenthouseTicket[] {
    const rows = pcaJson as PcaJsonRow[];
    return rows
        .filter(r => r.crf4f_jirakey && r.crf4f_yearweek)
        .map(r => ({
            id: r._id,
            jiraKey: r.crf4f_jirakey ?? '',
            jiraUrl: r.crf4f_jiraurl ?? '',
            name: r.crf4f_name ?? '',
            dueDate: mmddyyyyToIso(r.crf4f_duedate),
            iLevelNames: parseJsonArray(r.crf4f_ilevelnames),
            parentJiraIssue: r.crf4f_parentjiraissue ?? '',
            parentBranches: parseJsonArray(r.crf4f_parentbranches),
            yearWeek: r.crf4f_yearweek ?? '',
            kw: parseNum(r.crf4f_kw),
            year: parseNum(r.crf4f_year),
        }));
}

export const PENTHOUSE_TICKETS: PenthouseTicket[] = buildTickets();

/** Index tickets by ISO yearWeek for fast lookup */
export const TICKETS_BY_YEARWEEK: Map<string, PenthouseTicket[]> = (() => {
    const map = new Map<string, PenthouseTicket[]>();
    for (const t of PENTHOUSE_TICKETS) {
        if (!map.has(t.yearWeek)) map.set(t.yearWeek, []);
        map.get(t.yearWeek)!.push(t);
    }
    return map;
})();
