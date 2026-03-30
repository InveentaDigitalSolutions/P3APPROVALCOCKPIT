/**
 * Data module for COAP Freigabecockpit
 * Sources data from Freigabecockpit.xlsx via the generated records file.
 *
 * To update: edit Freigabecockpit.xlsx → the Vite dev server auto-regenerates,
 * or run manually: node scripts/excel-to-ts.mjs
 */
import type { FreigabeRecord } from '../types';
import {
    EXCEL_RECORDS,
    KW_KEYS,
    SPEICHER_LIST,
    SPEICHERTYP_LIST,
    HVS_CLUSTER_LIST,
} from './records.generated';

/** All records loaded from Freigabecockpit.xlsx */
export const MOCK_RECORDS: FreigabeRecord[] = EXCEL_RECORDS;

/** Returns all records for a given KW key (e.g. "KW10_2026") */
export function getRecordsByKW(kw: string): FreigabeRecord[] {
    return MOCK_RECORDS.filter(r => r.kalenderwoche === kw);
}

/** Returns all unique KW keys present in the data */
export function getAllKWKeys(): string[] {
    return KW_KEYS;
}

/** Returns all unique Speicher variants */
export function getAllSpeicher(): string[] {
    return SPEICHER_LIST;
}

/** Returns all unique Speichertyp values */
export function getAllSpeichertyps(): string[] {
    return SPEICHERTYP_LIST;
}

/** Returns all unique HVS-Cluster values */
export function getAllHvsClusters(): string[] {
    return HVS_CLUSTER_LIST;
}
