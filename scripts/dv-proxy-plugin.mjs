/**
 * Vite dev-only plugin: serves `/__dv__/*` endpoints backed by the
 * committed JSON snapshots under `src/data/generated/dataverse/`.
 *
 * Reads:
 *   GET /__dv__/:table            → { value: [...rows] }
 *   GET /__dv__/:table/:id        → single row or 404
 *
 * Writes (POST/PATCH/DELETE) return HTTP 501. Writes require either:
 *   (a) the Power Apps SDK bridge (currently not initializing), or
 *   (b) a different browser-based auth path.
 *
 * Refresh the snapshots with `npm run dump-dataverse`.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const FILENAMES = {
    crf4f_brv: 'brv.json',
    crf4f_wbs_type_mapping: 'wbs_type_mapping.json',
    crf4f_ilevels_1: 'ilevels.json',
    crf4f_hvs: 'hvs.json',
    crf4f_ip3_freigaben: 'ip3_freigaben.json',
    crf4f_verbundfreigaben: 'verbundfreigaben.json',
    crf4f_planned_component_approvals: 'planned_component_approvals.json',
    crf4f_cdh_ip3: 'cdh_ip3.json',
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
