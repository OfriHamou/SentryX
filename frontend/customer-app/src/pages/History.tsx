import { useState } from 'react';
import { Box, Paper, Typography, Grid, Stack, Button } from '@mui/material';
import { EventNote as TotalIcon, GppGood as PatrolIcon, ReportProblem as IncidentIcon, Videocam as VideoIcon } from '@mui/icons-material';
import HistoryEventCard from '../components/history/HistoryEventCard';
import StatCard from '../components/dashboard/StatCard';
import { useEventHistory } from '../hooks/robot/useEventHistory';
import { useRobot } from '../hooks/robot/useRobot';

type Range = 'today' | 'week' | 'month';
const RANGE_MS: Record<Range, number> = {
    today: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
};

export default function History() {
    const { data: events } = useEventHistory();
    const { data: robot } = useRobot();
    const [range, setRange] = useState<Range>('week');

    const location = robot?.location ?? '—';
    const allEvents = events ?? [];
    const visible = allEvents.filter((e) => new Date(e.timestamp).getTime() >= Date.now() - RANGE_MS[range]);
    const incidents = visible.filter((e) => e.is_alert).length;

    const tabs: { key: Range; label: string }[] = [
        { key: 'today', label: 'Today' },
        { key: 'week', label: 'This Week' },
        { key: 'month', label: 'This Month' },
    ];

    return (
        <Box>
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, bgcolor: '#E8EAEF', mb: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>Event History</Typography>
                <Stack direction="row" spacing={1.5}>
                    {tabs.map((tab) => (
                        <Button key={tab.key} onClick={() => setRange(tab.key)} disableElevation 
                            sx={{ textTransform: 'none', borderRadius: 2, px: 2.5, fontWeight: 700, 
                                  bgcolor: range === tab.key ? '#fff' : 'transparent',
                                  color: range === tab.key ? 'text.primary' : 'text.secondary',
                                  boxShadow: range === tab.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                                  '&:hover': { bgcolor: range === tab.key ? '#fff' : 'rgba(255,255,255,0.5)' } }}>
                            {tab.label}
                        </Button>  
                    ))}
                </Stack>
            </Paper>

            <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid size={{ xs: 6, md: 3 }}><StatCard value={String(visible.length)} label="Total Events" icon={<TotalIcon />} iconColor="#4318FF" iconBg="#EEF0FB" /></Grid>
                <Grid size={{ xs: 6, md: 3 }}><StatCard value="—" label="Patrols" subtitle="No patrol yet" icon={<PatrolIcon />} iconColor="#22C55E" iconBg="#E9F9EF" /></Grid>
                <Grid size={{ xs: 6, md: 3 }}><StatCard value={String(incidents)} label="Incidents" icon={<IncidentIcon />} iconColor="#EF4444" iconBg="#FDECEC" /></Grid>
                <Grid size={{ xs: 6, md: 3 }}><StatCard value="—" label="Videos" subtitle="Not available" icon={<VideoIcon />} iconColor="#F59E0B" iconBg="#FEF6E7" /></Grid>
            </Grid>

            {visible.length === 0 ? (
                <Typography color="text.secondary">No events in this period</Typography>
            ) : (
                <Stack spacing={2}>
                    {visible.map((e) => <HistoryEventCard key={e.id} event={e} location={location} />)}
                </Stack>
            )}
        </Box>
    );
}