/**
 * Freigabe Cockpit — opinionated, action-oriented view of the same data
 * as Freigabe Timeline. Goals:
 *   - one Speicher = one card
 *   - inline cell edit (no modal for single-cell changes)
 *   - "Aufgaben" attention strip at the top surfacing what needs work now
 *   - sticky action bar at the bottom for bulk operations
 *
 * Reuses HVS_DATA, ISTUFE_MASTERS, useWmm, useEntanglements.
 * Per-page state (Ist values, week navigation, filters) is isolated from
 * the Timeline page so the two views can be open side-by-side without
 * stepping on each other. (When ready, lift Ist values to a shared store
 * or Dataverse so both pages mutate the same truth.)
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ISTUFE_MASTERS, getOffsetForWeek, weekToIndex } from '../data/istufeData';
import type { IStufeMaster } from '../data/istufeData';
import { HVS_DATA } from '../data/speicherData';
import type { HvsEntry } from '../data/speicherData';
import { TICKETS_BY_YEARWEEK } from '../data/plannedComponentApprovals';
import type { PenthouseTicket } from '../data/plannedComponentApprovals';
import { VERBUND_TICKETS_BY_YEARWEEK } from '../data/verbundfreigaben';
import type { VerbundTicket } from '../data/verbundfreigaben';
import { useWmm, WMM_STATUS_LABEL } from '../data/wmm';
import type { WmmStatus } from '../data/wmm';
import { useEntanglements } from '../data/entanglements';
import { getISOWeek, getISOWeekYear, getMonday, getKWInfo, formatDate } from '../utils/weekUtils';
import type { KalenderwocheInfo } from '../types';
import './CockpitPage.css';

/* ── shared bits (kept local to this page on purpose) ───────────────── */

const ISTUFE_PALETTE = [
    { bar: '#2196F3', light: 'rgba(33,150,243,0.12)', text: '#fff' },
    { bar: '#E65100', light: 'rgba(230,81,0,0.12)', text: '#fff' },
    { bar: '#00897B', light: 'rgba(0,137,123,0.12)', text: '#fff' },
    { bar: '#8E24AA', light: 'rgba(142,36,170,0.12)', text: '#fff' },
    { bar: '#F9A825', light: 'rgba(249,168,37,0.12)', text: '#1A1A1A' },
    { bar: '#C62828', light: 'rgba(198,40,40,0.12)', text: '#fff' },
    { bar: '#2E7D32', light: 'rgba(46,125,50,0.12)', text: '#fff' },
    { bar: '#4527A0', light: 'rgba(69,39,160,0.12)', text: '#fff' },
    { bar: '#00838F', light: 'rgba(0,131,143,0.12)', text: '#fff' },
    { bar: '#AD1457', light: 'rgba(173,20,87,0.12)', text: '#fff' },
] as const;

type SeTerminStatus = 'abgebrancht' | 'entwicklung' | 'planung';
const SE_TERMIN_STATUS: Record<string, SeTerminStatus> = {
    '26-07': 'abgebrancht',
    '26-11': 'entwicklung',
};
const SE_TERMIN_STATUS_LABEL: Record<SeTerminStatus, string> = {
    abgebrancht: 'Abgebrancht',
    entwicklung: 'Entwicklungszeitschiene',
    planung: 'Planung',
};
const DEFAULT_VISIBLE_SE_TERMINE = ['26-07', '26-11'];

const SE_TERMIN_COLORS: Map<string, typeof ISTUFE_PALETTE[number]> = (() => {
    const map = new Map<string, typeof ISTUFE_PALETTE[number]>();
    const sorted = [...new Set(ISTUFE_MASTERS.map(m => m.seTermin))].sort();
    sorted.forEach((se, i) => map.set(se, ISTUFE_PALETTE[i % ISTUFE_PALETTE.length]));
    return map;
})();
function colorFor(se: string | undefined) {
    return se ? SE_TERMIN_COLORS.get(se) : undefined;
}

const LEVELS = ['', 'X', 'RSTB', 'L1', 'L2', 'L3', 'L4'] as const;
type Level = typeof LEVELS[number];
const LEVEL_COLORS: Record<string, { bg: string; text: string }> = {
    X: { bg: '#6F6F6F', text: '#fff' },
    RSTB: { bg: '#F5A623', text: '#fff' },
    L1: { bg: '#E86427', text: '#fff' },
    L2: { bg: '#3D7A34', text: '#fff' },
    L3: { bg: '#2A5C23', text: '#fff' },
    L4: { bg: '#1A3D14', text: '#fff' },
};
function lvlColor(l: string) { return LEVEL_COLORS[l] ?? { bg: '#6F6F6F', text: '#fff' }; }

/** Extract SE_TERMIN ("yy-ww") from any iLevel name shape (Penthouse "NA05-26-07-500" or Verbund "26-07-500"). */
function extractSeTermin(name: string): string | null {
    const parts = name.split('-');
    for (let i = 0; i < parts.length - 1; i++) {
        if (/^\d{2}$/.test(parts[i]) && /^\d{2}$/.test(parts[i + 1])) {
            return `${parts[i]}-${parts[i + 1]}`;
        }
    }
    return null;
}

/** Color for a ticket name (e.g. "L2_HV", "420 HV-L2", "FB", "RSTB"). */
function ticketColor(name: string): string {
    const cat = name.toUpperCase();
    const m = cat.match(/\bL([1-4])\b/);
    if (m) {
        switch (m[1]) {
            case '1': return '#E86427';
            case '2': return '#3D7A34';
            case '3': return '#2A5C23';
            case '4': return '#1A3D14';
        }
    }
    if (cat.includes('RSTB')) return '#F5A623';
    if (cat === 'FB') return '#1C69D4';
    return '#6F6F6F';
}

