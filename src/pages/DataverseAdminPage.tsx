import { useCallback, useEffect, useState } from 'react';
import './DataverseAdminPage.css';

const TABLES = [
    'cr9b2_brv',
    'cr9b2_cdh_ip3',
    'cr9b2_hvs',
    'cr9b2_ilevels_1',
    'cr9b2_ip3_freigaben',
    'cr9b2_planned_component_approvals',
    'cr9b2_verbundfreigaben',
    'cr9b2_wbs_type_mapping',
] as const;

type TableName = typeof TABLES[number];
type Row = Record<string, unknown>;

const SYSTEM_FIELD_RE = /^(_|@odata\.)|^(createdon|modifiedon|createdby|modifiedby|owninguser|owningteam|owningbusinessunit|ownerid|importsequencenumber|overriddencreatedon|timezoneruleversionnumber|utcconversiontimezonecode|versionnumber|statecode|statuscode)$/i;

function primaryKeyName(entity: TableName): string {
    return `${entity}id`;
}

function getRowId(row: Row, entity: TableName): string | null {
    const key = primaryKeyName(entity);
    const v = row[key];
    if (typeof v === 'string') return v;
    for (const [k, val] of Object.entries(row)) {
        if (typeof val === 'string' && k.toLowerCase().endsWith('id') && !k.startsWith('_')) return val;
    }
    return null;
}

function isEditable(key: string, entity: TableName): boolean {
    if (SYSTEM_FIELD_RE.test(key)) return false;
    if (key === primaryKeyName(entity)) return false;
    return true;
}

function formatCell(v: unknown): string {
    if (v == null) return '';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
}

async function dvRequest(path: string, init: RequestInit = {}): Promise<unknown> {
    const res = await fetch(`/__dv__${path}`, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...init.headers },
    });
    const text = await res.text();
    let data: unknown = null;
    if (text) {
        try { data = JSON.parse(text); } catch { data = text; }
    }
    if (!res.ok) {
        const msg = (data && typeof data === 'object' && 'error' in data)
            ? JSON.stringify((data as { error: unknown }).error)
            : `${res.status} ${res.statusText}`;
        throw new Error(msg);
    }
    return data;
}

async function listRecords(entity: TableName): Promise<Row[]> {
    const data = await dvRequest(`/${entity}?$top=200`) as { value?: Row[] };
    return data.value ?? [];
}

async function createRecord(entity: TableName, item: Row): Promise<void> {
    await dvRequest(`/${entity}`, { method: 'POST', body: JSON.stringify(item) });
}

async function updateRecord(entity: TableName, id: string, item: Row): Promise<void> {
    await dvRequest(`/${entity}/${id}`, { method: 'PATCH', body: JSON.stringify(item) });
}

async function deleteRecord(entity: TableName, id: string): Promise<void> {
    await dvRequest(`/${entity}/${id}`, { method: 'DELETE' });
}

interface FormState {
    mode: 'create' | 'edit';
    row: Row;
    fields: string[];
    originalId?: string;
}

