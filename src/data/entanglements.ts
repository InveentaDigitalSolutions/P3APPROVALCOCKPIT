/**
 * Verschränkungen — Softwarestand × Speicher bindings.
 *
 * An "entanglement" pins a specific ISTUFE (e.g. "26-07-510") to one
 * Speicher (HVS short code, e.g. "B6RO0"). Once entangled, every new
 * Freigabe for that Softwarestand should only target HVS rows belonging
 * to that Speicher.
 *
 * Persistence: localStorage for now. Promote to a Dataverse table
 * (`cr9b2_verschraenkungen` or similar) once the schema is agreed.
 */

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'freigabencockpit:entanglements:v3';

export interface Entanglement {
    /** Stable id (uuid-ish) */
    id: string;
    /** SE_TERMIN, e.g. "26-07" */
    seTermin: string;
    /** Reifegrad, e.g. 510 */
    reife: number;
    /** Composed ISTUFE key, e.g. "26-07-510" */
    istufe: string;
    /** Speicher = HVS short code, e.g. "B6RO0" */
    speicher: string;
    /** ISO timestamp when the binding was created */
    createdAt: string;
}

function genId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readAll(): Entanglement[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writeAll(list: Entanglement[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

/**
 * React hook giving the current entanglements + add/remove operations.
 * Syncs across tabs via the `storage` event.
 */
export function useEntanglements() {
    const [list, setList] = useState<Entanglement[]>(readAll);

    useEffect(() => {
        const onStorage = (e: StorageEvent) => {
            if (e.key === STORAGE_KEY) setList(readAll());
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    const add = useCallback((input: Omit<Entanglement, 'id' | 'createdAt' | 'istufe'>): Entanglement | null => {
        const istufe = `${input.seTermin}-${input.reife}`;
        const next: Entanglement = {
            id: genId(),
            istufe,
            createdAt: new Date().toISOString(),
            ...input,
        };
        const current = readAll();
        const dup = current.find(e => e.istufe === istufe && e.speicher === input.speicher);
        if (dup) return null;  // duplicate
        const updated = [...current, next];
        writeAll(updated);
        setList(updated);
        return next;
    }, []);

    const remove = useCallback((id: string) => {
        const updated = readAll().filter(e => e.id !== id);
        writeAll(updated);
        setList(updated);
    }, []);

    /** Returns the entanglement for a given ISTUFE key, if any */
    const findByIstufe = useCallback((istufe: string): Entanglement | undefined => {
        return list.find(e => e.istufe === istufe);
    }, [list]);

    return { entanglements: list, add, remove, findByIstufe };
}
