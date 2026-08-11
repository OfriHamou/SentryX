import { Chip } from '@mui/material';

export type DetectorStatus = 'active' | 'inactive' | 'unavailable' | 'comingSoon';

interface StatusPillProps {
    status: DetectorStatus;
}

// 'unavailable' means the detector exists but cannot run right now.
// 'comingSoon' means it has not been built yet, which is not a fault — hence the neutral colour.
const config: Record<DetectorStatus, { label: string; color: 'success' | 'default' | 'warning' }> = {
    active: { label: 'Active', color: 'success' },
    inactive: { label: 'Inactive', color: 'default' },
    unavailable: { label: 'Unavailable', color: 'warning' },
    comingSoon: { label: 'Coming soon', color: 'default' },
};

export default function StatusPill({ status }: StatusPillProps) {
    const { label, color } = config[status];
    return <Chip label={label} color={color} size="small" />;
}
