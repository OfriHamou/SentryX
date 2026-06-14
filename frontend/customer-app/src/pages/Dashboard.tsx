import { useNavigate } from 'react-router-dom';
import { Box, Paper, Typography, Grid } from '@mui/material';
import { BatteryFull as BatteryIcon, LocationOn as LocationIcon, Update as UpdateIcon, Autorenew as StatusIcon,
    WarningAmber as WarningIcon, GppGood as ShieldIcon, LocalFireDepartment as IncidentIcon,
    Security as PatrolIcon, Pause as PauseIcon, Videocam as LiveIcon, SportsEsports as ControlIcon } from '@mui/icons-material';
import StatusCard from '../components/dashboard/StatusCard';
import StatCard from '../components/dashboard/StatCard';
import ActionButton from '../components/dashboard/ActionButton';
import RecentAlerts from '../components/dashboard/RecentAlerts';
import { useRobot } from '../hooks/robot/useRobot';
import { useBattery } from '../hooks/robot/useBattery';
import { useDetectionStatus } from '../hooks/robot/useDetectionStatus';
import { useEvents } from '../hooks/robot/useEvents';
import type { BatteryLevel } from '../types/robot';

const BATTERY_LABEL: Record<BatteryLevel, string> = {
    Battery_High: 'High',
    Battery_Medium: 'Medium',
    Battery_Low: 'Low',
    Battery_Empty: 'Empty',
};

export default function Dashboard() {
    const navigate = useNavigate();

    const { data: robot } = useRobot();
    const { data: battery } = useBattery();
    const { data: detection } = useDetectionStatus();
    const { data: events } = useEvents();

    const allEvents = events ?? [];
    const alerts= allEvents.filter((e) => e.is_alert);

    const location = robot?.location ?? '-';
    const batteryLabel = battery ? BATTERY_LABEL[battery.status] : '-';
    const lastUpdate = detection?.last_detection_time ? new Date(detection.last_detection_time).toLocaleString() : '-';
    const isOnline = detection?.camera_opened ?? false;

    return (
        <Box>
            {/* Robot Status */}
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, bgcolor: '#E8EAEF', mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>{robot?.name ?? '-'}</Typography>
                <Grid container spacing={2}>
                    <Grid size={{xs: 12, sm: 6, md: 3}}>
                        <StatusCard icon={<BatteryIcon />} label="Battery" value={batteryLabel} />
                    </Grid>
                    <Grid size={{xs: 12, sm: 6, md: 3}}>
                        <StatusCard icon={<LocationIcon />} label="Location" value={location} />
                    </Grid>
                    <Grid size={{xs: 12, sm: 6, md: 3}}>
                        <StatusCard icon={<UpdateIcon />} label="Last Update" value={lastUpdate} />
                    </Grid>
                    <Grid size={{xs: 12, sm: 6, md: 3}}>
                        <StatusCard icon={<StatusIcon />} label="Current Status" value={isOnline ? 'Active' : 'Offline'} valueColor={isOnline ? 'success.main' : 'text.secondary'} />
                    </Grid>
                </Grid>
            </Paper>

            {/* Stats */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, md: 4 }}>
                    <StatCard value={String(alerts.length)} label="Active Alerts" icon={<WarningIcon />} iconColor="#EF4444" iconBg="#FDECEC" />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    {/* TODO: needs backend */}
                    <StatCard value="—" label="Patrol Sessions" subtitle="No data yet" icon={<ShieldIcon />} iconColor="#22C55E" iconBg="#E9F9EF" />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    <StatCard value={String(allEvents.length)} label="Incidents" subtitle="This session" icon={<IncidentIcon />} iconColor="#F59E0B" iconBg="#FEF6E7" />
                </Grid>
            </Grid>

            {/* Recent alerts */}
            <Box sx={{ mb: 3 }}>
                <RecentAlerts alerts={alerts} location={location} />
            </Box>

            {/* Quick actions */}
            <Grid container spacing={2}>
                <Grid size={{ xs: 6, md: 3 }}><ActionButton icon={<PatrolIcon />} label="Start Patrol" tone="primary" /></Grid>
                <Grid size={{ xs: 6, md: 3 }}><ActionButton icon={<PauseIcon />} label="Pause" tone="danger" /></Grid>
                <Grid size={{ xs: 6, md: 3 }}><ActionButton icon={<LiveIcon />} label="View Live" tone="primary" onClick={() => navigate('/live')} /></Grid>
                <Grid size={{ xs: 6, md: 3 }}><ActionButton icon={<ControlIcon />} label="Manual Control" tone="primary" onClick={() => navigate('/live', { state: { fullscreen: true } })} /></Grid>
            </Grid>
        </Box>
    );
}
