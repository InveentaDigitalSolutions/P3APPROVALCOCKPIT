// Generate the end-to-end process / system-context sketch of FreigabecockpitNEXT
// as a standalone SVG (no dependencies). Output: docs/context.svg
import { writeFileSync } from 'node:fs';

const out = process.argv[2] || 'docs/context.svg';
const CW = 1340, CH = 780;
const P = [];
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function box(x, y, w, h, head, title, lines, fill = '#ffffff', accent = '#dbff55') {
    P.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="${fill}" stroke="#c7d0df" stroke-width="1.2"/>`);
    P.push(`<rect x="${x}" y="${y}" width="${w}" height="22" rx="7" fill="${head}"/>`);
    P.push(`<rect x="${x}" y="${y + 15}" width="${w}" height="7" fill="${head}"/>`);
    P.push(`<rect x="${x}" y="${y + 22}" width="${w}" height="2.5" fill="${accent}"/>`);
    P.push(`<text x="${x + 10}" y="${y + 15}" class="bt">${esc(title)}</text>`);
    (lines || []).forEach((l, i) => P.push(`<text x="${x + 10}" y="${y + 38 + i * 14}" class="bl">${esc(l)}</text>`));
}
const E = { l: (b) => ({ x: b.x, y: b.y + b.h / 2 }), r: (b) => ({ x: b.x + b.w, y: b.y + b.h / 2 }),
            t: (b) => ({ x: b.x + b.w / 2, y: b.y }), b: (b) => ({ x: b.x + b.w / 2, y: b.y + b.h }) };
function arrow(p1, p2, { dashed = false, bidir = false, label = '', lx = 0, ly = -4 } = {}) {
    P.push(`<path d="M${p1.x},${p1.y} L${p2.x},${p2.y}" class="arr${dashed ? ' arr--d' : ''}" marker-end="url(#ah)"${bidir ? ' marker-start="url(#ah)"' : ''}/>`);
    if (label) {
        const mx = (p1.x + p2.x) / 2 + lx, my = (p1.y + p2.y) / 2 + ly;
        P.push(`<rect x="${mx - label.length * 3.1 - 4}" y="${my - 9}" width="${label.length * 6.2 + 8}" height="13" rx="2" fill="#fff" opacity="0.9"/>`);
        P.push(`<text x="${mx}" y="${my + 1}" class="al">${esc(label)}</text>`);
    }
}

// ── Actors (roles) ──
const actors = [
    ['Release Manager (ES-6)', 360], ['CE / Fachingenieur', 540], ['WMM-Steward', 720], ['MIA-Koordinator', 900],
];
actors.forEach(([t, x]) => box(x, 24, 168, 34, '#2a2a6a', t, []));

// ── Center: the App ──
const app = { x: 340, y: 96, w: 600, h: 540 };
P.push(`<rect x="${app.x}" y="${app.y}" width="${app.w}" height="${app.h}" rx="10" fill="#f3f3fb" stroke="#303090" stroke-width="2"/>`);
P.push(`<rect x="${app.x}" y="${app.y}" width="${app.w}" height="40" rx="10" fill="#00002d"/>`);
P.push(`<rect x="${app.x}" y="${app.y + 30}" width="${app.w}" height="10" fill="#00002d"/>`);
P.push(`<rect x="${app.x}" y="${app.y + 40}" width="${app.w}" height="3" fill="#dbff55"/>`);
P.push(`<text x="${app.x + 16}" y="${app.y + 18}" class="appt">FreigabecockpitNEXT</text>`);
P.push(`<text x="${app.x + 16}" y="${app.y + 33}" class="apps">Power Apps Code App · Microsoft Dataverse</text>`);

const phases = [
    ['1 · Datenaufnahme & Abgleich', ['IP3-Termine · Stücklisten/SNR · DEEP-Verbundtermine', 'Deduplizierung · Differenzlogik (SNR-Änderungen)']],
    ['2 · WMM-Pflege', ['Zusammenbau prüfen/anlegen (ID = ZB_HVS)', 'SNR zuordnen · Delta anzeigen & überschreiben']],
    ['3 · Planung & Freigabe (User-Interface)', ['Übersichtsgrid (HVS × Woche) · Live-Filter · Verbund bilden', 'Batch-Change · Ist-Freigabe je Speicher × I-Stufe setzen']],
    ['4 · Output-Erzeugung', ['Jira-Tickets (I-Stufe+PTH+Level) + Epic · MIA-Anlagen', 'Freigabetemplate (Word→SharePoint) · Status/Links']],
];
const PB = [];
phases.forEach((ph, i) => {
    const y = app.y + 54 + i * 104;
    box(app.x + 22, y, app.w - 44, 84, '#303090', ph[0], ph[1]);
    PB.push({ x: app.x + 22, y, w: app.w - 44, h: 84 });
    if (i > 0) arrow({ x: app.x + app.w / 2, y: PB[i - 1].y + PB[i - 1].h }, { x: app.x + app.w / 2, y });
});
// actor -> phase 3 (UI)
arrow({ x: 624, y: 58 }, { x: app.x + app.w / 2, y: app.y }, { label: 'bestätigen · Verbund · Batch-Change', ly: -6 });

// ── Left: source systems ──
const S = {};
const srcDefs = [
    ['IP3', ['IP3 Appointment Project', 'Data Semantic (CDH)', 'Langfristtermine / Musterphase'], 110],
    ['Stücklisten (CDH)', ['PS-BOM-Semantic-Layer (Serie)', 'Everest Demand Data (Proto)', 'SNR je HVS-ID'], 226],
    ['DEEP', ['Kurzfristplanung · Verbund', 'Jira CodeCraft / ATC / SW-HRL'], 360],
    ['ESDH / Excel', ['I-Stufen-Folgen · Export'], 470],
];
srcDefs.forEach(([t, l, y]) => { const w = 250, x = 40, h = 24 + l.length * 14 + 12; box(x, y, w, h, '#12124a', t, l); S[t] = { x, y, w, h }; });
arrow(E.r(S['IP3']), { x: app.x, y: PB[0].y + 30 }, { label: 'API / CDH', dashed: true });
arrow(E.r(S['Stücklisten (CDH)']), { x: app.x, y: PB[0].y + 50 }, { dashed: true });
arrow(E.r(S['DEEP']), { x: app.x, y: PB[2].y + 20 }, { label: 'Verbund / I-Stufen', dashed: true });
arrow(E.r(S['ESDH / Excel']), { x: app.x, y: PB[0].y + 70 }, { dashed: true });

// WMM bidirectional (source + target)
const wmm = { x: 40, y: 560, w: 250, h: 56 };
box(wmm.x, wmm.y, wmm.w, wmm.h, '#76a700', 'WMM (Wissensmanagement)', ['Zusammenbauten · funktionale SNR']);
arrow({ x: wmm.x + wmm.w, y: wmm.y + wmm.h / 2 }, { x: app.x, y: PB[1].y + 42 }, { bidir: true, label: 'SNR lesen / schreiben' });

// ── Right: target systems ──
const T = {};
const tgtDefs = [
    ['Jira CodeCraft', ['Ticket je Speicher × SW-Stand', '(I-Stufe+PTH+Level) · Epic/I-Stufe', 'Due=Freigabetag · Start=ATS-2'], 110],
    ['MIA', ['MIA-Anlagen (techn. Prüfung)', 'Bewertungsprozess-Name', 'Verbund: n SNR → 1 MIA-Link'], 250],
    ['Freigabetemplate', ['Word-Vorlage → SharePoint', 'an Jira-Ticket angehängt', 'Freeze −14 Tage'], 390],
    ['FUSI Confluence', ['Dokumentation / Ablage'], 510],
];
tgtDefs.forEach(([t, l, y]) => { const w = 260, x = 1040, h = 24 + l.length * 14 + 12; box(x, y, w, h, '#76a700', t, l); T[t] = { x, y, w, h }; });
arrow({ x: app.x + app.w, y: PB[3].y + 18 }, E.l(T['Jira CodeCraft']), { label: 'Tickets' });
arrow({ x: app.x + app.w, y: PB[3].y + 38 }, E.l(T['MIA']), { label: 'MIA-Anlage' });
arrow({ x: app.x + app.w, y: PB[3].y + 58 }, E.l(T['Freigabetemplate']), { label: 'Word-Doc' });
arrow({ x: app.x + app.w, y: PB[3].y + 78 }, E.l(T['FUSI Confluence']), {});

// zone captions
P.push(`<text x="40" y="100" class="zone">QUELLSYSTEME</text>`);
P.push(`<text x="1040" y="100" class="zone">ZIELSYSTEME</text>`);
P.push(`<text x="${app.x + 16}" y="${app.y + app.h - 12}" class="apps">Plattform-Flows: Power Automate · Custom Connectors (CDH, Jira) · SharePoint-Integration</text>`);

// legend
P.push(`<rect x="40" y="650" width="1260" height="56" rx="7" fill="#f6f8fc" stroke="#d8dee9"/>`);
P.push(`<text x="54" y="670" class="legttl">Legende</text>`);
P.push(`<line x1="54" y1="690" x2="86" y2="690" class="arr arr--d" marker-end="url(#ah)"/><text x="94" y="694" class="legtxt">Eingang: Lesen aus Quellsystem (API / Connector)</text>`);
P.push(`<line x1="430" y1="690" x2="462" y2="690" class="arr" marker-end="url(#ah)"/><text x="470" y="694" class="legtxt">Ausgang: Schreiben/Erzeugen im Zielsystem</text>`);
P.push(`<line x1="770" y1="690" x2="802" y2="690" class="arr" marker-end="url(#ah)" marker-start="url(#ah)"/><text x="810" y="694" class="legtxt">bidirektional (WMM: SNR lesen und aktualisieren)</text>`);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CW} ${CH}" font-family="'Inter','Segoe UI',Arial,sans-serif">
<defs><marker id="ah" markerWidth="9" markerHeight="9" refX="7.5" refY="3" orient="auto">
  <path d="M0,0 L8,3 L0,6 z" fill="#303090"/></marker></defs>
<style>
  .bt{fill:#fff;font-size:11px;font-weight:700;}
  .bl{fill:#181833;font-size:10px;}
  .appt{fill:#fff;font-size:15px;font-weight:700;}
  .apps{fill:#a9abd6;font-size:10px;}
  .arr{stroke:#3a3a7a;stroke-width:1.6;fill:none;}
  .arr--d{stroke:#76a700;stroke-dasharray:5 4;}
  .al{fill:#303090;font-size:9px;font-weight:700;text-anchor:middle;}
  .zone{fill:#6a6a8a;font-size:11px;font-weight:700;letter-spacing:.12em;}
  .legttl{fill:#00002d;font-size:11px;font-weight:700;}
  .legtxt{fill:#41435f;font-size:10px;}
</style>
${P.join('\n')}
</svg>`;
writeFileSync(out, svg, 'utf8');
console.log('wrote', out);
