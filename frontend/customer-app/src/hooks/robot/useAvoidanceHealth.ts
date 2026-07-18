import { getAvoidanceHealth } from '../../api/robot';
import { usePolling } from '../usePolling';

export function useAvoidanceHealth() {
    return usePolling(getAvoidanceHealth, 5_000);
}
