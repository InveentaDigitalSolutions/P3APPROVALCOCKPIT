import { useEffect, useRef, useState } from 'react';
import type { IStufeMaster } from '../data/istufeData';
import type { HvsEntry } from '../data/speicherData';
import { loadHvs, loadILevels } from './loaders';

export interface AsyncData<T> {
    data: T | null;
    loading: boolean;
    error: string | null;
    reload: () => void;
}

function useAsync<T>(loader: () => Promise<T>, label: string): AsyncData<T> {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tick, setTick] = useState(0);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        setLoading(true);
        setError(null);

        const timeoutMs = 30_000;
        const timeoutId = setTimeout(() => {
            if (!mounted.current) return;
            setError(`Timed out after ${timeoutMs / 1000}s loading ${label}. Open DevTools → Network to see pending requests.`);
            setLoading(false);
        }, timeoutMs);

        loader()
            .then(result => {
                if (!mounted.current) return;
                clearTimeout(timeoutId);
                setData(result);
                setLoading(false);
            })
            .catch((e: unknown) => {
                if (!mounted.current) return;
                clearTimeout(timeoutId);
                setError(e instanceof Error ? e.message : String(e));
                setLoading(false);
            });

        return () => {
            mounted.current = false;
            clearTimeout(timeoutId);
        };
    }, [loader, label, tick]);

    return { data, loading, error, reload: () => setTick(t => t + 1) };
}

export function useILevels(): AsyncData<IStufeMaster[]> {
    return useAsync(loadILevels, 'I-Stufen');
}

export function useHvs(): AsyncData<HvsEntry[]> {
    return useAsync(loadHvs, 'HVS');
}
