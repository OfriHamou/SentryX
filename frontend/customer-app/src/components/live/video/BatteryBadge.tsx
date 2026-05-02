import { BatteryFull, Battery80, Battery50, Battery20, BatteryAlert } from '@mui/icons-material';
import VideoOverlay from './VideoOverlay';
import type { BatteryLevel } from '../../../types/robot';

interface BatteryBadgeProps {
  status: BatteryLevel | null;
  voltage: number | null;
}

function iconFor(status: BatteryLevel | null) {
    switch (status) {
        case 'Battery_High':   return <BatteryFull fontSize="small" />;
        case 'Battery_Medium': return <Battery80 fontSize="small" />;
        case 'Battery_Low':    return <Battery20 fontSize="small" />;
        case 'Battery_Empty':  return <BatteryAlert fontSize="small" />;
        default:               return <Battery50 fontSize="small" />;
    }
}

function labelFor(voltage: number | null) {
    if (voltage === null) return '-';
    const percent = Math.round(((voltage - 9.9) / (12.0 - 9.9)) * 100);
    const clamped = Math.max(0, Math.min(100, percent));
    return `${clamped}%`;
}

export default function BatteryBadge({ status, voltage }: BatteryBadgeProps) {
    return (
        <VideoOverlay position="bottom-left">
            {iconFor(status)}
            {labelFor(voltage)}
        </VideoOverlay>
    ); 
}