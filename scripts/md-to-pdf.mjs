// Markdown -> styled, print-ready HTML for the Lastenheft.
// Produces a cover page + table of contents + numbered body.
// Constructs handled: headings, GFM pipe tables, bold, inline code,
// blockquotes, ordered/unordered (nested) lists, horizontal rules, links.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const inFile = process.argv[2];
const outHtml = process.argv[3];
if (!inFile || !outHtml) {
    console.error('usage: node md-to-pdf.mjs <in.md> <out.html>');
    process.exit(1);
}

// ── document metadata (cover) ──────────────────────────────────────────
const META = {
    kicker: 'P3 Group · HVS Software-Freigabe',
    docType: 'Lastenheft',
    title: 'Freigabencockpit Next',
    subtitle: 'Anforderungsspezifikation — HVS Software-Freigabe-Cockpit',
    version: '1.0',
    date: '10. Juni 2026',
    status: 'Final',
    classification: 'Vertraulich – nur für den internen Gebrauch',
    owner: 'BMW Group · P3 Group',
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(s) {
    let t = esc(s);
    t = t.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
    t = t.replace(/\*\*([^*]+)\*\*/g, (_, c) => `<strong>${c}</strong>`);
    t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, txt, url) => `<a href="${url}">${txt}</a>`);
    return t;
}

const src = readFileSync(inFile, 'utf8').replace(/\r\n/g, '\n');
const lines = src.split('\n');
const out = [];
const toc = []; // {level, text, id}
let headingSeq = 0;
let firstH1Seen = false;
let i = 0;

const isTableSep = (l) => /^\s*\|?[\s:|-]+\|[\s:|-]+\s*$/.test(l) && l.includes('-');
const splitRow = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());

while (i < lines.length) {
    let line = lines[i];

    if (/^\s*$/.test(line)) { i++; continue; }

    // ERD placeholder -> inline the generated SVG
    if (line.trim() === '[[ERD]]') {
        try {
            const svg = readFileSync(join(dirname(inFile), 'erd.svg'), 'utf8');
            out.push(`<figure class="erd">${svg}<figcaption>Abb. 1 — Datenmodell Freigabencockpit Next (ER-Diagramm, Krähenfuß-Notation)</figcaption></figure>`);
        } catch { out.push('<p><em>[ER-Diagramm nicht gefunden — bitte build-erd.mjs ausführen]</em></p>'); }
        i++; continue;
    }

    // Process/context sketch -> inline the generated SVG
    if (line.trim() === '[[CONTEXT]]') {
        try {
            const svg = readFileSync(join(dirname(inFile), 'context.svg'), 'utf8');
            out.push(`<figure class="erd">${svg}<figcaption>Abb. 2 — Prozess- und Systemkontext: Quellsysteme → FreigabecockpitNEXT → Zielsysteme (End-to-End-Use-Case)</figcaption></figure>`);
        } catch { out.push('<p><em>[Kontext-Diagramm nicht gefunden — bitte build-context.mjs ausführen]</em></p>'); }
        i++; continue;
    }

    // fenced code block ``` ... ```
    if (/^```/.test(line)) {
        i++; const code = [];
        while (i < lines.length && !/^```/.test(lines[i])) { code.push(lines[i]); i++; }
        i++; // closing fence
        out.push(`<pre class="code"><code>${esc(code.join('\n'))}</code></pre>`);
        continue;
    }

    if (/^---+\s*$/.test(line)) { out.push('<hr/>'); i++; continue; }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
        const n = h[1].length;
        const text = h[2];
        // Drop the very first H1 — the cover carries the title.
        if (n === 1 && !firstH1Seen) { firstH1Seen = true; i++; continue; }
        const id = `sec-${++headingSeq}`;
        if (n === 2 || n === 3) toc.push({ level: n, text, id });
        out.push(`<h${n} id="${id}">${inline(text)}</h${n}>`);
        i++; continue;
    }

    if (line.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
        const header = splitRow(line);
        i += 2;
        const rows = [];
        while (i < lines.length && lines[i].includes('|') && !/^\s*$/.test(lines[i])) { rows.push(splitRow(lines[i])); i++; }
        let html = '<table><thead><tr>' + header.map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>';
        for (const r of rows) html += '<tr>' + r.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>';
        html += '</tbody></table>';
        out.push(html); continue;
    }

    if (/^\s*>\s?/.test(line)) {
        const buf = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
        out.push(`<blockquote>${inline(buf.join(' '))}</blockquote>`); continue;
    }

    if (/^(\s*)([-*]|\d+\.)\s+/.test(line)) {
        const items = [];
        while (i < lines.length) {
            const m = lines[i].match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
            if (!m) {
                if (items.length && /^\s+\S/.test(lines[i]) && !/^\s*$/.test(lines[i])) {
                    items[items.length - 1].text += ' ' + lines[i].trim(); i++; continue;
                }
                break;
            }
            const level = Math.floor(m[1].replace(/\t/g, '  ').length / 2);
            const ordered = /\d+\./.test(m[2]);
            items.push({ level, ordered, text: m[3] });
            i++;
        }
        let html = '';
        const stack = [];
        let prevLevel = -1;
        for (const it of items) {
            if (it.level > prevLevel) {
                for (let l = prevLevel + 1; l <= it.level; l++) { html += it.ordered ? '<ol>' : '<ul>'; stack.push(it.ordered); }
            } else if (it.level < prevLevel) {
                for (let l = prevLevel; l > it.level; l--) html += stack.pop() ? '</ol>' : '</ul>';
            }
            html += `<li>${inline(it.text)}</li>`;
            prevLevel = it.level;
        }
        while (stack.length) html += stack.pop() ? '</ol>' : '</ul>';
        out.push(html); continue;
    }

    const buf = [];
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,6})\s/.test(lines[i])
        && !/^---+\s*$/.test(lines[i]) && !/^\s*>/.test(lines[i])
        && !/^(\s*)([-*]|\d+\.)\s+/.test(lines[i])
        && !(lines[i].includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1]))) {
        buf.push(lines[i]); i++;
    }
    out.push(`<p>${inline(buf.join(' '))}</p>`);
}

