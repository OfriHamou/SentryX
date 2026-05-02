import { Box, Typography } from '@mui/material';
import type { RobotEvent } from '../../../types/robot';
import { getEventDisplay } from './eventRegistry';

const timeAgo = (iso: string) => {
    const msAgo = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(msAgo / 60_000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} minutes${mins === 1 ? '' : 's'} ago`;

    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
};

interface EventRowProps {
    event: RobotEvent;
}

export default function EventRow({ event }: EventRowProps) {
    const { icon, title } = getEventDisplay(event);

    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                py: 1.5,
                px: 2,
                mb: 1,
                borderRadius: 2,
                '&:last-of-type': { borderBottom: 'none' },
                bgcolor: 'gray.100',
            }}
        >

            <Box sx={{ color: 'text.secondary', display: 'flex' }}>{icon}</Box>
            <Box sx={{ flexGrow: 1 }}>
                <Typography variant="body2">{title(event)}</Typography>
                <Typography variant="caption" color="text.secondary">
                    {timeAgo(event.timestamp)}
                </Typography>
            </Box>
        </Box>
    );
}
