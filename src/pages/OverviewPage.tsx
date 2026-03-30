import React, { useCallback, useMemo, useState } from 'react';
import { GanttChart } from '../components/GanttChart';
import { SummaryCard } from '../components/SummaryCard';
import { MOCK_RECORDS, getAllKWKeys, getAllSpeichertyps } from '../data/mockData';
import { computeStats } from '../utils/approvalUtils';
import { getDefaultWeeks, getWeeksAround, parseKWKey } from '../utils/weekUtils';
import type { FreigabeLevel } from '../types';
import './OverviewPage.css';

/* ── Inline SVG icons for summary cards ── */
const EntriesIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
    </svg>
);
const ApprovedIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
);
const FormalIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
);
const WarningIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
);

export const OverviewPage: React.FC = () => {
    const defaultWeeks = useMemo(() => getDefaultWeeks(), []);
    const currentKWKey = defaultWeeks[1].key;

    // All KW keys available in the data
    const allKWKeys = useMemo(() => getAllKWKeys(), []);

    // Selected center week (defaults to current real-world KW if it exists in data, else first available)
    const [selectedKW, setSelectedKW] = useState<string>(
        allKWKeys.includes(currentKWKey) ? currentKWKey : allKWKeys[0] ?? currentKWKey
    );

    // Derive the 3 visible weeks: (selected - 1), selected, (selected + 1)
    const visibleWeeks = useMemo(() => {
        const parsed = parseKWKey(selectedKW);
        if (!parsed) return defaultWeeks;
        return getWeeksAround(parsed.week, parsed.year);
    }, [selectedKW, defaultWeeks]);

    // Stats for selected week
    const selectedWeekInfo = visibleWeeks[1]; // center week
    const selectedRecords = useMemo(
        () => MOCK_RECORDS.filter(r => r.kalenderwoche === selectedKW),
        [selectedKW]
    );
    const stats = useMemo(() => computeStats(selectedRecords), [selectedRecords]);

    // Speichertyp filter
    const allSpeichertyps = useMemo(() => getAllSpeichertyps(), []);
    const [speichertypFilter, setSpeichertypFilter] = useState<string>('');

    // Confirmed level overrides (local edits before save)
    const [confirmedOverrides, setConfirmedOverrides] = useState<Record<string, FreigabeLevel>>({});

    const handleConfirmedChange = useCallback((recordId: string, newLevel: FreigabeLevel) => {
        setConfirmedOverrides(prev => ({ ...prev, [recordId]: newLevel }));
    }, []);

    const hasUnsavedChanges = Object.keys(confirmedOverrides).length > 0;

    const handleSave = useCallback(() => {
        // In a real app, this would persist to Dataverse / backend
        console.log('Saving confirmed level changes:', confirmedOverrides);
        // For now, just clear the overrides (simulating a save)
        setConfirmedOverrides({});
    }, [confirmedOverrides]);

    const handleDiscard = useCallback(() => {
        setConfirmedOverrides({});
    }, []);

    return (
        <div className="overview-page">
            {/* Page header */}
            <div className="overview-page__header">
                <div>
                    <h1 className="overview-page__title">Übersicht</h1>
                    <p className="overview-page__subtitle">
                        SOP: <strong>Alle</strong>
                        {speichertypFilter
                            ? <> · Speichertyp: <strong>{speichertypFilter}</strong></>
                            : <> · <span className="overview-page__all-types">Alle Speichertypen</span></>
                        }
                        &nbsp;·&nbsp;{selectedWeekInfo.label}
                    </p>
                </div>
                <div className="overview-page__actions">
                    {hasUnsavedChanges && (
                        <button
                            className="btn btn--ghost"
                            onClick={handleDiscard}
                        >
                            Verwerfen
                        </button>
                    )}
                    <button
                        className="btn btn--primary"
                        onClick={handleSave}
                        disabled={!hasUnsavedChanges}
                    >
                        {hasUnsavedChanges
                            ? `Änderungen speichern (${Object.keys(confirmedOverrides).length})`
                            : 'Keine Änderungen'}
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="overview-page__cards">
                <SummaryCard
                    title="Einträge"
                    value={stats.total}
                    subtitle={`${selectedWeekInfo.label}`}
                    variant="default"
                    icon={<EntriesIcon />}
                />
                <SummaryCard
                    title="Freigegeben (≥ X)"
                    value={stats.approved}
                    subtitle={`${stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0}% der Einträge`}
                    variant="blue"
                    icon={<ApprovedIcon />}
                />
                <SummaryCard
                    title="Formal freigegeben"
                    value={stats.formallyApproved}
                    subtitle="L1 – L4 / RTSB"
                    variant="success"
                    icon={<FormalIcon />}
                />
                <SummaryCard
                    title="Nicht bedient"
                    value={stats.notAttended}
                    subtitle="Ausstehend"
                    variant="warning"
                    icon={<WarningIcon />}
                />
            </div>

            {/* Gantt Chart section */}
            <section className="overview-page__section">
                <div className="overview-page__section-header">
                    <h2 className="overview-page__section-title">
                        Software-Freigabe Gantt
                    </h2>
                    {/* KW selector */}
                    <div className="kw-filter">
                        <div className="kw-filter__group">
                            <label className="kw-filter__label" htmlFor="kw-center-select">Kalenderwoche:</label>
                            <select
                                id="kw-center-select"
                                className="select kw-filter__select"
                                value={selectedKW}
                                onChange={e => setSelectedKW(e.target.value)}
                            >
                                {allKWKeys.map(kw => {
                                    const isCurrent = kw === currentKWKey;
                                    const label = kw.replace('KW', 'KW ').replace('_', ' / ');
                                    return (
                                        <option key={kw} value={kw}>
                                            {label}{isCurrent ? ' (Aktuell)' : ''}
                                        </option>
                                    );
                                })}
                            </select>
                            <span className="kw-filter__hint">
                                {visibleWeeks[0].label} · <strong>{visibleWeeks[1].label}</strong> · {visibleWeeks[2].label}
                            </span>
                        </div>

                        <span className="kw-filter__divider" />

                        {/* Speichertyp filter */}
                        <div className="kw-filter__group">
                            <label className="kw-filter__label" htmlFor="speichertyp-select">Speichertyp:</label>
                            <select
                                id="speichertyp-select"
                                className="select kw-filter__select"
                                value={speichertypFilter}
                                onChange={e => setSpeichertypFilter(e.target.value)}
                            >
                                <option value="">Alle Speichertypen</option>
                                {allSpeichertyps.map(typ => (
                                    <option key={typ} value={typ}>{typ}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <GanttChart
                    records={MOCK_RECORDS}
                    weeks={visibleWeeks}
                    speichertypFilter={speichertypFilter || undefined}
                    confirmedOverrides={confirmedOverrides}
                    onConfirmedChange={handleConfirmedChange}
                />
            </section>
        </div>
    );
};
