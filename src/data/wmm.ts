/**
 * WMM (Werkzeug- / Sachnummern-Management) — SIMULATED.
 *
 * Until a real WMM connection exists, this module fakes the surface area
 * the cockpit needs so we can build + demo the UX:
 *   - One WMM record per Speichermuster (= one HvsEntry row).
 *   - Each record holds: ZSMB id+url, status, list of Sachnummern,
 *     last-check timestamp, deactivated flag.
 *   - "WMM Check" simulates re-pulling Sachnummern from BATKAS/IHP and
 *     produces a delta vs. the previous list.
 *   - Records are seeded for known HVS rows on first read; user changes
 *     persist in localStorage.
 *
 * To swap for a real backend later: replace the read/write helpers and
 * `runWmmCheck` with API calls; the surface (`useWmm` hook) stays the same.
 */

import { useCallback, useEffect, useState } from 'react';
import { HVS_DATA } from './speicherData';

const STORAGE_KEY = 'freigabencockpit:wmm:v1';

export type WmmStatus =
    | 'ok'                  // ZSMB exists, Sachnummern present, no missing fields
    | 'missing-zsmb'        // No WMM ZSMB linked yet
    | 'missing-sachnummern' // ZSMB exists but Sachnummern not yet entered
    | 'delta-pending'       // Last WMM Check found a delta the user hasn't acked
    | 'deactivated';        // Speichermuster turned off in WMM

export interface WmmRecord {
    /** HVS row key (e.g. "P-114758-VS_I") */
    hvsKey: string;
    /** WMM ZSMB id, e.g. "ZSMB-114758-VS_I-D1.0" */
    zsmbId: string;
    /** Direct link into WMM */
    zsmbUrl: string;
    /** Current state */
    status: WmmStatus;
    /** Sachnummern attached to this Speichermuster */
    sachnummern: Sachnummer[];
    /** Last "WMM Check" timestamp (ISO) */
    lastCheckedAt: string | null;
    /** Pending delta from the last check; cleared once user ackd */
    pendingDelta: SachnummerDelta | null;
}

export interface Sachnummer {
    /** Composite display, e.g. "83 21 7 123 456" */
    nummer: string;
    /** Functional category — Kackel position from BATKAS */
    type: string;
    /** Free description */
    label: string;
}

export interface SachnummerDelta {
    /** New nummer found in BATKAS/IHP that aren't in WMM yet */
    added: Sachnummer[];
    /** Nummer that exist in WMM but no longer in BATKAS/IHP */
    removed: Sachnummer[];
    /** Nummer present in both but with different label/type */
    changed: { before: Sachnummer; after: Sachnummer }[];
}

const WMM_BASE_URL = 'https://wmm.bmw.intra';

function zsmbIdFor(hvsKey: string, muster: string): string {
    return `ZSMB-${hvsKey.replace(/^P-/, '')}-${muster}`;
}

function makeSachnummer(seed: number, type: string, label: string): Sachnummer {
    // Plausible BMW-style Sachnummer: "83 21 7 ### ###"
    const a = String(seed % 1000).padStart(3, '0');
    const b = String((seed * 31) % 1000).padStart(3, '0');
    return { nummer: `83 21 7 ${a} ${b}`, type, label };
}

const SACH_TYPES = ['Kackel-A1', 'Kackel-A2', 'Kackel-B1', 'Kackel-B2', 'Kackel-C1'] as const;

/** Build the deterministic seed Sachnummern for an HVS row. */
function seedSachnummern(hvsKey: string): Sachnummer[] {
    const base = [...hvsKey].reduce((s, c) => s + c.charCodeAt(0), 0);
    return SACH_TYPES.slice(0, 3 + (base % 3)).map((t, i) =>
        makeSachnummer(base + i * 17, t, `${t} – ${hvsKey}`),
    );
}

/** Fresh seed for an HVS row. */
function seedRecord(hvsKey: string, muster: string): WmmRecord {
    const sachnummern = seedSachnummern(hvsKey);
    return {
        hvsKey,
        zsmbId: zsmbIdFor(hvsKey, muster),
        zsmbUrl: `${WMM_BASE_URL}/zsmb/${encodeURIComponent(zsmbIdFor(hvsKey, muster))}`,
        status: sachnummern.length > 0 ? 'ok' : 'missing-sachnummern',
        sachnummern,
        lastCheckedAt: null,
        pendingDelta: null,
    };
}

function readAll(): Record<string, WmmRecord> {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return typeof parsed === 'object' && parsed ? parsed : {};
    } catch {
        return {};
    }
}

function writeAll(records: Record<string, WmmRecord>) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/** Ensure every HVS row has a record (seed on first read). */
function ensureSeeded(records: Record<string, WmmRecord>): Record<string, WmmRecord> {
    let mutated = false;
    const next = { ...records };
    for (const h of HVS_DATA) {
        if (!next[h.key]) {
            next[h.key] = seedRecord(h.key, h.muster);
            mutated = true;
        }
    }
    if (mutated) writeAll(next);
    return next;
}

/**
 * Simulate a WMM Check: pretend BATKAS/IHP returned an updated Sachnummer
 * list, compute the delta vs. the stored record, and stash it on the record.
 */
function simulateBatkasIhpFetch(record: WmmRecord): Sachnummer[] {
    const seedList = seedSachnummern(record.hvsKey);
    // Deterministic-but-changing simulation: rotate by minutes-since-epoch
    const rotation = Math.floor(Date.now() / 60_000) % 4;
    if (rotation === 0) return seedList;
    if (rotation === 1) {
        // Add one extra
        return [...seedList, makeSachnummer(seedList.length * 91, 'Kackel-D1', `Kackel-D1 – ${record.hvsKey}`)];
    }
    if (rotation === 2) {
        // Remove one (the last)
        return seedList.slice(0, Math.max(1, seedList.length - 1));
    }
    // Modify one entry's label
    return seedList.map((s, i) =>
        i === 0 ? { ...s, label: s.label + ' (rev. B)' } : s);
}

