import React, { useMemo, useState } from 'react';
import { MOCK_RECORDS } from '../data/mockData';
import './StammdatenPage.css';

/* ── Derive unique Speicher → Speichertyp mapping from data ── */
interface SpeicherMapping {
    speicher: string;
    speichertyp: string;
    hvsCluster: string;
    penthouse: string;
    recordCount: number;
}

export const StammdatenPage: React.FC = () => {
    const mappings = useMemo<SpeicherMapping[]>(() => {
        const map = new Map<string, SpeicherMapping>();
        for (const r of MOCK_RECORDS) {
            if (!map.has(r.speicher)) {
                map.set(r.speicher, {
                    speicher: r.speicher,
                    speichertyp: r.speichertyp,
                    hvsCluster: r.hvsCluster,
                    penthouse: r.penthouse,
                    recordCount: 0,
                });
            }
            map.get(r.speicher)!.recordCount++;
        }
        return [...map.values()].sort((a, b) => a.speicher.localeCompare(b.speicher));
    }, []);

    const [search, setSearch] = useState('');
    const filtered = useMemo(
        () =>
            search
                ? mappings.filter(m =>
                    m.speicher.toLowerCase().includes(search.toLowerCase()) ||
                    m.speichertyp.toLowerCase().includes(search.toLowerCase()) ||
                    m.hvsCluster.toLowerCase().includes(search.toLowerCase())
                )
                : mappings,
        [mappings, search]
    );

    return (
        <div className="stammdaten-page">
            <div className="stammdaten-page__header">
                <div>
                    <h1 className="stammdaten-page__title">Stammdaten</h1>
                    <p className="stammdaten-page__subtitle">
                        Speicher-Zuordnungen verwalten &middot; <strong>{mappings.length}</strong> Einträge
                    </p>
                </div>
            </div>

            {/* Toolbar */}
            <div className="stammdaten-page__toolbar">
                <input
                    className="stammdaten-page__search"
                    type="text"
                    placeholder="Speicher, Speichertyp oder HVS-Cluster suchen…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                <button className="btn btn--primary" disabled title="Wird nach Tabellenimport aktiviert">
                    + Zuordnung hinzufügen
                </button>
            </div>

            {/* Table */}
            <div className="stammdaten-page__table-wrapper">
                <table className="stammdaten-page__table">
                    <thead>
                        <tr>
                            <th>Speicher</th>
                            <th>Speichertyp</th>
                            <th>HVS-Cluster</th>
                            <th>Penthouse</th>
                            <th className="stammdaten-page__th--num">Datensätze</th>
                            <th className="stammdaten-page__th--actions">Aktionen</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 && (
                            <tr>
                                <td colSpan={6} className="stammdaten-page__empty">
                                    Keine Ergebnisse für „{search}"
                                </td>
                            </tr>
                        )}
                        {filtered.map(m => (
                            <tr key={m.speicher}>
                                <td className="stammdaten-page__td--mono">{m.speicher}</td>
                                <td className="stammdaten-page__td--mono">{m.speichertyp}</td>
                                <td className="stammdaten-page__td--mono">{m.hvsCluster}</td>
                                <td>{m.penthouse}</td>
                                <td className="stammdaten-page__td--num">{m.recordCount}</td>
                                <td className="stammdaten-page__td--actions">
                                    <button className="btn btn--ghost btn--sm" disabled title="Wird nach Tabellenimport aktiviert">
                                        Bearbeiten
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <p className="stammdaten-page__hint">
                Hinweis: Laden Sie die Stammdaten-Tabelle hoch, um Zuordnungen bearbeiten zu können.
            </p>
        </div>
    );
};
