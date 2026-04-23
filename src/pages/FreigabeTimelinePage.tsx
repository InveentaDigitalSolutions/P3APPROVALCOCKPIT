import React, { useMemo, useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { getActiveIStufen, getOffsetForWeek, weekToIndex, ISTUFE_MASTERS } from '../data/istufeData';
import type { IStufeMaster } from '../data/istufeData';
import { HVS_DATA } from '../data/speicherData';
import { FREIGABE_SCHEDULE_UNIQUE } from '../data/freigabeSchedule';
import { TICKETS_BY_YEARWEEK, PENTHOUSE_TICKETS } from '../data/plannedComponentApprovals';
import type { PenthouseTicket } from '../data/plannedComponentApprovals';
import { VERBUND_TICKETS_BY_YEARWEEK, VERBUND_TICKETS } from '../data/verbundfreigaben';
import type { VerbundTicket } from '../data/verbundfreigaben';
import {
    getISOWeek,
    getISOWeekYear,
    getKWInfo,
    getMonday,
    formatDate,
} from '../utils/weekUtils';
import type { KalenderwocheInfo } from '../types';
import './FreigabeTimelinePage.css';

/* ══════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════ */

function kwToYearWeek(kw: KalenderwocheInfo): string {
    return `${kw.year}-${String(kw.week).padStart(2, '0')}`;
}

function buildWeekWindow(centerWeek: number, centerYear: number): KalenderwocheInfo[] {
    const center = getMonday(centerWeek, centerYear);
    return [-1, 0, 1].map(i => {
        const d = new Date(center);
        d.setUTCDate(center.getUTCDate() + i * 7);
        return getKWInfo(getISOWeek(d), getISOWeekYear(d));
    });
}

/* ── Per-I-Stufe Colors ── */
const ISTUFE_PALETTE = [
    { bar: '#2196F3', light: 'rgba(33,150,243,0.12)', text: '#fff' },    // blue
    { bar: '#E65100', light: 'rgba(230,81,0,0.12)', text: '#fff' },      // deep orange
    { bar: '#00897B', light: 'rgba(0,137,123,0.12)', text: '#fff' },     // teal
    { bar: '#8E24AA', light: 'rgba(142,36,170,0.12)', text: '#fff' },    // purple
    { bar: '#F9A825', light: 'rgba(249,168,37,0.12)', text: '#1A1A1A' }, // amber
    { bar: '#C62828', light: 'rgba(198,40,40,0.12)', text: '#fff' },     // red
    { bar: '#2E7D32', light: 'rgba(46,125,50,0.12)', text: '#fff' },     // green
    { bar: '#4527A0', light: 'rgba(69,39,160,0.12)', text: '#fff' },     // deep purple
    { bar: '#00838F', light: 'rgba(0,131,143,0.12)', text: '#fff' },     // cyan
    { bar: '#AD1457', light: 'rgba(173,20,87,0.12)', text: '#fff' },     // pink
];

function buildIstufeColorMap(masters: IStufeMaster[]) {
    const map = new Map<string, typeof ISTUFE_PALETTE[0]>();
    masters.forEach((m, i) => map.set(m.istufe, ISTUFE_PALETTE[i % ISTUFE_PALETTE.length]));
    return map;
}

/* ── Level Colors ── */
const LEVEL_COLORS: Record<string, { bg: string; text: string }> = {
    X: { bg: '#6F6F6F', text: '#fff' },
    RSTB: { bg: '#F5A623', text: '#fff' },
    L1: { bg: '#E86427', text: '#fff' },
    L2: { bg: '#3D7A34', text: '#fff' },
    L3: { bg: '#2A5C23', text: '#fff' },
    L4: { bg: '#1A3D14', text: '#fff' },
};
function lvlColor(l: string) { return LEVEL_COLORS[l] ?? { bg: '#6F6F6F', text: '#fff' }; }

const IST_OPTIONS = ['', 'X', 'RSTB', 'L1', 'L2', 'L3', 'L4'] as const;

/* ══════════════════════════════════════════════════════
   Ist-Stand Dropdown
   ══════════════════════════════════════════════════════ */

const IstDropdown: React.FC<{
    current: string;
    onSelect: (v: string) => void;
    onClose: () => void;
}> = ({ current, onSelect, onClose }) => {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [onClose]);

    return (
        <div className="ftl-dropdown" ref={ref}>
            {IST_OPTIONS.map(o => (
                <button key={o || '_'} className={`ftl-dropdown__option${o === current ? ' ftl-dropdown__option--active' : ''}`}
                    onClick={e => { e.stopPropagation(); onSelect(o); }}>
                    {o
                        ? <span className="ftl-gantt__badge ftl-gantt__badge--sm" style={{ backgroundColor: lvlColor(o).bg, color: lvlColor(o).text }}>{o}</span>
                        : <span className="ftl-dropdown__empty">— Nicht gesetzt —</span>}
                </button>
            ))}
        </div>
    );
};

/* ══════════════════════════════════════════════════════
   Add Entry Picker — select Softwarestand + OFFSET
   ══════════════════════════════════════════════════════ */

const OFFSET_LIST = ['ATS WEEK', 'ATS+1', 'ATS+2', 'ATS+3', 'ATS+4', 'ATS+5', 'ATS+6', 'ATS+7', 'SAB WEEK', 'SAB+1', 'SAB+2'];

