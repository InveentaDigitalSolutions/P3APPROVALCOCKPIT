#!/usr/bin/env node
/**
 * Dump all 8 Dataverse tables to JSON files under
 * `src/data/generated/dataverse/`. Uses `pac org fetch` (which auths via
 * the active pac auth profile — no browser-based auth needed).
 *
 * pac's tabular output concatenates columns without separators for narrow
 * values, so we fetch one attribute at a time. Each data line ends in a
 * 36-char GUID (the primary key). We regex-split on the trailing GUID.
 *
 * Primary-key GUIDs are preserved as `_id` on each row so the dev proxy
 * can return Dataverse-compatible OData envelopes.
 *
 * Run with: node scripts/dump-dataverse.mjs
 */

import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(REPO_ROOT, 'src/data/generated/dataverse');
mkdirSync(OUT_DIR, { recursive: true });

const PAC_ENV = { ...process.env, DOTNET_ROOT: '/Users/sgr/.dotnet' };
const GUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
const GUID_AT_END = new RegExp(`(.*)(${GUID_RE.source})$`);

function runFetch(entity, attribute) {
    const xml = `<fetch><entity name="${entity}"><attribute name="${attribute}"/></entity></fetch>`;
    writeFileSync('/tmp/__pac_fetch.xml', xml);
    return execSync('/Users/sgr/.dotnet/tools/pac org fetch --xmlFile /tmp/__pac_fetch.xml', {
        env: PAC_ENV,
        encoding: 'utf-8',
        maxBuffer: 100 * 1024 * 1024,
    });
}

function parseAttr(raw) {
    const pairs = new Map();
    for (const rawLine of raw.split('\n')) {
        const line = rawLine.replace(/\r$/, '').trimEnd();
        if (!line) continue;
        const m = line.match(GUID_AT_END);
        if (!m) continue;
        pairs.set(m[2], m[1].trim());
    }
    return pairs;
}

function fetchTable(entity, attributes) {
    const byId = new Map();
    for (const attr of attributes) {
        const m = parseAttr(runFetch(entity, attr));
        for (const [id, v] of m) {
            const row = byId.get(id) ?? { _id: id };
            row[attr] = v;
            byId.set(id, row);
        }
    }
    return [...byId.values()];
}

function mmddyyyyToIso(s) {
    if (!s) return '';
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!m) return s;
    const [, mo, d, y] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

// Per-table attribute lists. Edit here if you add columns to the Dataverse tables.
const TABLE_ATTRS = {
    crf4f_brv: ['crf4f_name'],
    crf4f_wbs_type_mapping: ['crf4f_wbs_type', 'crf4f_muster', 'crf4f_name'],
    crf4f_ilevels_1: [
        'crf4f_ilevel', 'crf4f_number', 'crf4f_ats', 'crf4f_sab', 'crf4f_fs', 'crf4f_sf',
        'crf4f_offset', 'crf4f_week', 'crf4f_kw', 'crf4f_weekindex',
        'crf4f_planningcycle', 'crf4f_startofproduction', 'crf4f_status',
        'crf4f_swipreleases', 'crf4f_oc',
    ],
    crf4f_hvs: [
        'crf4f_key', 'crf4f_speichertyp', 'crf4f_pnummer', 'crf4f_wbs_type',
        'crf4f_musterorspeicher', 'crf4f_penthouse', 'crf4f_bauphase',
        'crf4f_monatjahr', 'crf4f_sop', 'crf4f_wmmlink', 'crf4f_wmmlink_1',
    ],
    crf4f_ip3_freigaben: [
        'crf4f_key', 'crf4f_speichertyp', 'crf4f_pnummer', 'crf4f_wbs_type',
        'crf4f_musterorspeicher', 'crf4f_penthouse', 'crf4f_bauphase',
        'crf4f_monatjahr', 'crf4f_sop', 'crf4f_sollfreigabe', 'crf4f_startweek',
        'crf4f_wmmlink', 'crf4f_wmmlink_1',
    ],
    crf4f_verbundfreigaben: [
        'crf4f_collapseid', 'crf4f_name', 'crf4f_ilevelnames',
        'crf4f_startdate', 'crf4f_enddate',
        'crf4f_yearweek', 'crf4f_kw',
    ],
    crf4f_planned_component_approvals: [
        'crf4f_jirakey', 'crf4f_jiraurl', 'crf4f_name', 'crf4f_duedate',
        'crf4f_ilevelnames', 'crf4f_parentjiraissue', 'crf4f_parentbranches',
        'crf4f_brvs', 'crf4f_sops', 'crf4f_kw', 'crf4f_year', 'crf4f_yearweek',
    ],
    crf4f_cdh_ip3: [
        'crf4f_key', 'crf4f_name', 'crf4f_name_3', 'crf4f_sollfreigabe',
        'crf4f_wbs_type3clean', 'crf4f_startweek', 'crf4f_displ_start_date',
        'crf4f_displ_end_date', 'crf4f_task_type', 'crf4f_in_sync_with',
        'crf4f_elektr_reichweite', 'crf4f_elektr_reichweiten',
    ],
};

