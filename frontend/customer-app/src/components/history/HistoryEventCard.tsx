import { Box, Paper, Typography, Stack, Chip } from '@mui/material';
import { Place as PlaceIcon, AccessTime as TimeIcon } from '@mui/icons-material';
import type { RobotEvent } from '../../types/robot';
import { getEventDisplay } from '../live/activity/eventRegistry';

const COLORS: Record<string, { color: string; bg: string }> = {
    error: { color: '#EF4444', bg: '#FDECEC' },
    warning: { color: '#F59E0B', bg: '#FEF6E7' },
    info: { color: '#3B82F6', bg: '#EAF2FE' },
    primary: { color: '#6B7EE8', bg: '#EEF0FB' },
    default: { color: '#6B7280', bg: '#F3F4F6' },
};

interface HistoryEventCardProps { event: RobotEvent; location: string; }

export default function HistoryEventCard({ event, location }: HistoryEventCardProps) {
    const display = getEventDisplay(event);
    const colors = COLORS[display.color] ?? COLORS.default;
    return (
        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'grey.200', borderLeft: '4px solid', borderLeftColor: colors.color }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                <Box sx={{ color: colors.color, mt: '2px', display: 'flex' }}>{display.icon}</Box>
                <Box sx={{ flexGrow: 1 }}>
                    <Typography sx={{ fontWeight: 700 }}>{display.title(event)}</Typography>
                    <Stack direction="row" spacing={2} sx={{ mt: 0.5, color: 'text.disabled', flexWrap: 'wrap' }}>
                        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                            <PlaceIcon sx={{ fontSize: 14 }} /><Typography variant="caption">{location}</Typography>
                        </Stack>
                        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                            <TimeIcon sx={{ fontSize: 14 }} /><Typography variant="caption">{new Date(event.timestamp).toLocaleString()}</Typography>
                        </Stack>
                    </Stack>
                </Box>
                {event.status && <Chip label={event.status} size="small" sx={{ fontWeight: 600, textTransform: 'capitalize' }} />}
            </Stack>
        </Paper>
    );
}