// ── cover ───────────────────────────────────────────────────────────────
const cover = `
<section class="cover">
  <div class="cover__wm">P3 GROUP</div>
  <div class="cover__top">
    <div class="cover__rule"></div>
    <div class="cover__kicker">${esc(META.kicker)}</div>
  </div>
  <div class="cover__main">
    <div class="cover__doctype">${esc(META.docType)}</div>
    <h1 class="cover__title">${esc(META.title)}</h1>
    <div class="cover__subtitle">${esc(META.subtitle)}</div>
  </div>
  <div class="cover__meta">
    <div class="cover__meta-row"><span>Version</span><b>${esc(META.version)}</b></div>
    <div class="cover__meta-row"><span>Datum</span><b>${esc(META.date)}</b></div>
    <div class="cover__meta-row"><span>Status</span><b>${esc(META.status)}</b></div>
    <div class="cover__meta-row"><span>Herausgeber</span><b>${esc(META.owner)}</b></div>
    <div class="cover__class">${esc(META.classification)}</div>
  </div>
</section>
<div class="pagebreak"></div>`;

// ── table of contents ────────────────────────────────────────────────────
const tocItems = toc.map(t =>
    `<div class="toc__item toc__item--l${t.level}"><a href="#${t.id}">${inline(t.text)}</a></div>`
).join('\n');
const tocBlock = `
<section class="toc">
  <h2 class="toc__heading">Inhaltsverzeichnis</h2>
  ${tocItems}
</section>
<div class="pagebreak"></div>`;

