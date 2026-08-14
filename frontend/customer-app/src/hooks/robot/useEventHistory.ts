import { getEventHistory } from '../../api/robot';
import { usePolling } from '../usePolling';

export function useEventHistory() {
    return usePolling(getEventHistory, 5_000);  
}