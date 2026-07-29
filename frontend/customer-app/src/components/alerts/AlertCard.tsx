import { Box, Paper, Typography, Stack, Button, Chip } from '@mui/material';
import {
    Place as PlaceIcon,
    AccessTime as TimeIcon,
    CheckCircle as CheckIcon,
    PersonOutlined as PersonIcon,
    EventAvailable as ShiftIcon,
} from '@mui/icons-material';
import type { Alert } from '../../types/alert';
import { getEventDisplayByType } from '../live/activity/eventRegistry';

const ALERT_STATUS_COLORS: Record<Alert['status'], { color: string; bg: string }> = {
    OPEN: { color: '#EF4444', bg: '#FDECEC' },
    IN_PROGRESS: { color: '#F59E0B', bg: '#FEF6E7' },
    RESOLVED: { color: '#22C55E', bg: '#E9F9EF' },
};

interface AlertCardProps {
    alert: Alert;
    onResolve: () => void;
    onStartHandling?: () => void;
    onViewDetails: () => void;
    canManage: boolean;
    updating?: boolean;
}

function readableEventType(eventType: string): string {
    const readable = eventType.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    return readable ? readable.charAt(0).toUpperCase() + readable.slice(1) : 'Alert';
}

export default function AlertCard({
    alert,
    onResolve,
    onStartHandling,
    onViewDetails,
    canManage,
    updating = false,
}: AlertCardProps) {
    const display = getEventDisplayByType(alert.event.eventType);
    const resolved = alert.status === 'RESOLVED';
    const colors = ALERT_STATUS_COLORS[alert.status];
    const robot = alert.event.robot;
    const robotLabel = [robot?.name, robot?.location].filter(Boolean).join(' · ') || 'Robot unavailable';
    const title = alert.displayTitle || readableEventType(alert.event.eventType);
    const statusLabel = alert.status === 'IN_PROGRESS' ? 'In progress' : alert.status === 'OPEN' ? 'Open' : 'Resolved';

    return (
        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, bgcolor: colors.bg, border: '1px solid', borderColor: colors.color }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                <Box sx={{ color: colors.color, mt: '2px', display: 'flex' }}>
                    {resolved ? <CheckIcon /> : display.icon}
                </Box>
                <Box sx={{ flexGrow: 1 }}>
                    <Typography sx={{ fontWeight: 700, color: colors.color }}>{title}</Typography>
                    <Stack direction="row" spacing={2} sx={{ mt: 0.5, color: 'text.disabled', flexWrap: 'wrap' }}>
                        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                            <PlaceIcon sx={{ fontSize: 14 }} />
                            <Typography variant="caption">{robotLabel}</Typography>
                        </Stack>
                        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                            <TimeIcon sx={{ fontSize: 14 }} />
                            <Typography variant="caption">{new Date(alert.createdAt || alert.event.createdAt).toLocaleString()}</Typography>
                        </Stack>
                        {alert.assignedUser && (
                            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                                <PersonIcon sx={{ fontSize: 14 }} />
                                <Typography variant="caption">
                                    {alert.assignedUser.fullName || alert.assignedUser.email}
                                </Typography>
                            </Stack>
                        )}
                        {alert.assignedShift && (
                            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                                <ShiftIcon sx={{ fontSize: 14 }} />
                                <Typography variant="caption">{alert.assignedShift.name}</Typography>
                            </Stack>
                        )}
                    </Stack>

                    <Stack direction="row" spacing={1} sx={{ mt: 1.5, alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
                        <Chip
                            label={statusLabel}
                            size="small"
                            sx={{ fontWeight: 700, color: colors.color, bgcolor: '#fff' }}
                        />
                        <Button size="small" variant="contained" disableElevation onClick={onViewDetails}
                            sx={{ textTransform: 'none', borderRadius: 2 }}>View Details</Button>
                        {canManage && alert.status === 'OPEN' && onStartHandling && (
                            <Button size="small" variant="outlined" disabled={updating} onClick={onStartHandling}
                                sx={{ textTransform: 'none', borderRadius: 2 }}>Start Handling</Button>
                        )}
                        {canManage && !resolved && (
                            <Button size="small" variant="outlined" disabled={updating} onClick={onResolve}
                                sx={{ textTransform: 'none', borderRadius: 2 }}>Mark Resolved</Button>
                        )}
                    </Stack>
                </Box>
            </Stack>
        </Paper>
    );
}