function kwToYearWeek(kw: KalenderwocheInfo): string {
    return `${kw.year}-${String(kw.week).padStart(2, '0')}`;
}
function buildWeekWindow(centerWeek: number, centerYear: number, span = 1): KalenderwocheInfo[] {
    const center = getMonday(centerWeek, centerYear);
    const out: KalenderwocheInfo[] = [];
    for (let i = -span; i <= span; i++) {
        const d = new Date(center);
        d.setUTCDate(center.getUTCDate() + i * 7);
        out.push(getKWInfo(getISOWeek(d), getISOWeekYear(d)));
    }
    return out;
}

/* ── inline level picker (replaces modal pattern) ───────────────────── */

const LevelPicker: React.FC<{
    current: string;
    onSelect: (v: Level) => void;
    onClose: () => void;
}> = ({ current, onSelect, onClose }) => {
    const wrapRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const onMouse = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) onClose();
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('mousedown', onMouse);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onMouse);
            document.removeEventListener('keydown', onKey);
        };
    }, [onClose]);

    return (
        <div className="cp-picker" ref={wrapRef} role="listbox">
            {LEVELS.map(l => (
                <button key={l || '_none'}
                    className={`cp-picker__opt${l === current ? ' cp-picker__opt--active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); onSelect(l); }}>
                    {l ? (
                        <span className="cp-picker__badge"
                            style={{ backgroundColor: lvlColor(l).bg, color: lvlColor(l).text }}>
                            {l}
                        </span>
                    ) : (
                        <span className="cp-picker__none">— Nicht gesetzt —</span>
                    )}
                </button>
            ))}
        </div>
    );
};

/* ── Ticket popover (Penthouse + Verbund) ──────────────────────────── */

type SelectedTicket =
    | { kind: 'penthouse'; ticket: PenthouseTicket }
    | { kind: 'verbund'; ticket: VerbundTicket };

const TicketPopover: React.FC<{
    selection: SelectedTicket;
    onClose: () => void;
}> = ({ selection, onClose }) => {
    const wrapRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const onMouse = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) onClose();
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('mousedown', onMouse);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onMouse);
            document.removeEventListener('keydown', onKey);
        };
    }, [onClose]);

    const isPth = selection.kind === 'penthouse';
    const t = selection.ticket;
    const headerColor = ticketColor(t.name);
    const id = isPth ? (t as PenthouseTicket).jiraKey : (t as VerbundTicket).collapseId;

    return (
        <div className="cp-tpop" ref={wrapRef} role="dialog" onClick={e => e.stopPropagation()}>
            <header className="cp-tpop__head" style={{ backgroundColor: headerColor }}>
                <div>
                    <div className="cp-tpop__kicker">
                        {isPth ? 'Penthouse-Ticket' : 'Verbund-Ticket (Swap)'}
                    </div>
                    <div className="cp-tpop__title">{id}</div>
                </div>
                <button className="cp-tpop__close" onClick={onClose} aria-label="Close">×</button>
            </header>
            <div className="cp-tpop__body">
                <div className="cp-tpop__row">
                    <span className="cp-tpop__label">Name</span>
                    <span className="cp-tpop__value">{t.name || '—'}</span>
                </div>
                {isPth ? (
                    <>
                        {(t as PenthouseTicket).dueDate && (
                            <div className="cp-tpop__row">
                                <span className="cp-tpop__label">Due-Date</span>
                                <span className="cp-tpop__value">{(t as PenthouseTicket).dueDate}</span>
                            </div>
                        )}
                        {(t as PenthouseTicket).parentJiraIssue && (
                            <div className="cp-tpop__row">
                                <span className="cp-tpop__label">Parent</span>
                                <span className="cp-tpop__value">{(t as PenthouseTicket).parentJiraIssue}</span>
                            </div>
                        )}
                        {(t as PenthouseTicket).parentBranches?.length > 0 && (
                            <div className="cp-tpop__row">
                                <span className="cp-tpop__label">Branches</span>
                                <span className="cp-tpop__value">{(t as PenthouseTicket).parentBranches.join(', ')}</span>
                            </div>
                        )}
                        {(t as PenthouseTicket).jiraUrl && (
                            <div className="cp-tpop__row">
                                <span className="cp-tpop__label">Link</span>
                                <a className="cp-tpop__link" href={(t as PenthouseTicket).jiraUrl}
                                    target="_blank" rel="noopener noreferrer">
                                    Open in Jira ↗
                                </a>
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <div className="cp-tpop__row">
                            <span className="cp-tpop__label">Start</span>
                            <span className="cp-tpop__value">{(t as VerbundTicket).startDate || '—'}</span>
                        </div>
                        <div className="cp-tpop__row">
                            <span className="cp-tpop__label">Ende</span>
                            <span className="cp-tpop__value">{(t as VerbundTicket).endDate || '—'}</span>
                        </div>
                        <div className="cp-tpop__row">
                            <span className="cp-tpop__label">KW</span>
                            <span className="cp-tpop__value">{(t as VerbundTicket).yearWeek || '—'}</span>
                        </div>
                    </>
                )}
                {t.iLevelNames && t.iLevelNames.length > 0 && (
                    <div className="cp-tpop__section">
                        <div className="cp-tpop__section-title">
                            I-Stufen <span className="cp-tpop__count">({t.iLevelNames.length})</span>
                        </div>
                        <div className="cp-tpop__tags">
                            {t.iLevelNames.map(n => {
                                const c = colorFor(extractSeTermin(n) ?? '');
                                return (
                                    <span key={n} className="cp-tpop__tag"
                                        style={c ? { backgroundColor: c.bar, color: c.text, borderColor: c.bar } : undefined}>
                                        {n}
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

/* ── Bulk-Freigabe sheet (slide-in from the right) ──────────────────── */

interface BulkApplyArgs {
    istufe: string;
    weeks: string[];
    hvsKeys: string[];
    level: string;
}

const BulkSheet: React.FC<{
    visibleHvs: HvsEntry[];
    weeks: string[];
    onClose: () => void;
    onApply: (args: BulkApplyArgs) => void;
}> = ({ visibleHvs, weeks, onClose, onApply }) => {
    const { findByIstufe } = useEntanglements();

    const [seTermin, setSeTermin] = useState('');
    const [reife, setReife] = useState('');
    const [level, setLevel] = useState('');
    const [selectedWeeks, setSelectedWeeks] = useState<Set<string>>(new Set(weeks));
    const [selectedHvs, setSelectedHvs] = useState<Set<string>>(
        () => new Set(visibleHvs.map(h => h.key)),
    );
    const [confirming, setConfirming] = useState(false);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    /* Refresh defaults when the inputs change */
    useEffect(() => { setSelectedWeeks(new Set(weeks)); }, [weeks]);

    const seTerminOptions = useMemo(
        () => [...new Set(ISTUFE_MASTERS.map(m => m.seTermin))].sort(),
        [],
    );
    const reifeOptions = useMemo(() => {
        if (!seTermin) return [];
        return [...new Set(
            ISTUFE_MASTERS.filter(m => m.seTermin === seTermin).map(m => m.reife),
        )].sort((a, b) => b - a);
    }, [seTermin]);

    const istufeKey = seTermin && reife ? `${seTermin}-${reife}` : '';
    const istufeMaster = istufeKey ? ISTUFE_MASTERS.find(m => m.istufe === istufeKey) : undefined;

    /* Available weeks for the chosen istufe (intersected with visible window) */
    const availableWeeks = useMemo(() => {
        if (!istufeMaster) return [] as string[];
        const ats = weekToIndex(istufeMaster.atsWeek);
        const sab = weekToIndex(istufeMaster.sabWeek);
        return weeks.filter(wk => {
            const i = weekToIndex(wk);
            return ats <= i && i <= sab;
        });
    }, [istufeMaster, weeks]);

    /* Re-default the week selection when the istufe changes */
    useEffect(() => {
        setSelectedWeeks(new Set(availableWeeks));
    }, [availableWeeks]);

    const entangled = istufeKey ? findByIstufe(istufeKey) : undefined;
    const cascadeIstufen: IStufeMaster[] = useMemo(() => {
        if (!entangled || !istufeMaster) return [];
        return ISTUFE_MASTERS.filter(m =>
            m.seTermin === istufeMaster.seTermin
            && m.reife >= istufeMaster.reife
            && m.istufe !== istufeMaster.istufe,
        ).sort((a, b) => a.reife - b.reife);
    }, [entangled, istufeMaster]);

    /* When entangled, narrow the visible HVS list to the entangled Speicher.
       Also sync selection to that subset on first show. */
    const eligibleHvs = useMemo(() => {
        if (!entangled) return visibleHvs;
        return visibleHvs.filter(h => h.hvs === entangled.speicher);
    }, [visibleHvs, entangled]);

    useEffect(() => {
        if (!entangled) return;
        const allowed = new Set(eligibleHvs.map(h => h.key));
        setSelectedHvs(prev => {
            const next = new Set<string>();
            for (const k of prev) if (allowed.has(k)) next.add(k);
            return next.size === 0 ? allowed : next;
        });
    }, [entangled, eligibleHvs]);

    const ready = !!istufeKey && !!level
        && selectedHvs.size > 0 && selectedWeeks.size > 0
        && availableWeeks.length > 0;

    const toggleHvs = (key: string) => {
        setSelectedHvs(prev => {
            const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };
    const toggleWeek = (wk: string) => {
        setSelectedWeeks(prev => {
            const next = new Set(prev); next.has(wk) ? next.delete(wk) : next.add(wk);
            return next;
        });
    };

    const handleApply = () => {
        if (!ready) return;
        onApply({
            istufe: istufeKey,
            weeks: availableWeeks.filter(w => selectedWeeks.has(w)),
            hvsKeys: [...selectedHvs],
            level,
        });
    };

    return (
        <>
            <div className="cp-backdrop" onClick={onClose} />
            <aside className="cp-bulk" role="dialog" aria-label="Bulk-Freigabe">
                <header className="cp-bulk__head">
                    <div>
                        <div className="cp-bulk__kicker">Bulk-Freigabe</div>
                        <div className="cp-bulk__title">Freigaben für mehrere Speicher setzen</div>
                    </div>
                    <button className="cp-wmm__close" onClick={onClose} aria-label="Schließen">×</button>
                </header>

                <div className="cp-bulk__body">
                    {/* Step 1 — pick the target */}
                    <section className="cp-bulk__section">
                        <div className="cp-bulk__section-title"><span className="cp-bulk__step">1</span> Zielstand</div>
                        <div className="cp-bulk__grid">
                            <div className="cp-bulk__field">
                                <label className="cp-bulk__label">ISTUFE</label>
                                <select className="cp-select"
                                    value={seTermin}
                                    onChange={e => { setSeTermin(e.target.value); setReife(''); }}>
                                    <option value="">— wählen —</option>
                                    {seTerminOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="cp-bulk__field">
                                <label className="cp-bulk__label">Reifegrad</label>
                                <select className="cp-select"
                                    value={reife}
                                    disabled={!seTermin}
                                    onChange={e => setReife(e.target.value)}>
                                    <option value="">{seTermin ? '— wählen —' : 'Zuerst ISTUFE'}</option>
                                    {reifeOptions.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            <div className="cp-bulk__field">
                                <label className="cp-bulk__label">Freigabe-Level</label>
                                <select className="cp-select" value={level} onChange={e => setLevel(e.target.value)}>
                                    <option value="">— wählen —</option>
                                    {['X', 'RSTB', 'L1', 'L2', 'L3', 'L4'].map(l => <option key={l} value={l}>{l}</option>)}
                                </select>
                            </div>
                        </div>

                        {entangled && (
                            <div className="cp-bulk__entanglement">
                                🔗 <strong>{entangled.istufe}</strong> ist an Speicher
                                {' '}<strong>{entangled.speicher}</strong> verschränkt.
                                {cascadeIstufen.length > 0 && (
                                    <>
                                        {' '}Kaskadiert auf{' '}
                                        {cascadeIstufen.map((m, i) => (
                                            <React.Fragment key={m.istufe}>
                                                {i > 0 && ', '}<strong>{m.istufe}</strong>
                                            </React.Fragment>
                                        ))}.
                                    </>
                                )}
                            </div>
                        )}
                    </section>

                    {/* Step 2 — weeks */}
                    <section className="cp-bulk__section">
                        <div className="cp-bulk__section-title"><span className="cp-bulk__step">2</span> Wochen</div>
                        <div className="cp-bulk__week-pills">
                            {!istufeMaster && (
                                <span className="cp-bulk__hint">Zuerst ISTUFE + Reifegrad wählen</span>
                            )}
                            {istufeMaster && availableWeeks.length === 0 && (
                                <span className="cp-bulk__hint">
                                    Diese ISTUFE ist im aktuellen Zeitfenster nicht aktiv.
                                </span>
                            )}
                            {availableWeeks.map(wk => {
                                const on = selectedWeeks.has(wk);
                                return (
                                    <button key={wk} type="button"
                                        className={`cp-bulk__week${on ? ' cp-bulk__week--on' : ''}`}
                                        onClick={() => toggleWeek(wk)}>
                                        KW{wk.split('-')[1]}
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    {/* Step 3 — HVS */}
                    <section className="cp-bulk__section">
                        <div className="cp-bulk__section-title">
                            <span className="cp-bulk__step">3</span>
                            HVS auswählen
                            <span className="cp-bulk__pill">{selectedHvs.size}</span>
                            <div className="cp-bulk__hvs-actions">
                                <button className="cp-bulk__mini" onClick={() =>
                                    setSelectedHvs(new Set(eligibleHvs.map(h => h.key)))
                                }>Alle</button>
                                <button className="cp-bulk__mini" onClick={() => setSelectedHvs(new Set())}>Keine</button>
                            </div>
                        </div>
                        {entangled && (
                            <div className="cp-bulk__hint cp-bulk__hint--info">
                                Auf Speicher <strong>{entangled.speicher}</strong> beschränkt (Verschränkung).
                            </div>
                        )}
                        <div className="cp-bulk__hvs-list">
                            {eligibleHvs.length === 0 && (
                                <span className="cp-bulk__hint">Keine HVS im aktuellen Filter.</span>
                            )}
                            {eligibleHvs.map(h => {
                                const checked = selectedHvs.has(h.key);
                                return (
                                    <label key={h.key}
                                        className={`cp-bulk__hvs-item${checked ? ' cp-bulk__hvs-item--on' : ''}`}>
                                        <input type="checkbox" checked={checked} onChange={() => toggleHvs(h.key)} />
                                        <span className="cp-bulk__hvs-name">{h.wbsType}</span>
                                        <span className="cp-bulk__hvs-muster">{h.muster}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </section>

                    {/* Confirm preview */}
                    {confirming && ready && (
                        <section className="cp-bulk__confirm">
                            <div className="cp-bulk__confirm-title">Bestätigen</div>
                            <div className="cp-bulk__confirm-row">
                                <span>Softwarestand</span><strong>{istufeKey}</strong>
                            </div>
                            <div className="cp-bulk__confirm-row">
                                <span>Wochen</span>
                                <strong>{availableWeeks.filter(w => selectedWeeks.has(w))
                                    .map(w => 'KW' + w.split('-')[1]).join(', ')}</strong>
                            </div>
                            <div className="cp-bulk__confirm-row">
                                <span>Level</span>
                                <span className="cp-picker__badge"
                                    style={{ backgroundColor: lvlColor(level).bg, color: lvlColor(level).text }}>
                                    {level}
                                </span>
                            </div>
                            <div className="cp-bulk__confirm-row">
                                <span>HVS ({selectedHvs.size})</span>
                                <strong>{eligibleHvs
                                    .filter(h => selectedHvs.has(h.key))
                                    .map(h => `${h.wbsType} ${h.muster}`).join(', ')}</strong>
                            </div>
                            {cascadeIstufen.length > 0 && (
                                <div className="cp-bulk__confirm-row">
                                    <span>Kaskade</span>
                                    <strong>{cascadeIstufen.map(m => m.istufe).join(', ')}</strong>
                                </div>
                            )}
                        </section>
                    )}
                </div>

                <footer className="cp-bulk__foot">
                    <button className="cp-actionbar__btn" onClick={onClose}>Abbrechen</button>
                    <div className="cp-bulk__foot-right">
                        <span className="cp-bulk__hint">
                            {ready ? `${selectedHvs.size} HVS × ${selectedWeeks.size} KW` : 'ISTUFE, Level, HVS und Wochen wählen'}
                        </span>
                        {!confirming ? (
                            <button className="cp-actionbar__btn cp-actionbar__btn--primary"
                                disabled={!ready}
                                onClick={() => setConfirming(true)}>
                                Vorschau
                            </button>
                        ) : (
                            <button className="cp-actionbar__btn cp-actionbar__btn--primary"
                                onClick={handleApply}>
                                Anwenden
                            </button>
                        )}
                    </div>
                </footer>
            </aside>
        </>
    );
};

/* ── main page ──────────────────────────────────────────────────────── */

export const CockpitPage: React.FC = () => {
    const now = new Date();
    const currentWeek = getISOWeek(now);
    const currentYear = getISOWeekYear(now);

    /* Week navigation */
    const [weekOffset, setWeekOffset] = useState(0);
    const centerDate = useMemo(() => {
        const d = getMonday(currentWeek, currentYear);
        d.setUTCDate(d.getUTCDate() + weekOffset * 7);
        return d;
    }, [currentWeek, currentYear, weekOffset]);
    const weeks = useMemo(
        () => buildWeekWindow(getISOWeek(centerDate), getISOWeekYear(centerDate), 1),
        [centerDate],
    );
    const weekKeys = useMemo(() => weeks.map(kwToYearWeek), [weeks]);

    /* Filter: which SE_TERMINE to show. Default to 26-07 + 26-11. */
    const [hiddenSeTermine, setHiddenSeTermine] = useState<Set<string>>(() => {
        const all = new Set(ISTUFE_MASTERS.map(m => m.seTermin));
        for (const s of DEFAULT_VISIBLE_SE_TERMINE) all.delete(s);
        return all;
    });
    const isSeTerminVisible = useCallback(
        (se: string) => !hiddenSeTermine.has(se),
        [hiddenSeTermine],
    );
    const visibleSeTermine = useMemo(() => {
        const all = [...new Set(ISTUFE_MASTERS.map(m => m.seTermin))].sort();
        return all;
    }, []);

    /* Search across HVS rows */
    const [search, setSearch] = useState('');

    const filteredHvs = useMemo<HvsEntry[]>(() => {
        const q = search.trim().toLowerCase();
        return HVS_DATA.filter(h => {
            if (q && !(
                h.hvs.toLowerCase().includes(q)
                || h.wbsType.toLowerCase().includes(q)
                || h.muster.toLowerCase().includes(q)
                || h.key.toLowerCase().includes(q)
                || h.penthouse.toLowerCase().includes(q)
            )) return false;
            return true;
        });
    }, [search]);

    /* Ist-Stand state — keyed `${istufe}|${week}|${hvs}` */
    const [istStand, setIstStand] = useState<Record<string, string>>({});
    const [openCell, setOpenCell] = useState<string | null>(null);

    const setIst = useCallback((cellKey: string, value: string) => {
        setIstStand(prev => {
            const next = { ...prev };
            if (value) next[cellKey] = value;
            else delete next[cellKey];
            return next;
        });
        setOpenCell(null);
    }, []);

    /* WMM + Entanglements */
    const wmm = useWmm();
    const { findByIstufe } = useEntanglements();
    const [wmmOpenKey, setWmmOpenKey] = useState<string | null>(null);
    const [bulkOpen, setBulkOpen] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<SelectedTicket | null>(null);

    /** Bulk write that respects entanglements and cascades to sister
     *  Softwarestände with the same SE_TERMIN and Reifegrad ≥ selected
     *  (mirrors the Timeline page rule). */
    const applyBulk = useCallback((opts: {
        istufe: string;
        weeks: string[];
        hvsKeys: string[];
        level: string;
    }) => {
        const { istufe, weeks, hvsKeys, level } = opts;
        if (!istufe || !level || weeks.length === 0 || hvsKeys.length === 0) return;
        const selectedMaster = ISTUFE_MASTERS.find(m => m.istufe === istufe);
        if (!selectedMaster) return;

        // Cascade only when entangled
        const entangled = findByIstufe(istufe);
        const cascadeCandidates: IStufeMaster[] = entangled
            ? ISTUFE_MASTERS.filter(m =>
                m.seTermin === selectedMaster.seTermin
                && m.reife >= selectedMaster.reife
                && m.istufe !== istufe,
            )
            : [];

        setIstStand(prev => {
            const next = { ...prev };
            for (const wk of weeks) {
                const wIdx = weekToIndex(wk);
                const cascadeForWeek = cascadeCandidates
                    .filter(m => weekToIndex(m.atsWeek) <= wIdx && wIdx <= weekToIndex(m.sabWeek))
                    .map(m => m.istufe);
                const targets = new Set<string>([istufe, ...cascadeForWeek]);
                for (const hvsKey of hvsKeys) {
                    for (const t of targets) {
                        if (level) next[`${t}|${wk}|${hvsKey}`] = level;
                        else delete next[`${t}|${wk}|${hvsKey}`];
                    }
                }
            }
            return next;
        });
    }, [findByIstufe]);

    /* Compute, per HVS × week, the active (visible) ISTUFE — one per week.
       Strategy: pick the ISTUFE with the highest reife active in that week
       whose seTermin is visible in the filter. Ties are broken by lex order. */
    function activeIstufeFor(week: string): IStufeMaster | undefined {
        const wIdx = weekToIndex(week);
        const candidates = ISTUFE_MASTERS.filter(m =>
            isSeTerminVisible(m.seTermin)
            && weekToIndex(m.atsWeek) <= wIdx
            && wIdx <= weekToIndex(m.sabWeek),
        );
        if (candidates.length === 0) return undefined;
        return candidates.sort((a, b) =>
            (b.reife - a.reife) || a.istufe.localeCompare(b.istufe),
        )[0];
    }

    /* ── Attention metrics ─────────────────────────────────────────────
       - WMM Deltas: how many records have pendingDelta
       - Missing Sachnummern: how many records have status = missing-sachnummern
       - PTH tickets in visible window
       - Verbund tickets in visible window
    */
    const wmmStats = useMemo(() => {
        let delta = 0; let missing = 0; let ok = 0; let deactivated = 0;
        for (const r of Object.values(wmm.records)) {
            if (r.status === 'delta-pending') delta++;
            else if (r.status === 'missing-sachnummern' || r.status === 'missing-zsmb') missing++;
            else if (r.status === 'deactivated') deactivated++;
            else ok++;
        }
        return { delta, missing, ok, deactivated };
    }, [wmm.records]);

    const ticketStats = useMemo(() => {
        let pth = 0; let verbund = 0;
        for (const wk of weekKeys) {
            pth += TICKETS_BY_YEARWEEK.get(wk)?.length ?? 0;
            verbund += VERBUND_TICKETS_BY_YEARWEEK.get(wk)?.length ?? 0;
        }
        return { pth, verbund };
    }, [weekKeys]);

    /* ── Render ────────────────────────────────────────────────────── */

    const visibleIstufenInWindow = useMemo(() => {
        const out = new Set<IStufeMaster>();
        for (const wk of weekKeys) {
            const m = activeIstufeFor(wk);
            if (m) out.add(m);
        }
        return [...out].sort((a, b) => b.reife - a.reife);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [weekKeys, hiddenSeTermine]);

    return (
        <div className="cp-page">
            {/* Header */}
            <header className="cp-header">
                <div className="cp-header__title-block">
                    <h1 className="cp-page__title">Cockpit</h1>
                    <p className="cp-page__subtitle">
                        Aktionsorientierte Übersicht der Hochvoltspeicher-Freigaben
                    </p>
                </div>
                <div className="cp-header__nav">
                    <button className="cp-icon-btn" onClick={() => setWeekOffset(o => o - 1)} title="Vorwoche">‹</button>
                    <button className="cp-today" onClick={() => setWeekOffset(0)} disabled={weekOffset === 0}>
                        Heute
                    </button>
                    <button className="cp-icon-btn" onClick={() => setWeekOffset(o => o + 1)} title="Nächste Woche">›</button>
                    <span className="cp-header__sep" />
                    <Link to="/freigabe-timeline" className="cp-link-secondary">
                        Klassische Timeline ↗
                    </Link>
                </div>
            </header>

            {/* Compact filter row */}
            <div className="cp-filters">
                <input className="cp-search" type="text" placeholder="HVS, Speicher, Muster suchen…"
                    value={search} onChange={e => setSearch(e.target.value)} />
                <details className="cp-istufe-filter">
                    <summary>
                        ISTUFE <span className="cp-istufe-filter__count">
                            {visibleSeTermine.length - hiddenSeTermine.size} / {visibleSeTermine.length}
                        </span>
                    </summary>
                    <div className="cp-istufe-filter__menu">
                        {visibleSeTermine.map(se => {
                            const c = colorFor(se);
                            const status = SE_TERMIN_STATUS[se];
                            const checked = !hiddenSeTermine.has(se);
                            return (
                                <label key={se} className={`cp-istufe-filter__opt${checked ? ' cp-istufe-filter__opt--on' : ''}`}>
                                    <input type="checkbox" checked={checked}
                                        onChange={() => setHiddenSeTermine(prev => {
                                            const next = new Set(prev);
                                            if (next.has(se)) next.delete(se); else next.add(se);
                                            return next;
                                        })} />
                                    <span className="cp-istufe-filter__swatch" style={{ backgroundColor: c?.bar ?? '#999' }} />
                                    <span className="cp-istufe-filter__name">{se}</span>
                                    {status && (
                                        <span className={`cp-status-pill cp-status-pill--${status}`}>
                                            {SE_TERMIN_STATUS_LABEL[status]}
                                        </span>
                                    )}
                                </label>
                            );
                        })}
                    </div>
                </details>
            </div>

            {/* Attention metrics */}
            <section className="cp-attention">
                <div className="cp-tile cp-tile--blue">
                    <div className="cp-tile__value">{wmmStats.delta}</div>
                    <div className="cp-tile__label">WMM-Deltas zu prüfen</div>
                </div>
                <div className={`cp-tile${wmmStats.missing > 0 ? ' cp-tile--warn' : ''}`}>
                    <div className="cp-tile__value">{wmmStats.missing}</div>
                    <div className="cp-tile__label">Sachnummern fehlen</div>
                </div>
                <div className="cp-tile">
                    <div className="cp-tile__value">{ticketStats.pth}</div>
                    <div className="cp-tile__label">PTH-Tickets im Zeitfenster</div>
                </div>
                <div className="cp-tile">
                    <div className="cp-tile__value">{ticketStats.verbund}</div>
                    <div className="cp-tile__label">Verbund-Tickets im Zeitfenster</div>
                </div>
                <div className="cp-tile cp-tile--ghost">
                    <div className="cp-tile__value">{filteredHvs.length}</div>
                    <div className="cp-tile__label">Speichermuster sichtbar</div>
                </div>
            </section>

            {/* ISTUFE band — colored ribbon showing visible streams in this window */}
            {visibleIstufenInWindow.length > 0 && (
                <div className="cp-istufe-band">
                    {visibleIstufenInWindow.map(m => {
                        const c = colorFor(m.seTermin);
                        const status = SE_TERMIN_STATUS[m.seTermin];
                        return (
                            <span key={m.istufe} className="cp-istufe-band__pill"
                                style={c ? { backgroundColor: c.bar, color: c.text } : undefined}
                                title={status ? `${m.istufe} · ${SE_TERMIN_STATUS_LABEL[status]}` : m.istufe}>
                                {m.istufe}
                            </span>
                        );
                    })}
                </div>
            )}

            {/* Speicher cards */}
            <section className="cp-cards">
                {filteredHvs.length === 0 && (
                    <div className="cp-empty">
                        Keine Speicher passend zum Filter. Filter zurücksetzen oder Suche leeren.
                    </div>
                )}
                {filteredHvs.map(hvs => {
                    const wmmRec = wmm.records[hvs.key];
                    const status: WmmStatus = wmmRec?.status ?? 'missing-zsmb';
                    return (
                        <article key={hvs.key} className="cp-card">
                            <header className="cp-card__head">
                                <div className="cp-card__id">
                                    <span className="cp-card__hvs">{hvs.hvs}</span>
                                    <span className="cp-card__sep">·</span>
                                    <span className="cp-card__wbs">{hvs.wbsType}</span>
                                    <span className="cp-card__sep">·</span>
                                    <span className="cp-card__muster">{hvs.muster}</span>
                                    {hvs.penthouse && (
                                        <span className="cp-card__pth">PTH {hvs.penthouse}</span>
                                    )}
                                </div>
                                <div className="cp-card__badges">
                                    <button className={`cp-badge cp-badge--wmm cp-badge--status-${status}`}
                                        onClick={() => setWmmOpenKey(hvs.key)}
                                        title={`WMM: ${WMM_STATUS_LABEL[status]}`}>
                                        <span className="cp-badge__dot" /> WMM
                                    </button>
                                    <span className="cp-badge cp-badge--mia cp-badge--muted" title="MIA — Phase 3">
                                        <span className="cp-badge__dot" /> MIA
                                    </span>
                                </div>
                            </header>

                            <div className="cp-card__weeks">
                                {weeks.map(w => {
                                    const yw = kwToYearWeek(w);
                                    const m = activeIstufeFor(yw);
                                    const c = m ? colorFor(m.seTermin) : undefined;
                                    const status = m ? SE_TERMIN_STATUS[m.seTermin] : undefined;
                                    const cellKey = m ? `${m.istufe}|${yw}|${hvs.key}` : '';
                                    const istVal = cellKey ? (istStand[cellKey] ?? '') : '';
                                    const ent = m ? findByIstufe(m.istufe) : undefined;
                                    const blockedByEnt = ent && ent.speicher !== hvs.hvs;
                                    const isNow = w.week === currentWeek && w.year === currentYear;

                                    /* Tickets relevant to this cell:
                                       - PTH/Verbund tickets in THIS week
                                       - whose iLevelNames touch the cell's istufe seTermin (or any visible seTermin if no istufe) */
                                    const allowedSe = m ? new Set([m.seTermin]) : null;
                                    const pthTickets = (TICKETS_BY_YEARWEEK.get(yw) ?? []).filter(t => {
                                        if (!allowedSe) return false;
                                        return t.iLevelNames.some(n => {
                                            const se = extractSeTermin(n);
                                            return se && allowedSe.has(se);
                                        });
                                    });
                                    const verbundTickets = (VERBUND_TICKETS_BY_YEARWEEK.get(yw) ?? []).filter(t => {
                                        if (!allowedSe) return false;
                                        return t.iLevelNames.some(n => {
                                            const se = extractSeTermin(n);
                                            return se && allowedSe.has(se);
                                        });
                                    });
                                    const ticketCount = pthTickets.length + verbundTickets.length;

                                    return (
                                        <div key={w.key} className={`cp-cell${isNow ? ' cp-cell--current' : ''}${status === 'abgebrancht' ? ' cp-cell--abgebrancht' : ''}`}>
                                            <div className="cp-cell__head">
                                                <span className="cp-cell__kw">KW{String(w.week).padStart(2, '0')}</span>
                                                <span className="cp-cell__dates">{formatDate(w.startDate)} – {formatDate(w.endDate)}</span>
                                            </div>
                                            {m ? (
                                                <>
                                                    <div className="cp-cell__band"
                                                        style={c ? { backgroundColor: c.bar, color: c.text } : undefined}>
                                                        <span className="cp-cell__istufe">{m.istufe}</span>
                                                        <span className="cp-cell__offset">{getOffsetForWeek(m, yw)}</span>
                                                    </div>

                                                    {ticketCount > 0 && (
                                                        <div className="cp-cell__tickets" title={`${pthTickets.length} PTH · ${verbundTickets.length} Verbund`}>
                                                            <span className="cp-cell__tickets-label">Tickets</span>
                                                            <div className="cp-cell__tickets-row">
                                                                {pthTickets.map(t => (
                                                                    <button key={`p${t.id}`}
                                                                        type="button"
                                                                        className="cp-tbadge cp-tbadge--pth"
                                                                        style={{ backgroundColor: ticketColor(t.name) }}
                                                                        onClick={e => { e.stopPropagation(); setSelectedTicket({ kind: 'penthouse', ticket: t }); }}
                                                                        title={`${t.jiraKey} · ${t.name}`}>
                                                                        {t.name || '?'}
                                                                    </button>
                                                                ))}
                                                                {verbundTickets.map(t => (
                                                                    <button key={`v${t.id}`}
                                                                        type="button"
                                                                        className="cp-tbadge cp-tbadge--verbund"
                                                                        style={{ borderColor: ticketColor(t.name), color: ticketColor(t.name) }}
                                                                        onClick={e => { e.stopPropagation(); setSelectedTicket({ kind: 'verbund', ticket: t }); }}
                                                                        title={`${t.collapseId} · ${t.name}`}>
                                                                        {t.name || '?'}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {blockedByEnt ? (
                                                        <div className="cp-cell__locked"
                                                            title={`Verschränkt mit Speicher ${ent?.speicher}`}>
                                                            🔒 {ent?.speicher}
                                                        </div>
                                                    ) : (
                                                        <div className="cp-cell__action">
                                                            <button
                                                                className={`cp-cell__btn${istVal ? '' : ' cp-cell__btn--empty'}`}
                                                                style={istVal ? { backgroundColor: lvlColor(istVal).bg, color: lvlColor(istVal).text } : undefined}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setOpenCell(openCell === cellKey ? null : cellKey);
                                                                }}>
                                                                {istVal || '— Freigabe setzen'}
                                                                <span className="cp-cell__caret">▾</span>
                                                            </button>
                                                            {openCell === cellKey && (
                                                                <LevelPicker
                                                                    current={istVal}
                                                                    onSelect={v => setIst(cellKey, v)}
                                                                    onClose={() => setOpenCell(null)}
                                                                />
                                                            )}
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="cp-cell__empty">— Keine aktive ISTUFE</div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </article>
                    );
                })}
            </section>

            {/* Sticky action bar */}
            <footer className="cp-actionbar">
                <div className="cp-actionbar__left">
                    <Link to="/verschraenkungen" className="cp-actionbar__btn">
                        Verschränkungen
                    </Link>
                </div>
                <div className="cp-actionbar__right">
                    <button className="cp-actionbar__btn cp-actionbar__btn--primary"
                        onClick={() => setBulkOpen(true)}>
                        + Bulk-Freigabe
                    </button>
                </div>
            </footer>

            {/* WMM drawer link — re-uses the data hook; we keep a tiny inline drawer here
                so this page is self-contained while we share the hook. */}
            {wmmOpenKey && (
                <CockpitWmmDrawer
                    hvsKey={wmmOpenKey}
                    onClose={() => setWmmOpenKey(null)}
                />
            )}

            {bulkOpen && (
                <BulkSheet
                    visibleHvs={filteredHvs}
                    weeks={weekKeys}
                    onClose={() => setBulkOpen(false)}
                    onApply={(args) => {
                        applyBulk(args);
                        setBulkOpen(false);
                    }}
                />
            )}

            {selectedTicket && (
                <TicketPopover
                    selection={selectedTicket}
                    onClose={() => setSelectedTicket(null)}
                />
            )}
        </div>
    );
};

/* ── Local WMM drawer (re-uses useWmm) ────────────────────────────── */

const CockpitWmmDrawer: React.FC<{ hvsKey: string; onClose: () => void }> = ({ hvsKey, onClose }) => {
    const wmm = useWmm();
    const record = wmm.records[hvsKey];

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    if (!record) return null;
    const lastChecked = record.lastCheckedAt
        ? new Date(record.lastCheckedAt).toLocaleString('de-DE', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
        })
        : 'noch nie';

    return (
        <>
            <div className="cp-backdrop" onClick={onClose} />
            <aside className="cp-wmm" role="dialog">
                <header className="cp-wmm__head">
                    <div>
                        <div className="cp-wmm__kicker">WMM · {hvsKey}</div>
                        <div className="cp-wmm__title">{record.zsmbId}</div>
                    </div>
                    <button className="cp-wmm__close" onClick={onClose}>×</button>
                </header>
                <div className="cp-wmm__body">
                    <div className="cp-wmm__row">
                        <span className="cp-wmm__label">ZSMB</span>
                        <a className="cp-wmm__link" href={record.zsmbUrl} target="_blank" rel="noopener noreferrer">
                            {record.zsmbUrl} ↗
                        </a>
                    </div>
                    <div className="cp-wmm__row">
                        <span className="cp-wmm__label">Status</span>
                        <span className={`cp-wmm__status cp-wmm__status--${record.status}`}>
                            {WMM_STATUS_LABEL[record.status]}
                        </span>
                    </div>
                    <div className="cp-wmm__row">
                        <span className="cp-wmm__label">Letzte Prüfung</span>
                        <span>{lastChecked}</span>
                    </div>
                    {record.pendingDelta && (
                        <div className="cp-wmm__delta">
                            <strong>Delta liegt vor:</strong>
                            {' '}+{record.pendingDelta.added.length} / −{record.pendingDelta.removed.length} / ~{record.pendingDelta.changed.length}
                            <div className="cp-wmm__delta-actions">
                                <button onClick={() => wmm.dismissDelta(hvsKey)}>Verwerfen</button>
                                <button onClick={() => wmm.applyDelta(hvsKey)}>Übernehmen</button>
                            </div>
                        </div>
                    )}
                    <div className="cp-wmm__row">
                        <span className="cp-wmm__label">Sachnummern ({record.sachnummern.length})</span>
                    </div>
                    <ul className="cp-wmm__sn">
                        {record.sachnummern.map(s => (
                            <li key={s.nummer}>
                                <code>{s.nummer}</code> · {s.type} · {s.label}
                            </li>
                        ))}
                    </ul>
                </div>
                <footer className="cp-wmm__foot">
                    <button className="cp-actionbar__btn" onClick={() => wmm.toggleDeactivated(hvsKey)}>
                        {record.status === 'deactivated' ? 'Reaktivieren' : 'Deaktivieren'}
                    </button>
                    <button className="cp-actionbar__btn cp-actionbar__btn--primary" onClick={() => wmm.runWmmCheck(hvsKey)}>
                        WMM Check
                    </button>
                </footer>
            </aside>
        </>
    );
};
