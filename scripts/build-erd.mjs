// Generate a technical ER diagram (crow's-foot) of the Freigabencockpit data
// model as a standalone SVG — no dependencies. Output: docs/erd.svg
import { writeFileSync } from 'node:fs';

const out = process.argv[2] || 'docs/erd.svg';
const W = 244, HEAD = 26, ROW = 19, PAD = 6;

// kind: real | local | child  — P3 brand: navy / indigo / olive-lime, all with neon-lime accent
const COLORS = {
    real:  { head: '#00002d', accent: '#dbff55' },  // deep indigo = Dataverse-Tabelle
    local: { head: '#76a700', accent: '#dbff55' },  // brand olive = app-local (geplant für Dataverse)
    child: { head: '#303090', accent: '#dbff55' },  // indigo = exploded/child
};

// id: [x, y, kind, title, [ [field, flag] ... ] ]   flag: 'pk' | 'fk' | ''
const E = {
    BRV:   [40, 40, 'real', 'cr9b2_brv', [['_id', 'pk'], ['cr9b2_name  «BRV»', '']]],
    WBS:   [40, 165, 'real', 'cr9b2_wbs_type_mapping', [['_id', 'pk'], ['cr9b2_wbs_type', ''], ['cr9b2_muster', ''], ['cr9b2_name', '']]],
    HVS:   [40, 360, 'real', 'cr9b2_hvs', [['key  «PK»', 'pk'], ['pnummer', ''], ['wbsType', 'fk'], ['penthouse', ''], ['muster', ''], ['bauphase', '']]],
    ILEVEL:[40, 640, 'real', 'cr9b2_ilevels_1  (ilevel)', [['ilevel  «SE_TERMIN-REIFE»', 'pk'], ['number', ''], ['ats', ''], ['sab', '']]],
    IWEEK: [330, 640, 'child', 'ilevels_1  (Offset-Zeile)', [['_id', 'pk'], ['ilevel', 'fk'], ['offset', ''], ['week', '']]],

    PTH:   [540, 40, 'real', 'cr9b2_planned_component_approvals', [['_id', 'pk'], ['cr9b2_jirakey', ''], ['cr9b2_ilevelnames  «M:N»', 'fk'], ['cr9b2_brvs  «M:N»', 'fk'], ['cr9b2_parentbranches', ''], ['cr9b2_softwarestand', ''], ['cr9b2_yearweek', '']]],
    VERB:  [540, 350, 'real', 'cr9b2_verbundfreigaben', [['_id', 'pk'], ['cr9b2_collapseid', ''], ['cr9b2_ilevelnames  «M:N»', 'fk'], ['cr9b2_startdate', ''], ['cr9b2_yearweek', '']]],
    CDH:   [540, 590, 'real', 'cr9b2_cdh_ip3', [['_id', 'pk'], ['cr9b2_sollfreigabe', ''], ['cr9b2_wbs_type3clean', 'fk'], ['cr9b2_startweek', '']]],
    IP3:   [540, 790, 'real', 'cr9b2_ip3_freigaben', [['_id', 'pk'], ['sollFreigabe', ''], ['wbsType', 'fk'], ['penthouse', ''], ['startWeek', '']]],

    WMM:   [1010, 40, 'local', 'WMM_RECORD', [['hvsKey', 'pk'], ['zsmbId', ''], ['status', ''], ['lastCheckedAt', '']]],
    SACH:  [1010, 215, 'child', 'SACHNUMMER', [['hvsKey', 'fk'], ['nummer', ''], ['type', ''], ['label', '']]],
    ENT:   [1010, 390, 'local', 'ENTANGLEMENT  (Verschränkung)', [['id', 'pk'], ['istufe', 'fk'], ['speicher', 'fk'], ['reife', '']]],
    MOVE:  [1010, 565, 'local', 'APPROVAL_MOVE  (Verschiebung)', [['id', 'pk'], ['sourceJiraKey', 'fk'], ['movedIstufe', 'fk'], ['toYearWeek', '']]],
    IST:   [1010, 760, 'local', 'IST_STAND  (Freigabe-Ist · Fakt)', [['istufe|week|hvsKey', 'pk'], ['istufe', 'fk'], ['hvsKey', 'fk'], ['level', '']]],
};

const boxH = (id) => HEAD + E[id][4].length * ROW + PAD;
const center = (id) => { const [x, y] = E[id]; return { x: x + W / 2, y: y + boxH(id) / 2 }; };

