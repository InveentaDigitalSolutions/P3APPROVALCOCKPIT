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
    cr9b2_brv: ['cr9b2_name'],
    cr9b2_wbs_type_mapping: ['cr9b2_wbs_type', 'cr9b2_muster', 'cr9b2_name'],
    cr9b2_ilevels_1: [
        'cr9b2_ilevel', 'cr9b2_number', 'cr9b2_ats', 'cr9b2_sab', 'cr9b2_fs', 'cr9b2_sf',
        'cr9b2_offset', 'cr9b2_week', 'cr9b2_kw', 'cr9b2_weekindex',
        'cr9b2_planningcycle', 'cr9b2_startofproduction', 'cr9b2_status',
        'cr9b2_swipreleases', 'cr9b2_oc',
    ],
    cr9b2_hvs: [
        'cr9b2_key', 'cr9b2_speichertyp', 'cr9b2_pnummer', 'cr9b2_wbs_type',
        'cr9b2_musterorspeicher', 'cr9b2_penthouse', 'cr9b2_bauphase',
        'cr9b2_monatjahr', 'cr9b2_sop', 'cr9b2_wmmlink', 'cr9b2_wmmlink_1',
    ],
    cr9b2_ip3_freigaben: [
        'cr9b2_key', 'cr9b2_speichertyp', 'cr9b2_pnummer', 'cr9b2_wbs_type',
        'cr9b2_musterorspeicher', 'cr9b2_penthouse', 'cr9b2_bauphase',
        'cr9b2_monatjahr', 'cr9b2_sop', 'cr9b2_sollfreigabe', 'cr9b2_startweek',
        'cr9b2_wmmlink', 'cr9b2_wmmlink_1',
    ],
    cr9b2_verbundfreigaben: [
        'cr9b2_collapseid', 'cr9b2_name', 'cr9b2_ilevelnames',
        'cr9b2_startdate', 'cr9b2_enddate',
        'cr9b2_yearweek', 'cr9b2_kw',
    ],
    cr9b2_planned_component_approvals: [
        'cr9b2_jirakey', 'cr9b2_jiraurl', 'cr9b2_name', 'cr9b2_duedate',
        'cr9b2_ilevelnames', 'cr9b2_parentjiraissue', 'cr9b2_parentbranches',
        'cr9b2_brvs', 'cr9b2_sops', 'cr9b2_kw', 'cr9b2_year', 'cr9b2_yearweek',
    ],
    cr9b2_cdh_ip3: [
        'cr9b2_key', 'cr9b2_name', 'cr9b2_name_3', 'cr9b2_sollfreigabe',
        'cr9b2_wbs_type3clean', 'cr9b2_startweek', 'cr9b2_displ_start_date',
        'cr9b2_displ_end_date', 'cr9b2_task_type', 'cr9b2_in_sync_with',
        'cr9b2_elektr_reichweite', 'cr9b2_elektr_reichweiten',
    ],
};

// Short names used for the output filenames
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

// Custom shaping: the 3 tables wired into the app today use a simpler, stable shape.
// Leave _id on everything so the dev proxy / admin page can always resolve a PK.
function shape(entity, rows) {
    if (entity === 'cr9b2_ilevels_1') {
        return rows
            .filter(r => r.cr9b2_ilevel)
            .map(r => ({
                _id: r._id,
                ilevel: r.cr9b2_ilevel,
                number: Number(r.cr9b2_number) || 0,
                ats: mmddyyyyToIso(r.cr9b2_ats),
                sab: mmddyyyyToIso(r.cr9b2_sab),
                offset: r.cr9b2_offset,
                week: r.cr9b2_week,
            }));
    }
    if (entity === 'cr9b2_hvs') {
        const mapped = rows
            .filter(r => r.cr9b2_key && r.cr9b2_wbs_type)
            .map(r => ({
                _id: r._id,
                key: r.cr9b2_key,
                speichertyp: r.cr9b2_speichertyp ?? '',
                pnummer: r.cr9b2_pnummer ?? '',
                wbsType: r.cr9b2_wbs_type ?? '',
                muster: r.cr9b2_musterorspeicher ?? '',
                penthouse: r.cr9b2_penthouse ?? '',
                bauphase: r.cr9b2_bauphase ?? '',
                monatjahr: r.cr9b2_monatjahr ?? '',
            }));
        const byKey = new Map();
        for (const r of mapped) if (!byKey.has(r.key)) byKey.set(r.key, r);
        return [...byKey.values()];
    }
    if (entity === 'cr9b2_ip3_freigaben') {
        return rows
            .filter(r => r.cr9b2_key && r.cr9b2_sollfreigabe)
            .map(r => ({
                _id: r._id,
                key: r.cr9b2_key,
                sollFreigabe: r.cr9b2_sollfreigabe ?? '',
                startWeek: r.cr9b2_startweek ?? '',
                wbsType: r.cr9b2_wbs_type ?? '',
                monatjahr: r.cr9b2_monatjahr ?? '',
                sop: r.cr9b2_sop ?? '',
                penthouse: r.cr9b2_penthouse ?? '',
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
