import { robotApi } from './client';
import type { BatteryStatus, DetectionStatus, RobotEvent, MoveInput } from '../types/robot';

export const videoStreamUrl = () => 
    `${robotApi.defaults.baseURL}/robot/video`;

export const eventImageUrl = (filename: string) =>
    `${robotApi.defaults.baseURL}/robot/events/image/${encodeURIComponent(filename)}`;

export const getBattery = async (): Promise<BatteryStatus> => {
    const response = await robotApi.get<BatteryStatus>('/robot/battery');
    return response.data;
};

export const getDetectionStatus = async (): Promise<DetectionStatus> => {
    const response = await robotApi.get<DetectionStatus>('/robot/detection/status');
    return response.data;
};

export const getDetectionHealth = async () => {
    const response = await robotApi.get('/robot/detection/health')
    return response.data;
};

export const getLatestEvent = async () => {
    const response = await robotApi.get<{ok: boolean; event: RobotEvent | null}> (
        '/robot/events/latest'
    );
    return response.data;
};

export const getEvents = async () => {
    const response = await robotApi.get<{ ok: boolean; events: RobotEvent[] }>(
        '/robot/events'
    );
    return response.data;
};

export const getRobotHealth = async () => {
    const response = await robotApi.get('/robot/health');
    return response.data;
};

export const moveRobot = async (input: MoveInput) => {
    const response = await robotApi.post('/robot/move', input);
    return response.data;
};

export const stopRobot = async () => {
    const response = await robotApi.post('/robot/stop');
    return response.data;
};