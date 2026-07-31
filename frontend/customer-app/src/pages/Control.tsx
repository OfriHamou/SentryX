import { Box, Paper, Typography, Grid, Alert } from '@mui/material';
import { BatteryFull as BatteryIcon, LocationOn as LocationIcon, Gamepad as ModeIcon } from '@mui/icons-material';
import StatusCard from '../components/dashboard/StatusCard';
import MovementControls from '../components/control/MovementControls';
import QuickActions from '../components/control/QuickActions';
import { useBattery } from '../hooks/robot/useBattery';
import { useRobot } from '../hooks/robot/useRobot';
import { useAutoPatrolStatus } from '../hooks/robot/useAutoPatrolStatus';
import type { BatteryLevel } from '../types/robot';
import { hasCustomerPermission, useCustomerAuth } from '../auth/CustomerAuthProvider';

const BATTERY_LABEL: Record<BatteryLevel, string> = {
    Battery_High: 'High',
    Battery_Medium: 'Medium',
    Battery_Low: 'Low',
    Battery_Empty: 'Empty',
};

export default function Control() {
    const { user } = useCustomerAuth();
    const { data: robot } = useRobot();
    const { data: battery } = useBattery();
    const { data: autoPatrolStatus } = useAutoPatrolStatus();
    const canWriteControl = hasCustomerPermission(user?.allowedPages, 'control', 'write');

    const robotName = robot?.name ?? '—';
    const location = robot?.location ?? '—';
    const batteryLabel = battery ? BATTERY_LABEL[battery.status] : '—';
    const isAutoPatrolActive = autoPatrolStatus?.active ?? false;
    const modeDisplay = isAutoPatrolActive ? 'Auto Patrol' : 'Manual';
    const modeColor = isAutoPatrolActive ? 'warning.main' : 'primary.main';

    return (
        <Box>
            <Box sx={{ mb: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                    {isAutoPatrolActive ? 'Auto Patrol' : 'Manual Control'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {isAutoPatrolActive ? 'Autonomous obstacle avoidance' : `Direct control of ${robotName}`}
                </Typography>
            </Box>

            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, bgcolor: '#E8EAEF', mb: 3 }}>
                <Typography variant="overline" sx={{ fontWeight: 700, color: 'text.secondary' }}>Current Status</Typography>
                <Grid container spacing={2} sx={{ mt: 0.5 }}>
                    <Grid size={{ xs: 12, md: 4 }}><StatusCard icon={<BatteryIcon />} label="Battery" value={batteryLabel} /></Grid>
                    <Grid size={{ xs: 12, md: 4 }}><StatusCard icon={<LocationIcon />} label="Location" value={location} /></Grid>
                    <Grid size={{ xs: 12, md: 4 }}><StatusCard icon={<ModeIcon />} label="Mode" value={modeDisplay} valueColor={modeColor} /></Grid>
                </Grid>
            </Paper>

            {isAutoPatrolActive && (
                <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
                    Auto Patrol is controlling the robot. Return to Manual mode to use the joystick.
                </Alert>
            )}

            <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 8 }}><MovementControls canWrite={canWriteControl && !isAutoPatrolActive} /></Grid>
                <Grid size={{ xs: 12, md: 4 }}><QuickActions /></Grid>
            </Grid>
        </Box>
    );
}
