import { Box, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import StatusPill, { type DetectorStatus } from './StatusPill';

interface DetectorRowProps {
    name: string;
    icon: ReactNode;
    status: DetectorStatus;
}

export default function DetectorRow({ name, icon, status }: DetectorRowProps) {
    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                py: 1.5,
                borderBottom: '1px solid',
                borderColor: 'grey.100',
                '&:last-of-type': { borderBottom: 'none' },
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ color: 'text.secondary', display: 'flex' }}>{icon}</Box>
                <Typography variant="body2">{name}</Typography>
            </Box>

            <StatusPill status={status} />
        </Box>
    );
}