// rect-boundary point from a box center toward a target point
function anchor(id, toward) {
    const [x, y] = E[id]; const h = boxH(id);
    const cx = x + W / 2, cy = y + h / 2;
    let dx = toward.x - cx, dy = toward.y - cy;
    if (dx === 0 && dy === 0) return { x: cx, y: cy };
    const sx = dx !== 0 ? (W / 2) / Math.abs(dx) : Infinity;
    const sy = dy !== 0 ? (h / 2) / Math.abs(dy) : Infinity;
    const s = Math.min(sx, sy);
    return { x: cx + dx * s, y: cy + dy * s };
}

// [from(many), to(one), cardinality, dashed, manyBoth]
const REL = [
    ['HVS', 'WBS', 'N:1', false, false],
    ['HVS', 'BRV', 'N:1', true, false],
    ['IWEEK', 'ILEVEL', 'N:1', false, false],
    ['PTH', 'ILEVEL', 'M:N', true, true],
    ['PTH', 'BRV', 'M:N', true, true],
    ['VERB', 'ILEVEL', 'M:N', true, true],
    ['CDH', 'WBS', 'N:1', false, false],
    ['IP3', 'WBS', 'N:1', false, false],
    ['WMM', 'HVS', '1:1', false, false],
    ['SACH', 'WMM', 'N:1', false, false],
    ['ENT', 'ILEVEL', 'N:1', false, false],
    ['ENT', 'HVS', 'N:1', false, false],
    ['MOVE', 'PTH', 'N:1', false, false],
    ['MOVE', 'ILEVEL', 'N:1', false, false],
    ['IST', 'HVS', 'N:1', false, false],
    ['IST', 'ILEVEL', 'N:1', false, false],
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const norm = (p, q) => { const dx = q.x - p.x, dy = q.y - p.y; const L = Math.hypot(dx, dy) || 1; return { x: dx / L, y: dy / L }; };

// crow's-foot (many): fan touches the entity at E, converges at apex E+u*len
function crowFoot(E0, u) {
    const perp = { x: -u.y, y: u.x };
    const apex = { x: E0.x + u.x * 17, y: E0.y + u.y * 17 };
    const a = { x: E0.x + perp.x * 7, y: E0.y + perp.y * 7 };
    const b = { x: E0.x - perp.x * 7, y: E0.y - perp.y * 7 };
    return `<path d="M${apex.x.toFixed(1)},${apex.y.toFixed(1)} L${a.x.toFixed(1)},${a.y.toFixed(1)} M${apex.x.toFixed(1)},${apex.y.toFixed(1)} L${b.x.toFixed(1)},${b.y.toFixed(1)} M${apex.x.toFixed(1)},${apex.y.toFixed(1)} L${E0.x.toFixed(1)},${E0.y.toFixed(1)}" class="foot"/>`;
}
// "one": perpendicular tick at distance 12 out from the box
function oneTick(E0, u) {
    const perp = { x: -u.y, y: u.x };
    const q = { x: E0.x + u.x * 12, y: E0.y + u.y * 12 };
    const a = { x: q.x + perp.x * 7, y: q.y + perp.y * 7 };
    const b = { x: q.x - perp.x * 7, y: q.y - perp.y * 7 };
    return `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" class="foot"/>`;
}

const CW = 1300, CH = 1010;
const parts = [];

// edges first (under boxes)
for (const [from, to, card, dashed, manyBoth] of REL) {
    const aPt = anchor(from, center(to));
    const bPt = anchor(to, center(from));
    const uA = norm(aPt, bPt);   // outward at from
    const uB = norm(bPt, aPt);   // outward at to
    parts.push(`<line x1="${aPt.x.toFixed(1)}" y1="${aPt.y.toFixed(1)}" x2="${bPt.x.toFixed(1)}" y2="${bPt.y.toFixed(1)}" class="edge${dashed ? ' edge--dash' : ''}"/>`);
    parts.push(crowFoot(aPt, uA));
    parts.push(manyBoth ? crowFoot(bPt, uB) : oneTick(bPt, uB));
    const mx = (aPt.x + bPt.x) / 2, my = (aPt.y + bPt.y) / 2;
    parts.push(`<rect x="${(mx - 13).toFixed(1)}" y="${(my - 8).toFixed(1)}" width="26" height="13" rx="2" class="cardbg"/>`);
    parts.push(`<text x="${mx.toFixed(1)}" y="${(my + 2).toFixed(1)}" class="card">${card}</text>`);
}

// boxes on top
for (const id of Object.keys(E)) {
    const [x, y, kind, title, fields] = E[id];
    const h = boxH(id);
    const c = COLORS[kind];
    parts.push(`<g>`);
    parts.push(`<rect x="${x}" y="${y}" width="${W}" height="${h}" rx="7" class="box"/>`);
    parts.push(`<path d="M${x + 7},${y} h${W - 14} a7,7 0 0 1 7,7 v${HEAD - 7} h${-W} v${HEAD - 7} a7,7 0 0 1 7,${-(HEAD - 7)} z" fill="${c.head}"/>`);
    parts.push(`<rect x="${x}" y="${y + HEAD - 3}" width="${W}" height="3" fill="${c.accent}"/>`);
    parts.push(`<text x="${x + 11}" y="${y + 17}" class="ttl">${esc(title)}</text>`);
    fields.forEach((f, i) => {
        const fy = y + HEAD + i * ROW + 13;
        const cls = f[1] === 'pk' ? 'fpk' : f[1] === 'fk' ? 'ffk' : 'fld';
        const tag = f[1] === 'pk' ? 'PK ' : f[1] === 'fk' ? 'FK ' : '';
        parts.push(`<text x="${x + 11}" y="${fy.toFixed(0)}" class="${cls}">${esc(tag + f[0])}</text>`);
        if (i < fields.length - 1) parts.push(`<line x1="${x}" y1="${(fy + 6).toFixed(0)}" x2="${x + W}" y2="${(fy + 6).toFixed(0)}" class="sep"/>`);
    });
    parts.push(`</g>`);
}

// legend
const lx = 40, ly = 905;
parts.push(`<rect x="${lx}" y="${ly}" width="1220" height="78" rx="7" class="legend"/>`);
parts.push(`<text x="${lx + 14}" y="${ly + 20}" class="legttl">Legende</text>`);
const leg = [
    ['rect', '#00002d', 'Dataverse-Tabelle (real)'],
    ['rect', '#303090', 'Exploded / Kind-Tabelle'],
    ['rect', '#76a700', 'App-lokal (geplant für Dataverse)'],
    ['pk', '', 'PK = Primärschlüssel (fett)'],
    ['fk', '', 'FK = Fremdschlüssel (kursiv)'],
    ['foot', '', 'Krähenfuß = „viele" (N / M)'],
    ['tick', '', 'Querstrich = „eins" (1)'],
    ['dash', '', 'gestrichelt = M:N / abgeleitet'],
];
leg.forEach((l, i) => {
    const col = i % 4, rowi = Math.floor(i / 4);
    const ex = lx + 18 + col * 305, ey = ly + 38 + rowi * 22;
    if (l[0] === 'rect') parts.push(`<rect x="${ex}" y="${ey - 9}" width="16" height="12" rx="2" fill="${l[1]}"/>`);
    else if (l[0] === 'pk') parts.push(`<text x="${ex}" y="${ey}" class="fpk">PK</text>`);
    else if (l[0] === 'fk') parts.push(`<text x="${ex}" y="${ey}" class="ffk">FK</text>`);
    else if (l[0] === 'foot') parts.push(crowFoot({ x: ex + 8, y: ey - 3 }, { x: -1, y: 0 }));
    else if (l[0] === 'tick') parts.push(oneTick({ x: ex + 8, y: ey - 3 }, { x: -1, y: 0 }));
    else if (l[0] === 'dash') parts.push(`<line x1="${ex}" y1="${ey - 3}" x2="${ex + 20}" y2="${ey - 3}" class="edge edge--dash"/>`);
    parts.push(`<text x="${ex + 26}" y="${ey}" class="legtxt">${esc(l[2])}</text>`);
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CW} ${CH}" font-family="'Inter','Segoe UI',Arial,sans-serif">
<style>
  .box{fill:#fff;stroke:#d4d6e6;stroke-width:1.2;}
  .ttl{fill:#fff;font-size:12.5px;font-weight:700;}
  .fld{fill:#181833;font-size:11.5px;}
  .fpk{fill:#00002d;font-size:11.5px;font-weight:700;}
  .ffk{fill:#181833;font-size:11.5px;font-style:italic;}
  .sep{stroke:#eceef6;stroke-width:1;}
  .edge{stroke:#4a4a8a;stroke-width:1.4;fill:none;}
  .edge--dash{stroke-dasharray:5 4;stroke:#76a700;}
  .foot{stroke:#303090;stroke-width:1.6;fill:none;}
  .card{fill:#303090;font-size:9.5px;font-weight:700;text-anchor:middle;}
  .cardbg{fill:#ffffff;opacity:.88;}
  .legend{fill:#f5f6fb;stroke:#e4e5ef;stroke-width:1;}
  .legttl{fill:#00002d;font-size:12px;font-weight:700;}
  .legtxt{fill:#41435f;font-size:11px;}
</style>
${parts.join('\n')}
</svg>`;

writeFileSync(out, svg, 'utf8');
console.log('wrote', out, `(${Object.keys(E).length} Entitäten, ${REL.length} Beziehungen)`);