const AddEntryPicker: React.FC<{
    allIStufen: IStufeMaster[];
    activeIstufeKeys: Set<string>;
    istufeColors: Map<string, typeof ISTUFE_PALETTE[0]>;
    onAdd: (istufe: string, offset: string) => void;
    onClose: () => void;
}> = ({ allIStufen, activeIstufeKeys, istufeColors, onAdd, onClose }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [step, setStep] = useState<'istufe' | 'offset'>('istufe');
    const [selectedIstufe, setSelectedIstufe] = useState<string>('');

    useEffect(() => {
        const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [onClose]);

    // Sort: active first, then rest
    const sorted = useMemo(() => {
        const active = allIStufen.filter(m => activeIstufeKeys.has(m.istufe));
        const rest = allIStufen.filter(m => !activeIstufeKeys.has(m.istufe));
        return { active, rest };
    }, [allIStufen, activeIstufeKeys]);

    return (
        <div className="ftl-add-picker" ref={ref}>
            {step === 'istufe' ? (
                <>
                    <div className="ftl-add-picker__title">Softwarestand wählen</div>
                    {sorted.active.length > 0 && (
                        <div className="ftl-add-picker__group-label">Aktiv in dieser KW</div>
                    )}
                    <div className="ftl-add-picker__list">
                        {sorted.active.map(m => {
                            const c = istufeColors.get(m.istufe);
                            return (
                                <button key={m.istufe} className="ftl-add-picker__item"
                                    onClick={() => { setSelectedIstufe(m.istufe); setStep('offset'); }}>
                                    <span className="ftl-add-picker__swatch" style={{ backgroundColor: c?.bar }} />
                                    <span>{m.istufe}</span>
                                    <span className="ftl-add-picker__reife">Reife {m.reife}</span>
                                </button>
                            );
                        })}
                    </div>
                    {sorted.rest.length > 0 && (
                        <>
                            <div className="ftl-add-picker__group-label">Weitere Softwarestände</div>
                            <div className="ftl-add-picker__list">
                                {sorted.rest.map(m => {
                                    const c = istufeColors.get(m.istufe);
                                    return (
                                        <button key={m.istufe} className="ftl-add-picker__item ftl-add-picker__item--inactive"
                                            onClick={() => { setSelectedIstufe(m.istufe); setStep('offset'); }}>
                                            <span className="ftl-add-picker__swatch" style={{ backgroundColor: c?.bar ?? '#999' }} />
                                            <span>{m.istufe}</span>
                                            <span className="ftl-add-picker__reife">Reife {m.reife}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </>
            ) : (
                <>
                    <div className="ftl-add-picker__title">
                        OFFSET wählen für
                        <span className="ftl-add-picker__selected">{selectedIstufe}</span>
                    </div>
                    <button className="ftl-add-picker__back" onClick={() => setStep('istufe')}>← Zurück</button>
                    <div className="ftl-add-picker__list">
                        {OFFSET_LIST.map(off => (
                            <button key={off} className="ftl-add-picker__item"
                                onClick={() => onAdd(selectedIstufe, off)}>
                                {off}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

/* ══════════════════════════════════════════════════════
   Ticket Badges + Detail Drawer (click → panel)
   ══════════════════════════════════════════════════════ */

type SelectedTicket =
    | { kind: 'penthouse'; ticket: PenthouseTicket }
    | { kind: 'verbund'; ticket: VerbundTicket };

function ticketColor(name: string): string {
    const cat = name.toUpperCase();
    // Level suffix match ("420 HV-L2" → "L2", "L2_HV" → "L2")
    const levelMatch = cat.match(/\bL([1-4])\b/);
    if (levelMatch) {
        switch (levelMatch[1]) {
            case '1': return '#E86427';
            case '2': return '#3D7A34';
            case '3': return '#2A5C23';
            case '4': return '#1A3D14';
        }
    }
    if (cat.startsWith('RSTB') || cat.includes('RSTB')) return '#F5A623';
    if (cat === 'FB') return '#1C69D4';
    return '#6F6F6F';
}

type PopoverPlacement = 'center' | 'left' | 'right';

function usePopoverPlacement(active: boolean, wrapperRef: React.RefObject<HTMLElement | null>): PopoverPlacement {
    const [placement, setPlacement] = useState<PopoverPlacement>('center');
    useLayoutEffect(() => {
        if (!active || !wrapperRef.current) return;
        const POPOVER_WIDTH = 340;
        const MARGIN = 16;
        const compute = () => {
            if (!wrapperRef.current) return;
            const rect = wrapperRef.current.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const vpWidth = window.innerWidth;
            if (centerX + POPOVER_WIDTH / 2 + MARGIN > vpWidth) setPlacement('right');
            else if (centerX - POPOVER_WIDTH / 2 < MARGIN) setPlacement('left');
            else setPlacement('center');
        };
        compute();
        window.addEventListener('resize', compute);
        return () => window.removeEventListener('resize', compute);
    }, [active, wrapperRef]);
    return placement;
}

const TicketPopoverContent: React.FC<{
    selection: SelectedTicket;
    onClose: () => void;
    placement: PopoverPlacement;
}> = ({ selection, onClose, placement }) => {
    const isPenthouse = selection.kind === 'penthouse';
    const name = selection.ticket.name;
    const headerColor = ticketColor(name);
    return (
        <div className={`ftl-ticket-popover ftl-ticket-popover--${placement}`} role="dialog" onClick={e => e.stopPropagation()}>
            <header className="ftl-ticket-popover__header" style={{ backgroundColor: headerColor }}>
                <div>
                    <div className="ftl-ticket-popover__kicker">
                        {isPenthouse ? 'Penthouse-Ticket' : 'Verbund-Ticket (Swap)'}
                    </div>
                    <div className="ftl-ticket-popover__title">
                        {isPenthouse ? selection.ticket.jiraKey : selection.ticket.collapseId}
                    </div>
                </div>
                <button className="ftl-ticket-popover__close" onClick={onClose} aria-label="Close">×</button>
            </header>
            <div className="ftl-ticket-popover__body">
                <div className="ftl-drawer__row">
                    <span className="ftl-drawer__label">Name</span>
                    <span className="ftl-drawer__value">{name || '—'}</span>
                </div>
                {isPenthouse
                    ? <PenthouseDrawerFields ticket={selection.ticket} />
                    : <VerbundDrawerFields ticket={selection.ticket} />}
            </div>
        </div>
    );
};

function useClickOutsideAndEscape(active: boolean, wrapperRef: React.RefObject<HTMLElement | null>, onClose: () => void) {
    const onCloseRef = useRef(onClose);
    useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
    useEffect(() => {
        if (!active) return;
        const handleMouse = (e: MouseEvent) => {
            if (wrapperRef.current?.contains(e.target as Node)) return;
            onCloseRef.current();
        };
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onCloseRef.current();
        };
        document.addEventListener('mousedown', handleMouse);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleMouse);
            document.removeEventListener('keydown', handleKey);
        };
    }, [active, wrapperRef]);
}

const PenthouseTicketBadge: React.FC<{
    ticket: PenthouseTicket;
    onOpen: (t: PenthouseTicket) => void;
    onClose: () => void;
    isActive: boolean;
}> = ({ ticket, onOpen, onClose, isActive }) => {
    const wrapperRef = useRef<HTMLSpanElement>(null);
    useClickOutsideAndEscape(isActive, wrapperRef, onClose);
    const placement = usePopoverPlacement(isActive, wrapperRef);
    return (
        <span ref={wrapperRef} className="ftl-ticket-wrapper">
            <button
                type="button"
                className={`ftl-ticket-badge${isActive ? ' ftl-ticket-badge--active' : ''}`}
                style={{ backgroundColor: ticketColor(ticket.name) }}
                onClick={e => { e.stopPropagation(); isActive ? onClose() : onOpen(ticket); }}
                title={`${ticket.jiraKey} · ${ticket.name}`}
            >
                {ticket.name || '?'}
            </button>
            {isActive && <TicketPopoverContent selection={{ kind: 'penthouse', ticket }} onClose={onClose} placement={placement} />}
        </span>
    );
};

const VerbundTicketBadge: React.FC<{
    ticket: VerbundTicket;
    onOpen: (t: VerbundTicket) => void;
    onClose: () => void;
    isActive: boolean;
}> = ({ ticket, onOpen, onClose, isActive }) => {
    const wrapperRef = useRef<HTMLSpanElement>(null);
    useClickOutsideAndEscape(isActive, wrapperRef, onClose);
    const placement = usePopoverPlacement(isActive, wrapperRef);
    return (
        <span ref={wrapperRef} className="ftl-ticket-wrapper">
            <button
                type="button"
                className={`ftl-ticket-badge ftl-ticket-badge--verbund${isActive ? ' ftl-ticket-badge--active' : ''}`}
                style={{ backgroundColor: ticketColor(ticket.name) }}
                onClick={e => { e.stopPropagation(); isActive ? onClose() : onOpen(ticket); }}
                title={`${ticket.collapseId} · ${ticket.name}`}
            >
                {ticket.name || '?'}
            </button>
            {isActive && <TicketPopoverContent selection={{ kind: 'verbund', ticket }} onClose={onClose} placement={placement} />}
        </span>
    );
};

const PenthouseDrawerFields: React.FC<{ ticket: PenthouseTicket }> = ({ ticket }) => (
    <>
        <div className="ftl-drawer__row">
            <span className="ftl-drawer__label">Due-Date</span>
            <span className="ftl-drawer__value">{ticket.dueDate || '—'}</span>
        </div>
        <div className="ftl-drawer__row">
            <span className="ftl-drawer__label">Kalenderwoche</span>
            <span className="ftl-drawer__value">{ticket.yearWeek || '—'}</span>
        </div>
        {ticket.parentJiraIssue && (
            <div className="ftl-drawer__row">
                <span className="ftl-drawer__label">Parent</span>
                <span className="ftl-drawer__value">{ticket.parentJiraIssue}</span>
            </div>
        )}
        {ticket.parentBranches.length > 0 && (
            <div className="ftl-drawer__row">
                <span className="ftl-drawer__label">Branches</span>
                <span className="ftl-drawer__value">{ticket.parentBranches.join(', ')}</span>
            </div>
        )}
        <div className="ftl-drawer__row">
            <span className="ftl-drawer__label">Link</span>
            <a className="ftl-drawer__link" href={ticket.jiraUrl} target="_blank" rel="noopener noreferrer">
                Open in Jira ↗
            </a>
        </div>
        {ticket.iLevelNames.length > 0 && (
            <div className="ftl-drawer__section">
                <div className="ftl-drawer__section-title">
                    I-Stufen <span className="ftl-drawer__count">({ticket.iLevelNames.length})</span>
                </div>
                <div className="ftl-drawer__tags">
                    {ticket.iLevelNames.map(n => (
                        <span key={n} className="ftl-drawer__tag">{n}</span>
                    ))}
                </div>
            </div>
        )}
    </>
);

const VerbundDrawerFields: React.FC<{ ticket: VerbundTicket }> = ({ ticket }) => (
    <>
        <div className="ftl-drawer__row">
            <span className="ftl-drawer__label">Collapse ID</span>
            <span className="ftl-drawer__value">{ticket.collapseId || '—'}</span>
        </div>
        <div className="ftl-drawer__row">
            <span className="ftl-drawer__label">Start Date</span>
            <span className="ftl-drawer__value">{ticket.startDate || '—'}</span>
        </div>
        <div className="ftl-drawer__row">
            <span className="ftl-drawer__label">End Date</span>
            <span className="ftl-drawer__value">{ticket.endDate || '—'}</span>
        </div>
        <div className="ftl-drawer__row">
            <span className="ftl-drawer__label">Kalenderwoche</span>
            <span className="ftl-drawer__value">{ticket.yearWeek || '—'}</span>
        </div>
        {ticket.iLevelNames.length > 0 && (
            <div className="ftl-drawer__section">
                <div className="ftl-drawer__section-title">
                    I-Stufen <span className="ftl-drawer__count">({ticket.iLevelNames.length})</span>
                </div>
                <div className="ftl-drawer__tags">
                    {ticket.iLevelNames.map(n => (
                        <span key={n} className="ftl-drawer__tag">{n}</span>
                    ))}
                </div>
            </div>
        )}
    </>
);

/* ══════════════════════════════════════════════════════
   Filter Panel
   ══════════════════════════════════════════════════════ */

interface Filters { wbsType: string; muster: string; penthouse: string; search: string; }
const EMPTY_FILTERS: Filters = { wbsType: '', muster: '', penthouse: '', search: '' };

const FilterPanel: React.FC<{
    filters: Filters; onChange: (f: Filters) => void;
    onReset?: () => void;
    hvsCount: number; istufeCount: number;
}> = ({ filters, onChange, onReset, hvsCount, istufeCount }) => {
    const wbsOptions = [...new Set(HVS_DATA.map(h => h.wbsType))];
    const musterOptions = [...new Set(HVS_DATA.map(h => h.muster).filter(Boolean))];
    const penthouseOptions = [...new Set(HVS_DATA.map(h => h.penthouse).filter(Boolean))].sort();
    const set = (k: keyof Filters, v: string) => onChange({ ...filters, [k]: v });
    const handleReset = () => { onChange(EMPTY_FILTERS); onReset?.(); };

    return (
        <div className="ftl-filters">
            <div className="ftl-filters__row">
                <input className="ftl-filters__search" type="text" placeholder="HVS, WBS suchen..."
                    value={filters.search} onChange={e => set('search', e.target.value)} />
                <select className="ftl-filters__select" value={filters.penthouse} onChange={e => set('penthouse', e.target.value)}>
                    <option value="">Alle Penthouses</option>
                    {penthouseOptions.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <select className="ftl-filters__select" value={filters.wbsType} onChange={e => set('wbsType', e.target.value)}>
                    <option value="">Alle WBS-Typen</option>
                    {wbsOptions.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
                <select className="ftl-filters__select" value={filters.muster} onChange={e => set('muster', e.target.value)}>
                    <option value="">Alle Muster</option>
                    {musterOptions.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                {Object.values(filters).some(Boolean) && (
                    <button className="btn btn--ghost btn--sm" onClick={handleReset}>Filter zurücksetzen</button>
                )}
            </div>
            <div className="ftl-filters__stats">
                <span>{hvsCount} Speichertypen</span>
                <span>{istufeCount} aktive Softwarestände</span>
            </div>
        </div>
    );
};

/* ══════════════════════════════════════════════════════
   Main Component
   ══════════════════════════════════════════════════════ */

export const FreigabeTimelinePage: React.FC = () => {
    const now = new Date();
    const currentWeek = getISOWeek(now);
    const currentYear = getISOWeekYear(now);

    /* ── Week navigation ── */
    const [weekOffset, setWeekOffset] = useState(0);

    /* ── Data refresh (dev-only: POSTs to /__dv__/refresh) ──
       The dump script runs `pac org fetch` per (table × attr); expect ~2–3 min. */
    const [refreshState, setRefreshState] = useState<'idle' | 'loading' | 'error'>('idle');
    const [refreshError, setRefreshError] = useState<string>('');
    const [refreshStartedAt, setRefreshStartedAt] = useState<number>(0);
    const [refreshElapsed, setRefreshElapsed] = useState<number>(0);

    useEffect(() => {
        if (refreshState !== 'loading') return;
        const t = setInterval(() => setRefreshElapsed(Math.floor((Date.now() - refreshStartedAt) / 1000)), 1000);
        return () => clearInterval(t);
    }, [refreshState, refreshStartedAt]);

    const handleRefresh = useCallback(async () => {
        if (refreshState === 'loading') return;
        setRefreshState('loading');
        setRefreshError('');
        setRefreshStartedAt(Date.now());
        setRefreshElapsed(0);
        try {
            // No client timeout — pac dump can take 2–3 minutes
            const res = await fetch('/__dv__/refresh', { method: 'POST' });
            const body = await res.json().catch(() => ({}));
            if (!res.ok || !body.ok) {
                throw new Error(body.error || `HTTP ${res.status}`);
            }
            // Reload to re-evaluate the bundled JSON imports against the refreshed files
            window.location.reload();
        } catch (e) {
            setRefreshState('error');
            setRefreshError(e instanceof Error ? e.message : String(e));
        }
    }, [refreshState]);
    const centerDate = useMemo(() => {
        const d = getMonday(currentWeek, currentYear);
        d.setUTCDate(d.getUTCDate() + weekOffset * 7);
        return d;
    }, [currentWeek, currentYear, weekOffset]);
    const weeks = useMemo(() => buildWeekWindow(getISOWeek(centerDate), getISOWeekYear(centerDate)), [centerDate]);
    const weekKeys = useMemo(() => weeks.map(kwToYearWeek), [weeks]);

    /* ── Active I-Stufen (all SE_TERMIN combined, sorted by Reife desc) ── */
    const activeIStufen = useMemo(() => {
        const seen = new Set<string>();
        const result: IStufeMaster[] = [];
        for (const wk of weekKeys) {
            for (const m of getActiveIStufen(wk)) {
                if (!seen.has(m.istufe)) { seen.add(m.istufe); result.push(m); }
            }
        }
        // Sort: highest Reife first (most mature on top)
        return result.sort((a, b) => b.reife - a.reife);
    }, [weekKeys]);

    const activeIstufeKeys = useMemo(() => new Set(activeIStufen.map(m => m.istufe)), [activeIStufen]);

    /** All I-Stufen that appear anywhere (active + manually added) */
    const [manualEntries, setManualEntries] = useState<{ weekKey: string; hvsKey: string; istufe: string; offset: string }[]>([]);

    const allVisibleIStufen = useMemo(() => {
        const seen = new Set(activeIStufen.map(m => m.istufe));
        const extra: IStufeMaster[] = [];
        for (const me of manualEntries) {
            if (!seen.has(me.istufe)) {
                const master = ISTUFE_MASTERS.find(m => m.istufe === me.istufe);
                if (master) { extra.push(master); seen.add(me.istufe); }
            }
        }
        return [...activeIStufen, ...extra];
    }, [activeIStufen, manualEntries]);

    const istufeColors = useMemo(() => buildIstufeColorMap(allVisibleIStufen), [allVisibleIStufen]);

    /* ── Bulk edit: SE_TERMIN + Reifegrad → derive ISTUFE key ── */
    const [bulkSeTermin, setBulkSeTermin] = useState<string>('');
    const [bulkReife, setBulkReife] = useState<string>('');

    const seTerminOptions = useMemo(() => {
        return [...new Set(ISTUFE_MASTERS.map(m => m.seTermin))].sort();
    }, []);

    const reifeOptions = useMemo(() => {
        if (!bulkSeTermin) return [] as number[];
        const set = new Set<number>();
        for (const m of ISTUFE_MASTERS) if (m.seTermin === bulkSeTermin) set.add(m.reife);
        return [...set].sort((a, b) => b - a);
    }, [bulkSeTermin]);

    const effectiveSelected = useMemo<string | null>(() => {
        if (!bulkSeTermin || !bulkReife) return null;
        const key = `${bulkSeTermin}-${bulkReife}`;
        return ISTUFE_MASTERS.some(m => m.istufe === key) ? key : null;
    }, [bulkSeTermin, bulkReife]);

    const selectIstufe = useCallback((istufe: string | null) => {
        if (!istufe) { setBulkSeTermin(''); setBulkReife(''); return; }
        const master = ISTUFE_MASTERS.find(m => m.istufe === istufe);
        if (master) { setBulkSeTermin(master.seTermin); setBulkReife(String(master.reife)); }
    }, []);

    /* ── Filters ── */
    const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

    const filteredHvs = useMemo(() => {
        let rows = HVS_DATA;
        if (filters.wbsType) rows = rows.filter(h => h.wbsType === filters.wbsType);
        if (filters.muster) rows = rows.filter(h => h.muster === filters.muster);
        if (filters.penthouse) rows = rows.filter(h => h.penthouse === filters.penthouse);
        if (filters.search) {
            const q = filters.search.toLowerCase();
            rows = rows.filter(h =>
                h.hvs.toLowerCase().includes(q) || h.wbsType.toLowerCase().includes(q) ||
                h.key.toLowerCase().includes(q) || h.muster.toLowerCase().includes(q) ||
                h.penthouse.toLowerCase().includes(q)
            );
        }
        return rows;
    }, [filters]);

    /* ── HVS active/inactive toggle ── */
    const [hvsActive, setHvsActive] = useState<Record<string, boolean>>(() => {
        const m: Record<string, boolean> = {};
        for (const h of HVS_DATA) m[h.key] = h.defaultActive;
        return m;
    });

    const toggleHvsActive = useCallback((key: string) => {
        setHvsActive(prev => ({ ...prev, [key]: !prev[key] }));
    }, []);

    /* ── I-Stufe ranking and Lead flag — PER WEEK ──
       Keys are "weekKey|istufe" e.g. "2026-15|26-07-480" */
    const [istufeRank, setIstufeRank] = useState<Record<string, number>>({});
    const [istufeLeads, setIstufeLeads] = useState<Record<string, boolean>>({});

    /** Get effective rank for an I-Stufe in a week (fallback = position index + 1) */
    function getEffectiveRank(weekKey: string, istufe: string, activeInWeek: IStufeMaster[]): number {
        const stored = istufeRank[`${weekKey}|${istufe}`];
        if (stored != null) return stored;
        return activeInWeek.findIndex(m => m.istufe === istufe) + 1;
    }

    /** Get the rank for display in the dropdown */
    function getRank(weekKey: string, istufe: string, fallbackIdx: number): number {
        return istufeRank[`${weekKey}|${istufe}`] ?? (fallbackIdx + 1);
    }

    /** Get all I-Stufe keys in the same rank group for a specific week */
    function getRankGroupMembers(weekKey: string, istufe: string, activeInWeek: IStufeMaster[]): string[] {
        const rank = getEffectiveRank(weekKey, istufe, activeInWeek);
        return activeInWeek
            .filter(m => getEffectiveRank(weekKey, m.istufe, activeInWeek) === rank)
            .map(m => m.istufe);
    }

    /** Check if an I-Stufe is in a shared rank group */
    function isInGroup(weekKey: string, istufe: string, activeInWeek: IStufeMaster[]): boolean {
        return getRankGroupMembers(weekKey, istufe, activeInWeek).length > 1;
    }

    /** Check if an I-Stufe is editable in a specific week */
    function isEditableInWeek(weekKey: string, istufe: string, activeInWeek: IStufeMaster[]): boolean {
        if (!isInGroup(weekKey, istufe, activeInWeek)) return true;
        return !!istufeLeads[`${weekKey}|${istufe}`];
    }

    /** Check if a group needs a Lead in a specific week */
    function groupNeedsLeadInWeek(weekKey: string, istufe: string, activeInWeek: IStufeMaster[]): boolean {
        if (!isInGroup(weekKey, istufe, activeInWeek)) return false;
        const members = getRankGroupMembers(weekKey, istufe, activeInWeek);
        return !members.some(k => istufeLeads[`${weekKey}|${k}`]);
    }

    const handleRankChange = useCallback((weekKey: string, istufe: string, rank: number) => {
        setIstufeRank(prev => ({ ...prev, [`${weekKey}|${istufe}`]: rank }));
    }, []);

    const toggleLead = useCallback((weekKey: string, istufe: string, activeInWeek: IStufeMaster[]) => {
        const key = `${weekKey}|${istufe}`;
        const rank = istufeRank[`${weekKey}|${istufe}`] ?? (activeInWeek.findIndex(m => m.istufe === istufe) + 1);
        const groupMembers = activeInWeek
            .filter(m => (istufeRank[`${weekKey}|${m.istufe}`] ?? (activeInWeek.findIndex(x => x.istufe === m.istufe) + 1)) === rank)
            .map(m => m.istufe);
        setIstufeLeads(prev => {
            const next = { ...prev };
            const willBecome = !prev[key];
            if (willBecome) {
                for (const member of groupMembers) {
                    if (member !== istufe) next[`${weekKey}|${member}`] = false;
                }
            }
            next[key] = willBecome;
            return next;
        });
    }, [istufeRank]);

    /* ── Ist-Stand state ── */
    const [istStand, setIstStand] = useState<Record<string, string>>({});
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);

    /**
     * Cascading approval:
     * - Patches all non-lead members of the same rank group in this week
     */
    const handleIstChange = useCallback((istufeKey: string, weekKey: string, hvsKey: string, value: string) => {
        const wkIdx = weekToIndex(weekKey);
        const activeInWeek = activeIStufen.filter(m => {
            return weekToIndex(m.atsWeek) <= wkIdx && wkIdx <= weekToIndex(m.sabWeek);
        });

        // Compute group members inline using same logic
        const rank = istufeRank[`${weekKey}|${istufeKey}`] ?? (activeInWeek.findIndex(m => m.istufe === istufeKey) + 1);
        const groupMembers = activeInWeek
            .filter(m => (istufeRank[`${weekKey}|${m.istufe}`] ?? (activeInWeek.findIndex(x => x.istufe === m.istufe) + 1)) === rank)
            .map(m => m.istufe);

        setIstStand(prev => {
            const next = { ...prev };
            next[`${istufeKey}|${weekKey}|${hvsKey}`] = value;
            for (const member of groupMembers) {
                if (member !== istufeKey) {
                    next[`${member}|${weekKey}|${hvsKey}`] = value;
                }
            }
            return next;
        });
        setOpenDropdown(null);
    }, [activeIStufen, istufeRank]);

    /* ── Manual entries helper functions ── */
    const [addPickerOpen, setAddPickerOpen] = useState<string | null>(null);

    const addManualEntry = useCallback((weekKey: string, hvsKey: string, istufe: string, offset: string) => {
        const exists = manualEntries.some(e => e.weekKey === weekKey && e.hvsKey === hvsKey && e.istufe === istufe && e.offset === offset);
        if (!exists) {
            setManualEntries(prev => [...prev, { weekKey, hvsKey, istufe, offset }]);
        }
        setAddPickerOpen(null);
    }, [manualEntries]);

    const removeManualEntry = useCallback((weekKey: string, hvsKey: string, istufe: string, offset: string) => {
        setManualEntries(prev => prev.filter(e => !(e.weekKey === weekKey && e.hvsKey === hvsKey && e.istufe === istufe && e.offset === offset)));
    }, []);

    /** Get manual entries for a specific cell, grouped by I-Stufe */
    function getManualEntriesForCell(weekKey: string, hvsKey: string) {
        return manualEntries.filter(e => e.weekKey === weekKey && e.hvsKey === hvsKey);
    }

    /* ── CDH milestones ── */
    const cdhByWeekAndKey = useMemo(() => {
        const map = new Map<string, typeof FREIGABE_SCHEDULE_UNIQUE>();
        for (const e of FREIGABE_SCHEDULE_UNIQUE) {
            const k = `${e.startWeek}|${e.key}`;
            if (!map.has(k)) map.set(k, []);
            map.get(k)!.push(e);
        }
        return map;
    }, []);

    /* ── Jira ticket ID ── */
    function jiraId(istufe: string, pth: string, level: string): string {
        return `${istufe}_${pth || '—'}_${level}`;
    }

    /* ── Bulk Edit state ── */
    const [bulkLevel, setBulkLevel] = useState<string>('');
    const [bulkHvsSelection, setBulkHvsSelection] = useState<Set<string>>(new Set());
    const [bulkWeeks, setBulkWeeks] = useState<Set<string>>(new Set());
    const [showBulkConfirm, setShowBulkConfirm] = useState(false);

    const resetBulk = useCallback(() => {
        setBulkSeTermin('');
        setBulkReife('');
        setBulkLevel('');
        setBulkHvsSelection(new Set());
        setBulkWeeks(new Set());
    }, []);

    const toggleBulkWeek = useCallback((wk: string) => {
        setBulkWeeks(prev => {
            const next = new Set(prev);
            if (next.has(wk)) next.delete(wk); else next.add(wk);
            return next;
        });
    }, []);

    /* ── Ticket detail panel ── */
    const [selectedTicket, setSelectedTicket] = useState<SelectedTicket | null>(null);
    const closeTicket = useCallback(() => setSelectedTicket(null), []);

    const toggleBulkHvs = useCallback((key: string) => {
        setBulkHvsSelection(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    }, []);

    const selectAllBulkHvs = useCallback(() => {
        setBulkHvsSelection(new Set(filteredHvs.filter(h => hvsActive[h.key] ?? true).map(h => h.key)));
    }, [filteredHvs, hvsActive]);

    const clearBulkHvs = useCallback(() => {
        setBulkHvsSelection(new Set());
    }, []);

    /** Weeks in the current view where the selected ISTUFE is active */
    const availableWeeks = useMemo(() => {
        if (!effectiveSelected) return [] as string[];
        const master = ISTUFE_MASTERS.find(m => m.istufe === effectiveSelected);
        if (!master) return [];
        const atsIdx = weekToIndex(master.atsWeek);
        const sabIdx = weekToIndex(master.sabWeek);
        return weekKeys.filter(wk => {
            const idx = weekToIndex(wk);
            return atsIdx <= idx && idx <= sabIdx;
        });
    }, [effectiveSelected, weekKeys]);

    /** Auto-select all available weeks whenever the set of available weeks changes */
    useEffect(() => {
        setBulkWeeks(new Set(availableWeeks));
    }, [availableWeeks]);

    /** Weeks that will actually be written: intersection of user-selected and available */
    const affectedWeeks = useMemo(() => {
        return availableWeeks.filter(wk => bulkWeeks.has(wk));
    }, [availableWeeks, bulkWeeks]);

    const applyBulk = useCallback(() => {
        if (!effectiveSelected || !bulkLevel || affectedWeeks.length === 0) return;

        setIstStand(prev => {
            const next = { ...prev };
            for (const weekKey of affectedWeeks) {
                const wkIdx = weekToIndex(weekKey);
                const activeInWeek = allVisibleIStufen.filter(m => {
                    return weekToIndex(m.atsWeek) <= wkIdx && wkIdx <= weekToIndex(m.sabWeek);
                });
                const rank: number = istufeRank[`${weekKey}|${effectiveSelected}`]
                    ?? (activeInWeek.findIndex(m => m.istufe === effectiveSelected) + 1);
                const groupMembers: string[] = activeInWeek
                    .filter(m => (istufeRank[`${weekKey}|${m.istufe}`]
                        ?? (activeInWeek.findIndex(x => x.istufe === m.istufe) + 1)) === rank)
                    .map(m => m.istufe);

                for (const hvsKey of bulkHvsSelection) {
                    next[`${effectiveSelected}|${weekKey}|${hvsKey}`] = bulkLevel;
                    for (const member of groupMembers) {
                        if (member !== effectiveSelected) {
                            next[`${member}|${weekKey}|${hvsKey}`] = bulkLevel;
                        }
                    }
                }
            }
            return next;
        });
    }, [effectiveSelected, bulkLevel, bulkHvsSelection, affectedWeeks, allVisibleIStufen, istufeRank]);

    const bulkCount = bulkHvsSelection.size;
    const bulkReady = !!effectiveSelected && !!bulkLevel && bulkCount > 0 && affectedWeeks.length > 0;

    /* ══════════════════════════════════════════════════
       RENDER
       ══════════════════════════════════════════════════ */

    return (
        <div className="ftl-page">
            {/* ── Header ── */}
            <div className="ftl-page__header">
                <div>
                    <h1 className="ftl-page__title">Freigabe Timeline</h1>
                    <p className="ftl-page__subtitle">
                        Hochvoltspeicher-Freigaben
                    </p>
                </div>
                <div className="ftl-nav">
                    <button className={`ftl-refresh-btn${refreshState === 'loading' ? ' ftl-refresh-btn--loading' : ''}${refreshState === 'error' ? ' ftl-refresh-btn--error' : ''}`}
                        onClick={handleRefresh}
                        disabled={refreshState === 'loading'}
                        title={refreshState === 'error'
                            ? `Fehler: ${refreshError}`
                            : 'Lädt aktuelle Daten aus Dataverse (~2–3 min)'}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                            className={refreshState === 'loading' ? 'ftl-refresh-btn__spin' : ''}
                            aria-hidden="true">
                            <polyline points="23 4 23 10 17 10" />
                            <polyline points="1 20 1 14 7 14" />
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                        </svg>
                        <span>
                            {refreshState === 'loading'
                                ? `Lädt… ${refreshElapsed}s`
                                : refreshState === 'error'
                                    ? 'Fehlgeschlagen'
                                    : 'Aktualisieren'}
                        </span>
                    </button>
                    <span className="ftl-nav__sep" aria-hidden="true" />
                    <button className="btn btn--ghost btn--sm" onClick={() => setWeekOffset(o => o - 3)}>« 3</button>
                    <button className="btn btn--ghost btn--sm" onClick={() => setWeekOffset(o => o - 1)}>‹</button>
                    <button className="btn btn--primary btn--sm" onClick={() => setWeekOffset(0)}>Heute</button>
                    <button className="btn btn--ghost btn--sm" onClick={() => setWeekOffset(o => o + 1)}>›</button>
                    <button className="btn btn--ghost btn--sm" onClick={() => setWeekOffset(o => o + 3)}>3 »</button>
                </div>
            </div>

            {/* ── Bulk Edit Panel ── */}
            <div className="ftl-bulk">
                <div className="ftl-bulk__header">
                    <div className="ftl-bulk__header-left">
                        <div className="ftl-bulk__title">Bulk-Freigabe</div>
                        <div className="ftl-bulk__subtitle">Freigabe-Level für mehrere HVS in allen aktiven Wochen setzen</div>
                    </div>
                    {effectiveSelected ? (
                        <span className="ftl-bulk__current-badge"
                            style={(() => {
                                const c = istufeColors.get(effectiveSelected);
                                return c ? { backgroundColor: c.bar, color: c.text } : undefined;
                            })()}
                            title="Bearbeitung aktiv für diesen Softwarestand">
                            {effectiveSelected}
                        </span>
                    ) : null}
                </div>

                <div className="ftl-bulk__body">
                    {/* Step 1: pick the target */}
                    <section className="ftl-bulk__section">
                        <div className="ftl-bulk__section-title">
                            <span className="ftl-bulk__step">1</span>
                            Zielstand wählen
                        </div>
                        <div className="ftl-bulk__grid">
                            <div className="ftl-bulk__field">
                                <label className="ftl-bulk__label">ISTUFE</label>
                                <select className="ftl-bulk__select"
                                    value={bulkSeTermin}
                                    onChange={e => { setBulkSeTermin(e.target.value); setBulkReife(''); }}>
                                    <option value="">— wählen —</option>
                                    {seTerminOptions.map(se => <option key={se} value={se}>{se}</option>)}
                                </select>
                            </div>
                            <div className="ftl-bulk__field">
                                <label className="ftl-bulk__label">Reifegrad</label>
                                <select className="ftl-bulk__select"
                                    value={bulkReife}
                                    onChange={e => setBulkReife(e.target.value)}
                                    disabled={!bulkSeTermin}>
                                    <option value="">{bulkSeTermin ? '— wählen —' : 'Zuerst ISTUFE wählen'}</option>
                                    {reifeOptions.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            <div className="ftl-bulk__field">
                                <label className="ftl-bulk__label">Freigabe-Level</label>
                                <select className="ftl-bulk__select" value={bulkLevel} onChange={e => setBulkLevel(e.target.value)}>
                                    <option value="">— wählen —</option>
                                    {['X', 'RSTB', 'L1', 'L2', 'L3', 'L4'].map(l => <option key={l} value={l}>{l}</option>)}
                                </select>
                            </div>
                        </div>
                        {effectiveSelected && (
                            <div className="ftl-bulk__weeks-preview">
                                <span className="ftl-bulk__weeks-label">Kalenderwochen:</span>
                                {availableWeeks.length > 0 ? (
                                    <>
                                        {availableWeeks.map(wk => {
                                            const isChecked = bulkWeeks.has(wk);
                                            return (
                                                <button key={wk} type="button"
                                                    className={`ftl-bulk__week-pill ftl-bulk__week-pill--selectable${isChecked ? ' ftl-bulk__week-pill--active' : ''}`}
                                                    onClick={() => toggleBulkWeek(wk)}>
                                                    KW{wk.split('-')[1]}
                                                </button>
                                            );
                                        })}
                                        <button type="button" className="ftl-bulk__weeks-toggle"
                                            onClick={() => {
                                                if (affectedWeeks.length === availableWeeks.length) {
                                                    setBulkWeeks(new Set());
                                                } else {
                                                    setBulkWeeks(new Set(availableWeeks));
                                                }
                                            }}>
                                            {affectedWeeks.length === availableWeeks.length ? 'Keine' : 'Alle'}
                                        </button>
                                    </>
                                ) : (
                                    <span className="ftl-bulk__weeks-empty">Nicht aktiv im sichtbaren Zeitfenster — Woche navigieren</span>
                                )}
                            </div>
                        )}
                    </section>

                    {/* Step 2: HVS selection */}
                    <section className="ftl-bulk__section">
                        <div className="ftl-bulk__section-title">
                            <span className="ftl-bulk__step">2</span>
                            HVS auswählen
                            <span className="ftl-bulk__count-pill">{bulkCount}</span>
                            <div className="ftl-bulk__hvs-actions">
                                <button className="btn btn--ghost btn--sm" onClick={selectAllBulkHvs}>Alle aktiven</button>
                                <button className="btn btn--ghost btn--sm" onClick={clearBulkHvs}>Keine</button>
                            </div>
                        </div>
                        <div className="ftl-bulk__hvs-list">
                            {filteredHvs.map(h => {
                                const isAct = hvsActive[h.key] ?? true;
                                const isChecked = bulkHvsSelection.has(h.key);
                                return (
                                    <label key={h.key}
                                        className={`ftl-bulk__hvs-item${!isAct ? ' ftl-bulk__hvs-item--disabled' : ''}${isChecked ? ' ftl-bulk__hvs-item--checked' : ''}`}>
                                        <input type="checkbox" checked={isChecked}
                                            disabled={!isAct}
                                            onChange={() => toggleBulkHvs(h.key)} />
                                        <span className="ftl-bulk__hvs-name">{h.wbsType}</span>
                                        {h.muster && <span className="ftl-bulk__hvs-muster">{h.muster}</span>}
                                    </label>
                                );
                            })}
                        </div>
                    </section>
                </div>

                {/* Actions bar */}
                <div className="ftl-bulk__actions">
                    <button className="btn btn--ghost btn--sm" onClick={resetBulk}>Zurücksetzen</button>
                    <div className="ftl-bulk__actions-right">
                        <span className="ftl-bulk__ready-hint">
                            {bulkReady
                                ? `${bulkCount} HVS × ${affectedWeeks.length} KW`
                                : 'ISTUFE, Reifegrad, Level und HVS wählen'}
                        </span>
                        <button className={`btn btn--primary${bulkReady ? '' : ' btn--disabled'}`}
                            disabled={!bulkReady}
                            onClick={() => setShowBulkConfirm(true)}>
                            Vorschau &amp; Bestätigen
                        </button>
                    </div>
                </div>

                {/* Confirmation dialog */}
                {showBulkConfirm && bulkReady && (
                    <div className="ftl-bulk__confirm">
                        <div className="ftl-bulk__confirm-title">Bulk-Freigabe bestätigen</div>
                        <div className="ftl-bulk__confirm-summary">
                            <div className="ftl-bulk__confirm-row">
                                <span className="ftl-bulk__confirm-label">ISTUFE:</span>
                                <strong>{bulkSeTermin}</strong>
                            </div>
                            <div className="ftl-bulk__confirm-row">
                                <span className="ftl-bulk__confirm-label">Reifegrad:</span>
                                <strong>{bulkReife}</strong>
                            </div>
                            <div className="ftl-bulk__confirm-row">
                                <span className="ftl-bulk__confirm-label">Softwarestand:</span>
                                <strong>{effectiveSelected}</strong>
                            </div>
                            <div className="ftl-bulk__confirm-row">
                                <span className="ftl-bulk__confirm-label">Wochen ({affectedWeeks.length}):</span>
                                <div className="ftl-bulk__confirm-weeks">
                                    {affectedWeeks.map(wk => (
                                        <span key={wk} className="ftl-bulk__week-pill">KW{wk.split('-')[1]}</span>
                                    ))}
                                </div>
                            </div>
                            <div className="ftl-bulk__confirm-row">
                                <span className="ftl-bulk__confirm-label">Freigabe-Level:</span>
                                <span className="ftl-gantt__badge" style={{ backgroundColor: lvlColor(bulkLevel).bg, color: lvlColor(bulkLevel).text }}>{bulkLevel}</span>
                            </div>
                            <div className="ftl-bulk__confirm-row">
                                <span className="ftl-bulk__confirm-label">Betroffene HVS ({bulkCount}):</span>
                            </div>
                            <div className="ftl-bulk__confirm-hvs">
                                {filteredHvs.filter(h => bulkHvsSelection.has(h.key)).map(h => (
                                    <span key={h.key} className="ftl-bulk__confirm-hvs-tag">{h.wbsType} {h.muster}</span>
                                ))}
                            </div>
                        </div>
                        <div className="ftl-bulk__confirm-actions">
                            <button className="btn btn--ghost" onClick={() => setShowBulkConfirm(false)}>Abbrechen</button>
                            <button className="btn btn--primary" onClick={() => { applyBulk(); setShowBulkConfirm(false); }}>
                                Bestätigen &amp; Anwenden
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Filters ── */}
            <FilterPanel filters={filters} onChange={setFilters}
                onReset={clearBulkHvs}
                hvsCount={filteredHvs.length} istufeCount={activeIStufen.length} />

            {/* ── Summary strip ── */}
            <div className="ftl-summary">
                <span><strong>{HVS_DATA.length}</strong> HVS</span>
                <span className="ftl-summary__sep">·</span>
                <span><strong>{ISTUFE_MASTERS.length}</strong> I-Stufen</span>
                <span className="ftl-summary__sep">·</span>
                <span><strong>{PENTHOUSE_TICKETS.length}</strong> Penthouse-Tickets</span>
                <span className="ftl-summary__sep">·</span>
                <span><strong>{VERBUND_TICKETS.length}</strong> Verbund-Tickets</span>
            </div>

            {/* ── Gantt Grid ── */}
            <div className="ftl-gantt">
                {/* Column headers */}
                <div className="ftl-gantt__header">
                    <div className="ftl-gantt__label-col ftl-gantt__label-col--header">
                        <span className="ftl-gantt__label-title">HVS / Speichertyp</span>
                        <div className="ftl-gantt__week-nav">
                            <button type="button" className="ftl-gantt__week-nav-btn"
                                aria-label="Vorherige Woche"
                                onClick={() => setWeekOffset(o => o - 1)}>‹</button>
                            <button type="button" className="ftl-gantt__week-nav-btn ftl-gantt__week-nav-btn--today"
                                onClick={() => setWeekOffset(0)}
                                disabled={weekOffset === 0}
                                title="Zur aktuellen Woche">Heute</button>
                            <button type="button" className="ftl-gantt__week-nav-btn"
                                aria-label="Nächste Woche"
                                onClick={() => setWeekOffset(o => o + 1)}>›</button>
                        </div>
                    </div>
                    {weeks.map((w, i) => {
                        const isNow = w.week === currentWeek && w.year === currentYear;
                        const labels = ['▴ Vorwoche', '● Aktuelle KW', '▾ Nächste KW'];
                        const showMonth = i === 0 || w.startDate.getMonth() !== weeks[i - 1].startDate.getMonth() || w.startDate.getFullYear() !== weeks[i - 1].startDate.getFullYear();
                        const monthLabel = w.startDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
                        return (
                            <div key={w.key} className={`ftl-gantt__kw-col${isNow ? ' ftl-gantt__kw-col--current' : ''}`}>
                                {showMonth
                                    ? <span className="ftl-gantt__kw-month">{monthLabel}</span>
                                    : <span className="ftl-gantt__kw-month ftl-gantt__kw-month--placeholder">·</span>}
                                <span className="ftl-gantt__kw-hint">{labels[i]}</span>
                                <span className="ftl-gantt__kw-num">KW{String(w.week).padStart(2, '0')}</span>
                                <span className="ftl-gantt__kw-dates">{formatDate(w.startDate)} – {formatDate(w.endDate)}</span>
                            </div>
                        );
                    })}
                </div>

                {/* ── I-Stufe summary row (colored bars, OFFSETS) ── */}
                <div className="ftl-gantt__istufe-row">
                    <div className="ftl-gantt__label-col">
                        <span className="ftl-gantt__istufe-row-title">Aktive Softwarestände</span>
                    </div>
                    {weeks.map(w => {
                        const yw = kwToYearWeek(w);
                        const isNow = w.week === currentWeek && w.year === currentYear;
                        // Active I-Stufen + manually-added ones for this week
                        const autoActive = activeIStufen.filter(m => {
                            const idx = weekToIndex(yw);
                            return weekToIndex(m.atsWeek) <= idx && idx <= weekToIndex(m.sabWeek);
                        });
                        const manualIstufeKeys = new Set(manualEntries.filter(e => e.weekKey === yw).map(e => e.istufe));
                        const manualExtra = allVisibleIStufen.filter(m => manualIstufeKeys.has(m.istufe) && !autoActive.some(a => a.istufe === m.istufe));
                        const active = [...autoActive, ...manualExtra];
                        return (
                            <div key={w.key} className={`ftl-gantt__cell ftl-gantt__cell--istufe${isNow ? ' ftl-gantt__cell--current' : ''}`}>
                                {active.map(m => {
                                    const c = istufeColors.get(m.istufe)!;
                                    const isSelectedIstufe = effectiveSelected === m.istufe;
                                    return (
                                        <div key={m.istufe}
                                            className={`ftl-gantt__istufe-chip${isSelectedIstufe ? ' ftl-gantt__istufe-chip--selected' : ''}`}
                                            style={{ backgroundColor: c.bar }}
                                            onClick={() => selectIstufe(isSelectedIstufe ? null : m.istufe)}>
                                            <div className="ftl-gantt__istufe-top">
                                                <label className="ftl-gantt__istufe-lead" onClick={e => e.stopPropagation()} title="Lead I-Stufe (für diese KW)">
                                                    <input type="checkbox" checked={!!istufeLeads[`${yw}|${m.istufe}`]}
                                                        onChange={() => toggleLead(yw, m.istufe, active)} />
                                                    <span>Lead</span>
                                                </label>
                                                <select className="ftl-gantt__istufe-rank" value={getRank(yw, m.istufe, active.indexOf(m))}
                                                    onClick={e => e.stopPropagation()}
                                                    onChange={e => handleRankChange(yw, m.istufe, Number(e.target.value))}
                                                    title="Gruppen-ID (für diese KW)">
                                                    {active.map((_, i) => (
                                                        <option key={i + 1} value={i + 1}>{i + 1}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <span className="ftl-gantt__istufe-name">{m.istufe}</span>
                                            <span className="ftl-gantt__istufe-offset">
                                                {[
                                                    getOffsetForWeek(m, yw),
                                                    ...manualEntries
                                                        .filter(e => e.weekKey === yw && e.istufe === m.istufe)
                                                        .map(e => e.offset)
                                                        .filter(o => o !== getOffsetForWeek(m, yw))
                                                ].filter(Boolean).join(', ')}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>

                {/* ── Penthouse-Ticket row (cr9b2_planned_component_approvals) ── */}
                <div className={`ftl-gantt__ticket-row${selectedTicket?.kind === 'penthouse' ? ' ftl-gantt__ticket-row--active' : ''}`}>
                    <div className="ftl-gantt__label-col">
                        <span className="ftl-gantt__istufe-row-title">Penthouse</span>
                        <span className="ftl-gantt__ticket-sub">· Di</span>
                        <span className="ftl-gantt__ticket-count" title="Anzahl Tickets im sichtbaren Zeitfenster">
                            {weekKeys.reduce((s, k) => s + (TICKETS_BY_YEARWEEK.get(k)?.length ?? 0), 0)}
                        </span>
                    </div>
                    {weeks.map(w => {
                        const yw = kwToYearWeek(w);
                        const tickets = TICKETS_BY_YEARWEEK.get(yw) ?? [];
                        const isNow = w.week === currentWeek && w.year === currentYear;
                        return (
                            <div key={w.key} className={`ftl-gantt__cell ftl-gantt__cell--tickets${isNow ? ' ftl-gantt__cell--current' : ''}`}>
                                {tickets.length === 0 && <span className="ftl-gantt__ticket-empty">—</span>}
                                {tickets.map(t => (
                                    <PenthouseTicketBadge
                                        key={t.id}
                                        ticket={t}
                                        isActive={selectedTicket?.kind === 'penthouse' && selectedTicket.ticket.id === t.id}
                                        onOpen={pt => setSelectedTicket({ kind: 'penthouse', ticket: pt })}
                                        onClose={closeTicket}
                                    />
                                ))}
                            </div>
                        );
                    })}
                </div>

                {/* ── Verbund-Ticket row (cr9b2_verbundfreigaben / SWAP) ── */}
                <div className={`ftl-gantt__ticket-row ftl-gantt__ticket-row--verbund${selectedTicket?.kind === 'verbund' ? ' ftl-gantt__ticket-row--active' : ''}`}>
                    <div className="ftl-gantt__label-col">
                        <span className="ftl-gantt__istufe-row-title">Verbund</span>
                        <span className="ftl-gantt__ticket-sub">· Do</span>
                        <span className="ftl-gantt__ticket-count" title="Anzahl Tickets im sichtbaren Zeitfenster">
                            {weekKeys.reduce((s, k) => s + (VERBUND_TICKETS_BY_YEARWEEK.get(k)?.length ?? 0), 0)}
                        </span>
                    </div>
                    {weeks.map(w => {
                        const yw = kwToYearWeek(w);
                        const tickets = VERBUND_TICKETS_BY_YEARWEEK.get(yw) ?? [];
                        const isNow = w.week === currentWeek && w.year === currentYear;
                        return (
                            <div key={w.key} className={`ftl-gantt__cell ftl-gantt__cell--tickets${isNow ? ' ftl-gantt__cell--current' : ''}`}>
                                {tickets.length === 0 && <span className="ftl-gantt__ticket-empty">—</span>}
                                {tickets.map(t => (
                                    <VerbundTicketBadge
                                        key={t.id}
                                        ticket={t}
                                        isActive={selectedTicket?.kind === 'verbund' && selectedTicket.ticket.id === t.id}
                                        onOpen={vt => setSelectedTicket({ kind: 'verbund', ticket: vt })}
                                        onClose={closeTicket}
                                    />
                                ))}
                            </div>
                        );
                    })}
                </div>

                {/* ── HVS rows (flat, no grouping) ── */}
                {filteredHvs.map((hvs, hIdx) => {
                    const isActive = hvsActive[hvs.key] ?? true;
                    return (
                    <div key={hvs.key} className={`ftl-gantt__row${hIdx % 2 !== 0 ? ' ftl-gantt__row--alt' : ''}${!isActive ? ' ftl-gantt__row--inactive' : ''}`}>
                        {/* Label column */}
                        <div className="ftl-gantt__label-col ftl-gantt__label-col--row">
                            {/* Active toggle */}
                            <label className="ftl-gantt__hvs-toggle" title={isActive ? 'Aktiv — klicken zum Deaktivieren' : 'Inaktiv — klicken zum Aktivieren'}>
                                <input type="checkbox" checked={isActive} onChange={() => toggleHvsActive(hvs.key)} />
                                <span className={`ftl-gantt__hvs-toggle-track${isActive ? ' ftl-gantt__hvs-toggle-track--on' : ''}`}>
                                    <span className="ftl-gantt__hvs-toggle-thumb" />
                                </span>
                                <span className={`ftl-gantt__hvs-toggle-label${isActive ? '' : ' ftl-gantt__hvs-toggle-label--off'}`}>
                                    {isActive ? 'Aktiv' : 'Inaktiv'}
                                </span>
                            </label>
                            <div className="ftl-gantt__hvs-main">
                                <span className="ftl-gantt__hvs-id">{hvs.hvs}</span>
                                <span className="ftl-gantt__hvs-wbs">{hvs.wbsType}</span>
                            </div>
                            <div className="ftl-gantt__hvs-meta">
                                {hvs.muster && <span className="ftl-gantt__hvs-muster">{hvs.muster} Muster</span>}
                                {hvs.penthouse && <span className="ftl-gantt__hvs-pth">PTH {hvs.penthouse}</span>}
                                <span className="ftl-gantt__hvs-speicher">{hvs.speicher}</span>
                            </div>
                            <div className="ftl-gantt__hvs-links">
                                <span className="ftl-gantt__link ftl-gantt__link--wmm">WMM</span>
                                <span className="ftl-gantt__link ftl-gantt__link--mia">MIA</span>
                            </div>
                        </div>

                        {/* KW cells */}
                        {weeks.map(w => {
                            const yw = kwToYearWeek(w);
                            const isNow = w.week === currentWeek && w.year === currentYear;
                            const cdhHits = cdhByWeekAndKey.get(`${yw}|${hvs.key}`) ?? [];

                            // Auto-active I-Stufen in this week
                            const autoActive = activeIStufen.filter(m => {
                                const idx = weekToIndex(yw);
                                return weekToIndex(m.atsWeek) <= idx && idx <= weekToIndex(m.sabWeek);
                            });

                            // Manual entries for this cell
                            const cellManual = getManualEntriesForCell(yw, hvs.key);

                            // Build unified rows grouped by Softwarestand
                            // Each row: { istufe, autoOffset, manualOffsets[], isAutoActive }
                            const rowMap = new Map<string, { istufe: string; autoOffset: string | null; manualOffsets: { offset: string; key: string }[]; isAutoActive: boolean }>();

                            // Add auto-active entries (filtered by lead/group logic)
                            for (const m of autoActive) {
                                if (isInGroup(yw, m.istufe, autoActive) && !groupNeedsLeadInWeek(yw, m.istufe, autoActive) && !istufeLeads[`${yw}|${m.istufe}`]) continue;
                                rowMap.set(m.istufe, {
                                    istufe: m.istufe,
                                    autoOffset: getOffsetForWeek(m, yw),
                                    manualOffsets: [],
                                    isAutoActive: true,
                                });
                            }

                            // Add manual entries — merge into existing rows or create new
                            for (const me of cellManual) {
                                const meKey = `manual|${me.istufe}|${me.offset}|${yw}|${hvs.key}`;
                                if (rowMap.has(me.istufe)) {
                                    rowMap.get(me.istufe)!.manualOffsets.push({ offset: me.offset, key: meKey });
                                } else {
                                    rowMap.set(me.istufe, {
                                        istufe: me.istufe,
                                        autoOffset: null,
                                        manualOffsets: [{ offset: me.offset, key: meKey }],
                                        isAutoActive: false,
                                    });
                                }
                            }

                            const rows = [...rowMap.values()];

                            return (
                                <div key={w.key} className={`ftl-gantt__cell${isNow ? ' ftl-gantt__cell--current' : ''}`}>
                                    {/* CDH Soll badges */}
                                    {cdhHits.map((ch, ci) => (
                                        <div key={`s${ci}`} className="ftl-gantt__cell-row ftl-gantt__cell-row--soll">
                                            <span className="ftl-gantt__cell-lbl">Soll</span>
                                            <span className="ftl-gantt__badge" style={{ backgroundColor: lvlColor(ch.freigabeLevel).bg, color: lvlColor(ch.freigabeLevel).text }}>
                                                {ch.freigabeLevel}
                                            </span>
                                        </div>
                                    ))}

                                    {/* Unified rows per Softwarestand */}
                                    {rows.map(row => {
                                        const c = istufeColors.get(row.istufe) ?? ISTUFE_PALETTE[0];
                                        const isSelected = effectiveSelected === row.istufe;
                                        const isDimmed = effectiveSelected !== null && !isSelected;
                                        const canEdit = isActive && isSelected && (row.isAutoActive ? isEditableInWeek(yw, row.istufe, autoActive) : true);
                                        const needsLead = isSelected && row.isAutoActive && groupNeedsLeadInWeek(yw, row.istufe, autoActive);

                                        // Render function for a single offset badge
                                        const renderBadge = (cellKey: string, offset: string, isManual: boolean) => {
                                            const istVal = istStand[cellKey] ?? '';
                                            return (
                                                <div key={cellKey} className="ftl-gantt__cell-badge-group">
                                                    <span className="ftl-gantt__cell-offset" style={{ backgroundColor: c.bar, color: c.text }}>
                                                        {offset}
                                                    </span>
                                                    {canEdit ? (
                                                        <span
                                                            className={`ftl-gantt__badge ftl-gantt__badge--clickable${istVal ? '' : ' ftl-gantt__badge--empty'}`}
                                                            style={istVal ? { backgroundColor: lvlColor(istVal).bg, color: lvlColor(istVal).text } : undefined}
                                                            onClick={e => { e.stopPropagation(); setOpenDropdown(openDropdown === cellKey ? null : cellKey); }}>
                                                            {istVal || '—'}
                                                            <span className="ftl-gantt__badge-caret">▾</span>
                                                        </span>
                                                    ) : needsLead ? (
                                                        <span className="ftl-gantt__badge ftl-gantt__badge--needs-lead">Lead wählen</span>
                                                    ) : (
                                                        <span className={`ftl-gantt__badge${istVal ? '' : ' ftl-gantt__badge--empty ftl-gantt__badge--readonly'}`}
                                                            style={istVal ? { backgroundColor: lvlColor(istVal).bg, color: lvlColor(istVal).text } : undefined}>
                                                            {istVal || '—'}
                                                        </span>
                                                    )}
                                                    {openDropdown === cellKey && (
                                                        <IstDropdown current={istVal}
                                                            onSelect={v => {
                                                                if (isManual) { setIstStand(prev => ({ ...prev, [cellKey]: v })); setOpenDropdown(null); }
                                                                else handleIstChange(row.istufe, yw, hvs.key, v);
                                                            }}
                                                            onClose={() => setOpenDropdown(null)} />
                                                    )}
                                                    {isManual && (
                                                        <button className="ftl-gantt__remove-btn"
                                                            onClick={() => { const parts = cellKey.split('|'); removeManualEntry(yw, hvs.key, parts[1], parts[2]); }}
                                                            title="Entfernen">×</button>
                                                    )}
                                                    {istVal && (
                                                        <span className="ftl-gantt__ref ftl-gantt__ref--jira">{jiraId(row.istufe, hvs.penthouse, istVal)}</span>
                                                    )}
                                                </div>
                                            );
                                        };

                                        return (
                                            <div key={row.istufe}
                                                className={`ftl-gantt__cell-row${isDimmed ? ' ftl-gantt__cell-row--dimmed' : ''}${isSelected ? ' ftl-gantt__cell-row--selected' : ''}${!row.isAutoActive ? ' ftl-gantt__cell-row--manual' : ''}`}
                                                style={{ borderLeftColor: c.bar }}>
                                                {/* Auto offset */}
                                                {row.autoOffset && renderBadge(`${row.istufe}|${yw}|${hvs.key}`, row.autoOffset, false)}
                                                {/* Manual offsets (same row) */}
                                                {row.manualOffsets.map(mo => renderBadge(mo.key, mo.offset, true))}
                                            </div>
                                        );
                                    })}

                                    {/* Add button */}
                                    {isActive && (
                                        <div className="ftl-gantt__cell-add">
                                            <button className="ftl-gantt__add-btn"
                                                onClick={e => { e.stopPropagation(); setAddPickerOpen(addPickerOpen === `${yw}|${hvs.key}` ? null : `${yw}|${hvs.key}`); }}>
                                                +
                                            </button>
                                            {addPickerOpen === `${yw}|${hvs.key}` && (
                                                <AddEntryPicker
                                                    allIStufen={ISTUFE_MASTERS}
                                                    activeIstufeKeys={activeIstufeKeys}
                                                    istufeColors={istufeColors}
                                                    onAdd={(istufe, offset) => addManualEntry(yw, hvs.key, istufe, offset)}
                                                    onClose={() => setAddPickerOpen(null)}
                                                />
                                            )}
                                        </div>
                                    )}

                                    {rows.length === 0 && cdhHits.length === 0 && (
                                        <span className="ftl-gantt__cell-empty">—</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    );
                })}
            </div>

            {/* ── Legend ── */}
            <div className="ftl-legend">
                <div className="ftl-legend__section">
                    <span className="ftl-legend__heading">Freigabe-Level:</span>
                    {Object.entries(LEVEL_COLORS).map(([l, c]) => (
                        <div key={l} className="ftl-legend__item">
                            <span className="ftl-legend__swatch" style={{ backgroundColor: c.bg }} />
                            <span className="ftl-legend__label">{l}</span>
                        </div>
                    ))}
                </div>
                <div className="ftl-legend__section">
                    <span className="ftl-legend__heading">Softwarestände:</span>
                    {activeIStufen.map(m => {
                        const c = istufeColors.get(m.istufe)!;
                        return (
                            <div key={m.istufe} className="ftl-legend__item">
                                <span className="ftl-legend__swatch" style={{ backgroundColor: c.bar }} />
                                <span className="ftl-legend__label">{m.istufe}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

        </div>
    );
};

