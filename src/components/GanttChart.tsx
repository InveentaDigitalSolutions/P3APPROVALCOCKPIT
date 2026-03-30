import React, { useMemo, useState, useRef, useEffect } from 'react';
import type { FreigabeRecord, FreigabeLevel } from '../types';
import type { KalenderwocheInfo } from '../types';
import { FreigabeBadge } from './FreigabeBadge';
import { buildSopGroups, getHighestFormalLevel } from '../utils/approvalUtils';
import { getAllSpeicher } from '../data/mockData';
import { MOCK_RECORDS } from '../data/mockData';
import { formatDate, toKWKey, getISOWeek, getISOWeekYear } from '../utils/weekUtils';
import './GanttChart.css';

/* ── Column definitions matching the mockup layout ── */
const INFO_COLS = [
    { key: 'bauphase', label: 'Bauphase', className: 'gantt__th--bauphase' },
    { key: 'speicher', label: 'Speicher', className: 'gantt__th--speicher' },
    { key: 'penthouse', label: 'Penthouse', className: 'gantt__th--penthouse' },
    { key: 'wmmLink', label: 'WMM Link', className: 'gantt__th--wmm' },
    { key: 'meilenstein', label: 'Meilenstein', className: 'gantt__th--meilenstein' },
    { key: 'zieldatum', label: 'Zieldatum RSTB', className: 'gantt__th--zieldatum' },
    { key: 'highest', label: 'Höchste Freigabe', className: 'gantt__th--highest' },
] as const;

/**
 * Returns a CSS class suffix for an I-Stufe value (range 0–530).
 */
function iStufeClass(value: string | number): string {
    const n = typeof value === 'string' ? Number(value) : value;
    if (Number.isNaN(n)) return 'istufe-unknown';
    const t = Math.max(0, Math.min(n / 530, 1));
    if (t >= 0.85) return 'istufe-green';
    if (t >= 0.70) return 'istufe-lime';
    if (t >= 0.50) return 'istufe-yellow';
    if (t >= 0.30) return 'istufe-orange';
    return 'istufe-red';
}

const INFO_COL_COUNT = INFO_COLS.length;

interface Props {
    records: FreigabeRecord[];
    weeks: KalenderwocheInfo[];
    speichertypFilter?: string;
    /** Map of record id → overridden confirmed level (for local edits before save) */
    confirmedOverrides?: Record<string, FreigabeLevel>;
    /** Called when the user changes a confirmed level */
    onConfirmedChange?: (recordId: string, newLevel: FreigabeLevel) => void;
}

/** Selectable confirmed-level options shown in the inline dropdown */
const CONFIRM_OPTIONS: { value: FreigabeLevel; label: string }[] = [
    { value: '', label: '— Nicht gesetzt —' },
    { value: 'L1 freigegeben', label: 'L1 freigegeben' },
    { value: 'L2 freigegeben', label: 'L2 freigegeben' },
    { value: 'L3 freigegeben', label: 'L3 freigegeben' },
    { value: 'L4 freigegeben', label: 'L4 freigegeben' },
];

