// Build a Word-friendly HTML from the Lastenheft markdown for textutil -> docx.
// Keeps the first H1 as the title, renders tables/lists/headings/code, and emits
// unique placeholders (@@IMG:erd@@ / @@IMG:context@@) where the diagrams go — these
// are replaced by embedded PNGs in a post-processing step (embed-images-docx.mjs).
import { readFileSync, writeFileSync } from 'node:fs';

const inFile = process.argv[2];
const outHtml = process.argv[3];
if (!inFile || !outHtml) { console.error('usage: node build-word.mjs <in.md> <out.html>'); process.exit(1); }

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function inline(s) {
    let t = esc(s);
    t = t.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
    t = t.replace(/\*\*([^*]+)\*\*/g, (_, c) => `<b>${c}</b>`);
    t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, txt) => `<u>${txt}</u>`); // links -> underlined text (paths are noise in Word)
    return t;
}

const lines = readFileSync(inFile, 'utf8').replace(/\r\n/g, '\n').split('\n');
const out = [];
let i = 0;
const isTableSep = (l) => /^\s*\|?[\s:|-]+\|[\s:|-]+\s*$/.test(l) && l.includes('-');
const splitRow = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());

while (i < lines.length) {
    let line = lines[i];
    if (/^\s*$/.test(line)) { i++; continue; }
    if (line.trim() === '[[ERD]]') { out.push('<p>@@IMG:erd@@</p>'); i++; continue; }
    if (line.trim() === '[[CONTEXT]]') { out.push('<p>@@IMG:context@@</p>'); i++; continue; }
    if (/^```/.test(line)) { i++; const c = []; while (i < lines.length && !/^```/.test(lines[i])) { c.push(lines[i]); i++; } i++; out.push(`<pre>${esc(c.join('\n'))}</pre>`); continue; }
    if (/^---+\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { const n = Math.min(h[1].length, 4); out.push(`<h${n}>${inline(h[2])}</h${n}>`); i++; continue; }
    if (line.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
        const header = splitRow(line); i += 2; const rows = [];
        while (i < lines.length && lines[i].includes('|') && !/^\s*$/.test(lines[i])) { rows.push(splitRow(lines[i])); i++; }
        let h2 = '<table border="1" cellspacing="0" cellpadding="5"><thead><tr>' + header.map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>';
        for (const r of rows) h2 += '<tr>' + r.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>';
        out.push(h2 + '</tbody></table>'); continue;
    }
    if (/^\s*>\s?/.test(line)) { const b = []; while (i < lines.length && /^\s*>\s?/.test(lines[i])) { b.push(lines[i].replace(/^\s*>\s?/, '')); i++; } out.push(`<p style="margin-left:18px"><i>${inline(b.join(' '))}</i></p>`); continue; }
    if (/^(\s*)([-*]|\d+\.)\s+/.test(line)) {
        const items = [];
        while (i < lines.length) {
            const m = lines[i].match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
            if (!m) { if (items.length && /^\s+\S/.test(lines[i]) && !/^\s*$/.test(lines[i])) { items[items.length - 1].text += ' ' + lines[i].trim(); i++; continue; } break; }
            items.push({ level: Math.floor(m[1].replace(/\t/g, '  ').length / 2), ordered: /\d+\./.test(m[2]), text: m[3] }); i++;
        }
        let html = ''; const stack = []; let prev = -1;
        for (const it of items) {
            if (it.level > prev) { for (let l = prev + 1; l <= it.level; l++) { html += it.ordered ? '<ol>' : '<ul>'; stack.push(it.ordered); } }
            else if (it.level < prev) { for (let l = prev; l > it.level; l--) html += stack.pop() ? '</ol>' : '</ul>'; }
            html += `<li>${inline(it.text)}</li>`; prev = it.level;
        }
        while (stack.length) html += stack.pop() ? '</ol>' : '</ul>';
        out.push(html); continue;
    }
    const buf = [];
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,6})\s/.test(lines[i]) && !/^---+\s*$/.test(lines[i])
        && !/^\s*>/.test(lines[i]) && !/^(\s*)([-*]|\d+\.)\s+/.test(lines[i]) && lines[i].trim() !== '[[ERD]]' && lines[i].trim() !== '[[CONTEXT]]'
        && !/^```/.test(lines[i]) && !(lines[i].includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1]))) { buf.push(lines[i]); i++; }
    out.push(`<p>${inline(buf.join(' '))}</p>`);
}

const css = `
  body{font-family:'Inter','Calibri','Segoe UI',sans-serif;font-size:11pt;color:#181833;line-height:1.5;}
  h1{font-size:24pt;color:#00002d;}
  h2{font-size:16pt;color:#00002d;border-bottom:2px solid #76a700;padding-bottom:3px;}
  h3{font-size:13pt;color:#00002d;}
  h4{font-size:11.5pt;color:#303090;}
  table{border-collapse:collapse;width:100%;}
  th{background:#00002d;color:#ffffff;text-align:left;}
  td,th{border:1px solid #999999;padding:5px 8px;vertical-align:top;}
  pre{background:#f2f3f8;border:1px solid #d8dbe8;padding:8px;font-family:'Consolas',monospace;font-size:9pt;}
  code{font-family:'Consolas',monospace;background:#f2f3f8;}
  hr{border:none;border-top:1px solid #cccccc;}
`;
writeFileSync(outHtml, `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${out.join('\n')}</body></html>`, 'utf8');
console.log('wrote', outHtml);