export function DataverseAdminPage() {
    const [table, setTable] = useState<TableName>('cr9b2_wbs_type_mapping');
    const [rows, setRows] = useState<Row[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState<FormState | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await listRecords(table);
            setRows(data);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [table]);

    useEffect(() => { void refresh(); }, [refresh]);

    const columns = rows[0] ? Object.keys(rows[0]).filter(c => !c.startsWith('@odata.')) : [];
    const editableColumns = columns.filter(c => isEditable(c, table));

    const openCreate = () => {
        setForm({
            mode: 'create',
            row: Object.fromEntries(editableColumns.map(c => [c, ''])),
            fields: editableColumns,
        });
    };

    const openEdit = (row: Row) => {
        const id = getRowId(row, table);
        if (!id) {
            setError('Could not find primary key for this row');
            return;
        }
        setForm({
            mode: 'edit',
            row: { ...row },
            fields: editableColumns,
            originalId: id,
        });
    };

    const handleSave = async () => {
        if (!form) return;
        const payload: Row = {};
        for (const f of form.fields) {
            const v = form.row[f];
            // Only include fields that actually have values (skip empty strings for create)
            if (v !== undefined && v !== '') payload[f] = v;
        }
        setLoading(true);
        setError(null);
        try {
            if (form.mode === 'create') {
                await createRecord(table, payload);
            } else {
                await updateRecord(table, form.originalId!, payload);
            }
            setForm(null);
            await refresh();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (row: Row) => {
        const id = getRowId(row, table);
        if (!id) { setError('Could not find primary key'); return; }
        if (!window.confirm('Delete this record?')) return;
        setLoading(true);
        setError(null);
        try {
            await deleteRecord(table, id);
            await refresh();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="dv-admin">
            <div className="dv-admin__header">
                <h1 className="dv-admin__title">Dataverse Admin</h1>
                <div className="dv-admin__controls">
                    <select
                        className="dv-admin__select"
                        value={table}
                        onChange={e => setTable(e.target.value as TableName)}
                        disabled={loading}
                    >
                        {TABLES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <button className="dv-admin__btn" onClick={refresh} disabled={loading}>Refresh</button>
                    <button
                        className="dv-admin__btn dv-admin__btn--primary"
                        onClick={openCreate}
                        disabled={loading || rows.length === 0}
                        title={rows.length === 0 ? 'Cannot infer schema from empty table' : undefined}
                    >
                        + New
                    </button>
                </div>
            </div>

            {error && <div className="dv-admin__error">{error}</div>}

            <div className="dv-admin__count">
                {loading ? 'Loading…' : `${rows.length} row(s)`}
                {columns.length > 0 && <span className="dv-admin__cols">· {columns.length} columns</span>}
            </div>

            <div className="dv-admin__table-wrap">
                <table className="dv-admin__table">
                    <thead>
                        <tr>
                            {columns.map(c => <th key={c}>{c}</th>)}
                            <th className="dv-admin__actions-col">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, i) => {
                            const id = getRowId(row, table);
                            return (
                                <tr key={id ?? i}>
                                    {columns.map(c => (
                                        <td key={c} title={formatCell(row[c])}>
                                            {formatCell(row[c])}
                                        </td>
                                    ))}
                                    <td className="dv-admin__actions-col">
                                        <button className="dv-admin__btn dv-admin__btn--sm" onClick={() => openEdit(row)}>Edit</button>
                                        <button className="dv-admin__btn dv-admin__btn--sm dv-admin__btn--danger" onClick={() => handleDelete(row)}>Delete</button>
                                    </td>
                                </tr>
                            );
                        })}
                        {rows.length === 0 && !loading && (
                            <tr><td colSpan={columns.length + 1} className="dv-admin__empty">No rows.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {form && (
                <div className="dv-admin__modal-backdrop" onClick={() => setForm(null)}>
                    <div className="dv-admin__modal" onClick={e => e.stopPropagation()}>
                        <h2>{form.mode === 'create' ? 'New record' : 'Edit record'}</h2>
                        <div className="dv-admin__modal-subtitle">{table}</div>
                        <div className="dv-admin__fields">
                            {form.fields.map(f => (
                                <label key={f} className="dv-admin__field">
                                    <span className="dv-admin__field-label">{f}</span>
                                    <input
                                        className="dv-admin__input"
                                        value={String(form.row[f] ?? '')}
                                        onChange={e => setForm({ ...form, row: { ...form.row, [f]: e.target.value } })}
                                    />
                                </label>
                            ))}
                            {form.fields.length === 0 && (
                                <div className="dv-admin__empty">No editable fields detected.</div>
                            )}
                        </div>
                        <div className="dv-admin__modal-actions">
                            <button className="dv-admin__btn" onClick={() => setForm(null)}>Cancel</button>
                            <button className="dv-admin__btn dv-admin__btn--primary" onClick={handleSave} disabled={loading}>Save</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
