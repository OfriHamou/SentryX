import { getDetectionStatus } from '../../api/robot';
import { usePolling } from '../usePolling';

export function useDetectionStatus() {
    return usePolling(getDetectionStatus, 2_000);
}