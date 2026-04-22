import { listAll } from './client';
import type { DvHvs, DvILevel, DvWbsTypeMapping } from './types';
import type { IStufeMaster } from '../data/istufeData';
import type { HvsEntry } from '../data/speicherData';

/** PQ emits "ATS" / "SAB"; app convention is "ATS WEEK" / "SAB WEEK". */
function normalizeOffset(o: string): string {
    if (o === 'ATS') return 'ATS WEEK';
    if (o === 'SAB') return 'SAB WEEK';
    return o;
}

function toDateString(v: string | undefined): string {
    if (!v) return '';
    const idx = v.indexOf('T');
    return idx > 0 ? v.slice(0, idx) : v;
}

/**
 * Load ILevels from Dataverse and aggregate into IStufeMaster[].
 *
 * `crf4f_ilevels_1` is the post-Power-Query exploded form — one row per
 * (iLevel × week offset). We group by iLevel and reassemble the offsetWeeks
 * list that the app expects.
 */
export async function loadILevels(): Promise<IStufeMaster[]> {
    const rows = await listAll<DvILevel>('crf4f_ilevels_1');

    const byIlevel = new Map<string, DvILevel[]>();
    for (const row of rows) {
        const k = row.crf4f_ilevel;
        if (!k) continue;
        const bucket = byIlevel.get(k);
        if (bucket) bucket.push(row);
        else byIlevel.set(k, [row]);
    }

    const masters: IStufeMaster[] = [];
    for (const [istufe, group] of byIlevel) {
        const parts = istufe.split('-');
        const seTermin = parts.length >= 3 ? `${parts[0]}-${parts[1]}` : istufe;
        const reife = Number(parts[parts.length - 1]) || 0;
        const sample = group[0];

        const offsetWeeks = group
            .map(r => ({
                offset: normalizeOffset(r.crf4f_offset ?? ''),
                week: r.crf4f_week ?? '',
            }))
            .filter(ow => ow.offset && ow.week)
            .sort((a, b) => a.week.localeCompare(b.week));

        const atsWeek = offsetWeeks.find(ow => ow.offset === 'ATS WEEK')?.week ?? '';
        const sabWeek = offsetWeeks.find(ow => ow.offset === 'SAB WEEK')?.week ?? '';

        masters.push({
            istufe,
            seTermin,
            reife,
            ats: toDateString(sample.crf4f_ats),
            sab: toDateString(sample.crf4f_sab),
            atsWeek,
            sabWeek,
            offsetWeeks,
        });
    }

    return masters.sort((a, b) => {
        if (a.seTermin !== b.seTermin) return a.seTermin.localeCompare(b.seTermin);
        return a.reife - b.reife;
    });
}

/**
 * Derive the HVS short code from the Speichertyp string.
 * Example: "B6RO0 -001 | RR XL | HP-PH" → "B6RO0"
 */
function deriveHvsCode(speichertyp: string): string {
    if (!speichertyp) return '';
    const firstToken = speichertyp.split(/\s+/)[0];
    return firstToken ?? '';
}

/**
 * Load HVS rows from Dataverse, with the WBS→MUSTER mapping joined in.
 * Returns HvsEntry[] shaped for the Freigabe Timeline grid.
 *
 * BRV is not carried on the HVS table — it's hardcoded per the current
 * PQ filter (P-114758 → NA05). TODO: source BRV dynamically when multiple
 * BRVs are in scope.
 */
export async function loadHvs(): Promise<HvsEntry[]> {
    const [hvsRows, wbsMapping] = await Promise.all([
        listAll<DvHvs>('crf4f_hvs'),
        listAll<DvWbsTypeMapping>('crf4f_wbs_type_mapping'),
    ]);

    const musterByWbs = new Map<string, string>();
    for (const m of wbsMapping) {
        if (m.crf4f_wbs_type) {
            musterByWbs.set(m.crf4f_wbs_type, m.crf4f_muster ?? '');
        }
    }

    const entries: HvsEntry[] = [];
    const seenKeys = new Set<string>();

    for (const r of hvsRows) {
        const key = r.crf4f_key ?? '';
        if (!key || seenKeys.has(key)) continue;  // HVS table has one row per (key × MonatJahr); dedupe
        seenKeys.add(key);

        const wbsType = r.crf4f_wbs_type ?? '';
        const muster = r.crf4f_musterorspeicher || musterByWbs.get(wbsType) || '';

        entries.push({
            brv: 'NA05',
            hvs: deriveHvsCode(r.crf4f_speichertyp ?? ''),
            speicher: r.crf4f_pnummer ?? '',
            wbsType,
            muster,
            key,
            penthouse: (r.crf4f_penthouse ?? '').replace(/\s+/g, ''),
            verbundId: null,
            defaultActive: true,
        });
    }

    return entries.sort((a, b) => a.key.localeCompare(b.key));
}
