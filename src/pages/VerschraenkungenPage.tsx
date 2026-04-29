import React, { useMemo, useState } from 'react';
import { ISTUFE_MASTERS } from '../data/istufeData';
import { HVS_DATA } from '../data/speicherData';
import { useEntanglements } from '../data/entanglements';
import type { Entanglement } from '../data/entanglements';
import './VerschraenkungenPage.css';

export const VerschraenkungenPage: React.FC = () => {
    const { entanglements, add, remove } = useEntanglements();

    /* ── Picker state ── */
    const [seTermin, setSeTermin] = useState<string>('');
    const [reife, setReife] = useState<string>('');
    const [speicher, setSpeicher] = useState<string>('');
    const [muster, setMuster] = useState<string>('');
    const [feedback, setFeedback] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

    /* ── Option lists ── */
    const seTerminOptions = useMemo(() => {
        return [...new Set(ISTUFE_MASTERS.map(m => m.seTermin))].sort();
    }, []);

    const reifeOptions = useMemo(() => {
        if (!seTermin) return [] as number[];
        const set = new Set<number>();
        for (const m of ISTUFE_MASTERS) if (m.seTermin === seTermin) set.add(m.reife);
        return [...set].sort((a, b) => b - a);
    }, [seTermin]);

    /** "Speicher" in BMW domain = HVS short code (e.g. "B6RO0"). */
    const speicherOptions = useMemo(() => {
        return [...new Set(HVS_DATA.map(h => h.hvs).filter(Boolean))].sort();
    }, []);

    const musterOptions = useMemo(() => {
        if (!speicher) return [] as string[];
        return [...new Set(
            HVS_DATA.filter(h => h.hvs === speicher).map(h => h.muster).filter(Boolean)
        )].sort();
    }, [speicher]);

    /* ── Derived ── */
    const istufeKey = seTermin && reife ? `${seTermin}-${reife}` : '';
    const istufeIsValid = istufeKey && ISTUFE_MASTERS.some(m => m.istufe === istufeKey);
    const ready = !!istufeIsValid && !!speicher && !!muster;

    const reset = () => {
        setSeTermin(''); setReife(''); setSpeicher(''); setMuster('');
        setFeedback(null);
    };

    const handleSave = () => {
        if (!ready) return;
        const created = add({ seTermin, reife: Number(reife), speicher, muster });
        if (!created) {
            setFeedback({ kind: 'error', text: 'Diese Verschränkung existiert bereits.' });
            return;
        }
        setFeedback({
            kind: 'ok',
            text: `Verschränkung gespeichert: ${created.istufe} → ${created.speicher} · ${created.muster}`,
        });
        // Keep the istufe selection in case the user wants to add more for the same Softwarestand
        setMuster('');
    };

    /* ── Group existing entanglements by istufe for display ── */
    const grouped = useMemo(() => {
        const map = new Map<string, Entanglement[]>();
        for (const e of entanglements) {
            const list = map.get(e.istufe) ?? [];
            list.push(e);
            map.set(e.istufe, list);
        }
        return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    }, [entanglements]);

    return (
        <div className="vs-page">
            {/* Header */}
            <div className="vs-page__header">
                <div>
                    <h1 className="vs-page__title">Verschränkungen</h1>
                    <p className="vs-page__subtitle">
                        Softwarestand an Speicher und Speichermuster binden — alle künftigen
                        Freigaben gelten dann ausschließlich für diese Kombination
                    </p>
                </div>
            </div>

            {/* Builder */}
            <div className="vs-builder">
                <div className="vs-builder__title">Neue Verschränkung anlegen</div>

                <div className="vs-builder__grid">
                    {/* Step 1: ISTUFE */}
                    <div className="vs-field">
                        <label className="vs-field__label">
                            <span className="vs-field__step">1</span>
                            ISTUFE
                        </label>
                        <select className="vs-select"
                            value={seTermin}
                            onChange={e => { setSeTermin(e.target.value); setReife(''); setFeedback(null); }}>
                            <option value="">— wählen —</option>
                            {seTerminOptions.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    {/* Step 2: Reifegrad */}
                    <div className="vs-field">
                        <label className="vs-field__label">
                            <span className="vs-field__step">2</span>
                            Reifegrad
                        </label>
                        <select className="vs-select"
                            value={reife}
                            disabled={!seTermin}
                            onChange={e => { setReife(e.target.value); setFeedback(null); }}>
                            <option value="">{seTermin ? '— wählen —' : 'Zuerst ISTUFE wählen'}</option>
                            {reifeOptions.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>

                    {/* Step 3: Speicher */}
                    <div className="vs-field">
                        <label className="vs-field__label">
                            <span className="vs-field__step">3</span>
                            Speicher
                        </label>
                        <select className="vs-select"
                            value={speicher}
                            disabled={!reife}
                            onChange={e => { setSpeicher(e.target.value); setMuster(''); setFeedback(null); }}>
                            <option value="">{reife ? '— wählen —' : 'Zuerst Reifegrad wählen'}</option>
                            {speicherOptions.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    {/* Step 4: Speichermuster */}
                    <div className="vs-field">
                        <label className="vs-field__label">
                            <span className="vs-field__step">4</span>
                            Speichermuster
                        </label>
                        <select className="vs-select"
                            value={muster}
                            disabled={!speicher}
                            onChange={e => { setMuster(e.target.value); setFeedback(null); }}>
                            <option value="">{speicher ? '— wählen —' : 'Zuerst Speicher wählen'}</option>
                            {musterOptions.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                </div>

                {/* Preview */}
                {ready && (
                    <div className="vs-builder__preview">
                        <span className="vs-builder__preview-label">Vorschau:</span>
                        <span className="vs-builder__preview-istufe">{istufeKey}</span>
                        <span className="vs-builder__preview-arrow">→</span>
                        <span className="vs-builder__preview-target">
                            <strong>{speicher}</strong>
                            <span className="vs-builder__preview-sep">·</span>
                            <strong>{muster}</strong>
                        </span>
                    </div>
                )}

                {feedback && (
                    <div className={`vs-builder__feedback vs-builder__feedback--${feedback.kind}`}>
                        {feedback.text}
                    </div>
                )}

                <div className="vs-builder__actions">
                    <button className="btn btn--ghost btn--sm" onClick={reset} disabled={!seTermin && !speicher}>
                        Zurücksetzen
                    </button>
                    <button className={`btn btn--primary${ready ? '' : ' btn--disabled'}`}
                        disabled={!ready}
                        onClick={handleSave}>
                        Verschränkung speichern
                    </button>
                </div>
            </div>

            {/* Active list */}
            <div className="vs-list">
                <div className="vs-list__header">
                    <div className="vs-list__title">
                        Aktive Verschränkungen
                        <span className="vs-list__count">{entanglements.length}</span>
                    </div>
                </div>

                {entanglements.length === 0 ? (
                    <div className="vs-list__empty">
                        Noch keine Verschränkungen. Wähle oben einen Softwarestand und ein Speichermuster, um zu beginnen.
                    </div>
                ) : (
                    <div className="vs-list__groups">
                        {grouped.map(([istufe, items]) => (
                            <div key={istufe} className="vs-group">
                                <div className="vs-group__head">
                                    <span className="vs-group__istufe">{istufe}</span>
                                    <span className="vs-group__count">
                                        {items.length} {items.length === 1 ? 'Bindung' : 'Bindungen'}
                                    </span>
                                </div>
                                <div className="vs-group__items">
                                    {items.map(e => (
                                        <div key={e.id} className="vs-item">
                                            <div className="vs-item__target">
                                                <span className="vs-item__speicher">{e.speicher}</span>
                                                <span className="vs-item__sep">·</span>
                                                <span className="vs-item__muster">{e.muster}</span>
                                            </div>
                                            <div className="vs-item__meta">
                                                {new Date(e.createdAt).toLocaleString('de-DE', {
                                                    day: '2-digit', month: '2-digit', year: 'numeric',
                                                    hour: '2-digit', minute: '2-digit',
                                                })}
                                            </div>
                                            <button className="vs-item__delete"
                                                onClick={() => remove(e.id)}
                                                title="Verschränkung entfernen"
                                                aria-label="Verschränkung entfernen">
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
