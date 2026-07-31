import { useEffect, useState } from 'react';
import { getAutoPatrolStatus } from '../../api/robot';

export interface AutoPatrolStatus {
    ok: boolean;
    active: boolean;
    mode: string;
    state: string;
    model_loaded: boolean;
    stream_connected: boolean;
    obstacle_detected: boolean;
    last_action: string;
    last_detection: { name: string | null; score: number | null } | null;
    last_error: string | null;
}

export function useAutoPatrolStatus() {
    const [data, setData] = useState<AutoPatrolStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        let intervalId: number | null = null;

        const fetch = async () => {
            try {
                const response = await getAutoPatrolStatus();
                if (isMounted) {
                    setData(response);
                    setError(null);
                }
            } catch (err) {
                if (isMounted) {
                    setError((err as Error).message);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetch();

        // Poll every second while active (check every second)
        intervalId = window.setInterval(fetch, 1000);

        return () => {
            isMounted = false;
            if (intervalId) clearInterval(intervalId);
        };
    }, []);

    return { data, loading, error };
}
