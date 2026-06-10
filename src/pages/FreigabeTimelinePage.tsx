import React, { useMemo, useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { getActiveIStufen, getOffsetForWeek, weekToIndex, ISTUFE_MASTERS } from '../data/istufeData';
import type { IStufeMaster } from '../data/istufeData';
import { HVS_DATA } from '../data/speicherData';
import { FREIGABE_SCHEDULE_UNIQUE } from '../data/freigabeSchedule';
import { TICKETS_BY_YEARWEEK, PENTHOUSE_TICKETS } from '../data/plannedComponentApprovals';
import type { PenthouseTicket } from '../data/plannedComponentApprovals';
import { VERBUND_TICKETS_BY_YEARWEEK, VERBUND_TICKETS } from '../data/verbundfreigaben';
import type { VerbundTicket } from '../data/verbundfreigaben';
import { useEntanglements } from '../data/entanglements';
import { useWmm, WMM_STATUS_LABEL } from '../data/wmm';
import type { WmmRecord, WmmStatus, Sachnummer } from '../data/wmm';
import { useApprovalMoves } from '../data/approvalMoves';
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

/**
 * Status per SE_TERMIN — drives visual treatment + default filter.
 * Update this when a new ISTUFE comes online or one is cancelled.
 * (Once a Dataverse table is available, replace this with a fetched lookup.)
 */
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

/** SE_TERMINE that should be visible by default when the page first loads. */
const DEFAULT_VISIBLE_SE_TERMINE = ['26-07', '26-11'];

/**
 * Stable color per SE_TERMIN ("26-03", "26-07", "26-11"…), assigned
 * deterministically across all known I-Stufen. Every Softwarestand within the
 * same SE_TERMIN shares this color, regardless of Reifegrad or week window.
 */
const SE_TERMIN_COLORS: Map<string, typeof ISTUFE_PALETTE[0]> = (() => {
    const map = new Map<string, typeof ISTUFE_PALETTE[0]>();
    const sorted = [...new Set(ISTUFE_MASTERS.map(m => m.seTermin))].sort();
    sorted.forEach((se, i) => map.set(se, ISTUFE_PALETTE[i % ISTUFE_PALETTE.length]));
    return map;
})();

/** Resolve color for a SE_TERMIN ("yy-ww"). Returns undefined if unknown. */
function colorForSeTermin(se: string | null | undefined): typeof ISTUFE_PALETTE[0] | undefined {
    if (!se) return undefined;
    return SE_TERMIN_COLORS.get(se);
}

/** Build an istufe-keyed lookup that returns the SE_TERMIN color for each entry. */
function buildIstufeColorMap(masters: IStufeMaster[]) {
    const map = new Map<string, typeof ISTUFE_PALETTE[0]>();
    for (const m of masters) {
        const c = SE_TERMIN_COLORS.get(m.seTermin);
        if (c) map.set(m.istufe, c);
    }
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

/** Extract SE_TERMIN ("yy-ww") from any iLevel name shape:
 *  - Penthouse: "NA05-26-07-500" → "26-07"
 *  - Verbund:   "26-07-500"      → "26-07"
 *  Skips a non-numeric BRV prefix by finding the first pair of two-digit numeric parts.
 */
function extractSeTermin(name: string): string | null {
    const parts = name.split('-');
    for (let i = 0; i < parts.length - 1; i++) {
        if (/^\d{2}$/.test(parts[i]) && /^\d{2}$/.test(parts[i + 1])) {
            return `${parts[i]}-${parts[i + 1]}`;
        }
    }
    return null;
}

/** Strip a leading BRV prefix from an iLevel name, leaving the SE_TERMIN-Reife I-Stufe key:
 *  "NA05-26-07-510" → "26-07-510"; "G065-27-03-470" → "27-03-470"; "26-07-510" → "26-07-510".
 *  BRV is intentionally irrelevant here — same I-Stufe across BRVs collapses to one key.
 */
function stripBrv(name: string): string | null {
    const parts = name.split('-');
    for (let i = 0; i < parts.length - 1; i++) {
        if (/^\d{2}$/.test(parts[i]) && /^\d{2}$/.test(parts[i + 1])) {
            return parts.slice(i).join('-');
        }
    }
    return null;
}

/* ── Softwarestand ladder (Dataverse `cr9b2_softwarestand`):
   ATS-8 … ATS-1, ATS, ATS+1 … ATS+7, SAB, SAB+1 … SAB+8 — 25 ordered steps.
   The order is intrinsic to the labels (ATS family, then SAB = ATS+8), so we
   derive it rather than carry a sort column. Moving a planned approval by N
   weeks shifts its Softwarestand N steps along this ladder. */
function softwarestandLadderIndex(label: string | null | undefined): number | null {
    if (!label) return null;
    const m = label.trim().toUpperCase().replace(/\s*WEEK$/, '').match(/^(ATS|SAB)([+-]\d+)?$/);
    if (!m) return null;
    const base = m[1] === 'ATS' ? 8 : 16; // SAB sits at ATS+8
    return base + (m[2] ? parseInt(m[2], 10) : 0);
}
function softwarestandFromLadderIndex(i: number): string {
    const j = Math.max(0, Math.min(24, i));
    if (j <= 15) { const n = j - 8; return n === 0 ? 'ATS' : `ATS${n > 0 ? '+' : ''}${n}`; }
    const n = j - 16; return n === 0 ? 'SAB' : `SAB+${n}`;
}
/** Shift a Softwarestand label by `weekDelta` weeks along the ladder. Unknown labels pass through, empty stays empty. */
function shiftSoftwarestand(label: string | null | undefined, weekDelta: number): string | null {
    const i = softwarestandLadderIndex(label);
    if (i == null) return label ?? null;
    return softwarestandFromLadderIndex(i + weekDelta);
}
/** Whole-week delta between two "YYYY-WW" keys (handles year boundaries via the ISO Monday). */
function yearWeekDelta(fromYw: string, toYw: string): number {
    const a = fromYw.match(/^(\d{4})-(\d{1,2})$/);
    const b = toYw.match(/^(\d{4})-(\d{1,2})$/);
    if (!a || !b) return 0;
    const ma = getMonday(Number(a[2]), Number(a[1])).getTime();
    const mb = getMonday(Number(b[2]), Number(b[1])).getTime();
    return Math.round((mb - ma) / (7 * 24 * 60 * 60 * 1000));
}

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
                title={`${ticket.jiraKey} · ${ticket.name}${ticket.softwarestand ? ` · ${ticket.softwarestand}` : ''}`}
            >
                {ticket.name || '?'}
                {ticket.softwarestand && <span className="ftl-ticket-badge__sw">{ticket.softwarestand}</span>}
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
        <div className="ftl-drawer__row">
            <span className="ftl-drawer__label">Softwarestand</span>
            <span className="ftl-drawer__value">{ticket.softwarestand || '—'}</span>
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
                    {ticket.iLevelNames.map(n => {
                        const c = colorForSeTermin(extractSeTermin(n));
                        return (
                            <span key={n} className="ftl-drawer__tag"
                                style={c ? { backgroundColor: c.bar, color: c.text, borderColor: c.bar } : undefined}>
                                {n}
                            </span>
                        );
                    })}
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
                    {ticket.iLevelNames.map(n => {
                        const c = colorForSeTermin(extractSeTermin(n));
                        return (
                            <span key={n} className="ftl-drawer__tag"
                                style={c ? { backgroundColor: c.bar, color: c.text, borderColor: c.bar } : undefined}>
                                {n}
                            </span>
                        );
                    })}
                </div>
            </div>
        )}
    </>
);

