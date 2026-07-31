import { customerApi } from '../../api/customerApi';
import { usePolling } from '../usePolling';

export interface Robot {
    id: string;
    name: string;
    location: string | null;
    status?: string;
}

export function useRobot() {
    return usePolling(async () => {
        const res = await customerApi.get<{ ok: boolean; robot: Robot }>('/robot/current');
        return res.data.robot;
    }, 30_000);
}