function diffSachnummern(prev: Sachnummer[], next: Sachnummer[]): SachnummerDelta {
    const byNum = new Map(prev.map(s => [s.nummer, s]));
    const nextByNum = new Map(next.map(s => [s.nummer, s]));
    const added: Sachnummer[] = [];
    const removed: Sachnummer[] = [];
    const changed: { before: Sachnummer; after: Sachnummer }[] = [];
    for (const s of next) {
        if (!byNum.has(s.nummer)) {
            added.push(s);
        } else {
            const before = byNum.get(s.nummer)!;
            if (before.label !== s.label || before.type !== s.type) {
                changed.push({ before, after: s });
            }
        }
    }
    for (const s of prev) {
        if (!nextByNum.has(s.nummer)) removed.push(s);
    }
    return { added, removed, changed };
}

/**
 * Public hook. Returns the WMM record map (HVS-key → WmmRecord) plus
 * mutators. Records auto-seed for any HVS_DATA rows that don't have one.
 */
export function useWmm() {
    const [records, setRecords] = useState<Record<string, WmmRecord>>(() => ensureSeeded(readAll()));

    useEffect(() => {
        const onStorage = (e: StorageEvent) => {
            if (e.key === STORAGE_KEY) setRecords(ensureSeeded(readAll()));
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    const update = useCallback((hvsKey: string, fn: (r: WmmRecord) => WmmRecord) => {
        setRecords(prev => {
            const cur = prev[hvsKey];
            if (!cur) return prev;
            const next = { ...prev, [hvsKey]: fn(cur) };
            writeAll(next);
            return next;
        });
    }, []);

    /** Run a simulated WMM Check: pulls Sachnummern from "BATKAS/IHP",
     *  computes delta vs. stored, and parks the delta on the record. */
    const runWmmCheck = useCallback((hvsKey: string) => {
        update(hvsKey, r => {
            const fresh = simulateBatkasIhpFetch(r);
            const delta = diffSachnummern(r.sachnummern, fresh);
            const hasChanges = delta.added.length + delta.removed.length + delta.changed.length > 0;
            return {
                ...r,
                lastCheckedAt: new Date().toISOString(),
                pendingDelta: hasChanges ? delta : null,
                status: hasChanges ? 'delta-pending' : (r.sachnummern.length === 0 ? 'missing-sachnummern' : 'ok'),
            };
        });
    }, [update]);

    /** Apply a pending delta into the record's Sachnummern list. */
    const applyDelta = useCallback((hvsKey: string) => {
        update(hvsKey, r => {
            if (!r.pendingDelta) return r;
            const removed = new Set(r.pendingDelta.removed.map(s => s.nummer));
            const changedBefore = new Map(r.pendingDelta.changed.map(c => [c.before.nummer, c.after]));
            const merged = r.sachnummern
                .filter(s => !removed.has(s.nummer))
                .map(s => changedBefore.get(s.nummer) ?? s);
            const finalList = [...merged, ...r.pendingDelta.added];
            return {
                ...r,
                sachnummern: finalList,
                pendingDelta: null,
                status: finalList.length === 0 ? 'missing-sachnummern' : 'ok',
            };
        });
    }, [update]);

    /** Discard a pending delta without changing Sachnummern. */
    const dismissDelta = useCallback((hvsKey: string) => {
        update(hvsKey, r => ({
            ...r,
            pendingDelta: null,
            status: r.sachnummern.length === 0 ? 'missing-sachnummern' : 'ok',
        }));
    }, [update]);

    /** Toggle Speichermuster active/deactivated state. */
    const toggleDeactivated = useCallback((hvsKey: string) => {
        update(hvsKey, r => ({
            ...r,
            status: r.status === 'deactivated'
                ? (r.sachnummern.length === 0 ? 'missing-sachnummern' : 'ok')
                : 'deactivated',
        }));
    }, [update]);

    /** Add a Sachnummer manually (e.g. user enters in WMM via the UI). */
    const addSachnummer = useCallback((hvsKey: string, sn: Sachnummer) => {
        update(hvsKey, r => {
            if (r.sachnummern.some(s => s.nummer === sn.nummer)) return r;
            const next = { ...r, sachnummern: [...r.sachnummern, sn] };
            next.status = next.sachnummern.length > 0 ? 'ok' : 'missing-sachnummern';
            return next;
        });
    }, [update]);

    /** Remove a Sachnummer by nummer. */
    const removeSachnummer = useCallback((hvsKey: string, nummer: string) => {
        update(hvsKey, r => {
            const next = { ...r, sachnummern: r.sachnummern.filter(s => s.nummer !== nummer) };
            next.status = next.sachnummern.length > 0 ? 'ok' : 'missing-sachnummern';
            return next;
        });
    }, [update]);

    return {
        records,
        runWmmCheck,
        applyDelta,
        dismissDelta,
        toggleDeactivated,
        addSachnummer,
        removeSachnummer,
    };
}

export const WMM_STATUS_LABEL: Record<WmmStatus, string> = {
    'ok': 'OK',
    'missing-zsmb': 'ZSMB fehlt',
    'missing-sachnummern': 'Sachnummern fehlen',
    'delta-pending': 'Delta zu prüfen',
    'deactivated': 'Deaktiviert',
};