/* ══════════════════════════════════════════════════════
   WMM detail drawer (simulated)
   ══════════════════════════════════════════════════════ */

const WmmDrawer: React.FC<{
    hvsKey: string;
    record: WmmRecord | undefined;
    onClose: () => void;
    onCheck: () => void;
    onApplyDelta: () => void;
    onDismissDelta: () => void;
    onToggleDeactivated: () => void;
    onAddSachnummer: (sn: Sachnummer) => void;
    onRemoveSachnummer: (nummer: string) => void;
}> = ({ hvsKey, record, onClose, onCheck, onApplyDelta, onDismissDelta, onToggleDeactivated, onAddSachnummer, onRemoveSachnummer }) => {
    const [newNummer, setNewNummer] = useState('');
    const [newType, setNewType] = useState('');
    const [newLabel, setNewLabel] = useState('');

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    if (!record) return null;
    const status = record.status;
    const lastChecked = record.lastCheckedAt
        ? new Date(record.lastCheckedAt).toLocaleString('de-DE', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
        })
        : 'noch nie';

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newNummer.trim()) return;
        onAddSachnummer({ nummer: newNummer.trim(), type: newType.trim() || '—', label: newLabel.trim() || newNummer.trim() });
        setNewNummer(''); setNewType(''); setNewLabel('');
    };

    return (
        <>
            <div className="ftl-drawer-backdrop" onClick={onClose} />
            <aside className="ftl-wmm-drawer" role="dialog" aria-label="WMM Details">
                <header className="ftl-wmm-drawer__header">
                    <div>
                        <div className="ftl-wmm-drawer__kicker">WMM · {hvsKey}</div>
                        <div className="ftl-wmm-drawer__title">{record.zsmbId}</div>
                    </div>
                    <button className="ftl-wmm-drawer__close" onClick={onClose} aria-label="Close">×</button>
                </header>

                <div className="ftl-wmm-drawer__body">
                    {/* Top row — link + status + last check */}
                    <div className="ftl-wmm-drawer__row">
                        <span className="ftl-wmm-drawer__label">ZSMB</span>
                        <a className="ftl-wmm-drawer__link" href={record.zsmbUrl} target="_blank" rel="noopener noreferrer">
                            {record.zsmbUrl} ↗
                        </a>
                    </div>
                    <div className="ftl-wmm-drawer__row">
                        <span className="ftl-wmm-drawer__label">Status</span>
                        <span className={`ftl-wmm-drawer__status ftl-wmm-drawer__status--${status}`}>
                            {WMM_STATUS_LABEL[status]}
                        </span>
                    </div>
                    <div className="ftl-wmm-drawer__row">
                        <span className="ftl-wmm-drawer__label">Letzte Prüfung</span>
                        <span className="ftl-wmm-drawer__value">{lastChecked}</span>
                    </div>

                    {/* Pending delta banner */}
                    {record.pendingDelta && (
                        <div className="ftl-wmm-drawer__delta">
                            <div className="ftl-wmm-drawer__delta-title">
                                Delta aus BATKAS / IHP
                            </div>
                            {record.pendingDelta.added.length > 0 && (
                                <div className="ftl-wmm-drawer__delta-section">
                                    <span className="ftl-wmm-drawer__delta-label ftl-wmm-drawer__delta-label--added">
                                        + Neu ({record.pendingDelta.added.length})
                                    </span>
                                    {record.pendingDelta.added.map(s => (
                                        <span key={s.nummer} className="ftl-wmm-drawer__delta-item">{s.nummer}</span>
                                    ))}
                                </div>
                            )}
                            {record.pendingDelta.removed.length > 0 && (
                                <div className="ftl-wmm-drawer__delta-section">
                                    <span className="ftl-wmm-drawer__delta-label ftl-wmm-drawer__delta-label--removed">
                                        − Entfernt ({record.pendingDelta.removed.length})
                                    </span>
                                    {record.pendingDelta.removed.map(s => (
                                        <span key={s.nummer} className="ftl-wmm-drawer__delta-item">{s.nummer}</span>
                                    ))}
                                </div>
                            )}
                            {record.pendingDelta.changed.length > 0 && (
                                <div className="ftl-wmm-drawer__delta-section">
                                    <span className="ftl-wmm-drawer__delta-label ftl-wmm-drawer__delta-label--changed">
                                        ~ Geändert ({record.pendingDelta.changed.length})
                                    </span>
                                    {record.pendingDelta.changed.map(c => (
                                        <span key={c.before.nummer} className="ftl-wmm-drawer__delta-item">
                                            {c.before.nummer}: „{c.before.label}" → „{c.after.label}"
                                        </span>
                                    ))}
                                </div>
                            )}
                            <div className="ftl-wmm-drawer__delta-actions">
                                <button className="btn btn--ghost btn--sm" onClick={onDismissDelta}>Verwerfen</button>
                                <button className="btn btn--primary btn--sm" onClick={onApplyDelta}>Übernehmen</button>
                            </div>
                        </div>
                    )}

                    {/* Sachnummern */}
                    <div className="ftl-wmm-drawer__section">
                        <div className="ftl-wmm-drawer__section-title">
                            Sachnummern <span className="ftl-wmm-drawer__count">({record.sachnummern.length})</span>
                        </div>
                        {record.sachnummern.length === 0 && (
                            <div className="ftl-wmm-drawer__empty">
                                Noch keine Sachnummern. Trage sie unten ein oder klicke „WMM Check".
                            </div>
                        )}
                        <div className="ftl-wmm-drawer__sn-list">
                            {record.sachnummern.map(s => (
                                <div key={s.nummer} className="ftl-wmm-drawer__sn-row">
                                    <span className="ftl-wmm-drawer__sn-nummer">{s.nummer}</span>
                                    <span className="ftl-wmm-drawer__sn-type">{s.type}</span>
                                    <span className="ftl-wmm-drawer__sn-label">{s.label}</span>
                                    <button className="ftl-wmm-drawer__sn-del"
                                        onClick={() => onRemoveSachnummer(s.nummer)}
                                        title="Sachnummer entfernen" aria-label="Sachnummer entfernen">
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                        <form className="ftl-wmm-drawer__sn-add" onSubmit={handleAdd}>
                            <input className="ftl-wmm-drawer__input" placeholder="Sachnummer (z. B. 83 21 7 …)"
                                value={newNummer} onChange={e => setNewNummer(e.target.value)} />
                            <input className="ftl-wmm-drawer__input ftl-wmm-drawer__input--sm" placeholder="Typ"
                                value={newType} onChange={e => setNewType(e.target.value)} />
                            <input className="ftl-wmm-drawer__input" placeholder="Beschreibung"
                                value={newLabel} onChange={e => setNewLabel(e.target.value)} />
                            <button className="btn btn--primary btn--sm" type="submit" disabled={!newNummer.trim()}>
                                + Hinzufügen
                            </button>
                        </form>
                    </div>
                </div>

                <footer className="ftl-wmm-drawer__footer">
                    <button className={`btn btn--ghost btn--sm`}
                        onClick={onToggleDeactivated}>
                        {status === 'deactivated' ? 'Reaktivieren' : 'Deaktivieren'}
                    </button>
                    <button className="btn btn--primary" onClick={onCheck}>
                        WMM Check
                    </button>
                </footer>
            </aside>
        </>
    );
};

/* ══════════════════════════════════════════════════════
   ISTUFE filter dropdown (multi-select by SE_TERMIN)
   ══════════════════════════════════════════════════════ */

interface SeTerminGroup { seTermin: string; swatchKey: string; count: number; }

const IstufeFilterDropdown: React.FC<{
    groups: SeTerminGroup[];
    hiddenSeTermine: Set<string>;
    istufeColors: Map<string, typeof ISTUFE_PALETTE[0]>;
    onToggle: (seTermin: string) => void;
    onShowAll: () => void;
    onHideAll: () => void;
    /** When true, render the trigger to match the FilterPanel's <select> elements */
    compact?: boolean;
}> = ({ groups, hiddenSeTermine, istufeColors, onToggle, onShowAll, onHideAll, compact }) => {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onMouse = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onMouse);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onMouse);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const visibleCount = groups.length - hiddenSeTermine.size;
    const compactSummary = hiddenSeTermine.size === 0
        ? 'Alle ISTUFEN'
        : visibleCount === 0
            ? 'Keine ISTUFE'
            : `${visibleCount} / ${groups.length} ISTUFEN`;
    const summary = compact
        ? compactSummary
        : hiddenSeTermine.size === 0
            ? `Alle ISTUFEN (${groups.length})`
            : visibleCount === 0
                ? 'Keine ISTUFE ausgewählt'
                : `${visibleCount} von ${groups.length} ISTUFEN`;

    return (
        <div className={`ftl-istufe-filter${compact ? ' ftl-istufe-filter--compact' : ''}`} ref={wrapRef}>
            <button type="button"
                className={`ftl-istufe-filter__trigger${open ? ' ftl-istufe-filter__trigger--open' : ''}${compact ? ' ftl-istufe-filter__trigger--compact' : ''}`}
                onClick={() => setOpen(o => !o)}
                aria-haspopup="listbox" aria-expanded={open}>
                {!compact && <span className="ftl-istufe-filter__trigger-label">ISTUFE</span>}
                <span className="ftl-istufe-filter__trigger-summary">{summary}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    className="ftl-istufe-filter__caret" aria-hidden="true">
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </button>

            {open && (
                <div className="ftl-istufe-filter__menu" role="listbox">
                    <div className="ftl-istufe-filter__menu-head">
                        <button type="button" className="ftl-istufe-filter__menu-action"
                            onClick={onShowAll} disabled={hiddenSeTermine.size === 0}>
                            Alle
                        </button>
                        <button type="button" className="ftl-istufe-filter__menu-action"
                            onClick={onHideAll} disabled={hiddenSeTermine.size === groups.length}>
                            Keine
                        </button>
                    </div>
                    <div className="ftl-istufe-filter__menu-list">
                        {groups.map(g => {
                            const c = istufeColors.get(g.swatchKey);
                            const checked = !hiddenSeTermine.has(g.seTermin);
                            const status = SE_TERMIN_STATUS[g.seTermin];
                            return (
                                <label key={g.seTermin}
                                    className={`ftl-istufe-filter__opt${checked ? ' ftl-istufe-filter__opt--on' : ''}`}>
                                    <input type="checkbox" checked={checked}
                                        onChange={() => onToggle(g.seTermin)} />
                                    <span className="ftl-istufe-filter__opt-swatch"
                                        style={{ backgroundColor: c?.bar ?? '#999' }} />
                                    <span className="ftl-istufe-filter__opt-name">{g.seTermin}</span>
                                    {status && (
                                        <span className={`ftl-istufe-filter__opt-status ftl-istufe-filter__opt-status--${status}`}>
                                            {SE_TERMIN_STATUS_LABEL[status]}
                                        </span>
                                    )}
                                    <span className="ftl-istufe-filter__opt-count">{g.count}</span>
                                </label>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

/* ══════════════════════════════════════════════════════
   Filter Panel
   ══════════════════════════════════════════════════════ */

interface Filters { wbsType: string; muster: string; penthouse: string; search: string; }
const EMPTY_FILTERS: Filters = { wbsType: '', muster: '', penthouse: '', search: '' };

interface IstufeFilterPanelProps {
    groups: SeTerminGroup[];
    hiddenSeTermine: Set<string>;
    istufeColors: Map<string, typeof ISTUFE_PALETTE[0]>;
    onToggle: (seTermin: string) => void;
    onShowAll: () => void;
    onHideAll: () => void;
}

const FilterPanel: React.FC<{
    filters: Filters; onChange: (f: Filters) => void;
    onReset?: () => void;
    hvsCount: number; istufeCount: number;
    istufeFilter?: IstufeFilterPanelProps;
}> = ({ filters, onChange, onReset, hvsCount, istufeCount, istufeFilter }) => {
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
                {istufeFilter && istufeFilter.groups.length > 0 && (
                    <IstufeFilterDropdown {...istufeFilter} compact />
                )}
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
   Move-target picker — pick which KW a planned approval moves to
   ══════════════════════════════════════════════════════ */

const MoveTargetPicker: React.FC<{
    /** Current ISO week of the item (e.g. "2026-20") */
    currentYearWeek: string;
    /** Current Softwarestand of the item (e.g. "ATS") — constrains how far it can shift, and previews the new value */
    currentOffset: string | null;
    onPick: (yearWeek: string) => void;
    onClose: () => void;
}> = ({ currentYearWeek, currentOffset, onPick, onClose }) => {
    const ref = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
        const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('mousedown', h);
        document.addEventListener('keydown', k);
        return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
    }, [onClose]);
    useEffect(() => {
        const el = listRef.current?.querySelector('[data-current="1"]') as HTMLElement | null;
        el?.scrollIntoView({ block: 'center' });
    }, []);
    // Only weeks the approval can actually be re-planned to: shifting must keep
    // the Softwarestand inside the ladder (ATS-8 … SAB+8). No Softwarestand → ±26 weeks.
    const baseIdx = softwarestandLadderIndex(currentOffset);
    const weeks = useMemo<KalenderwocheInfo[]>(() => {
        const m = currentYearWeek.match(/^(\d{4})-(\d{1,2})$/);
        if (!m) return [];
        const base = getMonday(Number(m[2]), Number(m[1]));
        const lo = baseIdx == null ? -26 : -baseIdx;
        const hi = baseIdx == null ? 26 : 24 - baseIdx;
        const out: KalenderwocheInfo[] = [];
        for (let d = lo; d <= hi; d++) {
            const dt = new Date(base);
            dt.setUTCDate(base.getUTCDate() + d * 7);
            out.push(getKWInfo(getISOWeek(dt), getISOWeekYear(dt)));
        }
        return out;
    }, [currentYearWeek, baseIdx]);
    const monthLabel = (d: Date) => d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    const shortDate = (d: Date) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`;
    return (
        <div ref={ref} className="ftl-move-picker" onClick={e => e.stopPropagation()}>
            <div className="ftl-move-picker__head">
                <div>
                    <span className="ftl-move-picker__title">Verschieben nach KW</span>
                    {currentOffset && <span className="ftl-move-picker__sub">Softwarestand jetzt {currentOffset}</span>}
                </div>
                <button type="button" className="ftl-move-picker__close" onClick={onClose} aria-label="Schließen">×</button>
            </div>
            <div ref={listRef} className="ftl-move-picker__list">
                {weeks.map((w, i) => {
                    const yw = kwToYearWeek(w);
                    const isCurrent = yw === currentYearWeek;
                    const showMonth = i === 0
                        || w.startDate.getMonth() !== weeks[i - 1].startDate.getMonth()
                        || w.startDate.getFullYear() !== weeks[i - 1].startDate.getFullYear();
                    const shiftedSw = currentOffset ? shiftSoftwarestand(currentOffset, yearWeekDelta(currentYearWeek, yw)) : null;
                    return (
                        <React.Fragment key={yw}>
                            {showMonth && <div className="ftl-move-picker__month">{monthLabel(w.startDate)}</div>}
                            <button type="button"
                                data-current={isCurrent ? '1' : undefined}
                                className={`ftl-move-picker__week${isCurrent ? ' ftl-move-picker__week--current' : ''}`}
                                disabled={isCurrent}
                                onClick={() => onPick(yw)}>
                                <span className="ftl-move-picker__kw">KW{String(w.week).padStart(2, '0')}</span>
                                <span className="ftl-move-picker__dates">{shortDate(w.startDate)}–{shortDate(w.endDate)}</span>
                                {isCurrent
                                    ? <span className="ftl-move-picker__now">aktuell</span>
                                    : shiftedSw && <span className="ftl-move-picker__sw" title={`Softwarestand wird ${shiftedSw}`}>{shiftedSw}</span>}
                            </button>
                        </React.Fragment>
                    );
                })}
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

    /* ── ISTUFE filter (by SE_TERMIN, e.g. "26-07") — hide-set, default empty (= show all).
       A single pill toggles every Softwarestand sharing that SE_TERMIN. */
    /* On first mount, hide every SE_TERMIN that is NOT in DEFAULT_VISIBLE_SE_TERMINE
       so the cockpit defaults to the cancelled + development streams (per requirements). */
    const [hiddenSeTermine, setHiddenSeTermine] = useState<Set<string>>(() => {
        const all = new Set(ISTUFE_MASTERS.map(m => m.seTermin));
        for (const s of DEFAULT_VISIBLE_SE_TERMINE) all.delete(s);
        return all;
    });
    const seTerminFor = useCallback((istufeKey: string): string => {
        const master = ISTUFE_MASTERS.find(m => m.istufe === istufeKey);
        if (master) return master.seTermin;
        // Fallback: split "yy-ww-reife" → "yy-ww"
        const idx = istufeKey.lastIndexOf('-');
        return idx >= 0 ? istufeKey.slice(0, idx) : istufeKey;
    }, []);
    const isIstufeVisible = useCallback(
        (istufeKey: string) => !hiddenSeTermine.has(seTerminFor(istufeKey)),
        [hiddenSeTermine, seTerminFor],
    );

    /** Strict ticket-visibility: hide if ANY of its iLevelNames belongs to a hidden SE_TERMIN.
     *  Tickets with no iLevelNames are always shown (no constraint to apply). */
    const isTicketVisible = useCallback(
        (iLevelNames: string[]): boolean => {
            if (!iLevelNames || iLevelNames.length === 0) return true;
            if (hiddenSeTermine.size === 0) return true;
            for (const name of iLevelNames) {
                const se = extractSeTermin(name);
                if (se && hiddenSeTermine.has(se)) return false;
            }
            return true;
        },
        [hiddenSeTermine],
    );

    const visibleSeTermine = useMemo(() => {
        // One entry per SE_TERMIN currently in scope, with a swatch color
        // (taken from the highest-Reife istufe in that group) and a member count.
        const groups = new Map<string, { swatchKey: string; count: number; topReife: number }>();
        for (const m of allVisibleIStufen) {
            const cur = groups.get(m.seTermin);
            if (!cur) {
                groups.set(m.seTermin, { swatchKey: m.istufe, count: 1, topReife: m.reife });
            } else {
                cur.count += 1;
                if (m.reife > cur.topReife) {
                    cur.topReife = m.reife;
                    cur.swatchKey = m.istufe;
                }
            }
        }
        return [...groups.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([seTermin, info]) => ({ seTermin, swatchKey: info.swatchKey, count: info.count }));
    }, [allVisibleIStufen]);

    const toggleSeTerminVisibility = useCallback((seTermin: string) => {
        setHiddenSeTermine(prev => {
            const next = new Set(prev);
            if (next.has(seTermin)) next.delete(seTermin); else next.add(seTermin);
            return next;
        });
    }, []);
    const showAllIstufen = useCallback(() => setHiddenSeTermine(new Set()), []);
    const hideAllIstufen = useCallback(
        () => setHiddenSeTermine(new Set(visibleSeTermine.map(g => g.seTermin))),
        [visibleSeTermine],
    );

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

    /* ── Entanglements (Verschränkungen): pin a Softwarestand to (Speicher, Muster) ── */
    const { findByIstufe } = useEntanglements();

    /* ── WMM (simulated) ── */
    const wmm = useWmm();
    const [wmmOpenKey, setWmmOpenKey] = useState<string | null>(null);

    /* ── Planned-approval moves (re-plan one I-Stufe of a ticket to another KW) ── */
    const { moves, addMove, removeMove } = useApprovalMoves();
    const [movePickerFor, setMovePickerFor] = useState<string | null>(null);
    const ticketByJiraKey = useMemo(() => {
        const map = new Map<string, PenthouseTicket>();
        for (const t of PENTHOUSE_TICKETS) if (!map.has(t.jiraKey)) map.set(t.jiraKey, t);
        return map;
    }, []);
    const movedOutKeys = useMemo(() => {
        // `${sourceJiraKey}|${movedIstufe}` for every active move — suppress at origin
        const set = new Set<string>();
        for (const m of moves) if (m.active) set.add(`${m.sourceJiraKey}|${m.movedIstufe}`);
        return set;
    }, [moves]);
    const movesByTargetWeek = useMemo(() => {
        const map = new Map<string, typeof moves>();
        for (const m of moves) {
            if (!m.active) continue;
            const list = map.get(m.toYearWeek);
            if (list) list.push(m); else map.set(m.toYearWeek, [m]);
        }
        return map;
    }, [moves]);
    const currentEntanglement = useMemo(
        () => (effectiveSelected ? findByIstufe(effectiveSelected) : undefined),
        [effectiveSelected, findByIstufe],
    );

    /** HVS rows visible inside the Bulk-Freigabe panel.
     *  When the selected Softwarestand is entangled, we hide all rows that
     *  don't match the entangled Speicher — the user cannot release that
     *  ISTUFE for any other Speicher. */
    const bulkVisibleHvs = useMemo(() => {
        if (!currentEntanglement) return filteredHvs;
        return filteredHvs.filter(h => h.hvs === currentEntanglement.speicher);
    }, [filteredHvs, currentEntanglement]);

    /* When the entanglement changes, drop any selected HVS that's no longer eligible. */
    useEffect(() => {
        if (!currentEntanglement) return;
        const allowed = new Set(bulkVisibleHvs.map(h => h.key));
        setBulkHvsSelection(prev => {
            let changed = false;
            const next = new Set<string>();
            for (const k of prev) {
                if (allowed.has(k)) next.add(k);
                else changed = true;
            }
            return changed ? next : prev;
        });
    }, [currentEntanglement, bulkVisibleHvs]);

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

    /** Get the rank for display in the dropdown */
    function getRank(weekKey: string, istufe: string, fallbackIdx: number): number {
        return istufeRank[`${weekKey}|${istufe}`] ?? (fallbackIdx + 1);
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

    /* ── Ist-Stand state ──
       Records the actually-reached approval level per planned-approval item.
       Keys: ticket-driven items use "${ticketId}|${istufe}|${hvsKey}";
             manual items use "manual|${istufe}|${offset}|${weekKey}|${hvsKey}". */
    const [istStand, setIstStand] = useState<Record<string, string>>({});
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);

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
        setBulkHvsSelection(new Set(bulkVisibleHvs.filter(h => hvsActive[h.key] ?? true).map(h => h.key)));
    }, [bulkVisibleHvs, hvsActive]);

    const clearBulkHvs = useCallback(() => {
        setBulkHvsSelection(new Set());
    }, []);

    /* ── Penthouse selector for the bulk panel — group quick-toggle for HVS ── */
    const [bulkPenthouses, setBulkPenthouses] = useState<Set<string>>(new Set());

    /** Penthouses available to pick — derived from the HVS rows visible in the bulk panel. */
    const bulkPenthouseOptions = useMemo(
        () => [...new Set(bulkVisibleHvs.map(h => h.penthouse).filter(Boolean))].sort(),
        [bulkVisibleHvs],
    );

    /* Drop selected penthouses that are no longer present in the bulk visible set. */
    useEffect(() => {
        const allowed = new Set(bulkPenthouseOptions);
        setBulkPenthouses(prev => {
            let changed = false;
            const next = new Set<string>();
            for (const p of prev) {
                if (allowed.has(p)) next.add(p);
                else changed = true;
            }
            return changed ? next : prev;
        });
    }, [bulkPenthouseOptions]);

    /** Toggle a penthouse: also auto-select / auto-deselect the HVS rows in it. */
    const toggleBulkPenthouse = useCallback((penthouse: string) => {
        const hvsKeysInPenthouse = bulkVisibleHvs
            .filter(h => h.penthouse === penthouse && (hvsActive[h.key] ?? true))
            .map(h => h.key);

        setBulkPenthouses(prev => {
            const next = new Set(prev);
            const wasOn = next.has(penthouse);
            if (wasOn) next.delete(penthouse);
            else next.add(penthouse);
            return next;
        });
        setBulkHvsSelection(prev => {
            const next = new Set(prev);
            const turningOn = !bulkPenthouses.has(penthouse);
            for (const k of hvsKeysInPenthouse) {
                if (turningOn) next.add(k);
                else next.delete(k);
            }
            return next;
        });
    }, [bulkVisibleHvs, bulkPenthouses, hvsActive]);

    const selectAllBulkPenthouses = useCallback(() => {
        setBulkPenthouses(new Set(bulkPenthouseOptions));
        setBulkHvsSelection(new Set(
            bulkVisibleHvs.filter(h => hvsActive[h.key] ?? true).map(h => h.key),
        ));
    }, [bulkPenthouseOptions, bulkVisibleHvs, hvsActive]);

    const clearBulkPenthouses = useCallback(() => {
        const inAnyPenthouse = new Set(
            bulkVisibleHvs
                .filter(h => h.penthouse && bulkPenthouses.has(h.penthouse))
                .map(h => h.key),
        );
        setBulkPenthouses(new Set());
        setBulkHvsSelection(prev => {
            const next = new Set(prev);
            for (const k of inAnyPenthouse) next.delete(k);
            return next;
        });
    }, [bulkPenthouses, bulkVisibleHvs]);

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

    /**
     * Verschränkungs-Kaskade: when the selected Softwarestand IS entangled,
     * the bulk write also applies to all sister Softwarestände that share its
     * SE_TERMIN and have a Reifegrad ≥ the selected one. Excludes the selected
     * itself (it's written directly). Returned sorted by reife ascending.
     */
    const cascadeIstufen = useMemo<IStufeMaster[]>(() => {
        if (!currentEntanglement || !effectiveSelected) return [];
        const selectedMaster = ISTUFE_MASTERS.find(m => m.istufe === effectiveSelected);
        if (!selectedMaster) return [];
        return ISTUFE_MASTERS
            .filter(m =>
                m.seTermin === selectedMaster.seTermin
                && m.reife >= selectedMaster.reife
                && m.istufe !== effectiveSelected,
            )
            .sort((a, b) => a.reife - b.reife);
    }, [currentEntanglement, effectiveSelected]);

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

                // Cascade sisters that are active in this week (only when entangled)
                const cascadeForWeek = cascadeIstufen
                    .filter(m => weekToIndex(m.atsWeek) <= wkIdx && wkIdx <= weekToIndex(m.sabWeek))
                    .map(m => m.istufe);

                // Dedupe targets (selected + group members + cascade sisters)
                const targets = new Set<string>([effectiveSelected, ...groupMembers, ...cascadeForWeek]);

                for (const hvsKey of bulkHvsSelection) {
                    for (const t of targets) {
                        next[`${t}|${weekKey}|${hvsKey}`] = bulkLevel;
                    }
                }
            }
            return next;
        });
    }, [effectiveSelected, bulkLevel, bulkHvsSelection, affectedWeeks, allVisibleIStufen, istufeRank, cascadeIstufen]);

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

                    {/* Step 2: Penthouse selection (group selector for HVS) */}
                    <section className="ftl-bulk__section">
                        <div className="ftl-bulk__section-title">
                            <span className="ftl-bulk__step">2</span>
                            Penthouse auswählen
                            <span className="ftl-bulk__count-pill">{bulkPenthouses.size}</span>
                            <div className="ftl-bulk__hvs-actions">
                                <button className="btn btn--ghost btn--sm" onClick={selectAllBulkPenthouses}>Alle</button>
                                <button className="btn btn--ghost btn--sm" onClick={clearBulkPenthouses}>Keine</button>
                            </div>
                        </div>
                        <div className="ftl-bulk__hvs-list">
                            {bulkPenthouseOptions.length === 0 && (
                                <span className="ftl-bulk__no-weeks">Keine Penthouses im aktuellen Filter</span>
                            )}
                            {bulkPenthouseOptions.map(p => {
                                const isChecked = bulkPenthouses.has(p);
                                return (
                                    <label key={p}
                                        className={`ftl-bulk__hvs-item${isChecked ? ' ftl-bulk__hvs-item--checked' : ''}`}>
                                        <input type="checkbox" checked={isChecked}
                                            onChange={() => toggleBulkPenthouse(p)} />
                                        <span className="ftl-bulk__hvs-name">{p}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </section>

                    {/* Step 3: HVS selection */}
                    <section className="ftl-bulk__section">
                        <div className="ftl-bulk__section-title">
                            <span className="ftl-bulk__step">3</span>
                            HVS auswählen
                            <span className="ftl-bulk__count-pill">{bulkCount}</span>
                            <div className="ftl-bulk__hvs-actions">
                                <button className="btn btn--ghost btn--sm" onClick={selectAllBulkHvs}>Alle aktiven</button>
                                <button className="btn btn--ghost btn--sm" onClick={clearBulkHvs}>Keine</button>
                            </div>
                        </div>
                        {currentEntanglement && (
                            <div className="ftl-bulk__entanglement">
                                <span className="ftl-bulk__entanglement-icon" aria-hidden="true">🔗</span>
                                <span>
                                    <strong>{currentEntanglement.istufe}</strong> ist an Speicher
                                    {' '}<strong>{currentEntanglement.speicher}</strong> verschränkt —
                                    Freigaben gelten ausschließlich für diesen Speicher.
                                    {cascadeIstufen.length > 0 && (
                                        <>
                                            {' '}Kaskadiert auf{' '}
                                            {cascadeIstufen.map((m, i) => (
                                                <React.Fragment key={m.istufe}>
                                                    {i > 0 && ', '}<strong>{m.istufe}</strong>
                                                </React.Fragment>
                                            ))}
                                            {' '}(Reifegrad ≥ {currentEntanglement.reife}).
                                        </>
                                    )}
                                </span>
                            </div>
                        )}
                        <div className="ftl-bulk__hvs-list">
                            {bulkVisibleHvs.length === 0 && currentEntanglement && (
                                <span className="ftl-bulk__no-weeks">Kein passender HVS-Eintrag im aktuellen Filter</span>
                            )}
                            {bulkVisibleHvs.map(h => {
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
                            {currentEntanglement && cascadeIstufen.length > 0 && (
                                <div className="ftl-bulk__confirm-row">
                                    <span className="ftl-bulk__confirm-label">
                                        Kaskade ({cascadeIstufen.length}):
                                    </span>
                                    <div className="ftl-bulk__confirm-weeks">
                                        {cascadeIstufen.map(m => (
                                            <span key={m.istufe} className="ftl-bulk__week-pill">{m.istufe}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
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

            {/* ── Filters (incl. ISTUFE multi-select) ── */}
            <FilterPanel filters={filters} onChange={setFilters}
                onReset={clearBulkHvs}
                hvsCount={filteredHvs.length} istufeCount={activeIStufen.length}
                istufeFilter={{
                    groups: visibleSeTermine,
                    hiddenSeTermine,
                    istufeColors,
                    onToggle: toggleSeTerminVisibility,
                    onShowAll: showAllIstufen,
                    onHideAll: hideAllIstufen,
                }}
            />

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
                        const visibleActive = active.filter(m => isIstufeVisible(m.istufe));
                        return (
                            <div key={w.key} className={`ftl-gantt__cell ftl-gantt__cell--istufe${isNow ? ' ftl-gantt__cell--current' : ''}`}>
                                {visibleActive.map(m => {
                                    const c = istufeColors.get(m.istufe)!;
                                    const isSelectedIstufe = effectiveSelected === m.istufe;
                                    const status = SE_TERMIN_STATUS[m.seTermin];
                                    return (
                                        <div key={m.istufe}
                                            className={`ftl-gantt__istufe-chip${isSelectedIstufe ? ' ftl-gantt__istufe-chip--selected' : ''}${status ? ` ftl-gantt__istufe-chip--${status}` : ''}`}
                                            style={{ backgroundColor: c.bar }}
                                            title={status ? `${m.istufe} · ${SE_TERMIN_STATUS_LABEL[status]}` : m.istufe}
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
                        <span className="ftl-gantt__ticket-count" title="Anzahl Tickets im sichtbaren Zeitfenster (nach ISTUFE-Filter)">
                            {weekKeys.reduce(
                                (s, k) => s + (TICKETS_BY_YEARWEEK.get(k)?.filter(t => isTicketVisible(t.iLevelNames)).length ?? 0),
                                0,
                            )}
                        </span>
                    </div>
                    {weeks.map(w => {
                        const yw = kwToYearWeek(w);
                        const tickets = (TICKETS_BY_YEARWEEK.get(yw) ?? []).filter(t => isTicketVisible(t.iLevelNames));
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
                        <span className="ftl-gantt__ticket-count" title="Anzahl Tickets im sichtbaren Zeitfenster (nach ISTUFE-Filter)">
                            {weekKeys.reduce(
                                (s, k) => s + (VERBUND_TICKETS_BY_YEARWEEK.get(k)?.filter(t => isTicketVisible(t.iLevelNames)).length ?? 0),
                                0,
                            )}
                        </span>
                    </div>
                    {weeks.map(w => {
                        const yw = kwToYearWeek(w);
                        const tickets = (VERBUND_TICKETS_BY_YEARWEEK.get(yw) ?? []).filter(t => isTicketVisible(t.iLevelNames));
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
                                {(() => {
                                    const w = wmm.records[hvs.key];
                                    const status: WmmStatus = w?.status ?? 'missing-zsmb';
                                    return (
                                        <button type="button"
                                            className={`ftl-gantt__link ftl-gantt__link--wmm ftl-gantt__link--status-${status}`}
                                            onClick={() => setWmmOpenKey(hvs.key)}
                                            title={`WMM: ${WMM_STATUS_LABEL[status]}`}>
                                            <span className="ftl-gantt__link-dot" aria-hidden="true" />
                                            WMM
                                        </button>
                                    );
                                })()}
                                <span className="ftl-gantt__link ftl-gantt__link--mia">MIA</span>
                            </div>
                        </div>

                        {/* KW cells */}
                        {weeks.map(w => {
                            const yw = kwToYearWeek(w);
                            const isNow = w.week === currentWeek && w.year === currentYear;
                            const cdhHits = cdhByWeekAndKey.get(`${yw}|${hvs.key}`) ?? [];

                            // Manual entries for this cell
                            const cellManual = getManualEntriesForCell(yw, hvs.key);

                            // Planned approvals for this cell. Source = Jira-synced Penthouse
                            // tickets due this week (one row per BRV-stripped I-Stufe), MINUS
                            // I-Stufen re-planned to another KW, PLUS I-Stufen re-planned into this one.
                            type CellItem = {
                                cellKey: string;
                                istufe: string;
                                offset: string | null;
                                level: string;
                                kind: 'ticket' | 'moved' | 'manual';
                                jiraKey: string | null;
                                movedFrom: string | null;
                                originOffset: string | null;
                                moveId: string | null;
                            };
                            const items: CellItem[] = [];
                            for (const t of (TICKETS_BY_YEARWEEK.get(yw) ?? [])) {
                                if (!isTicketVisible(t.iLevelNames)) continue;
                                const seen = new Set<string>();
                                for (const name of t.iLevelNames) {
                                    const ik = stripBrv(name);
                                    if (!ik || seen.has(ik)) continue;
                                    seen.add(ik);
                                    if (!isIstufeVisible(ik)) continue;
                                    if (movedOutKeys.has(`${t.jiraKey}|${ik}`)) continue;
                                    items.push({
                                        cellKey: `${t.id}|${ik}|${hvs.key}`,
                                        istufe: ik, offset: t.softwarestand || null, level: t.name,
                                        kind: 'ticket', jiraKey: t.jiraKey, movedFrom: null, originOffset: null, moveId: null,
                                    });
                                }
                            }
                            for (const mv of (movesByTargetWeek.get(yw) ?? [])) {
                                const src = ticketByJiraKey.get(mv.sourceJiraKey);
                                if (!src) continue;
                                if (!isTicketVisible(src.iLevelNames)) continue;
                                if (!isIstufeVisible(mv.movedIstufe)) continue;
                                // Shift the Softwarestand by however many weeks the approval moved.
                                const shifted = shiftSoftwarestand(src.softwarestand, yearWeekDelta(src.yearWeek, mv.toYearWeek));
                                items.push({
                                    cellKey: `move|${mv.id}|${hvs.key}`,
                                    istufe: mv.movedIstufe, offset: shifted, level: src.name,
                                    kind: 'moved', jiraKey: src.jiraKey, movedFrom: src.yearWeek,
                                    originOffset: src.softwarestand || null, moveId: mv.id,
                                });
                            }
                            for (const me of cellManual) {
                                if (!isIstufeVisible(me.istufe)) continue;
                                items.push({
                                    cellKey: `manual|${me.istufe}|${me.offset}|${yw}|${hvs.key}`,
                                    istufe: me.istufe, offset: me.offset || null, level: '',
                                    kind: 'manual', jiraKey: null, movedFrom: null, originOffset: null, moveId: null,
                                });
                            }

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

                                    {/* Planned-approval rows — Penthouse tickets, ± re-planned moves */}
                                    {items.map(item => {
                                        const c = colorForSeTermin(seTerminFor(item.istufe)) ?? ISTUFE_PALETTE[0];
                                        const canEdit = isActive;
                                        const istVal = istStand[item.cellKey] ?? '';
                                        const movedKw = item.movedFrom ? (item.movedFrom.split('-')[1] ?? item.movedFrom) : '';
                                        const movable = canEdit && !!item.jiraKey && (item.kind === 'ticket' || item.kind === 'moved');
                                        const chipTitle = `${item.offset ? `${item.istufe} · ${item.offset}` : item.istufe}${movable ? ' — klicken zum Verschieben' : ''}`;
                                        const chipInner = (
                                            <>
                                                {item.istufe}
                                                {item.offset && <span className="ftl-gantt__cell-offset-reife">{item.offset}</span>}
                                            </>
                                        );
                                        return (
                                            <div key={item.cellKey}
                                                className={`ftl-gantt__cell-row${item.kind === 'manual' ? ' ftl-gantt__cell-row--manual' : ''}${item.kind === 'moved' ? ' ftl-gantt__cell-row--moved' : ''}`}
                                                style={{ borderLeftColor: c.bar }}>
                                                {movable ? (
                                                    <button type="button"
                                                        className={`ftl-gantt__cell-offset ftl-gantt__cell-offset--btn${movePickerFor === item.cellKey ? ' ftl-gantt__cell-offset--open' : ''}`}
                                                        style={{ backgroundColor: c.bar, color: c.text }} title={chipTitle}
                                                        onClick={e => { e.stopPropagation(); setMovePickerFor(movePickerFor === item.cellKey ? null : item.cellKey); }}>
                                                        {chipInner}
                                                    </button>
                                                ) : (
                                                    <span className="ftl-gantt__cell-offset" style={{ backgroundColor: c.bar, color: c.text }} title={chipTitle}>
                                                        {chipInner}
                                                    </span>
                                                )}
                                                {item.level && (
                                                    <span className="ftl-gantt__badge ftl-gantt__badge--sm"
                                                        style={{ backgroundColor: ticketColor(item.level), color: '#fff' }}
                                                        title={`Geplante Freigabe (Soll)${item.jiraKey ? ` · ${item.jiraKey}` : ''}`}>
                                                        {item.level}
                                                    </span>
                                                )}
                                                {item.kind === 'moved' && movedKw && (
                                                    <span className="ftl-gantt__cell-moved-from"
                                                        title={`Verschoben aus ${item.movedFrom}${item.originOffset ? ` (war ${item.originOffset})` : ''}`}>↪ KW{movedKw}</span>
                                                )}
                                                {canEdit ? (
                                                    <span
                                                        className={`ftl-gantt__badge ftl-gantt__badge--clickable${istVal ? '' : ' ftl-gantt__badge--empty'}`}
                                                        style={istVal ? { backgroundColor: lvlColor(istVal).bg, color: lvlColor(istVal).text } : undefined}
                                                        onClick={e => { e.stopPropagation(); setOpenDropdown(openDropdown === item.cellKey ? null : item.cellKey); }}>
                                                        {istVal || '—'}
                                                        <span className="ftl-gantt__badge-caret">▾</span>
                                                    </span>
                                                ) : (
                                                    <span className={`ftl-gantt__badge${istVal ? '' : ' ftl-gantt__badge--empty ftl-gantt__badge--readonly'}`}
                                                        style={istVal ? { backgroundColor: lvlColor(istVal).bg, color: lvlColor(istVal).text } : undefined}>
                                                        {istVal || '—'}
                                                    </span>
                                                )}
                                                {openDropdown === item.cellKey && (
                                                    <IstDropdown current={istVal}
                                                        onSelect={v => { setIstStand(prev => ({ ...prev, [item.cellKey]: v })); setOpenDropdown(null); }}
                                                        onClose={() => setOpenDropdown(null)} />
                                                )}
                                                {/* Undo a move */}
                                                {canEdit && item.kind === 'moved' && item.moveId && (
                                                    <button type="button" className="ftl-gantt__remove-btn" title="Verschiebung rückgängig"
                                                        onClick={() => removeMove(item.moveId!)}>↩</button>
                                                )}
                                                {/* Remove a manual entry */}
                                                {item.kind === 'manual' && (
                                                    <button className="ftl-gantt__remove-btn"
                                                        onClick={() => { const parts = item.cellKey.split('|'); removeManualEntry(yw, hvs.key, parts[1], parts[2]); }}
                                                        title="Entfernen">×</button>
                                                )}
                                                {/* Move-target picker — anchored to this row, opened by the I-Stufe chip */}
                                                {movable && movePickerFor === item.cellKey && (
                                                    <MoveTargetPicker
                                                        currentYearWeek={yw}
                                                        currentOffset={item.offset}
                                                        onPick={ny => { addMove(item.jiraKey!, item.istufe, ny); setMovePickerFor(null); }}
                                                        onClose={() => setMovePickerFor(null)} />
                                                )}
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

                                    {items.length === 0 && cdhHits.length === 0 && (
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
                    {activeIStufen.filter(m => isIstufeVisible(m.istufe)).map(m => {
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

            {/* WMM detail drawer */}
            {wmmOpenKey && (
                <WmmDrawer
                    hvsKey={wmmOpenKey}
                    record={wmm.records[wmmOpenKey]}
                    onClose={() => setWmmOpenKey(null)}
                    onCheck={() => wmm.runWmmCheck(wmmOpenKey)}
                    onApplyDelta={() => wmm.applyDelta(wmmOpenKey)}
                    onDismissDelta={() => wmm.dismissDelta(wmmOpenKey)}
                    onToggleDeactivated={() => wmm.toggleDeactivated(wmmOpenKey)}
                    onAddSachnummer={(sn) => wmm.addSachnummer(wmmOpenKey, sn)}
                    onRemoveSachnummer={(nummer) => wmm.removeSachnummer(wmmOpenKey, nummer)}
                />
            )}

        </div>
    );
};

