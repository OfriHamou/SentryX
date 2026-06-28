import { Box, Paper, Typography, Stack, Button, Chip } from '@mui/material';
import { Place as PlaceIcon, AccessTime as TimeIcon, CheckCircle as CheckIcon } from '@mui/icons-material';
import type { RobotEvent } from '../../types/robot';
import { getEventDisplay } from '../live/activity/eventRegistry';

const ALERT_COLORS: Record<string, { color: string; bg: string }> = {
    error: { color: '#EF4444', bg: '#FDECEC' },
    warning: { color: '#F59E0B', bg: '#FEF6E7' },
    info: { color: '#3B82F6', bg: '#EAF2FE' },
    primary: { color: '#6B7EE8', bg: '#EEF0FB' },
    default: { color: '#6B7280', bg: '#F3F4F6' },
};
const RESOLVED = { color: '#22C55E', bg: '#E9F9EF' };

interface AlertCardProps {
    event: RobotEvent;
    location: string;
    resolved: boolean;
    onResolve: () => void;
    onViewDetails?: () => void;
    canResolve: boolean;
}

export default function AlertCard({ event, location, resolved, onResolve, onViewDetails, canResolve }: AlertCardProps) {
    const display = getEventDisplay(event);
    const colors = resolved ? RESOLVED : (ALERT_COLORS[display.color] ?? ALERT_COLORS.default);

    return (
        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, bgcolor: colors.bg, border: '1px solid', borderColor: colors.color }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                <Box sx={{ color: colors.color, mt: '2px', display: 'flex' }}>
                    {resolved ? <CheckIcon /> : display.icon}
                </Box>
                <Box sx={{ flexGrow: 1 }}>
                    <Typography sx={{ fontWeight: 700, color: colors.color }}>{display.title(event)}</Typography>
                    <Stack direction="row" spacing={2} sx={{ mt: 0.5, color: 'text.disabled', flexWrap: 'wrap' }}>
                        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                            <PlaceIcon sx={{ fontSize: 14 }} />
                            <Typography variant="caption">{location}</Typography>
                        </Stack>
                        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                            <TimeIcon sx={{ fontSize: 14 }} />
                            <Typography variant="caption">{new Date(event.timestamp).toLocaleString()}</Typography>
                        </Stack>
                    </Stack>

                    {resolved ? (
                        <Chip label="Resolved" size="small" sx={{ mt: 1.5, fontWeight: 700, color: RESOLVED.color, bgcolor: '#fff' }} />
                    ) : (
                        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                            <Button size="small" variant="contained" disableElevation onClick={onViewDetails}
                                sx={{ textTransform: 'none', borderRadius: 2 }}>View Details</Button>
                            {canResolve && (
                                <Button size="small" variant="outlined" onClick={onResolve}
                                    sx={{ textTransform: 'none', borderRadius: 2 }}>Mark Resolved</Button>
                            )}
                        </Stack>
                    )}
                </Box>
            </Stack>
        </Paper>
    );
}
