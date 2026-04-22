import { MicrosoftDataverseService } from '../generated';

/**
 * Generic Dataverse list fetcher.
 * Returns rows typed as T — caller is responsible for the shape.
 * Paginates up to 5000 rows per call; most tables in this app are well under that.
 */
export async function listAll<T>(
    entity: string,
    options: { select?: string; filter?: string; orderby?: string; top?: number } = {},
): Promise<T[]> {
    const { select, filter, orderby, top = 5000 } = options;

    const result = await MicrosoftDataverseService.ListRecords(
        entity,
        undefined, // prefer
        undefined, // accept
        undefined, // x_ms_odata_metadata_full
        select,
        filter,
        orderby,
        undefined, // $expand
        undefined, // fetchXml
        top,
    );

    if (!result.success) {
        const msg = result.error?.message ?? 'unknown error';
        throw new Error(`Dataverse ListRecords(${entity}) failed: ${msg}`);
    }

    return (result.data.value ?? []).map(r => (r.dynamicProperties ?? {}) as T);
}
