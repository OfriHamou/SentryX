import { Box, Paper, Stack, Typography } from '@mui/material';
import { Place as PlaceIcon } from '@mui/icons-material';
import type { Alert } from '../../types/alert';
import { getEventDisplayByType } from '../live/activity/eventRegistry';

const ALERT_COLORS: Record<string, { color: string; bg: string }> = {
    error: { color: '#EF4444', bg: '#FDECEC' },
    warning: { color: '#F59E0B', bg: '#FEF6E7' },
    info: { color: '#3B82F6', bg: '#EAF2FE' },
    primary: { color: '#6B7EE8', bg: '#EEF0FB' },
    default: { color: '#6B7280', bg: '#F3F4F6' },
};

interface RecentAlertsProps {
    alerts: Alert[];
    max?: number;
    onSelect: (alertId: string) => void;
}

export default function RecentAlerts({ alerts, max = 5, onSelect }: RecentAlertsProps) {
    return (
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'grey.200' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Recent Alerts</Typography>

            {alerts.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No active alerts</Typography>
                ) : (
                <Stack spacing={1.5}>
                    {alerts.slice(0, max).map((alert) => {
                        const display = getEventDisplayByType(alert.event.eventType);
                        const colors = ALERT_COLORS[display.color] ?? ALERT_COLORS.default;
                        const robot = alert.event.robot;
                        const place = [robot?.name, robot?.location].filter(Boolean).join(' · ') || 'Unknown location';
                        return (
                             <Paper 
                                key={alert.id}
                                elevation={0}
                                role="button"
                                tabIndex={0}
                                onClick={() => onSelect(alert.id)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        onSelect(alert.id);
                                    }
                                }}
                                sx={{
                                    p: 2, borderRadius: 2, display: 'flex', gap: 1.5, alignItems: 'flex-start',
                                    bgcolor: colors.bg, border: '1px solid', borderColor: colors.color,
                                    borderLeft: '4px solid', borderLeftColor: colors.color,
                                    cursor: 'pointer',
                                    transition: 'box-shadow 120ms',
                                    '&:hover': { boxShadow: '0 2px 8px rgba(0,0,0,0.12)' },
                                    '&:focus-visible': { outline: '2px solid', outlineColor: colors.color, outlineOffset: 2 },
                                }}
                            >
                                <Box sx={{ color: colors.color, mt: '2px', display: 'flex' }}>{display.icon}</Box>
                                <Box>
                                    <Typography sx={{ fontWeight: 700, color: colors.color }}>{alert.displayTitle}</Typography>
                                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                        {new Date(alert.createdAt).toLocaleString()}
                                    </Typography>
                                    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", mt: 0.5, color: 'text.disabled' }}>
                                        <PlaceIcon sx={{ fontSize: 14 }} />
                                        <Typography variant="caption">{place}</Typography>
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
