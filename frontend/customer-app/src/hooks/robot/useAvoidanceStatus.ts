import { getAvoidanceStatus } from '../../api/robot';
import { usePolling } from '../usePolling';

export function useAvoidanceStatus() {
    return usePolling(getAvoidanceStatus, 1_000);
}
