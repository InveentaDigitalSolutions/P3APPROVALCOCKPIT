/**
 * Vite dev-only plugin: serves `/__dv__/*` endpoints backed by the
 * committed JSON snapshots under `src/data/generated/dataverse/`.
 *
 * Reads:
 *   GET  /__dv__/:table            → { value: [...rows] }
 *   GET  /__dv__/:table/:id        → single row or 404
 *   POST /__dv__/refresh           → re-runs `scripts/dump-dataverse.mjs`
 *                                    using the active pac auth profile,
 *                                    then returns `{ ok, tables: {...} }`.
 *                                    Vite's file watcher picks up the
 *                                    regenerated JSON and HMR-reloads the
 *                                    importing modules. The client follows
 *                                    up with a hard reload for a clean state.
 *
 * Table-level writes (POST/PATCH/DELETE) return HTTP 501. Those require
 * the Power Apps SDK bridge or a browser-based auth flow.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const FILENAMES = {
    cr9b2_brv: 'brv.json',
    cr9b2_wbs_type_mapping: 'wbs_type_mapping.json',
    cr9b2_ilevels_1: 'ilevels.json',
    cr9b2_hvs: 'hvs.json',
    cr9b2_ip3_freigaben: 'ip3_freigaben.json',
    cr9b2_verbundfreigaben: 'verbundfreigaben.json',
    cr9b2_planned_component_approvals: 'planned_component_approvals.json',
    cr9b2_cdh_ip3: 'cdh_ip3.json',
};

function loadTable(root, table) {
    const filename = FILENAMES[table];
    if (!filename) return null;
    const path = resolve(root, 'src/data/generated/dataverse', filename);
    if (!existsSync(path)) return null;
    try {
        return JSON.parse(readFileSync(path, 'utf-8'));
    } catch {
        return null;
    }
}

function sendJson(res, status, body) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body));
}

let refreshInFlight = false;

/** Run `node scripts/dump-dataverse.mjs` and respond with the parsed result. */
async function runDump(root, res) {
    if (refreshInFlight) {
        sendJson(res, 429, { error: 'Refresh already in progress' });
        return;
    }
    refreshInFlight = true;
    const script = resolve(root, 'scripts/dump-dataverse.mjs');
    const child = spawn(process.execPath, [script], {
        cwd: root,
        env: process.env,
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (b) => { stdout += b.toString(); });
    child.stderr.on('data', (b) => { stderr += b.toString(); });

    child.on('close', (code) => {
        refreshInFlight = false;
        if (code !== 0) {
            console.error('[dv-proxy] dump failed:\n' + stderr);
            sendJson(res, 500, {
                ok: false,
                error: 'Dump script exited with code ' + code,
                stderr: stderr.trim().slice(-4000),
                stdout: stdout.trim().slice(-2000),
            });
            return;
        }
        // Parse the "→ N rows → file.json" lines for a compact summary
        const tableCounts = {};
        for (const line of stdout.split('\n')) {
            const m = line.match(/→\s*(\d+)\s*rows\s*→\s*([\w.]+)/);
            if (m) tableCounts[m[2]] = Number(m[1]);
        }
        sendJson(res, 200, { ok: true, tables: tableCounts });
    });
    child.on('error', (err) => {
        refreshInFlight = false;
        console.error('[dv-proxy] dump spawn error:', err);
        sendJson(res, 500, { ok: false, error: err.message });
    });
}

export function dataverseProxy() {
    let root;

    return {
        name: 'dataverse-proxy',
        configureServer(server) {
            root = server.config.root;

            server.middlewares.use('/__dv__', async (req, res) => {
                try {
                    const url = new URL(req.url, 'http://localhost');
                    const segs = url.pathname.split('/').filter(Boolean);
                    if (segs.length === 0) {
                        sendJson(res, 400, { error: 'Missing table name' });
                        return;
                    }
                    const table = segs[0];
                    const recordId = segs[1];
                    const method = (req.method ?? 'GET').toUpperCase();

                    // POST /__dv__/refresh → re-run the dump script
                    if (table === 'refresh') {
                        if (method !== 'POST') {
                            sendJson(res, 405, { error: 'Use POST /__dv__/refresh' });
                            return;
                        }
                        await runDump(root, res);
                        return;
                    }

                    if (method !== 'GET') {
                        sendJson(res, 501, {
                            error: `Write operations not supported in dev proxy. ${method} /${table}${recordId ? '/' + recordId : ''} rejected.`,
                            hint: 'Writes require browser-based Dataverse auth. Set that up, or use the Power Platform maker portal to edit rows directly.',
                        });
                        return;
                    }

                    const rows = loadTable(root, table);
                    if (!rows) {
                        sendJson(res, 404, {
                            error: `No snapshot for table ${table}. Run: npm run dump-dataverse`,
                            availableTables: Object.keys(FILENAMES),
                        });
                        return;
                    }

                    if (recordId) {
                        const row = rows.find(r => r._id === recordId);
                        if (!row) {
                            sendJson(res, 404, { error: 'Record not found', _id: recordId });
                            return;
                        }
                        sendJson(res, 200, row);
                        return;
                    }

                    // OData-like list response
                    sendJson(res, 200, { value: rows });
                } catch (e) {
                    console.error('[dv-proxy] error:', e);
                    sendJson(res, 500, { error: e.message ?? String(e) });
                }
            });
        },
    };
}
