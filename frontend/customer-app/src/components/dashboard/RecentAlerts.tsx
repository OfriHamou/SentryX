import { Box, Paper, Stack, Typography } from '@mui/material';
import { Place as PlaceIcon } from '@mui/icons-material';
import type { RobotEvent } from '../../types/robot';
import { getEventDisplay } from '../live/activity/eventRegistry';

const ALERT_COLORS: Record<string, { color: string; bg: string }> = {
    error: { color: '#EF4444', bg: '#FDECEC' },
    warning: { color: '#F59E0B', bg: '#FEF6E7' },
    info: { color: '#3B82F6', bg: '#EAF2FE' },
    primary: { color: '#6B7EE8', bg: '#EEF0FB' },
    default: { color: '#6B7280', bg: '#F3F4F6' },
};

interface RecentAlertsProps {
    alerts: RobotEvent[];
    location: string;
    max?: number;
}

export default function RecentAlerts({ alerts, location, max = 5 }: RecentAlertsProps) {
    return (
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'grey.200' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Recent Alerts</Typography>

            {alerts.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No recent alerts</Typography>
            ) : (
                <Stack spacing={1.5}>
                    {alerts.slice(0, max).map((event) => {
                        const display = getEventDisplay(event);
                        const colors = ALERT_COLORS[display.color] ?? ALERT_COLORS.default;
                        return (
                            <Paper key={event.id} elevation={0} sx={{
                                p: 2, borderRadius: 2, display: 'flex', gap: 1.5, alignItems: 'flex-start',
                                bgcolor: colors.bg, border: '1px solid', borderColor: colors.color,
                                borderLeft: '4px solid', borderLeftColor: colors.color,
                            }}>
                                <Box sx={{ color: colors.color, mt: '2px', display: 'flex' }}>{display.icon}</Box>
                                <Box>
                                    <Typography sx={{ fontWeight: 700, color: colors.color }}>{display.title(event)}</Typography>
                                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                        {new Date(event.timestamp).toLocaleString()}
                                    </Typography>
                                    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", mt: 0.5, color: 'text.disabled' }}>
                                        <PlaceIcon sx={{ fontSize: 14 }} />
                                        <Typography variant="caption">{location}</Typography>
                                    </Stack>
                                </Box>
                            </Paper>
                        );
                    })}
                </Stack>
            )}
        </Paper>
    );
}
