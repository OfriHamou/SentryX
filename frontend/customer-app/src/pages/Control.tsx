import { useState } from 'react';
import { Alert, Box, Button, ButtonGroup, Paper, Typography, Grid } from '@mui/material';
import { BatteryFull as BatteryIcon, LocationOn as LocationIcon, Gamepad as ModeIcon } from '@mui/icons-material';
import StatusCard from '../components/dashboard/StatusCard';
import MovementControls from '../components/control/MovementControls';
import QuickActions from '../components/control/QuickActions';
import { useBattery } from '../hooks/robot/useBattery';
import { useRobot } from '../hooks/robot/useRobot';
import { useControlMode } from '../hooks/robot/useControlMode';
import { useAvoidanceStatus } from '../hooks/robot/useAvoidanceStatus';
import { useAvoidanceHealth } from '../hooks/robot/useAvoidanceHealth';
import AutoModePanel from '../components/control/AutoModePanel';
import { pauseAvoidance, resumeAvoidance, setControlMode, stopAvoidance, stopRobot } from '../api/robot';
import type { BatteryLevel, RobotControlMode } from '../types/robot';
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
    const {
        data: controlModeStatus,
        loading: controlModeLoading,
        error: controlModeError,
        refresh: refreshControlMode,
    } = useControlMode();
    const {
        data: avoidanceStatus,
        loading: avoidanceLoading,
        error: avoidanceError,
        refresh: refreshAvoidanceStatus,
    } = useAvoidanceStatus();
    const {
        data: avoidanceHealth,
        refresh: refreshAvoidanceHealth,
    } = useAvoidanceHealth();
    const canWriteControl = hasCustomerPermission(user?.allowedPages, 'control', 'write');
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);

    const robotName = robot?.name ?? '—';
    const location = robot?.location ?? '—';
    const batteryLabel = battery ? BATTERY_LABEL[battery.status] : '—';
    const currentMode: RobotControlMode = controlModeStatus?.mode ?? robot?.controlMode ?? 'manual';
    const autoPanelError = actionError ?? controlModeError?.message ?? avoidanceError?.message ?? null;

    const refreshAutoData = async () => {
        await Promise.all([
            refreshControlMode(),
            refreshAvoidanceStatus(),
            refreshAvoidanceHealth(),
        ]);
    };

    const handleModeSwitch = async (mode: RobotControlMode) => {
        if (!canWriteControl || isTransitioning || mode === currentMode) {
            return;
        }

        setIsTransitioning(true);
        setActionError(null);

        try {
            if (mode === 'auto') {
                await stopRobot();
            }

            await setControlMode(mode);
            await refreshAutoData();
        } catch (error) {
            await refreshAutoData();
            setActionError((error as Error).message);
        } finally {
            setIsTransitioning(false);
        }
    };

    const runAutoAction = async (action: () => Promise<unknown>) => {
        if (!canWriteControl || isTransitioning) {
            return;
        }

        setIsTransitioning(true);
        setActionError(null);
        try {
            await action();
            await refreshAutoData();
        } catch (error) {
            await refreshAutoData();
            setActionError((error as Error).message);
        } finally {
            setIsTransitioning(false);
        }
    };

     return (
        <Box>
            <Box sx={{ mb: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>Robot Control</Typography>
                <Typography variant="body2" color="text.secondary">Direct control of {robotName}</Typography>
            </Box>

            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, bgcolor: '#E8EAEF', mb: 3 }}>
                <Typography variant="overline" sx={{ fontWeight: 700, color: 'text.secondary' }}>Control Mode</Typography>
                <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <ButtonGroup variant="contained" disabled={!canWriteControl || isTransitioning || controlModeLoading}>
                        <Button
                            color={currentMode === 'manual' ? 'primary' : 'inherit'}
                            onClick={() => void handleModeSwitch('manual')}
                        >
                            Manual
                        </Button>
                        <Button
                            color={currentMode === 'auto' ? 'primary' : 'inherit'}
                            onClick={() => void handleModeSwitch('auto')}
                        >
                            Auto
                        </Button>
                    </ButtonGroup>
                    <Typography variant="body2" color="text.secondary">
                        {isTransitioning
                            ? 'Switching control modes...'
                            : currentMode === 'auto'
                                ? 'Auto mode active'
                                : 'Manual control active'}
                    </Typography>
                </Box>
                {autoPanelError && (
                    <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>
                        {autoPanelError}
                    </Alert>
                )}
            </Paper>

            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, bgcolor: '#E8EAEF', mb: 3 }}>
                <Typography variant="overline" sx={{ fontWeight: 700, color: 'text.secondary' }}>Current Status</Typography>
                <Grid container spacing={2} sx={{ mt: 0.5 }}>
                    <Grid size={{ xs: 12, md: 4 }}><StatusCard icon={<BatteryIcon />} label="Battery" value={batteryLabel} /></Grid>
                    <Grid size={{ xs: 12, md: 4 }}><StatusCard icon={<LocationIcon />} label="Location" value={location} /></Grid>
                    <Grid size={{ xs: 12, md: 4 }}><StatusCard icon={<ModeIcon />} label="Mode" value={currentMode === 'auto' ? 'Auto' : 'Manual'} valueColor="primary.main" /></Grid>
                </Grid>
            </Paper>

            <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 8 }}>
                    <MovementControls
                        canWrite={canWriteControl}
                        controlMode={currentMode}
                        transitionInProgress={isTransitioning}
                    />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    {currentMode === 'auto' ? (
                        <AutoModePanel
                            status={avoidanceStatus}
                            health={avoidanceHealth ?? null}
                            loading={avoidanceLoading}
                            errorMessage={autoPanelError}
                            actionInProgress={isTransitioning}
                            onPause={() => runAutoAction(pauseAvoidance)}
                            onResume={() => runAutoAction(resumeAvoidance)}
                            onStop={() => runAutoAction(stopAvoidance)}
                        />
                    ) : (
                        <QuickActions />
                    )}
                </Grid>
            </Grid>
        </Box>
    );
}