// Short names used for the output filenames
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

// Custom shaping: the 3 tables wired into the app today use a simpler, stable shape.
// Leave _id on everything so the dev proxy / admin page can always resolve a PK.
function shape(entity, rows) {
    if (entity === 'crf4f_ilevels_1') {
        return rows
            .filter(r => r.crf4f_ilevel)
            .map(r => ({
                _id: r._id,
                ilevel: r.crf4f_ilevel,
                number: Number(r.crf4f_number) || 0,
                ats: mmddyyyyToIso(r.crf4f_ats),
                sab: mmddyyyyToIso(r.crf4f_sab),
                offset: r.crf4f_offset,
                week: r.crf4f_week,
            }));
    }
    if (entity === 'crf4f_hvs') {
        const mapped = rows
            .filter(r => r.crf4f_key && r.crf4f_wbs_type)
            .map(r => ({
                _id: r._id,
                key: r.crf4f_key,
                speichertyp: r.crf4f_speichertyp ?? '',
                pnummer: r.crf4f_pnummer ?? '',
                wbsType: r.crf4f_wbs_type ?? '',
                muster: r.crf4f_musterorspeicher ?? '',
                penthouse: r.crf4f_penthouse ?? '',
                bauphase: r.crf4f_bauphase ?? '',
                monatjahr: r.crf4f_monatjahr ?? '',
            }));
        const byKey = new Map();
        for (const r of mapped) if (!byKey.has(r.key)) byKey.set(r.key, r);
        return [...byKey.values()];
    }
    if (entity === 'crf4f_ip3_freigaben') {
        return rows
            .filter(r => r.crf4f_key && r.crf4f_sollfreigabe)
            .map(r => ({
                _id: r._id,
                key: r.crf4f_key,
                sollFreigabe: r.crf4f_sollfreigabe ?? '',
                startWeek: r.crf4f_startweek ?? '',
                wbsType: r.crf4f_wbs_type ?? '',
                monatjahr: r.crf4f_monatjahr ?? '',
                sop: r.crf4f_sop ?? '',
                penthouse: r.crf4f_penthouse ?? '',
            }));
    }
    // Default: raw Dataverse columns preserved
    return rows;
}

for (const [entity, attrs] of Object.entries(TABLE_ATTRS)) {
    console.log(`Fetching ${entity} (${attrs.length} attrs) …`);
    const raw = fetchTable(entity, attrs);
    const rows = shape(entity, raw);
    writeFileSync(resolve(OUT_DIR, FILENAMES[entity]), JSON.stringify(rows, null, 2));
    console.log(`  → ${rows.length} rows → ${FILENAMES[entity]}`);
}

console.log('\nDone. JSON files under src/data/generated/dataverse/');
