import { getAlerts } from '../api/alerts';
import { usePolling } from './usePolling';

const ACTIVE_ALERTS_POLL_MS = 10_000;
const RECENT_ALERTS_LIMIT = 5;

export function useActiveAlerts() {
    return usePolling(
        () => getAlerts({ status: 'active', limit: RECENT_ALERTS_LIMIT }),
        ACTIVE_ALERTS_POLL_MS,
    );
}
