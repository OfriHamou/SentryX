import { getControlMode } from '../../api/robot';
import { usePolling } from '../usePolling';

export function useControlMode() {
    return usePolling(getControlMode, 1_000);
}