// ── styles ───────────────────────────────────────────────────────────────
const css = `
  /* P3 FORGE brand — neon lime #dbff55 on deep indigo #00002d. Inter typeface, rounded. */
  :root {
    --navy:#00002d; --indigo:#12124a; --indigo2:#303090; --border:#2a2a6a;
    --lime:#dbff55; --lime-press:#c8f040;
    --ink:#181833; --muted:#6a6a8a; --line:#e4e5ef; --surface:#f5f6fb;
    --font:'Inter','SF Pro Display',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    --mono:'Cascadia Code','SF Mono',Menlo,Consolas,monospace;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: var(--font); color: var(--ink); font-size: 10.7pt; line-height: 1.62; }
  .pagebreak { page-break-after: always; }

  /* Cover — dark, full brand impact */
  .cover { position: relative; min-height: 250mm; background: var(--navy); color: #fafafa;
           border-radius: 16px; padding: 30mm 22mm 22mm; overflow: hidden;
           display: flex; flex-direction: column; justify-content: space-between; }
  .cover::after { content: ""; position: absolute; right: -120px; top: -120px; width: 320px; height: 320px;
                  border-radius: 50%; background: radial-gradient(circle, rgba(219,255,85,0.18), transparent 70%); }
  .cover__wm { position: absolute; top: 18mm; right: 22mm; color: var(--lime); font-size: 11pt;
               font-weight: 700; letter-spacing: .28em; }
  .cover__rule { height: 6px; width: 84mm; background: var(--lime); border-radius: 3px; }
  .cover__kicker { margin-top: 14px; font-size: 11pt; letter-spacing: .16em; text-transform: uppercase;
                   color: var(--lime); font-weight: 600; }
  .cover__main { margin-top: -30mm; }
  .cover__doctype { font-size: 13pt; letter-spacing: .24em; text-transform: uppercase; color: #a1a1aa; }
  .cover__title { font-size: 42pt; line-height: 1.04; color: #fafafa; margin: 8px 0 0; font-weight: 800;
                  letter-spacing: -0.5px; }
  .cover__subtitle { font-size: 14pt; color: #c9cae6; margin-top: 16px; font-weight: 400; }
  .cover__meta { border-top: 1px solid var(--border); padding-top: 16px; position: relative; }
  .cover__meta-row { display: flex; gap: 14px; font-size: 10.5pt; margin: 4px 0; }
  .cover__meta-row span { width: 34mm; color: #a1a1aa; }
  .cover__meta-row b { color: #fafafa; font-weight: 600; }
  .cover__class { margin-top: 16px; font-size: 9pt; color: var(--lime); font-style: italic; }

  /* TOC */
  .toc__heading { font-size: 17pt; color: var(--navy); border-bottom: 3px solid var(--lime); padding-bottom: 8px;
                  margin: 0 0 16px; font-weight: 800; page-break-before: avoid; }
  .toc__item { margin: 5px 0; }
  .toc__item a { color: var(--ink); text-decoration: none; }
  .toc__item--l2 { font-weight: 700; color: var(--navy); margin-top: 9px; font-size: 10.8pt; }
  .toc__item--l2 a { color: var(--navy); }
  .toc__item--l3 { padding-left: 12mm; font-size: 10pt; color: #44476a; }

  /* Body — generous spacing; each top-level section starts on a new page */
  h2 { font-size: 16pt; color: var(--navy); margin: 4px 0 16px; padding-bottom: 8px;
       border-bottom: 2px solid var(--lime); font-weight: 800; letter-spacing: -0.2px;
       page-break-before: always; page-break-after: avoid; }
  h3 { font-size: 12.5pt; color: var(--navy); margin: 26px 0 7px; padding-left: 10px;
       border-left: 3px solid var(--lime); font-weight: 700; page-break-after: avoid; }
  h4 { font-size: 11pt; color: var(--indigo2); margin: 18px 0 5px; padding-left: 9px;
       border-left: 2px solid var(--lime); font-weight: 700; page-break-after: avoid; }
  p { margin: 9px 0; }
  a { color: var(--navy); text-decoration: none; border-bottom: 1px solid var(--lime); }
  code { background: var(--surface); border: 1px solid var(--line); border-radius: 6px; padding: 1px 5px;
         font-family: var(--mono); font-size: 9pt; color: var(--indigo2); }
  strong { color: var(--navy); }
  hr { border: none; border-top: 1px solid var(--line); margin: 20px 0; }
  blockquote { border-left: 3px solid var(--lime); background: #fbfde9; margin: 14px 0; padding: 10px 16px;
               color: #41435f; font-style: italic; border-radius: 0 8px 8px 0; }
  ul, ol { margin: 10px 0; padding-left: 24px; }
  li { margin: 6px 0; line-height: 1.55; }
  li::marker { color: var(--indigo2); }
  table { border-collapse: collapse; width: 100%; margin: 14px 0; font-size: 9.6pt;
          border-radius: 8px; overflow: hidden; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  th { background: var(--navy); color: #fafafa; text-align: left; padding: 8px 11px; font-weight: 600;
       border-bottom: 2px solid var(--lime); }
  td { border: 1px solid #dfe1ec; padding: 7px 11px; vertical-align: top; line-height: 1.5; }
  tbody tr:nth-child(even) { background: var(--surface); }
  h2, h3, h4, blockquote { page-break-inside: avoid; }

  figure.erd { margin: 14px 0; text-align: center; page-break-inside: avoid; }
  figure.erd svg { width: 100%; height: auto; border: 1px solid var(--line); border-radius: 12px; }
  figure.erd figcaption { font-size: 8.5pt; color: var(--muted); margin-top: 6px; font-style: italic; }
  pre.code { background: var(--navy); color: #d7dcf5; border-radius: 12px; padding: 12px 14px;
             border: 1px solid var(--border); font-family: var(--mono); font-size: 8.2pt; line-height: 1.5;
             overflow-x: auto; white-space: pre-wrap; page-break-inside: avoid; }
  pre.code code { background: none; border: none; color: inherit; padding: 0; font-size: inherit; }
`;

const html = `<!doctype html><html lang="de"><head><meta charset="utf-8">
<title>${esc(META.docType)} — ${esc(META.title)}</title><style>${css}</style></head>
<body>${cover}\n${tocBlock}\n${out.join('\n')}</body></html>`;

writeFileSync(outHtml, html, 'utf8');
console.log('wrote', outHtml, '·', toc.length, 'TOC entries');
