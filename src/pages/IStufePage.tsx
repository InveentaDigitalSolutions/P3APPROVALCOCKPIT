import React, { useMemo, useState } from 'react';
import { MOCK_RECORDS } from '../data/mockData';
import './IStufePage.css';

/* ── Derive unique I-Stufe entries from current data ── */
interface IStufeEntry {
    iStufe: string;
    leadStufe: string;
    sop: string;
    speichertyps: string[];
    bauphases: string[];
    recordCount: number;
}

export const IStufePage: React.FC = () => {
    const entries = useMemo<IStufeEntry[]>(() => {
        const map = new Map<string, IStufeEntry>();
        for (const r of MOCK_RECORDS) {
            const key = `${r.iStufe}__${r.sop}`;
            if (!map.has(key)) {
                map.set(key, {
                    iStufe: r.iStufe,
                    leadStufe: r.leadStufe,
                    sop: r.sop,
                    speichertyps: [],
                    bauphases: [],
                    recordCount: 0,
                });
            }
            const e = map.get(key)!;
            e.recordCount++;
            if (!e.speichertyps.includes(r.speichertyp)) e.speichertyps.push(r.speichertyp);
            if (!e.bauphases.includes(r.bauphase)) e.bauphases.push(r.bauphase);
        }
        return [...map.values()].sort((a, b) => a.iStufe.localeCompare(b.iStufe) || a.sop.localeCompare(b.sop));
    }, []);

    const [search, setSearch] = useState('');
    const filtered = useMemo(
        () =>
            search
                ? entries.filter(e =>
                    e.iStufe.toLowerCase().includes(search.toLowerCase()) ||
                    e.sop.toLowerCase().includes(search.toLowerCase()) ||
                    e.leadStufe.toLowerCase().includes(search.toLowerCase())
                )
                : entries,
        [entries, search]
    );

    return (
        <div className="istufe-page">
            <div className="istufe-page__header">
                <div>
                    <h1 className="istufe-page__title">I-Stufe Verwaltung</h1>
                    <p className="istufe-page__subtitle">
                        Iterations-Stufen und SOP-Zuordnungen &middot; <strong>{entries.length}</strong> Kombinationen
                    </p>
                </div>
            </div>

            {/* Toolbar */}
            <div className="istufe-page__toolbar">
                <input
                    className="istufe-page__search"
                    type="text"
                    placeholder="I-Stufe, SOP oder Lead-Stufe suchen…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                <button className="btn btn--primary" disabled title="Wird nach Tabellenimport aktiviert">
                    + I-Stufe hinzufügen
                </button>
            </div>

            {/* Table */}
            <div className="istufe-page__table-wrapper">
                <table className="istufe-page__table">
                    <thead>
                        <tr>
                            <th>I-Stufe</th>
                            <th>SOP</th>
                            <th>Lead-Stufe</th>
                            <th>Speichertypen</th>
                            <th>Bauphasen</th>
                            <th className="istufe-page__th--num">Datensätze</th>
                            <th className="istufe-page__th--actions">Aktionen</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 && (
                            <tr>
                                <td colSpan={7} className="istufe-page__empty">
                                    Keine Ergebnisse für „{search}"
                                </td>
                            </tr>
                        )}
                        {filtered.map(e => (
                            <tr key={`${e.iStufe}-${e.sop}`}>
                                <td>
                                    <span className="istufe-page__chip">{e.iStufe}</span>
                                </td>
                                <td className="istufe-page__td--mono">{e.sop}</td>
                                <td className="istufe-page__td--mono">{e.leadStufe}</td>
                                <td>
                                    {e.speichertyps.map(s => (
                                        <span key={s} className="istufe-page__tag">{s}</span>
                                    ))}
                                </td>
                                <td>
                                    {e.bauphases.map(bp => (
                                        <span key={bp} className="istufe-page__tag istufe-page__tag--bp">{bp}</span>
                                    ))}
                                </td>
                                <td className="istufe-page__td--num">{e.recordCount}</td>
                                <td className="istufe-page__td--actions">
                                    <button className="btn btn--ghost btn--sm" disabled title="Wird nach Tabellenimport aktiviert">
                                        Bearbeiten
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <p className="istufe-page__hint">
                Hinweis: Laden Sie die I-Stufe-Tabelle hoch, um Zuordnungen bearbeiten zu können.
            </p>
        </div>
    );
};
