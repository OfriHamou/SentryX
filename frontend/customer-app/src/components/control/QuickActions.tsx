import { useState } from 'react';
import type { ReactElement } from 'react';
import { Paper, Typography, Stack, Button, Alert, Box } from '@mui/material';
import { Home as DockIcon, PlayArrow as ResumeIcon, Stop as StopIcon, CheckCircle as OkIcon, Cancel as FailIcon } from '@mui/icons-material';
import { useAutoPatrol } from '../../hooks/robot/useAutoPatrol';
import type { AutoPatrolStatus } from '../../hooks/robot/useAutoPatrolStatus';
import { patrolStateLabel, detectionText } from '../../utils/patrolStatus';

const STATUS_ICON_SX = { fontSize: 14 } as const;

function statusIcon(isOk: boolean): ReactElement
{
    if (isOk)
    {
        return <OkIcon sx={STATUS_ICON_SX} />;
    }
    else
    {
        return <FailIcon sx={STATUS_ICON_SX} />;
    }
}

interface StatusRowProps
{
    label: string;
    value: string;
    color: string;
    icon?: ReactElement;
}

function StatusRow({ label, value, color, icon }: StatusRowProps)
{
    return (
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', color }}>
                {icon}
                <Typography variant="caption" sx={{ fontWeight: 600 }}>{value}</Typography>
            </Stack>
        </Stack>
    );
}

interface QuickActionsProps
{
    autoPatrolStatus: AutoPatrolStatus | null;
    statusError: string | null;
}

export default function QuickActions({ autoPatrolStatus, statusError }: QuickActionsProps) {
    const btnSx = { justifyContent: 'flex-start', textTransform: 'none', borderRadius: 2, py: 1.2 } as const;
    const { start, stop, isLoading } = useAutoPatrol();
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const isAutoPatrolActive = autoPatrolStatus?.active ?? false;
    const isModelReady = autoPatrolStatus?.model_loaded ?? false;
    const isCameraConnected = autoPatrolStatus?.stream_connected ?? false;
    const stateLabel = patrolStateLabel(autoPatrolStatus?.state);
    const detectionLabel = detectionText(autoPatrolStatus?.last_detection ?? null);

    const isStatusUnavailable = !autoPatrolStatus && Boolean(statusError);
    const isStatusLoading = !autoPatrolStatus && !statusError;
    const isPatrolBlocked = Boolean(autoPatrolStatus) && !isModelReady;

    let panel = { title: 'Patrol readiness', borderColor: 'grey.200', bgColor: 'transparent' };

    if (isAutoPatrolActive)
    {
        panel = { title: 'Patrol active', borderColor: '#BBD6F5', bgColor: '#E3F2FD' };
    }
    else if (isPatrolBlocked)
    {
        panel = { title: 'Patrol unavailable', borderColor: '#F0D9AC', bgColor: '#FEF6E7' };
    }
    else if (isStatusUnavailable)
    {
        panel = { title: 'Robot unreachable', borderColor: '#F0D9AC', bgColor: '#FEF6E7' };
    }

    let model: { value: string; color: string; icon?: ReactElement } =
        { value: 'Ready', color: 'success.main', icon: statusIcon(true) };

    if (isStatusLoading)
    {
        model = { value: 'Checking…', color: 'text.secondary' };
    }
    else if (!isModelReady)
    {
        model = { value: 'Not loaded', color: 'error.main', icon: statusIcon(false) };
    }

    const runPatrolAction = async (action: () => Promise<unknown>) => {
        setErrorMsg(null);
        try {
            await action();
        } catch (err) {
            setErrorMsg((err as Error).message);
        }
    };

    return (
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'grey.200', height: '100%' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Quick Actions</Typography>
            <Stack spacing={1.5}>
                <Button
                    startIcon={<DockIcon />}
                    variant="outlined"
                    disabled
                    sx={btnSx}
                >
                    Return to Charging Dock
                </Button>

                <Button
                    startIcon={<ResumeIcon />}
                    variant="outlined"
                    onClick={() => void runPatrolAction(start)}
                    disabled={isAutoPatrolActive || isLoading || !isModelReady}
                    sx={btnSx}
                >
                    Start Auto Patrol
                </Button>

                <Button
                    startIcon={<StopIcon />}
                    variant="contained"
                    color="error"
                    onClick={() => void runPatrolAction(stop)}
                    disabled={!isAutoPatrolActive || isLoading}
                    sx={btnSx}
                >
                    Stop Auto Patrol
                </Button>
            </Stack>

            {errorMsg && (
                <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>
                    {errorMsg}
                </Alert>
            )}

            {isAutoPatrolActive && autoPatrolStatus?.last_error && (
                <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>
                    {autoPatrolStatus.last_error}
                </Alert>
            )}

            <Box sx={{
                mt: 2,
                p: 2,
                borderRadius: 2,
                border: '1px solid',
                borderColor: panel.borderColor,
                bgcolor: panel.bgColor,
            }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.25 }}>
                    {isAutoPatrolActive && (
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main' }} />
                    )}
                    <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'text.secondary' }}>
                        {panel.title}
                    </Typography>
                </Stack>

                {isAutoPatrolActive && (
                    <Typography sx={{ fontWeight: 700, fontSize: 15, color: '#15588F', mb: 1.25 }}>
                        {stateLabel}
                    </Typography>
                )}

                {!isAutoPatrolActive && !isPatrolBlocked && !isStatusUnavailable && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.25 }}>
                        Explores on its own and avoids obstacles it detects.
                    </Typography>
                )}

                {!isStatusUnavailable && (
                    <Stack spacing={0.75}>
                        {isAutoPatrolActive && detectionLabel && (
                            <StatusRow label="Detected" value={detectionLabel} color="text.primary" />
                        )}

                        <StatusRow label="Obstacle detection" value={model.value} color={model.color} icon={model.icon} />

                        {isAutoPatrolActive && (
                            <StatusRow
                                label="Camera feed"
                                value={isCameraConnected ? 'Connected' : 'Disconnected'}
                                color={isCameraConnected ? 'success.main' : 'error.main'}
                                icon={statusIcon(isCameraConnected)}
                            />
                        )}
                    </Stack>
                )}

                {isStatusUnavailable && (
                    <Typography variant="caption" sx={{ display: 'block', color: 'warning.main' }}>
                        Cannot reach the robot. Check that it is powered on and connected.
                    </Typography>
                )}

                {isPatrolBlocked && (
                    <Typography variant="caption" sx={{ display: 'block', mt: 1.25, color: 'warning.main' }}>
                        Start is disabled until the detection model loads on the robot.
                    </Typography>
                )}
            </Box>
        </Paper>
    );
}