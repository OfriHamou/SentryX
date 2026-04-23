import { useEffect, useRef, useState, useCallback } from 'react';

export function usePolling<T>(
    fetcher: () => Promise<T>,
    intervalMs: number,
) {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const fetcherRef = useRef(fetcher);
    fetcherRef.current = fetcher;

    const fetchNow = useCallback(async () => {
        try {
            const result = await fetcherRef.current();
            setData(result);
            setError(null);
        } catch (err) {
            setError(err as Error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        let intervalId: number | undefined;

        const start = () => {
            fetchNow();
            intervalId = window.setInterval(fetchNow, intervalMs);
        };

        const stop = () => {
            if (intervalId !== undefined) {
                window.clearInterval(intervalId);
                intervalId = undefined;
            }
        };

        const handleVisibility = () => {
            if (document.hidden) {
                stop();
            } else {
                start();
            }
        };

        start();
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            stop();
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [fetchNow, intervalMs]);

    return { data, loading, error, refresh: fetchNow };
}