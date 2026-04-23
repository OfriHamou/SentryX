import type { ReactNode } from 'react';
import {
    Face as FaceIcon,
    Warning as WarningIcon,
    DirectionsRun as MotionIcon,
    LocalFireDepartment as FireIcon,
    Cloud as SmokeIcon,
    HelpOutlined as UnknownIcon,
} from '@mui/icons-material';
import type { RobotEvent } from '../../../types/robot';

interface EventDisplay {
    icon: ReactNode;
    title: (e: RobotEvent) => string;
    color: 'primary' | 'warning' | 'error' | 'info' | 'default';
}

const registry: Record<string, EventDisplay> = {
    face_recognized: {
        icon: <FaceIcon />,
        title: (e) => `Face recognized: ${e.detections?.[0]?.name ?? 'Unknown'}`,
        color: 'primary',
    },

    face_detected_unknown: {
        icon: <WarningIcon />,
        title: () => 'Unknown person detected',
        color: 'warning',
    },

    motion: {
        icon: <MotionIcon />,
        title: () => 'Motion detected',
        color: 'info',
    },

    smoke: {
        icon: <SmokeIcon />,
        title: () => 'Smoke detected',
        color: 'error',
    },

    fire: {
        icon: <FireIcon />,
        title: () => 'Fire detected',
        color: 'error',
    },
};

const fallback: EventDisplay = {
    icon: <UnknownIcon />,
    title: (e) => e.type.replace(/_/g, ' '),
    color: 'default',
};

export function getEventDisplay(event: RobotEvent): EventDisplay {
    return registry[event.type] ?? fallback;
}
