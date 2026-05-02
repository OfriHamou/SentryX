import { getEvents } from '../../api/robot';
import { usePolling } from '../usePolling';

export function useEvents() {
    return usePolling(async () => {
        const res = await getEvents();
        return res.events ?? [];
    }, 5_000);
}