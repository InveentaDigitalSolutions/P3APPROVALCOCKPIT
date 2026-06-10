// Print an HTML file to a professional PDF via the Chrome DevTools Protocol.
// Uses Node's built-in fetch + WebSocket (Node >= 22) — no dependencies.
// Adds a repeating page footer with page numbers (not achievable via the
// plain --print-to-pdf CLI), an A4 layout and proper margins.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const htmlFile = process.argv[2];
const outPdf = process.argv[3];
const pageRanges = process.argv[4] || '';   // optional, e.g. "3" or "3-4"
if (!htmlFile || !outPdf) { console.error('usage: node print-pdf.mjs <in.html> <out.pdf> [pageRanges]'); process.exit(1); }

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const fileUrl = pathToFileURL(resolve(htmlFile)).href;
const userDir = `/tmp/fgc-chrome-${process.pid}`;

const footer = `
<div style="font-size:8px;width:100%;padding:5px 14mm 0;color:#3a3a5a;
  font-family:'Inter','Segoe UI',Arial,sans-serif;display:flex;justify-content:space-between;
  border-top:1.4px solid #dbff55;">
  <span style="color:#00002d;font-weight:600;">BMW Group &middot; P3 Group</span>
  <span>Seite <span class="pageNumber"></span> von <span class="totalPages"></span></span>
  <span>Projektdokumentation &middot; Freigabencockpit Next &middot; v1.0</span>
</div>`;
const header = '<div></div>';

const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-background-networking', '--mute-audio',
    `--user-data-dir=${userDir}`, '--remote-debugging-port=0', 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });

let done = false;
const fail = (msg) => { if (!done) { done = true; console.error('ERROR:', msg); try { chrome.kill('SIGKILL'); } catch {} process.exit(1); } };
const watchdog = setTimeout(() => fail('timeout (30s)'), 30000);

// Chrome prints "DevTools listening on ws://127.0.0.1:PORT/devtools/browser/..." to stderr.
let buf = '';
chrome.stderr.on('data', (d) => {
    buf += d.toString();
    const m = buf.match(/ws:\/\/127\.0\.0\.1:(\d+)\/devtools\/browser\/\S+/);
    if (m) { buf = ''; start(Number(m[1])).catch(fail); }
});
chrome.on('exit', (c) => { if (!done) fail(`chrome exited (${c})`); });

async function start(port) {
    // Create a page target and connect directly to its debugger websocket.
    const res = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' });
    const target = await res.json();
    const ws = new WebSocket(target.webSocketDebuggerUrl);

    let nextId = 1;
    const pending = new Map();
    const send = (method, params = {}) => new Promise((ok) => { const id = nextId++; pending.set(id, ok); ws.send(JSON.stringify({ id, method, params })); });

    ws.addEventListener('message', (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); }
        else if (msg.method === 'Page.loadEventFired') { afterLoad(send).catch(fail); }
    });
    ws.addEventListener('error', () => fail('websocket error'));

    ws.addEventListener('open', async () => {
        await send('Page.enable');
        await send('Emulation.setEmulatedMedia', { media: 'print' });
        await send('Page.navigate', { url: fileUrl });
        // Fallback in case the load event was missed.
        setTimeout(() => afterLoad(send).catch(() => {}), 2500);
    });
}

let printed = false;
async function afterLoad(send) {
    if (printed) return; printed = true;
    // Give web fonts / layout a beat to settle.
    await new Promise((r) => setTimeout(r, 400));
    const result = await send('Page.printToPDF', {
        landscape: false,
        printBackground: true,
        preferCSSPageSize: false,
        paperWidth: 8.27, paperHeight: 11.69,          // A4
        marginTop: 0.7, marginBottom: 0.72, marginLeft: 0.66, marginRight: 0.66,
        displayHeaderFooter: true,
        headerTemplate: header,
        footerTemplate: footer,
        ...(pageRanges ? { pageRanges } : {}),
    });
    writeFileSync(outPdf, Buffer.from(result.data, 'base64'));
    done = true;
    clearTimeout(watchdog);
    try { chrome.kill('SIGKILL'); } catch {}
    console.log('wrote', outPdf, '·', (readFileSync(outPdf).length / 1024).toFixed(0) + ' KB');
    process.exit(0);
}
