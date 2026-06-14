import { useState } from 'react';
import { Box, Paper, Typography, Stack, Button, Select, MenuItem, TextField, FormControl } from '@mui/material';
import AlertCard from '../components/alerts/AlertCard';
import { useEvents } from '../hooks/robot/useEvents';
import { useRobot } from '../hooks/robot/useRobot';

type StatusFilter = 'all' | 'active' | 'resolved';
type TimeRange = '24h' | 'week' | 'month' | 'custom';

const RANGE_MS: Record<'24h' | 'week' | 'month', number> = {
    '24h': 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
};
const DAY_MS = 24 * 60 * 60 * 1000;

export default function Alerts() {
    const { data: events } = useEvents();
    const { data: robot } = useRobot();
    const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
    const [status, setStatus] = useState<StatusFilter>('all');
    const [timeRange, setTimeRange] = useState<TimeRange>('24h');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');

    const location = robot?.location ?? '—';
    const isResolved = (id: string) => resolvedIds.has(id);
    const markResolved = (id: string) => setResolvedIds((prev) => new Set(prev).add(id));

    const inTimeRange = (ts: string) => {
        const t = new Date(ts).getTime();
        if (timeRange === 'custom') {
            const from = customFrom ? new Date(customFrom).getTime() : -Infinity;
            const to = customTo ? new Date(customTo).getTime() + DAY_MS : Infinity; // include the whole "to" day
            return t >= from && t <= to;
        }
        return t >= Date.now() - RANGE_MS[timeRange];
    };

    // alerts within the selected time range (status counts reflect this too)
    const timeAlerts = (events ?? []).filter((e) => e.is_alert && inTimeRange(e.timestamp));
    const activeCount = timeAlerts.filter((a) => !isResolved(a.id)).length;
    const resolvedCount = timeAlerts.filter((a) => isResolved(a.id)).length;

    const visible = timeAlerts.filter((a) => {
        if (status === 'active') return !isResolved(a.id);
        if (status === 'resolved') return isResolved(a.id);
        return true;
    });

    const tabs: { key: StatusFilter; label: string; count: number }[] = [
        { key: 'all', label: 'All', count: timeAlerts.length },
        { key: 'active', label: 'Active', count: activeCount },
        { key: 'resolved', label: 'Resolved', count: resolvedCount },
    ];

    return (
        <Box>
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, bgcolor: '#E8EAEF', mb: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>Alerts &amp; Notifications</Typography>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}
                    sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}>
                    {/* status tabs */}
                    <Stack direction="row" spacing={1.5}>
                        {tabs.map((t) => (
                            <Button key={t.key} onClick={() => setStatus(t.key)} disableElevation
                                sx={{
                                    textTransform: 'none', borderRadius: 2, px: 2.5, fontWeight: 700,
                                    bgcolor: status === t.key ? '#fff' : 'transparent',
                                    color: status === t.key ? 'text.primary' : 'text.secondary',
                                    boxShadow: status === t.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                                    '&:hover': { bgcolor: status === t.key ? '#fff' : 'rgba(255,255,255,0.5)' },
                                }}>
                                {t.label} ({t.count})
                            </Button>
                        ))}
                    </Stack>

                    {/* time range */}
                    <FormControl size="small" sx={{ minWidth: 170 }}>
                        <Select value={timeRange} onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                            sx={{ bgcolor: '#fff', borderRadius: 2 }}>
                            <MenuItem value="24h">Last 24 hours</MenuItem>
                            <MenuItem value="week">Last week</MenuItem>
                            <MenuItem value="month">Last month</MenuItem>
                            <MenuItem value="custom">Custom</MenuItem>
                        </Select>
                    </FormControl>
                </Stack>

                {/* custom date range */}
                {timeRange === 'custom' && (
                    <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                        <TextField type="date" size="small" label="From" value={customFrom}
                            onChange={(e) => setCustomFrom(e.target.value)}
                            slotProps={{ inputLabel: { shrink: true } }} sx={{ bgcolor: '#fff', borderRadius: 2 }} />
                        <TextField type="date" size="small" label="To" value={customTo}
                            onChange={(e) => setCustomTo(e.target.value)}
                            slotProps={{ inputLabel: { shrink: true } }} sx={{ bgcolor: '#fff', borderRadius: 2 }} />
                    </Stack>
                )}
            </Paper>

            {visible.length === 0 ? (
                <Typography color="text.secondary">No alerts</Typography>
            ) : (
                <Stack spacing={2}>
                    {visible.map((e) => (
                        <AlertCard key={e.id} event={e} location={location}
                            resolved={isResolved(e.id)} onResolve={() => markResolved(e.id)} />
                    ))}
                </Stack>
            )}
        </Box>
    );
}
