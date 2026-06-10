/**
 * Planned-approval moves — re-plan a single I-Stufe out of a (Jira-synced)
 * Penthouse ticket into a different calendar week.
 *
 * The source table `cr9b2_planned_component_approvals` is synced from Jira, so
 * we never edit it. Instead each "move" is recorded here as a small delta
 * (one row per moved I-Stufe): the app subtracts the moved I-Stufe from the
 * source ticket in its original week and re-injects it into the target week.
 *
 * STORAGE — currently localStorage (like the WMM module). When the Dataverse
 * table `cr9b2_pth_approval_move` exists, swap `persist`/`addMove`/`removeMove`
 * to also call `MicrosoftDataverseService.CreateRecord` / `DeleteRecord`; the
 * `useApprovalMoves` surface stays the same.
 */

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'freigabencockpit:approvalMoves:v1';

export interface ApprovalMove {
    /** Local id (also the Dataverse row id once persisted there) */
    id: string;
    /** Jira key of the source Penthouse ticket, e.g. "PTH-177951" */
    sourceJiraKey: string;
    /** BRV-stripped I-Stufe key being moved, e.g. "26-07-510" */
    movedIstufe: string;
    /** Target ISO week, e.g. "2026-21" */
    toYearWeek: string;
    /** Soft-delete flag — false = move is undone but kept for history */
    active: boolean;
}

function makeId(): string {
    return `mv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function readAll(): ApprovalMove[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(
            (m): m is ApprovalMove =>
                !!m && typeof m.id === 'string' && typeof m.sourceJiraKey === 'string'
                && typeof m.movedIstufe === 'string' && typeof m.toYearWeek === 'string',
        ).map(m => ({ ...m, active: m.active !== false }));
    } catch {
        return [];
    }
}

function writeAll(moves: ApprovalMove[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(moves));
}

export function useApprovalMoves() {
    const [moves, setMoves] = useState<ApprovalMove[]>(() => readAll());

    useEffect(() => {
        const onStorage = (e: StorageEvent) => {
            if (e.key === STORAGE_KEY) setMoves(readAll());
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    const persist = useCallback((next: ApprovalMove[]) => {
        writeAll(next);
        // TODO(dataverse): mirror to `cr9b2_pth_approval_move`.
        return next;
    }, []);

    /** Move `movedIstufe` of ticket `sourceJiraKey` to `toYearWeek`.
     *  If an active move for that (ticket, I-Stufe) already exists, it is re-targeted. */
    const addMove = useCallback((sourceJiraKey: string, movedIstufe: string, toYearWeek: string) => {
        setMoves(prev => {
            const existing = prev.find(m => m.active && m.sourceJiraKey === sourceJiraKey && m.movedIstufe === movedIstufe);
            const next = existing
                ? prev.map(m => (m === existing ? { ...m, toYearWeek } : m))
                : [...prev, { id: makeId(), sourceJiraKey, movedIstufe, toYearWeek, active: true }];
            return persist(next);
        });
    }, [persist]);

    /** Undo a move (drops the row; history is not kept locally). */
    const removeMove = useCallback((id: string) => {
        setMoves(prev => persist(prev.filter(m => m.id !== id)));
    }, [persist]);

    return { moves, addMove, removeMove };
}
