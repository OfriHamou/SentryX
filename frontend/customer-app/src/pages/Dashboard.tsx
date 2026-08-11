import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert as MuiAlert, Box, Paper, Typography, Grid } from '@mui/material';
import { BatteryFull as BatteryIcon, LocationOn as LocationIcon, Update as UpdateIcon, Autorenew as StatusIcon,
    WarningAmber as WarningIcon, GppGood as ShieldIcon, LocalFireDepartment as IncidentIcon,
    Security as PatrolIcon, Stop as StopIcon, Videocam as LiveIcon, SportsEsports as ControlIcon } from '@mui/icons-material';
import StatusCard from '../components/dashboard/StatusCard';
import StatCard from '../components/dashboard/StatCard';
import ActionButton from '../components/dashboard/ActionButton';
import RecentAlerts from '../components/dashboard/RecentAlerts';
import { hasCustomerPermission, useCustomerAuth } from '../auth/CustomerAuthProvider';
import { useRobot } from '../hooks/robot/useRobot';
import { useBattery } from '../hooks/robot/useBattery';
import { useDetectionStatus } from '../hooks/robot/useDetectionStatus';
import { useAutoPatrol } from '../hooks/robot/useAutoPatrol';
import { useAutoPatrolStatus } from '../hooks/robot/useAutoPatrolStatus';
import { useEvents } from '../hooks/robot/useEvents';
import { useActiveAlerts } from '../hooks/useActiveAlerts';
import type { BatteryLevel } from '../types/robot';
import { patrolStateLabel } from '../utils/patrolStatus';

const BATTERY_LABEL: Record<BatteryLevel, string> = {
    Battery_High: 'High',
    Battery_Medium: 'Medium',
    Battery_Low: 'Low',
    Battery_Empty: 'Empty',
};

export default function Dashboard() {
    const navigate = useNavigate();
    const { user } = useCustomerAuth();
    const canReadLive = hasCustomerPermission(user?.allowedPages, 'live', 'read');
    const canReadControl = hasCustomerPermission(user?.allowedPages, 'control', 'read');
    const canWriteControl = hasCustomerPermission(user?.allowedPages, 'control', 'write');

    const { data: robot } = useRobot();
    const { data: battery } = useBattery();
    const { data: detection } = useDetectionStatus();
    const { data: activeAlerts } = useActiveAlerts();
    const { data: events } = useEvents();
    const { start, stop, isLoading: patrolBusy } = useAutoPatrol();
    const { data: patrolStatus } = useAutoPatrolStatus();
    const [patrolError, setPatrolError] = useState<string | null>(null);

    const allEvents = events ?? [];

    const location = robot?.location ?? '-';
    const batteryLabel = battery ? BATTERY_LABEL[battery.status] : '-';
    const lastUpdate = detection?.last_detection_time ? new Date(detection.last_detection_time).toLocaleString() : '-';
    const isOnline = detection?.camera_opened ?? false;

    const isPatrolActive = patrolStatus?.active ?? false;
    const isModelReady = patrolStatus?.model_loaded ?? false;

    const runPatrolAction = async (action: () => Promise<unknown>) => {
        setPatrolError(null);
        try {
            await action();
        } 
        catch (err) {
            setPatrolError((err as Error).message);
        }
    };


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
                    <StatCard value={String(activeAlerts?.counts.active ?? 0)} label="Active Alerts" icon={<WarningIcon />} iconColor="#EF4444" iconBg="#FDECEC" />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    <StatCard
                        value={isPatrolActive ? 'Active' : 'Idle'}
                        label="Auto Patrol"
                        subtitle={isPatrolActive ? patrolStateLabel(patrolStatus?.state) : 'Not running'}
                        icon={<ShieldIcon />}
                        iconColor={isPatrolActive ? '#22C55E' : '#6B7280'}
                        iconBg={isPatrolActive ? '#E9F9EF' : '#F3F4F6'}
                    />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    <StatCard value={String(allEvents.length)} label="Detections" subtitle="This session" icon={<IncidentIcon />} iconColor="#F59E0B" iconBg="#FEF6E7" />
                </Grid>
            </Grid>

            {/* Recent alerts */}
            <Box sx={{ mb: 3 }}>
                <RecentAlerts
                    alerts={activeAlerts?.alerts ?? []}
                    onSelect={(alertId) => navigate(`/alerts?alertId=${encodeURIComponent(alertId)}`)}
                />
            </Box>

            {patrolError && (
                <MuiAlert severity="error" onClose={() => setPatrolError(null)} sx={{ mb: 2, borderRadius: 2 }}>
                    {patrolError}
                </MuiAlert>
            )}

            {/* Quick actions */}
            <Grid container spacing={2}>
                <Grid size={{ xs: 6, md: 3 }}>
                    <ActionButton
                        icon={<PatrolIcon />}
                        label="Start Patrol"
                        tone="primary"
                        onClick={() => void runPatrolAction(start)}
                        disabled={!canWriteControl || isPatrolActive || patrolBusy || !isModelReady}
                    />
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                    <ActionButton
                        icon={<StopIcon />}
                        label="Stop Patrol"
                        tone="danger"
                        onClick={() => void runPatrolAction(stop)}
                        disabled={!canWriteControl || !isPatrolActive || patrolBusy}
                    />
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}><ActionButton icon={<LiveIcon />} label="View Live" tone="primary" onClick={() => navigate('/live')} disabled={!canReadLive} /></Grid>
                <Grid size={{ xs: 6, md: 3 }}><ActionButton icon={<ControlIcon />} label="Manual Control" tone="primary" onClick={() => navigate('/control')} disabled={!canReadControl} /></Grid>
            </Grid>
        </Box>
    );
}