/** Inline dropdown for selecting a confirmed level, anchored near the badge */
const ConfirmDropdown: React.FC<{
    currentLevel: FreigabeLevel;
    onSelect: (level: FreigabeLevel) => void;
    onClose: () => void;
}> = ({ currentLevel, onSelect, onClose }) => {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [onClose]);

    return (
        <div className="gantt__confirm-dropdown" ref={ref}>
            {CONFIRM_OPTIONS.map(opt => (
                <button
                    key={opt.value}
                    className={`gantt__confirm-option${opt.value === currentLevel ? ' gantt__confirm-option--active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); onSelect(opt.value); }}
                >
                    <FreigabeBadge level={opt.value} size="sm" showEmpty />
                    <span>{opt.label}</span>
                </button>
            ))}
        </div>
    );
};

/* ── SOP color palette ── */
const SOP_COLORS = [
    'var(--bmw-blue)',   // SOP 1
    '#0EA5A5',           // SOP 2 (teal)
    '#7B61FF',           // SOP 3 (indigo)
    '#D97706',           // SOP 4 (amber)
];

/** Maps a SOP index to its CSS class suffix (sop-0 .. sop-3) */
function sopClass(idx: number): string {
    return `sop-${idx % SOP_COLORS.length}`;
}

export const GanttChart: React.FC<Props> = ({ records, weeks, speichertypFilter, confirmedOverrides, onConfirmedChange }) => {
    const speicherList = useMemo(() => getAllSpeicher(), []);
    const kwKeys = useMemo(() => weeks.map(w => w.key), [weeks]);

    const allGroups = useMemo(
        () => buildSopGroups(records, speicherList, kwKeys),
        [records, speicherList, kwKeys]
    );

    // Apply speichertyp filter if set
    const groups = useMemo(() => {
        if (!speichertypFilter) return allGroups;
        return allGroups
            .map(sopGrp => ({
                ...sopGrp,
                speichertypGroups: sopGrp.speichertypGroups.filter(
                    sg => sg.speichertyp === speichertypFilter
                ),
            }))
            .filter(sopGrp => sopGrp.speichertypGroups.length > 0);
    }, [allGroups, speichertypFilter]);

    // Collapsed state
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

    // Track which record's confirm dropdown is open
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);

    const toggle = (key: string) => {
        setCollapsed(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    };

    // Current week key for highlighting
    const now = new Date();
    const currentKWKey = toKWKey(getISOWeek(now), getISOWeekYear(now));

    return (
        <div className="gantt">
            <div className="gantt__wrapper">
                <table className="gantt__table">
                    <thead>
                        <tr className="gantt__header-row">
                            {/* ── Speicherattribute columns ── */}
                            {INFO_COLS.map(col => (
                                <th key={col.key} className={`gantt__th ${col.className}`}>
                                    {col.label}
                                </th>
                            ))}
                            {/* ── KW columns ── */}
                            {weeks.map((w, idx) => (
                                <th
                                    key={w.key}
                                    className={`gantt__th gantt__th--kw${w.key === currentKWKey ? ' gantt__th--current' : ''}`}
                                >
                                    <div className="gantt__kw-header">
                                        <span className="gantt__kw-label">
                                            {idx === 0 ? '▴ Vorwoche' : idx === 1 ? '● Aktuelle KW' : '▾ Nächste KW'}
                                        </span>
                                        <span className="gantt__kw-num">{w.label}</span>
                                        <span className="gantt__kw-dates">
                                            {formatDate(w.startDate)} – {formatDate(w.endDate)}
                                        </span>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {groups.map((sopGrp, sopIdx) => {
                            const sopKey = sopGrp.sop;
                            const sopCollapsed = collapsed.has(sopKey);
                            const totalSpeicher = sopGrp.speichertypGroups.reduce(
                                (sum, sg) => sum + sg.speicherNames.length, 0
                            );

                            return (
                                <React.Fragment key={sopKey}>
                                    {/* ─── SOP group header row ─── */}
                                    <tr
                                        className="gantt__sop-row"
                                        onClick={() => toggle(sopKey)}
                                    >
                                        <td className="gantt__td gantt__sop-label" colSpan={INFO_COL_COUNT}>
                                            <div className="gantt__sop-label-inner">
                                                <span className={`gantt__group-chevron${sopCollapsed ? ' gantt__group-chevron--collapsed' : ''}`}>
                                                    ▾
                                                </span>
                                                <span className={`gantt__sop-badge gantt__sop-badge--${sopClass(sopIdx)}`}>SOP</span>
                                                <span className="gantt__sop-name">{sopGrp.sop}</span>
                                                <span className="gantt__group-count">
                                                    {sopGrp.speichertypGroups.length} Speichertyp{sopGrp.speichertypGroups.length !== 1 ? 'en' : ''} · {totalSpeicher} Speicher
                                                </span>
                                            </div>
                                        </td>
                                        {/* SOP I-Stufe bars per KW */}
                                        {kwKeys.map(kw => {
                                            const stufen = sopGrp.iStufeByKW[kw] ?? [];
                                            return (
                                                <td
                                                    key={kw}
                                                    className={`gantt__td gantt__sop-kw${kw === currentKWKey ? ' gantt__td--current' : ''}`}
                                                >
                                                    {stufen.length > 0 && (
                                                        <div className="gantt__istufe-bars">
                                                            {stufen.map(s => (
                                                                <span
                                                                    key={s}
                                                                    className={`gantt__istufe-bar gantt__istufe-bar--${sopClass(sopIdx)}`}
                                                                >
                                                                    I{s}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>

                                    {/* ── Speichertyp sub-groups ── */}
                                    {!sopCollapsed && sopGrp.speichertypGroups.map(sg => {
                                        const typKey = `${sopKey}::${sg.speichertyp}`;
                                        const typCollapsed = collapsed.has(typKey);

                                        return (
                                            <React.Fragment key={typKey}>
                                                {/* ── Speichertyp sub-group header ── */}
                                                <tr
                                                    className="gantt__group-row"
                                                    onClick={() => toggle(typKey)}
                                                >
                                                    <td className="gantt__td gantt__group-label" colSpan={INFO_COL_COUNT + kwKeys.length}>
                                                        <div className="gantt__group-label-inner">
                                                            <span className={`gantt__group-chevron${typCollapsed ? ' gantt__group-chevron--collapsed' : ''}`}>
                                                                ▾
                                                            </span>
                                                            <span className="gantt__group-name">{sg.speichertyp}</span>
                                                            <span className="gantt__group-count">
                                                                {sg.speicherNames.length} Speicher
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>

                                                {/* ── Detail rows ── */}
                                                {!typCollapsed && sg.rows.map((rowCells, rowIdx) => {
                                                    const sample = rowCells.find(c => c.records.length > 0) ?? rowCells[0];
                                                    const speicherRecords = MOCK_RECORDS.filter(
                                                        r => r.speicher === sample?.speicher && r.sop === sopGrp.sop
                                                    );
                                                    const highestFormal = getHighestFormalLevel(speicherRecords);
                                                    // Collect distinct bauphases for display
                                                    const bauphases = [...new Set(speicherRecords.map(r => r.bauphase))].filter(b => b && b !== 'N/A');

                                                    return (
                                                        <tr
                                                            key={sample?.speicher ?? rowIdx}
                                                            className={`gantt__row${rowIdx % 2 === 0 ? '' : ' gantt__row--alt'}`}
                                                        >
                                                            {/* Bauphase */}
                                                            <td className="gantt__td gantt__td--bauphase gantt__td--indented-2">
                                                                {bauphases.length > 0
                                                                    ? bauphases.map(bp => (
                                                                        <span key={bp} className="gantt__bauphase-chip">{bp}</span>
                                                                    ))
                                                                    : <span className="gantt__bauphase-na">N/A</span>
                                                                }
                                                            </td>
                                                            {/* Speicher */}
                                                            <td className="gantt__td gantt__td--meta">
                                                                <span className="gantt__speicher-label">{sample?.speicher ?? '—'}</span>
                                                            </td>
                                                            {/* Penthouse */}
                                                            <td className="gantt__td gantt__td--meta">{sample?.penthouse ?? '—'}</td>
                                                            {/* WMM Link */}
                                                            <td className="gantt__td gantt__td--meta gantt__td--wmm">
                                                                {sample?.records[0]?.wmmLink
                                                                    ? <span className="gantt__wmm-link" title={sample.records[0].wmmLink}>{sample.records[0].wmmLink}</span>
                                                                    : '—'}
                                                            </td>
                                                            {/* Meilenstein */}
                                                            <td className="gantt__td gantt__td--meta">
                                                                <span className="gantt__milestone-chip">{sample?.meilenstein ?? '—'}</span>
                                                            </td>
                                                            {/* Zieldatum RSTB */}
                                                            <td className="gantt__td gantt__td--date">
                                                                {formatDate(sample?.zieldatumRSTB)}
                                                            </td>
                                                            {/* Höchste Freigabe */}
                                                            <td className="gantt__td gantt__td--highest">
                                                                <FreigabeBadge level={highestFormal} size="md" />
                                                            </td>
                                                            {/* ── KW cells ── */}
                                                            {rowCells.map(cell => (
                                                                <td
                                                                    key={cell.kalenderwoche}
                                                                    className={`gantt__td gantt__td--level${cell.kalenderwoche === currentKWKey ? ' gantt__td--current' : ''}`}
                                                                >
                                                                    {cell.records.length > 0 ? (() => {
                                                                        const sorted = [...cell.records].sort((a, b) => b.zeile - a.zeile);
                                                                        return (
                                                                            <div className="gantt__cell-stack">
                                                                                {sorted.map((r, i) => {
                                                                                    const isPrimary = i === 0 && sorted.length > 1;
                                                                                    const isSecondary = i > 0;
                                                                                    const effectiveConfirmed: FreigabeLevel = confirmedOverrides?.[r.id] ?? r.confirmedLevel;
                                                                                    return (
                                                                                        <div
                                                                                            key={i}
                                                                                            className={`gantt__cell-card${isPrimary ? ' gantt__cell-card--primary' : ''}${isSecondary ? ' gantt__cell-card--secondary' : ''}${sorted.length === 1 ? ' gantt__cell-card--single' : ''}`}
                                                                                        >
                                                                                            {r.zieldatumRSTB && (
                                                                                                <span className="gantt__cell-date gantt__cell-date--center">{formatDate(r.zieldatumRSTB)}</span>
                                                                                            )}
                                                                                            {/* Badge row: Soll (neutral, read-only) + Confirmed (colored, editable) */}
                                                                                            <div className="gantt__cell-badge-row">
                                                                                                <div className="gantt__cell-badge-col">
                                                                                                    <span className="gantt__cell-badge-label">Soll</span>
                                                                                                    <FreigabeBadge level={r.freigabeLevelSoll} size={isSecondary ? 'sm' : 'md'} variant="neutral" tooltip={`Soll: ${r.freigabeLevelSoll || 'Nicht gesetzt'}`} />
                                                                                                </div>
                                                                                                <div className="gantt__cell-badge-col gantt__cell-badge-col--confirmed">
                                                                                                    <span className="gantt__cell-badge-label">Ist</span>
                                                                                                    <span
                                                                                                        className="gantt__cell-badge-clickable"
                                                                                                        onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === r.id ? null : r.id); }}
                                                                                                        title="Klicken zum Ändern"
                                                                                                    >
                                                                                                        <FreigabeBadge level={effectiveConfirmed} size={isSecondary ? 'sm' : 'md'} showEmpty tooltip={`Ist: ${effectiveConfirmed || 'Nicht gesetzt'}`} />
                                                                                                        <span className="gantt__cell-badge-edit-icon">▾</span>
                                                                                                    </span>
                                                                                                    {openDropdown === r.id && onConfirmedChange && (
                                                                                                        <ConfirmDropdown
                                                                                                            currentLevel={effectiveConfirmed}
                                                                                                            onSelect={(level) => { onConfirmedChange(r.id, level); setOpenDropdown(null); }}
                                                                                                            onClose={() => setOpenDropdown(null)}
                                                                                                        />
                                                                                                    )}
                                                                                                </div>
                                                                                            </div>
                                                                                            <div className="gantt__cell-tags">
                                                                                                <span
                                                                                                    className={`gantt__cell-tag gantt__cell-tag--istufe gantt__cell-tag--${iStufeClass(r.iStufe)}`}
                                                                                                >
                                                                                                    I{r.iStufe}
                                                                                                </span>
                                                                                                {r.swStand && (
                                                                                                    <span className="gantt__cell-tag gantt__cell-tag--sw">
                                                                                                        {r.swStand}
                                                                                                    </span>
                                                                                                )}
                                                                                                {r.meilenstein && (
                                                                                                    <span className="gantt__cell-tag gantt__cell-tag--ms">
                                                                                                        {r.meilenstein}
                                                                                                    </span>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        );
                                                                    })() : (
                                                                        <FreigabeBadge level={cell.highestLevel} size="md" />
                                                                    )}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    );
                                                })}
                                            </React.Fragment>
                                        );
                                    })}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Legend */}
            <div className="gantt__legend">
                {[
                    { label: 'Nicht gesetzt', badgeLabel: 'N/G', cls: 'badge--nicht-gesetzt' },
                    { label: 'RTSB geplant', badgeLabel: 'RTSB', cls: 'badge--geplant' },
                    { label: 'RTSB freigegeben', badgeLabel: 'RTSB ✓', cls: 'badge--freigegeben' },
                    { label: 'X', badgeLabel: 'X', cls: 'badge--x' },
                    { label: 'Erstfreigabe', badgeLabel: 'L1 ★', cls: 'badge--erstfreigabe' },
                    { label: 'Geplant', badgeLabel: 'L1', cls: 'badge--geplant' },
                    { label: 'Freigegeben', badgeLabel: 'L1 ✓', cls: 'badge--freigegeben' },
                ].map(item => (
                    <div key={item.label} className="gantt__legend-item">
                        <span className={`freigabe-badge freigabe-badge--sm ${item.cls}`}>
                            {item.badgeLabel}
                        </span>
                        <span className="gantt__legend-label">{item.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};
