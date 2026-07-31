import { useState } from 'react';
import { startAutoPatrol, stopAutoPatrol } from '../../api/robot';

export function useAutoPatrol() {
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const start = async () => {
        setIsLoading(true);
        try {
            await startAutoPatrol();
            setErrorMessage(null);
        } catch (err) {
            console.warn('Start Auto Patrol failed:', err);
            setErrorMessage((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    const stop = async () => {
        setIsLoading(true);
        try {
            await stopAutoPatrol();
            setErrorMessage(null);
        } catch (err) {
            console.warn('Stop Auto Patrol failed:', err);
            setErrorMessage((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    return { start, stop, isLoading, errorMessage };
}
