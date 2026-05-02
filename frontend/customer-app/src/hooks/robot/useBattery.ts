import { getBattery } from '../../api/robot';
import { usePolling } from '../usePolling';

export function useBattery() {
    return usePolling(getBattery, 10_000);
}