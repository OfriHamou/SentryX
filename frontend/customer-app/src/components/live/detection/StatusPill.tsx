import { Chip } from '@mui/material';

export type DetectorStatus = 'active' | 'inactive' | 'unavailable';

interface StatusPillProps {
    status: DetectorStatus;
}

const config: Record<DetectorStatus, { label: string; color: 'success' | 'default' | 'warning' }> = {
    active: { label: 'Active', color: 'success' },
    inactive: { label: 'Inactive', color: 'default' },
    unavailable: { label: 'Unavailable', color: 'warning' },
};

export default function StatusPill({ status }: StatusPillProps) {
    const { label, color } = config[status];
    return <Chip label={label} color={color} size="small" />;
}
