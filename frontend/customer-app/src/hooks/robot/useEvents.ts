import { getEventHistory } from '../../api/robot';
import { usePolling } from '../usePolling';

export function useEvents() {
    return usePolling(async () => {
        return await getEventHistory();
    }, 5_000);
}